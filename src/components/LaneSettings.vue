<script setup lang="ts">
import { ref } from 'vue'
import { useLanesStore } from '../stores/lanes'
import { useTasksStore } from '../stores/tasks'
import { useProjectsStore } from '../stores/projects'
import { useUiStore } from '../stores/ui'
import LaneEditModal from './LaneEditModal.vue'
import { PLUS, EDIT, TRASH, GRIP } from './icons'
import { useListReorder } from '../lib/listDrag'
import type { Lane } from '../db/types'

const lanes = useLanesStore(); const tasks = useTasksStore()
const projects = useProjectsStore(); const ui = useUiStore()
const editing = ref<Lane | null | undefined>(undefined)
const confirmingId = ref<number | null>(null)
const migrateTo = ref<number | null>(null)
const tableEl = ref<HTMLElement | null>(null)
const reorder = useListReorder({
  container: () => tableEl.value,
  rowSelector: '.srow',
  onReorder: (ids) => lanes.reorder(ids),
})

// How many tasks the current project has in a lane (what "Clear/Archive tasks" acts on).
const laneTaskCount = (laneId: number) => tasks.boardTasks.filter(t => t.laneId === laneId).length
// Delete all of the current project's tasks in this lane, with a batch Undo toast.
async function clearTasks(l: Lane) {
  if (!projects.activeProjectId) return
  const snaps = await tasks.removeLaneTasks(projects.activeProjectId, l.id)
  if (snaps.length) ui.showToast(`Cleared ${snaps.length} task${snaps.length === 1 ? '' : 's'} from ${l.name}`, snaps)
}
// Archive (bypass the harness) all of the current project's tasks in this lane, with a batch Undo.
async function archiveTasks(l: Lane) {
  if (!projects.activeProjectId) return
  const snaps = await tasks.archiveLaneTasks(projects.activeProjectId, l.id)
  if (snaps.length) ui.showToast(`Archived ${snaps.length} task${snaps.length === 1 ? '' : 's'} from ${l.name}`, undefined, () => tasks.restoreArchivedToLanes(snaps))
}

function startDelete(l: Lane) {
  confirmingId.value = l.id
  migrateTo.value = lanes.lanes.find(x => x.id !== l.id)?.id ?? null
}
async function confirmDelete() {
  if (confirmingId.value && migrateTo.value) await lanes.deleteWithMigration(confirmingId.value, migrateTo.value)
  confirmingId.value = null
}
</script>
<template>
  <section>
    <div class="shead"><span class="eyebrow">Lanes</span>
      <button class="addbtn" data-add="lane" @click="editing = null"><span v-html="PLUS" />Add</button></div>
    <div class="stable" ref="tableEl" data-table="lanes">
      <template v-for="(l, i) in lanes.lanes" :key="l.id">
        <div v-if="reorder.state.activeId !== null && reorder.state.overIndex === i" class="dropline" />
        <div class="srow" :class="{ dragging: reorder.state.activeId === l.id, confirming: confirmingId === l.id }" :data-id="l.id">
          <template v-if="confirmingId !== l.id">
            <button class="grip" @pointerdown="reorder.onPointerDown($event, l.id)" v-html="GRIP" title="Drag to reorder" aria-label="Reorder" />
            <span class="lemoji">{{ l.emoji || '·' }}</span>
            <span class="sname">{{ l.name }}</span>
            <span v-if="laneTaskCount(l.id)" class="taskacts">
              <button class="cleartasks" @click="clearTasks(l)"
                :title="`Delete all ${laneTaskCount(l.id)} task(s) in this lane for the current project`">
                Clear {{ laneTaskCount(l.id) }}
              </button>
              <button class="cleartasks archive" @click="archiveTasks(l)"
                :title="`Archive all ${laneTaskCount(l.id)} task(s) in this lane for the current project`">
                Archive {{ laneTaskCount(l.id) }}
              </button>
            </span>
            <span class="sacts">
              <button class="ico" @click="editing = l" v-html="EDIT" title="Edit lane" aria-label="Edit" />
              <button class="ico danger" :disabled="lanes.lanes.length <= 1" @click="startDelete(l)"
                v-html="TRASH" title="Delete lane" aria-label="Delete" />
            </span>
          </template>
          <div v-else class="confirm">
            <span class="cmsg">Move this lane's tasks to:</span>
            <select v-model.number="migrateTo" class="msel">
              <option v-for="o in lanes.lanes.filter(x => x.id !== confirmingId)" :key="o.id" :value="o.id">{{ o.emoji }} {{ o.name }}</option>
            </select>
            <span class="cbtns">
              <button class="ghost" @click="confirmingId = null">Cancel</button>
              <button class="danger-btn" @click="confirmDelete">Delete</button>
            </span>
          </div>
        </div>
      </template>
      <div v-if="reorder.state.activeId !== null && reorder.state.overIndex === lanes.lanes.length" class="dropline" />
    </div>
    <LaneEditModal v-if="editing !== undefined" :lane="editing" @close="editing = undefined" />
  </section>
