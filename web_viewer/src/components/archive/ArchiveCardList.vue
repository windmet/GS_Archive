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
          <option v-for="attribute in ['Physical','Intelligence','Mental']" :key="attribute" :value="attribute">{{ attributeLabel(attribute) }}</option>
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
import { attributeLabel } from '../../presentation/AttributeLabel.js'

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
/* Card catalogue: heading, one filter bar, then hairline rows or a border-free art grid. */
.list-screen { height: 100%; padding: 0; overflow-x: hidden; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
.card-idol-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-6); max-width: var(--gs-content-width); margin: 0 auto; padding: var(--gs-space-7) var(--gs-space-8) var(--gs-space-4); }
.card-idol-copy { min-width: 0; }
.card-idol-heading strong { display: block; overflow: hidden; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.card-idol-heading :deep(.idol-switcher) { width: min(360px, 48vw); }
.embedded-filters { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3) var(--gs-space-5); max-width: var(--gs-content-width); margin: 0 auto; padding: var(--gs-space-3) var(--gs-space-8); border-bottom: 1px solid var(--gs-line); background: var(--gs-paper); }
.card-rarity-tabs { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); margin-right: auto; }
.card-rarity-tab { display: inline-flex; align-items: baseline; gap: var(--gs-space-2); min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); line-height: calc(var(--gs-control-compact) - 2px); cursor: pointer; }
.card-rarity-tab small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); }
.card-rarity-tab.active { border-color: var(--gs-ink); background: var(--gs-ink); color: var(--gs-paper); font-weight: var(--gs-weight-semibold); }
.card-rarity-tab.active small { color: inherit; }
.asset-filter { display: flex; align-items: center; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.asset-filter select { height: var(--gs-control-compact); max-width: 170px; padding: 0 var(--gs-space-7) 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.card-layout-toggle { display: flex; gap: var(--gs-space-1); }
.card-layout-toggle button { display: grid; place-items: center; width: var(--gs-control-compact); height: var(--gs-control-compact); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-3); cursor: pointer; }
.card-layout-toggle button.active { background: var(--gs-mint-wash); color: var(--gs-ink); }

.card-archive-list { display: grid; gap: 0 var(--gs-space-7); grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); max-width: var(--gs-content-width); margin: 0 auto; padding: var(--gs-space-3) var(--gs-space-8) var(--gs-space-9); }
.card-archive-row { display: grid; grid-template-columns: 56px 40px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); width: 100%; min-height: 72px; padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.card-thumb { width: 56px; height: 56px; border-radius: var(--gs-radius-media); background: var(--gs-line); object-fit: cover; }
.card-image-missing { display: none; }
.card-rarity { color: var(--gs-ink-2); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-style: italic; font-weight: var(--gs-weight-bold); }
.card-rarity[data-rarity="SSR"] { color: var(--gs-ink); }
.card-main { display: grid; gap: var(--gs-space-1); min-width: 0; }
.card-title { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.card-owner-name { overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
.card-counts { display: flex; align-items: center; gap: var(--gs-space-4); color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.card-counts > span { display: inline-flex; align-items: center; gap: var(--gs-space-1); }
.card-row-arrow { display: none; }

/* Grid: the card icon carries the tile; no frame around it. */
.card-archive-list.layout-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--gs-space-6) var(--gs-space-5); padding-top: var(--gs-space-5); }
.layout-grid .card-archive-row { display: flex; flex-direction: column; align-items: stretch; gap: var(--gs-space-2); min-height: 0; padding: 0; border: 0; }
.layout-grid .card-thumb { width: 100%; height: auto; aspect-ratio: 1; }
.layout-grid .card-rarity { font-size: var(--gs-text-ui); }
.layout-grid .card-counts { gap: var(--gs-space-3); }
@media (hover: hover) {
  .card-archive-row:hover .card-title { color: var(--gs-mint-ink); }
  .card-rarity-tab:hover:not(.active) { border-color: var(--gs-ink-3); }
}
.card-archive-row:focus-visible, .card-rarity-tab:focus-visible, .card-layout-toggle button:focus-visible, .asset-filter select:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }

@media (max-width: 760px) {
  .card-idol-heading { padding: var(--gs-space-3) var(--gs-space-5); }
  .card-idol-copy { display: none; }
  .card-idol-heading :deep(.idol-switcher) { width: 100%; }
  .card-idol-heading :deep(.idol-switcher label > span) { display: none; }
  .card-idol-heading :deep(.idol-switcher select) { min-width: 0; height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .card-idol-heading :deep(.idol-switcher > button) { width: var(--gs-control-touch); height: var(--gs-control-touch); flex-basis: var(--gs-control-touch); }
  .embedded-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: var(--gs-space-2); padding: var(--gs-space-2) var(--gs-space-5) var(--gs-space-3); }
  .card-rarity-tabs { grid-column: 1 / -1; flex-wrap: nowrap; margin: 0; overflow-x: auto; scrollbar-width: none; }
  .card-rarity-tabs::-webkit-scrollbar { display: none; }
  .card-rarity-tab { flex: 0 0 auto; min-height: var(--gs-control-touch); line-height: calc(var(--gs-control-touch) - 2px); white-space: nowrap; }
  .asset-filter { min-width: 0; }
  .asset-filter > span { display: none; }
  .asset-filter select { width: 100%; max-width: none; height: var(--gs-control-touch); font-size: var(--gs-text-ui); }
  .card-layout-toggle button { width: var(--gs-control-touch); height: var(--gs-control-touch); }
  .card-archive-list { grid-template-columns: minmax(0, 1fr); padding: var(--gs-space-2) var(--gs-space-5) calc(var(--gs-space-8) + env(safe-area-inset-bottom)); }
  .card-archive-row { grid-template-columns: 56px minmax(0, 1fr) 18px; grid-template-rows: auto auto; gap: var(--gs-space-1) var(--gs-space-4); }
  .card-thumb { grid-row: 1 / 3; }
  .card-rarity { display: none; }
  .card-main { grid-column: 2; grid-row: 1; align-self: end; }
  .card-counts { grid-column: 2; grid-row: 2; gap: var(--gs-space-3); }
  .count-label { display: none; }
  .card-row-arrow { display: block; grid-column: 3; grid-row: 1 / 3; align-self: center; color: var(--gs-ink-3); }
  .card-archive-list.layout-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-5) var(--gs-space-4); }
  .layout-grid .card-rarity { display: inline; }
  .layout-grid .card-row-arrow { display: none; }
}
</style>
