import type { SessionStatus } from '../api/types'
import { STATUS_META } from '../features/sessions/labels'

export function StatusBadge({ status }: { status: SessionStatus }) {
  const { label, symbol } = STATUS_META[status]
  return (
    <span className={`badge badge--${status}`}>
      <span aria-hidden="true">{symbol}</span> {label}
    </span>
  )
}
