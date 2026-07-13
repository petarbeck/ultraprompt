import { describe, it, expect } from 'vitest'
import { computeLaneOrder, moveToIndex } from '../reorder'

describe('moveToIndex', () => {
  it('moves an item down (later insert slot shifts for the removal)', () => {
    expect(moveToIndex([1, 2, 3], 1, 2)).toEqual([2, 1, 3])   // 1 dropped before old index 2
    expect(moveToIndex([1, 2, 3], 1, 3)).toEqual([2, 3, 1])   // to the end
  })
  it('moves an item up', () => {
    expect(moveToIndex([1, 2, 3], 3, 0)).toEqual([3, 1, 2])
    expect(moveToIndex([1, 2, 3], 3, 1)).toEqual([1, 3, 2])
  })
  it('is a no-op when dropped on its own slot', () => {
    expect(moveToIndex([1, 2, 3], 2, 1)).toEqual([1, 2, 3])
    expect(moveToIndex([1, 2, 3], 2, 2)).toEqual([1, 2, 3])
  })
  it('returns a copy and tolerates an unknown id', () => {
    expect(moveToIndex([1, 2, 3], 9, 0)).toEqual([1, 2, 3])
  })
})

const N = (id: number) => ({ id, isFavorite: false })
const F = (id: number) => ({ id, isFavorite: true })

describe('computeLaneOrder', () => {
  it('moves a card down within a lane', () => {
    // [1,2,3], drag 1 to slot 2 -> [2,1,3]
    expect(computeLaneOrder([N(1), N(2), N(3)], N(1), 2)).toEqual([2, 1, 3])
  })
  it('moves a card up within a lane', () => {
    // [1,2,3], drag 3 to slot 1 -> [1,3,2]
    expect(computeLaneOrder([N(1), N(2), N(3)], N(3), 1)).toEqual([1, 3, 2])
  })
  it('inserts a card dragged from another lane at a slot', () => {
    // lane [1,2], drag 9 (not present) to slot 1 -> [1,9,2]
    expect(computeLaneOrder([N(1), N(2)], N(9), 1)).toEqual([1, 9, 2])
  })
  it('keeps favorites pinned above normals regardless of drop slot', () => {
    // [F1,F2,N3,N4], drag N4 to the very top -> favorites stay first, N4 leads the normals
    expect(computeLaneOrder([F(1), F(2), N(3), N(4)], N(4), 0)).toEqual([1, 2, 4, 3])
  })
  it('reorders within the favorites group', () => {
    // [F1,F2,N3], drag F1 to after F2 -> [2,1,3]
    expect(computeLaneOrder([F(1), F(2), N(3)], F(1), 2)).toEqual([2, 1, 3])
  })
  it('a normal dropped among favorites lands at the top of the normals', () => {
    // [F1,N2,N3], drag N3 to slot 1 (just under F1) -> favorites first, N3 leads normals
    expect(computeLaneOrder([F(1), N(2), N(3)], N(3), 1)).toEqual([1, 3, 2])
  })
  it('clamps an out-of-range drop slot', () => {
    expect(computeLaneOrder([N(1), N(2)], N(1), 99)).toEqual([2, 1])
  })
})
