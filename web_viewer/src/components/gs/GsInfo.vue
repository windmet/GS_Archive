<template>
  <span class="gs-info" @mouseenter="hover = true" @mouseleave="hover = false" @keydown.esc="close">
    <button ref="trigger" type="button" class="gs-info-button" :aria-label="label" :aria-expanded="shown" :aria-describedby="shown ? id : undefined" @click="pinned = !pinned" @focus="focused = true" @blur="focused = false"><Info :size="14" aria-hidden="true" /></button>
    <span v-if="shown" :id="id" role="tooltip" class="gs-info-bubble"><slot /></span>
  </span>
</template>
<script>
let infoCount = 0
</script>
<script setup>
import { computed, ref } from 'vue'
import { Info } from '@lucide/vue'
// "How to use this" in at most two lines, shown on hover, keyboard focus or tap. Anything longer
// ("what is this based on") belongs in maintainer mode or the About page, not here.
defineProps({ label: { type: String, default: '说明' } })
const id = `gs-info-${++infoCount}`
const hover = ref(false), focused = ref(false), pinned = ref(false), trigger = ref(null)
const shown = computed(() => hover.value || focused.value || pinned.value)
function close() { pinned.value = false; hover.value = false; focused.value = false }
</script>
<style scoped>
.gs-info { position: relative; display: inline-flex; vertical-align: middle; }
.gs-info-button { display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--gs-ink-3); cursor: pointer; }
.gs-info-button:hover { background: var(--gs-hover); color: var(--gs-ink-2); }
.gs-info-button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.gs-info-bubble { position: absolute; z-index: 20; top: calc(100% + var(--gs-space-2)); left: 50%; width: max-content; max-width: min(260px, calc(100vw - 2 * var(--gs-space-5))); padding: var(--gs-space-3) var(--gs-space-4); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-2); box-shadow: var(--gs-shadow-console); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); line-height: var(--gs-leading-ui); text-align: left; transform: translateX(-50%); }
</style>
