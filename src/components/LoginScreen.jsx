import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Friendly labels for Cognito required attributes
const ATTR_LABELS = {
  name: 'Nombre',
  email: 'Email',
  given_name: 'Nombre',
  family_name: 'Apellidos',
  preferred_username: 'Nombre de usuario',
}

export default function LoginScreen() {
  const { status, error, busy, signIn, completeNewPassword, requiredAttributes } = useAuth()
  const isNewPassword = status === 'newPassword'

  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm]         = useState('')
  const [attrs, setAttrs]             = useState({})
  const [localError, setLocalError]   = useState(null)

  const submitLogin = (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    signIn(username.trim(), password)
  }

  const submitNewPassword = (e) => {
    e.preventDefault()
    setLocalError(null)
    if (newPassword.length < 8) { setLocalError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (newPassword !== confirm) { setLocalError('Las contraseñas no coinciden.'); return }
    for (const a of requiredAttributes) {
      if (!attrs[a]?.trim()) { setLocalError(`Falta el campo: ${ATTR_LABELS[a] ?? a}`); return }
    }
    completeNewPassword(newPassword, attrs)
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <h1 className="brand-name">Fotovigia</h1>
        </div>

        {isNewPassword ? (
          <form className="login-form" onSubmit={submitNewPassword}>
            <h2 className="login-title">Establece tu contraseña</h2>
            <p className="login-hint">Primer acceso: define una nueva contraseña para continuar.</p>

            <label className="form-label">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />

            <label className="form-label">Repetir contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
            />

            {requiredAttributes.map((a) => (
              <div key={a} style={{ display: 'contents' }}>
                <label className="form-label">{ATTR_LABELS[a] ?? a}</label>
                <input
                  type="text"
                  value={attrs[a] ?? ''}
                  onChange={e => setAttrs(prev => ({ ...prev, [a]: e.target.value }))}
                  autoComplete="off"
                />
              </div>
            ))}

            {(localError || error) && <div className="login-error">{localError || error}</div>}

            <button className="btn-primary login-submit" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar y entrar'}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitLogin}>
            <h2 className="login-title">Acceso</h2>

            <label className="form-label">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />

            <label className="form-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {error && <div className="login-error">{error}</div>}

            <button className="btn-primary login-submit" type="submit" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
