<script setup lang="ts">
import { useUiStore } from '../stores/ui'
import { useTasksStore } from '../stores/tasks'
const ui = useUiStore(); const tasks = useTasksStore()
async function undo() {
  const t = ui.toast
  ui.dismissToast()
  if (t?.undoAction) { await t.undoAction(); return }
  if (t?.undoPayload) await tasks.restore(t.undoPayload)
}
</script>
<template>
  <transition name="toast">
    <div v-if="ui.toast" class="toast">
      <span class="msg">{{ ui.toast.message }}</span>
      <button v-if="ui.toast.undoPayload || ui.toast.undoAction" class="undo" @click="undo">Undo</button>
      <button class="x" @click="ui.dismissToast()" aria-label="Dismiss">×</button>
    </div>
  </transition>
</template>
<style scoped>
.toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:1200;
  display:flex;align-items:center;gap:14px;background:var(--up-surface-2);
  border:1px solid var(--up-border-strong);border-radius:10px;padding:10px 12px 10px 16px;
  box-shadow:0 12px 34px rgba(0,0,0,0.6);color:var(--up-ink);font-size:0.84rem}
.undo{background:none;border:none;color:var(--up-violet-bright);font-weight:600;font-size:0.84rem;cursor:pointer;padding:2px 4px}
.undo:hover{color:var(--up-violet)}
.x{background:none;border:none;color:var(--up-dim);cursor:pointer;font-size:1.1rem;line-height:1;padding:0 2px}
.x:hover{color:var(--up-ink)}
.toast-enter-active,.toast-leave-active{transition:opacity .18s ease,transform .18s ease}
.toast-enter-from,.toast-leave-to{opacity:0;transform:translate(-50%,10px)}
</style>
