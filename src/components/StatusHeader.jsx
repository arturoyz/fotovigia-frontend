import { useEffect, useState } from 'react'
import { getModo } from '../utils/modos'
import { fmtMW, fmtSOC, fmtHz, formatTime } from '../utils/normalize'
import { batteryState, setpointMetrics, signed } from '../utils/plant'
import RangeSelector from './RangeSelector'
import { MW_RANGES } from './chartConfig'
import { downloadPlantWindow } from '../utils/plantExport'
import HeaderDisclosure from './HeaderDisclosure'
import PlantNavigation from './PlantNavigation'
import PanelStatus from './PanelStatus'
import { MAX_SAMPLE_GAP_MS } from '../utils/plantWindow'

const exportFormats = [
  ['csv', 'CSV · Serie'],
  ['json', 'JSON · Datos y eventos'],
  ['html', 'Informe imprimible'],
]

function Metric({ label, value, unit, signal, children }) {
  return (
    <div className={`plant-metric${signal ? ` plant-metric-${signal}` : ''}`}>
      <dt>{label}</dt>
      <dd className="plant-kpi-reading">
        <span>{value}</span>{value !== '—' && <small> {unit}</small>}
      </dd>
      {children && <dd className="plant-metric-detail">{children}</dd>}
    </div>
  )
}

function ConnectionStatus({ status, timestamp }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const ageMs = timestamp ? Math.max(0, now - timestamp) : null
  const age = Math.floor(ageMs / 1000)
  const elapsed = age < 60 ? `${age} s` : `${Math.floor(age / 60)} min`
  const connection = {
    connected: 'Conectado',
    connecting: 'Conectando…',
    disconnected: 'Sin conexión',
  }[status]
  const stale = ageMs != null && ageMs > MAX_SAMPLE_GAP_MS

  return (
    <>
      <span className="plant-connection"><span className={`ws-dot ${status}`} />{connection}</span>
      {timestamp ? (
        <span className="plant-sample">
          {stale && <PanelStatus kind="stale" inline announce>Datos desactualizados</PanelStatus>}
          <span>Última muestra {formatTime(timestamp)} · hace {elapsed}</span>
        </span>
      ) : <PanelStatus kind="waiting" inline announce>Esperando telemetría</PanelStatus>}
    </>
  )
}

export default function StatusHeader({
  latest, wsStatus, rangeMs, onRangeChange, windowData, user, role, onLogout, currentView, onNavigate,
}) {
  const { difference, relative } = setpointMetrics(latest)
  return (
    <header className="plant-header">
      <div className="plant-nav-row">
        <h1><img className="brand-symbol" src={`${import.meta.env.BASE_URL}favicon.svg`} width="22" height="22" alt="" />Fotovigia</h1>
        <PlantNavigation current={currentView} onNavigate={onNavigate} role={role} />
        {user && (
          <HeaderDisclosure className="plant-account" label="Cuenta">
            <div className="plant-account-info">
              <strong>{user.username}</strong>
              {role && <span>{role === 'admin' ? 'Administrador' : 'Operador'}</span>}
            </div>
            <button type="button" onClick={onLogout}>Cerrar sesión</button>
          </HeaderDisclosure>
        )}
      </div>
      <div className="plant-toolbar">
        <div className="plant-meta">
          <strong>{latest?.modo == null ? 'Modo sin lectura' : getModo(latest.modo).label}</strong>
          <ConnectionStatus status={wsStatus} timestamp={latest?.timestamp} />
        </div>
        {rangeMs != null && (
          <div className="plant-range">
            <RangeSelector value={rangeMs} onChange={onRangeChange} ranges={MW_RANGES} />
            <HeaderDisclosure label="Exportar" disabled={!windowData?.observedEnd}>
              {exportFormats.map(([format, label]) => (
                <button type="button" key={format} onClick={() => downloadPlantWindow(windowData, format)}>{label}</button>
              ))}
            </HeaderDisclosure>
          </div>
        )}
      </div>
      <div className="plant-kpis">
        <dl className="plant-kpi-group plant-kpi-priority" aria-label="Seguimiento de consigna">
          <Metric label="Entrega PCC" value={fmtMW(latest?.Ppcc_meas)} unit="MW" signal="pcc">Potencia activa</Metric>
          <Metric label="Consigna TSO" value={fmtMW(latest?.Ptso)} unit="MW" signal="tso" />
          <Metric label="Desviación" value={signed(difference)} unit="MW">
            {relative == null ? 'PCC − TSO' : `${signed(relative, 1)} % respecto al TSO`}
          </Metric>
        </dl>
        <dl className="plant-kpi-group plant-kpi-context" aria-label="Estado de planta">
          <Metric label="Frecuencia" value={fmtHz(latest?.fmeas)} unit="Hz">Referencia 50 Hz</Metric>
          <Metric label="Batería" value={signed(latest?.Pbat_meas)} unit="MW">{batteryState(latest?.Pbat_meas)}</Metric>
          <Metric label="SOC" value={fmtSOC(latest?.SOC)} unit="%">
            {latest?.SOC != null && <meter min="0" max="1" value={latest.SOC} aria-label="Estado de carga" />}
          </Metric>
        </dl>
      </div>
    </header>
  )
}
