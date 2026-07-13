import { describe, it, expect } from 'vitest'
import { parseUtc, localDateTime, localDate, localTime, isToday, localSmart, isWithinLastHours } from '../datetime'

const pad = (n: number) => String(n).padStart(2, '0')

describe('parseUtc', () => {
  it('parses a SQLite UTC datetime string as UTC', () => {
    const d = parseUtc('2026-07-12 20:21:00')!
    expect(d.getTime()).toBe(Date.UTC(2026, 6, 12, 20, 21, 0))
  })
  it('accepts an existing Z or offset without double-appending', () => {
    expect(parseUtc('2026-07-12T20:21:00Z')!.getTime()).toBe(Date.UTC(2026, 6, 12, 20, 21, 0))
  })
  it('returns null for empty or invalid input', () => {
    expect(parseUtc(null)).toBeNull()
    expect(parseUtc('')).toBeNull()
    expect(parseUtc('not a date')).toBeNull()
  })
})

describe('localDateTime', () => {
  it('formats in the local timezone (consistent with the parsed Date)', () => {
    const ts = '2026-07-12 20:21:45'
    const d = parseUtc(ts)!
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    expect(localDateTime(ts)).toBe(expected)
  })
  it('includes seconds when asked', () => {
    expect(localDateTime('2026-07-12 20:21:45', { seconds: true })).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
  it('is empty for null or invalid', () => {
    expect(localDateTime(null)).toBe('')
    expect(localDateTime('nope')).toBe('')
  })
})

describe('localDate / localTime', () => {
  it('formats the date and time parts separately', () => {
    expect(localDate('2020-01-02 03:04:05')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(localTime('2020-01-02 03:04:05')).toMatch(/^\d{2}:\d{2}$/)
    expect(localTime('2020-01-02 03:04:05', { seconds: true })).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(localDate(null)).toBe('')
    expect(localTime(null)).toBe('')
  })
})

describe('isToday / localSmart', () => {
  const now = new Date()
  const utcNow = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
  it('recognizes a timestamp from today and shows time-only', () => {
    expect(isToday(utcNow)).toBe(true)
    expect(localSmart(utcNow)).toMatch(/^\d{2}:\d{2}$/)
  })
  it('shows date-only for a non-today timestamp', () => {
    expect(isToday('2020-01-01 12:00:00')).toBe(false)
    expect(localSmart('2020-01-01 12:00:00')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('is false/empty for null', () => {
    expect(isToday(null)).toBe(false)
    expect(localSmart(null)).toBe('')
  })
})

describe('isWithinLastHours', () => {
  const now = new Date()
  const utcNow = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
  it('is true for a recent timestamp, false for an old one', () => {
    expect(isWithinLastHours(utcNow, 24)).toBe(true)
    expect(isWithinLastHours('2000-01-01 00:00:00', 24)).toBe(false)
    expect(isWithinLastHours(null, 24)).toBe(false)
  })
})
