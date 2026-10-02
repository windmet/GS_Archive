<template>
  <section v-if="gasha" class="gasha-detail" data-archive-scroll-container>
    <div class="gasha-identity" :class="{'ticket-only':gasha.source_type==='item-masterdata'}">
      <div class="gasha-banner">
        <img v-if="gasha.banner_url" :src="gasha.banner_url" :alt="gashaText(gasha.display_name)" />
        <p v-else class="ticket-banner-label">名称来自抽取道具记录</p>
      </div>
      <div class="gasha-summary">
        <div class="gasha-kicker">
          <span>GASHA ARCHIVE</span>
          <small class="curated">{{ categoryLabel(gasha.category) }}</small>
          <small v-if="gasha.is_reprint" class="reprint">复刻</small>
        </div>
        <h2>{{ gashaText(gasha.display_name) }}</h2>
        <p v-if="gashaText(gasha.display_name)!==gasha.display_name" lang="ja" class="gasha-original">{{ gasha.display_name }}</p>
        <dl>
          <div><dt>开放</dt><dd>{{ formatDateTime(gasha.start_at) }}</dd></div>
          <div><dt>结束</dt><dd>{{ formatDateTime(gasha.end_at) }}</dd></div>
          <div v-if="gasha.phase!=='ticket_record'"><dt>公告阶段</dt><dd>{{ phaseLabel(gasha.phase) }}</dd></div>
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

    <section v-if="gasha.tickets?.length" class="detail-section">
      <div class="section-heading"><h3>对应抽取道具</h3><span>{{ gasha.tickets.length }} 种</span></div>
      <p v-if="gasha.ticket_link_ambiguous" class="gasha-original">这些券对应同名卡池，现有道具记录无法区分两次 STAGE 公告。</p>
      <p v-if="gasha.source_type==='item-masterdata'" class="gasha-original">道具名称证明了此招募记录；开放时间和卡片范围尚未收录。</p>
      <ul class="ticket-list"><li v-for="ticket in gasha.tickets" :key="ticket.id"><button type="button" @click="emit('open-item',ticket.key)">{{ archiveText('item',ticket.source_name) }}</button><p>{{ archiveText('item',ticket.source_description,'description') }}</p></li></ul>
    </section>

    <section v-if="gasha.source_type!=='item-masterdata'" class="detail-section">
      <div class="section-heading">
        <div>
          <h3>关联卡片</h3>
          <p>{{ relationDescription }}</p>
        </div>
        <span class="derived-badge">{{ relationBadge }} · {{ pickupCards.length }}</span>
      </div>
      <ArchiveRelationList
        layout="grid"
        :items="pickupRelationItems"
        @select="emit('open-card', $event.payload)"
      />
    </section>

    <ArchiveTechnicalDetails :key="gasha.code" :evidence="gasha">
      <section class="detail-section evidence-section">
        <div class="section-heading"><h3>资料来源</h3></div>
        <dl class="evidence-grid">
          <div><dt>公告</dt><dd>{{ gasha.source_type==='item-masterdata'?'未收录公告，仅有道具记录':'Raw · client_master_data table 173' }}</dd></div>
          <div><dt>卡片关系</dt><dd>{{ gasha.source_type==='item-masterdata'?'未确认':relationEvidence }}</dd></div>
          <div><dt>名称</dt><dd>{{ gasha.source_type==='item-masterdata'?'道具主数据名称':`Curated · ${gasha.name_source?.source_label || 'wiki / banner 核对'}` }}</dd></div>
          <div v-if="gasha.ticket_evidence"><dt>中文译名</dt><dd>道具译文提取 · 初译，待校对</dd></div>
          <div><dt>逻辑卡池</dt><dd>{{ gasha.logical_id }}</dd></div>
          <div><dt>服务实例</dt><dd>Missing · GashaListReply 未留存</dd></div>
        </dl>
      </section>
    </ArchiveTechnicalDetails>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveRelationList from './ArchiveRelationList.vue'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'
