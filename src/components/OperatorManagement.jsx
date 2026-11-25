import { useState, useEffect, useCallback, useMemo } from 'react'
import { OPERADORES_URL } from '../utils/normalize'
import PanelStatus from './PanelStatus'

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

function displayName(op) {
  return [op.nombre, op.apellido].filter(Boolean).join(' ').trim() || op.username
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
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="new-operator-title">
        <div className="modal-head">
          <h3 className="modal-title" id="new-operator-title">Nuevo operador</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <label className="form-label" htmlFor="operator-username">Usuario</label>
          <input id="operator-username" type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" autoFocus />

          <label className="form-label" htmlFor="operator-password">Contraseña temporal</label>
          <input
            id="operator-password"
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="off"
            placeholder="Mín. 8 · mayús · minús · número · símbolo"
          />

          {err && <PanelStatus kind="error" inline>{err}</PanelStatus>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="workspace-primary" disabled={busy}>
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

  const load = useCallback((signal) => fetch(OPERADORES_URL, { signal })
    .then(async res => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (!signal?.aborted) setOperadores(Array.isArray(data.operadores) ? data.operadores : [])
    })
    .catch(e => {
      if (!signal?.aborted) setError(e.message || 'No se pudo cargar la lista de operadores.')
    })
    .finally(() => {
      if (!signal?.aborted) setLoading(false)
    }), [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  function refresh() {
    setLoading(true)
    setError(null)
    load()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return operadores
    return operadores.filter(o =>
      [o.username, o.nombre, o.apellido, o.email]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    )
  }, [operadores, search])

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
      refresh()
    } catch (e) {
      setToast({ ok: false, msg: e.message || 'No se pudo eliminar el operador.' })
    }
  }

  const handleCreated = (username) => {
    setModalOpen(false)
    setToast({ ok: true, msg: `Operador ${username} creado, deberá cambiar la contraseña en su primer acceso.` })
    refresh()
  }

  return (
    <section className="plant-panel operator-panel" aria-labelledby="operators-heading">
      <div className="plant-panel-head"><h2 id="operators-heading">Operadores</h2></div>
      <div className="um-toolbar workspace-toolbar">
        <input
          className="um-search"
          type="search"
          aria-label="Buscar operadores"
          placeholder="Buscar por usuario, nombre o correo…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <button type="button" className="workspace-primary" onClick={() => setModalOpen(true)}>
          Nuevo operador
        </button>
      </div>

      {toast && (
        <div className={`operador-msg workspace-feedback ${toast.ok ? 'ok' : 'err'}`}>
          <span role={toast.ok ? 'status' : 'alert'}>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso">Cerrar</button>
        </div>
      )}

      {loading && operadores.length === 0 ? (
        <div className="operator-state"><PanelStatus kind="loading" announce>Cargando operadores…</PanelStatus></div>
      ) : error ? (
        <div className="operator-state"><PanelStatus kind="error">{error}</PanelStatus></div>
      ) : filtered.length === 0 ? (
        <div className="operator-state"><PanelStatus announce>
          {search ? 'Sin resultados para la búsqueda' : 'No hay operadores registrados'}
        </PanelStatus></div>
      ) : (
        <>
          <div className="operator-table-wrap" tabIndex={0} role="region" aria-label="Listado de operadores">
            <table className="operator-table">
              <thead><tr>
                <th scope="col">Operador</th><th scope="col">Estado</th>
                <th scope="col">Fecha de alta</th><th scope="col">Acciones</th>
              </tr></thead>
              <tbody>
                {pageItems.map((op) => {
                  const badge = statusBadge(op.estado)
                  return (
                    <tr key={op.username}>
                      <th scope="row"><span>{displayName(op)}</span>
                        <small>{[op.username, op.email].filter(value => value && value !== displayName(op)).join(' · ') || '—'}</small>
                      </th>
                      <td><span className={`op-badge ${badge.cls}`}>{badge.label}</span></td>
                      <td className="op-date">{fmtDate(op.fechaAlta)}</td>
                      <td><button type="button" className="op-delete" onClick={() => handleDelete(op)}
                        title="Eliminar operador" aria-label={`Eliminar a ${op.username}`}><TrashIcon /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="um-footer">
            {loading ? <PanelStatus kind="loading" inline announce>Actualizando operadores…</PanelStatus> : <span className="um-count">
              {filtered.length} operador{filtered.length !== 1 ? 'es' : ''}
            </span>}
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
    </section>
  )
}
