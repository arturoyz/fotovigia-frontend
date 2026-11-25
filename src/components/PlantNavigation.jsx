import HeaderDisclosure from './HeaderDisclosure'

const items = [
  { key: 'dashboard', label: 'Tiempo real' },
  { key: 'historical', label: 'Histórico' },
  { key: 'users', label: 'Usuarios', adminOnly: true },
]

export default function PlantNavigation({ current, onNavigate, role }) {
  const visible = items.filter(item => !item.adminOnly || role === 'admin')
  const active = visible.find(item => item.key === current)

  const destinations = visible.map(({ key, label }) => (
    <button type="button" key={key} aria-current={current === key ? 'page' : undefined} onClick={() => onNavigate(key)}>
      {label}
    </button>
  ))

  return (
    <nav className="plant-navigation" aria-label="Navegación principal">
      <div className="plant-nav-links">{destinations}</div>
      <HeaderDisclosure className="plant-nav-compact" label={active?.label ?? 'Navegación'}>
        {destinations}
      </HeaderDisclosure>
    </nav>
  )
}
