import type { ReactNode } from 'react'

/** ARIA wiring for a control rendered inside <Field>. */
export function describe(id: string, { hint, error }: { hint?: ReactNode; error?: string }) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ')
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const
}
