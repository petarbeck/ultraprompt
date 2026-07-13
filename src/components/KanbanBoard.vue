<script setup lang="ts">
import Lane from './Lane.vue'
import UltrapromptPanel from './UltrapromptPanel.vue'
import EmptyState from './EmptyState.vue'
import { useLanesStore } from '../stores/lanes'
import { useProjectsStore } from '../stores/projects'
const lanes = useLanesStore(); const projects = useProjectsStore()
</script>
<template>
  <div class="board-wrap" v-if="projects.activeProjectId">
    <div class="lanes">
      <Lane v-for="l in lanes.lanes" :key="l.id" :lane="l" />
    </div>
    <UltrapromptPanel />
  </div>
  <EmptyState v-else title="No project selected" hint="Add a project in Settings to start a board." />
</template>
<style scoped>
.board-wrap{display:flex;gap:12px;padding:16px;flex:1 1 auto;min-height:0;align-items:stretch}
/* Lanes scroll horizontally; the ULTRAPROMPT panel stays pinned to the right. */
.lanes{flex:1 1 auto;display:flex;gap:12px;overflow-x:auto;align-items:flex-start;min-width:0}
</style>
