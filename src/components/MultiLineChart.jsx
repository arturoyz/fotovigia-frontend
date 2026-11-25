import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { makeTimeTickFormatter } from '../utils/normalize'
import { useTimeWindow } from '../hooks/useTimeWindow'
import { UnitChartTooltip } from './ChartTooltip'
import ChartLegend from './ChartLegend'
import RangeSelector from './RangeSelector'
import { MW_RANGES, MAX_POINTS } from './chartConfig'

// Generic time-series panel for 2+ MW signals sharing a Y axis (consigna, solar…).
export default function MultiLineChart({ title, signals, data, loading }) {
  const [rangeMs, setRangeMs] = useState(MW_RANGES[0].ms)
  const win = useTimeWindow(data, rangeMs, MAX_POINTS)
  const tickFormatter = makeTimeTickFormatter(rangeMs)

  const header = (
    <div className="card-head">
      <div className="card-title">{title}</div>
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
      <ChartLegend items={signals} />
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
            domain={['auto', 'auto']}
            tick={{ fill: '#7d8590', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <Tooltip content={<UnitChartTooltip unit="MW" />} />
          {signals.map(({ key, label, color, dashed }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              strokeWidth={dashed ? 1.5 : 2}
              strokeDasharray={dashed ? '5 3' : undefined}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
