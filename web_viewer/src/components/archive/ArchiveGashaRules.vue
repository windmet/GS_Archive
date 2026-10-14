<template>
  <!-- One gasha's wiki page, read into rules: Chinese statements for the recognised lines, prices, the memory-star
       exchange, and the page's own text kept beside them. -->
  <section class="detail-section gasha-rules">
    <div class="section-heading">
      <div>
        <h3>卡池规则</h3>
        <p>据 Wikiwiki 卡池页整理；游戏内卡池说明由服务器下发，未保存在客户端中。</p>
      </div>
      <span class="relation-count">{{ pages.length > 1 ? `${pages.length} 份卡池页` : '已收录' }}</span>
    </div>

    <article v-for="page in readPages" :key="page.url" class="rule-page">
      <h4 v-if="pages.length > 1" lang="ja">{{ page.title }}</h4>
      <p v-if="page.periods.length" class="rule-period">开放期间 {{ page.periods.map(periodText).join('；') }}</p>

      <div v-for="group in page.groups" :key="group.id" class="rule-group">
        <h5>{{ group.label }}</h5>
        <ul>
          <li v-for="item in group.items" :key="item.text">{{ item.text }}</li>
          <li v-if="group.id === 'rate'" class="rule-missing">具体提供割合数值未能保存：游戏内由服务器下发，Wikiwiki 也未记载。</li>
        </ul>
      </div>
      <div v-if="!page.groups.some(group => group.id === 'rate')" class="rule-group">
        <h5>提供割合</h5>
        <ul><li class="rule-missing">具体提供割合数值未能保存：游戏内由服务器下发，Wikiwiki 也未记载。</li></ul>
      </div>

      <div v-if="page.steps.length" class="rule-group">
        <h5>阶梯价格</h5>
        <ol class="step-list">
          <li v-for="step in page.steps" :key="step.step"><span>第 {{ step.step }} 阶</span>{{ step.paid_only ? '付费' : '' }}星钻 {{ step.jewels }} 个 · {{ step.draws }} 次</li>
        </ol>
      </div>

      <div v-for="exchange in page.exchanges" :key="exchange.heading" class="rule-group">
        <h5>{{ exchangeTitle(exchange) }}</h5>
        <p v-if="exchangeSummary(exchange)" class="exchange-summary">{{ exchangeSummary(exchange) }}</p>
        <ul v-else class="exchange-list">
          <li v-for="row in exchange.rows" :key="row.resource_id">
            <button type="button" class="exchange-card" @click="emit('open-card', cardPayload(row))">
              <img :src="getCardIconUrl(row.resource_id, true)" alt="" width="48" height="48" loading="lazy" decoding="async" />
              <span><strong>{{ cardText('card', row.card_title, 'title') }}</strong><small>{{ idolName(row.character_id) }} · {{ row.rarity }}</small></span>
              <b>{{ row.cost }} 个</b>
            </button>
          </li>
        </ul>
      </div>

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
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
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
const readPages = computed(() => props.pages.map(page => ({ ...page, groups: gashaRuleGroups(page.facts, page.title, names) })))

const CURRENCIES = { メモリースター: '记忆之星' }
function exchangeTitle(exchange) {
  const currency = CURRENCIES[exchange.currency] || archiveText('item', exchange.currency)
  const until = exchange.until_at.map(formatDateTime).join('、')
  return `${currency}交换${until ? `（截至 ${until}）` : ''}`
}

function exchangeSummary(exchange) {
  const costs = new Set(exchange.rows.map(row => row.cost))
  const pickup = new Set(props.pickupIds)
  if (costs.size !== 1 || exchange.rows.length !== pickup.size || !exchange.rows.every(row => pickup.has(row.resource_id))) return ''
  return `上方 ${exchange.rows.length} 张关联卡片均可交换，每张 ${[...costs][0]} 个`
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
.section-heading { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--gs-space-4); margin-bottom: var(--gs-space-5); }
.section-heading > div { flex: 1 1 240px; min-width: 0; }
.section-heading h3 { margin: 0; color: var(--gs-ink); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.section-heading p { margin: var(--gs-space-2) 0 0; color: var(--gs-color-muted); font-size: var(--gs-text-body); line-height: 1.6; }
.relation-count { flex: 0 0 auto; color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.rule-page { display: grid; gap: var(--gs-space-5); }
.rule-page + .rule-page { margin-top: var(--gs-space-7); padding-top: var(--gs-space-7); border-top: 1px solid var(--gs-rule); }
.rule-page h4 { margin: 0; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.rule-period { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.rule-group h5 { margin: 0 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.rule-group ul, .rule-group ol { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--gs-rule); }
.rule-group li { padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-2); line-height: 1.7; overflow-wrap: anywhere; }
.exchange-summary { margin: 0; padding: var(--gs-space-3) 0; border-top: 1px solid var(--gs-rule); border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-2); }
.rule-missing { color: var(--gs-ink-3) !important; }
.step-list li { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: var(--gs-space-4); font-variant-numeric: tabular-nums; }
.step-list span { color: var(--gs-ink-3); }
.exchange-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 0 var(--gs-space-7); }
.exchange-list li { padding: 0; }
.exchange-card { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); width: 100%; min-height: var(--gs-control-touch); padding: var(--gs-space-3) var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font: inherit; text-align: left; cursor: pointer; }
.exchange-card:hover { background: var(--gs-mint-wash); }
.exchange-card img { width: 48px; height: 48px; border-radius: var(--gs-radius-media); object-fit: cover; background: var(--gs-surface); }
.exchange-card span { display: grid; min-width: 0; }
.exchange-card strong { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.exchange-card small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.exchange-card b { color: var(--gs-ink-2); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.exchange-card:hover strong { color: var(--gs-mint-ink); }
.rule-source summary { min-height: var(--gs-control-touch); display: flex; align-items: center; color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.rule-source > div { padding: var(--gs-space-2) 0 var(--gs-space-4); color: var(--gs-ink-2); font-size: var(--gs-text-meta); line-height: 1.7; }
.rule-source h6 { margin: var(--gs-space-4) 0 var(--gs-space-1); color: var(--gs-ink); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.rule-source p { margin: 0; overflow-wrap: anywhere; }
.rule-page > .archive-source-link { justify-self: start; }
</style>
