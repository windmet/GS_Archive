<template>
  <section class="gasha-catalog" data-archive-scroll-container :aria-busy="busy">
    <ul class="catalog-footprint" aria-label="卡池收录">
      <li><b>{{ loaded ? totalGashas : '—' }}</b>个卡池</li>
      <li><b>{{ loaded ? announcementCount : '—' }}</b>条公告</li>
    </ul>

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
      <span v-if="loaded && gashas.length !== totalGashas" class="result-count">{{ gashas.length }} 个结果</span>
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
          <strong :title="gasha.display_name">{{ gashaText(gasha.display_name) }}</strong>
          <span class="gasha-meta">
            <span>{{ categoryLabel(gasha.category) }}<template v-if="gasha.is_reprint"> · 复刻</template></span>
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
/* Gasha catalogue: a footprint line, one scrolling row of types, then hairline banner rows. */
.gasha-catalog { height: 100%; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body); container: gasha-catalog / inline-size; }
.gasha-catalog button { font: inherit; }
.catalog-footprint, .catalog-filter, .catalog-status, .gasha-grid { max-width: var(--gs-content-width); margin-inline: auto; padding-inline: var(--gs-space-7); box-sizing: border-box; }
.catalog-footprint { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-5); margin-block: 0; padding-block: var(--gs-space-6) var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-ui); list-style: none; }
.catalog-footprint b { margin-right: var(--gs-space-2); color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; }
.catalog-filter { display: flex; align-items: center; gap: var(--gs-space-4); padding-block: var(--gs-space-2) var(--gs-space-3); border-bottom: 1px solid var(--gs-line); }
.category-tabs { display: flex; flex: 1; gap: var(--gs-space-3); min-width: 0; overflow-x: auto; padding: var(--gs-space-1) 0; scrollbar-width: none; }
.category-tabs button { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 6px; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); cursor: pointer; font-size: var(--gs-text-ui); white-space: nowrap; }
.category-tabs button.active { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); }
.category-tabs small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-variant-numeric: tabular-nums; }
.category-tabs button.active small { color: inherit; }
.result-count { flex: 0 0 auto; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.catalog-status { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-4); margin-block: 0; padding-block: var(--gs-space-5); color: var(--gs-ink-2); line-height: 1.6; }
.catalog-status button { min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); cursor: pointer; }
.gasha-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); column-gap: var(--gs-space-8); padding-block: var(--gs-space-2) var(--gs-space-9); }
.gasha-item { display: grid; grid-template-columns: 160px minmax(0, 1fr) 18px; align-items: center; gap: var(--gs-space-4); min-width: 0; padding: var(--gs-space-4) 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: inherit; cursor: pointer; text-align: left; }
.gasha-item > svg { color: var(--gs-ink-3); }
.banner-frame { display: block; overflow: hidden; aspect-ratio: 940 / 510; border-radius: var(--gs-radius-media); background: var(--gs-line); }
.banner-frame img { display: block; width: 100%; height: 100%; object-fit: cover; }
.ticket-banner-label { display: grid; height: 100%; place-items: center; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.gasha-copy { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.gasha-copy strong { display: -webkit-box; overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.gasha-meta { display: flex; flex-wrap: wrap; gap: var(--gs-space-1) var(--gs-space-4); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.gasha-catalog button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* The horizontal rail clips an outer ring; keep this control's ring inside. */
.category-tabs button:focus-visible { outline-offset: calc(-1 * var(--gs-focus-ring)); }
@media (hover: hover) { .gasha-item:hover strong { color: var(--gs-mint-ink); } .category-tabs button:not(.active):hover { border-color: var(--gs-ink-3); } }
@container gasha-catalog (max-width: 560px) {
  .catalog-footprint, .catalog-filter, .catalog-status, .gasha-grid { padding-inline: var(--gs-space-5); }
  .catalog-footprint { padding-top: var(--gs-space-4); }
  .category-tabs button, .catalog-status button { min-height: var(--gs-control-touch); }
  .gasha-grid { grid-template-columns: 1fr; }
  .gasha-item { grid-template-columns: 96px minmax(0, 1fr) 16px; gap: var(--gs-space-4); }
}
</style>
