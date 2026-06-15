import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

// thin out a series so the sparkline stays light
function sparkData(data, key) {
  const pts = data.map(d => d[key]).filter(v => typeof v === 'number' && !isNaN(v))
  if (pts.length <= 60) return pts.map(v => ({ v }))
  const stride = Math.ceil(pts.length / 60)
  return pts.filter((_, i) => i % stride === 0).map(v => ({ v }))
}

function Sparkline({ data, color }) {
  if (data.length < 2) return <div className="stat-spark-empty" />
  return (
    <ResponsiveContainer width="100%" height={34}>
      <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Circular progress gauge (indicator, not a data chart)
function Gauge({ pct, color }) {
  const r = 28, c = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, pct))
  const off = c * (1 - clamped / 100)
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="stat-gauge-svg">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface2)" strokeWidth="8" />
      <circle
        cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 40 40)"
      />
      <text x="40" y="45" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">
        {Math.round(clamped)}%
      </text>
    </svg>
  )
}

function complianceColor(pct) {
  if (pct >= 90) return '#3fb950'
  if (pct >= 75) return '#d29922'
  return '#f85149'
}

const ICONS = {
  bolt: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  target: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  battery: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="16" height="8" rx="2" /><line x1="22" y1="11" x2="22" y2="13" /><line x1="6" y1="12" x2="12" y2="12" />
    </svg>
  ),
  activity: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 12 7 12 10 4 14 20 17 12 21 12" />
    </svg>
  ),
}

export default function HistoricoStats({ data }) {
  const stats = useMemo(() => {
    const n = data.length

    // Energía entregada: integral de Ppcc_meas en el tiempo (trapecio), MW·h
    let energy = 0
    let energyValid = false
    for (let i = 0; i < n - 1; i++) {
      const p0 = data[i].Ppcc_meas, p1 = data[i + 1].Ppcc_meas
      const t0 = data[i].timestamp, t1 = data[i + 1].timestamp
      if (typeof p0 === 'number' && typeof p1 === 'number' && t1 > t0) {
        const dtH = (t1 - t0) / 3600000   // ms → horas (intervalo real entre muestras)
        energy += ((p0 + p1) / 2) * dtH
        energyValid = true
      }
    }

    // Cumplimiento: media( min(Ppcc/Ptso, 1) ) × 100 sobre muestras con Ptso > 0
    const ratios = data
      .filter(d => typeof d.Ptso === 'number' && d.Ptso > 0 && typeof d.Ppcc_meas === 'number')
      .map(d => Math.min(d.Ppcc_meas / d.Ptso, 1))
    const compliance = ratios.length ? (ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100 : null

    // SOC: medio, min y max (SOC_pct ya es ×100)
    const soc = data.map(d => d.SOC_pct).filter(v => typeof v === 'number' && !isNaN(v))
    const socAvg = soc.length ? soc.reduce((a, b) => a + b, 0) / soc.length : null
    const socMin = soc.length ? Math.min(...soc) : null
    const socMax = soc.length ? Math.max(...soc) : null

    // Media de entrega: promedio de Ppcc_meas
    const ppcc = data.map(d => d.Ppcc_meas).filter(v => typeof v === 'number' && !isNaN(v))
    const ppccAvg = ppcc.length ? ppcc.reduce((a, b) => a + b, 0) / ppcc.length : null

    return {
      energy: energyValid ? energy : null,
      compliance,
      socAvg, socMin, socMax,
      ppccAvg,
      sparkPpcc: sparkData(data, 'Ppcc_meas'),
    }
  }, [data])

  const fmt = (v, dec) => (v == null ? '—' : v.toFixed(dec))

  return (
    <div className="stats-grid">
      {/* Energía entregada */}
      <div className="stat-card">
        <div className="stat-head">
          <span className="stat-icon" style={{ color: '#f0b429' }}>{ICONS.bolt}</span>
          <span className="stat-label">Energía entregada</span>
        </div>
        <div className="stat-value">
          {fmt(stats.energy, 2)}{stats.energy != null && <span className="stat-unit">MWh</span>}
        </div>
      </div>

      {/* Cumplimiento de consigna */}
      <div className="stat-card">
        <div className="stat-head">
          <span className="stat-icon" style={{ color: '#58a6ff' }}>{ICONS.target}</span>
          <span className="stat-label">Cumplimiento de consigna</span>
        </div>
        <div className="stat-gauge-wrap">
          {stats.compliance != null
            ? <Gauge pct={stats.compliance} color={complianceColor(stats.compliance)} />
            : <div className="stat-value">—</div>}
        </div>
      </div>

      {/* SOC medio con rango min–max */}
      <div className="stat-card">
        <div className="stat-head">
          <span className="stat-icon" style={{ color: '#79c0ff' }}>{ICONS.battery}</span>
          <span className="stat-label">SOC medio (rango)</span>
        </div>
        <div className="stat-value">
          {fmt(stats.socAvg, 1)}{stats.socAvg != null && <span className="stat-unit">%</span>}
        </div>
        {stats.socAvg != null && (
          <div className="stat-range">
            <div className="stat-range-track">
              <div
                className="stat-range-span"
                style={{ left: `${stats.socMin}%`, width: `${Math.max(0, stats.socMax - stats.socMin)}%`, backgroundColor: '#79c0ff' }}
              />
              <div className="stat-range-marker" style={{ left: `${stats.socAvg}%` }} />
            </div>
            <div className="stat-range-labels">
              <span>min {fmt(stats.socMin, 0)}%</span>
              <span>max {fmt(stats.socMax, 0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Media de entrega */}
      <div className="stat-card">
        <div className="stat-head">
          <span className="stat-icon" style={{ color: '#3fb950' }}>{ICONS.activity}</span>
          <span className="stat-label">Media de entrega</span>
        </div>
        <div className="stat-value">
          {fmt(stats.ppccAvg, 2)}{stats.ppccAvg != null && <span className="stat-unit">MW</span>}
        </div>
        <Sparkline data={stats.sparkPpcc} color="#3fb950" />
      </div>
    </div>
  )
}
