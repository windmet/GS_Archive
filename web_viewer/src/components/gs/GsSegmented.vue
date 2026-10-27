<template>
  <div ref="root" class="gs-segmented" :class="{ 'on-dark': onDark, compact }" role="radiogroup" :aria-label="ariaLabel" :style="{ '--segments': options.length, '--selected': Math.max(selectedIndex, 0) }" @keydown="onKey">
    <span v-if="selectedIndex >= 0" class="gs-segmented-thumb" aria-hidden="true"></span>
    <button v-for="(option, index) in options" :key="option.value" type="button" role="radio" class="gs-segmented-option" :aria-checked="index === selectedIndex" :aria-label="option.ariaLabel || undefined" :tabindex="index === focusIndex ? 0 : -1" :disabled="option.disabled" :lang="option.lang" @click="choose(option)">
      <span class="gs-segmented-label"><slot :option="option">{{ option.label }}</slot></span><span v-if="option.short" class="gs-segmented-short" aria-hidden="true">{{ option.short }}</span>
    </button>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { segmentedNextIndex } from '../../presentation/GsSegmentedKeys.mjs'
// Mode switch: a recessed track with one white thumb that slides to the chosen segment.
// options: [{ value, label, short?, ariaLabel?, lang?, disabled? }]; at most three segments by the design rules.
// `compact` swaps each label for its `short` form when the row is too tight. The default slot receives { option }
// to draw richer content (an avatar beside a name) inside a segment.
const props = defineProps({ modelValue: { type: [String, Number, Boolean], default: null }, options: { type: Array, required: true }, ariaLabel: { type: String, required: true }, onDark: Boolean, compact: Boolean })
const emit = defineEmits(['update:modelValue'])
const root = ref(null)
const selectedIndex = computed(() => props.options.findIndex(option => option.value === props.modelValue))
// Roving tabindex: the chosen segment is the tab stop; with no choice yet, the first enabled one.
const focusIndex = computed(() => selectedIndex.value >= 0 ? selectedIndex.value : props.options.findIndex(option => !option.disabled))
function choose(option) { if (!option.disabled && option.value !== props.modelValue) emit('update:modelValue', option.value) }
function onKey(event) {
  const next = segmentedNextIndex(props.options, focusIndex.value, event.key)
  if (next < 0) return
  event.preventDefault()
  choose(props.options[next])
  root.value?.querySelectorAll('[role=radio]')[next]?.focus()
}
</script>
<style scoped>
.gs-segmented { --gs-seg-pad: var(--gs-space-2); position: relative; display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: var(--gs-seg-pad); border-radius: var(--gs-radius-control); background: var(--gs-mode-track); }
.gs-segmented-thumb { position: absolute; top: var(--gs-seg-pad); bottom: var(--gs-seg-pad); left: var(--gs-seg-pad); width: calc((100% - 2 * var(--gs-seg-pad)) / var(--segments)); border-radius: var(--gs-radius-segment); background: var(--gs-mode-thumb); box-shadow: var(--gs-shadow-1); transform: translateX(calc(var(--selected) * 100%)); transition: transform var(--gs-current-motion); }
.gs-segmented-option { position: relative; display: inline-flex; align-items: center; justify-content: center; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-segment); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); white-space: nowrap; cursor: pointer; }
.gs-segmented-option[aria-checked=true] { color: var(--gs-mode-ink); }
.gs-segmented-option:disabled { color: var(--gs-ink-3); cursor: default; opacity: .6; }
.gs-segmented-option:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.gs-segmented-short { display: none; }
.gs-segmented.compact .gs-segmented-label:not(:only-child) { display: none; }
.gs-segmented.compact .gs-segmented-short { display: inline; }
@media (max-width: 760px) { .gs-segmented-option { min-height: var(--gs-control-touch); } }
/* Dark tools: the track is a faint lift of the stage, the thumb the stage's own raised surface. */
.gs-segmented.on-dark { background: var(--gs-stage-track); }
.gs-segmented.on-dark .gs-segmented-thumb { background: var(--gs-stage-thumb); box-shadow: none; }
.gs-segmented.on-dark .gs-segmented-option { color: var(--gs-stage-ink-2); }
.gs-segmented.on-dark .gs-segmented-option[aria-checked=true] { color: var(--gs-stage-ink); }
@media (prefers-reduced-motion: reduce) { .gs-segmented-thumb { transition: none; } }
</style>
