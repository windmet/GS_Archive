<template>
  <div class="gs-tabs" :class="`is-${size}`" role="group" :aria-label="ariaLabel">
    <button v-for="option in options" :key="String(option.value)" type="button" class="gs-tab" :aria-pressed="option.value === modelValue"
      @click="option.value === modelValue || emit('update:modelValue', option.value)">
      {{ option.label }}<small v-if="option.count !== undefined && option.count !== null">{{ option.count }}</small>
    </button>
  </div>
</template>

<script setup>
// Underline tabs for 3–5 categories (线框减法册 rule 2): the tab row's own bottom rule is the section's one
// rule, the current tab is ink with the mint underline. Two tiers: page 44px, panel 36px. The same idiom as
// the 图鉴 tabs; more values go to GsFilterMenu, two values to a text toggle.
defineProps({
  modelValue: { type: [String, Number, Boolean], default: null },
  options: { type: Array, required: true },
  ariaLabel: { type: String, required: true },
  size: { type: String, default: 'page', validator: value => ['page', 'panel'].includes(value) },
})
const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.gs-tabs { display: flex; align-items: stretch; gap: var(--gs-space-6); box-sizing: border-box; height: 44px; min-width: 0; border-bottom: 1px solid var(--gs-line); overflow-x: auto; scrollbar-width: none; }
.gs-tabs::-webkit-scrollbar { display: none; }
.gs-tabs.is-panel { gap: var(--gs-space-5); height: 36px; }
.gs-tab { display: inline-flex; flex: none; align-items: center; gap: 6px; margin-bottom: -1px; padding: 0 var(--gs-space-1); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); white-space: nowrap; cursor: pointer; }
.is-panel .gs-tab { font-size: var(--gs-text-meta); }
.gs-tab small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); font-variant-numeric: tabular-nums; }
.gs-tab[aria-pressed='true'] { border-bottom-color: var(--gs-selected-line); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.gs-tab:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (hover: hover) { .gs-tab:hover { color: var(--gs-ink); } }
</style>
