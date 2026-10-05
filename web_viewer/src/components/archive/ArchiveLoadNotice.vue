<template>
  <div class="archive-load-notice" role="alert">
    <CircleAlert :size="18" aria-hidden="true" />
    <p>{{ message }}</p>
  </div>
</template>

<script setup>
import { CircleAlert } from '@lucide/vue'

// The single reader-facing place for "this page could not be read" messages.
// In-progress states use GsLoadingIndicator; callers own the copy.
defineProps({ message: { type: String, required: true } })
</script>

<style scoped>
.archive-load-notice {
  box-sizing: border-box; display: flex; align-items: center; gap: var(--gs-space-4);
  max-width: min(420px, 100%); padding: var(--gs-space-5) var(--gs-space-6);
  border-radius: var(--gs-radius-panel); background: rgb(255 255 255 / 96%);
  box-shadow: 0 8px 32px rgb(22 47 56 / 12%); color: var(--gs-color-ink);
}
.archive-load-notice svg { flex: none; color: var(--gs-color-muted); }
.archive-load-notice p { margin: 0; font-size: var(--gs-text-body); line-height: 1.6; }
</style>
