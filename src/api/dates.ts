// The only place that parses or formats timestamps. Display uses the user's locale and timezone.

const formatter = (options: Intl.DateTimeFormatOptions) => {
  const format = new Intl.DateTimeFormat(undefined, options)
  return (iso: string) => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? '—' : format.format(date)
  }
}

export const formatDateTime = formatter({
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
export const formatLongDateTime = formatter({ dateStyle: 'full', timeStyle: 'short' })
export const formatTime = formatter({ hour: '2-digit', minute: '2-digit' })

export function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString()
}

/** Local `YYYY-MM-DD` + `HH:mm` from date/time inputs → UTC ISO string, or null when incomplete/invalid. */
export function toStartsAt(date: string, time: string): string | null {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  if ([y, m, d, h, min].some((n) => !Number.isInteger(n))) return null
  const local = new Date(y, m - 1, d, h, min)
  return Number.isNaN(local.getTime()) ? null : local.toISOString()
}

export function isFuture(iso: string, now: number): boolean {
  return Date.parse(iso) > now
}

/** Today's local date as `YYYY-MM-DD`, for `<input type="date" min>`. */
export function todayLocal(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
