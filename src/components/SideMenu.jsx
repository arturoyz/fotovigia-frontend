const ITEMS = [
  { key: 'dashboard',  label: 'Dashboard' },
  { key: 'historical', label: 'Historical Data' },
  { key: 'users',      label: 'User Management', adminOnly: true },
]

export default function SideMenu({ open, onClose, current, onNavigate, role }) {
  const items = ITEMS.filter(it => !it.adminOnly || role === 'admin')

  return (
    <>
      <div
        className={`menu-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <nav className={`side-menu ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="side-menu-head">
          <span className="side-menu-title">Menú</span>
          <button className="side-menu-close" onClick={onClose} aria-label="Cerrar menú">✕</button>
        </div>
        <ul className="side-menu-list">
          {items.map(it => (
            <li key={it.key}>
              <button
                className={`side-menu-item ${current === it.key ? 'active' : ''}`}
                onClick={() => onNavigate(it.key)}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
