/*
(c) Copyright 2023 Akamai Technologies, Inc. Licensed under Apache 2 license.

Version: 1.2
Purpose:  Example code of how you could use an EdgeWorker to implement OIDC authentication

See readme.md for the details
*/
import { httpRequest } from 'http-request';
import { createResponse } from 'create-response';
import URLSearchParams from 'url-search-params';
import { Cookies } from 'cookies';
import { base64url } from "encoding"
import { EdgeAuth } from "auth/edgeauth.js";
import { randomString, newCookie, deleteCookie } from "util.js"

// Unpack the jwt without validation of the signature
// note: validation is advised but not necessary if the token is freshly received from a trusted source
function jwt2json(s) {
  let r = {};
  try {
    let a = s.split('.');

    r.header = JSON.parse(base64url.decode(a[0], "String"));
    r.payload = JSON.parse(base64url.decode(a[1], "String"));
    r.signature = a[2];
  } catch (e) {
    r.error = e.toString();
  }
  return r;
}

// Auth flow, step 1: Initiate the login by redirection to the login endpoint and storing the login mode
async function oidcLogin(oidcContext, request) {
  let params = new URLSearchParams(request.query);
  let responseHeaders = {};
  let cookList = [];

  // Setup redirect URL
  if (params.get('url'))
    cookList.push(newCookie('oidcurl', params.get('url'), oidcContext.basedir).toHeader());

  // Generate and store a nonce
  const nonce = randomString(8);
  cookList.push(newCookie('nonce', nonce, oidcContext.basedir).toHeader());

  responseHeaders["set-cookie"] = cookList;
  responseHeaders.location = [
    `${oidcContext.auth}?client_id=${oidcContext.clientId}&nonce=${nonce}&redirect_uri=${oidcContext.redirect}&response_type=code&scope=openid+email&prompt=consent`];
  return Promise.resolve(createResponse(302, responseHeaders, ''));
}

// Generate an Akamai token
function generateToken(secret, startTime, windowSeconds, acl, payload) {
        let akamaitoken = "empty"
        const ea = new EdgeAuth({
          key: secret,
          startTime: startTime,
          windowSeconds: windowSeconds,
          //salt: jwtId.payload.hd, //you might want to add the hd claim as the salt, but that will require to use the same in the token verification
          payload: payload,
          escapeEarly: true,
        });
        akamaitoken = ea.generateACLToken(acl);
        return akamaitoken;
}

// This function can be updated to verify additional claims once the jwt is received from the IDP
// In this sample only users with an akamai email address are allowed access to the entire website
function userAccess(oidcContext, jwtPayload) {
  let r = {};
  if (jwtPayload.email_verified && jwtPayload.email.endsWith(oidcContext.access)) {
    r.acl = ["/*"];
    r.payload = jwtPayload.email;
  } else {
    r.info = "restricted area, access limited to akamai personal";
  }
  return r;
}

