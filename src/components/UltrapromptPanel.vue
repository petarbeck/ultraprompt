<script setup lang="ts">
import { computed, ref } from 'vue'
import { REVOKE } from './icons'
import OverlayScrollbar from './OverlayScrollbar.vue'
import { dragState } from '../lib/drag'
import { useTasksStore } from '../stores/tasks'
import { useProjectsStore } from '../stores/projects'
import { useUiStore } from '../stores/ui'
import { localDateTime, localSmart, isWithinLastHours } from '../lib/datetime'
import type { Task } from '../db/types'
const tasks = useTasksStore(); const projects = useProjectsStore(); const ui = useUiStore()
// The feed is global (every project), so each row is labelled with its project.
function projectName(projectId: number) {
  return projects.projects.find(p => p.id === projectId)?.name ?? 'Unknown project'
}
// Highlights while a card is being dragged over it (drop target = pipeline).
const over = computed(() => dragState.active && dragState.drop?.type === 'pipeline')
// STRICT 24h window (by sent time) — everything shown, and the totals below, are the
// last 24 hours so the metric snapshot stays comparable. Newest first, fills + scrolls.
const windowed = computed(() => tasks.pipelined.filter(t => isWithinLastHours(t.sentAt, 24)))
const feed = computed(() => windowed.value.slice(0, 100))
function firstLine(body: string) {
  const l = (body || '').split('\n').find(s => s.trim()) || 'Empty task'
  return l.replace(/^#+\s*/, '')
}
// Feed label: time-only if today, date-only otherwise; full date+time on hover.
function when(ts: string | null) { return localSmart(ts) }
function whenFull(ts: string | null) { return localDateTime(ts, { seconds: true }) }
// Queued (in queue/) -> Processing (harness moved it to processing/) -> Completed (in done/).
function statusOf(t: { completedAt: string | null; sentPath: string | null }) {
  if (t.completedAt) return 'Completed'
  const base = (t.sentPath || '').split(/[/\\]/).pop() || ''
  return tasks.processing.includes(base) ? 'Processing' : 'Queued'
}
// Revoke a still-queued task: delete its queue file and return it to the board.
function revoke(t: Task) { tasks.revoke(t) }
// Muted totals over the SAME last-24h window: Queued / Processing / Completed.
const totals = computed(() => {
  const proc = new Set(tasks.processing)
  let queued = 0, processing = 0, completed = 0
  for (const t of windowed.value) {
    if (t.completedAt) { completed++; continue }
    const base = (t.sentPath || '').split(/[/\\]/).pop() || ''
    if (proc.has(base)) processing++; else queued++
  }
  return { queued, processing, completed }
})

// The feed's scroll element — driven by the shared OverlayScrollbar (custom overlay
// scrollbar, hidden until the area is hovered, drag-scrollable). See OverlayScrollbar.vue.
const feedEl = ref<HTMLElement | null>(null)
</script>
<template>
  <section class="up-panel" :class="{ over }" data-drop="pipeline">
    <header class="uh">Pipeline
      <span class="ptotals" data-totals title="Over last 24 hours — Queued · Processing · Completed">
        <span class="pt queued" data-total="queued">{{ totals.queued }}</span>
        <span class="pt proc" data-total="processing">{{ totals.processing }}</span>
        <span class="pt done" data-total="completed">{{ totals.completed }}</span>
      </span>
    </header>
    <div class="feedwrap">
      <div class="feed no-native-scrollbar" ref="feedEl">
        <div v-for="t in feed" :key="t.id" class="frow"
          :class="[statusOf(t).toLowerCase(), { muted: projects.activeProjectId != null && t.projectId !== projects.activeProjectId }]"
          data-feed-row :data-status="statusOf(t)"
          role="button" tabindex="0" title="Show details (read-only)"
          @click="ui.openTaskId = t.id" @keyup.enter="ui.openTaskId = t.id">
          <div class="fbody">{{ firstLine(t.body) }}</div>
          <div class="fmeta">
            <span class="fleft">
              <span class="fproj" data-feed-project :title="projectName(t.projectId)">{{ projectName(t.projectId) }}</span>
              <span class="ftime" :title="whenFull(t.sentAt)">{{ when(t.sentAt) }}</span>
            </span>
            <span class="fright">
              <button v-if="statusOf(t) === 'Queued'" class="frevoke" data-revoke v-html="REVOKE"
                title="Revoke — remove from the queue and return it to the board"
                aria-label="Revoke" @click.stop="revoke(t)" />
              <span class="fstatus">{{ statusOf(t) }}</span>
            </span>
          </div>
        </div>
        <div v-if="!feed.length" class="fempty">Drop a task here to pipeline it — it shows up here after.</div>
      </div>
      <OverlayScrollbar :view="feedEl" />
    </div>
  </section>
</template>
<style scoped>
.up-panel{flex:0 0 auto;width:262px;align-self:stretch;display:flex;flex-direction:column;gap:10px;
  border:1.5px dashed var(--up-border-strong);border-radius:12px;padding:12px;
  background:rgba(20,14,40,0.35);transition:border-color .12s,background .12s,box-shadow .12s;overflow:hidden}
.up-panel.over{border-color:var(--up-violet);
  background:color-mix(in srgb,var(--up-violet) 12%,transparent);
  box-shadow:0 0 0 1px var(--up-orchid-glow),inset 0 0 26px var(--up-orchid-glow)}
.uh{display:flex;align-items:center;gap:7px;font-family:var(--up-font-display);font-weight:800;
  font-size:0.72rem;letter-spacing:0.14em;color:var(--up-muted);text-transform:uppercase}
/* Status totals: numbers only, color-coded, pinned to the top-right of the header. */
.ptotals{margin-left:auto;display:flex;gap:8px;font-family:var(--up-font-mono);
  font-size:0.64rem;font-weight:600;letter-spacing:normal}
.pt{white-space:nowrap}
.pt.queued{color:var(--up-dim)}
.pt.proc{color:var(--up-violet-bright)}
.pt.done{color:var(--up-success)}
/* History feed — fills the panel height, scrolls when it overflows. Native scrollbar
   hidden (.no-native-scrollbar); the OverlayScrollbar overlay shows only on hover. */
.feedwrap{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.feed{flex:1 1 auto;display:flex;flex-direction:column;gap:6px;min-height:0;overflow-y:auto}
.frow{background:var(--up-surface);border:1px solid var(--up-border);border-left:3px solid var(--up-dim);
  border-radius:8px;padding:7px 9px;cursor:pointer}
.frow:hover{border-color:var(--up-border-strong)}
/* Tasks from OTHER projects are muted so the current project's tasks stand out;
   hovering a muted row restores it so it stays readable/clickable. */
.frow.muted{opacity:0.4;transition:opacity .12s}
.frow.muted:hover{opacity:1}
.frow.processing{border-left-color:var(--up-violet-bright)}
.frow.completed{border-left-color:var(--up-success)}
.fbody{font-size:0.78rem;color:var(--up-ink);line-height:1.35;overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.fmeta{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px}
.fleft{display:flex;align-items:baseline;gap:6px;min-width:0}
.fproj{font-size:0.62rem;font-weight:600;letter-spacing:0.02em;color:var(--up-violet-bright);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}
.ftime{font-family:var(--up-font-mono);font-size:0.6rem;color:var(--up-dim);flex:0 0 auto}
.fright{display:flex;align-items:center;gap:8px;flex:0 0 auto}
/* Revoke: hover-only button — same border + dark tint as the kanban card action buttons. */
.frevoke{background:var(--up-bg-elev);border:1px solid var(--up-border-strong);color:var(--up-dim);cursor:pointer;
  padding:2px;display:flex;line-height:0;border-radius:5px;opacity:0;transition:opacity .1s,color .1s,border-color .1s}
.frow:hover .frevoke{opacity:1}
.frevoke:hover{color:var(--up-danger);border-color:var(--up-danger)}
.fstatus{font-size:0.64rem;font-weight:600;letter-spacing:0.02em;color:var(--up-dim)}
.frow.processing .fstatus{color:var(--up-violet-bright)}
.frow.completed .fstatus{color:var(--up-success)}
.fempty{color:var(--up-dim);font-size:0.74rem;text-align:center;padding:8px}
</style>
