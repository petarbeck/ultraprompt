<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import OverlayScrollbar from './OverlayScrollbar.vue'
import { getCaret, saveCaret } from '../lib/caret'
const props = defineProps<{ modelValue: string; readonly?: boolean; caretKey?: number; autofocus?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
const ta = ref<HTMLTextAreaElement | null>(null)

function place() {
  const el = ta.value; if (!el) return
  const saved = props.caretKey != null ? getCaret(props.caretKey) : undefined
  const pos = saved != null ? Math.min(saved, el.value.length) : el.value.length
  el.focus()
  el.setSelectionRange(pos, pos)
}
function save() {
  const el = ta.value; if (!el || props.caretKey == null) return
  saveCaret(props.caretKey, el.selectionStart ?? el.value.length)
}
onMounted(() => { if (props.autofocus && !props.readonly) place() })
onBeforeUnmount(save)
</script>
<template>
  <div class="ed-wrap">
    <textarea ref="ta" class="editor no-native-scrollbar" :value="modelValue" :readonly="readonly"
      spellcheck="false" placeholder="# Task spec in markdown…"
      @blur="save"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" />
    <OverlayScrollbar :view="ta" />
  </div>
</template>
<style scoped>
.ed-wrap{position:relative;flex:1 1 auto;min-height:0;display:flex}
.editor{flex:1 1 auto;min-width:0;resize:none;border:none;outline:none;background:var(--up-bg);
  color:var(--up-ink);font-family:var(--up-font-mono);font-size:0.82rem;line-height:1.6;padding:14px}
.editor[readonly]{opacity:0.75}
</style>
