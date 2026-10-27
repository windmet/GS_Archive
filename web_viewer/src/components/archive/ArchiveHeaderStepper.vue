<template>
  <nav class="archive-header-stepper" :aria-label="label">
    <button type="button" :disabled="!previous" :aria-label="previous ? `上一${unit}：${titleOf(previous)}` : `已经是第一${unit}`" :title="previous ? titleOf(previous) : `已经是第一${unit}`" @click="emit('step', previous)"><ChevronLeft :size="20" aria-hidden="true" /></button>
    <button type="button" :disabled="!next" :aria-label="next ? `下一${unit}：${titleOf(next)}` : `已经是最后一${unit}`" :title="next ? titleOf(next) : `已经是最后一${unit}`" @click="emit('step', next)"><ChevronRight :size="20" aria-hidden="true" /></button>
  </nav>
</template>

<script setup>
import { ChevronLeft, ChevronRight } from '@lucide/vue'

// Previous / next for a detail page, as two icon buttons at the right of the title row (booklet 2.0:
// stepping is page chrome, not a row in the identity block). The page names its neighbours.
defineProps({
  label: { type: String, required: true },
  unit: { type: String, default: '张' },
  previous: { type: Object, default: null },
  next: { type: Object, default: null },
  titleOf: { type: Function, required: true },
})
const emit = defineEmits(['step'])
</script>

<style scoped>
.archive-header-stepper { display: flex; flex: none; gap: 2px; margin-right: var(--gs-space-2); }
.archive-header-stepper button { display: grid; place-items: center; width: var(--gs-control-normal); height: var(--gs-control-normal); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); cursor: pointer; }
.archive-header-stepper button:disabled { color: var(--gs-rule); cursor: default; }
.archive-header-stepper button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: 2px; }
@media (hover: hover) { .archive-header-stepper button:hover:not(:disabled) { background: var(--gs-hover); color: var(--gs-ink); } }
@media (max-width: 760px) { .archive-header-stepper button { width: var(--gs-control-touch); height: var(--gs-control-touch); } }
</style>
