import type { ReactNode, Ref } from 'react'

interface InlineAlertProps {
  title: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  ref?: Ref<HTMLDivElement>
  children?: ReactNode
}

export function InlineAlert({ title, message, onRetry, retryLabel = 'Retry', ref, children }: InlineAlertProps) {
  return (
    <div ref={ref} role="alert" className="alert" tabIndex={-1}>
      <p className="alert__title">
        <span aria-hidden="true">⚠</span> {title}
      </p>
      {message && message !== title ? <p>{message}</p> : null}
      {onRetry || children ? (
        <div className="actions">
          {onRetry ? (
            <button type="button" className="button" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}
