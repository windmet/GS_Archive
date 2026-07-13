<template>
  <section class="screen list-screen">
    <ArchiveListHeader
      v-if="!embedded"
      :title="title"
      filter-placeholder="Search group..."
      :model-value="modelValue"
      @back="emit('back')"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <div class="group-list">
      <button
        v-for="group in groups"
        :key="group.id"
        class="group-card"
        :class="{ 'group-card-event': group.event_meta }"
        @click="emit('select', group)"
      >
        <template v-if="group.event_meta">
          <div class="event-img-wrap">
            <img
              :src="group.event_meta.logo"
              :alt="group.event_meta.title"
              class="event-logo"
              loading="lazy"
            />
          </div>
          <div class="event-info">
            <span class="event-series">{{ group.event_meta.series }}</span>
            <span class="event-title">{{ group.event_meta.title }}</span>
            <span v-if="group.event_meta.catchphrase" class="event-catchphrase">{{ group.event_meta.catchphrase }}</span>
          </div>
        </template>
        <template v-else>
          <span class="group-title">{{ group.title }}</span>
          <span class="group-meta">{{ groupFileCount(group) }} files</span>
        </template>
      </button>
    </div>
  </section>
</template>

<script setup>
import ArchiveListHeader from './ArchiveListHeader.vue'
import { groupFileCount } from '../../utils/IndexNormalizer.js'

defineProps({
  title: { type: String, default: '' },
  groups: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
})

const emit = defineEmits(['back', 'select', 'update:modelValue'])
</script>

<style scoped>
.list-screen { padding: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.group-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  padding: 16px;
}
.group-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 82px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  text-align: left;
  color: #444;
  transition: background 0.15s, box-shadow 0.15s;
}
.group-card:hover { background: #f5f7fa; color: #222; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
.group-title { display: block; font-size: 0.85rem; color: #333; line-height: 1.3; }
.group-meta { font-size: 0.7rem; color: #999; margin-top: auto; }
.group-card-event { align-items: stretch; padding: 0; overflow: hidden; }
.event-img-wrap {
  width: 100%; height: 140px; display: flex; align-items: center; justify-content: center;
  background: #f0f2f5; overflow: hidden;
}
.event-logo { width: 100%; height: 100%; object-fit: contain; display: block; background: #f0f2f5; }
.event-info { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px 10px; flex: 1; }
.event-series { font-size: 0.65rem; color: #b8860b; text-transform: uppercase; font-weight: 600; }
.event-title { font-size: 0.82rem; color: #111; font-weight: bold; line-height: 1.3; }
.event-catchphrase { font-size: 0.7rem; color: #777; font-style: italic; line-height: 1.2; }
</style>
