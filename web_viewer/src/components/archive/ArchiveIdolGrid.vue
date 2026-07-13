<template>
  <section class="screen list-screen">
    <ArchiveListHeader
      v-if="!embedded"
      :title="title"
      :filter-placeholder="filterPlaceholder"
      :model-value="modelValue"
      @back="emit('back')"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <div v-if="unitOptions.length" class="idol-toolbar">
      <button class="unit-catalog-link" @click="emit('open-units')">
        <LibraryBig :size="17" />
        <span>组合资料</span>
      </button>
      <label>
        <UsersRound :size="17" aria-hidden="true" />
        <select :value="currentUnit" @change="emit('select-unit', $event.target.value)">
          <option value="">全部组合（{{ idolsBeforeUnitFilter }}）</option>
          <option v-for="unit in unitOptions" :key="unit.id" :value="unit.id">
            {{ unit.name }}（{{ unit.count }}）
          </option>
        </select>
      </label>
    </div>
    <div class="idol-grid">
      <p v-if="!idols.length" class="empty-state">没有符合当前条件的偶像</p>
      <button
        v-for="entry in idols"
        :key="entry.id"
        class="idol-card"
        :class="{ 'group-card': entry._isGroup }"
        @click="emit('select', entry)"
      >
        <img
          v-if="!entry._isGroup"
          :src="`/assets/idols/icons/image_chara_icon_${entry.id}.png`"
          :alt="entry.name"
          class="idol-avatar"
          loading="lazy"
        />
        <div v-else class="group-avatar" aria-hidden="true"></div>
        <span class="idol-name">{{ entry.name }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { LibraryBig, UsersRound } from '@lucide/vue'
import ArchiveListHeader from './ArchiveListHeader.vue'

defineProps({
  title: { type: String, default: '' },
  filterPlaceholder: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  idols: { type: Array, default: () => [] },
  embedded: { type: Boolean, default: false },
  unitOptions: { type: Array, default: () => [] },
  currentUnit: { type: String, default: '' },
  idolsBeforeUnitFilter: { type: Number, default: 0 },
})

const emit = defineEmits(['back', 'select', 'select-unit', 'open-units', 'update:modelValue'])
</script>

<style scoped>
.list-screen { padding: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.idol-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #edf0f2; background: #fff; }
.unit-catalog-link { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 10px; border: 1px solid #d7dde2; border-radius: 6px; background: #fff; color: #168b83; cursor: pointer; font: inherit; font-size: 0.72rem; }
.unit-catalog-link:hover { border-color: #6fc8c1; background: #f2fbfa; }
.idol-toolbar label { display: flex; align-items: center; gap: 8px; color: #75808a; }
.idol-toolbar select { min-width: 210px; height: 34px; padding: 0 30px 0 10px; border: 1px solid #d7dde2; border-radius: 6px; background: #fff; color: #26313a; font: inherit; font-size: 0.76rem; }
.idol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  padding: 16px;
}
.empty-state { grid-column: 1 / -1; margin: 28px 0; color: #7a858e; font-size: 0.78rem; text-align: center; }
.idol-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 12px 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.idol-card:hover {
  background: #f0f4ff;
  border-color: #88ccff55;
  transform: translateY(-2px);
  box-shadow: 0 3px 10px rgba(0,0,0,0.08);
}
.idol-avatar {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 50%;
  background: #eee;
}
.idol-name { font-size: 0.78rem; color: #444; text-align: center; line-height: 1.2; }
.group-card { border-color: #b3d9ff; background: #f5faff; }
.group-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #dfeeff;
}

@media (max-width: 560px) {
  .idol-toolbar { align-items: stretch; flex-direction: column; padding: 8px 10px; }
  .idol-toolbar label, .idol-toolbar select, .unit-catalog-link { width: 100%; }
  .unit-catalog-link { justify-content: center; }
  .idol-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 10px; }
  .idol-card { min-width: 0; padding: 10px 5px; }
  .idol-avatar, .group-avatar { width: 58px; height: 58px; }
}
</style>
