export const HISTORICO_URL  = 'https://8v9m4c98ql.execute-api.us-east-1.amazonaws.com/historico'
export const OPERADORES_URL = 'https://8v9m4c98ql.execute-api.us-east-1.amazonaws.com/operadores'
export const WS_URL         = 'wss://axyrmb9n0h.execute-api.us-east-1.amazonaws.com/production/'

// WS may send timestamp in seconds (float) or ms — normalise to ms
export function normalizeTimestamp(ts) {
  if (!ts) return Date.now()
  // if timestamp looks like seconds (< year 2100 in seconds = 4102444800)
  return ts < 4102444800 ? Math.round(ts * 1000) : Math.round(ts)
}

export function formatTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Tick formatter that shows seconds only for short windows (<= 1H)
export function makeTimeTickFormatter(rangeMs) {
  const showSeconds = rangeMs <= 60 * 60 * 1000
  const opts = showSeconds
    ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' }
  return (ms) => new Date(ms).toLocaleTimeString('es-ES', opts)
}

export function formatDateTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

export function fmt(value, decimals = 2) {
  if (value == null || isNaN(value)) return '—'
  return Number(value).toFixed(decimals)
}

export function fmtMW(value) { return fmt(value, 2) }
export function fmtHz(value) { return fmt(value, 3) }
export function fmtSOC(value) {
  if (value == null || isNaN(value)) return '—'
  return (Number(value) * 100).toFixed(1)
}
