<script setup lang="ts">
import { computed, ref } from 'vue'
import OverlayScrollbar from './OverlayScrollbar.vue'
import { renderMarkdown } from '../lib/markdown'
const props = defineProps<{ source: string }>()
const html = computed(() => renderMarkdown(props.source))
const prevEl = ref<HTMLElement | null>(null)
// Prevent preview links from navigating the single Tauri webview away from the SPA.
// TODO: open externally via @tauri-apps/plugin-opener (follow-up)
function onClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a')
  if (a) { e.preventDefault() }
}
</script>
<template>
  <div class="pv-wrap">
    <div class="preview no-native-scrollbar" ref="prevEl" v-html="html" @click="onClick" />
    <OverlayScrollbar :view="prevEl" />
  </div>
</template>
<style scoped>
.pv-wrap{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.preview{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px;font-size:0.86rem;line-height:1.6}
.preview :deep(h1){font-size:1.3rem;margin:0.6em 0 0.3em}
.preview :deep(h2){font-size:1.1rem;margin:0.6em 0 0.3em}
.preview :deep(code){font-family:var(--up-font-mono);background:var(--up-surface-2);padding:1px 5px;border-radius:4px}
.preview :deep(pre){background:var(--up-surface-2);padding:10px;border-radius:8px;overflow-x:auto}
.preview :deep(a){color:var(--up-violet-bright)}
.preview :deep(ul){padding-left:1.2em}
</style>
