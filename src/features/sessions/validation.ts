import { isFuture, toStartsAt } from '../../api/dates'
import type { CreateSessionRequest, SessionStatus, SessionSummary, SessionType, Visibility } from '../../api/types'

export interface CreateValues {
  title: string
  type: SessionType
  date: string
  time: string
  durationMinutes: string
  coachId: string
  locationName: string
  locationAddress: string
  capacity: string
  visibility: Visibility
  description: string
  trainerNotes: string
}

/** Error keys match CreateSessionRequest so server `fieldErrors` map directly; date + time share `startsAt`. */
export type CreateErrorKey = Exclude<keyof CreateValues, 'date' | 'time'> | 'startsAt'
export type CreateErrors = Partial<Record<CreateErrorKey, string>>

/** Display order, used to focus the first invalid control. */
export const ERROR_ORDER: readonly CreateErrorKey[] = [
  'title',
  'type',
  'startsAt',
  'durationMinutes',
  'coachId',
  'locationName',
  'locationAddress',
  'capacity',
  'visibility',
  'description',
  'trainerNotes',
]

export const TRAINER_NOTES_MAX = 500

export const initialCreateValues: CreateValues = {
  title: '',
  type: 'training',
  date: '',
  time: '',
  durationMinutes: '60',
  coachId: '',
  locationName: '',
  locationAddress: '',
  capacity: '',
  visibility: 'public',
  description: '',
  trainerNotes: '',
}

function lengthError(value: string, min: number, max: number, label: string) {
  const length = value.trim().length
  if (length === 0) return `Enter a ${label}.`
  if (length < min || length > max) return `Use ${min} to ${max} characters for the ${label}.`
  return undefined
}

function integerError(value: string, min: number, max: number, message: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return message
  const n = Number(trimmed)
  return n < min || n > max ? message : undefined
}

export function validateCreate(values: CreateValues, now = Date.now()): CreateErrors {
  const startsAt = toStartsAt(values.date, values.time)
  const errors: CreateErrors = {
    title: lengthError(values.title, 3, 80, 'title'),
    startsAt: !startsAt
      ? 'Choose a date and start time.'
      : !isFuture(startsAt, now)
        ? 'Choose a start time in the future.'
        : undefined,
    durationMinutes: integerError(values.durationMinutes, 30, 240, 'Enter a whole number of minutes from 30 to 240.'),
    coachId: values.coachId ? undefined : 'Choose a coach.',
    locationName: lengthError(values.locationName, 2, 80, 'location name'),
    locationAddress: lengthError(values.locationAddress, 3, 120, 'location address'),
    capacity: integerError(values.capacity, 1, 100, 'Enter a whole number of places from 1 to 100.'),
    trainerNotes:
      values.trainerNotes.length > TRAINER_NOTES_MAX
        ? `Keep trainer notes to ${TRAINER_NOTES_MAX} characters or fewer.`
        : undefined,
  }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as CreateErrors
}

/** Assumes `validateCreate` returned no errors. */
export function toCreateRequest(values: CreateValues): CreateSessionRequest {
  return {
    title: values.title.trim(),
    type: values.type,
    startsAt: toStartsAt(values.date, values.time) ?? '',
    durationMinutes: Number(values.durationMinutes.trim()),
    coachId: values.coachId,
    locationName: values.locationName.trim(),
    locationAddress: values.locationAddress.trim(),
    capacity: Number(values.capacity.trim()),
    visibility: values.visibility,
    description: values.description.trim() || null,
    trainerNotes: values.trainerNotes.trim() || null,
  }
}

/** Mirrors the list search (title, coach, location) to decide whether active filters hide a session. */
export function matchesFilters(session: SessionSummary, query: string, status: SessionStatus | ''): boolean {
  if (status && session.status !== status) return false
  const q = query.trim().toLowerCase()
  return (
    !q ||
    [session.title, session.coach.name, session.location.name, session.location.address].some((v) =>
      v.toLowerCase().includes(q),
    )
  )
}
