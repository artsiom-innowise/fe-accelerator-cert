import type {
  CoachSummary,
  CreateSessionRequest,
  SessionDetails,
  SessionStatus,
  SessionSummary,
} from '../api/types'
import clock from '../../frontend-accelerator-assessment/fixtures/fixture-clock.json'
import coachesFixture from '../../frontend-accelerator-assessment/fixtures/coaches.json'
import sessionsFixture from '../../frontend-accelerator-assessment/fixtures/sessions.json'

const detailFixtures = import.meta.glob<SessionDetails>(
  '../../frontend-accelerator-assessment/fixtures/session-details/*.json',
  { eager: true, import: 'default' },
)
const detailsById = new Map(Object.values(detailFixtures).map((d) => [d.id, d]))

export function rebase(iso: string, offsetMs: number): string {
  return new Date(Date.parse(iso) + offsetMs).toISOString()
}

function rebaseDetails(details: SessionDetails, offsetMs: number): SessionDetails {
  return {
    ...details,
    startsAt: rebase(details.startsAt, offsetMs),
    createdAt: rebase(details.createdAt, offsetMs),
    updatedAt: rebase(details.updatedAt, offsetMs),
    cancellation: details.cancellation && {
      ...details.cancellation,
      cancelledAt: rebase(details.cancellation.cancelledAt, offsetMs),
    },
  }
}

function toSummary(details: SessionDetails): SessionSummary {
  const { id, title, type, status, startsAt, durationMinutes, capacity, bookedCount, visibility, coach, location, updatedAt } =
    details
  return { id, title, type, status, startsAt, durationMinutes, capacity, bookedCount, visibility, coach, location, updatedAt }
}

const blankToNull = (value: string | null | undefined) => value?.trim() || null

/** In-memory store seeded from fixtures, with timestamps rebased from `referenceNow` to `now`. */
export function createDb({ now = Date.now(), empty = false }: { now?: number; empty?: boolean } = {}) {
  const offsetMs = now - Date.parse(clock.referenceNow)
  const sessions: SessionDetails[] = empty
    ? []
    : sessionsFixture.data.map((s) => {
        const details = detailsById.get(s.id)
        if (!details) throw new Error(`Missing details fixture for ${s.id}`)
        return rebaseDetails(details, offsetMs)
      })
  const coaches: CoachSummary[] = coachesFixture.data
  let nextId = 1

  return {
    coaches,
    list({ query, status }: { query: string; status: SessionStatus | '' }): SessionSummary[] {
      const q = query.trim().toLowerCase()
      return sessions
        .filter((s) => !status || s.status === status)
        .filter(
          (s) =>
            !q ||
            [s.title, s.coach.name, s.location.name, s.location.address].some((v) => v.toLowerCase().includes(q)),
        )
        .map(toSummary)
    },
    get(id: string): SessionDetails | undefined {
      return sessions.find((s) => s.id === id)
    },
    /** Assumes `req` was validated by the handler. */
    create(req: CreateSessionRequest, coach: CoachSummary): SessionDetails {
      const timestamp = new Date().toISOString()
      const session: SessionDetails = {
        id: `ses_new_${nextId++}`,
        title: req.title.trim(),
        type: req.type,
        status: 'scheduled',
        startsAt: new Date(req.startsAt).toISOString(),
        durationMinutes: req.durationMinutes,
        capacity: req.capacity,
        bookedCount: 0,
        visibility: req.visibility,
        coach,
        location: { name: req.locationName.trim(), address: req.locationAddress.trim() },
        updatedAt: timestamp,
        description: blankToNull(req.description),
        trainerNotes: blankToNull(req.trainerNotes),
        createdAt: timestamp,
        cancellation: null,
      }
      sessions.push(session)
      return session
    },
  }
}

export type MockDb = ReturnType<typeof createDb>
