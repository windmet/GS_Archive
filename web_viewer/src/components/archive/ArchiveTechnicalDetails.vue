<template>
  <details v-if="hasContent" class="archive-technical" data-technical-details>
    <summary>{{ label }}</summary>
    <div class="archive-technical-body">
      <slot />
      <pre v-if="showEvidence">{{ JSON.stringify(evidence, null, 2) }}</pre>
    </div>
  </details>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import { isMaintainerMode } from '../../core/maintainerMode.js'

const props = defineProps({
  label: { type: String, default: '资料来源' },
  evidence: { type: [Object, Array], default: null },
})
const slots = useSlots()
// Raw evidence is a maintainer tool; readers only see written-out sources.
const showEvidence = computed(() => props.evidence != null && isMaintainerMode())
const hasContent = computed(() => Boolean(slots.default) || showEvidence.value)
</script>

<style scoped>
.archive-technical { min-width: 0; margin-top: var(--gs-space-5); color: var(--gs-color-muted); }
summary { padding: var(--gs-space-4) 0; min-height: var(--gs-control-touch); box-sizing: border-box; cursor: pointer; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
summary:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-color-accent); outline-offset: 2px; }
.archive-technical-body { padding-bottom: var(--gs-space-5); overflow-wrap: anywhere; font-size: var(--gs-text-meta); }
pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: var(--gs-text-caption); line-height: 1.6; }
</style>
