<template>
  <section class="gasha-catalog">
    <div class="catalog-summary">
      <div>
        <strong>{{ totalGashas }}</strong>
        <span>实际卡池</span>
      </div>
      <div>
        <strong>{{ announcementCount }}</strong>
        <span>公告记录</span>
      </div>
      <div>
        <strong>{{ pickupCount }}</strong>
        <span>新卡关联</span>
      </div>
    </div>

    <div class="catalog-filter">
      <div class="category-tabs" role="tablist" aria-label="卡池类型">
        <button
          v-for="option in categoryOptions"
          :key="option.value"
          :class="{ active: category === option.value }"
          type="button"
          role="tab"
          :aria-selected="category === option.value"
          @click="emit('update:category', option.value)"
        >
          <span>{{ option.label }}</span>
          <small>{{ option.count }}</small>
        </button>
      </div>
      <span class="result-count">{{ gashas.length }} / {{ totalGashas }}</span>
    </div>

    <div class="gasha-grid">
      <button
        v-for="gasha in gashas"
        :key="gasha.id"
        class="gasha-item"
        @click="emit('select', gasha)"
      >
        <span class="banner-frame">
          <img :src="gasha.banner_url" :alt="gasha.display_name" loading="lazy" />
        </span>
        <span class="gasha-copy">
          <span class="gasha-heading">
            <strong>{{ gasha.display_name }}</strong>
            <span class="gasha-badges">
              <small class="type-badge">{{ categoryLabel(gasha.category) }}</small>
              <small v-if="gasha.is_reprint" class="reprint-badge">复刻</small>
            </span>
          </span>
          <span class="gasha-meta">
            <code>{{ gasha.code }}</code>
            <span>{{ formatDate(gasha.start_at) }}</span>
            <span>{{ pickupCardCount(gasha) }} cards</span>
          </span>
        </span>
        <ChevronRight :size="18" />
      </button>
    </div>
  </section>
</template>

<script setup>
import { ChevronRight } from '@lucide/vue'

const props = defineProps({
  gashas: { type: Array, default: () => [] },
  categoryOptions: { type: Array, default: () => [] },
  category: { type: String, default: 'all' },
  totalGashas: { type: Number, default: 0 },
  announcementCount: { type: Number, default: 0 },
  pickupCount: { type: Number, default: 0 },
})
const emit = defineEmits(['select', 'update:category'])

const CATEGORY_LABELS = {
  standard_pickup: '通常招募',
  growing_fes: 'GROWING FES',
  stage_step_up: 'STAGE',
  full_roster_series: '全员系列',
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || '未分类'
}

function pickupCardCount(gasha) {
  return gasha.derived_pickup_cards?.length || gasha.related_pickup_count || 0
}

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return 'unknown'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' })
    .format(new Date(timestamp * 1000))
}
</script>

<style scoped>
.gasha-catalog { height: 100%; overflow-y: auto; background: #f6f8f9; }
.catalog-summary { display: flex; gap: 28px; padding: 16px 20px; border-bottom: 1px solid #e3e8eb; background: #fff; }
.catalog-summary div { display: flex; align-items: baseline; gap: 7px; }
.catalog-summary strong { color: #1b7772; font-size: 1rem; font-variant-numeric: tabular-nums; }
.catalog-summary span { color: #758088; font-size: 0.68rem; }
.catalog-filter { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 20px; border-bottom: 1px solid #e3e8eb; background: #fff; }
.category-tabs { display: flex; align-items: center; gap: 3px; min-width: 0; overflow-x: auto; }
.category-tabs button { display: inline-flex; align-items: center; gap: 6px; min-height: 31px; padding: 5px 9px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: #657179; cursor: pointer; font-size: 0.64rem; white-space: nowrap; }
.category-tabs button:hover { background: #f3f6f7; color: #34454d; }
.category-tabs button.active { border-color: #aedbd7; background: #eaf7f5; color: #176f69; font-weight: 700; }
.category-tabs small { color: #929ca1; font-size: 0.55rem; font-variant-numeric: tabular-nums; }
.category-tabs button.active small { color: #4d8d88; }
.result-count { flex: 0 0 auto; color: #879299; font-size: 0.61rem; font-variant-numeric: tabular-nums; }
.gasha-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; padding: 16px 20px 28px; }
.gasha-item { display: grid; grid-template-columns: 178px minmax(0, 1fr) 20px; align-items: center; gap: 13px; min-width: 0; min-height: 116px; padding: 10px; border: 1px solid #e0e5e8; border-radius: 7px; background: #fff; color: #27343b; cursor: pointer; text-align: left; transition: border-color 0.15s, box-shadow 0.15s; }
.gasha-item:hover { border-color: #85cbc6; box-shadow: 0 3px 12px rgba(35, 73, 78, 0.08); }
.gasha-item > svg { color: #8a969c; }
.banner-frame { display: block; width: 178px; aspect-ratio: 940 / 510; overflow: hidden; border: 1px solid #e6e8e9; border-radius: 4px; background: #eef1f2; }
.banner-frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
.gasha-copy { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.gasha-heading { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.gasha-heading strong { overflow: hidden; font-size: 0.78rem; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.gasha-badges { display: flex; flex-wrap: wrap; gap: 4px; }
.gasha-badges small { padding: 2px 5px; border-radius: 3px; font-size: 0.56rem; }
.type-badge { background: #e7f6f4; color: #187b74; }
.reprint-badge { background: #fff0db; color: #965f13; }
.gasha-meta { display: flex; flex-wrap: wrap; gap: 5px 10px; color: #7a858c; font-size: 0.62rem; }
.gasha-meta code { color: #5d6a72; font-size: 0.62rem; }
@media (max-width: 700px) {
  .catalog-summary { gap: 16px; padding: 12px; }
  .catalog-filter { align-items: flex-start; padding: 8px 10px; }
  .catalog-summary div { align-items: flex-start; flex-direction: column; gap: 1px; }
  .gasha-grid { grid-template-columns: 1fr; padding: 10px 10px 22px; }
  .gasha-item { grid-template-columns: 126px minmax(0, 1fr) 16px; min-height: 92px; padding: 8px; }
  .banner-frame { width: 126px; }
}
@media (max-width: 430px) {
  .gasha-item { grid-template-columns: minmax(0, 1fr) 18px; }
  .banner-frame { grid-column: 1 / -1; width: 100%; }
  .gasha-heading strong { white-space: normal; }
}
</style>
