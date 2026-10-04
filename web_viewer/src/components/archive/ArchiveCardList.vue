<template>
  <section class="screen list-screen" data-archive-scroll-container>
    <ArchiveListHeader v-if="!embedded" :title="title" @back="emit('back')">
      <template #filters>
        <input
          :value="modelValue"
          placeholder="搜索卡片标题或稀有度"
          class="filter-input"
          @input="emit('update:modelValue', $event.target.value)"
        />
      </template>
    </ArchiveListHeader>

    <div class="card-idol-heading">
      <div class="card-idol-copy">
        <span>CARD ARCHIVE</span>
        <strong>{{ title }}</strong>
      </div>
      <ArchiveIdolSwitcher
        :idols="idols"
        allow-all
        :selected-idol="selectedIdol"
        @select="emit('select-idol', $event)"
      />
    </div>

    <div class="embedded-filters" aria-label="卡片目录工具栏">
      <div class="card-rarity-tabs">
        <button
          v-for="tab in rarityTabs"
          :key="tab.id"
          class="card-rarity-tab"
          :class="{ active: currentRarity === tab.id }"
          :aria-pressed="currentRarity === tab.id"
          @click="emit('select-rarity', tab.id)"
        >
          <span>{{ tab.label }}</span>
          <small>{{ tab.count }}</small>
        </button>
      </div>

      <label class="asset-filter">
        <span>属性</span>
        <select aria-label="卡片属性" :value="currentAttribute" @change="emit('select-attribute', $event.target.value)">
          <option value="all">全部属性</option>
          <option v-for="attribute in ['Physical','Intelligence','Mental']" :key="attribute">{{ attribute }}</option>
        </select>
      </label>

      <label class="asset-filter">
        <span>资源</span>
        <select aria-label="卡片资源" :value="currentAssetState" @change="emit('select-asset-state', $event.target.value)">
          <option v-for="option in assetStateOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="asset-filter relation-filter">
        <span>关联</span>
        <select aria-label="卡片关联" :value="currentRelationState" @change="emit('select-relation-state', $event.target.value)">
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
        :data-archive-focus-id="`card:${card.resource_id}`"
        @click="emit('select-card', card)"
      >
        <img
          :src="getCardIconUrl(card.resource_id, true)"
          :alt="archiveText('card', card.title, 'title') || '卡名待确认'"
          class="card-thumb"
          loading="lazy" decoding="async"
          @error="fallbackCardIcon($event, card.resource_id)"
        />
        <span class="card-rarity" :data-rarity="card.rarity">{{ card.rarity || 'CARD' }}</span>
        <span class="card-main">
          <span class="card-title" :title="archiveText('card', card.title, 'title')">{{ archiveText('card', card.title, 'title') || '卡名待确认' }}</span>
          <span class="card-owner-name">{{ idolName(card.character_id) || card.ownerReference?.displayName || '姓名待确认' }}</span>
        </span>
        <span class="card-counts">
          <span :aria-label="`${card.home_voice_count ?? card.home_voice_cues?.length ?? 0} 段触摸语音`"><Mic :size="12" aria-hidden="true" /> {{ card.home_voice_count ?? card.home_voice_cues?.length ?? 0 }}<span class="count-label"> 段语音</span></span>
          <span :aria-label="`${card.scenario_count ?? card.scenario_entries?.length ?? 0} 篇剧情`"><BookOpen :size="12" aria-hidden="true" /> {{ card.scenario_count ?? card.scenario_entries?.length ?? 0 }}<span class="count-label"> 篇剧情</span></span>
        </span>
        <ChevronRight class="card-row-arrow" :size="17" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<script setup>
import { BookOpen, ChevronRight, LayoutGrid, List, Mic } from '@lucide/vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import ArchiveIdolSwitcher from './ArchiveIdolSwitcher.vue'
import {archiveText} from './useArchiveCardTitle.js'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'

defineProps({
  title: { type: String, default: '' },
  cards: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' },
  rarityTabs: { type: Array, default: () => [] },
  currentRarity: { type: String, default: 'all' },
  currentAttribute: { type: String, default: 'all' },
  currentAssetState: { type: String, default: 'all' },
  currentRelationState: { type: String, default: 'all' },
  modelValue: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
  layout: { type: String, default: 'compact' },
  idols: { type: Array, default: () => [] },
  selectedIdol: { type: String, default: '' },
})

