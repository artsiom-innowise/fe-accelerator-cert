import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { ApiClientError, toApiClientError } from '../../api/client'

export type RemoteStatus = 'idle' | 'loading' | 'success' | 'error'

export interface Remote<T> {
  status: RemoteStatus
  /** Last successful data, kept while a newer request is loading or has failed. */
  data: T | null
  error: ApiClientError | null
  isRefreshing: boolean
  retry: () => void
}

interface Result<T> {
  key: string
  data: T | null
  error: ApiClientError | null
}

/**
 * Loads remote data for `key` (null = idle). A key change or retry aborts the previous request.
 * State is keyed by request so loading is derived, never synchronised.
 */
export function useRemote<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): Remote<T> {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const requestKey = key === null ? null : `${key}#${attempt}`
  const runLoad = useEffectEvent(load)

  useEffect(() => {
    if (requestKey === null) return
    const controller = new AbortController()
    runLoad(controller.signal).then(
      (data) => setResult({ key: requestKey, data, error: null }),
      (error: unknown) => {
        if (controller.signal.aborted) return
        setResult((prev) => ({ key: requestKey, data: prev?.data ?? null, error: toApiClientError(error) }))
      },
    )
    return () => controller.abort()
  }, [requestKey])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const settled = requestKey !== null && result?.key === requestKey
  const status: RemoteStatus = requestKey === null ? 'idle' : !settled ? 'loading' : result.error ? 'error' : 'success'
  const data = result?.data ?? null

  return {
    status,
    data,
    error: settled ? result.error : null,
    isRefreshing: status === 'loading' && data !== null,
    retry,
  }
}
