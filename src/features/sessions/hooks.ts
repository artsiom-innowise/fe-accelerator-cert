import { useEffect, useState } from 'react'
import { getSession, listCoaches, listSessions } from '../../api/client'
import type { SessionStatus } from '../../api/types'
import { useRemote } from './useRemote'

const SEARCH_DEBOUNCE_MS = 250

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export function useSessions(query: string, status: SessionStatus | '') {
  const debouncedQuery = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS)
  // Results carry the filters that produced them, so empty vs no-match never mixes stale data with new filters.
  return useRemote(JSON.stringify([debouncedQuery, status]), (signal) =>
    listSessions({ query: debouncedQuery, status }, signal).then((response) => ({
      ...response,
      filters: { query: debouncedQuery, status },
    })),
  )
}

export function useSessionDetails(id: string) {
  return useRemote(id, (signal) => getSession(id, signal))
}

export function useCoaches() {
  return useRemote('coaches', listCoaches)
}
