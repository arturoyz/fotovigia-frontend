import { eventValue } from '../utils/plantWindow'
import PanelStatus from './PanelStatus'

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  year: 'numeric', month: '2-digit', day: '2-digit',
})
const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
})

function EventTime({ timestamp }) {
  return (
    <time dateTime={new Date(timestamp).toISOString()}>
      <strong>{timeFormatter.format(timestamp)}</strong>
      <small>{dateFormatter.format(timestamp)}</small>
    </time>
  )
}

function EventValue({ event, field }) {
  const value = eventValue(event, field)
  const timestamp = typeof value === 'string' && value.endsWith('Z') ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? <EventTime timestamp={timestamp} /> : value
}

export default function PlantEventLog({ events, hasTelemetry }) {
  return (
    <section className="plant-panel plant-events" aria-labelledby="plant-events-heading">
      <div className="plant-panel-head">
        <h2 id="plant-events-heading">Registro operativo</h2>
        <span>{events.length} {events.length === 1 ? 'evento' : 'eventos'} en ventana</span>
      </div>
      <div className="plant-event-region" tabIndex={events.length ? 0 : undefined}
        role="region" aria-label="Eventos de la ventana">
        {events.length ? (
          <table className="plant-event-table">
            <colgroup><col className="plant-event-time-col" /><col /><col /><col /></colgroup>
            <thead><tr>
              <th scope="col">Hora local</th><th scope="col">Evento</th><th scope="col">Antes</th><th scope="col">Después</th>
            </tr></thead>
            <tbody>
              {events.toReversed().map(event => (
                <tr key={`${event.timestamp}-${event.label}`}>
                  <td><EventTime timestamp={event.timestamp} /></td>
                  <td>
                    <strong>{event.label}</strong>
                    <small className={event.severity === 'Aviso' ? 'plant-event-warning' : undefined}>
                      {event.type} · {event.severity}
                    </small>
                  </td>
                  <td className="plant-event-value"><EventValue event={event} field="before" /></td>
                  <td className="plant-event-value"><EventValue event={event} field="after" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <PanelStatus kind={hasTelemetry ? 'empty' : 'waiting'}>
            {hasTelemetry ? 'Sin cambios registrados en esta ventana' : 'Esperando telemetría'}
          </PanelStatus>
        )}
      </div>
    </section>
  )
}
