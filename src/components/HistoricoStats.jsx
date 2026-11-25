import { useMemo } from 'react'

const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

function SummaryMetric({ label, value, unit, decimals = 2, children }) {
  return (
    <div className="plant-metric">
      <dt>{label}</dt>
      <dd>{value == null ? '—' : <>{value.toFixed(decimals)} <small>{unit}</small></>}</dd>
      {children && <dd className="plant-metric-detail">{children}</dd>}
    </div>
  )
}

export default function HistoricoStats({ data }) {
  const stats = useMemo(() => {
    let energy = null
    let socMin = Infinity
    let socMax = -Infinity
    const soc = []
    const delivery = []
    const ratios = []

    for (const [index, point] of data.entries()) {
      const next = data[index + 1]
      const power = point.Ppcc_meas
      if (Number.isFinite(power)) {
        delivery.push(power)
        if (Number.isFinite(point.Ptso) && point.Ptso > 0) ratios.push(Math.min(power / point.Ptso, 1))
        if (Number.isFinite(next?.Ppcc_meas) && next.timestamp > point.timestamp) {
          energy = (energy ?? 0) + (power + next.Ppcc_meas) / 2 * (next.timestamp - point.timestamp) / 3600000
        }
      }
      if (Number.isFinite(point.SOC_pct)) {
        soc.push(point.SOC_pct)
        socMin = Math.min(socMin, point.SOC_pct)
        socMax = Math.max(socMax, point.SOC_pct)
      }
    }
    const ratio = mean(ratios)
    return { energy, delivery: mean(delivery), ratio: ratio == null ? null : ratio * 100, soc: mean(soc), socMin, socMax }
  }, [data])

  return (
    <section className="plant-panel history-summary" aria-labelledby="historico-resumen">
      <div className="plant-panel-head"><h2 id="historico-resumen">Resumen del periodo</h2></div>
      <dl className="plant-metrics">
        <SummaryMetric label="Energía entregada" value={stats.energy} unit="MWh" />
        <SummaryMetric label="PCC / TSO medio" value={stats.ratio} unit="%" decimals={1}>
          Consignas positivas · relación limitada al 100 %
        </SummaryMetric>
        <SummaryMetric label="SOC medio" value={stats.soc} unit="%" decimals={1}>
          {stats.soc != null && `Mín. ${stats.socMin.toFixed(0)} % · Máx. ${stats.socMax.toFixed(0)} %`}
        </SummaryMetric>
        <SummaryMetric label="Entrega PCC media" value={stats.delivery} unit="MW" />
      </dl>
    </section>
  )
}
