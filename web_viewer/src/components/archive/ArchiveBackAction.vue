<template>
  <button type="button" class="archive-back-action" :class="{ 'is-pill': pill }" @click="emit('back')">
    <ArrowLeft :size="18" :stroke-width="1.8" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>

<script setup>
import { ArrowLeft } from '@lucide/vue'

defineProps({
  label: { type: String, default: '返回' },
  pill: { type: Boolean, default: false },
})
const emit = defineEmits(['back'])
</script>

<style scoped>
.archive-back-action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 44px;
  min-height: 44px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--archive-back-ink, #16838d);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  line-height: 1.3;
  white-space: nowrap;
}
.archive-back-action.is-pill {
  border: 1px solid var(--archive-back-border, #cde7eb);
  border-radius: 24px;
  background: var(--archive-back-fill, transparent);
}
.archive-back-action:hover { background: var(--archive-back-hover, #eaf8f6); }
.archive-back-action:focus-visible { outline: 3px solid #168f98; outline-offset: 3px; }
</style>
