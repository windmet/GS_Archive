<template>
  <div class="idol-switcher" role="group" aria-label="切换偶像">
    <ArchivePersonPicker :idols="pickerIdols" :model-value="selectedIdol" :idol-name="nameOf" :label="label" :allow-all="allowAll" @update:model-value="emit('select', $event)" />
    <div class="idol-step-group">
      <button type="button" class="idol-step" title="上一位偶像" aria-label="上一位偶像" @click="move(-1)"><ChevronLeft :size="17" /></button>
      <button type="button" class="idol-step" title="下一位偶像" aria-label="下一位偶像" @click="move(1)"><ChevronRight :size="17" /></button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import ArchivePersonPicker from './ArchivePersonPicker.vue'

// Previous / next stay for pages that read idols in order; choosing one goes through the person picker.
const props = defineProps({
  idols: { type: Array, default: () => [] },
  selectedIdol: { type: String, default: '' },
  label: { type: String, default: '偶像' },
  allowAll: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const pickerIdols = computed(() => props.idols.map(idol => ({ id: idol.idol_code, name: idol.display_name, unitName: idol.unit_name || '', color: idol.color || '' })))
const nameOf = code => props.idols.find(idol => idol.idol_code === code)?.display_name || ''

function move(delta) {
  const codes = props.idols.map(idol => idol.idol_code)
  if (props.allowAll) codes.unshift('')
  const index = codes.indexOf(props.selectedIdol)
  if (index < 0 || !codes.length) return
  emit('select', codes[(index + delta + codes.length) % codes.length])
}
</script>

<style scoped>
.idol-switcher { display: flex; align-items: stretch; gap: var(--gs-space-2); min-width: 0; }
.idol-switcher > :first-child { flex: 1; min-width: 180px; }
.idol-step-group { display: inline-flex; flex: none; align-items: stretch; overflow: hidden; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); }
.idol-step { display: grid; flex: none; place-items: center; width: 38px; min-height: 38px; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--gs-ink-2); cursor: pointer; }
.idol-step + .idol-step { border-left: 1px solid var(--gs-line); }
.idol-step:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (hover: hover) { .idol-step:hover { background: var(--gs-hover); color: var(--gs-ink); } }
@media (max-width: 760px) { .idol-switcher { width: 100%; } .idol-switcher > :first-child { min-width: 0; } .idol-step { width: 42px; min-height: calc(var(--gs-control-touch) - 2px); } }
</style>
