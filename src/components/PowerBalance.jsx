import { fmtMW } from '../utils/normalize'
import { batteryState, signed } from '../utils/plant'

function flowState(power, direction = Math.sign(power)) {
  if (!Number.isFinite(power)) return 'missing'
  if (direction > 0) return 'forward'
  if (direction < 0) return 'reverse'
  return 'idle'
}

function FlowLink({ path, x, y, state }) {
  const active = state === 'forward' || state === 'reverse'
  return (
    <g className={`power-link power-link-${state}`}>
      <path d={path} vectorEffect="non-scaling-stroke" />
      {active && (
        <path d="M-4 -2 L0 2 L4 -2" vectorEffect="non-scaling-stroke"
          transform={`translate(${x} ${y}) rotate(${state === 'reverse' ? 180 : 0})`} />
      )}
    </g>
  )
}

function PowerReading({ label, value, detail }) {
  return (
    <div className="power-reading">
      <dt>{label}</dt>
      <dd className="power-reading-value">{value}</dd>
      <dd className="power-reading-detail">{detail}</dd>
    </div>
  )
}

export default function PowerBalance({ latest }) {
  const { Ppv_meas: solar, Pbat_meas: battery, Ppcc_meas: pcc } = latest ?? {}
  const batteryMode = batteryState(battery)
  const solarFlow = flowState(solar)
  const batteryFlow = flowState(battery, batteryMode === 'Carga' ? -1 : batteryMode === 'Descarga' ? 1 : 0)
  const pccFlow = flowState(pcc)
  const solarDetail = {
    forward: 'Entrega FV', reverse: 'Flujo inverso', idle: 'Sin flujo', missing: 'Sin lectura',
  }[solarFlow]
  const pccDetail = {
    forward: 'Entrega a red', reverse: 'Importación de red', idle: 'Sin intercambio con la red', missing: 'Sin lectura',
  }[pccFlow]

  return (
    <section className="plant-panel plant-balance" aria-label="Balance de potencia">
      <div className="plant-panel-head"><h2>Balance de potencia</h2><span>MW</span></div>
      <div className="power-schematic">
        <dl className="power-sources">
          <PowerReading label="Solar FV" value={fmtMW(solar)} detail={solarDetail} />
          <PowerReading label="BESS" value={signed(battery)} detail={batteryMode} />
        </dl>
        <svg className="power-wiring" viewBox="0 0 256 65" aria-hidden="true">
          <FlowLink path="M64 3 V36 H128" x={64} y={22} state={solarFlow} />
          <FlowLink path="M192 3 V36 H128" x={192} y={22} state={batteryFlow} />
          <FlowLink path="M128 36 V62" x={128} y={51} state={pccFlow} />
          <circle className="power-junction" cx="128" cy="36" r="3" />
        </svg>
        <dl className="power-pcc">
          <PowerReading label="Punto de conexión · PCC" value={fmtMW(pcc)} detail={pccDetail} />
        </dl>
      </div>
      <footer className="plant-panel-foot">Esquema funcional · Potencias medidas</footer>
    </section>
  )
}
