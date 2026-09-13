<template>
  <section class="screen list-screen" data-archive-scroll-container>
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
        :data-archive-focus-id="`idol:${entry.id}`"
        :class="{ 'group-card': entry._isGroup }"
        :style="!entry._isGroup ? { '--idol-card-accent': normalizeIdolAccentColor(entry.color) || '#168b83' } : undefined"
        @click="emit('select', entry)"
      >
        <ArchiveIdolAvatar v-if="!entry._isGroup" class="idol-avatar" :idol-code="entry.id" :accent-color="entry.color"
          :size="64" :alt="entry.name" />
        <div v-else class="group-avatar" aria-hidden="true"></div>
        <span class="idol-name">{{ entry.name }}</span>
        <small v-if="!entry._isGroup && entry.unitName" class="idol-unit">{{ entry.unitName }}</small>
      </button>
    </div>
  </section>
</template>

<script setup>
import { LibraryBig, UsersRound } from '@lucide/vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import { normalizeIdolAccentColor } from '../../presentation/idolAccentColor.js'

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
  gap: 5px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 10px 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.idol-card:hover {
  background: color-mix(in srgb, var(--idol-card-accent, #168b83) 5%, #fff);
  border-color: color-mix(in srgb, var(--idol-card-accent, #168b83) 50%, #fff);
  transform: translateY(-2px);
  box-shadow: 0 5px 14px color-mix(in srgb, var(--idol-card-accent, #168b83) 16%, transparent);
}
.idol-card:focus-visible { outline: 2px solid var(--idol-card-accent, #168b83); outline-offset: 2px; }
.idol-name { color: #30434b; font-size: 0.78rem; font-weight: 700; text-align: center; line-height: 1.25; }
.idol-unit { max-width: 100%; overflow: hidden; color: #71838a; font-size: 0.62rem; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
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
  .idol-avatar { --idol-avatar-override-size: 58px; }
  .group-avatar { width: 58px; height: 58px; }
}
</style>
