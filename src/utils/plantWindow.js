import { getModo } from './modos.js'
import { batteryState, liveTimeDomain, setpointMetrics, signed } from './plant.js'

// Live measurements normally arrive once per second. Do not carry a reading
// across a gap longer than three seconds or beyond the last observed sample.
export const MAX_SAMPLE_GAP_MS = 3000
export const FREQUENCY_LIMITS = [49.8, 50.2]
// Match the displayed MW resolution and group continuous updates into one
// event. These rules affect the event log only, never the measurements.
const SETPOINT_EVENT_RESOLUTION_MW = 0.01
const SETPOINT_SETTLING_MS = 3000

function addSetpointEvents(events, samples, start) {
  let change
  function emit() {
    if (!change || change.timestamp < start) return
    const { timestamp, before, after, updates, span } = change
    if (span + Number.EPSILON * Math.max(1, Math.abs(before)) < SETPOINT_EVENT_RESOLUTION_MW) return
    events.push({
      timestamp, type: 'Consigna', label: updates > 1 ? 'Variación continua de consigna TSO' : 'Cambio de consigna TSO',
      before, after, unit: 'MW', severity: 'Info',
    })
  }

  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1]
    const current = samples[index]
    if (previous.Ptso == null || current.Ptso == null || current.timestamp - previous.timestamp > MAX_SAMPLE_GAP_MS) {
      emit()
      change = undefined
      continue
    }
    if (current.Ptso === previous.Ptso) continue
    if (change && current.timestamp - change.lastTimestamp > SETPOINT_SETTLING_MS) {
      emit()
      change = undefined
    }
    change ??= { timestamp: current.timestamp, before: previous.Ptso, span: 0, updates: 0 }
    change.lastTimestamp = current.timestamp
    change.after = current.Ptso
    change.span = Math.max(change.span, Math.abs(change.after - change.before))
    change.updates++
  }
  emit()
}

function frequencyState(value) {
  if (value == null) return null
  if (value < FREQUENCY_LIMITS[0]) return 'Por debajo del umbral'
  if (value > FREQUENCY_LIMITS[1]) return 'Por encima del umbral'
  return 'Entre umbrales'
}

function addSampleEvents(events, before, after) {
  const { timestamp } = after
  function add(type, label, previous, current, unit = '', severity = 'Info') {
    if (previous == null || current == null || previous === current) return
    events.push({ timestamp, type, label, before: previous, after: current, unit, severity })
  }
  const previousMode = getModo(before.modo)
  const currentMode = getModo(after.modo)
  if (previousMode.cls !== 'unknown' && currentMode.cls !== 'unknown') {
    add('Modo', 'Cambio de modo', previousMode.label, currentMode.label)
  }
  if (before.Pbat_meas != null && after.Pbat_meas != null) {
    const previousState = batteryState(before.Pbat_meas)
    const currentState = batteryState(after.Pbat_meas)
    if (previousState !== currentState) {
      add('BESS', 'Cambio de estado', `${previousState} (${signed(before.Pbat_meas)} MW)`,
        `${currentState} (${signed(after.Pbat_meas)} MW)`)
    }
  }
  const previousFrequency = frequencyState(before.fmeas)
  const currentFrequency = frequencyState(after.fmeas)
  if (previousFrequency && currentFrequency && previousFrequency !== currentFrequency) {
    add('Red', currentFrequency, before.fmeas, after.fmeas, 'Hz',
      currentFrequency === 'Entre umbrales' ? 'Info' : 'Aviso')
  }
  const gapMs = timestamp - before.timestamp
  if (gapMs > MAX_SAMPLE_GAP_MS) {
    events.push({
      timestamp, type: 'Telemetría', label: `Intervalo sin muestras (${(gapMs / 1000).toFixed(1)} s)`,
      before: new Date(before.timestamp).toISOString(), after: new Date(timestamp).toISOString(),
      unit: '', severity: 'Aviso',
    })
  }
}

export function buildPlantWindow(data, connectionEvents, rangeMs, toleranceMW) {
  const latest = data.at(-1)
  const lastConnection = connectionEvents.at(-1)?.timestamp
  const observedEnd = Math.max(latest?.timestamp ?? 0, lastConnection ?? 0)
  const first = Math.min(data[0]?.timestamp ?? Infinity, connectionEvents[0]?.timestamp ?? Infinity)
  const timeDomain = observedEnd ? liveTimeDomain(first, observedEnd, rangeMs) : undefined
  const start = timeDomain?.[0]
  const firstVisible = data.findIndex(point => point.timestamp >= start)
  const samples = firstVisible < 0 ? [] : data.slice(firstVisible)
  const events = connectionEvents.filter(event => event.timestamp >= start && event.timestamp <= observedEnd)
  const compliance = toleranceMW == null ? null : {
    toleranceMW, evaluatedMs: 0, inBandMs: 0, excursions: 0, observedMs: observedEnd ? observedEnd - start : 0,
  }
  let outside = false
  let connectionIndex = 0
  let disconnected = false

  if (firstVisible >= 0) {
    addSetpointEvents(events, data, start)
    for (let index = Math.max(1, firstVisible); index < data.length; index++) {
      const before = data[index - 1]
      const after = data[index]
      addSampleEvents(events, before, after)
      if (!compliance) continue
      const intervalStart = Math.max(start, before.timestamp)
      while (connectionEvents[connectionIndex]?.timestamp <= intervalStart) {
        disconnected = connectionEvents[connectionIndex++].after === 'Sin conexión'
      }
      const connectionChanged = connectionEvents[connectionIndex]?.timestamp < after.timestamp
      const { difference } = setpointMetrics(before)
      if (disconnected || connectionChanged || difference == null || setpointMetrics(after).difference == null
        || after.timestamp - before.timestamp > MAX_SAMPLE_GAP_MS) {
        outside = false
        continue
      }
      const duration = after.timestamp - intervalStart
      if (duration <= 0) continue
      compliance.evaluatedMs += duration
      const inBand = Math.abs(difference) <= toleranceMW + Number.EPSILON * Math.max(1, Math.abs(before.Ptso), Math.abs(before.Ppcc_meas))
      if (inBand) compliance.inBandMs += duration
      if (!inBand && !outside) compliance.excursions++
      outside = !inBand
    }
  }

  return {
    timeDomain, observedEnd: observedEnd || null, rangeMs, samples, latest, events: events.sort((a, b) => a.timestamp - b.timestamp),
    compliance, instant: setpointMetrics(latest),
  }
}

export function eventValue(event, key) {
  const value = event[key]
  if (typeof value !== 'number') return value
  return `${value} ${event.unit}`
}
