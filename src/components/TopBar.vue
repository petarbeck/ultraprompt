<script setup lang="ts">
import { useUiStore } from '../stores/ui'
import { useProjectsStore } from '../stores/projects'
import { useTasksStore } from '../stores/tasks'
import { GEAR, TERMINAL } from './icons'
const ui = useUiStore(); const projects = useProjectsStore(); const tasks = useTasksStore()
async function setView(mode: 'kanban' | 'archive') {
  ui.viewMode = mode
  if (mode === 'archive' && projects.activeProjectId) await tasks.loadArchived(projects.activeProjectId)
}
</script>
<template>
  <header class="topbar">
    <div class="toggle">
      <button :class="{ on: ui.viewMode==='kanban' }" @click="setView('kanban')">Workplace</button>
      <button :class="{ on: ui.viewMode==='archive' }" @click="setView('archive')">Archive</button>
    </div>
    <div class="right">
      <input class="search" v-model="ui.search" spellcheck="false"
        placeholder="Search tasks…  ( * ? wildcards )" aria-label="Search tasks" />
      <button v-if="ui.search" class="clear" @click="ui.search = ''" aria-label="Clear search">×</button>
      <button class="hbtn" data-harness @click="ui.harnessPromptOpen = true"
        title="AI Harness setup prompt" aria-label="AI Harness setup prompt">
        <span class="ic" v-html="TERMINAL" /><span>Harness</span></button>
      <button class="hbtn" data-settings @click="ui.settingsOpen = true"
        title="Settings" aria-label="Settings">
        <span class="ic" v-html="GEAR" /><span>Settings</span></button>
    </div>
  </header>
</template>
<style scoped>
.topbar{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;
  border-bottom:1px solid var(--up-border);background:var(--up-bg-elev);position:relative}
.topbar::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;
  background:linear-gradient(90deg,transparent,rgba(160,98,206,0.5) 35%,rgba(198,91,214,0.4) 60%,transparent)}
.toggle{display:flex;background:var(--up-surface);border:1px solid var(--up-border);border-radius:8px;padding:2px}
.toggle button{font-size:0.74rem;font-weight:600;padding:5px 12px;border-radius:6px;border:none;
  background:none;color:var(--up-muted);cursor:pointer}
.toggle button.on{background:var(--up-btn);color:#fdfbff;box-shadow:0 0 12px var(--up-orchid-glow)}
.right{display:flex;align-items:center;gap:8px}
.search{background:var(--up-bg);border:1px solid var(--up-border-strong);border-radius:8px;color:var(--up-ink);
  font-size:0.78rem;padding:6px 10px;width:220px}
.search::placeholder{color:var(--up-dim)}
.search:focus{outline:none;border-color:var(--up-violet);box-shadow:0 0 0 3px var(--up-orchid-glow)}
.clear{background:none;border:none;color:var(--up-muted);font-size:1.1rem;line-height:1;cursor:pointer;padding:0 2px}
.clear:hover{color:var(--up-violet-bright)}
/* Icon + label buttons: Harness (setup prompt) and Settings. */
.hbtn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;
  border:1px solid var(--up-border);background:none;color:var(--up-muted);cursor:pointer;
  font-size:0.76rem;font-weight:600}
.hbtn:hover{color:var(--up-violet-bright);border-color:var(--up-violet)}
.hbtn .ic{display:flex;line-height:0}
</style>
