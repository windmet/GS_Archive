<template>
  <div class="gs-row" :class="{ stacked }">
    <div class="gs-row-copy"><span class="gs-row-label"><slot name="label">{{ label }}</slot><GsInfo v-if="$slots.info" :label="label ? `${label}：说明` : '说明'"><slot name="info" /></GsInfo></span><small v-if="hint" class="gs-row-hint">{{ hint }}</small></div>
    <div class="gs-row-control"><slot /></div>
  </div>
</template>
<script setup>
import GsInfo from './GsInfo.vue'
// One settings row: label (and a one-line hint) left, the control right, a hairline underneath.
// The control in the default slot carries its own aria-label.
defineProps({ label: { type: String, default: '' }, hint: { type: String, default: '' }, stacked: Boolean })
</script>
<style scoped>
.gs-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--gs-gap-stack); min-height: var(--gs-row); padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); }
.gs-row-copy { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.gs-row-label { display: inline-flex; align-items: center; gap: var(--gs-space-2); color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); overflow-wrap: anywhere; }
.gs-row-hint { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: var(--gs-leading-ui); }
.gs-row-control { display: flex; align-items: center; justify-content: flex-end; gap: var(--gs-gap-inline); min-width: 0; }
.gs-row.stacked { grid-template-columns: minmax(0, 1fr); }
.gs-row.stacked .gs-row-control { justify-content: flex-start; }
</style>
