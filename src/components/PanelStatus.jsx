export default function PanelStatus({ kind = 'empty', children, inline = false, announce = false }) {
  const role = kind === 'error' ? 'alert' : announce ? 'status' : undefined
  const Tag = inline ? 'span' : 'div'
  return (
    <Tag className={`panel-status panel-status-${kind}${inline ? ' panel-status-inline' : ''}`} role={role}>
      <span className="panel-status-mark" aria-hidden="true" />
      <span>{children}</span>
    </Tag>
  )
}
