<template>
  <section class="gasha-catalog" data-archive-scroll-container :aria-busy="busy">
    <div class="catalog-summary">
      <div>
        <strong>{{ loaded ? totalGashas : '—' }}</strong>
        <span>卡池记录</span>
      </div>
      <div>
        <strong>{{ loaded ? announcementCount : '—' }}</strong>
        <span>公告记录</span>
      </div>
      <div>
        <strong>{{ loaded ? pickupCount : '—' }}</strong>
        <span>新卡关联</span>
      </div>
      <div><strong>{{ loaded ? supplementCount : '—' }}</strong><span>道具补录</span></div>
    </div>

    <div class="catalog-filter">
      <div class="category-tabs" role="group" aria-label="卡池类型">
        <button
          v-for="option in categoryOptions"
          :key="option.value"
          :class="{ active: category === option.value }"
          type="button"
          :aria-pressed="category === option.value"
          @click="emit('update:category', option.value)"
        >
          <span>{{ option.label }}</span>
          <small>{{ option.count }}</small>
        </button>
      </div>
      <span class="result-count">{{ loaded ? `${gashas.length} / ${totalGashas}` : '结果数量尚未读取' }}</span>
    </div>

    <p v-if="status || !loaded" class="catalog-status" role="status">{{ status || '正在读取卡池目录…' }}<button v-if="!loaded && !busy" type="button" @click="emit('retry')">重试卡池目录</button></p>
    <p v-if="loaded && !gashas.length" class="catalog-status" role="status">{{ totalGashas ? '没有匹配的卡池，请调整搜索或类型。' : '尚未收录卡池资料。' }}</p>
    <div v-if="loaded" class="gasha-grid">
      <button
        v-for="gasha in gashas"
        :key="gasha.id"
        class="gasha-item"
        :data-archive-focus-id="`gasha:${gasha.id}`"
        @click="emit('select', gasha)"
      >
        <span class="banner-frame">
          <img v-if="gasha.banner_url" :src="gasha.banner_url" :alt="gashaText(gasha.display_name)" loading="lazy" decoding="async" width="940" height="510" />
          <span v-else class="ticket-banner-label">抽取道具记录</span>
        </span>
        <span class="gasha-copy">
          <span class="gasha-heading">
            <strong :title="gasha.display_name">{{ gashaText(gasha.display_name) }}</strong>
            <span class="gasha-badges">
              <small class="type-badge">{{ categoryLabel(gasha.category) }}</small>
              <small v-if="gasha.is_reprint" class="reprint-badge">复刻</small>
            </span>
          </span>
          <span class="gasha-meta">
            <span>{{ formatDate(gasha.start_at) }}</span>
            <span v-if="gasha.source_type!=='item-masterdata'">{{ pickupCardCount(gasha) }} 张关联卡</span>
            <span v-if="gasha.tickets?.length">{{ gasha.tickets.length }} 种抽取道具</span>
          </span>
        </span>
        <ChevronRight :size="18" />
      </button>
    </div>
  </section>
</template>

<script setup>
import { ChevronRight } from '@lucide/vue'
import {gashaText} from './useArchiveGashaText.js'

const props = defineProps({
  gashas: { type: Array, default: () => [] },
  categoryOptions: { type: Array, default: () => [] },
  category: { type: String, default: 'all' },
  totalGashas: { type: Number, default: 0 },
  announcementCount: { type: Number, default: 0 },
  pickupCount: { type: Number, default: 0 },
  supplementCount: { type: Number, default: 0 },
  loaded: Boolean,
  busy: Boolean,
  status: { type: String, default: '' },
})
const emit = defineEmits(['select', 'update:category', 'retry'])

const CATEGORY_LABELS = {
  standard_pickup: '通常招募',
  growing_fes: 'GROWING FES',
  stage_step_up: 'STAGE',
  full_roster_series: '全员系列',
  ticket_named: '道具补录',
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || '未分类'
}

function pickupCardCount(gasha) {
  return gasha.derived_pickup_cards?.length || gasha.related_pickup_count || 0
}

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return '未记录'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' })
    .format(new Date(timestamp * 1000))
}
</script>

