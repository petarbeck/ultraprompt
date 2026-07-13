import { describe, it, expect } from 'vitest'
import { matchesQuery } from '../search'

describe('matchesQuery', () => {
  it('empty query matches everything', () => {
    expect(matchesQuery('anything', '')).toBe(true)
    expect(matchesQuery('anything', '   ')).toBe(true)
  })
  it('case-insensitive substring match', () => {
    expect(matchesQuery('Rotate the OAuth token', 'oauth')).toBe(true)
    expect(matchesQuery('Rotate the OAuth token', 'refresh')).toBe(false)
  })
  it('matches across the whole body (multi-line)', () => {
    expect(matchesQuery('# Title\n\nbody mentions webhook here', 'webhook')).toBe(true)
  })
  it('supports * wildcard (any run)', () => {
    expect(matchesQuery('rotate refresh token', 'rotate*token')).toBe(true)
    expect(matchesQuery('rotate token now', 'rotate*xyz')).toBe(false)
  })
  it('supports ? wildcard (single char)', () => {
    expect(matchesQuery('cat', 'c?t')).toBe(true)
    expect(matchesQuery('coat', 'c?t')).toBe(false)
  })
  it('treats other regex specials literally', () => {
    expect(matchesQuery('price is $5 (net)', '$5 (net)')).toBe(true)
  })
  it('wildcard combined with regex specials (exercises the escaping branch)', () => {
    expect(matchesQuery('price is $5 (net) now', '$5*net')).toBe(true)
    expect(matchesQuery('price is $5 (net) now', '$9*net')).toBe(false)
  })
  it('* wildcard spans newlines in a multi-line body', () => {
    expect(matchesQuery('line one\nline two', 'one*two')).toBe(true)
    expect(matchesQuery('# Rotate tokens\n\nadd refresh flow', 'rotate*refresh')).toBe(true)
  })
})
