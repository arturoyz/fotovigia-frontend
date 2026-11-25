import { useState, useCallback, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import * as XLSX from 'xlsx'
import { HISTORICO_URL, formatDateTime, normalizeTimestamp } from '../utils/normalize'
import { getModo } from '../utils/modos'
import { ChartTooltip } from './ChartTooltip'
import { tooltipCursor } from './chartConfig'
import HistoricoStats from './HistoricoStats'
import PanelStatus from './PanelStatus'

// Plottable signals. Solar (Ppv_meas) and battery use (Pbat_meas) each show a single
// line; SOC is the battery percentage (×100 via dataKey SOC_pct).
const ALL_SIGNALS = [
  { key: 'Ppv_meas',  label: 'Solar entregada', color: '#a5b2c2', unit: 'MW' },
  { key: 'Ppcc_meas', label: 'Entrega PCC',     color: '#79b8f7', unit: 'MW' },
  { key: 'Ptso',      label: 'Consigna TSO',     color: '#c6a4f5', unit: 'MW', dashed: true },
  { key: 'Pbat_meas', label: 'Potencia BESS',    color: '#84c5b6', unit: 'MW' },
  { key: 'SOC',       label: 'Estado de carga', color: '#aabaf2', unit: '%',  dataKey: 'SOC_pct' },
  { key: 'fmeas',     label: 'Frecuencia',      color: '#b1cce1', unit: 'Hz' },
  { key: 'alpha',     label: 'Alfa',            color: '#cdb9aa', unit: 'α'  },
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

function describeSignal({ dataKey }) {
  const unit = byDataKey[dataKey]?.unit
  return { unit: unit === 'α' ? '' : unit, decimals: UNIT_META[unit]?.decimals ?? 2 }
}

function CustomTooltip(props) {
  return <ChartTooltip {...props} formatLabel={formatDateTime} describe={describeSignal} />
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
  const [desde,    setDesde]    = useState(() => toLocalDatetimeString(Date.now() - 3600000))
  const [hasta,    setHasta]    = useState(() => toLocalDatetimeString(Date.now()))
  const [data,     setData]     = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [queriedRange, setQueriedRange] = useState(null)
  const [selected, setSelected] = useState(DEFAULT_SELECTED)

  const toggleSignal = useCallback((key) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }, [])

  const consultar = useCallback(async () => {
    const desdeMs = new Date(desde).getTime()
    const hastaMs = new Date(hasta).getTime()
    if (!Number.isFinite(desdeMs) || !Number.isFinite(hastaMs) || desdeMs > hastaMs) {
      setError('Selecciona un periodo válido. La fecha de inicio debe preceder a la de fin.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const url = `${HISTORICO_URL}?desde=${desdeMs}&hasta=${hastaMs}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const rows = Array.isArray(json) ? json : (json.items ?? json.data ?? [])
      setData(processRows(rows))
      setQueriedRange({ desde, hasta })
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
    const desdeStr = queriedRange.desde.replace(/[T:]/g, '-').slice(0, 16)
    const hastaStr = queriedRange.hasta.replace(/[T:]/g, '-').slice(0, 16)
    XLSX.writeFile(wb, `planta-pv_${desdeStr}_${hastaStr}.xlsx`)
  }, [data, queriedRange])

  const selectedSignals = ALL_SIGNALS.filter(s => selected.includes(s.key))
  // Distinct units among the selected signals → one Y axis each (MW on the left)
  const unitsPresent = useMemo(
    () => UNIT_ORDER.filter(u => selectedSignals.some(s => s.unit === u)),
    [selectedSignals]
  )

  return (
    <>
      <section className="plant-panel" aria-labelledby="historico-periodo">
        <div className="plant-panel-head"><h2 id="historico-periodo">Periodo de consulta</h2></div>
        <form className="historico-controls workspace-toolbar" onSubmit={event => { event.preventDefault(); consultar() }}>
          <label className="form-group workspace-field">
            <span>Desde</span>
            <input type="datetime-local" value={desde} onChange={e => setDesde(e.target.value)} />
          </label>
          <label className="form-group workspace-field">
            <span>Hasta</span>
            <input type="datetime-local" value={hasta} onChange={e => setHasta(e.target.value)} />
          </label>
          <button type="submit" className="workspace-primary" disabled={loading}>
            {loading ? 'Consultando…' : 'Consultar'}
          </button>
          <button type="button" className="workspace-export" onClick={descargarExcel} disabled={!data.length || loading}>
            Descargar Excel
          </button>
        </form>

        {error && (
          <PanelStatus kind="error" inline>{error}</PanelStatus>
        )}
      </section>

      {data.length === 0 && (
        <section className="plant-panel history-series" aria-labelledby="historico-series">
          <div className="plant-panel-head"><h2 id="historico-series">Series temporales</h2></div>
          <div className="history-plot">
            <PanelStatus kind={loading ? 'loading' : queriedRange ? 'empty' : 'waiting'} announce>
              {loading ? 'Consultando telemetría…'
                : queriedRange ? 'Sin datos en el periodo consultado' : 'Selecciona un periodo para consultar la telemetría'}
            </PanelStatus>
          </div>
        </section>
      )}

      {data.length > 0 && (
        <>
          <HistoricoStats data={data} />
          <section className="plant-panel history-series" aria-labelledby="historico-series" aria-busy={loading}>
            <div className="plant-panel-head">
              <h2 id="historico-series">Series temporales</h2>
              {loading ? <PanelStatus kind="loading" inline announce>Consultando telemetría…</PanelStatus> : <span>
                {data.length} registro{data.length !== 1 ? 's' : ''} ·{' '}
                {formatDateTime(data[0].timestamp)} → {formatDateTime(data[data.length-1].timestamp)}
              </span>}
            </div>

            {/* Signal picker — each chip toggles a series on/off */}
            <div className="signal-chips" role="group" aria-label="Señales visibles">
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
              <div className="history-plot"><PanelStatus announce>Selecciona al menos una señal para visualizar</PanelStatus></div>
            ) : (
              <div className="history-plot"><ResponsiveContainer width="100%" height="100%">
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
                  <Tooltip content={<CustomTooltip />} cursor={tooltipCursor} isAnimationActive={false} offset={12} />
                  {unitsPresent.includes('MW') && (
                    <ReferenceLine y={0} yAxisId="MW" stroke="#30363d" strokeWidth={1} />
                  )}
                  {selectedSignals.map((s) => (
                    <Line
                      key={s.key}
                      yAxisId={s.unit}
                      type="linear"
                      dataKey={dataKeyOf(s)}
                      name={s.label}
                      stroke={s.color}
                      strokeDasharray={s.dashed ? '5 4' : undefined}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer></div>
            )}
          </section>
        </>
      )}
    </>
  )
}
