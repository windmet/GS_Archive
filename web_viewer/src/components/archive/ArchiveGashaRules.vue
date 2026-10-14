<template>
  <!-- One gasha's wiki page, read into rules: Chinese statements for the recognised lines, prices, the memory-star
       exchange, and the page's own text kept beside them. -->
  <section class="detail-section gasha-rules">
    <div class="section-heading">
      <h3>卡池规则</h3>
      <span class="relation-count">{{ pages.length > 1 ? `${pages.length} 份卡池页` : '已收录' }}</span>
    </div>

    <article v-for="page in readPages" :key="page.url" class="rule-page">
      <h4 v-if="pages.length > 1" lang="ja">{{ page.title }}</h4>
      <!-- One key/value row per rule kind; a kind's statements share its row instead of a rule each. -->
      <dl class="rule-facts">
        <div v-if="page.periods.length" class="rule-row">
          <dt>开放期间</dt>
          <dd><ul><li v-for="period in page.periods" :key="period.start_at" class="rule-number">{{ periodText(period) }}</li></ul></dd>
        </div>
        <div v-for="group in page.lead" :key="group.id" class="rule-row">
          <dt>{{ group.label }}</dt>
          <dd><ul><li v-for="item in group.items" :key="item.text">{{ item.text }}</li></ul></dd>
        </div>
        <div v-if="page.steps.length" class="rule-row">
          <dt>阶梯价格</dt>
          <dd>
            <ol class="step-list">
              <li v-for="step in page.steps" :key="step.step"><span>第 {{ step.step }} 阶</span>{{ step.paid_only ? '付费' : '' }}星钻 {{ step.jewels }} 个 · {{ step.draws }} 次</li>
            </ol>
          </dd>
        </div>
        <div v-for="group in page.rows" :key="group.id" class="rule-row">
          <dt>{{ group.label }}</dt>
          <dd>
            <ul>
              <li v-for="item in group.items" :key="item.text">{{ item.text }}</li>
              <li v-if="group.id === 'rate'" class="rule-missing">具体数值未留存</li>
            </ul>
          </dd>
        </div>
        <div v-for="exchange in page.exchanges" :key="exchange.heading" class="rule-row">
          <dt>{{ exchangeCurrency(exchange) }}交换</dt>
          <dd>
            <ul>
              <li v-if="exchangeSummary(exchange)">{{ exchangeSummary(exchange) }}</li>
              <li v-if="exchangeUntil(exchange)" class="rule-number">截至 {{ exchangeUntil(exchange) }}</li>
            </ul>
            <ul v-if="!exchangeSummary(exchange)" class="exchange-list">
              <li v-for="row in exchange.rows" :key="row.resource_id">
                <button type="button" class="exchange-card" @click="emit('open-card', cardPayload(row))">
                  <img :src="getCardIconUrl(row.resource_id, true)" alt="" width="48" height="48" loading="lazy" decoding="async" />
                  <span><strong>{{ cardText('card', row.card_title, 'title') }}</strong><small>{{ idolName(row.character_id) }} · {{ row.rarity }}</small></span>
                  <b>{{ row.cost }} 个</b>
                </button>
              </li>
            </ul>
          </dd>
        </div>
        <div v-for="group in page.notes" :key="group.id" class="rule-row">
          <dt>{{ group.label }}</dt>
          <dd><ul><li v-for="item in group.items" :key="item.text">{{ item.text }}</li></ul></dd>
        </div>
      </dl>

      <div class="rule-footer">
        <details class="rule-source">
          <summary>卡池页原文</summary>
          <div lang="ja">
            <section v-for="(section, index) in page.sections" :key="index">
              <h6>{{ section.heading }}</h6>
              <p v-for="(line, lineIndex) in section.lines" :key="lineIndex">{{ line }}</p>
            </section>
          </div>
        </details>
        <ArchiveSourceLink :url="page.url" :label="`Wikiwiki · ${page.title}`" />
      </div>
    </article>

    <!-- Why the section is short: the service is closed and its server-sent rules were never cached. -->
    <p class="rule-callout">
      <Info :size="16" aria-hidden="true" />
      <span>以上据 Wikiwiki 卡池页整理。游戏内的卡池说明和提供割合由服务器下发，没有保存在客户端中；Wikiwiki 也没有记载具体提供割合数值。</span>
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Info } from '@lucide/vue'
import ArchiveSourceLink from './ArchiveSourceLink.vue'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'
import { gashaText } from './useArchiveGashaText.js'
import { archiveText } from './useArchiveCollectionText.js'
import { archiveText as cardText } from './useArchiveCardTitle.js'
import { gashaRuleGroups } from '../../presentation/gashaRuleFacts.js'

