import { getModo } from '../utils/modos'
import { fmtSOC, fmtHz, formatTime } from '../utils/normalize'

function SocBar({ value }) {
  const pct = Math.min(100, Math.max(0, (value ?? 0) * 100))
  const color = pct > 60 ? '#3fb950' : pct > 30 ? '#d29922' : '#f85149'
  return (
    <div className="soc-bar">
      <div className="soc-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default function StatusHeader({ latest, wsStatus, user, role, onLogout, onMenuToggle }) {
  const modo = getModo(latest?.modo)
  const now  = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <header className="status-header">
      <button className="hamburger" onClick={onMenuToggle} aria-label="Abrir menú">
        <span /><span /><span />
      </button>

      <div className="divider-v" />

      <span className={`mode-badge ${modo.cls}`}>
        <span className="dot" />
        {modo.label}
      </span>

      <div className="divider-v" />

      <div className="kpis-row">
        <div className="kpi">
          <span className="kpi-label">SOC</span>
          <span className="kpi-value">
            {fmtSOC(latest?.SOC)}<span className="kpi-unit">%</span>
          </span>
          <SocBar value={latest?.SOC} />
        </div>

        <div className="kpi">
          <span className="kpi-label">Frecuencia</span>
          <span className="kpi-value">
            {fmtHz(latest?.fmeas)}<span className="kpi-unit">Hz</span>
          </span>
        </div>

        <div className="kpi">
          <span className="kpi-label">Ppcc</span>
          <span className="kpi-value">
            {latest?.Ppcc_meas != null ? Number(latest.Ppcc_meas).toFixed(2) : '—'}
            <span className="kpi-unit">MW</span>
          </span>
        </div>

        <div className="kpi">
          <span className="kpi-label">Ptso</span>
          <span className="kpi-value">
            {latest?.Ptso != null ? Number(latest.Ptso).toFixed(2) : '—'}
            <span className="kpi-unit">MW</span>
          </span>
        </div>
      </div>

      <div className="header-right">
        <div className="kpi" style={{ alignItems: 'flex-end' }}>
          <span className="kpi-label">Hora</span>
          <span className="kpi-value" style={{ fontSize: 15 }}>{now}</span>
        </div>
        <div className="ws-status">
          <span className={`ws-dot ${wsStatus}`} />
          {wsStatus === 'connected' ? 'En vivo' : wsStatus === 'connecting' ? 'Conectando…' : 'Sin señal'}
        </div>

        {user && (
          <div className="user-box">
            <div className="user-meta">
              <span className="user-name">{user.username}</span>
              {role && <span className={`role-badge role-${role}`}>{role}</span>}
            </div>
            <button className="btn-logout" onClick={onLogout}>Salir</button>
          </div>
        )}
      </div>
    </header>
  )
}
