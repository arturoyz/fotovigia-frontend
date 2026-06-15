import { useState, useEffect, useCallback, useMemo } from 'react'
import { OPERADORES_URL } from '../utils/normalize'

const PAGE_SIZE = 8

// Cognito default password policy: min 8, upper, lower, number, symbol
function passwordIssue(pw) {
  if (pw.length < 8)             return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[A-Z]/.test(pw))        return 'Debe incluir al menos una mayúscula.'
  if (!/[a-z]/.test(pw))        return 'Debe incluir al menos una minúscula.'
  if (!/[0-9]/.test(pw))        return 'Debe incluir al menos un número.'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Debe incluir al menos un símbolo.'
  return null
}

function initials(op) {
  const n = (op.nombre || '').trim()
  const a = (op.apellido || '').trim()
  if (n || a) return ((n[0] || '') + (a[0] || '')).toUpperCase()
  return (op.username || '?').slice(0, 2).toUpperCase()
}

function displayName(op) {
  return [op.nombre, op.apellido].filter(Boolean).join(' ').trim() || op.username
}

// Deterministic colour from the username (same user → same colour)
function colorFor(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360} 42% 42%)`
}

function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusBadge(estado) {
  if (estado === 'FORCE_CHANGE_PASSWORD') return { label: 'Pendiente', cls: 'op-badge-pending' }
  if (estado === 'CONFIRMED')             return { label: 'Activo',    cls: 'op-badge-active' }
  return { label: estado || '—', cls: 'op-badge-idle' }
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function AddOperatorModal({ onClose, onCreated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    const u = username.trim()
    if (!u || !password) { setErr('Usuario y contraseña son obligatorios.'); return }
    const issue = passwordIssue(password)
    if (issue) { setErr(issue); return }

    setBusy(true)
    try {
      const res  = await fetch(OPERADORES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) onCreated(data.username ?? u)
      else setErr(data.error || `Error (HTTP ${res.status})`)
    } catch (e) {
      setErr(e.message || 'No se pudo contactar con el servidor.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 className="modal-title">Nuevo operador</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <label className="form-label">Usuario</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" autoFocus />

          <label className="form-label">Contraseña temporal</label>
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="off"
            placeholder="Mín. 8 · mayús · minús · número · símbolo"
          />

          {err && <div className="operador-msg err">{err}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Creando…' : 'Crear operador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OperatorManagement() {
  const [operadores, setOperadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast,   setToast]   = useState(null)   // { ok, msg }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(OPERADORES_URL)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setOperadores(Array.isArray(data.operadores) ? data.operadores : [])
    } catch (e) {
      setError(e.message || 'No se pudo cargar la lista de operadores.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return operadores
    return operadores.filter(o =>
      [o.username, o.nombre, o.apellido, o.email]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    )
  }, [operadores, search])

  useEffect(() => { setPage(1) }, [search])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleDelete = async (op) => {
    if (!window.confirm(`¿Eliminar al operador "${op.username}"? Esta acción no se puede deshacer.`)) return
    try {
      const res  = await fetch(OPERADORES_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: op.username }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setToast({ ok: true, msg: `Operador ${op.username} eliminado.` })
      load()
    } catch (e) {
      setToast({ ok: false, msg: e.message || 'No se pudo eliminar el operador.' })
    }
  }

  const handleCreated = (username) => {
    setModalOpen(false)
    setToast({ ok: true, msg: `Operador ${username} creado, deberá cambiar la contraseña en su primer acceso.` })
    load()
  }

  return (
    <div className="card">
      <div className="um-toolbar">
        <input
          className="um-search"
          type="text"
          placeholder="Buscar por usuario, nombre o email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn-primary um-add" onClick={() => setModalOpen(true)}>
          <span className="um-add-plus">+</span> Add new operator
        </button>
      </div>

      {toast && (
        <div className={`operador-msg ${toast.ok ? 'ok' : 'err'}`} onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="empty-state">Cargando operadores…</div>
      ) : error ? (
        <div className="operador-msg err">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">{search ? 'Sin resultados para la búsqueda' : 'No hay operadores todavía'}</div>
      ) : (
        <>
          <div className="op-list">
            {pageItems.map((op) => {
              const badge = statusBadge(op.estado)
              return (
                <div className="op-card" key={op.username}>
                  <div className="op-avatar" style={{ backgroundColor: colorFor(op.username) }}>
                    {initials(op)}
                  </div>
                  <div className="op-main">
                    <div className="op-name">{displayName(op)}</div>
                    <div className="op-email">{op.email || 'Pendiente de primer acceso'}</div>
                  </div>
                  <div className="op-date">{fmtDate(op.fechaAlta)}</div>
                  <span className={`op-badge ${badge.cls}`}>{badge.label}</span>
                  <button
                    className="op-delete"
                    onClick={() => handleDelete(op)}
                    title="Eliminar operador"
                    aria-label={`Eliminar a ${op.username}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="um-footer">
            <span className="um-count">
              {filtered.length} operador{filtered.length !== 1 ? 'es' : ''}
            </span>
            {totalPages > 1 && (
              <div className="um-pagination">
                <button disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>‹ Anterior</button>
                <span>Página {currentPage} de {totalPages}</span>
                <button disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente ›</button>
              </div>
            )}
          </div>
        </>
      )}

      {modalOpen && (
        <AddOperatorModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
