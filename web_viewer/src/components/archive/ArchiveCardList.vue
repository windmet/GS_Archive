<template>
  <section class="screen list-screen">
    <ArchiveListHeader v-if="!embedded" :title="title" @back="emit('back')">
      <template #filters>
        <input
          :value="modelValue"
          placeholder="Search card..."
          class="filter-input"
          @input="emit('update:modelValue', $event.target.value)"
        />
      </template>
    </ArchiveListHeader>

    <div class="embedded-filters" aria-label="卡片目录工具栏">
      <div class="card-rarity-tabs">
        <button
          v-for="tab in rarityTabs"
          :key="tab.id"
          class="card-rarity-tab"
          :class="{ active: currentRarity === tab.id }"
          @click="emit('select-rarity', tab.id)"
        >
          <span>{{ tab.label }}</span>
          <small>{{ tab.count }}</small>
        </button>
      </div>

      <label class="asset-filter">
        <span>资源</span>
        <select :value="currentAssetState" @change="emit('select-asset-state', $event.target.value)">
          <option v-for="option in assetStateOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="asset-filter relation-filter">
        <span>关联</span>
        <select :value="currentRelationState" @change="emit('select-relation-state', $event.target.value)">
          <option v-for="option in relationStateOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
      </label>

      <div class="card-layout-toggle" aria-label="视图模式">
        <button
          title="紧凑列表"
          :class="{ active: layout === 'compact' }"
          :aria-pressed="layout === 'compact'"
          @click="emit('update:layout', 'compact')"
        >
          <List :size="17" />
        </button>
        <button
          title="网格视图"
          :class="{ active: layout === 'grid' }"
          :aria-pressed="layout === 'grid'"
          @click="emit('update:layout', 'grid')"
        >
          <LayoutGrid :size="17" />
        </button>
      </div>
    </div>

    <div class="card-archive-list" :class="`layout-${layout}`">
      <button
        v-for="card in cards"
        :key="card.resource_id"
        class="card-archive-row"
        @click="emit('select-card', card)"
      >
        <img
          :src="getCardIconUrl(card.resource_id, true)"
          :alt="card.title || card.resource_id"
          class="card-thumb"
          loading="lazy"
          @error="fallbackCardIcon($event, card.resource_id)"
        />
        <span class="card-rarity">{{ card.rarity || 'CARD' }}</span>
        <span class="card-main">
          <span class="card-title">{{ card.title || card.resource_id }}</span>
          <span class="card-resource">{{ card.resource_id }}</span>
        </span>
        <span class="card-counts">
          {{ card.home_voice_cues?.length || 0 }} voices · {{ card.scenario_entries?.length || 0 }} stories
        </span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { LayoutGrid, List } from '@lucide/vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'

defineProps({
  title: { type: String, default: '' },
  cards: { type: Array, default: () => [] },
  rarityTabs: { type: Array, default: () => [] },
  currentRarity: { type: String, default: 'all' },
  currentAssetState: { type: String, default: 'all' },
  currentRelationState: { type: String, default: 'all' },
  modelValue: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
  layout: { type: String, default: 'compact' },
})

const emit = defineEmits([
  'back',
  'select-card',
  'select-rarity',
  'select-asset-state',
  'select-relation-state',
  'update:modelValue',
  'update:layout',
])

const assetStateOptions = [
  { id: 'all', label: '全部卡片' },
  { id: 'visible_icon', label: '有可显示卡图' },
  { id: 'complete_icons', label: '普通/特训图完整' },
  { id: 'has_large', label: '有大图资源' },
  { id: 'single_state', label: '单卡面系列' },
  { id: 'missing_normal', label: '异常缺普通图' },
]

const relationStateOptions = [
  { id: 'all', label: '全部关联' },
  { id: 'card_story', label: '有卡片小剧情' },
  { id: 'event_card', label: '活动关联卡' },
  { id: 'gasha_card', label: '卡池关联卡' },
  { id: 'release_series', label: '共通系列' },
  { id: 'unrelated', label: '暂无直接关联' },
]

function fallbackCardIcon(event, resourceId) {
  const img = event?.target
  if (!img) return
  if (img.dataset.fallbackApplied === '1') {
    img.classList.add('card-image-missing')
    img.removeAttribute('src')
    return
  }
  img.dataset.fallbackApplied = '1'
  img.src = getCardIconUrl(resourceId, false)
}
</script>

