import { describe, it, expect } from 'vitest'
import { slugifyFirstLine } from '../slugify'

describe('slugifyFirstLine', () => {
  it('slugifies the first non-empty line', () => {
    expect(slugifyFirstLine('Add OAuth rotation\nmore')).toBe('add-oauth-rotation')
  })
  it('strips leading heading marks', () => {
    expect(slugifyFirstLine('## Hello World')).toBe('hello-world')
  })
  it('skips blank leading lines', () => {
    expect(slugifyFirstLine('\n\n  Real line')).toBe('real-line')
  })
  it('falls back to "task" when empty', () => {
    expect(slugifyFirstLine('   ')).toBe('task')
  })
  it('caps length at 60 chars', () => {
    expect(slugifyFirstLine('a'.repeat(100)).length).toBeLessThanOrEqual(60)
  })
  it('cap on a dash boundary leaves no trailing dash', () => {
    // 59 'a' + space + 10 'b' -> slice(0,60) lands the 60th char on the dash
    const slug = slugifyFirstLine('a'.repeat(59) + ' ' + 'b'.repeat(10))
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug).not.toMatch(/-$/)
    expect(slug).toBe('a'.repeat(59))
  })
})
