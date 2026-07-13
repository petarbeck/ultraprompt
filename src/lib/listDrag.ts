import { reactive } from 'vue'
import { moveToIndex } from './reorder'

// Pointer-based vertical list reorder — same principles as the kanban drag manager
// (pointerdown/move/up, a movement threshold, insertion index from row midpoints), but
// generic for a settings table. Rows within `container()` must each carry `data-id`.
// Emits `onReorder(orderedIds)` on drop when the order actually changed.
export function useListReorder(opts: {
  container: () => HTMLElement | null
  rowSelector: string
  onReorder: (orderedIds: number[]) => void
  threshold?: number
}) {
  // activeId: the row being dragged (null when idle). overIndex: insertion slot 0..n in
  // the current order (drop line renders before the row at that index; n = at the end).
  const state = reactive<{ activeId: number | null; overIndex: number | null }>({ activeId: null, overIndex: null })
  const threshold = opts.threshold ?? 4

  function rowIds(): number[] {
    const c = opts.container()
    if (!c) return []
    return Array.from(c.querySelectorAll<HTMLElement>(opts.rowSelector)).map(r => Number(r.dataset.id))
  }
  function insertionIndex(y: number): number {
    const c = opts.container()
    if (!c) return 0
    let idx = 0
    for (const r of c.querySelectorAll<HTMLElement>(opts.rowSelector)) {
      const rect = r.getBoundingClientRect()
      if (y > rect.top + rect.height / 2) idx++
    }
    return idx
  }

  function onPointerDown(e: PointerEvent, id: number) {
    if (e.button !== 0) return
    e.preventDefault()
    const startY = e.clientY
    const ids = rowIds()
    let activated = false

    const move = (ev: PointerEvent) => {
      if (!activated) {
        if (Math.abs(ev.clientY - startY) <= threshold) return
        activated = true
        state.activeId = id
        document.body.style.userSelect = 'none'
      }
      state.overIndex = insertionIndex(ev.clientY)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
      if (activated && state.activeId != null && state.overIndex != null) {
        const next = moveToIndex(ids, state.activeId, state.overIndex)
        if (next.some((x, i) => x !== ids[i])) opts.onReorder(next)
      }
      state.activeId = null
      state.overIndex = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return { state, onPointerDown }
}
