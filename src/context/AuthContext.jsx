/**
 * Real Cognito-backed auth (amazon-cognito-identity-js).
 *
 * status: 'loading' | 'signedOut' | 'newPassword' | 'signedIn'
 * role:   'admin' | 'operador' | null  (from the cognito:groups claim)
 *
 * Tokens are not written to localStorage by us; the library persists its own
 * session under its default storage so the session survives a page reload.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js'
import { userPool, sessionInfo } from '../auth/cognito'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user,   setUser]   = useState(null)   // { username, role, idToken, accessToken }
  const [error,  setError]  = useState(null)
  const [busy,   setBusy]   = useState(false)
  const [requiredAttributes, setRequiredAttributes] = useState([]) // attrs Cognito needs on 1st login
  const pendingRef = useRef(null)              // CognitoUser awaiting newPassword challenge

  // Restore an existing session on mount
  useEffect(() => {
    const current = userPool.getCurrentUser()
    if (!current) { setStatus('signedOut'); return }
    current.getSession((err, session) => {
      if (err || !session?.isValid()) { setStatus('signedOut'); return }
      setUser(sessionInfo(session))
      setStatus('signedIn')
    })
  }, [])

  const signIn = useCallback((username, password) => {
    setError(null)
    setBusy(true)
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool })
    const authDetails = new AuthenticationDetails({ Username: username, Password: password })

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        setUser(sessionInfo(session))
        setStatus('signedIn')
        setBusy(false)
      },
      onFailure: (err) => {
        setError(err?.message || 'Error de autenticación')
        setBusy(false)
      },
      newPasswordRequired: (_userAttributes, requiredAttributes) => {
        // First login: Cognito requires a new password (and any required attributes
        // the pool defines, e.g. `name`) before issuing tokens
        pendingRef.current = cognitoUser
        setRequiredAttributes(requiredAttributes ?? [])
        setBusy(false)
        setStatus('newPassword')
      },
    })
  }, [])

  const completeNewPassword = useCallback((newPassword, attributes = {}) => {
    const cognitoUser = pendingRef.current
    if (!cognitoUser) return
    setError(null)
    setBusy(true)
    cognitoUser.completeNewPasswordChallenge(newPassword, attributes, {
      onSuccess: (session) => {
        pendingRef.current = null
        setRequiredAttributes([])
        setUser(sessionInfo(session))
        setStatus('signedIn')
        setBusy(false)
      },
      onFailure: (err) => {
        setError(err?.message || 'No se pudo establecer la contraseña')
        setBusy(false)
      },
    })
  }, [])

  const signOut = useCallback(() => {
    userPool.getCurrentUser()?.signOut()
    pendingRef.current = null
    setUser(null)
    setError(null)
    setStatus('signedOut')
  }, [])

  const value = {
    status,
    user,
    role: user?.role ?? null,
    error,
    busy,
    requiredAttributes,
    signIn,
    completeNewPassword,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