</template>
<style scoped>
.shead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.addbtn{display:inline-flex;align-items:center;gap:5px;background:none;border:1px solid var(--up-border-strong);
  border-radius:7px;color:var(--up-muted);font-size:0.78rem;padding:5px 10px;cursor:pointer}
.addbtn:hover{color:var(--up-violet-bright);border-color:var(--up-violet)}
.stable{display:flex;flex-direction:column;border:1px solid var(--up-border);border-radius:10px;overflow:hidden}
.srow{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--up-bg-elev);border-bottom:1px solid var(--up-border)}
.srow:last-of-type{border-bottom:none}
.srow.dragging{opacity:0.4}
.srow.confirming{background:color-mix(in srgb,var(--up-danger) 12%,var(--up-bg-elev))}
.grip{background:none;border:none;color:var(--up-dim);cursor:grab;display:flex;padding:2px;touch-action:none}
.grip:hover{color:var(--up-muted)}
.grip:active{cursor:grabbing}
.lemoji{font-size:1.1rem;line-height:1;flex:0 0 auto}
.sname{font-size:0.86rem;font-weight:600;color:var(--up-ink);flex:1 1 auto;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.taskacts{display:flex;gap:12px;flex:0 0 auto}
.cleartasks{background:none;border:none;color:var(--up-dim);font-size:0.72rem;padding:0;cursor:pointer;white-space:nowrap}
.cleartasks:hover{color:var(--up-danger)}
.cleartasks.archive:hover{color:var(--up-violet-bright)}
.sacts{display:flex;gap:6px;flex:0 0 auto}
.ico{background:none;border:1px solid var(--up-border-strong);border-radius:6px;color:var(--up-muted);
  cursor:pointer;padding:5px 7px;display:inline-flex;align-items:center}
.ico:hover{color:var(--up-violet-bright);border-color:var(--up-violet)}
.ico:disabled{opacity:0.35;cursor:not-allowed}
.ico.danger:hover:not(:disabled){color:var(--up-danger);border-color:var(--up-danger)}
.dropline{height:2px;background:var(--up-violet);border-radius:2px;margin:0 8px;box-shadow:0 0 6px var(--up-orchid-glow)}
.confirm{display:flex;align-items:center;gap:12px;flex:1;min-width:0;flex-wrap:wrap}
.cmsg{font-size:0.78rem;color:var(--up-muted);flex:0 0 auto}
.msel{background:var(--up-bg);border:1px solid var(--up-border-strong);border-radius:6px;color:var(--up-ink);
  font-size:0.8rem;padding:5px 7px;flex:1 1 auto;min-width:120px}
.cbtns{display:flex;gap:8px;flex:0 0 auto;margin-left:auto}
.ghost{background:none;border:1px solid var(--up-border-strong);border-radius:6px;color:var(--up-muted);
  font-size:0.78rem;padding:5px 12px;cursor:pointer}
.ghost:hover{color:var(--up-ink)}
.danger-btn{background:color-mix(in srgb,var(--up-danger) 22%,transparent);border:1px solid var(--up-danger);
  border-radius:6px;color:var(--up-danger);font-size:0.78rem;font-weight:600;padding:5px 12px;cursor:pointer}
.danger-btn:hover{background:color-mix(in srgb,var(--up-danger) 34%,transparent)}
</style>
