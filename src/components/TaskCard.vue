<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '../db/types'
import { LOCK, STAR, STAR_FILLED, TRASH, ARCHIVE, BOLT, COPY } from './icons'
import { useTasksStore } from '../stores/tasks'
import { useLanesStore } from '../stores/lanes'
import { useUiStore } from '../stores/ui'
import { useArmedConfirm } from '../lib/armedConfirm'
import { startDrag, dragState } from '../lib/drag'
const props = withDefaults(defineProps<{ task: Task; allowDrag?: boolean }>(), { allowDrag: true })
const tasks = useTasksStore(); const lanes = useLanesStore(); const ui = useUiStore()
// delete / archive / send-to-pipeline require a second click to confirm.
const { armed, confirm, reset } = useArmedConfirm()
// Send-to-pipeline is only offered from the last (right-most) lane — the "ready" end.
const isLastLane = computed(() => {
  const last = [...lanes.lanes].sort((a, b) => a.position - b.position).pop()
  return !!last && props.task.laneId === last.id
})
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  // The action row handles its own clicks; don't start a drag/tap from it.
  if ((e.target as HTMLElement).closest('.cardacts')) return
  startDrag(props.task.id, props.task.body, e, props.allowDrag)
}
// Delete with an Undo toast (restores the row + its checklist).
async function onDelete() {
  const snap = await tasks.remove(props.task.id)
  if (snap) ui.showToast('Task deleted', snap)
}
// Archive (bypass the harness) with an Undo that returns it to this lane/position.
async function onArchive() {
  const snap = { id: props.task.id, laneId: props.task.laneId, position: props.task.position }
  await tasks.archive(props.task)
  ui.showToast('Task archived', undefined, () => tasks.restoreArchivedToLanes([snap]))
}
// Send to the harness pipeline.
async function onSend() {
  try { await tasks.pipeline(props.task) }
  catch (e) { ui.showToast('Pipeline failed: ' + (e instanceof Error ? e.message : String(e))) }
}
// Copy the raw markdown body to the clipboard (non-destructive → no confirm).
async function onCopy() {
  try { await navigator.clipboard.writeText(props.task.body ?? ''); ui.showToast('Copied to clipboard') }
  catch { ui.showToast('Copy failed') }
}
</script>
<template>
  <article class="card" :class="{ dragging: dragState.active && dragState.taskId === task.id, flash: ui.flashTaskId === task.id }"
    @pointerdown="onPointerDown" @pointerleave="reset">
    <div class="body">{{ task.body || 'Empty task — click to edit' }}</div>
    <div v-if="task.isLocked" class="lockrow" v-html="LOCK + ' sent'"></div>
    <!-- Actions, bottom-right, spaced (no separators): delete, archive, favorite, copy, send.
         send-to-pipeline only appears from the last (right-most) lane. -->
    <div class="cardacts">
      <button class="cact del" data-act="delete" :class="{ armed: armed === 'delete' }" @click.stop="confirm('delete', onDelete)"
        v-html="TRASH" :title="armed === 'delete' ? 'Click again to delete' : 'Delete task'" aria-label="Delete task" />
      <button class="cact" data-act="archive" :class="{ armed: armed === 'archive' }" @click.stop="confirm('archive', onArchive)"
        v-html="ARCHIVE" :title="armed === 'archive' ? 'Click again to archive' : 'Archive task'" aria-label="Archive task" />
      <button class="cact star" data-act="favorite" :class="{ on: task.isFavorite }" @click.stop="tasks.toggleFavorite(task.id)"
        v-html="task.isFavorite ? STAR_FILLED : STAR" :title="task.isFavorite ? 'Unfavorite' : 'Favorite'" aria-label="Favorite" />
      <button class="cact" data-act="copy" @click.stop="onCopy"
        v-html="COPY" title="Copy markdown to clipboard" aria-label="Copy task markdown" />
      <button v-if="isLastLane" class="cact" data-act="send" :class="{ armed: armed === 'send' }" @click.stop="confirm('send', onSend)"
        v-html="BOLT" :title="armed === 'send' ? 'Click again to send' : 'Send to pipeline'" aria-label="Send to pipeline" />
    </div>
  </article>
</template>
<style scoped>
.card{position:relative;background:var(--up-surface);border:1px solid var(--up-border-strong);
  border-left:3px solid var(--up-violet);border-radius:8px;padding:9px 11px 20px;margin-bottom:8px;
  box-shadow:0 1px 3px rgba(0,0,0,0.45);font-size:0.86rem;line-height:1.5;color:var(--up-ink);cursor:grab;
  touch-action:none;user-select:none}
.card:hover{border-top-color:var(--up-violet);border-right-color:var(--up-violet);border-bottom-color:var(--up-violet);
  box-shadow:0 0 0 1px var(--up-orchid-glow),0 3px 14px rgba(0,0,0,0.6)}
.card:active{cursor:grabbing}
.card.dragging{opacity:0.4}
/* Flash to re-locate the card after its detail modal closes — bright, brief hold, then a quick fade. */
.card.flash{animation:cardflash 0.52s ease-out}
@keyframes cardflash{
  0%{box-shadow:0 0 0 2px var(--up-violet-bright),0 0 32px 6px rgba(198,91,214,0.6);
    background:color-mix(in srgb,var(--up-violet) 30%,var(--up-surface))}
  30%{box-shadow:0 0 0 2px var(--up-violet-bright),0 0 26px 4px rgba(198,91,214,0.48);
    background:color-mix(in srgb,var(--up-violet) 22%,var(--up-surface))}
  100%{box-shadow:0 1px 3px rgba(0,0,0,0.45);background:var(--up-surface)}
}
@media (prefers-reduced-motion:reduce){.card.flash{animation:none}}
.body{white-space:pre-wrap;overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical}
/* Action row, anchored bottom-right, horizontal. */
.cardacts{position:absolute;right:9px;bottom:7px;display:flex;flex-direction:row;align-items:center;gap:7px;z-index:1}
.cact{background:var(--up-bg-elev);border:1px solid var(--up-border-strong);color:var(--up-dim);cursor:pointer;
  padding:2px;display:flex;line-height:0;border-radius:5px;opacity:0;
  transition:opacity .1s,color .1s,background .1s,border-color .1s}
.card:hover .cact{opacity:1}
.cact:hover{color:var(--up-violet-bright);border-color:var(--up-violet)}
.cact.del:hover{color:var(--up-danger);border-color:var(--up-danger)}
/* Armed (awaiting the confirming second click) — stays visible + highlighted. */
.cact.armed{opacity:1}
.cact.del.armed{color:var(--up-danger);background:color-mix(in srgb,var(--up-danger) 22%,transparent);border-color:var(--up-danger)}
.cact.armed:not(.del){color:var(--up-violet-bright);background:color-mix(in srgb,var(--up-violet) 24%,transparent);border-color:var(--up-violet)}
/* Favorite star persists when set. */
.cact.star.on{opacity:1;color:var(--up-violet)}
.cact.star.on:hover{color:var(--up-violet-bright)}
.lockrow{margin-top:7px;font-family:var(--up-font-mono);font-size:0.62rem;color:var(--up-dim);display:flex;align-items:center;gap:5px}
</style>
