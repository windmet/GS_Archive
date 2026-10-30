<template>
  <span class="gs-choice" role="group" :aria-label="ariaLabel">
    <template v-for="(option, index) in options" :key="String(option.value)">
      <span v-if="index" class="gs-choice-divider" aria-hidden="true">/</span>
      <button type="button" :aria-pressed="option.value === modelValue" :disabled="disabled" @click="option.value === modelValue || emit('update:modelValue', option.value)">{{ option.label }}</button>
    </template>
  </span>
</template>

<script setup>
// Text toggle for two or three values inside a settings row (线框减法册 rule 2): 「圆形 / 菱形 / 横条」, the current
// value ink and bold, the others grey, no box — the same idiom as the 中 / 日 language switch. More values go to
// GsFilterMenu.
defineProps({
  modelValue: { type: [String, Number, Boolean], default: null },
  options: { type: Array, required: true },
  ariaLabel: { type: String, required: true },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.gs-choice { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; min-width: 0; }
.gs-choice-divider { color: var(--gs-rule); font-size: var(--gs-text-meta); }
.gs-choice button { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-3); border: 0; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); white-space: nowrap; cursor: pointer; }
.gs-choice button[aria-pressed='true'] { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.gs-choice button:disabled { opacity: .45; cursor: default; }
.gs-choice button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (hover: hover) { .gs-choice button:not(:disabled):hover { color: var(--gs-ink); } }
</style>