<style scoped>
.gasha-catalog { height: 100%; overflow-y: auto; background: var(--gs-paper); font-family: var(--gs-font-directory); font-size: var(--gs-text-body); }
.gasha-catalog button { font: inherit; }
.catalog-summary { display: flex; flex-wrap: wrap; gap: var(--gs-space-7); padding: var(--gs-space-5) var(--gs-space-6); border-bottom: 1px solid #e3e8eb; background: #fff; }
.catalog-summary div { display: flex; align-items: baseline; gap: 7px; }
.catalog-summary strong { color: #1b7772; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-bold); font-variant-numeric: tabular-nums; }
.catalog-summary span { color: #758088; font-size: var(--gs-text-meta); }
.catalog-filter { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 20px; border-bottom: 1px solid #e3e8eb; background: #fff; }
.category-tabs { display: flex; align-items: center; gap: 3px; min-width: 0; overflow-x: auto; }
.category-tabs button { display: inline-flex; flex: 0 0 auto; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: var(--gs-space-2) var(--gs-space-3); border: 1px solid transparent; border-radius: var(--gs-radius-control); background: transparent; color: #657179; cursor: pointer; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); white-space: nowrap; }
.category-tabs button.active { border-color: #aedbd7; background: #eaf7f5; color: var(--gs-mint-ink); }
.category-tabs small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-medium); font-variant-numeric: tabular-nums; }
.category-tabs button.active small { color: #4d8d88; }
.result-count { flex: 0 0 auto; color: #879299; font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.catalog-status { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-4); margin: 0; padding: var(--gs-space-5) var(--gs-space-6); color: #60758a; font-size: var(--gs-text-body); line-height: 1.6; }
.catalog-status button { min-height: var(--gs-control-normal); padding: var(--gs-space-2) var(--gs-space-4); border: 1px solid #aedbd7; border-radius: var(--gs-radius-control); background: #fff; color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.gasha-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; padding: 16px 20px 28px; }
.gasha-item { display: grid; grid-template-columns: 178px minmax(0, 1fr) 20px; align-items: center; gap: 13px; min-width: 0; min-height: 116px; padding: var(--gs-space-3) 0; border: 0; border-bottom: 1px solid var(--gs-line); border-radius: 0; background: none; color: #27343b; cursor: pointer; text-align: left; transition: border-color 0.15s, box-shadow 0.15s; }
.gasha-catalog button:focus-visible { outline: var(--gs-focus-ring) solid #00a876; outline-offset: var(--gs-focus-offset); }
/* The horizontal rail clips an outer ring; keep this control's ring inside. */
.category-tabs button:focus-visible { outline-offset: calc(-1 * var(--gs-focus-ring)); }
.category-tabs button:active,.gasha-item:active,.catalog-status button:active { background: #eaf7f5; }
@media (hover:hover) and (pointer:fine) {
  .category-tabs button:not(.active):hover:not(:active) { background: #f3f6f7; color: #34454d; }
  .gasha-item:hover { border-color: #85cbc6; }
}
.gasha-item > svg { color: #8a969c; }
.banner-frame { display: block; width: 178px; aspect-ratio: 940 / 510; overflow: hidden; border: 1px solid #e6e8e9; border-radius: 4px; background: #eef1f2; }
.banner-frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
.ticket-banner-label { display:grid;height:100%;place-items:center;color:#607e80;font-size:var(--gs-text-ui); }
.gasha-copy { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.gasha-heading { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.gasha-heading strong { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-bold); line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.gasha-badges { display: flex; flex-wrap: wrap; gap: 4px; }
.gasha-badges small { padding: 2px 5px; border-radius: 3px; font-size: var(--gs-text-caption); font-weight: var(--gs-weight-medium); }
.type-badge { background: var(--gs-mint-wash); color: #187b74; }
.reprint-badge { background: #fff0db; color: #965f13; }
.gasha-meta { display: flex; flex-wrap: wrap; gap: 5px 10px; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.gasha-meta code { color: #5d6a72; font-size: var(--gs-text-meta); }
@media (max-width: 760px),(pointer:coarse) {
  .category-tabs button,.catalog-status button { min-width: var(--gs-control-touch); min-height: var(--gs-control-touch); }
}
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
