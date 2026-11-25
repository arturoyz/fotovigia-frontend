import { formatTime } from '../utils/normalize'
import { getModo } from '../utils/modos'

export function ChartTooltip({ active, payload, label, formatLabel = formatTime, describe }) {
  if (!active || !payload?.length) return null
  const modo = getModo(payload[0]?.payload?.modo)
  return (
    <div className="ct">
      <div className="ct-header">
        <span className="ct-time">{formatLabel(label)}</span>
        {modo.cls !== 'unknown' && <span className="ct-mode">{modo.label}</span>}
      </div>
      {payload.map(entry => {
        const { unit, decimals } = describe(entry)
        return (
          <div key={entry.name} className="ct-row">
            <span className="ct-name">
              <span className="ct-series" style={{ backgroundColor: entry.color || entry.stroke }} aria-hidden="true" />
              {entry.name}
            </span>
            <span className="ct-val">{Number(entry.value).toFixed(decimals)}{unit && <small> {unit}</small>}</span>
          </div>
        )
      })}
    </div>
  )
}

export function UnitChartTooltip({ unit, decimals = 3, ...props }) {
  return <ChartTooltip {...props} describe={() => ({ unit, decimals })} />
}
