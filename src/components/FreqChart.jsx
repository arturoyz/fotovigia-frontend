import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { makeTimeTickFormatter } from '../utils/normalize'
import { useTimeWindow } from '../hooks/useTimeWindow'
import { UnitChartTooltip } from './ChartTooltip'
import RangeSelector from './RangeSelector'
import { MW_RANGES, MAX_POINTS } from './chartConfig'

const COLOR = '#ff7b72'
const F2 = 49.8   // droop lower threshold
const F3 = 50.2   // droop upper threshold

export default function FreqChart({ data, loading }) {
  const [rangeMs, setRangeMs] = useState(MW_RANGES[0].ms)
  const win = useTimeWindow(data, rangeMs, MAX_POINTS)
  const tickFormatter = makeTimeTickFormatter(rangeMs)

  const header = (
    <div className="card-head">
      <div className="card-title">Frecuencia de red (Hz)</div>
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

  return (
    <div className="card">
      {header}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={win} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
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
            // keep the droop band in view, expand if frequency excursions exceed it
            domain={[(min) => Math.min(F2 - 0.05, min), (max) => Math.max(F3 + 0.05, max)]}
            tick={{ fill: '#7d8590', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <Tooltip content={<UnitChartTooltip unit="Hz" decimals={2} />} />
          <ReferenceLine y={50} stroke="#30363d" strokeWidth={1} />
          <ReferenceLine y={F3} stroke="#d29922" strokeDasharray="4 2" strokeWidth={1}
            label={{ value: '50.2', fill: '#d29922', fontSize: 10, position: 'right' }} />
          <ReferenceLine y={F2} stroke="#d29922" strokeDasharray="4 2" strokeWidth={1}
            label={{ value: '49.8', fill: '#d29922', fontSize: 10, position: 'right' }} />
          <Line
            type="monotone"
            dataKey="fmeas"
            name="Frecuencia"
            stroke={COLOR}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