const emit = defineEmits([
  'back',
  'select-card',
  'select-rarity',
  'select-attribute',
  'select-asset-state',
  'select-relation-state',
  'update:modelValue',
  'update:layout',
  'select-idol',
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
.card-idol-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 16px; border-bottom: 1px solid #e6eaed; background: #f7f9fa; }
.card-idol-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.card-idol-heading span { color: #168f87; font-size: .56rem; font-weight: 800; }
.card-idol-heading strong { overflow: hidden; font-size: .9rem; text-overflow: ellipsis; white-space: nowrap; }
.card-idol-heading :deep(.idol-switcher) { width: min(360px, 48vw); }
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
.card-owner-name { overflow: hidden; color: #627a80; font-size: 0.72rem; text-overflow: ellipsis; white-space: nowrap; }
.card-resource { color: #888; font-family: monospace; font-size: 0.72rem; }
.card-counts { display:flex;align-items:center;gap:10px;color: #777; font-size: 0.72rem; white-space: nowrap; }
.card-counts > span {display:inline-flex;align-items:center;gap:3px;}
.card-row-arrow {display:none;}
.card-archive-list.layout-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-content: start; }
.layout-grid .card-archive-row { grid-template-columns: 58px minmax(0, 1fr); grid-template-rows: auto auto; min-height: 86px; }
.layout-grid .card-thumb { grid-row: 1 / 3; width: 58px; height: 58px; }
.layout-grid .card-rarity { display: none; }
.layout-grid .card-counts { grid-column: 2; white-space: normal; }

@media (max-width: 760px) {
  .card-idol-heading {padding:6px 12px;}
  .card-idol-copy {display:none;}
  .card-idol-heading :deep(.idol-switcher) { width: 100%; }
  .card-idol-heading :deep(.idol-switcher label > span) {display:none;}
  .card-idol-heading :deep(.idol-switcher select) {min-width:0;height:40px;font-size:13px;}
  .card-idol-heading :deep(.idol-switcher > button) {width:44px;height:44px;flex-basis:44px;}
  .embedded-filters {grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:6px;padding:6px 12px 8px;}
  .card-rarity-tabs {grid-column:1/-1;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;min-width:0;gap:5px;}
  .card-rarity-tabs::-webkit-scrollbar {display:none;}
  .card-rarity-tab {flex:0 0 auto;min-height:40px;white-space:nowrap;padding:4px 10px;}
  .asset-filter { min-width: 0; }
  .asset-filter > span { display: none; }
  .asset-filter select {width:100%;max-width:none;height:40px;padding:0 18px 0 7px;font-size:11px;}
  .card-layout-toggle {padding:0;gap:0;}
  .card-layout-toggle button {width:32px;height:40px;}
  .card-archive-list {gap:6px;padding:8px 12px calc(24px + env(safe-area-inset-bottom));}
  .card-archive-row {position:relative;grid-template-columns:56px minmax(0,1fr) 18px;grid-template-rows:1fr auto;gap:2px 10px;height:76px;min-height:76px;padding:8px 10px;}
  .card-thumb {grid-column:1;grid-row:1/3;width:56px;height:56px;}
  .card-rarity {position:absolute;top:7px;left:9px;min-width:0;height:16px;padding:0 4px;font-size:9px;border-radius:3px;background:#38639b;color:white;}
  .card-rarity[data-rarity=SSR] {background:#ae7b1e;}
  .card-rarity[data-rarity=SR] {background:#7556aa;}
  .card-rarity[data-rarity=N] {background:#547a70;}
  .card-main {grid-column:2;grid-row:1;gap:2px;align-self:end;}
  .card-title {font-size:15px;line-height:18px;}
  .card-owner-name {font-size:12px;line-height:15px;}
  .card-counts {grid-column:2;grid-row:2;font-size:10px;line-height:14px;gap:8px;}
  .count-label {display:none;}
  .card-row-arrow {display:block;grid-column:3;grid-row:1/3;align-self:center;}
  .card-archive-list.layout-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px; }
  .layout-grid .card-archive-row {display:flex;flex-direction:column;align-items:stretch;min-width:0;height:auto;padding:8px;}
  .layout-grid .card-thumb { width: 100%; height: auto; aspect-ratio: 1; }
  .layout-grid .card-rarity {display:inline-flex;}
  .layout-grid .card-main, .layout-grid .card-counts { width: 100%; }
  .layout-grid .card-title {font-size:13px;line-height:1.3;white-space:nowrap;}
  .layout-grid .card-row-arrow {display:none;}
}
</style>
