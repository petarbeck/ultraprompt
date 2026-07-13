// SQLite datetime('now') stores timestamps as UTC "YYYY-MM-DD HH:MM:SS" with no zone
// marker. Parse them as UTC and render in the viewer's LOCAL timezone.

export function parseUtc(ts: string | null | undefined): Date | null {
  if (!ts) return null
  const s = ts.trim().replace(' ', 'T')
  const zoned = /[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z'
  const d = new Date(zoned)
  return Number.isNaN(d.getTime()) ? null : d
}

const pad = (n: number) => String(n).padStart(2, '0')

// Local "YYYY-MM-DD". '' for empty/invalid.
export function localDate(ts: string | null | undefined): string {
  const d = parseUtc(ts)
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ''
}

// Local "HH:MM" (add seconds with { seconds: true }). '' for empty/invalid.
export function localTime(ts: string | null | undefined, opts: { seconds?: boolean } = {}): string {
  const d = parseUtc(ts)
  if (!d) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}${opts.seconds ? ':' + pad(d.getSeconds()) : ''}`
}

// Local "YYYY-MM-DD HH:MM" (add seconds with { seconds: true }). '' for empty/invalid.
export function localDateTime(ts: string | null | undefined, opts: { seconds?: boolean } = {}): string {
  const date = localDate(ts)
  return date ? `${date} ${localTime(ts, opts)}` : ''
}

// True when `ts` falls on the viewer's current local calendar day.
export function isToday(ts: string | null | undefined): boolean {
  const d = parseUtc(ts)
  if (!d) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// Compact feed label: just the time if it happened today, otherwise just the date.
export function localSmart(ts: string | null | undefined): string {
  if (!parseUtc(ts)) return ''
  return isToday(ts) ? localTime(ts) : localDate(ts)
}

// True when `ts` falls within the last `hours` hours (used to window the pipeline feed).
export function isWithinLastHours(ts: string | null | undefined, hours: number): boolean {
  const d = parseUtc(ts)
  return d ? Date.now() - d.getTime() < hours * 3600_000 : false
}
