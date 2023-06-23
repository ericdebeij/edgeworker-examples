# JWKS Edgeworker

## Installation
- Download this repository. 
- Customize the code to reflect your situation
- Tar and gzip the contents of the "edgeworker" folder, and deploy to Akamai using a "basic compute" resource tier. See the [Akamai Techdocs](https://techdocs.akamai.com/edgeworkers/docs/create-a-code-bundle) for the details 

## How it works
The edgeworker uses the onclient request to validate the JWT.

The JWT can be provided as the header __JWT__ or the cookie __\_\_JWT\_\___.

In order to validate the signature of the JWT the public certificate set is requested based on the well-known information of the IDP. As external requests from an Edgeworker need to go via an Akamai configuration, the path /oidc/certs is used to get the certificates.

## Customizations
This is an example you might want to extend:
- Currently only JWT signed with RSASSA-PKCS1-v1_5 RSA-256 is supported
- Error handling should be improved. Currently the function just returns with a 400 error if the token is not valid or not available.
- Only the basic claims are validated (e.g exp. nbf), you might want to additional checks.

## Debugging
For debugging purpose any protected resource ending with /debug shows the verification result instead of going forward to the origin or serve from cache.