const props = defineProps({
  pages: { type: Array, required: true },
  idolName: { type: Function, required: true },
  // Cards the page already lists as this gasha's; an exchange of exactly those at one price reads as one line.
  pickupIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['open-card'])

// Items such as 「ゴーゴーゼリーDX ×5」 carry their count in the name.
function itemName(name) {
  const [, base, count] = String(name).match(/^(.*?)\s*(×\s*\d+)?$/u)
  return `${archiveText('item', base)}${count ? ` ${count.replace(/\s+/gu, '')}` : ''}`
}

const names = { gashaName: gashaText, itemName }
// Rows run draw and step prices, guarantee, rate (always shown: its numbers were never kept), memory stars,
// then exchanges and the remaining notes.
const RATE_ROW = { id: 'rate', label: '提供割合', items: [] }
const readPages = computed(() => props.pages.map(page => {
  const groups = gashaRuleGroups(page.facts, page.title, names)
  const byId = id => groups.find(group => group.id === id)
  const rows = [byId('guarantee'), byId('rate') || RATE_ROW, byId('exchange')].filter(Boolean)
  return { ...page, lead: [byId('draw')].filter(Boolean), rows, notes: groups.filter(group => group.id === 'note') }
}))

const CURRENCIES = { メモリースター: '记忆之星' }
function exchangeCurrency(exchange) {
  return CURRENCIES[exchange.currency] || archiveText('item', exchange.currency)
}
function exchangeUntil(exchange) {
  return exchange.until_at.map(formatDateTime).join('、')
}

function exchangeSummary(exchange) {
  const costs = new Set(exchange.rows.map(row => row.cost))
  const pickup = new Set(props.pickupIds)
  if (costs.size !== 1 || exchange.rows.length !== pickup.size || !exchange.rows.every(row => pickup.has(row.resource_id))) return ''
  return `每张 ${[...costs][0]} 个 · 上方 ${exchange.rows.length} 张关联卡片均可交换`
}

function cardPayload(row) {
  return { card_resource_id: row.resource_id, card_title: row.card_title, character_id: row.character_id, rarity: row.rarity }
}

function periodText(period) {
  return `${period.start_time_missing ? formatDate(period.start_at) : formatDateTime(period.start_at)} – ${formatDateTime(period.end_at)}`
}

const zone = { timeZone: 'Asia/Tokyo' }
function formatDateTime(timestamp) {
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', ...zone }).format(new Date(timestamp * 1000)) : '未记录'
}
function formatDate(timestamp) {
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', ...zone }).format(new Date(timestamp * 1000)) : '未记录'
}
</script>

<style scoped>
/* The section shell comes from ArchiveGashaDetail (this root carries its scope); the heading is styled here. */
.gasha-rules { container-type: inline-size; }
.section-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--gs-space-4); margin-bottom: var(--gs-space-4); }
.section-heading h3 { margin: 0; color: var(--gs-ink); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.relation-count { flex: 0 0 auto; color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.rule-page { display: grid; gap: var(--gs-space-3); }
.rule-page + .rule-page { margin-top: var(--gs-space-7); padding-top: var(--gs-space-7); border-top: 1px solid var(--gs-rule); }
.rule-page h4 { margin: 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.rule-facts { margin: 0; border-top: 1px solid var(--gs-rule); }
.rule-row { display: grid; grid-template-columns: 8em minmax(0, 1fr); gap: var(--gs-space-2) var(--gs-space-5); padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.rule-row dt { color: var(--gs-ink-3); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); line-height: 1.7; }
.rule-row dd { display: grid; gap: var(--gs-space-3); min-width: 0; margin: 0; }
.rule-row ul, .rule-row ol { display: grid; gap: var(--gs-space-2); margin: 0; padding: 0; list-style: none; }
.rule-row li { color: var(--gs-ink); font-size: var(--gs-text-body); line-height: 1.7; overflow-wrap: anywhere; }
.rule-number { font-variant-numeric: tabular-nums; }
.rule-row .rule-missing { color: var(--gs-ink-3); }
.step-list li { display: grid; grid-template-columns: 5em minmax(0, 1fr); gap: var(--gs-space-3); font-variant-numeric: tabular-nums; }
.step-list span { color: var(--gs-ink-3); }
.rule-row .exchange-list { grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 0 var(--gs-space-5); }
.exchange-card { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); width: 100%; min-height: var(--gs-control-touch); padding: var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font: inherit; text-align: left; cursor: pointer; }
.exchange-card img { width: 48px; height: 48px; border-radius: var(--gs-radius-media); object-fit: cover; background: var(--gs-surface); }
.exchange-card span { display: grid; min-width: 0; }
.exchange-card strong { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.exchange-card small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.exchange-card b { color: var(--gs-ink-2); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.exchange-card:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (hover: hover) and (pointer: fine) {
  .exchange-card:hover { background: var(--gs-mint-wash); }
  .exchange-card:hover strong { color: var(--gs-mint-ink); }
}
.rule-footer { display: grid; justify-items: start; }
.rule-source { justify-self: stretch; }
.rule-source summary { min-height: var(--gs-control-touch); display: flex; align-items: center; color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.rule-source > div { padding: var(--gs-space-2) 0 var(--gs-space-4); color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.7; }
.rule-source h6 { margin: var(--gs-space-4) 0 var(--gs-space-1); color: var(--gs-ink); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.rule-source p { margin: 0; overflow-wrap: anywhere; }
.rule-callout { display: flex; align-items: flex-start; gap: var(--gs-space-3); margin: var(--gs-space-5) 0 0; padding: var(--gs-space-4) var(--gs-space-5); border-radius: var(--gs-radius-control); background: var(--gs-line); color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.7; }
.rule-callout svg { flex: 0 0 16px; margin-top: 3px; color: var(--gs-ink-3); }
@container (max-width: 560px) {
  .rule-row { grid-template-columns: minmax(0, 1fr); padding: var(--gs-space-3) 0; }
  .rule-row dt { font-size: var(--gs-text-meta); }
}
</style>
