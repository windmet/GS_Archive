<template>
  <div class="reader-top">
    <ArchivePageChrome class="reader-heading-row" back-class="reader-back" @back="emit('back')">
      <template #title><span class="reader-section-title"><slot /></span></template>
    </ArchivePageChrome>
  </div>
</template>

<script setup>
import ArchivePageChrome from './ArchivePageChrome.vue'
const emit = defineEmits(['back'])
</script>

<style scoped>
.reader-top { border-bottom: 1px solid var(--reader-border); background: var(--reader-bg-page); }
.reader-heading-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: calc(76px + var(--archive-safe-top));
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--archive-safe-top) max(24px, var(--archive-safe-right)) 0 max(24px, var(--archive-safe-left));
}
.reader-section-title { min-width: 0; color: var(--reader-text-main); font-size: 16px; font-weight: 700; line-height: 1.5; overflow-wrap: anywhere; }
.reader-heading-row :deep(.reader-back:focus-visible) { outline-color: var(--reader-accent-text); }
@media (max-width: 760px) {
  .reader-heading-row { min-height: calc(64px + var(--archive-safe-top)); gap: 12px; padding-inline: max(14px, var(--archive-safe-left)) max(14px, var(--archive-safe-right)); }
}
</style>
