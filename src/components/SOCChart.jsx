import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { formatTime, makeTimeTickFormatter } from '../utils/normalize'
import { getModo } from '../utils/modos'
import { useTimeWindow } from '../hooks/useTimeWindow'
import RangeSelector from './RangeSelector'
import { SOC_RANGES, MAX_POINTS } from './chartConfig'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const soc = payload[0]?.value ?? 0   // dataKey SOC_pct is already a percentage
  const modo = getModo(payload[0]?.payload?.modo)
  return (
    <div className="ct">
      <div className="ct-time">{formatTime(label)}</div>
      <div className="ct-modo">
        <span className="ct-modo-dot" style={{ backgroundColor: modo.color }} />
        <span style={{ color: modo.color }}>{modo.label}</span>
      </div>
      <div className="ct-row">
        <span className="ct-name" style={{ color: '#58a6ff' }}>SOC</span>
        <span className="ct-val">{soc.toFixed(1)} %</span>
      </div>
    </div>
  )
}

function socColor(pct) {
  if (pct > 60) return '#3fb950'
  if (pct > 30) return '#d29922'
  return '#f85149'
}

// Instantaneous charge/discharge state from the freshest Pbat_meas.
function chargeBadge(lastPbat) {
  if (lastPbat == null) return { text: '—', cls: 'badge-idle' }
  if (lastPbat < -0.02) return { text: 'Cargando ▲', cls: 'badge-charge' }
  if (lastPbat > 0.02)  return { text: 'Descargando ▼', cls: 'badge-discharge' }
  return { text: 'En reposo', cls: 'badge-idle' }
}

export default function SOCChart({ data, loading }) {
  const [rangeMs, setRangeMs] = useState(SOC_RANGES[0].ms)
  const sliced = useTimeWindow(data, rangeMs, MAX_POINTS)
  const win = useMemo(() => sliced.map(d => ({ ...d, SOC_pct: (d.SOC ?? 0) * 100 })), [sliced])
  const tickFormatter = makeTimeTickFormatter(rangeMs)

  const lastSOC  = win.length ? win[win.length - 1].SOC_pct : null
  const lastPbat = data.length ? (data[data.length - 1].Pbat_meas ?? null) : null
  const color    = lastSOC != null ? socColor(lastSOC) : '#58a6ff'
  const badge    = chargeBadge(lastPbat)

  const header = (
    <div className="card-head">
      <div className="card-title">Estado de carga de la batería (SOC)</div>
      <div className="card-head-right">
        <span className={`soc-badge ${badge.cls}`}>{badge.text}</span>
        <RangeSelector value={rangeMs} onChange={setRangeMs} ranges={SOC_RANGES} />
      </div>
    </div>
  )

  if (!win.length) {
    return (
      <div className="card">
        {header}
        <div className="empty-state">{loading ? 'Cargando…' : 'Sin datos'}</div>
      </div>
    )
  }

  return (
    <div className="card">
      {header}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={win} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="socGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tickFormatter}
            tick={{ fill: '#7d8590', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#30363d' }}
            minTickGap={60}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tick={{ fill: '#7d8590', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={40} stroke="#7d8590" strokeDasharray="4 2" strokeWidth={1} label={{ value: '40%', fill: '#7d8590', fontSize: 10, position: 'left' }} />
          <ReferenceLine y={60} stroke="#7d8590" strokeDasharray="4 2" strokeWidth={1} label={{ value: '60%', fill: '#7d8590', fontSize: 10, position: 'left' }} />
          <Area
            type="monotone"
            dataKey="SOC_pct"
            name="SOC"
            stroke={color}
            strokeWidth={2}
            fill="url(#socGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