import {gashaText} from './useArchiveGashaText.js'
import {archiveText} from './useArchiveCollectionText.js'
import {archiveText as cardText} from './useArchiveCardTitle.js'

const props = defineProps({
  gasha: { type: Object, default: null },
  idolName: { type: Function, required: true },
})
const emit = defineEmits(['open-card','open-item'])

const CATEGORY_LABELS = {
  standard_pickup: '通常招募',
  growing_fes: 'GROWING FES',
  stage_step_up: 'STAGE 招募',
  full_roster_series: '全员系列',
  ticket_named: '道具补录',
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
  return usesRelatedCards.value ? '同期卡片' : '推定关联'
})
const relationDescription = computed(() => {
  if (isReprintRelation.value) return '已确认对应原卡池的复刻内容'
  return usesRelatedCards.value
    ? '同一卡池其他公告中收录的关联卡片'
    : '根据突破素材与开放时间推定的关联，尚未确认实际招募内容。'
})
const relationEvidence = computed(() => {
  if (isReprintRelation.value) return `Curated · 外部公告确认复刻自 ${props.gasha?.reprint_of || ''}`
  return usesRelatedCards.value
    ? `Grouped · 同逻辑卡池主公告 ${props.gasha?.primary_code || ''}`
    : 'Derived · 精确时间与突破道具'
})
const pickupRelationItems = computed(() => pickupCards.value.map(card => ({
  id: `card-${card.card_resource_id}`,
  kind: 'card',
  label: usesRelatedCards.value ? relationBadge.value : '卡池 Pickup',
  title: cardText('card',card.card_title,'title') || '卡名待确认',
  meta: `${props.idolName(card.character_id)} · ${card.rarity}`,
  evidenceLabel: isReprintRelation.value ? 'Confirmed' : (usesRelatedCards.value ? 'Grouped' : 'Derived'),
  evidenceTone: isReprintRelation.value ? 'confirmed' : (usesRelatedCards.value ? 'grouped' : 'derived'),
  evidence: relationEvidence.value,
  statusLabel: '已建档',
  statusTone: 'available',
  resource: card.card_resource_id,
  imageUrl: getCardIconUrl(card.card_resource_id, true),
  imageAlt: card.card_title || '卡名待确认',
  payload: card,
})))

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || '未分类'
}

function phaseLabel(phase) {
  return phase === 'final_day' ? '最终日公告' : '主公告'
}

function formatDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return '未记录'
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
.gasha-original { color:#71818b;font-size:12px;line-height:1.7;overflow-wrap:anywhere; }
.ticket-banner-label { display:grid;min-height:120px;place-items:center;color:#607e80; }
.gasha-identity.ticket-only { grid-template-columns:1fr;gap:12px; }
.ticket-only .gasha-banner { aspect-ratio:auto; }
.ticket-only .ticket-banner-label { min-height:42px;margin:0;font-size:13px; }
.ticket-list { list-style:none;padding:0;display:grid;gap:10px; }
.ticket-list li { border:1px solid #deeaeb;border-radius:7px;padding:12px; }
.ticket-list button { background:transparent;border:0;color:#157a72;text-align:left;cursor:pointer;font:inherit;line-height:1.6; }
.ticket-list p { font-size:12px;white-space:pre-wrap;color:#627680;line-height:1.7;margin:6px 0 0; }
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
.evidence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; margin: 0; }
.evidence-grid div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 10px; padding: 8px 0; border-bottom: 1px solid #edf0f2; }
.evidence-grid dt { color: #7d898f; font-size: 0.64rem; }
.evidence-grid dd { margin: 0; color: #394a52; font-size: 0.66rem; }
@media (max-width: 800px) {
  .gasha-identity { grid-template-columns: 1fr; gap: 18px; padding: 16px; }
  .detail-section { padding: 18px 16px; }
}
@media (max-width: 520px) {
  .evidence-grid { grid-template-columns: 1fr; }
  .gasha-summary h2 { font-size: 1rem; }
}
</style>
