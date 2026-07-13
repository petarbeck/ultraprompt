import { describe, it, expect } from 'vitest'
import { reindex } from '../../lib/reorder'

describe('reindex', () => {
  it('maps ids to sequential positions', () => {
    expect(reindex([30, 10, 20])).toEqual([{ id: 30, position: 0 }, { id: 10, position: 1 }, { id: 20, position: 2 }])
  })
})
