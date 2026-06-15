import { useEffect, useRef, useCallback, useState } from 'react'
import { WS_URL, normalizeTimestamp } from '../utils/normalize'

const RECONNECT_DELAY_MS = 3000
const MAX_LIVE_POINTS    = 600

export function useWebSocket({ onData }) {
  const wsRef    = useRef(null)
  const timerRef = useRef(null)
  const onDataRef = useRef(onData)
  onDataRef.current = onData

  const [status, setStatus] = useState('connecting')

  const connect = useCallback(() => {
    setStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setStatus('connected')

    ws.onmessage = (evt) => {
      try {
        const raw = JSON.parse(evt.data)
        const point = { ...raw, timestamp: normalizeTimestamp(raw.timestamp) }
        onDataRef.current(point)
      } catch {
        // ignore malformed
      }
    }

    ws.onerror = () => ws.close()

    ws.onclose = () => {
      setStatus('disconnected')
      timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null  // prevent reconnect on intentional close
        wsRef.current.close()
      }
    }
  }, [connect])

  return status
}
