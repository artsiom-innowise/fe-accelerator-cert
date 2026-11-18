import { useEffect, useRef, useState } from 'react'
import { formatDateTime } from '../../api/dates'
import type { SessionDetails } from '../../api/types'
import { InlineAlert } from '../../components/InlineAlert'
import { setUrlParams, useUrlParams } from '../../lib/useUrlState'
import { CreateSessionDialog } from './CreateSessionDialog'
import { useSessions } from './hooks'
import { STATUS_META } from './labels'
import { SessionDetailsDialog } from './SessionDetailsDialog'
import { SessionsTable } from './SessionsTable'
import { SessionsToolbar } from './SessionsToolbar'
import { matchesFilters } from './validation'

const openCreate = () => setUrlParams({ create: true })
// Closing overlays replaces the entry so Back does not reopen them.
const closeOverlay = (key: 'session' | 'create') => setUrlParams({ [key]: key === 'create' ? false : null }, { replace: true })
// The activating button disappears once filters clear, so keep focus on the search input.
const clearFilters = () => {
  setUrlParams({ query: '', status: '' })
  document.getElementById('session-search')?.focus()
}

export function SessionsWorkspace() {
  const params = useUrlParams()
  const sessions = useSessions(params.query, params.status)
  const [created, setCreated] = useState<SessionDetails | null>(null)
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (created) bannerRef.current?.focus()
  }, [created])

  const list = sessions.data?.data ?? []
  const total = sessions.data?.meta.total ?? 0
  const shownFilters = sessions.data?.filters
  const filtersActive = !!shownFilters && (shownFilters.query !== '' || shownFilters.status !== '')
  const countText =
    sessions.status === 'loading'
      ? sessions.isRefreshing
        ? 'Updating…'
        : ''
      : sessions.status === 'success'
        ? total === 0
          ? filtersActive
            ? 'No matching sessions'
            : 'No sessions'
          : `${total} ${total === 1 ? 'session' : 'sessions'}`
        : ''
  const createdHidden = created ? !matchesFilters(created, params.query, params.status) : false

  function handleCreated(session: SessionDetails) {
    setCreated(session)
    closeOverlay('create')
    sessions.retry()
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Training sessions
          </h1>
          <p className="muted small">Find scheduled work, review capacity, and create sessions.</p>
        </div>
        <button type="button" className="button button--primary" onClick={openCreate}>
          Create session
        </button>
      </div>

      <div className="workspace">
        <SessionsToolbar params={params} countText={countText} />

        {created ? (
          <div ref={bannerRef} role="status" className="banner" tabIndex={-1}>
            <p>
              <span aria-hidden="true">✓</span> “{created.title}” created for {formatDateTime(created.startsAt)}.
              {createdHidden ? ' It’s hidden by your current filters.' : null}
            </p>
            <div className="actions">
              <button type="button" className="button" onClick={() => setUrlParams({ session: created.id })}>
                Open session
              </button>
              {createdHidden ? (
                <button type="button" className="button button--secondary" onClick={clearFilters}>
                  Reset filters
                </button>
              ) : null}
              <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setCreated(null)}>
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>
        ) : null}

        <section aria-labelledby="results-title" aria-busy={sessions.status === 'loading'} className="results">
          <h2 id="results-title" className="visually-hidden">
            Sessions
          </h2>
          {sessions.status === 'loading' && !sessions.data ? <p className="state muted">Loading sessions…</p> : null}
          {sessions.status === 'error' ? (
            <InlineAlert
              title={sessions.error?.message ?? "Sessions can't be loaded right now."}
              onRetry={sessions.retry}
            >
              {sessions.error?.code === 'INVALID_FILTER' ? (
                <button type="button" className="button button--secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null}
            </InlineAlert>
          ) : null}
          {sessions.status !== 'error' && sessions.data && total === 0 ? (
            filtersActive ? (
              <div className="state">
                <h3>No sessions match your filters</h3>
                <p className="muted">
                  {[
                    shownFilters?.query ? `Search “${shownFilters.query}”` : null,
                    shownFilters?.status ? `Status: ${STATUS_META[shownFilters.status].label}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <button type="button" className="button" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="state">
                <h3>No sessions yet</h3>
                <p className="muted">Create the first session to start scheduling.</p>
                <button type="button" className="button button--primary" onClick={openCreate}>
                  Create session
                </button>
              </div>
            )
          ) : null}
          {sessions.status !== 'error' && list.length > 0 ? <SessionsTable sessions={list} /> : null}
        </section>
      </div>

      {params.session ? (
        <SessionDetailsDialog
          key={params.session}
          id={params.session}
          fallbackTitle={list.find((s) => s.id === params.session)?.title}
          onClose={() => closeOverlay('session')}
        />
      ) : null}
      {params.create ? <CreateSessionDialog onClose={() => closeOverlay('create')} onCreated={handleCreated} /> : null}
    </>
  )
}
