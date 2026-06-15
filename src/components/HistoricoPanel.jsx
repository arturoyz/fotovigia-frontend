import { useState, useCallback, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import * as XLSX from 'xlsx'
import { HISTORICO_URL, formatDateTime, normalizeTimestamp } from '../utils/normalize'
import { getModo } from '../utils/modos'
import HistoricoStats from './HistoricoStats'

// All plottable signals. SOC is shown as % (scaled ×100 via dataKey SOC_pct).
const ALL_SIGNALS = [
  { key: 'sim_pv',    label: 'Solar disponible', color: '#f0b429', unit: 'MW' },
  { key: 'Ppv_meas',  label: 'Solar entregada',  color: '#f6e05e', unit: 'MW' },
  { key: 'Ppcc_meas', label: 'Entrega a red',    color: '#58a6ff', unit: 'MW' },
  { key: 'Ptso',      label: 'Consigna TSO',     color: '#bc8cff', unit: 'MW' },
  { key: 'Pbat_meas', label: 'Batería',          color: '#3fb950', unit: 'MW' },
  { key: 'Pbat_star', label: 'Consigna batería', color: '#56d364', unit: 'MW' },
  { key: 'SOC',       label: 'SOC',              color: '#79c0ff', unit: '%',  dataKey: 'SOC_pct' },
  { key: 'fmeas',     label: 'Frecuencia',       color: '#ff7b72', unit: 'Hz' },
  { key: 'alpha',     label: 'Alpha',            color: '#d2a8ff', unit: 'α'  },
]

const UNIT_META = {
  'MW': { decimals: 3, domain: ['auto', 'auto'] },
  '%':  { decimals: 1, domain: [0, 100] },
  'Hz': { decimals: 2, domain: ['auto', 'auto'] },
  'α':  { decimals: 2, domain: [0, 1] },
}
const UNIT_ORDER = ['MW', '%', 'Hz', 'α']  // MW gets the left axis, the rest go right

const dataKeyOf = (s) => s.dataKey ?? s.key
const byDataKey = Object.fromEntries(ALL_SIGNALS.map(s => [dataKeyOf(s), s]))
const DEFAULT_SELECTED = ['Ptso', 'Ppcc_meas', 'Ppv_meas', 'Pbat_meas']

function toLocalDatetimeString(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  // The whole record is on payload[0].payload, so we can read `modo` even though
  // it isn't a plotted series.
  const modo = getModo(payload[0]?.payload?.modo)
  return (
    <div className="ct">
      <div className="ct-time">{formatDateTime(label)}</div>
      <div className="ct-modo">
        <span className="ct-modo-dot" style={{ backgroundColor: modo.color }} />
        <span style={{ color: modo.color }}>{modo.label}</span>
      </div>
      {payload.map((p) => {
        const sig  = byDataKey[p.dataKey]
        const unit = sig?.unit ?? ''
        const dec  = UNIT_META[unit]?.decimals ?? 2
        return (
          <div key={p.name} className="ct-row">
            <span className="ct-name" style={{ color: p.color }}>{p.name}</span>
            <span className="ct-val">{Number(p.value).toFixed(dec)} {unit === 'α' ? '' : unit}</span>
          </div>
        )
      })}
    </div>
  )
}

function processRows(rows) {
  return rows
    .map(r => ({
      ...r,
      timestamp: normalizeTimestamp(r.timestamp),
      SOC_pct: r.SOC != null ? r.SOC * 100 : null,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
}

export default function HistoricoPanel() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  const [desde,    setDesde]    = useState(toLocalDatetimeString(oneHourAgo))
  const [hasta,    setHasta]    = useState(toLocalDatetimeString(Date.now()))
  const [data,     setData]     = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [queried,  setQueried]  = useState(false)
  const [selected, setSelected] = useState(DEFAULT_SELECTED)

  const toggleSignal = useCallback((key) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }, [])

  const consultar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const desdeMs = new Date(desde).getTime()
      const hastaMs = new Date(hasta).getTime()
      const url = `${HISTORICO_URL}?desde=${desdeMs}&hasta=${hastaMs}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const rows = Array.isArray(json) ? json : (json.items ?? json.data ?? [])
      setData(processRows(rows))
      setQueried(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  const descargarExcel = useCallback(() => {
    if (!data.length) return
    const rows = data.map(r => ({
      'Timestamp':       formatDateTime(r.timestamp),
      'sim_pv (MW)':     r.sim_pv,
      'Ppv_meas (MW)':   r.Ppv_meas,
      'Pbat_meas (MW)':  r.Pbat_meas,
      'Pbat_star (MW)':  r.Pbat_star,
      'Ppcc_meas (MW)':  r.Ppcc_meas,
      'Ptso (MW)':       r.Ptso,
      'SOC (%)':         r.SOC != null ? (r.SOC * 100).toFixed(2) : null,
      'fmeas (Hz)':      r.fmeas,
      'alpha':           r.alpha,
      'modo':            getModo(r.modo).label,
    }))
    const ws  = XLSX.utils.json_to_sheet(rows)
    const wb  = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico')
    const desdeStr = desde.replace(/[T:]/g, '-').slice(0, 16)
    const hastaStr = hasta.replace(/[T:]/g, '-').slice(0, 16)
    XLSX.writeFile(wb, `planta-pv_${desdeStr}_${hastaStr}.xlsx`)
  }, [data, desde, hasta])

  const selectedSignals = ALL_SIGNALS.filter(s => selected.includes(s.key))
  // Distinct units among the selected signals → one Y axis each (MW on the left)
  const unitsPresent = useMemo(
    () => UNIT_ORDER.filter(u => selectedSignals.some(s => s.unit === u)),
    [selectedSignals]
  )

  return (
    <>
    <div className="card">
      <div className="card-title">Histórico</div>

      <div className="historico-controls">
        <div className="form-group">
          <label className="form-label">Desde</label>
          <input type="datetime-local" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Hasta</label>
          <input type="datetime-local" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={consultar} disabled={loading}>
          {loading ? 'Consultando…' : 'Consultar'}
        </button>
        <button onClick={descargarExcel} disabled={!data.length || loading}>
          ↓ Descargar Excel
        </button>
      </div>

      {error && (
        <div style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>
          Error: {error}
        </div>
      )}

      {queried && !data.length && !loading && (
        <div className="empty-state">Sin datos en el rango seleccionado</div>
      )}

      {!queried && !loading && (
        <div className="empty-state">Selecciona un rango y pulsa Consultar</div>
      )}

      {data.length > 0 && (
        <>
          <div style={{ marginBottom: 8, fontSize: 12, color: '#7d8590' }}>
            {data.length} registro{data.length !== 1 ? 's' : ''} ·{' '}
            {formatDateTime(data[0].timestamp)} → {formatDateTime(data[data.length-1].timestamp)}
          </div>

          {/* Signal picker — each chip toggles a series on/off */}
          <div className="signal-chips">
            {ALL_SIGNALS.map(({ key, label, color }) => {
              const active = selected.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={`signal-chip ${active ? 'active' : ''}`}
                  onClick={() => toggleSignal(key)}
                  aria-pressed={active}
                >
                  <span className="dot" style={{ backgroundColor: color }} />
                  {label}
                </button>
              )
            })}
          </div>

          {selectedSignals.length === 0 ? (
            <div className="empty-state">Selecciona al menos una señal para visualizar</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(ms) => formatDateTime(ms).split(', ')[1] ?? ''}
                  tick={{ fill: '#7d8590', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#30363d' }}
                  minTickGap={80}
                />
                {unitsPresent.map((unit, i) => (
                  <YAxis
                    key={unit}
                    yAxisId={unit}
                    orientation={i === 0 ? 'left' : 'right'}
                    domain={UNIT_META[unit].domain}
                    tick={{ fill: '#7d8590', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={(v) => unit === '%' ? `${v}%` : v.toFixed(1)}
                    label={{ value: unit, angle: 0, position: i === 0 ? 'insideTopLeft' : 'insideTopRight', fill: '#7d8590', fontSize: 10 }}
                  />
                ))}
                <Tooltip content={<CustomTooltip />} />
                {unitsPresent.includes('MW') && (
                  <ReferenceLine y={0} yAxisId="MW" stroke="#30363d" strokeWidth={1} />
                )}
                {selectedSignals.map((s) => (
                  <Line
                    key={s.key}
                    yAxisId={s.unit}
                    type="monotone"
                    dataKey={dataKeyOf(s)}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>

    {queried && <HistoricoStats data={data} />}
    </>
  )
}
