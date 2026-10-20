<template>
  <div class="idol-switcher" aria-label="切换偶像">
    <button title="上一位偶像" @click="move(-1)">
      <ChevronLeft :size="18" />
    </button>
    <label>
      <span>{{ label }}</span>
      <select :value="selectedIdol" :aria-label="label" @change="emit('select', $event.target.value)">
        <option v-if="allowAll" value="">全部偶像</option>
        <option v-for="idol in idols" :key="idol.idol_code" :value="idol.idol_code">
          {{ idol.display_name }}{{ idol.unit_name ? ` · ${idol.unit_name}` : '' }}
        </option>
      </select>
    </label>
    <button title="下一位偶像" @click="move(1)">
      <ChevronRight :size="18" />
    </button>
  </div>
</template>

<script setup>
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps({
  idols: { type: Array, default: () => [] },
  selectedIdol: { type: String, default: '' },
  label: { type: String, default: '偶像' },
  allowAll: {type:Boolean,default:false},
})
const emit = defineEmits(['select'])

function move(delta) {
  const codes=props.idols.map(idol=>idol.idol_code)
  if(props.allowAll) codes.unshift('')
  const index=codes.indexOf(props.selectedIdol)
  if(index<0 || !codes.length) return
  emit('select',codes[(index+delta+codes.length)%codes.length])
}
</script>

<style scoped>
.idol-switcher { display: flex; align-items: end; gap: var(--gs-space-2); min-width: 0; }
.idol-switcher > button { display: grid; flex: 0 0 var(--gs-control-normal); place-items: center; width: var(--gs-control-normal); height: var(--gs-control-normal); padding: 0; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink-2); cursor: pointer; }
.idol-switcher label { display: flex; flex: 1; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.idol-switcher label span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.idol-switcher select { width: 100%; min-width: 230px; height: var(--gs-control-normal); padding: 0 30px 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.idol-switcher > button:focus-visible, .idol-switcher select:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (max-width: 760px) { .idol-switcher { width: 100%; } .idol-switcher select { min-width: 0; } }
</style>
