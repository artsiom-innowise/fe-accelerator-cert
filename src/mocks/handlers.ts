import { delay, http, HttpResponse } from 'msw'
import {
  SESSION_STATUSES,
  SESSION_TYPES,
  VISIBILITIES,
  type ApiError,
  type CreateSessionRequest,
  type SessionStatus,
  type SessionsResponse,
} from '../api/types'
import type { MockDb } from './db'
import { errorOverride, latencyOverride } from './scenario'

const apiError = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) =>
  HttpResponse.json<ApiError>({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }, { status })

const isNonBlank = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0

/** Contract-level validation (MOCKING_GUIDE "Stateful Create"); product rules live in the client form. */
function validateCreate(body: Partial<Record<keyof CreateSessionRequest, unknown>>, db: MockDb) {
  const errors: Record<string, string> = {}
  for (const field of ['title', 'locationName', 'locationAddress'] as const) {
    if (!isNonBlank(body[field])) errors[field] = 'This field is required.'
  }
  if (!SESSION_TYPES.includes(body.type as never)) errors.type = 'Choose a supported session type.'
  if (!VISIBILITIES.includes(body.visibility as never)) errors.visibility = 'Choose a supported visibility.'
  if (!isPositiveInt(body.durationMinutes)) errors.durationMinutes = 'Duration must be a positive whole number.'
  if (!isPositiveInt(body.capacity)) errors.capacity = 'Capacity must be a positive whole number.'
  if (typeof body.startsAt !== 'string' || Number.isNaN(Date.parse(body.startsAt)))
    errors.startsAt = 'Start must be a valid ISO 8601 timestamp.'
  const coach = db.coaches.find((c) => c.id === body.coachId)
  if (!coach) errors.coachId = 'Choose an existing coach.'
  return { errors, coach }
}

export function createHandlers(getDb: () => MockDb, defaultLatencyMs: number) {
  /** Applies scenario latency and error overrides; returns a response when the scenario short-circuits. */
  async function scenario(request: string) {
    await delay(latencyOverride(request) ?? defaultLatencyMs)
    const override = errorOverride(request)
    return override ? HttpResponse.json(override.body as ApiError, { status: override.status }) : null
  }

  return [
    http.get('/api/sessions', async ({ request }) => {
      const overridden = await scenario('GET /api/sessions')
      if (overridden) return overridden
      const params = new URL(request.url).searchParams
      const status = params.get('status') ?? ''
      if (status && !SESSION_STATUSES.includes(status as SessionStatus)) {
        return apiError(400, 'INVALID_FILTER', `Unsupported status "${status}".`)
      }
      const data = getDb().list({ query: params.get('query') ?? '', status: status as SessionStatus | '' })
      return HttpResponse.json<SessionsResponse>({ data, meta: { page: 1, pageSize: 10, total: data.length } })
    }),

    http.get('/api/sessions/:sessionId', async ({ params }) => {
      const id = String(params.sessionId)
      const overridden = await scenario(`GET /api/sessions/${id}`)
      if (overridden) return overridden
      const session = getDb().get(id)
      return session
        ? HttpResponse.json(session)
        : apiError(404, 'SESSION_NOT_FOUND', 'The requested session no longer exists.')
    }),

    http.get('/api/coaches', async () => {
      const overridden = await scenario('GET /api/coaches')
      if (overridden) return overridden
      return HttpResponse.json({ data: getDb().coaches })
    }),

    http.post('/api/sessions', async ({ request }) => {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        body = null
      }
      const overridden = await scenario('POST /api/sessions')
      if (overridden) return overridden
      if (typeof body !== 'object' || body === null) {
        return apiError(400, 'VALIDATION_FAILED', 'The request body must be a JSON object.')
      }
      const db = getDb()
      const { errors, coach } = validateCreate(body, db)
      if (!coach || Object.keys(errors).length > 0) {
        return apiError(400, 'VALIDATION_FAILED', 'Some fields need attention.', errors)
      }
      return HttpResponse.json(db.create(body as CreateSessionRequest, coach), { status: 201 })
    }),
  ]
}
