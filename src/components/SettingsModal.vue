<script setup lang="ts">
import { ref } from 'vue'
import LaneSettings from './LaneSettings.vue'
import ProjectSettings from './ProjectSettings.vue'
import OverlayScrollbar from './OverlayScrollbar.vue'
import { useUiStore } from '../stores/ui'
const ui = useUiStore()
const bodyEl = ref<HTMLElement | null>(null)
</script>
<template>
  <div class="backdrop" @click.self="ui.settingsOpen=false">
    <div class="modal">
      <header class="head"><h2>Settings</h2><button class="x" @click="ui.settingsOpen=false" aria-label="Close">×</button></header>
      <div class="body-wrap">
        <div class="body no-native-scrollbar" ref="bodyEl">
          <ProjectSettings /><hr /><LaneSettings />
        </div>
        <OverlayScrollbar :view="bodyEl" />
      </div>
    </div>
  </div>
</template>
<style scoped>
.backdrop{position:fixed;inset:0;background:rgba(3,2,8,0.6);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;z-index:60}
/* Flex column so the header stays fixed and only the body scrolls. */
.modal{width:720px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;
  background:var(--up-surface);border:1px solid var(--up-border);border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,0.6)}
.head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--up-border)}
.head h2{font-size:1.05rem;margin:0}
.x{background:none;border:none;color:var(--up-muted);font-size:1.3rem;cursor:pointer;line-height:1}
.x:hover{color:var(--up-ink)}
.body-wrap{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.body{padding:18px;flex:1 1 auto;min-height:0;overflow-y:auto}
hr{border:none;border-top:1px solid var(--up-border);margin:20px 0}
</style>
