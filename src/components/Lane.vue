<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Lane } from '../db/types'
import TaskCard from './TaskCard.vue'
import OverlayScrollbar from './OverlayScrollbar.vue'
import { useTasksStore } from '../stores/tasks'
import { useProjectsStore } from '../stores/projects'
import { useUiStore } from '../stores/ui'
import { matchesQuery } from '../lib/search'
import { dragState } from '../lib/drag'

const props = defineProps<{ lane: Lane }>()
const tasks = useTasksStore(); const projects = useProjectsStore(); const ui = useUiStore()
const cardsEl = ref<HTMLElement | null>(null)

const laneTasks = computed(() => tasks.boardTasks
  .filter(t => t.laneId === props.lane.id && matchesQuery(t.body, ui.search))
  .sort((a, b) => a.position - b.position))
const favTasks = computed(() => laneTasks.value.filter(t => t.isFavorite))
const normalTasks = computed(() => laneTasks.value.filter(t => !t.isFavorite))
const displayTasks = computed(() => [...favTasks.value, ...normalTasks.value])
const favCount = computed(() => favTasks.value.length)
// Drag works even while a search filters the lane — a filtered drop index is mapped
// back to the full lane order in AppShell.handleDrop, so hidden cards keep their spots.
const dragEnabled = computed(() => true)

// Insertion index for THIS lane while a drag targets it, else null. A card from
// another lane always appends to the end, so show the line there (WYSIWYG);
// within the same lane the line follows the precise hit-test slot.
const laneDropIndex = computed(() => {
  const d = dragState.drop
  if (!(dragState.active && d?.type === 'lane' && d.laneId === props.lane.id)) return null
  const dragged = tasks.boardTasks.find(t => t.id === dragState.taskId)
  return dragged && dragged.laneId !== props.lane.id ? displayTasks.value.length : d.index
})

const draft = ref('')
// Quick-add: Enter creates a task from the typed line and keeps the row focused
// so you can keep adding (mirrors the checklist placeholder row).
async function quickAdd() {
  const text = draft.value.trim()
  if (!text || !projects.activeProjectId) return
  draft.value = ''
  await tasks.create(projects.activeProjectId, props.lane.id, text)
}
// New task: create an empty task and open it immediately for full editing.
async function newTask() {
  if (!projects.activeProjectId) return
  const id = await tasks.create(projects.activeProjectId, props.lane.id)
  ui.openTaskId = id
}
</script>
<template>
  <section class="lane" :class="{ over: laneDropIndex !== null }" data-drop="lane" :data-lane-id="lane.id">
    <header class="head"><span>{{ lane.emoji }} {{ lane.name }}</span><span class="count mono">{{ laneTasks.length }}</span></header>
    <div class="cards-wrap">
      <div class="cards no-native-scrollbar" ref="cardsEl">
        <template v-for="(t, i) in displayTasks" :key="t.id">
          <div v-if="laneDropIndex === i" class="drop-line" />
          <div v-if="i === favCount && favCount > 0 && favCount < displayTasks.length" class="fav-divider" />
          <TaskCard :task="t" :allow-drag="dragEnabled" />
        </template>
        <div v-if="laneDropIndex === displayTasks.length" class="drop-line" />
      </div>
      <OverlayScrollbar :view="cardsEl" />
    </div>
    <input class="quickadd" :class="{ nodrag: dragState.active }" v-model="draft" @keyup.enter="quickAdd"
      placeholder="Quick add — type & Enter" aria-label="Quick add task" />
    <button class="add" @click="newTask">+ New task</button>
  </section>
</template>
<style scoped>
.lane{background:var(--up-bg-elev);border:1px solid var(--up-border);border-radius:10px;padding:10px;
  width:250px;flex:0 0 auto;display:flex;flex-direction:column;max-height:100%;overflow:hidden}
.lane.over{outline:2px dashed var(--up-violet);outline-offset:-2px}
.head{display:flex;justify-content:space-between;align-items:center;font-size:0.7rem;font-weight:600;
  text-transform:uppercase;letter-spacing:0.06em;color:var(--up-muted);margin-bottom:10px;padding:0 2px}
.count{color:var(--up-dim)}
/* Cards scroll; the quick-add + New-task footer stays pinned at the bottom. */
.cards-wrap{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.cards{flex:1 1 auto;min-height:0;overflow-y:auto}
.fav-divider{height:1px;background:var(--up-border);margin:2px 2px 8px}
.drop-line{height:2px;background:var(--up-violet);border-radius:2px;margin:1px 1px 7px;box-shadow:0 0 6px var(--up-orchid-glow)}
.quickadd{margin-top:2px;background:var(--up-surface);border:1px solid var(--up-border);border-radius:7px;
  color:var(--up-ink);font-size:0.8rem;padding:7px 9px;outline:none}
.quickadd::placeholder{color:var(--up-dim)}
.quickadd:focus{border-color:var(--up-violet);box-shadow:0 0 0 1px var(--up-orchid-glow)}
/* While a card is being dragged, the quick-add field must not react to the pointer
   (no hover/focus highlight as a card passes over it). */
.quickadd.nodrag{pointer-events:none}
.add{margin-top:6px;background:none;border:1px dashed var(--up-border-strong);border-radius:7px;
  color:var(--up-muted);font-size:0.76rem;padding:7px;cursor:pointer}
.add:hover{color:var(--up-violet-bright);border-color:var(--up-violet)}
</style>
