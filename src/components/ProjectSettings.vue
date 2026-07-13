<script setup lang="ts">
import { ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { useProjectsStore } from '../stores/projects'
import { useTasksStore } from '../stores/tasks'
import { useUiStore } from '../stores/ui'
import ProjectEditModal from './ProjectEditModal.vue'
import { PLUS, EDIT, IMPORT, TRASH, GRIP } from './icons'
import { useListReorder } from '../lib/listDrag'
import type { Project } from '../db/types'

const projects = useProjectsStore(); const tasks = useTasksStore(); const ui = useUiStore()
// undefined = modal closed, null = creating, Project = editing that project
const editing = ref<Project | null | undefined>(undefined)
const confirmingId = ref<number | null>(null)
const tableEl = ref<HTMLElement | null>(null)
const reorder = useListReorder({
  container: () => tableEl.value,
  rowSelector: '.srow',
  onReorder: (ids) => projects.reorder(ids),
})

async function importInto(p: Project) {
  const dir = await open({ directory: true })
  if (typeof dir !== 'string') return
  const { imported, skipped } = await tasks.importFromDir(p.id, dir)
  const dup = skipped ? ` (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped)` : ''
  ui.showToast(`Imported ${imported} task${imported === 1 ? '' : 's'} into ${p.name}${dup}`)
}
async function del(id: number) { await projects.remove(id); confirmingId.value = null }
</script>
<template>
  <section>
    <div class="shead"><span class="eyebrow">Projects</span>
      <button class="addbtn" data-add="project" @click="editing = null"><span v-html="PLUS" />Add</button></div>
    <div class="stable" ref="tableEl" data-table="projects">
      <template v-for="(p, i) in projects.projects" :key="p.id">
        <div v-if="reorder.state.activeId !== null && reorder.state.overIndex === i" class="dropline" />
        <div class="srow" :class="{ dragging: reorder.state.activeId === p.id, confirming: confirmingId === p.id }" :data-id="p.id">
          <template v-if="confirmingId !== p.id">
            <button class="grip" @pointerdown="reorder.onPointerDown($event, p.id)" v-html="GRIP" title="Drag to reorder" aria-label="Reorder" />
            <span class="sname">{{ p.name }}</span>
            <span class="sdir mono">{{ p.workingDir }}</span>
            <span class="sacts">
              <button class="ico" @click="importInto(p)" v-html="IMPORT" title="Import .md files into the first lane" aria-label="Import" />
              <button class="ico" @click="editing = p" v-html="EDIT" title="Edit project" aria-label="Edit" />
              <button class="ico danger" @click="confirmingId = p.id" v-html="TRASH" title="Delete project" aria-label="Delete" />
            </span>
          </template>
          <div v-else class="confirm">
            <span class="cmsg">Delete “{{ p.name }}” and all its tasks?</span>
            <span class="cbtns">
              <button class="ghost" @click="confirmingId = null">Cancel</button>
              <button class="danger-btn" @click="del(p.id)">Delete</button>
            </span>
          </div>
        </div>
      </template>
      <div v-if="reorder.state.activeId !== null && reorder.state.overIndex === projects.projects.length" class="dropline" />
      <p v-if="!projects.projects.length" class="empty">No projects yet — Add one above.</p>
    </div>
    <ProjectEditModal v-if="editing !== undefined" :project="editing" @close="editing = undefined" />
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
.sname{font-size:0.86rem;font-weight:600;color:var(--up-ink);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;flex:0 0 auto;max-width:190px}
.sdir{flex:1 1 auto;min-width:0;font-size:0.68rem;color:var(--up-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sacts{display:flex;gap:6px;flex:0 0 auto}
.ico{background:none;border:1px solid var(--up-border-strong);border-radius:6px;color:var(--up-muted);
  cursor:pointer;padding:5px 7px;display:inline-flex;align-items:center}
.ico:hover{color:var(--up-violet-bright);border-color:var(--up-violet)}
.ico.danger:hover{color:var(--up-danger);border-color:var(--up-danger)}
.dropline{height:2px;background:var(--up-violet);border-radius:2px;margin:0 8px;box-shadow:0 0 6px var(--up-orchid-glow)}
.confirm{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
.cmsg{font-size:0.8rem;color:var(--up-ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cbtns{display:flex;gap:8px;flex:0 0 auto}
.ghost{background:none;border:1px solid var(--up-border-strong);border-radius:6px;color:var(--up-muted);
  font-size:0.78rem;padding:5px 12px;cursor:pointer}
.ghost:hover{color:var(--up-ink)}
.danger-btn{background:color-mix(in srgb,var(--up-danger) 22%,transparent);border:1px solid var(--up-danger);
  border-radius:6px;color:var(--up-danger);font-size:0.78rem;font-weight:600;padding:5px 12px;cursor:pointer}
.danger-btn:hover{background:color-mix(in srgb,var(--up-danger) 34%,transparent)}
.empty{color:var(--up-dim);font-size:0.8rem;padding:12px;text-align:center}
</style>
