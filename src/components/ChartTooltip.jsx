import { formatTime } from '../utils/normalize'

// Builds a Recharts tooltip renderer that prints each series value with a unit.
export function makeTooltip(unit, decimals = 3) {
  return function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div className="ct">
        <div className="ct-time">{formatTime(label)}</div>
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
