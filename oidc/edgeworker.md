# OIDC Edgeworker

## Installation
- Download this repository. 
- Customize the code to reflect your situation
- Tar and gzip the contents of the "edgeworker" folder, and deploy to Akamai using a "dynamic compute" resource tier. See the [Akamai Techdocs](https://techdocs.akamai.com/edgeworkers/docs/create-a-code-bundle) for the details 

## Customization
OIDC is used for authentication. 

Authorization requires rules at the IDP or application logic. It can use the claims in the JWT. In the example code the user is authorized if email address is verified and the users email address is linked the domains as specified in the property manager variable OIDC_ACCESS

## Resources
The OIDC EdgeWorker currently implements a number of resources. The selection of the resource is based on the last path element in the url used.

### /oidc/login?url=redirect-url
Initiate the login process. The redirect url will be temporary stored in a cookie associated

Parameters:
- url: Used upon successful login to redirect to the original requested url. 

### /oidc/callback?code=authorization-code
Used upon succesful authentication at the IDP to request the JWT tokens, generate the token and perform the redirect to the origal requested url.

Parameters:
- code: Part of the OIDC code flow. The code will be used by the callback routine to verify the login with the IDP.

Cookies created:
- \_\_token\_\_: the generated Akamai Token
- \_\_jwt\_\_: the JWT token 

### /oidc/logout
Can be used to remove the cookies and restart the login process on subsequest requests

Cookies removed:
- \_\_token\_\_: the generated Akamai Token
- \_\_jwt\_\_: the JWT token

