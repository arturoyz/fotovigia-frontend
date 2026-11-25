import { useEffect, useRef, useCallback, useState } from 'react'
import { WS_URL, normalizeTimestamp } from '../utils/normalize'

const RECONNECT_DELAY_MS = 3000
const MEASUREMENTS = ['Ptso', 'Ppcc_meas', 'Pbat_meas', 'Ppv_meas', 'sim_pv', 'SOC', 'fmeas']

function toMeasurement(value) {
  if (typeof value === 'string' && value.trim()) value = Number(value)
  return Number.isFinite(value) ? value : null
}

export function useWebSocket({ onData, onConnectionEvent }) {
  const wsRef    = useRef(null)
  const timerRef = useRef(null)
  const onDataRef = useRef(onData)
  const hadConnection = useRef(false)
  useEffect(() => { onDataRef.current = onData }, [onData])

  const [status, setStatus] = useState('connecting')

  const connect = useCallback(function connect() {
    setStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    let opened = false

    ws.onopen = () => {
      opened = true
      setStatus('connected')
      if (hadConnection.current) {
        onConnectionEvent({
          timestamp: Date.now(), type: 'Telemetría', label: 'Conexión restablecida',
          before: 'Sin conexión', after: 'Conectado', unit: '', severity: 'Info',
        })
      }
      hadConnection.current = true
    }

    ws.onmessage = (evt) => {
      try {
        const raw = JSON.parse(evt.data)
        const timestamp = toMeasurement(raw?.timestamp)
        if (timestamp == null || timestamp <= 0) return
        const point = { ...raw, timestamp: normalizeTimestamp(timestamp) }
        if (!Number.isFinite(new Date(point.timestamp).getTime())) return
        for (const key of MEASUREMENTS) point[key] = toMeasurement(raw[key])
        if (point.SOC < 0 || point.SOC > 1) point.SOC = null
        if (MEASUREMENTS.every(key => point[key] === null) && point.modo == null) return
        onDataRef.current(point)
      } catch {
        // ignore malformed
      }
    }

    ws.onerror = () => ws.close()

    ws.onclose = () => {
      setStatus('disconnected')
      if (opened) {
        onConnectionEvent({
          timestamp: Date.now(), type: 'Telemetría', label: 'Conexión perdida',
          before: 'Conectado', after: 'Sin conexión', unit: '', severity: 'Aviso',
        })
      }
      timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }
  }, [onConnectionEvent])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      if (wsRef.current) {
        wsRef.current.onopen = wsRef.current.onmessage = wsRef.current.onerror = wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect])

  return status
}
