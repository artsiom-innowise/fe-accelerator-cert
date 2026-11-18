import type { ReactNode } from 'react'

interface FieldProps {
  id: string
  label: string
  required?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
}

export function Field({ id, label, required = false, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span className="field__required"> (required)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={id} error={error} />
    </div>
  )
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className="field__error">
      <span aria-hidden="true">⚠</span> {error}
    </p>
  ) : null
}
