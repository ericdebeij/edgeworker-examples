# JWKS at the Akamai Edge

**DISCLAIMER: This code is designed to be used as an example only. No guarantees are made that it's fit for purpose. It's not production ready and should not be used to protect critical resources**

This example can be used to verifiy a JSON WebToken using a public certifate which is available on an external location.

# How to setup
Setup requires configurations at multiple places
- [JWKS Edgeworker](edgeworker.md) - Configure the Edgeworker
- [Property manager](propertymanager.md) - Configure the property
  - Edgeworker behavior - Ensure Edgeworker is used
  - Certificate - Proxy to fetch and cache the public certificatecd

# Credits
The code is based on the JWT authentication example in the [Akamai edgeworker-examples repository](https://github.com/akamai/edgeworkers-examples/tree/master/edgecompute/examples/authentication/jwt)