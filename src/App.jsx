import { useState, useCallback } from 'react'
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useWebSocket } from './hooks/useWebSocket'
import StatusHeader from './components/StatusHeader'
import SideMenu from './components/SideMenu'
import LoginScreen from './components/LoginScreen'
import MultiLineChart from './components/MultiLineChart'
import BatteryChart from './components/BatteryChart'
import SOCChart from './components/SOCChart'
import FreqChart from './components/FreqChart'
import HistoricoPanel from './components/HistoricoPanel'
import OperatorManagement from './components/OperatorManagement'

const CONSIGNA_SIGNALS = [
  { key: 'Ptso',      label: 'Consigna TSO',   color: '#bc8cff', dashed: true },
  { key: 'Ppcc_meas', label: 'Entrega a red',  color: '#58a6ff' },
]
const SOLAR_SIGNALS = [
  { key: 'sim_pv',   label: 'Solar disponible', color: '#f0b429', dashed: true },
  { key: 'Ppv_meas', label: 'Solar entregada',  color: '#f6e05e' },
]

// Real-time charts are fed ONLY by the WebSocket (no historic preload). The buffer
// is a plain FIFO: append on arrival, drop the oldest past the cap. Points come from
// a single source in chronological order, so we never sort or dedupe — that is what
// prevents the line from "jumping backwards" in time.
const MAX_LIVE_POINTS = 4000   // covers the widest chart window (SOC, 1 H at 1/s)

function Dashboard() {
  const { role, user, signOut } = useAuth()
  const [liveData, setLiveData] = useState([])
  const [latest,   setLatest]   = useState(null)
  const [view,     setView]     = useState('dashboard')   // dashboard | historical | users
  const [menuOpen, setMenuOpen] = useState(false)

  const handleData = useCallback((point) => {
    setLiveData(prev => {
      // Monotonic-append guard: only accept points strictly newer than the last one.
      // This does NOT reorder — it refuses any non-increasing/duplicate timestamp, so
      // the buffer is always strictly increasing in time and the line can never go
      // backwards (covers duplicate seconds and StrictMode's transient 2nd socket).
      const last = prev[prev.length - 1]
      if (last && point.timestamp <= last.timestamp) return prev
      const next = [...prev, point]
      return next.length > MAX_LIVE_POINTS ? next.slice(-MAX_LIVE_POINTS) : next
    })
    setLatest(point)
  }, [])

  const wsStatus = useWebSocket({ onData: handleData })

  // Guard: a non-admin can never land on the users view
  const activeView = view === 'users' && role !== 'admin' ? 'dashboard' : view

  const navigate = (v) => { setView(v); setMenuOpen(false) }

  return (
    <div className="app-shell">
      <StatusHeader
        latest={latest}
        wsStatus={wsStatus}
        user={user}
        role={role}
        onLogout={signOut}
        onMenuToggle={() => setMenuOpen(true)}
      />

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        current={activeView}
        onNavigate={navigate}
        role={role}
      />

      <main className="main-content">
        {activeView === 'dashboard' && (
          <>
            <h2 className="section-title">Tiempo real</h2>
            <div className="charts-grid">
              <MultiLineChart title="Consigna TSO vs Entrega a red" signals={CONSIGNA_SIGNALS} data={liveData} />
              <MultiLineChart title="Generación solar"              signals={SOLAR_SIGNALS}    data={liveData} />
              <BatteryChart data={liveData} />
              <SOCChart     data={liveData} />
              <FreqChart    data={liveData} />
            </div>
          </>
        )}

        {activeView === 'historical' && (
          <>
            <h2 className="section-title">Historical Data</h2>
            <HistoricoPanel />
          </>
        )}

        {activeView === 'users' && role === 'admin' && (
          <>
            <h2 className="section-title">User Management</h2>
            <OperatorManagement />
          </>
        )}
      </main>
    </div>
  )
}

function AuthGate() {
  const { status } = useAuth()
  if (status === 'loading') {
    return <div className="auth-loading">Cargando…</div>
  }
  if (status !== 'signedIn') {
    return <LoginScreen />
  }
  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}
