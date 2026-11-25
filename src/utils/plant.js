export function batteryState(power) {
  if (power == null) return 'Sin lectura'
  if (power < -0.02) return 'Carga'
  if (power > 0.02) return 'Descarga'
  return 'En reposo'
}

export function signed(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}`
}

export function setpointMetrics(point) {
  const { Ppcc_meas: delivery, Ptso: setpoint } = point ?? {}
  if (!Number.isFinite(delivery) || !Number.isFinite(setpoint)) return {}
  const difference = delivery - setpoint
  return {
    difference,
    // A zero setpoint has no meaningful relative error or delivery ratio.
    relative: setpoint ? difference / Math.abs(setpoint) * 100 : null,
    ratio: setpoint > 0 ? delivery / setpoint * 100 : null,
  }
}
export function liveTimeDomain(firstTimestamp, latestTimestamp, rangeMs) {
  if (firstTimestamp == null || latestTimestamp == null) return undefined
  const start = Math.max(firstTimestamp, latestTimestamp - rangeMs)
  return [start, start + rangeMs]
}
