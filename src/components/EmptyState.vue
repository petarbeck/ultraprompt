<script setup lang="ts">defineProps<{ title: string; hint?: string }>()</script>
<template>
  <div class="empty">
    <div class="disc">💡</div>
    <h2>{{ title }}</h2>
    <p v-if="hint">{{ hint }}</p>
  </div>
</template>
<style scoped>
.empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:24px}
.disc{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2rem;
  background:radial-gradient(circle,var(--up-orchid-glow),transparent 70%),var(--up-surface);border:1px solid var(--up-border)}
h2{font-size:1.1rem}
p{color:var(--up-muted);max-width:26rem}
</style>
