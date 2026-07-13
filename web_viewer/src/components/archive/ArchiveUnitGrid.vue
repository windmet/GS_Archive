<template>
  <section class="screen list-screen">
    <ArchiveListHeader v-if="!embedded" title="第零话" @back="emit('back')" />
    <div class="unit-grid">
      <button v-for="unit in units" :key="unit.unit_code" class="unit-card" @click="emit('select', unit)">
        <span class="unit-name">{{ unit.unit_name }}</span>
        <span class="unit-count">{{ unit.episodes.length }} episodes</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import ArchiveListHeader from './ArchiveListHeader.vue'

defineProps({
  units: { type: Array, default: () => [] },
  embedded: { type: Boolean, default: false },
})
const emit = defineEmits(['back', 'select'])
</script>

<style scoped>
.list-screen { padding: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.unit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  padding: 16px;
}
.unit-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: #fff; border: 1px solid #e8e8e8; border-radius: 8px;
  padding: 20px 10px; cursor: pointer; transition: background 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.unit-card:hover { background: #f0f4ff; border-color: #88ccff55; }
.unit-name { font-size: 0.85rem; font-weight: bold; color: #333; text-align: center; }
.unit-count { font-size: 0.7rem; color: #999; }
</style>
