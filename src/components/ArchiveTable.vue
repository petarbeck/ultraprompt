<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from './EmptyState.vue'
import { useTasksStore } from '../stores/tasks'
import { useProjectsStore } from '../stores/projects'
import { useUiStore } from '../stores/ui'
import { matchesQuery } from '../lib/search'
import { localDateTime } from '../lib/datetime'
import { UNARCHIVE } from './icons'
const tasks = useTasksStore(); const projects = useProjectsStore(); const ui = useUiStore()
const rows = computed(() => tasks.archivedTasks.filter(t => matchesQuery(t.body, ui.search)))
function firstLine(body: string) { return body.split('\n').find(l => l.trim()) ?? '(empty)' }
async function unarchive(t: typeof rows.value[number]) {
  await tasks.unarchive(t)
}
</script>
<template>
  <div class="page">
    <div class="phead">
      <h1>Archive · {{ projects.active?.name ?? '' }}</h1>
      <span class="count mono">{{ rows.length }} {{ ui.search ? (rows.length === 1 ? 'match' : 'matches') : 'sent' }}</span>
    </div>
    <table v-if="rows.length">
      <thead><tr><th>Task</th><th>Created</th><th>Updated</th><th>Sent</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="t in rows" :key="t.id" @click="ui.openTaskId = t.id">
          <td>{{ firstLine(t.body) }}</td>
          <td class="mono dt">{{ localDateTime(t.createdAt, { seconds: true }) }}</td>
          <td class="mono dt">{{ localDateTime(t.updatedAt, { seconds: true }) }}</td>
          <td class="mono dt">{{ localDateTime(t.sentAt, { seconds: true }) }}</td>
          <td><span class="pill" :class="{ done: t.completedAt }">{{ t.completedAt ? 'Completed' : 'Sent' }}</span></td>
          <td class="actioncell">
            <button class="unarch" @click.stop="unarchive(t)" v-html="UNARCHIVE"
              title="Unarchive — return to board" aria-label="Unarchive" />
          </td>
        </tr>
      </tbody>
    </table>
    <EmptyState v-else-if="ui.search" title="No matches" hint="No archived tasks match your search." />
    <EmptyState v-else title="Nothing archived yet" hint="Pipelined tasks land here." />
  </div>
</template>
<style scoped>
.page{padding:18px 20px;height:100%;overflow-y:auto}
.phead{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.count{color:var(--up-dim);font-size:0.78rem}
h1{font-size:1.05rem}
.search{background:var(--up-bg);border:1px solid var(--up-border-strong);border-radius:7px;color:var(--up-ink);
  font-size:0.8rem;padding:7px 10px;min-width:200px}
.search:focus{outline:none;border-color:var(--up-violet);box-shadow:0 0 0 3px var(--up-orchid-glow)}
table{width:100%;border-collapse:collapse;font-size:0.8rem;background:var(--up-surface);
  border:1px solid var(--up-border);border-radius:8px;overflow:hidden}
thead th{text-align:left;font-family:var(--up-font-display);font-size:0.62rem;font-weight:600;text-transform:uppercase;
  letter-spacing:0.08em;color:var(--up-muted);background:var(--up-bg-elev);padding:9px 11px;border-bottom:1px solid var(--up-border)}
tbody td{padding:9px 11px;border-bottom:1px solid var(--up-border)}
tbody tr:last-child td{border-bottom:none}
tbody tr{cursor:pointer}
tbody tr:hover td{background:color-mix(in srgb,var(--up-violet) 8%,transparent)}
.dt{color:var(--up-muted);font-size:0.72rem;white-space:nowrap}
.pill{font-size:0.62rem;font-weight:600;padding:2px 9px;border-radius:999px;
  background:color-mix(in srgb,var(--up-violet) 20%,transparent);color:var(--up-violet-bright)}
.pill.done{background:color-mix(in srgb,var(--up-success) 22%,transparent);color:var(--up-success)}
.actioncell{width:1%;text-align:right}
.unarch{background:none;border:1px solid var(--up-border-strong);border-radius:6px;color:var(--up-muted);
  cursor:pointer;padding:5px 7px;display:inline-flex;align-items:center;opacity:0}
tbody tr:hover .unarch{opacity:1}
.unarch:hover{color:var(--up-violet-bright);border-color:var(--up-violet)}
</style>
