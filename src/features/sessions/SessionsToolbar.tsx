import { useRef } from 'react'
import { SESSION_STATUSES, type SessionStatus } from '../../api/types'
import { setUrlParams, type UrlParams } from '../../lib/useUrlState'
import { STATUS_META } from './labels'

interface SessionsToolbarProps {
  params: UrlParams
  countText: string
}

export function SessionsToolbar({ params, countText }: SessionsToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const filtersActive = params.query !== '' || params.status !== ''

  return (
    <div role="search" aria-label="Filter sessions" className="toolbar">
      <div className="toolbar__search">
        <label htmlFor="session-search">
          Search sessions
        </label>
        <input
          ref={searchRef}
          id="session-search"
          type="search"
          name="query"
          autoComplete="off"
          placeholder="Search title, coach, or location…"
          value={params.query}
          onChange={(event) => setUrlParams({ query: event.target.value }, { replace: true })}
        />
      </div>
      <div className="toolbar__status">
        <label htmlFor="session-status">Status</label>
        <select
          id="session-status"
          name="status"
          value={params.status}
          onChange={(event) => setUrlParams({ status: event.target.value as SessionStatus | '' })}
        >
          <option value="">All statuses</option>
          {SESSION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_META[status].label}
            </option>
          ))}
        </select>
      </div>
      {filtersActive ? (
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            setUrlParams({ query: '', status: '' })
            searchRef.current?.focus()
          }}
        >
          Clear filters
        </button>
      ) : null}
      <p role="status" className="toolbar__count muted">
        {countText}
      </p>
    </div>
  )
}
