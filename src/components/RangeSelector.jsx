export default function RangeSelector({ value, onChange, ranges }) {
  return (
    <div className="range-buttons" role="group" aria-label="Ventana temporal">
      {ranges.map(({ label, ms }) => (
        <button
          key={ms}
          type="button"
          aria-pressed={value === ms}
          className={`range-btn ${value === ms ? 'active' : ''}`}
          onClick={() => onChange(ms)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
