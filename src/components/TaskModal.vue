<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ChecklistColumn from './ChecklistColumn.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import MarkdownPreview from './MarkdownPreview.vue'
import { useTasksStore } from '../stores/tasks'
import { useProjectsStore } from '../stores/projects'
import { useLanesStore } from '../stores/lanes'
import { useChecklistStore } from '../stores/checklist'
import { useUiStore } from '../stores/ui'
import { localDateTime } from '../lib/datetime'
import { TRASH, ARCHIVE, BOLT, COPY, STAR, STAR_FILLED } from './icons'
import { useArmedConfirm } from '../lib/armedConfirm'

const tasks = useTasksStore(); const projects = useProjectsStore(); const lanes = useLanesStore()
const checklist = useChecklistStore(); const ui = useUiStore()
const task = computed(() => tasks.boardTasks.find(t => t.id === ui.openTaskId)
  ?? tasks.archivedTasks.find(t => t.id === ui.openTaskId)
  ?? tasks.pipelined.find(t => t.id === ui.openTaskId) ?? null)
const locked = computed(() => task.value?.isLocked ?? false)
// delete / archive / send require a second click to confirm.
const { armed, confirm, reset } = useArmedConfirm()

// Header actions. Each closes the modal afterwards. Archive + send only apply to
// an active (unlocked) task; delete is always available. flushBody first so a
// pending debounced edit is captured before the task leaves the board.
async function doDelete() {
  if (!task.value) return
  const snap = await tasks.remove(task.value.id)
  if (snap) ui.showToast('Task deleted', snap)
  ui.openTaskId = null
}
async function doArchive() {
  if (!task.value) return
  tasks.flushBody(task.value.id)
  await tasks.archive(task.value)
  ui.openTaskId = null
}
async function doSend() {
  if (!task.value) return
  tasks.flushBody(task.value.id)
  try { await tasks.pipeline(task.value) }
  catch (e) { ui.showToast('Pipeline failed: ' + (e instanceof Error ? e.message : String(e))) }
  ui.openTaskId = null
}
// Favorite toggle — immediate, keeps the modal open.
function doFavorite() { if (task.value) tasks.toggleFavorite(task.value.id) }
// Copy the raw markdown body to the clipboard — immediate, keeps the modal open.
async function doCopy() {
  if (!task.value) return
  try { await navigator.clipboard.writeText(task.value.body ?? ''); ui.showToast('Copied to clipboard') }
  catch { ui.showToast('Copy failed') }
}
// Quick-move to a lane from the header (keeps the modal open so you see it land).
function moveToLane(laneId: number) {
  if (task.value && !locked.value) tasks.moveToLane(task.value, laneId)
}
const projectName = computed(() => projects.projects.find(p => p.id === task.value?.projectId)?.name ?? '')
const laneName = computed(() => {
  const l = lanes.lanes.find(x => x.id === task.value?.laneId)
  return l?.name ?? (locked.value ? 'Sent' : '—')
})
const updated = computed(() => localDateTime(task.value?.updatedAt))
// Send-to-pipeline is only offered from the last (right-most) lane — the "ready" end.
const isLastLane = computed(() => {
  const last = [...lanes.lanes].sort((a, b) => a.position - b.position).pop()
  return !!last && task.value?.laneId === last.id
})

