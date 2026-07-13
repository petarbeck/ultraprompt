<script setup lang="ts">
import { computed, ref } from 'vue'
import OverlayScrollbar from './OverlayScrollbar.vue'
import { useChecklistStore } from '../stores/checklist'
const props = defineProps<{ taskId: number; readonly?: boolean }>()
const checklist = useChecklistStore()
const scrollEl = ref<HTMLElement | null>(null)
const items = computed(() => checklist.itemsByTask[props.taskId] ?? [])
const draft = ref('')
async function commitDraft() {
  const text = draft.value.trim(); if (!text) return
  draft.value = ''
  await checklist.addItem(props.taskId, text)
}
// Auto-grow the checklist textareas so long item text wraps and shows in full
// (a single-line <input> would clip it). Runs on mount, on external value change,
// and while typing.
function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}
const vAutosize = {
  mounted: (el: HTMLTextAreaElement) => autosize(el),
  updated: (el: HTMLTextAreaElement) => autosize(el),
}
</script>
<template>
  <div class="cl-wrap">
    <div class="wrap no-native-scrollbar" ref="scrollEl">
    <div class="eyebrow lbl">Checklist</div>
    <ul>
      <li v-for="it in items" :key="it.id" class="item">
        <input type="checkbox" :checked="it.isChecked" :disabled="readonly" @change="checklist.toggle(it.id)" />
        <textarea class="txt" rows="1" v-autosize :value="it.text" :readonly="readonly"
          @input="autosize($event.target as HTMLTextAreaElement)"
          @change="checklist.updateItem(it.id, { text: ($event.target as HTMLTextAreaElement).value })"></textarea>
        <button v-if="!readonly" class="del" @click="checklist.remove(it.id)">×</button>
      </li>
      <li v-if="!readonly" class="item placeholder">
        <input type="checkbox" disabled />
        <textarea class="txt" rows="1" v-autosize v-model="draft" placeholder="Add item…"
          @input="autosize($event.target as HTMLTextAreaElement)"
          @keydown.enter.exact.prevent="commitDraft" @blur="commitDraft"></textarea>
      </li>
    </ul>
    </div>
    <OverlayScrollbar :view="scrollEl" />
  </div>
</template>
<style scoped>
.cl-wrap{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.wrap{padding:14px;flex:1 1 auto;min-height:0;overflow-y:auto}
.lbl{margin-bottom:10px}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
/* flex-start so the checkbox aligns with the FIRST line of a wrapped, multi-line item. */
.item{display:flex;align-items:flex-start;gap:8px}
.item input[type=checkbox]{accent-color:var(--up-violet);width:15px;height:15px;margin-top:4px;flex:0 0 auto}
/* Auto-growing textarea: wraps long text, no manual resize, no inner scrollbar.
   min-width:0 lets it shrink in the narrow column; font-family:inherit avoids the
   default monospace textarea font. */
.txt{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--up-ink);
  font-family:inherit;font-size:0.84rem;line-height:1.4;padding:4px 6px;border-radius:6px;
  resize:none;overflow:hidden}
.txt:focus{background:var(--up-surface-2)}
.placeholder .txt{color:var(--up-muted)}
.del{background:none;border:none;color:var(--up-dim);cursor:pointer;font-size:1rem;line-height:1;
  margin-top:3px;flex:0 0 auto}
.del:hover{color:var(--up-danger)}
</style>
