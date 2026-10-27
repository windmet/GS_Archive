<template>
  <nav class="collection-tabs" aria-label="图鉴分类">
    <button v-for="tab in tabs" :key="tab.id" type="button" class="collection-tab" :aria-current="tab.id === current ? 'page' : undefined" @click="tab.id === current || emit('select', tab.id)">
      {{ tab.label }}<small v-if="tab.count !== null">{{ tab.count }}</small>
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { sectionLabel } from '../../core/archiveSections.js'

// 图鉴 is one page with six categories: the sidebar has one entry, these tabs choose the category. The numbers are the
// portal's own collection counts, shown only when that summary is loaded.
const COUNT_KEYS = { collections: 'items', honors: 'honors', currencies: 'currencies', costumes: 'costumes', photos: 'photos', unused: null }
const props = defineProps({ current: { type: String, default: '' }, counts: { type: Object, default: null } })
const emit = defineEmits(['select'])
const tabs = computed(() => Object.entries(COUNT_KEYS).map(([id, key]) => {
  const value = key && props.counts ? props.counts[key] : null
  return { id, label: sectionLabel(id), count: Number.isFinite(value) ? value : null }
}))
</script>

<style scoped>
.collection-tabs { display: flex; align-items: stretch; gap: var(--gs-space-7); box-sizing: border-box; height: 44px; min-width: 0; padding: 0 var(--gs-gutter); border-bottom: 1px solid var(--gs-line); background: var(--gs-paper); overflow-x: auto; scrollbar-width: none; }
.collection-tabs::-webkit-scrollbar { display: none; }
.collection-tab { display: inline-flex; flex: none; align-items: center; gap: 6px; padding: 0 var(--gs-space-1); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); white-space: nowrap; cursor: pointer; }
.collection-tab small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.collection-tab:hover { color: var(--gs-ink); }
.collection-tab[aria-current='page'] { border-bottom-color: var(--gs-selected-line); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.collection-tab:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (max-width: 760px) { .collection-tabs { gap: var(--gs-space-6); padding: 0 var(--gs-space-5); } }
</style>
