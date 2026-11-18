import { useMemo, useSyncExternalStore } from 'react'
import { SESSION_STATUSES, type SessionStatus } from '../api/types'

// The URL is the single owner of filter and overlay state (architecture D1).
export interface UrlParams {
  query: string
  status: SessionStatus | ''
  session: string | null
  create: boolean
}

const CHANGE_EVENT = 'urlstatechange'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

const getSearch = () => window.location.search

function parse(search: string): UrlParams {
  const sp = new URLSearchParams(search)
  const status = sp.get('status') ?? ''
  return {
    query: sp.get('query') ?? '',
    status: SESSION_STATUSES.includes(status as SessionStatus) ? (status as SessionStatus) : '',
    session: sp.get('session') || null,
    create: sp.get('create') === '1',
  }
}

/** Builds a URL for the patch, preserving params this module does not own (e.g. `scenario`). */
export function hrefWith(patch: Partial<UrlParams>): string {
  const sp = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(patch)) {
    if (value === '' || value === null || value === false) sp.delete(key)
    else sp.set(key, value === true ? '1' : String(value))
  }
  const qs = sp.toString()
  return `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
}

export function setUrlParams(patch: Partial<UrlParams>, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', hrefWith(patch))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useUrlParams(): UrlParams {
  const search = useSyncExternalStore(subscribe, getSearch)
  return useMemo(() => parse(search), [search])
}
