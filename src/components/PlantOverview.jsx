import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, getNiceTickValues,
} from 'recharts'
import { useTimeWindow } from '../hooks/useTimeWindow'
import { fmtHz, fmtMW, fmtSOC, makeTimeTickFormatter } from '../utils/normalize'
import { signed } from '../utils/plant'
import { FREQUENCY_LIMITS, MAX_SAMPLE_GAP_MS } from '../utils/plantWindow'
import ChartLegend from './ChartLegend'
import PowerBalance from './PowerBalance'
import PlantEventLog from './PlantEventLog'
import PanelStatus from './PanelStatus'
import { UnitChartTooltip } from './ChartTooltip'
import { MAX_POINTS, tooltipCursor } from './chartConfig'

const blue = '#79b8f7'
const muted = '#a5b2c2'
const grid = '#293341'
const tick = { fill: muted, fontSize: 11 }
const tooltipDecimals = { MW: 2, Hz: 3, '%': 1 }
const tracking = [
  { key: 'Ppcc_meas', label: 'Entrega PCC', color: blue },
  { key: 'Ptso', label: 'Consigna TSO', color: '#c6a4f5', dashed: true },
]
const solar = [
  { key: 'sim_pv', label: 'Disponible', color: muted, dashed: true },
  { key: 'Ppv_meas', label: 'Entregada', color: blue },
]
const battery = [{ key: 'Pbat_meas', label: 'Batería', color: blue }]
const soc = [{ key: point => point.SOC == null ? null : point.SOC * 100, label: 'SOC', color: blue }]
const frequency = [{ key: 'fmeas', label: 'Frecuencia', color: blue }]
const chartMargin = { top: 8, right: 26, bottom: 0 }
const markerColors = { Consigna: '#c6a4f5', Modo: muted, Telemetría: '#e4b774' }
const limits = {
  battery: [-1.1, 1.1],
  frequency: [49.75, 50.25],
  soc: [0, 100],
}

function valueAxis(data, series, unit, bounds) {
  let low = bounds?.[0] ?? Infinity
  let high = bounds?.[1] ?? -Infinity
  let hasValues = false
  for (const point of data) {
    for (const { key } of series) {
      const value = typeof key === 'function' ? key(point) : point[key]
      if (!Number.isFinite(value)) continue
      hasValues = true
      low = Math.min(low, value)
      high = Math.max(high, value)
    }
  }
  if (!hasValues) return { hasValues, domain: [0, 1], ticks: [] }
  if (high - low < 0.02) {
    const center = (low + high) / 2
    low = center - 0.01
    high = center + 0.01
  }
  const ticks = unit === 'Hz' && low === limits.frequency[0] && high === limits.frequency[1]
    ? [low, 50, high]
    : getNiceTickValues([low, high], 5)
  const decimals = Math.max(unit === 'Hz' ? 2 : unit === '%' ? 0 : 1, ...ticks.map(value =>
    value.toFixed(8).replace(/0+$/, '').split('.')[1]?.length ?? 0,
  ))
  return {
    hasValues, ticks, decimals, domain: [Math.min(low, ticks[0]), Math.max(high, ticks.at(-1))],
    format: value => value.toFixed(decimals),
  }
}

