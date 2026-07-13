import { defineStore } from 'pinia'

export interface Toast { message: string; undoPayload?: any; undoAction?: () => any }
let toastTimer: ReturnType<typeof setTimeout> | undefined
let flashTimer: ReturnType<typeof setTimeout> | undefined

// Resizable project sidebar width, persisted across sessions in localStorage.
const SIDEBAR_MIN = 176, SIDEBAR_MAX = 460, SIDEBAR_DEFAULT = 236
const clampWidth = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w) || SIDEBAR_DEFAULT))
function loadSidebarWidth(): number {
  try { const v = Number(localStorage.getItem('up-sidebar-width')); return v ? clampWidth(v) : SIDEBAR_DEFAULT } catch { return SIDEBAR_DEFAULT }
}
function saveSidebarWidth(w: number) { try { localStorage.setItem('up-sidebar-width', String(w)) } catch { /* ignore */ } }

// Resizable task-detail-modal left (checklist) column; the editor + preview split the
// remainder equally. Persisted across sessions in localStorage, like the sidebar.
const TASKLEFT_MIN = 170, TASKLEFT_MAX = 560, TASKLEFT_DEFAULT = 220
const clampTaskLeft = (w: number) => Math.min(TASKLEFT_MAX, Math.max(TASKLEFT_MIN, Math.round(w) || TASKLEFT_DEFAULT))
function loadTaskLeftWidth(): number {
  try { const v = Number(localStorage.getItem('up-taskmodal-left-width')); return v ? clampTaskLeft(v) : TASKLEFT_DEFAULT } catch { return TASKLEFT_DEFAULT }
}
function saveTaskLeftWidth(w: number) { try { localStorage.setItem('up-taskmodal-left-width', String(w)) } catch { /* ignore */ } }

export const useUiStore = defineStore('ui', {
  state: () => ({
    viewMode: 'kanban' as 'kanban' | 'archive',
    openTaskId: null as number | null,
    settingsOpen: false,
    harnessPromptOpen: false,
    search: '',
    toast: null as Toast | null,
    sidebarWidth: loadSidebarWidth(),
    // Task-detail-modal checklist (left) column width; drag-adjustable, persisted.
    taskModalLeftWidth: loadTaskLeftWidth(),
    // Card id to briefly flash on the board (e.g. after its detail modal closes).
    flashTaskId: null as number | null,
  }),
  actions: {
    // Set + persist the sidebar width (clamped to a sane range).
    setSidebarWidth(px: number) { this.sidebarWidth = clampWidth(px); saveSidebarWidth(this.sidebarWidth) },
    // Set + persist the task-modal checklist column width (clamped).
    setTaskModalLeftWidth(px: number) { this.taskModalLeftWidth = clampTaskLeft(px); saveTaskLeftWidth(this.taskModalLeftWidth) },
    // Briefly mark a card for a highlight flash; auto-clears (after the ~0.52s
    // animation) so it can re-fire on the next close.
    flashTask(id: number) {
      this.flashTaskId = id
      clearTimeout(flashTimer)
      flashTimer = setTimeout(() => { if (this.flashTaskId === id) this.flashTaskId = null }, 700)
    },
    // Show a transient toast that auto-dismisses after 5s. Pass undoPayload (restored
    // via tasks.restore) OR undoAction (a custom undo callback) to render an Undo button.
    showToast(message: string, undoPayload?: any, undoAction?: () => any) {
      this.toast = { message, undoPayload, undoAction }
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { this.toast = null }, 5000)
    },
    dismissToast() { clearTimeout(toastTimer); this.toast = null },
  },
})
