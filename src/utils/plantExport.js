import { getModo } from './modos.js'
import { eventValue, MAX_SAMPLE_GAP_MS } from './plantWindow.js'

const fields = [
  ['Entrega PCC', 'Ppcc_meas', 'MW'],
  ['Consigna TSO', 'Ptso', 'MW'],
  ['Batería', 'Pbat_meas', 'MW'],
  ['Solar entregada', 'Ppv_meas', 'MW'],
  ['Solar disponible', 'sim_pv', 'MW'],
  ['SOC', 'SOC', '%'],
  ['Frecuencia', 'fmeas', 'Hz'],
]

const iso = timestamp => timestamp == null ? null : new Date(timestamp).toISOString()
const measurement = (point, key) => key === 'SOC' && point?.SOC != null ? point.SOC * 100 : point?.[key] ?? null
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
const escape = value => String(value ?? '—').replace(/[&<>"']/g, character => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
))

export function serializePlantWindow(view, format) {
  const { timeDomain, observedEnd, rangeMs, samples, latest, events, instant, compliance } = view
  const from = iso(timeDomain?.[0])
  const to = iso(observedEnd)
  const latestAt = iso(latest?.timestamp)
  const complianceReport = compliance && {
    ...compliance,
    percentInBand: compliance.evaluatedMs ? 100 * compliance.inBandMs / compliance.evaluatedMs : null,
  }

  if (format === 'csv') {
    const rows = [
      ['Timestamp UTC', ...fields.map(([label, , unit]) => `${label} (${unit})`), 'Modo'],
      ...samples.map(point => [
        iso(point.timestamp), ...fields.map(([, key]) => measurement(point, key)), getModo(point.modo).label,
      ]),
    ]
    return rows.map(row => row.map(csvCell).join(',')).join('\r\n')
  }

  if (format === 'json') {
    return JSON.stringify({
      from, to, rangeMs, latestAt, instant, maxSampleGapMs: MAX_SAMPLE_GAP_MS, compliance: complianceReport,
      samples: samples.map(point => ({
        timestamp: iso(point.timestamp),
        ...Object.fromEntries(fields.map(([, key, unit]) => [`${key}_${unit === '%' ? 'pct' : unit}`, measurement(point, key)])),
        mode: getModo(point.modo).label,
      })),
      events: events.map(event => ({ ...event, timestamp: iso(event.timestamp) })),
    }, null, 2)
  }

  const kpis = fields.map(([label, key, unit]) => {
    const value = measurement(latest, key)
    return `<li><strong>${label}</strong> ${value == null ? '—' : `${value.toFixed(key === 'fmeas' ? 3 : 2)} ${unit}`}</li>`
  }).join('')
  const eventRows = events.map(event => [
    iso(event.timestamp), event.type, event.severity, event.label, eventValue(event, 'before'), eventValue(event, 'after'),
  ]).map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')
  const complianceText = !complianceReport ? 'Tolerancia sin configurar' : [
    `Tolerancia ±${complianceReport.toleranceMW} MW`,
    complianceReport.percentInBand == null ? 'Sin tiempo evaluable' : `${complianceReport.percentInBand.toFixed(1)} % en banda`,
    `${(complianceReport.evaluatedMs / 1000).toFixed(1)} de ${(complianceReport.observedMs / 1000).toFixed(1)} s evaluados`,
    `${complianceReport.excursions} salidas`,
  ].join(' · ')
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Fotovigia · Informe de ventana</title>
<style>body{font:15px/1.55 system-ui;margin:32px;color:#171b21}table{border-collapse:collapse;width:100%}th,td{padding:6px;text-align:left;border-bottom:1px solid #bbb}thead{display:table-header-group}tr{break-inside:avoid}</style>
<h1>Fotovigia · Informe de ventana</h1>
<p>Periodo observado (UTC) <strong>${escape(from)} → ${escape(to)}</strong> · Ventana seleccionada ${rangeMs / 60000} min · ${samples.length} muestras</p>
<h2>Última muestra</h2><p>${escape(latestAt)} · ${escape(getModo(latest?.modo).label)}</p>
<ul>${kpis}<li><strong>Desviación PCC − TSO</strong> ${instant.difference == null ? '—' : `${instant.difference.toFixed(2)} MW`}</li>
<li><strong>PCC / TSO instantáneo</strong> ${instant.ratio == null ? '—' : `${instant.ratio.toFixed(1)} %`}</li></ul>
<h2>Cumplimiento de la ventana</h2><p>${escape(complianceText)}</p>
<p>Se evalúa el tiempo entre muestras consecutivas válidas. Se excluyen las desconexiones, los intervalos de más de ${MAX_SAMPLE_GAP_MS / 1000} s y el tiempo posterior a la última muestra.</p>
<h2>Registro operativo</h2>${eventRows ? `<table><thead><tr><th>Hora UTC</th><th>Tipo</th><th>Severidad</th><th>Evento</th><th>Antes</th><th>Después</th></tr></thead><tbody>${eventRows}</tbody></table>` : '<p>Sin eventos en la ventana.</p>'}
</html>`
}

export function downloadPlantWindow(view, format) {
  const types = { csv: 'text/csv', json: 'application/json', html: 'text/html' }
  const contents = serializePlantWindow(view, format)
  const blob = new Blob([format === 'csv' ? '\uFEFF' : '', contents], { type: `${types[format]};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `fotovigia-${iso(view.observedEnd).replaceAll(':', '-')}.${format}`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
