import {SetCookie} from 'cookies'

// Utilities - randomstring
function randomString(len) {
    let s = '';
    while (s.length < len) s += (Math.random() * 36 | 0).toString(36);
    return s;
  }
  
  // Create a cookie in one line
  function newCookie(name, val, path, domain, maxAge) {
    let c = new SetCookie();
    c.name = name;
    c.value = val;
    if (path) c.path = path;
    if (domain) c.domain = domain;
    if (maxAge) c.maxAge = maxAge;
    c.secure = true;
    return c;
  }
  
  // Delete a cookie in one line
  function deleteCookie(name, path, domain) {
    return newCookie(name, '', path, domain, -1);
  }

  export { randomString, newCookie, deleteCookie}