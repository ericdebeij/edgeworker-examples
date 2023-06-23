import { logger } from 'log';
import { httpRequest } from 'http-request';
import { JWTValidator } from './jwt.js';
import { crypto} from 'crypto';
import { Cookies } from 'cookies';

//advanced options for jwt validator
const jwtOption = {
  //check token expiry
  ignoreExpiration: false,
  //check token nbf
  ignoreNotBefore: true
};

const jwtValidator = new JWTValidator(jwtOption);

export async function onClientRequest(request) {
  try {
    var certResponse = await httpRequest(`${request.scheme}://${request.host}/oidc/certs`);
    var certs = await certResponse.json(); 
    
    var cookies = new Cookies(request.getHeader('Cookie'));
    let jwtToken = request.getHeader('jwt');
    if (!jwtToken) jwtToken = cookies.get("__jwt__");
    if (!jwtToken) throw new Error('token required');
    
    let keys = [];
    for (let i = 0; i < certs.keys.length; ++i) {
      const c = certs.keys[i];

      const iKey = await crypto.subtle.importKey(
        'jwk',
        c,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        false,
        ['verify']
      );
      keys.push(iKey)
    }
    const jwtJSON = await jwtValidator.validate(jwtToken, keys);
    const result = {
      jwt: jwtJSON,
      verified: true
    };

    // For debugging"
    if (request.path.endsWith('/debug')) request.respondWith(200, {"Content-Type": ["application/json"]}, JSON.stringify(result));

    // Additional claims to be verified in the jwtJSON object
    // your code

  } catch (error) {
    logger.log('Error: %s', error.message);
    request.respondWith(400, {}, error.message);
  }
}