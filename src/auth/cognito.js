import { CognitoUserPool } from 'amazon-cognito-identity-js'

// Cognito User Pool (us-east-1). SPA app client — no client secret.
export const userPool = new CognitoUserPool({
  UserPoolId: 'us-east-1_G3eGddOgp',
  ClientId:   '18jom6ecnt7msf1mcom9uth15e',
})

// Map Cognito groups (from the cognito:groups claim) to an app role.
export function roleFromGroups(groups) {
  if (!Array.isArray(groups)) return null
  if (groups.includes('admin'))    return 'admin'
  if (groups.includes('operador')) return 'operador'
  return null
}

// Extract the bits the app needs from a valid CognitoUserSession.
export function sessionInfo(session) {
  const idToken = session.getIdToken()
  const payload = idToken.decodePayload()
  return {
    username:    payload['cognito:username'] ?? payload.sub,
    role:        roleFromGroups(payload['cognito:groups']),
    idToken:     idToken.getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
  }
}
