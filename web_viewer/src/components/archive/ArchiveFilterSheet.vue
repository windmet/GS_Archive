<template>
  <div v-if="!compact" class="filter-inline"><slot /></div>
  <template v-else>
    <button class="filter-sheet-trigger" type="button" :aria-expanded="open" @click="open = true">
      <SlidersHorizontal :size="17" aria-hidden="true" />筛选<small v-if="activeCount">{{ activeCount }}</small>
    </button>
    <ArchiveTerminalDialog class="filter-sheet" :open="open" :title="title" :title-id="titleId" @close="open = false">
      <div class="filter-sheet-body"><slot /></div>
      <button class="filter-sheet-done" type="button" @click="open = false">完成</button>
    </ArchiveTerminalDialog>
  </template>
</template>
<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { SlidersHorizontal } from '@lucide/vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
// Phone toolbar rule: one search line plus a "筛选" button; every other filter lives in a bottom
// sheet. On wider screens the same controls sit inline, so a page writes its filters once.
defineProps({ title: { type: String, default: '筛选' }, titleId: { type: String, required: true }, activeCount: { type: Number, default: 0 } })
const open = ref(false)
const query = typeof window === 'undefined' ? null : window.matchMedia?.('(max-width: 760px)')
const compact = ref(Boolean(query?.matches))
const sync = event => { compact.value = event.matches; if (!event.matches) open.value = false }
query?.addEventListener?.('change', sync)
onBeforeUnmount(() => query?.removeEventListener?.('change', sync))
</script>
<style>
.filter-inline { display: contents; }
.filter-sheet-trigger { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; gap: 6px; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.filter-sheet-trigger small { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: var(--gs-radius-pill); background: var(--gs-ink); color: var(--gs-paper); font-size: var(--gs-text-caption); }
/* A bottom sheet on phones: full width, anchored to the bottom edge, rounded only on top. */
.terminal-dialog.filter-sheet { width: 100%; max-width: none; max-height: 85dvh; margin: auto 0 0; border-radius: 0; border-top-left-radius: var(--gs-radius-panel); border-top-right-radius: var(--gs-radius-panel); }
.filter-sheet .terminal-dialog-body { padding-bottom: calc(var(--gs-space-5) + var(--gs-safe-bottom)); }
.filter-sheet-body { display: grid; gap: var(--gs-space-5); }
.filter-sheet-body label { display: grid !important; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.filter-sheet-body label > span { display: inline !important; }
.filter-sheet-body select, .filter-sheet-body input { width: 100% !important; max-width: none !important; min-height: var(--gs-control-touch) !important; font-size: var(--gs-text-subtitle) !important; }
.filter-sheet-done { width: 100%; min-height: var(--gs-control-touch); margin-top: var(--gs-space-6); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-ink); color: var(--gs-paper); font: inherit; font-weight: var(--gs-weight-semibold); cursor: pointer; }
</style>
