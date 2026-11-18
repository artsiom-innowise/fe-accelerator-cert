import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createSession, toApiClientError } from '../../api/client'
import { todayLocal } from '../../api/dates'
import { SESSION_TYPES, type SessionDetails } from '../../api/types'
import { Dialog } from '../../components/Dialog'
import { Field, FieldError } from '../../components/Field'
import { describe } from '../../components/describe'
import { InlineAlert } from '../../components/InlineAlert'
import { useCoaches } from './hooks'
import { TYPE_LABEL, VISIBILITY_LABEL } from './labels'
import {
  ERROR_ORDER,
  initialCreateValues,
  toCreateRequest,
  TRAINER_NOTES_MAX,
  validateCreate,
  type CreateErrorKey,
  type CreateErrors,
  type CreateValues,
} from './validation'

const TITLE_ID = 'create-session-title'
const fieldId = (key: CreateErrorKey) => (key === 'startsAt' ? 'create-date' : `create-${key}`)
const isErrorKey = (key: string): key is CreateErrorKey => (ERROR_ORDER as readonly string[]).includes(key)

interface CreateSessionDialogProps {
  onClose: () => void
  onCreated: (session: SessionDetails) => void
}

export function CreateSessionDialog({ onClose, onCreated }: CreateSessionDialogProps) {
  const coaches = useCoaches()
  const [values, setValues] = useState<CreateValues>(initialCreateValues)
  const [errors, setErrors] = useState<CreateErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<{ title: string; message?: string } | null>(null)
  const pendingRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const [minDate] = useState(() => todayLocal(Date.now()))

  useEffect(() => {
    if (formError) alertRef.current?.focus()
  }, [formError])

  const coachList = coaches.data?.data ?? []
  const coachesReady = coaches.status === 'success' && coachList.length > 0
  const isDirty = values !== initialCreateValues

  function update<K extends keyof CreateValues>(key: K, value: CreateValues[K]) {
    const next = { ...values, [key]: value }
    setValues(next)
    // Re-validate only after the first submit so pristine fields never show errors.
    if (submitted) setErrors(validateCreate(next))
  }

  function focusFirstError(found: CreateErrors) {
    const first = ERROR_ORDER.find((key) => found[key])
    if (first) formRef.current?.querySelector<HTMLElement>(`#${fieldId(first)}`)?.focus()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current || !coachesReady) return
    setSubmitted(true)
    setFormError(null)
    const found = validateCreate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstError(found)
      return
    }

    pendingRef.current = true
    setPending(true)
    try {
      onCreated(await createSession(toCreateRequest(values)))
    } catch (error) {
      const apiError = toApiClientError(error)
      const entries = Object.entries(apiError.fieldErrors ?? {})
      const known = Object.fromEntries(entries.filter(([key]) => isErrorKey(key))) as CreateErrors
      const unknown = entries.filter(([key]) => !isErrorKey(key))
      if (entries.length > 0 && unknown.length === 0) {
        setErrors(known)
        focusFirstError(known)
      } else {
        setErrors(known)
        setFormError({
          title:
            entries.length > 0
              ? 'Some fields need attention.'
              : `${apiError.message} Your entries are kept, so you can try again.`,
          message: unknown.length > 0 ? unknown.map(([key, msg]) => `${key}: ${msg}`).join(' ') : undefined,
        })
      }
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  function requestClose() {
    if (pendingRef.current) return
    if (isDirty && !window.confirm('Discard this new session?')) return
    onClose()
  }

  const text = (key: 'title' | 'locationName' | 'locationAddress') => ({
    name: key,
    value: values[key],
    onChange: (event: { target: { value: string } }) => update(key, event.target.value),
  })

  return (
    <Dialog titleId={TITLE_ID} onClose={requestClose} onDismiss={onClose} size="wide">
      <header className="dialog__header">
        <h2 id={TITLE_ID} tabIndex={-1}>
          Create session
        </h2>
        <button type="button" className="icon-button" aria-label="Close create session" onClick={requestClose} disabled={pending}>
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <form ref={formRef} className="dialog__form" noValidate onSubmit={handleSubmit}>
        <div className="dialog__body form-grid">
          {formError ? (
            <InlineAlert ref={alertRef} title={formError.title} message={formError.message} />
          ) : null}

          <Field id="create-title" label="Title" required error={errors.title}>
            <input
              type="text"
              autoComplete="off"
              data-initial-focus
              {...text('title')}
              {...describe('create-title', { error: errors.title })}
            />
          </Field>

          <Field id="create-type" label="Session type" error={errors.type}>
            <select
              name="type"
              value={values.type}
              onChange={(event) => update('type', event.target.value as CreateValues['type'])}
              {...describe('create-type', { error: errors.type })}
            >
              {SESSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>

          <fieldset className="field span-2">
            <legend>
              Start <span className="field__required">(required)</span>
            </legend>
            <div className="pair">
              <div className="field">
                <label htmlFor="create-date">Date</label>
                <input
                  type="date"
                  name="date"
                  min={minDate}
                  value={values.date}
                  onChange={(event) => update('date', event.target.value)}
                  {...describe('create-date', { error: errors.startsAt })}
                  aria-describedby={errors.startsAt ? 'create-startsAt-error' : undefined}
                />
              </div>
              <div className="field">
                <label htmlFor="create-time">Start time</label>
                <input
                  type="time"
                  name="time"
                  value={values.time}
                  onChange={(event) => update('time', event.target.value)}
                  {...describe('create-time', { error: errors.startsAt })}
                  aria-describedby={errors.startsAt ? 'create-startsAt-error' : undefined}
                />
              </div>
            </div>
            <FieldError id="create-startsAt" error={errors.startsAt} />
          </fieldset>

          <Field id="create-durationMinutes" label="Duration (minutes)" required hint="30–240" error={errors.durationMinutes}>
            <input
              type="number"
              name="durationMinutes"
              inputMode="numeric"
              min={30}
              max={240}
              step={15}
              value={values.durationMinutes}
              onChange={(event) => update('durationMinutes', event.target.value)}
              {...describe('create-durationMinutes', { hint: '30–240', error: errors.durationMinutes })}
            />
          </Field>

          <Field id="create-capacity" label="Capacity" required hint="1–100 places" error={errors.capacity}>
            <input
              type="number"
              name="capacity"
              inputMode="numeric"
              min={1}
              max={100}
              value={values.capacity}
              onChange={(event) => update('capacity', event.target.value)}
              {...describe('create-capacity', { hint: '1–100 places', error: errors.capacity })}
            />
          </Field>

          <div className="span-2">
            <Field id="create-coachId" label="Coach" required error={errors.coachId}>
              <select
                name="coachId"
                value={values.coachId}
                disabled={!coachesReady}
                onChange={(event) => update('coachId', event.target.value)}
                {...describe('create-coachId', { error: errors.coachId })}
              >
                <option value="">
                  {coaches.status === 'loading'
                    ? 'Loading coaches…'
                    : coaches.status === 'success' && coachList.length === 0
                      ? 'No coaches available'
                      : 'Choose a coach'}
                </option>
                {coachList.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name}
                  </option>
                ))}
              </select>
            </Field>
            {coaches.status === 'error' ? (
              <InlineAlert
                title={`${coaches.error?.message ?? "Coach choices can't be loaded."} You can't create a session until they load.`}
                onRetry={coaches.retry}
                retryLabel="Retry loading coaches"
              />
            ) : null}
          </div>

          <Field id="create-locationName" label="Location name" required error={errors.locationName}>
            <input
              type="text"
              autoComplete="off"
              {...text('locationName')}
              {...describe('create-locationName', { error: errors.locationName })}
            />
          </Field>

          <Field id="create-locationAddress" label="Location address" required error={errors.locationAddress}>
            <input
              type="text"
              autoComplete="street-address"
              {...text('locationAddress')}
              {...describe('create-locationAddress', { error: errors.locationAddress })}
            />
          </Field>

          <fieldset className="field span-2">
            <legend>Visibility</legend>
            <div className="radios">
              {(['public', 'invite-only'] as const).map((visibility) => (
                <label key={visibility} className="radio">
                  <input
                    type="radio"
                    id={visibility === 'public' ? 'create-visibility' : undefined}
                    aria-describedby={errors.visibility ? 'create-visibility-error' : undefined}
                    name="visibility"
                    value={visibility}
                    checked={values.visibility === visibility}
                    onChange={() => update('visibility', visibility)}
                  />
                  {VISIBILITY_LABEL[visibility]}
                </label>
              ))}
            </div>
            <FieldError id="create-visibility" error={errors.visibility} />
          </fieldset>

          <div className="span-2">
            <Field id="create-description" label="Description (optional)" error={errors.description}>
              <textarea
                name="description"
                rows={3}
                value={values.description}
                onChange={(event) => update('description', event.target.value)}
                {...describe('create-description', { error: errors.description })}
              />
            </Field>
          </div>

          <div className="span-2">
            <Field
              id="create-trainerNotes"
              label="Trainer notes (optional)"
              hint={`${values.trainerNotes.length} / ${TRAINER_NOTES_MAX}`}
              error={errors.trainerNotes}
            >
              <textarea
                name="trainerNotes"
                rows={3}
                value={values.trainerNotes}
                onChange={(event) => update('trainerNotes', event.target.value)}
                {...describe('create-trainerNotes', { hint: true, error: errors.trainerNotes })}
              />
            </Field>
          </div>
        </div>

        <footer className="dialog__footer">
          {!coachesReady && coaches.status !== 'loading' ? (
            <p id="create-submit-reason" className="muted small footer__reason">
              Coach choices are required before you can create a session.
            </p>
          ) : null}
          <button type="button" className="button button--secondary" onClick={requestClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={pending || !coachesReady}
            aria-describedby={!coachesReady && coaches.status !== 'loading' ? 'create-submit-reason' : undefined}
          >
            {pending ? 'Creating…' : 'Create session'}
          </button>
        </footer>
      </form>
      <p role="status" className="visually-hidden">
        {pending ? 'Creating session…' : ''}
      </p>
    </Dialog>
  )
}