// Keyboard shortcut: ESC closes the task detail modal (bubbles up from the editor too).
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
onMounted(() => {
  if (ui.openTaskId) checklist.loadForTask(ui.openTaskId)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
function onBody(v: string) { if (task.value && !locked.value) tasks.updateBody(task.value.id, v) }
function close() {
  // Flash the card on the board so the eye can find the task you were just editing.
  if (task.value) { tasks.flushBody(task.value.id); ui.flashTask(task.value.id) }
  reset(); ui.openTaskId = null
}

// Resizable left (checklist) column; the editor + preview always split the remainder
// equally (grid 1fr 1fr). Width persists via the ui store (like the project sidebar).
// Pointer drag with window listeners + body cursor, matching Sidebar.vue.
const resizing = ref(false)
function startResize(e: PointerEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startW = ui.taskModalLeftWidth
  resizing.value = true
  const move = (ev: PointerEvent) => ui.setTaskModalLeftWidth(startW + (ev.clientX - startX))
  const up = () => {
    resizing.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}
</script>
<template>
  <div class="backdrop" @click.self="close">
    <div class="modal" v-if="task">
      <header class="mhead">
        <span class="mtitle">{{ projectName }} <span class="sep">·</span> {{ laneName }}</span>
        <span class="mmeta">
          <template v-if="!locked">
            <button v-for="l in lanes.lanes" :key="l.id" class="hact lane"
              :class="{ active: l.id === task.laneId }" :disabled="l.id === task.laneId"
              :data-lane="l.id" @click="moveToLane(l.id)">{{ l.name }}</button>
            <span class="sep">·</span>
          </template>
          <span class="mts" title="Last updated">{{ updated }}</span>
          <!-- Actions only on an editable task; delete/archive/send need a second click.
               Order: delete, archive, favorite, copy, send — spaced, no separators.
               Send-to-harness only appears from the last (right-most) lane. -->
          <template v-if="!locked">
            <span class="sep">·</span>
            <span class="hacts">
              <button class="hact icon del" data-act="delete" :class="{ armed: armed === 'delete' }"
                @click="confirm('delete', doDelete)" v-html="TRASH"
                :title="armed === 'delete' ? 'Click again to delete' : 'Delete task'" aria-label="Delete task" />
              <button class="hact icon" data-act="archive" :class="{ armed: armed === 'archive' }"
                @click="confirm('archive', doArchive)" v-html="ARCHIVE"
                :title="armed === 'archive' ? 'Click again to archive' : 'Archive task (bypass the harness)'" aria-label="Archive task" />
              <button class="hact icon star" data-act="favorite" :class="{ on: task.isFavorite }"
                @click="doFavorite" v-html="task.isFavorite ? STAR_FILLED : STAR"
                :title="task.isFavorite ? 'Unfavorite' : 'Favorite'" aria-label="Favorite" />
              <button class="hact icon" data-act="copy" @click="doCopy" v-html="COPY"
                title="Copy markdown to clipboard" aria-label="Copy task markdown" />
              <button v-if="isLastLane" class="hact icon" data-act="send" :class="{ armed: armed === 'send' }"
                @click="confirm('send', doSend)" v-html="BOLT"
                :title="armed === 'send' ? 'Click again to send' : 'Send to harness'" aria-label="Send to harness" />
            </span>
          </template>
        </span>
        <button class="mclose" @click="close" aria-label="Close">×</button>
      </header>
      <div class="cols">
        <div class="col checklist" :style="{ width: ui.taskModalLeftWidth + 'px' }">
          <ChecklistColumn :task-id="task.id" :readonly="locked" />
        </div>
        <div class="resizer" :class="{ dragging: resizing }" @pointerdown="startResize"
          role="separator" aria-orientation="vertical" title="Drag to resize" />
        <div class="main">
          <div class="col editor"><MarkdownEditor :model-value="task.body" :readonly="locked"
            :caret-key="task.id" autofocus @update:modelValue="onBody" /></div>
          <div class="col preview"><MarkdownPreview :source="task.body" /></div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.backdrop{position:fixed;inset:0;background:rgba(3,2,8,0.6);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;z-index:50}
.modal{width:80vw;height:80vh;background:var(--up-surface);border:1px solid var(--up-border);border-radius:12px;
  box-shadow:0 24px 70px rgba(0,0,0,0.6);display:flex;flex-direction:column;overflow:hidden}
.mhead{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;
  padding:10px 14px;border-bottom:1px solid var(--up-border)}
.mtitle{justify-self:start;font-size:0.8rem;font-weight:600;color:var(--up-ink);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mmeta{justify-self:center;display:flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:2px;
  font-family:var(--up-font-mono);font-size:0.64rem;color:var(--up-dim)}
.mts{white-space:nowrap}
.hact{background:none;border:none;padding:0 2px;font-family:inherit;font-size:0.64rem;color:var(--up-muted);
  cursor:pointer;white-space:nowrap}
.hact:hover{color:var(--up-violet-bright)}
.hact.icon{display:inline-flex;align-items:center;padding:2px;color:var(--up-dim);border-radius:5px;
  border:1px solid var(--up-border-strong);transition:color .1s,background .1s,border-color .1s}
.hact.icon :deep(svg){width:15px;height:15px}
.hact.icon:hover{border-color:var(--up-violet)}
.hact.icon.del:hover{color:var(--up-danger);border-color:var(--up-danger)}
/* Armed (awaiting the confirming second click). */
.hact.icon.del.armed{color:var(--up-danger);background:color-mix(in srgb,var(--up-danger) 22%,transparent);border-color:var(--up-danger)}
.hact.icon.armed:not(.del){color:var(--up-violet-bright);background:color-mix(in srgb,var(--up-violet) 24%,transparent);border-color:var(--up-violet)}
/* Favorited star reads violet (like the kanban card). */
.hact.icon.star.on{color:var(--up-violet)}
.hact.icon.star.on:hover{color:var(--up-violet-bright)}
/* Action icons are just spaced (no separators). */
.hacts{display:inline-flex;align-items:center;gap:6px}
.hact.danger{color:var(--up-danger)}
.hact.danger:hover{text-decoration:underline}
.hact.lane{color:var(--up-dim)}
.hact.lane:hover:not(:disabled){color:var(--up-violet-bright)}
.hact.lane.active{color:var(--up-violet-bright);font-weight:600;cursor:default}
.mclose{justify-self:end;background:none;border:none;color:var(--up-muted);font-size:1.35rem;line-height:1;
  cursor:pointer;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center}
.mclose:hover{color:var(--up-ink);background:var(--up-surface-2)}
.sep{color:var(--up-dim);margin:0 3px}
/* Resizable checklist (left, drag-set px width); the editor (middle) and preview (right)
   split the remaining space equally (grid 1fr 1fr), so they always stay the same size. */
.cols{flex:1 1 auto;min-height:0;display:flex}
.col{min-width:0;display:flex;flex-direction:column;overflow:hidden}
.col.checklist{flex:0 0 auto}
.main{flex:1 1 auto;min-width:0;display:grid;grid-template-columns:1fr 1fr}
.col.editor{border-right:1px solid var(--up-border)}
.col.preview{position:relative}
/* Drag handle between the checklist and the main panel: a 7px grab strip with a hairline
   divider that lights up violet on hover/drag. */
.resizer{flex:0 0 auto;width:7px;align-self:stretch;cursor:col-resize;position:relative;z-index:2;touch-action:none}
.resizer::before{content:'';position:absolute;top:0;bottom:0;left:3px;width:1px;
  background:var(--up-border);transition:background .1s,box-shadow .1s}
.resizer:hover::before,.resizer.dragging::before{background:var(--up-violet);box-shadow:0 0 0 0.5px var(--up-violet)}
</style>
