<template>
  <ArchivePageChrome class="list-header" back-class="back-btn" @back="emit('back')"><template #title><h2>{{ title }}</h2></template></ArchivePageChrome>
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
import ArchivePageChrome from './ArchivePageChrome.vue'
defineProps({
  title: { type: String, default: '' },
  filterPlaceholder: { type: String, default: '' },
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['back', 'update:modelValue'])
</script>

<style scoped>
.list-header {
  --archive-back-ink: var(--gs-mint-ink);
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--gs-surface);
  border-bottom: 1px solid var(--gs-line);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.list-header h2 {
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  flex: 1;
  color: var(--gs-ink);
  overflow-wrap: anywhere;
}
.filter-bar {
  position: sticky;
  top: 69px;
  z-index: 5;
  padding: 8px 16px;
  background: var(--gs-paper);
}
.filter-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--gs-surface);
  border: 1px solid var(--gs-rule);
  color: var(--gs-ink);
  border-radius: 6px;
  font-size: 0.85rem;
}
.filter-input:focus {
  outline: none;
  border-color: var(--gs-rule);
  box-shadow: 0 0 0 2px rgba(136,204,255,0.2);
}
</style>
