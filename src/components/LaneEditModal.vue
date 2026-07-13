<script setup lang="ts">
import { ref } from 'vue'
import { useLanesStore } from '../stores/lanes'
import type { Lane } from '../db/types'
const props = defineProps<{ lane: Lane | null }>() // null = create new
const emit = defineEmits<{ (e: 'close'): void }>()
const lanes = useLanesStore()
const name = ref(props.lane?.name ?? '')
const emoji = ref(props.lane?.emoji ?? '')
async function save() {
  if (!name.value.trim()) return
  if (props.lane) await lanes.update(props.lane.id, { name: name.value.trim(), emoji: emoji.value.trim() })
  else await lanes.add({ name: name.value.trim(), emoji: emoji.value.trim() })
  emit('close')
}
</script>
<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="editmodal">
      <header class="eh">
        <h3>{{ lane ? 'Edit lane' : 'New lane' }}</h3>
        <button class="x" @click="emit('close')" aria-label="Close">×</button>
      </header>
      <div class="row">
        <label class="fld emoji"><span>Emoji</span>
          <input v-model="emoji" placeholder="🔥" maxlength="4" /></label>
        <label class="fld grow"><span>Name</span>
          <input v-model="name" placeholder="Lane name" @keyup.enter="save" /></label>
      </div>
      <footer class="ef">
        <button class="ghost" @click="emit('close')">Cancel</button>
        <button class="primary" :disabled="!name.trim()" @click="save">{{ lane ? 'Save' : 'Create' }}</button>
      </footer>
    </div>
  </div>
</template>
<style scoped>
.backdrop{position:fixed;inset:0;background:rgba(3,2,8,0.55);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:70}
.editmodal{width:400px;max-width:92vw;background:var(--up-surface);border:1px solid var(--up-border);
  border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,0.65);padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.eh{display:flex;justify-content:space-between;align-items:center}
.eh h3{font-size:0.95rem;margin:0}
.x{background:none;border:none;color:var(--up-muted);font-size:1.3rem;line-height:1;cursor:pointer}
.x:hover{color:var(--up-ink)}
.row{display:flex;gap:10px}
.fld{display:flex;flex-direction:column;gap:5px}
.fld.grow{flex:1}
.fld.emoji{width:72px}
.fld span{font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--up-muted);font-weight:600}
.fld input{background:var(--up-bg);border:1px solid var(--up-border-strong);border-radius:7px;
  color:var(--up-ink);font-size:0.84rem;padding:8px 10px;outline:none;width:100%}
.fld.emoji input{text-align:center;font-size:1.05rem}
.fld input:focus{border-color:var(--up-violet)}
.ef{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
.ghost{background:none;border:1px solid var(--up-border-strong);border-radius:7px;color:var(--up-muted);
  font-size:0.82rem;padding:7px 14px;cursor:pointer}
.ghost:hover{color:var(--up-ink)}
.primary{background:var(--up-btn);border:none;border-radius:7px;color:#fdfbff;font-size:0.82rem;font-weight:600;
  padding:7px 16px;cursor:pointer;box-shadow:0 8px 22px var(--up-btn-shadow)}
.primary:disabled{opacity:0.45;cursor:not-allowed;box-shadow:none}
</style>
