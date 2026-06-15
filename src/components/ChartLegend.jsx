export default function ChartLegend({ items }) {
  return (
    <div className="chart-legend">
      {items.map(({ key, label, color, dashed }) => (
        <div key={key || label} className="legend-item">
          <svg width="16" height="8">
            <line
              x1="0" y1="4" x2="16" y2="4"
              stroke={color}
              strokeWidth="2"
              strokeDasharray={dashed ? '4 2' : undefined}
            />
          </svg>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
