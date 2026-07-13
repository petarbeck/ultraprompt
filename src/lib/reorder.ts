export function reindex(orderedIds: number[]): { id: number; position: number }[] {
  return orderedIds.map((id, i) => ({ id, position: i }))
}

/**
 * Move `activeId` to `insertIndex` within `ids` (a flat, ungrouped list). `insertIndex`
 * is a slot in the ORIGINAL order (0..n, i.e. "before the row currently at that index").
 * Removing the active item first shifts a later target down one. Used by the settings
 * tables' pointer-drag row reordering.
 */
export function moveToIndex(ids: number[], activeId: number, insertIndex: number): number[] {
  const from = ids.indexOf(activeId)
  if (from === -1) return ids.slice()
  const next = ids.slice()
  next.splice(from, 1)
  let to = from < insertIndex ? insertIndex - 1 : insertIndex
  to = Math.max(0, Math.min(to, next.length))
  next.splice(to, 0, activeId)
  return next
}

/**
 * Compute the new persisted order of a lane after dropping `dragged` at `dropIndex`
 * within the lane's displayed order. Favorites are always re-segregated to the front
 * (they render pinned on top), so a card only reorders relative to its own group.
 * `dropIndex` is an index into `laneTasks` (the displayed order, dragged card included
 * when it's already in this lane). Returns the ordered ids to persist as positions 0..N-1.
 */
export function computeLaneOrder(
  laneTasks: { id: number; isFavorite: boolean }[],
  dragged: { id: number; isFavorite: boolean },
  dropIndex: number,
): number[] {
  const draggedIdx = laneTasks.findIndex(t => t.id === dragged.id)
  const without = laneTasks.filter(t => t.id !== dragged.id)
  // if the dragged card was before the drop point, removing it shifts the target down one
  let insertAt = draggedIdx !== -1 && draggedIdx < dropIndex ? dropIndex - 1 : dropIndex
  insertAt = Math.max(0, Math.min(insertAt, without.length))
  const flat = [...without.slice(0, insertAt), dragged, ...without.slice(insertAt)]
  const favs = flat.filter(t => t.isFavorite).map(t => t.id)
  const norms = flat.filter(t => !t.isFavorite).map(t => t.id)
  return [...favs, ...norms]
}