function Trend({ title, value, detail, className = '', series, unit, data, timeDomain, timeTicks, tickTime, bounds,
  references = [], markers = [], children }) {
  const axis = valueAxis(data, series, unit, bounds)
  return (
    <section className={`plant-panel plant-trend ${className}`} aria-label={title}>
      <div className="plant-panel-head"><h2>{title}</h2>{value && <span>{value}</span>}</div>
      {(series.length > 1 || detail) && (
        <div className="plant-trend-meta">
          {series.length > 1 && <ChartLegend items={series} />}
          {detail && <p className="plant-panel-detail">{detail}</p>}
        </div>
      )}
      <div className="plant-plot">
        {axis.hasValues || markers.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 150 }}>
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid stroke={grid} strokeDasharray="3 4" />
              <XAxis dataKey="timestamp" type="number" domain={timeDomain} allowDataOverflow
                ticks={timeTicks} interval="preserveStartEnd" height={25} tickMargin={7} tickFormatter={tickTime}
                tick={tick} tickLine={false} axisLine={{ stroke: grid }} minTickGap={12} />
              <YAxis domain={axis.domain} ticks={axis.ticks} niceTicks="none" tickFormatter={axis.format}
                tick={axis.hasValues ? tick : false} tickLine={false} axisLine={false} tickMargin={7} width={54} />
              {references.map(y => <ReferenceLine key={y} y={y} stroke={muted} strokeOpacity={0.65} strokeDasharray="4 4" />)}
              <Tooltip content={<UnitChartTooltip unit={unit}
                decimals={Math.max(tooltipDecimals[unit], axis.decimals ?? 0)} />}
                cursor={tooltipCursor} isAnimationActive={false} offset={12} />
              {series.map(({ key, label, color, dashed }) => (
                <Line key={label} dataKey={key} name={label} type="linear" stroke={color}
                  strokeWidth={2} strokeDasharray={dashed ? '5 4' : undefined}
                  dot={data.length === 1 ? { r: 2.5 } : false}
                  activeDot={{ r: 3.5, stroke: '#151b23', strokeWidth: 1.5 }} isAnimationActive={false} />
              ))}
              {markers.map(event => (
                <ReferenceLine key={`${event.timestamp}-${event.label}`} x={event.timestamp}
                  stroke={markerColors[event.type]} strokeOpacity={0.8} strokeDasharray="2 5" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <PanelStatus kind={data.length ? 'empty' : 'waiting'}>
          {data.length ? 'Sin lecturas en esta ventana' : 'Esperando telemetría'}
        </PanelStatus>}
      </div>
      {children}
    </section>
  )
}

export default function PlantOverview({ windowData, onToleranceChange }) {
  const { latest, timeDomain, samples: rawSamples, rangeMs, events, compliance, instant } = windowData
  const samples = useTimeWindow(rawSamples, rangeMs, MAX_POINTS)
  const timeTicks = count => timeDomain && Array.from({ length: count }, (_, index) =>
    Math.round(timeDomain[0] + rangeMs * index / (count - 1)),
  )
  const chart = { data: samples, timeDomain, timeTicks: timeTicks(3), tickTime: makeTimeTickFormatter(rangeMs) }
  const solarSeries = solar.map(signal => ({ ...signal, value: fmtMW(latest?.[signal.key]) }))
  const markers = events.filter(event => Object.hasOwn(markerColors, event.type))
  const { ratio } = instant
  const evaluatedSeconds = (compliance?.evaluatedMs ?? 0) / 1000
  const inBand = evaluatedSeconds ? compliance.inBandMs / compliance.evaluatedMs * 100 : null

  return (
    <>
      <div className="plant-main-row">
        <Trend {...chart} timeTicks={timeTicks(5)} className="plant-tracking" title="Seguimiento de consigna" value="MW" unit="MW" series={tracking} markers={markers}>
          {markers.length > 0 && <div className="plant-marker-legend" aria-label="Marcadores de eventos">
            {Object.entries(markerColors).map(([type, color]) => (
              <span key={type}><i style={{ borderColor: color }} aria-hidden="true" />{type}</span>
            ))}
          </div>}
          <footer className="plant-panel-foot">
            <span title="Relación calculada con la última muestra de PCC y TSO">PCC / TSO instantáneo <strong>{ratio == null ? '—' : `${ratio.toFixed(1)} %`}</strong></span>
            <span title={`Tiempo entre muestras válidas. Excluye desconexiones y huecos superiores a ${MAX_SAMPLE_GAP_MS / 1000} s.`}>
              {compliance == null ? 'Cumplimiento sin configurar' : inBand == null ? 'Sin tiempo evaluable' : (
                <><strong>{inBand.toFixed(1)} % en banda</strong> · {compliance.excursions} salidas · {evaluatedSeconds.toFixed(1)} de {(compliance.observedMs / 1000).toFixed(1)} s evaluados</>
              )}
            </span>
            <label className="plant-tolerance">Tolerancia ± MW
              <input type="number" min="0" step="any" placeholder="Sin definir"
                value={compliance?.toleranceMW ?? ''} onChange={event => {
                  const value = event.target.valueAsNumber
                  if (event.target.value === '') onToleranceChange(null)
                  else if (Number.isFinite(value) && value >= 0) onToleranceChange(value)
                }} />
            </label>
          </footer>
        </Trend>
        <PowerBalance latest={latest} />
      </div>
      <div className="plant-secondary-row">
        <Trend {...chart} title="Potencia de batería" value={latest?.Pbat_meas == null ? '—' : `${signed(latest.Pbat_meas)} MW`}
          unit="MW" detail="− Carga / + Descarga" series={battery} bounds={limits.battery} references={[0]} />
        <Trend {...chart} title="Generación solar" value="MW" unit="MW" series={solarSeries} />
        <Trend {...chart} title="Estado de carga" value={latest?.SOC == null ? '—' : `${fmtSOC(latest.SOC)} %`}
          detail="Capacidad relativa" unit="%" series={soc} bounds={limits.soc} references={[40, 60]} />
        <Trend {...chart} title="Frecuencia de red" value={latest?.fmeas == null ? '—' : `${fmtHz(latest.fmeas)} Hz`}
          detail="Ref. 50 Hz · Umbrales 49,8 / 50,2 Hz" unit="Hz" series={frequency}
          bounds={limits.frequency} references={[...FREQUENCY_LIMITS, 50]} />
      </div>
      <PlantEventLog events={events} hasTelemetry={latest != null} />
    </>
  )
}
