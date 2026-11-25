import { useState, useCallback, useMemo } from 'react'
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useWebSocket } from './hooks/useWebSocket'
import StatusHeader from './components/StatusHeader'
import LoginScreen from './components/LoginScreen'
import PlantOverview from './components/PlantOverview'
import { MW_RANGES } from './components/chartConfig'
import HistoricoPanel from './components/HistoricoPanel'
import OperatorManagement from './components/OperatorManagement'
import { buildPlantWindow } from './utils/plantWindow'

// Real-time charts are fed ONLY by the WebSocket (no historic preload). The buffer
// is a plain FIFO: append on arrival, drop the oldest past the cap. Points come from
// a single source in chronological order, so we never sort or dedupe — that is what
// prevents the line from "jumping backwards" in time.
const MAX_LIVE_POINTS = 4000

function Dashboard() {
  const { role, user, signOut } = useAuth()
  const [liveData, setLiveData] = useState([])
  const [rangeMs, setRangeMs] = useState(MW_RANGES[1].ms)
  const [toleranceMW, setToleranceMW] = useState(null)
  const [connectionEvents, setConnectionEvents] = useState([])
  const [view,     setView]     = useState('dashboard')   // dashboard | historical | users

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
  }, [])

  const handleConnectionEvent = useCallback(event => {
    setConnectionEvents(previous => [...previous.slice(-399), event])
  }, [])
  const wsStatus = useWebSocket({ onData: handleData, onConnectionEvent: handleConnectionEvent })
  const windowData = useMemo(
    () => buildPlantWindow(liveData, connectionEvents, rangeMs, toleranceMW),
    [liveData, connectionEvents, rangeMs, toleranceMW],
  )

  // Guard: a non-admin can never land on the users view
  const activeView = view === 'users' && role !== 'admin' ? 'dashboard' : view
  const latest = windowData.latest
  const liveView = activeView === 'dashboard'

  return (
    <div className="app-shell">
      <StatusHeader
        latest={latest}
        wsStatus={wsStatus}
        rangeMs={liveView ? rangeMs : undefined}
        onRangeChange={setRangeMs}
        windowData={liveView ? windowData : undefined}
        user={user}
        role={role}
        onLogout={signOut}
        currentView={activeView}
        onNavigate={setView}
      />

      <main className={`main-content ${liveView ? 'plant-main' : 'plant-workspace'}`}>
        {liveView && <PlantOverview windowData={windowData} onToleranceChange={setToleranceMW} />}

        {activeView === 'historical' && (
          <>
            <h2 className="section-title">Histórico</h2>
            <HistoricoPanel />
          </>
        )}

        {activeView === 'users' && role === 'admin' && (
          <>
            <h2 className="section-title">Usuarios</h2>
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
