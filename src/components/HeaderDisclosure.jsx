function close(details) {
  details.querySelector('summary').focus()
  details.open = false
}

export default function HeaderDisclosure({ label, className = '', disabled = false, children }) {
  if (disabled) {
    return <button type="button" className="plant-disclosure-trigger" disabled>{label}</button>
  }

  return (
    <details className={`plant-disclosure ${className}`} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
    }} onKeyDown={event => {
      if (event.key === 'Escape' && event.currentTarget.open) {
        event.preventDefault()
        close(event.currentTarget)
      }
    }}>
      <summary className="plant-disclosure-trigger">
        {label}<span className="plant-chevron" aria-hidden="true" />
      </summary>
      <div className="plant-disclosure-panel" onClick={event => {
        if (event.target.closest('button')) close(event.currentTarget.parentElement)
      }}>{children}</div>
    </details>
  )
}
