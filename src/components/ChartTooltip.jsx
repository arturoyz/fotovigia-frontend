import { formatTime } from '../utils/normalize'
import { getModo } from '../utils/modos'

// Builds a Recharts tooltip renderer that prints each series value with a unit,
// plus the controller mode at that instant (read from the full record).
export function makeTooltip(unit, decimals = 3) {
  return function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const modo = getModo(payload[0]?.payload?.modo)
    return (
      <div className="ct">
        <div className="ct-time">{formatTime(label)}</div>
        <div className="ct-modo">
          <span className="ct-modo-dot" style={{ backgroundColor: modo.color }} />
          <span style={{ color: modo.color }}>{modo.label}</span>
        </div>
        {payload.map((p) => (
          <div key={p.name} className="ct-row">
            <span className="ct-name" style={{ color: p.color || p.stroke }}>{p.name}</span>
            <span className="ct-val">{Number(p.value).toFixed(decimals)} {unit}</span>
          </div>
        ))}
      </div>
    )
  }
}
