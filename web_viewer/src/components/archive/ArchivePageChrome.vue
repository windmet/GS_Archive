<template>
  <header class="archive-page-chrome">
    <ArchiveBackAction v-if="canGoBack" :class="backClass" :label="backLabel" :pill="backPill" @back="emit('back')" />
    <slot name="before-title" />
    <slot name="title" />
    <slot name="actions" />
  </header>
</template>

<script setup>
import ArchiveBackAction from './ArchiveBackAction.vue'

defineProps({
  canGoBack: { type: Boolean, default: true },
  backLabel: { type: String, default: '返回' },
  backClass: { type: String, default: '' },
  backPill: { type: Boolean, default: false },
})
const emit = defineEmits(['back'])
</script>

<style scoped>
.archive-page-chrome { min-width: 0; }
</style>
