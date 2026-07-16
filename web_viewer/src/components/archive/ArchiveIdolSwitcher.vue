<template>
  <div class="idol-switcher" :class="{ dark }" aria-label="切换偶像">
    <button title="上一位偶像" @click="move(-1)">
      <ChevronLeft :size="18" />
    </button>
    <label>
      <span>{{ label }}</span>
      <select :value="selectedIdol" @change="emit('select', $event.target.value)">
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
  dark: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

function move(delta) {
  const index = props.idols.findIndex(idol => idol.idol_code === props.selectedIdol)
  if (index < 0 || !props.idols.length) return
  emit('select', props.idols[(index + delta + props.idols.length) % props.idols.length].idol_code)
}
</script>

<style scoped>
.idol-switcher { display: flex; align-items: end; gap: 6px; min-width: 0; }
.idol-switcher > button { display: grid; flex: 0 0 34px; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid #d5dde0; border-radius: 5px; background: #fff; color: #4e5e65; cursor: pointer; }
.idol-switcher label { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
.idol-switcher label span { color: #7b888e; font-size: .56rem; }
.idol-switcher select { width: 100%; min-width: 230px; height: 34px; padding: 0 30px 0 10px; border: 1px solid #d5dde0; border-radius: 5px; background: #fff; color: #28363d; font: inherit; font-size: .67rem; }
.idol-switcher.dark label span { color: #aeb9c2; }
.idol-switcher.dark > button { border-color: #42515d; background: #22303b; color: #dce5e9; }
.idol-switcher.dark select { border-color: #42515d; background: #22303b; color: #fff; }
@media (max-width: 560px) { .idol-switcher { width: 100%; }.idol-switcher select { min-width: 0; } }
</style>
