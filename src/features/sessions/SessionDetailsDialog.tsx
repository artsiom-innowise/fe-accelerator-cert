import type { ReactNode } from 'react'
import { addMinutes, formatLongDateTime, formatTime } from '../../api/dates'
import type { SessionDetails } from '../../api/types'
import { Dialog } from '../../components/Dialog'
import { InlineAlert } from '../../components/InlineAlert'
import { StatusBadge } from '../../components/StatusBadge'
import { useSessionDetails } from './hooks'
import { TYPE_LABEL, VISIBILITY_LABEL } from './labels'

const TITLE_ID = 'session-details-title'

// Ids come from the URL, so match by dataset instead of building a selector.
const findSessionLink = (id: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-session-id]')).find((el) => el.dataset.sessionId === id) ??
  null

interface SessionDetailsDialogProps {
  id: string
  fallbackTitle?: string
  onClose: () => void
}

export function SessionDetailsDialog({ id, fallbackTitle, onClose }: SessionDetailsDialogProps) {
  const details = useSessionDetails(id)
  const notFound = details.status === 'error' && details.error?.status === 404
  const session = details.status === 'success' ? details.data : null

  return (
    <Dialog titleId={TITLE_ID} onClose={onClose} returnFocus={() => findSessionLink(id)}>
      <header className="dialog__header">
        <div>
          <p className="eyebrow">Session details</p>
          <h2 id={TITLE_ID} tabIndex={-1}>
            {notFound ? 'Session not found' : (session?.title ?? fallbackTitle ?? 'Session')}
          </h2>
          {session ? <StatusBadge status={session.status} /> : null}
        </div>
        <button type="button" className="icon-button" aria-label="Close session details" onClick={onClose}>
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <div className="dialog__body">
        {details.status === 'loading' ? (
          <p role="status" className="muted">
            Loading details…
          </p>
        ) : null}
        {notFound ? <p>It may have been removed. Return to the list to choose another session.</p> : null}
        {details.status === 'error' && !notFound ? (
          <InlineAlert
            title={details.error?.message ?? "Session details can't be loaded right now."}
            onRetry={details.retry}
          />
        ) : null}
        {session ? <DetailsContent session={session} /> : null}
      </div>

      <footer className="dialog__footer">
        <button type="button" className="button button--secondary" onClick={onClose}>
          Back to sessions
        </button>
      </footer>
    </Dialog>
  )
}

function DetailsContent({ session }: { session: SessionDetails }) {
  const open = Math.max(session.capacity - session.bookedCount, 0)
  return (
    <>
      {session.cancellation ? (
        <section className="notice" aria-labelledby="cancellation-title">
          <h3 id="cancellation-title">Cancellation</h3>
          <p>{session.cancellation.reason ?? 'No reason recorded.'}</p>
          <p className="muted">Cancelled {formatLongDateTime(session.cancellation.cancelledAt)}</p>
        </section>
      ) : null}
      <dl className="details-list">
        <Item label="Start">
          {formatLongDateTime(session.startsAt)}
          <span className="muted"> until {formatTime(addMinutes(session.startsAt, session.durationMinutes))}</span>
        </Item>
        <Item label="Duration">{session.durationMinutes} minutes</Item>
        <Item label="Type">{TYPE_LABEL[session.type]}</Item>
        <Item label="Visibility">{VISIBILITY_LABEL[session.visibility]}</Item>
        <Item label="Location">
          {session.location.name}
          <span className="muted block">{session.location.address}</span>
        </Item>
        <Item label="Coach">
          {session.coach.name}
          <a className="block" href={`mailto:${session.coach.email}`}>
            {session.coach.email}
          </a>
        </Item>
        <Item label="Capacity">
          {session.bookedCount} booked of {session.capacity} places ·{' '}
          {open === 0 ? (
            <span className="text-warning">
              <span aria-hidden="true">■</span> Full, 0 open
            </span>
          ) : (
            `${open} open`
          )}
        </Item>
        <Item label="Description">{session.description ?? <span className="muted">None</span>}</Item>
        <Item label="Trainer notes">{session.trainerNotes ?? <span className="muted">None</span>}</Item>
      </dl>
      <p className="muted small">
        Created {formatLongDateTime(session.createdAt)} · Last updated {formatLongDateTime(session.updatedAt)}
      </p>
    </>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
