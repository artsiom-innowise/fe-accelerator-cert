import type { MouseEvent } from 'react'
import { formatDateTime } from '../../api/dates'
import type { SessionSummary } from '../../api/types'
import { StatusBadge } from '../../components/StatusBadge'
import { hrefWith, setUrlParams } from '../../lib/useUrlState'
import { TYPE_LABEL } from './labels'

function openSession(event: MouseEvent<HTMLAnchorElement>, id: string) {
  // Let modified clicks open the deep link in a new tab/window.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  setUrlParams({ session: id })
}

// Explicit roles keep table semantics when CSS reflows rows into stacked blocks on mobile.
export function SessionsTable({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <table className="sessions-table" role="table">
      <caption className="visually-hidden">Training sessions</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">Session</th>
          <th role="columnheader" scope="col">Start</th>
          <th role="columnheader" scope="col">Coach</th>
          <th role="columnheader" scope="col">Capacity</th>
          <th role="columnheader" scope="col">Status</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {sessions.map((s) => (
          <tr role="row" key={s.id}>
            <td role="cell" className="cell-session">
              <a
                className="session-link"
                href={hrefWith({ session: s.id })}
                data-session-id={s.id}
                onClick={(event) => openSession(event, s.id)}
              >
                {s.title}
              </a>
              <span className="muted">
                {TYPE_LABEL[s.type]} · {s.location.name}
              </span>
            </td>
            <td role="cell" data-label="Start">
              <span>{formatDateTime(s.startsAt)}</span>
              <span className="muted">{s.durationMinutes} min</span>
            </td>
            <td role="cell" data-label="Coach">
              {s.coach.name}
            </td>
            <td role="cell" data-label="Capacity" className="numeric">
              <span aria-hidden="true">
                {s.bookedCount} / {s.capacity}
              </span>
              <span className="visually-hidden">
                {s.bookedCount} booked of {s.capacity}
              </span>
              <span className="muted" aria-hidden="true">
                booked
              </span>
            </td>
            <td role="cell" data-label="Status" className="cell-status">
              <StatusBadge status={s.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
