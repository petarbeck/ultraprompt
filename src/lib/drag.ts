import { reactive } from 'vue'

// Where a dragged card would land. `null` = not over any drop target.
export type DropTarget =
  | { type: 'lane'; laneId: number; index: number }
  | { type: 'pipeline' }
  | { type: 'trash' }
  | null

interface DragState {
  active: boolean          // true only once movement exceeds the threshold
  taskId: number | null    // the card being dragged (set from pointerdown)
  preview: string          // body text shown in the floating ghost
  x: number                // current pointer position (for the ghost)
  y: number
  drop: DropTarget         // live hit-test result under the cursor
}

// Module-singleton reactive state; components read it to render the ghost,
// the dragged-card dimming, and the per-lane insertion line.
export const dragState = reactive<DragState>({
  active: false, taskId: null, preview: '', x: 0, y: 0, drop: null,
})

export interface DragHandlers {
  onDrop: (taskId: number, drop: DropTarget) => void
  onTap: (taskId: number) => void
}
let handlers: DragHandlers = { onDrop: () => {}, onTap: () => {} }
// Wired once from AppShell (always mounted) so the manager stays decoupled
// from the stores.
export function setDragHandlers(h: DragHandlers) { handlers = h }

const DRAG_THRESHOLD = 4

/** Movement (dx,dy) from the pointerdown origin strictly exceeds the threshold. */
export function exceedsThreshold(dx: number, dy: number, threshold = DRAG_THRESHOLD): boolean {
  return Math.hypot(dx, dy) > threshold
}

/**
 * Insertion index into a lane's displayed card list, given the cards' vertical
 * midpoints (in display order, ascending) and the cursor Y. Equals the count of
 * cards whose midpoint the cursor has passed (strictly below). A cursor exactly
 * on a midpoint counts as "before" that card. Result is in 0..midpointsY.length.
 */
export function insertionIndexFromMidpoints(midpointsY: number[], cursorY: number): number {
  let i = 0
  while (i < midpointsY.length && cursorY > midpointsY[i]) i++
  return i
}

let startX = 0, startY = 0, allow = true

// Suppress native text selection for the whole gesture. WKWebView (unlike Blink)
// anchors a selection on mousedown-drag even when the card has user-select:none,
// so it "selects everything behind" the drag — we disable selection on the root
// while dragging and clear any range that slipped in.
function setSelecting(on: boolean) {
  const s = document.documentElement.style as CSSStyleDeclaration & { webkitUserSelect?: string }
  s.userSelect = on ? 'none' : ''
  s.webkitUserSelect = on ? 'none' : ''
}

function hitTest(x: number, y: number): DropTarget {
  const el = document.elementFromPoint(x, y)
  const dropEl = el?.closest('[data-drop]') as HTMLElement | null
  if (!dropEl) return null
  const type = dropEl.dataset.drop
  if (type === 'trash') return { type: 'trash' }
  if (type === 'pipeline') return { type: 'pipeline' }
  if (type === 'lane') {
    const laneId = Number(dropEl.dataset.laneId)
    const midpoints = Array.from(dropEl.querySelectorAll<HTMLElement>('.card')).map(c => {
      const r = c.getBoundingClientRect()
      return r.top + r.height / 2
    })
    return { type: 'lane', laneId, index: insertionIndexFromMidpoints(midpoints, y) }
  }
  return null
}

function onMove(e: PointerEvent) {
  dragState.x = e.clientX
  dragState.y = e.clientY
  if (!dragState.active) {
    if (allow && exceedsThreshold(e.clientX - startX, e.clientY - startY)) {
      dragState.active = true
      window.getSelection()?.removeAllRanges() // drop any range that formed pre-threshold
    } else {
      return
    }
  }
  dragState.drop = hitTest(e.clientX, e.clientY)
}

function teardown() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
  setSelecting(false)
}

function reset() {
  dragState.active = false
  dragState.taskId = null
  dragState.preview = ''
  dragState.drop = null
}

function onUp() {
  teardown()
  const wasDrag = dragState.active
  const id = dragState.taskId
  const drop = dragState.drop
  reset()
  if (id === null) return
  if (wasDrag) handlers.onDrop(id, drop)
  else handlers.onTap(id)
}

function onCancel() {
  teardown()
  reset()
}

/**
 * Begin tracking a pointer gesture on a card (called from the card's
 * pointerdown). Window listeners keep the drag alive outside the card. A gesture
 * that never crosses the threshold — or one started with allowDrag=false (e.g.
 * while a search filter is active) — resolves as a tap (onTap) on pointerup.
 */
export function startDrag(taskId: number, preview: string, e: PointerEvent, allowDrag = true) {
  if (e.button !== 0) return
  dragState.taskId = taskId
  dragState.preview = preview
  dragState.x = e.clientX
  dragState.y = e.clientY
  dragState.drop = null
  dragState.active = false
  startX = e.clientX
  startY = e.clientY
  allow = allowDrag
  setSelecting(true)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
}
