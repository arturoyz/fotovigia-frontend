import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts'
import { makeTimeTickFormatter } from '../utils/normalize'
import { useTimeWindow } from '../hooks/useTimeWindow'
import { UnitChartTooltip } from './ChartTooltip'
import RangeSelector from './RangeSelector'
import { MW_RANGES, MAX_POINTS } from './chartConfig'

const DESCARGA  = '#d29922'   // positive: battery delivers
const CARGA     = '#3fb950'   // negative: battery absorbs

// Fraction of the area's height (top→bottom) where Pbat_meas crosses 0, so the
// fill is orange above zero and green below it.
function zeroOffset(win) {
  const vals = win.map(d => d.Pbat_meas ?? 0)
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  if (max <= 0) return 0
  if (min >= 0) return 1
  return max / (max - min)
}

export default function BatteryChart({ data, loading }) {
  const [rangeMs, setRangeMs] = useState(MW_RANGES[0].ms)
  const win = useTimeWindow(data, rangeMs, MAX_POINTS)
  const tickFormatter = makeTimeTickFormatter(rangeMs)

  const header = (
    <div className="card-head">
      <div className="card-title">Batería — potencia (+ descarga / − carga)</div>
      <RangeSelector value={rangeMs} onChange={setRangeMs} ranges={MW_RANGES} />
    </div>
  )

  if (!win.length) {
    return (
      <div className="card">
        {header}
        <div className="empty-state">{loading ? 'Cargando…' : 'Esperando datos…'}</div>
      </div>
    )
  }

  const off = zeroOffset(win)

  return (
    <div className="card">
      {header}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={win} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="batSplit" x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor={DESCARGA} stopOpacity={0.55} />
              <stop offset={off} stopColor={CARGA} stopOpacity={0.55} />
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
            domain={[-1.1, 1.1]}
            ticks={[-1, -0.5, 0, 0.5, 1]}
            tick={{ fill: '#7d8590', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(1)}
          />
          {/* labelled zones */}
          <ReferenceArea y1={0} y2={1.1} fillOpacity={0}
            label={{ value: 'Descarga (+)', position: 'insideTopRight', fill: DESCARGA, fontSize: 11 }} />
          <ReferenceArea y1={-1.1} y2={0} fillOpacity={0}
            label={{ value: 'Carga (−)', position: 'insideBottomRight', fill: CARGA, fontSize: 11 }} />
          <Tooltip content={<UnitChartTooltip unit="MW" />} />
          <ReferenceLine y={0} stroke="#7d8590" strokeWidth={1.5} />
          <Area
            type="monotone"
            dataKey="Pbat_meas"
            name="Batería"
            baseValue={0}
            stroke="#c9d1d9"
            strokeWidth={2}
            fill="url(#batSplit)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
