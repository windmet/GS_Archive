<template>
  <component :is="tag" class="archive-error-note" role="alert">
    <CircleAlert class="archive-error-icon" :size="16" :stroke-width="2" aria-hidden="true" />
    <span><slot /></span>
  </component>
</template>

<script setup>
import { CircleAlert } from '@lucide/vue'

// Errors always carry an icon as well as the critical colour: a red 担当 stage light
// can sit close to that colour, so colour alone must not be the signal.
defineProps({ tag: { type: String, default: 'p' } })
</script>

<style scoped>
.archive-error-note { display: flex; align-items: flex-start; gap: var(--gs-space-2); color: var(--gs-critical); }
.archive-error-icon { flex: none; margin-top: .15em; }
</style>
