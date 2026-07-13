import { describe, it, expect } from 'vitest'
import { insertionIndexFromMidpoints, exceedsThreshold } from '../drag'

describe('insertionIndexFromMidpoints', () => {
  it('returns 0 for an empty lane', () => {
    expect(insertionIndexFromMidpoints([], 100)).toBe(0)
  })
  it('returns 0 when the cursor is above every card midpoint', () => {
    expect(insertionIndexFromMidpoints([50, 150, 250], 10)).toBe(0)
  })
  it('returns n when the cursor is below every card midpoint', () => {
    expect(insertionIndexFromMidpoints([50, 150, 250], 300)).toBe(3)
  })
  it('inserts after cards whose midpoint the cursor has passed', () => {
    // between card0 (mid 50) and card1 (mid 150) -> index 1
    expect(insertionIndexFromMidpoints([50, 150, 250], 100)).toBe(1)
    // between card1 (mid 150) and card2 (mid 250) -> index 2
    expect(insertionIndexFromMidpoints([50, 150, 250], 200)).toBe(2)
  })
  it('treats a cursor exactly on a midpoint as before that card', () => {
    // midpoints strictly below 150 = {50} -> index 1
    expect(insertionIndexFromMidpoints([50, 150, 250], 150)).toBe(1)
  })
})

describe('exceedsThreshold', () => {
  it('is false for no movement', () => {
    expect(exceedsThreshold(0, 0)).toBe(false)
  })
  it('is false below the default 4px threshold', () => {
    expect(exceedsThreshold(3, 0)).toBe(false)
    expect(exceedsThreshold(0, 3)).toBe(false)
  })
  it('is false exactly at the threshold (must exceed)', () => {
    expect(exceedsThreshold(4, 0)).toBe(false)
  })
  it('is true beyond the threshold on one axis', () => {
    expect(exceedsThreshold(5, 0)).toBe(true)
  })
  it('is true beyond the threshold on the diagonal', () => {
    // hypot(3,3) ~= 4.24 > 4
    expect(exceedsThreshold(3, 3)).toBe(true)
  })
})
