<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Sidebar from './Sidebar.vue'
import TopBar from './TopBar.vue'
import KanbanBoard from './KanbanBoard.vue'
import ArchiveTable from './ArchiveTable.vue'
import TaskModal from './TaskModal.vue'
import SettingsModal from './SettingsModal.vue'
import HarnessPrompt from './HarnessPrompt.vue'
import Toast from './Toast.vue'
import { useProjectsStore } from '../stores/projects'
import { useLanesStore } from '../stores/lanes'
import { useTasksStore } from '../stores/tasks'
import { useUiStore } from '../stores/ui'
import { setDragHandlers, dragState, type DropTarget } from '../lib/drag'
import { computeLaneOrder } from '../lib/reorder'
import { matchesQuery } from '../lib/search'

const projects = useProjectsStore(); const lanes = useLanesStore()
const tasks = useTasksStore(); const ui = useUiStore()

// Wire the pointer-drag manager once (AppShell is always mounted).
setDragHandlers({
  onTap: (id) => { ui.openTaskId = id },
  onDrop: (id, drop) => { void handleDrop(id, drop) },
})

async function handleDrop(id: number, drop: DropTarget) {
  const dragged = tasks.boardTasks.find(t => t.id === id)
  if (!dragged) return
  if (drop?.type === 'lane') {
    // Rebuild the target lane's displayed order (favorites pinned first) so the
    // drop index lines up with what computeLaneOrder expects.
    const laneTasks = tasks.boardTasks
      .filter(t => t.laneId === drop.laneId)
      .sort((a, b) => a.position - b.position)
    const display = [...laneTasks.filter(t => t.isFavorite), ...laneTasks.filter(t => !t.isFavorite)]
    // Cross-lane move appends to the end; same-lane reorder uses the precise slot.
    // While a search filters the lane, drop.index counts only the VISIBLE cards, so
    // map it back to the full lane order: insert before the visible target card (or at
    // the end of the lane if dropped past the last visible one). Hidden cards keep their
    // relative positions.
    let index: number
    if (dragged.laneId !== drop.laneId) {
      index = display.length
    } else if (ui.search) {
      const visible = display.filter(t => matchesQuery(t.body, ui.search))
      index = drop.index >= visible.length ? display.length : display.findIndex(t => t.id === visible[drop.index].id)
    } else {
      index = drop.index
    }
    const orderedIds = computeLaneOrder(
      display.map(t => ({ id: t.id, isFavorite: t.isFavorite })),
      { id: dragged.id, isFavorite: dragged.isFavorite },
      index,
    )
    await tasks.reorderLane(dragged.projectId, drop.laneId, orderedIds)
  } else if (drop?.type === 'pipeline') {
    try { await tasks.pipeline(dragged) }
    catch (e) { ui.showToast('Pipeline failed: ' + (e instanceof Error ? e.message : String(e))) }
  } else if (drop?.type === 'trash') {
    const snapshot = await tasks.remove(dragged.id)
    if (snapshot) ui.showToast('Task deleted', snapshot)
  }
}

let pollTimer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  await Promise.all([projects.load(), lanes.load()])
  if (projects.activeProjectId) await tasks.loadForProject(projects.activeProjectId)
  await tasks.loadAllPipelined()
  pollTimer = setInterval(() => { void tasks.pollDone() }, 4000)
})
onUnmounted(() => clearInterval(pollTimer))
// Harness hooks (dev only, stripped from production builds).
if (import.meta.env.DEV) {
  (window as any).__pollDone = () => tasks.pollDone()
  ;(window as any).__reloadPipelined = () => tasks.loadAllPipelined()
  // Reload every store from the (mock) DB without a page reload — lets e2e drivers
  // seed the in-memory DB and see it reflected (a page reload would re-seed it).
  ;(window as any).__reload = async () => {
    await Promise.all([projects.load(), lanes.load()])
    if (projects.activeProjectId) await tasks.loadForProject(projects.activeProjectId)
    await tasks.loadAllPipelined()
  }
}
</script>
<template>
  <div class="shell" :style="{ gridTemplateColumns: ui.sidebarWidth + 'px 1fr' }">
    <Sidebar />
    <main class="main">
      <TopBar />
      <KanbanBoard v-if="ui.viewMode === 'kanban'" />
      <ArchiveTable v-else />
    </main>
    <TaskModal v-if="ui.openTaskId !== null" />
    <SettingsModal v-if="ui.settingsOpen" />
    <HarnessPrompt />
    <Toast />
    <div v-if="dragState.active" class="drag-ghost"
      :style="{ left: dragState.x + 'px', top: dragState.y + 'px' }">
      {{ dragState.preview || 'Empty task' }}
    </div>
  </div>
</template>
<style scoped>
.shell{display:grid;grid-template-columns:236px 1fr;height:100%}
.main{display:flex;flex-direction:column;min-width:0;min-height:0}
.drag-ghost{position:fixed;z-index:1000;pointer-events:none;transform:translate(12px,12px);
  max-width:230px;max-height:120px;overflow:hidden;background:var(--up-surface);color:var(--up-ink);
  border:1px solid var(--up-violet);border-left:3px solid var(--up-violet);border-radius:8px;
  padding:8px 10px;font-size:0.82rem;line-height:1.42;white-space:pre-wrap;
  box-shadow:0 8px 24px rgba(0,0,0,0.6);opacity:0.95}
</style>
