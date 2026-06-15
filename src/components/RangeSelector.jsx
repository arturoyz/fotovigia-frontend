export default function RangeSelector({ value, onChange, ranges }) {
  return (
    <div className="range-buttons">
      {ranges.map(({ label, ms }) => (
        <button
          key={ms}
          className={`range-btn ${value === ms ? 'active' : ''}`}
          onClick={() => onChange(ms)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