<style scoped>
.list-screen { height: 100%; padding: 0; overflow-x: hidden; overflow-y: auto; }
.embedded-filters { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #edf0f2; background: #fff; }
.filter-input { width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; background: #fff; color: #222; font-size: 0.85rem; }
.filter-input:focus { outline: none; border-color: #88ccff; box-shadow: 0 0 0 2px rgba(136, 204, 255, 0.2); }
.card-rarity-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.card-rarity-tab { display: inline-flex; align-items: center; gap: 5px; min-height: 28px; padding: 4px 9px; border: 1px solid #d8dfe8; border-radius: 6px; background: #fff; color: #444; cursor: pointer; font-size: 0.76rem; }
.card-rarity-tab small { color: #888; font-size: 0.68rem; }
.card-rarity-tab.active { border-color: #7fb2e5; background: #edf6ff; color: #245b91; }
.asset-filter { display: flex; align-items: center; gap: 7px; color: #69747e; font-size: 0.72rem; }
.asset-filter select { height: 32px; max-width: 170px; padding: 0 28px 0 9px; border: 1px solid #d8dfe3; border-radius: 5px; background: #fff; color: #35404a; font: inherit; font-size: 0.74rem; }
.card-layout-toggle { display: flex; gap: 3px; padding: 2px; border: 1px solid #d8dfe3; border-radius: 6px; background: #f4f6f7; }
.card-layout-toggle button { display: grid; place-items: center; width: 30px; height: 28px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #69747e; cursor: pointer; }
.card-layout-toggle button.active { background: #fff; color: #148f87; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
.card-archive-list { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px 24px; }
.card-archive-row { display: grid; grid-template-columns: 56px 44px minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 64px; padding: 10px 12px; border: 1px solid #e8e8e8; border-radius: 8px; background: #fff; color: #333; text-align: left; cursor: pointer; transition: background 0.15s, border-color 0.15s, box-shadow 0.15s; }
.card-archive-row:hover { border-color: #b3d9ff; background: #f5faff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); }
.card-thumb { width: 56px; height: 56px; border: 1px solid #e4e4e4; border-radius: 6px; background: #eee; object-fit: cover; }
.card-image-missing { display: none; }
.card-rarity { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; height: 24px; border-radius: 6px; background: #edf2ff; color: #3157a4; font-size: 0.72rem; font-weight: 700; }
.card-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.card-title { overflow: hidden; color: #222; font-size: 0.9rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.card-resource { color: #888; font-family: monospace; font-size: 0.72rem; }
.card-counts { color: #777; font-size: 0.72rem; white-space: nowrap; }
.card-archive-list.layout-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-content: start; }
.layout-grid .card-archive-row { grid-template-columns: 58px minmax(0, 1fr); grid-template-rows: auto auto; min-height: 86px; }
.layout-grid .card-thumb { grid-row: 1 / 3; width: 58px; height: 58px; }
.layout-grid .card-rarity { display: none; }
.layout-grid .card-counts { grid-column: 2; white-space: normal; }

@media (max-width: 560px) {
  .embedded-filters { grid-template-columns: minmax(0, 1fr) auto auto; align-items: start; padding: 9px 10px; }
  .card-rarity-tabs { grid-column: 1 / -1; }
  .asset-filter { min-width: 0; }
  .asset-filter span { display: none; }
  .asset-filter select { max-width: min(190px, 55vw); }
  .relation-filter select { max-width: min(150px, 38vw); }
  .card-archive-row { grid-template-columns: 48px 38px minmax(0, 1fr); gap: 8px; padding: 8px; }
  .card-thumb { width: 48px; height: 48px; }
  .card-rarity { min-width: 38px; }
  .card-counts { grid-column: 3; white-space: normal; }
  .card-archive-list.layout-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px; }
  .layout-grid .card-archive-row { display: flex; flex-direction: column; align-items: stretch; min-width: 0; }
  .layout-grid .card-thumb { width: 100%; height: auto; aspect-ratio: 1; }
  .layout-grid .card-main, .layout-grid .card-counts { width: 100%; }
  .layout-grid .card-title { line-height: 1.3; white-space: normal; }
}
</style>
