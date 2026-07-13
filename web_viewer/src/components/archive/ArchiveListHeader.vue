<template>
  <header class="list-header">
    <button class="back-btn" @click="emit('back')">← Back</button>
    <h2>{{ title }}</h2>
  </header>
  <div v-if="filterPlaceholder || $slots.filters" class="filter-bar">
    <slot name="filters">
      <input
        :value="modelValue"
        :placeholder="filterPlaceholder"
        class="filter-input"
        @input="emit('update:modelValue', $event.target.value)"
      />
    </slot>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  filterPlaceholder: { type: String, default: '' },
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['back', 'update:modelValue'])
</script>

<style scoped>
.list-header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.list-header h2 {
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  flex: 1;
  color: #222;
  overflow-wrap: anywhere;
}
.back-btn {
  flex: 0 0 auto;
  background: transparent;
  color: #4488cc;
  border: 1px solid #c0d8ee;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 0.85rem;
}
.back-btn:hover { background: #e8f0ff; }
.filter-bar {
  position: sticky;
  top: 48px;
  z-index: 5;
  padding: 8px 16px;
  background: #f8f9fa;
}
.filter-input {
  width: 100%;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #ccc;
  color: #222;
  border-radius: 6px;
  font-size: 0.85rem;
}
.filter-input:focus {
  outline: none;
  border-color: #88ccff;
  box-shadow: 0 0 0 2px rgba(136,204,255,0.2);
}
</style>
