<template>
  <section v-if="gasha" class="gasha-detail">
    <div class="gasha-identity">
      <div class="gasha-banner">
        <img :src="gasha.banner_url" :alt="gasha.display_name" />
      </div>
      <div class="gasha-summary">
        <div class="gasha-kicker">
          <span>GASHA {{ gasha.code }}</span>
          <small class="curated">{{ categoryLabel(gasha.category) }}</small>
          <small v-if="gasha.is_reprint" class="reprint">复刻</small>
        </div>
        <h2>{{ gasha.display_name }}</h2>
        <dl>
          <div><dt>开放</dt><dd>{{ formatDateTime(gasha.start_at) }}</dd></div>
          <div><dt>结束</dt><dd>{{ formatDateTime(gasha.end_at) }}</dd></div>
          <div><dt>公告 ID</dt><dd>{{ gasha.announcement_id }}</dd></div>
          <div><dt>目标 ID</dt><dd>{{ gasha.destination_id }}</dd></div>
          <div><dt>公告阶段</dt><dd>{{ phaseLabel(gasha.phase) }}</dd></div>
          <div v-if="gasha.logical_member_codes?.length > 1"><dt>同期记录</dt><dd>{{ gasha.logical_member_codes.join(' / ') }}</dd></div>
        </dl>
        <a
          v-if="gasha.name_source?.source_url"
          :href="gasha.name_source.source_url"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink :size="15" />
          {{ gasha.name_source.source_label || '名称核对来源' }}
        </a>
      </div>
    </div>

    <section class="detail-section">
      <div class="section-heading">
        <div>
          <h3>关联卡片</h3>
          <p>{{ relationDescription }}</p>
        </div>
        <span class="derived-badge">{{ relationBadge }} · {{ pickupCards.length }}</span>
      </div>
      <div class="pickup-grid">
        <button
          v-for="card in pickupCards"
          :key="card.card_resource_id"
          @click="emit('open-card', card)"
        >
          <img :src="getCardIconUrl(card.card_resource_id, true)" :alt="card.card_title || card.card_resource_id" />
          <span>
            <strong>{{ card.card_title || card.card_resource_id }}</strong>
            <small>{{ idolName(card.character_id) }} · {{ card.rarity }}</small>
            <code>{{ card.card_resource_id }}</code>
          </span>
          <ChevronRight :size="18" />
        </button>
      </div>
    </section>

    <section class="detail-section evidence-section">
      <div class="section-heading"><h3>资料来源</h3></div>
      <dl class="evidence-grid">
        <div><dt>公告</dt><dd>Raw · client_master_data table 173</dd></div>
        <div><dt>卡片关系</dt><dd>{{ relationEvidence }}</dd></div>
        <div><dt>名称</dt><dd>Curated · {{ gasha.name_source?.source_label || 'wiki / banner 核对' }}</dd></div>
        <div><dt>逻辑卡池</dt><dd>{{ gasha.logical_id }}</dd></div>
        <div><dt>服务实例</dt><dd>Missing · GashaListReply 未留存</dd></div>
      </dl>
    </section>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight, ExternalLink } from '@lucide/vue'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'

const props = defineProps({
  gasha: { type: Object, default: null },
  idolName: { type: Function, required: true },
})
const emit = defineEmits(['open-card'])

const CATEGORY_LABELS = {
  standard_pickup: '通常招募',
  growing_fes: 'GROWING FES',
  stage_step_up: 'STAGE 招募',
  full_roster_series: '全员系列',
}

const pickupCards = computed(() => {
  const direct = props.gasha?.derived_pickup_cards || []
  return direct.length ? direct : (props.gasha?.related_pickup_cards || [])
})
const usesRelatedCards = computed(() =>
  !(props.gasha?.derived_pickup_cards?.length) && Boolean(props.gasha?.related_pickup_cards?.length),
)
const isReprintRelation = computed(() =>
  usesRelatedCards.value && props.gasha?.related_pickup_source === 'reprint',
)
const relationBadge = computed(() => {
  if (isReprintRelation.value) return '复刻卡片'
  return usesRelatedCards.value ? '同期卡片' : 'Derived'
})
const relationDescription = computed(() => {
  if (isReprintRelation.value) return `继承自原卡池 ${props.gasha?.reprint_of || ''} 的复刻内容`
  return usesRelatedCards.value
    ? `继承自主公告 ${props.gasha?.primary_code || ''} 的同一卡池卡片`
    : 'LimitbreakItemId + 卡池开放时间'
})
const relationEvidence = computed(() => {
  if (isReprintRelation.value) return `Curated · 外部公告确认复刻自 ${props.gasha?.reprint_of || ''}`
  return usesRelatedCards.value
    ? `Grouped · 同逻辑卡池主公告 ${props.gasha?.primary_code || ''}`
    : 'Derived · 精确时间与突破道具'
})

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || '未分类'
}