// Auth flow, step 2: Callback
// Request parameter: code - code to be used to fetch the token from the idp
// Cookie parameter: loginUrl - redirect url, debug_block (no retrieval), debug_info (collect response info)
async function oidcCallback(oidcContext, request) {
  const params = new URLSearchParams(request.query);
  const code = params.get("code");
  const cookies = new Cookies(request.getHeader('Cookie'));
  const redirecturl = cookies.get("oidcurl");

  let newCookies = [];
  let failureContent = {};
  let failureStatus = 400;

  if (!redirecturl)
    redirecturl = '/';

  if (code) {
    // Retrieve tokens for the code as passed in
    const tokenParams = `grant_type=authorization_code&prompt=select_account&redirect_uri=${oidcContext.redirect}&code=${code}`;
    const credentials = `client_id=${oidcContext.clientId}&client_secret=${oidcContext.clientSecret}`;
    const tokenResponse = await httpRequest(`${request.scheme}://${request.host}${oidcContext.basedir}/token`, {
      method: "POST",
      headers: { "Content-Type": ["application/x-www-form-urlencoded"] },
      body: `${tokenParams}&${credentials}`
    });

    if (tokenResponse.ok) {
      let tokenResult = await tokenResponse.json();

      let jwtId = jwt2json(tokenResult.id_token);
      tokenResult.id_decode = jwtId;

      const nonce = cookies.get("nonce");
      if (!(jwtId && jwtId.payload && jwtId.payload.nonce && jwtId.payload.nonce === nonce))
        return Promise.resolve(createResponse(403, { "X-TTT": [tokenResult.id_token], "X-Nonce": [nonce] }, 'Nonce failed'));

      const access = userAccess(oidcContext, jwtId.payload);
      if (!(access && access.acl && (access.acl.length >= 1))) 
        return Promise.resolve(createResponse(403, {}, JSON.stringify(access)));

      const startTime = Math.trunc(Date.now() / 1000);

      const akamaitoken = generateToken(
        oidcContext.akamaiSecret, 
        startTime, 
        tokenResult.expires_in, 
        access.acl, 
        access.payload);

      const tok = newCookie('__token__', akamaitoken, '/', oidcContext.domain, tokenResult.expires_in);
      newCookies.push(tok.toHeader());

      const tid = newCookie('__jwt__', tokenResult.id_token, '/', oidcContext.domain, tokenResult.expires_in);
      newCookies.push(tid.toHeader())

      const jwtAccess = jwt2json(tokenResult.access_token);
      tokenResult.access_decode = jwtAccess;

      // Redirect if we can
      return Promise.resolve(createResponse(302, {
        'Set-Cookie': newCookies,
        'Location': [redirecturl]
      },
        ''));
    } else {
      // not tokenResponse.ok, use text instead of JSON as the response is not always JSON
      const responseTxt = await tokenResponse.text();
      try {
        failureContent = JSON.parse(responseTxt);
        failureContent.url = redirecturl;
      } catch (err) {
        failureContent.error = "callback_failure";
        failureStatus = tokenResponse.status;
        failureContent.description = "callback received indicates error";
        failureContent.details = responseTxt;
        failureContent.path = `${request.scheme}://${request.host}${oidcContext.basedir}/token`
        failureContent.params = tokenParams;
      }
    }
  } else { // no code given or debug_block requested
    failureContent.error = "precondition";
    failureContent.description = `callback request not initiated, redirect-url:${redirecturl}, query:${request.query}`;
  }

  // Response for failures
  return Promise.resolve(
    createResponse(failureStatus, { 'content-type': ['application/json'] }, JSON.stringify(failureContent)));
}

async function oidcLogout(oidcContext, request) {
  let cookies = [];
  let responseHeaders = {};

  let ctoken = deleteCookie('__token__', "/", oidcContext.domain);
  cookies.push(ctoken.toHeader());

  let cjwt = deleteCookie('__jwt__', "/", oidcContext.domain)
  cookies.push(cjwt.toHeader());

  responseHeaders["set-cookie"] = cookies;
  responseHeaders.location = ['/'];
  return Promise.resolve(createResponse(302, responseHeaders, ''));
}

function newOidcContext(request) {
  let oidcContext = {};
  oidcContext.basedir = request.path.match(/.*\//)[0];
  oidcContext.base = oidcContext.basedir.slice(1, -1).replaceAll('/', '_').toUpperCase();
  oidcContext.redirect = `https://${request.host}${oidcContext.basedir}callback`;

  // Property Manager variables
  oidcContext.akamaiSecret = request.getVariable(`PMUSER_${oidcContext.base}_AKSECRET`);
  oidcContext.clientId = request.getVariable(`PMUSER_${oidcContext.base}_CLIENTID`);
  oidcContext.clientSecret = request.getVariable(`PMUSER_${oidcContext.base}_SECRET`);
  oidcContext.auth = request.getVariable(`PMUSER_${oidcContext.base}_AUTH_URL`);
  oidcContext.access = request.getVariable(`PMUSER_${oidcContext.base}_ACCESS`);
  oidcContext.domain = request.host.replace(/^[^.]+\./g, '');
  return oidcContext
}

// MAIN entry point, configuration and routing
export async function responseProvider(request) {
  // Initialise context based on request and property manager variables
  let oidcContext = newOidcContext(request);

  if (request.path.endsWith('/login')) {
    return oidcLogin(oidcContext, request);
  }

  if (request.path.endsWith('/callback')) {
    return oidcCallback(oidcContext, request);
  }

  if (request.path.endsWith('/logout')) {
    return oidcLogout(oidcContext, request);
  }

  return Promise.resolve(createResponse(404, 
    { 'Content-Type': ['text/plain; charset=us-ascii'] }, 
    `No route for ${request.url}`));
}
