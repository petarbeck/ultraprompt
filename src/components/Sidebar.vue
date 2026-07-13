<script setup lang="ts">
import { computed, ref } from 'vue'
import OverlayScrollbar from './OverlayScrollbar.vue'
import { useProjectsStore } from '../stores/projects'
import { useTasksStore } from '../stores/tasks'
import { useUiStore } from '../stores/ui'
import { STAR, STAR_FILLED, BOLT } from './icons'
import { APP_VERSION } from '../version'
const projects = useProjectsStore(); const tasks = useTasksStore(); const ui = useUiStore()
const sideScrollEl = ref<HTMLElement | null>(null)

// Drag the right-edge handle to resize the sidebar; width persists via the ui store.
function startResize(e: PointerEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startW = ui.sidebarWidth
  const move = (ev: PointerEvent) => ui.setSidebarWidth(startW + (ev.clientX - startX))
  const up = () => {
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
const favorites = computed(() => projects.projects.filter(p => p.isFavorite))
const normal = computed(() => projects.projects.filter(p => !p.isFavorite))
async function pick(id: number) { projects.setActive(id); await tasks.loadForProject(id) }
// Project sorting now lives in Settings (drag-sortable table); the sidebar just lists them.
// Per-project in-flight harness counts for the sidebar badges: Queued (grey) vs
// Processing (violet). Mirrors the ULTRAPROMPT feed's status split.
const statusByProject = computed(() => {
  const proc = new Set(tasks.processing)
  const map: Record<number, { queued: number; processing: number }> = {}
  for (const t of tasks.pipelined) {
    if (t.completedAt) continue
    const base = (t.sentPath || '').split(/[/\\]/).pop() || ''
    const m = (map[t.projectId] ??= { queued: 0, processing: 0 })
    if (proc.has(base)) m.processing++; else m.queued++
  }
  return map
})
</script>
<template>
  <aside class="side">
    <div class="side-scroll-wrap">
    <div class="side-scroll no-native-scrollbar" ref="sideScrollEl">
    <div class="wordmark"><span class="wm-bolt" v-html="BOLT" />/Ultraprompt</div>
    <template v-if="favorites.length">
      <div class="eyebrow slabel">Favorites</div>
      <div v-for="p in favorites" :key="p.id" class="proj" :class="{ active: p.id === projects.activeProjectId }" @click="pick(p.id)">
        <span class="dot" /><span class="pname">{{ p.name }}</span>
        <span v-if="statusByProject[p.id]?.queued" class="badge queued" data-badge="queued" :title="statusByProject[p.id]?.queued + ' queued'">{{ statusByProject[p.id]?.queued }}</span>
        <span v-if="statusByProject[p.id]?.processing" class="badge processing" data-badge="processing" :title="statusByProject[p.id]?.processing + ' processing'">{{ statusByProject[p.id]?.processing }}</span>
        <button class="star on" @click.stop="projects.toggleFavorite(p.id)" v-html="STAR_FILLED" aria-label="Unfavorite" />
      </div>
      <div class="divider" />
    </template>
    <div class="eyebrow slabel">Projects</div>
    <div v-for="p in normal" :key="p.id" class="proj" :class="{ active: p.id === projects.activeProjectId }" @click="pick(p.id)">
      <span class="dot" /><span class="pname">{{ p.name }}</span>
      <span v-if="statusByProject[p.id]?.queued" class="badge queued" data-badge="queued" :title="statusByProject[p.id]?.queued + ' queued'">{{ statusByProject[p.id]?.queued }}</span>
      <span v-if="statusByProject[p.id]?.processing" class="badge processing" data-badge="processing" :title="statusByProject[p.id]?.processing + ' processing'">{{ statusByProject[p.id]?.processing }}</span>
      <button class="star" @click.stop="projects.toggleFavorite(p.id)" v-html="STAR" aria-label="Favorite" />
    </div>
    <p v-if="!projects.projects.length" class="empty">No projects yet — add one in Settings.</p>
    </div>
    <OverlayScrollbar :view="sideScrollEl" />
    </div>
    <div class="version" data-version>Version {{ APP_VERSION }}</div>
    <div class="resizer" @pointerdown="startResize" title="Drag to resize sidebar" data-resizer />
  </aside>
</template>
<style scoped>
.side{position:relative;background:var(--up-bg-elev);border-right:1px solid var(--up-border);overflow:hidden;
  display:flex;flex-direction:column}
.side-scroll-wrap{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.side-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px 10px;display:flex;flex-direction:column;gap:4px}
/* Muted version, pinned to the bottom-center of the sidebar. */
.version{flex:0 0 auto;text-align:center;padding:7px 10px 9px;font-family:var(--up-font-mono);
  font-size:0.6rem;letter-spacing:0.04em;color:var(--up-dim);user-select:none}
/* Right-edge drag handle to resize the sidebar. */
.resizer{position:absolute;top:0;right:0;width:6px;height:100%;cursor:ew-resize;z-index:3}
.resizer:hover{background:color-mix(in srgb,var(--up-violet) 45%,transparent)}
.wordmark{display:flex;align-items:center;gap:6px;font-family:var(--up-font-display);font-weight:800;
  font-size:0.78rem;letter-spacing:0.16em;text-transform:uppercase;margin:2px 6px 14px;
  background:linear-gradient(180deg,var(--up-violet-bright),var(--up-violet) 55%,var(--up-indigo));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.wm-bolt{display:flex;flex:0 0 auto;color:var(--up-violet-bright);-webkit-text-fill-color:var(--up-violet-bright)}
.wm-bolt :deep(svg){width:15px;height:15px}
.slabel{margin:2px 8px 6px}
.proj{position:relative;display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;
  color:var(--up-muted);font-size:0.86rem;font-weight:500;background:none;border:none;cursor:pointer;text-align:left}
.proj:hover{background:rgba(255,255,255,0.03);color:var(--up-ink)}
.pname{flex:1;min-width:0;overflow-wrap:anywhere;line-height:1.3}
.badge{flex:0 0 auto;min-width:16px;text-align:center;font-family:var(--up-font-mono);font-size:0.6rem;
  font-weight:600;line-height:1;padding:2px 5px;border-radius:9px}
.badge.queued{background:var(--up-surface-2);color:var(--up-muted)}
.badge.processing{background:color-mix(in srgb,var(--up-violet) 32%,transparent);color:var(--up-violet-bright)}
.star{opacity:0;background:none;border:none;color:var(--up-dim);cursor:pointer;display:flex;padding:0}
.proj:hover .star{opacity:1}
.star:hover{color:var(--up-violet-bright)}
.star.on{opacity:1;color:var(--up-violet)}
.divider{height:1px;background:var(--up-border);margin:8px 6px}
.proj .dot{width:6px;height:6px;border-radius:50%;background:var(--up-dim)}
.proj.active{background:color-mix(in srgb,var(--up-violet) 15%,transparent);color:var(--up-violet-bright)}
.proj.active .dot{background:var(--up-violet);box-shadow:0 0 7px 1px var(--up-orchid-glow)}
.proj.active::before{content:"";position:absolute;left:0;top:7px;bottom:7px;width:2px;border-radius:2px;
  background:var(--up-violet);box-shadow:0 0 9px 1px var(--up-orchid-glow)}
.empty{color:var(--up-dim);font-size:0.78rem;padding:8px 10px}
</style>