function phaseLabel(phase) {
  return phase === 'final_day' ? '最终日公告' : '主公告'
}

function formatDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return 'unknown'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(timestamp * 1000))
}
</script>

<style scoped>
.gasha-detail { height: 100%; overflow-y: auto; background: #f7f9fa; }
.gasha-identity { display: grid; grid-template-columns: minmax(420px, 1.45fr) minmax(280px, 0.55fr); gap: 28px; padding: 26px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dfe5e8; background: #fff; }
.gasha-banner { align-self: start; overflow: hidden; aspect-ratio: 940 / 510; border: 1px solid #e2e5e7; border-radius: 6px; background: #eef1f2; }
.gasha-banner img { display: block; width: 100%; height: 100%; object-fit: contain; }
.gasha-summary { min-width: 0; padding-top: 4px; }
.gasha-kicker { display: flex; align-items: center; gap: 8px; color: #1c8880; font-size: 0.63rem; font-weight: 800; }
.gasha-kicker small { padding: 2px 5px; border-radius: 3px; background: #eef1f3; color: #7b858b; font-size: 0.55rem; font-weight: 600; }
.gasha-kicker small.curated { background: #e8f7f5; color: #177b74; }
.gasha-kicker small.reprint { background: #fff0db; color: #965f13; }
.gasha-summary h2 { margin: 10px 0 20px; font-size: 1.18rem; line-height: 1.45; }
.gasha-summary dl { margin: 0; }
.gasha-summary dl div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; padding: 7px 0; border-bottom: 1px solid #edf0f2; font-size: 0.68rem; }
.gasha-summary dt { color: #849097; }
.gasha-summary dd { margin: 0; color: #36474f; font-variant-numeric: tabular-nums; }
.gasha-summary a { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; color: #167d76; font-size: 0.68rem; text-decoration: none; }
.detail-section { padding: 22px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #e1e6e8; background: #fff; }
.detail-section + .detail-section { margin-top: 12px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 14px; }
.section-heading h3 { margin: 0; color: #26363e; font-size: 0.88rem; }
.section-heading p { margin: 4px 0 0; color: #88939a; font-size: 0.61rem; }
.derived-badge { padding: 4px 7px; border-radius: 4px; background: #fff2d6; color: #8b6413; font-size: 0.6rem; font-weight: 700; }
.pickup-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 9px; }
.pickup-grid button { display: grid; grid-template-columns: 62px minmax(0, 1fr) 18px; align-items: center; gap: 11px; min-width: 0; min-height: 76px; padding: 7px; border: 1px solid #e2e6e8; border-radius: 6px; background: #fff; color: #2e3e46; cursor: pointer; text-align: left; }
.pickup-grid button:hover { border-color: #82c9c4; background: #f6fbfa; }
.pickup-grid img { width: 62px; height: 62px; border-radius: 4px; object-fit: cover; }
.pickup-grid button > span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pickup-grid strong { overflow: hidden; font-size: 0.73rem; text-overflow: ellipsis; white-space: nowrap; }
.pickup-grid small { color: #718087; font-size: 0.61rem; }
.pickup-grid code { color: #919ba0; font-size: 0.58rem; }
.pickup-grid svg { color: #8c989e; }
.evidence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; margin: 0; }
.evidence-grid div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 10px; padding: 8px 0; border-bottom: 1px solid #edf0f2; }
.evidence-grid dt { color: #7d898f; font-size: 0.64rem; }
.evidence-grid dd { margin: 0; color: #394a52; font-size: 0.66rem; }
@media (max-width: 800px) {
  .gasha-identity { grid-template-columns: 1fr; gap: 18px; padding: 16px; }
  .detail-section { padding: 18px 16px; }
}
@media (max-width: 520px) {
  .pickup-grid, .evidence-grid { grid-template-columns: 1fr; }
  .gasha-summary h2 { font-size: 1rem; }
}
</style>
