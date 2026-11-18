import type {
  ApiError,
  CoachesResponse,
  CreateSessionRequest,
  SessionDetails,
  SessionStatus,
  SessionsResponse,
} from './types'

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors?: Record<string, string>

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export function isAbortError(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'AbortError'
}

export function toApiClientError(error: unknown): ApiClientError {
  return error instanceof ApiClientError
    ? error
    : new ApiClientError(0, 'NETWORK_ERROR', 'Something went wrong. Check your connection and try again.')
}

const invalidResponse = (status: number) =>
  new ApiClientError(status, 'INVALID_RESPONSE', 'The server returned an unexpected response.')

function isApiError(body: unknown): body is ApiError {
  const error = (body as Partial<ApiError> | null)?.error
  return typeof error?.code === 'string' && typeof error.message === 'string'
}

async function request<T>(
  path: string,
  init: RequestInit & { params?: Record<string, string | undefined> } = {},
): Promise<T> {
  const { params, ...rest } = init
  // Absolute same-origin URL: works in the browser and in Node test runtimes.
  const url = new URL(`/api${path}`, window.location.origin)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value)
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiClientError(0, 'NETWORK_ERROR', 'The server could not be reached. Check your connection and try again.')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    if (isAbortError(error)) throw error
    throw invalidResponse(response.status)
  }

  if (!response.ok) {
    if (!isApiError(body)) throw invalidResponse(response.status)
    throw new ApiClientError(response.status, body.error.code, body.error.message, body.error.fieldErrors)
  }
  // shortcut: success bodies are trusted to match the contract after JSON parsing; add schema validation if a real backend is untrusted.
  return body as T
}

export function listSessions(
  params: { query?: string; status?: SessionStatus | '' },
  signal?: AbortSignal,
): Promise<SessionsResponse> {
  return request('/sessions', { signal, params: { query: params.query?.trim(), status: params.status || undefined } })
}

export function getSession(id: string, signal?: AbortSignal): Promise<SessionDetails> {
  return request(`/sessions/${encodeURIComponent(id)}`, { signal })
}

export function listCoaches(signal?: AbortSignal): Promise<CoachesResponse> {
  return request('/coaches', { signal })
}

export function createSession(body: CreateSessionRequest): Promise<SessionDetails> {
  return request('/sessions', { method: 'POST', body: JSON.stringify(body) })
}
