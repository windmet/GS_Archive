<template>
  <section v-if="gasha" class="gasha-detail" data-archive-scroll-container>
    <div class="gasha-identity" :class="{'ticket-only':gasha.source_type==='item-masterdata'}">
      <div class="gasha-banner">
        <img v-if="gasha.banner_url" :src="gasha.banner_url" :alt="gashaText(gasha.display_name)" />
        <p v-else class="ticket-banner-label">名称来自抽取道具记录</p>
      </div>
      <div class="gasha-summary">
        <h2>{{ gashaText(gasha.display_name) }}</h2>
        <p v-if="gashaText(gasha.display_name)!==gasha.display_name" lang="ja" class="gasha-original">{{ gasha.display_name }}</p>
        <p class="gasha-category">{{ categoryLabel(gasha.category) }}<template v-if="gasha.is_reprint"> · 复刻</template></p>
        <dl>
          <div><dt>开放</dt><dd>{{ formatDateTime(gasha.start_at) }}</dd></div>
          <div><dt>结束</dt><dd>{{ formatDateTime(gasha.end_at) }}</dd></div>
        </dl>
        <ArchiveSourceLink :url="gasha.name_source?.source_url" :label="gasha.name_source?.source_label || '名称核对来源'" />
      </div>
    </div>

    <section v-if="gasha.tickets?.length" class="detail-section">
      <div class="section-heading"><h3>对应抽取道具</h3><span>{{ gasha.tickets.length }} 种</span></div>
      <p v-if="gasha.ticket_link_ambiguous" class="gasha-note">这些券对应同名卡池，现有道具记录无法区分两次 STAGE 公告。</p>
      <p v-if="gasha.source_type==='item-masterdata'" class="gasha-note">道具名称证明了此招募记录；开放时间和卡片范围尚未收录。</p>
      <ul class="ticket-list"><li v-for="ticket in gasha.tickets" :key="ticket.id"><button type="button" :data-archive-focus-id="`gasha-ticket:${ticket.key}`" @click="emit('open-item',ticket.key)">{{ archiveText('item',ticket.source_name) }}</button><p>{{ archiveText('item',ticket.source_description,'description') }}</p></li></ul>
    </section>

    <section v-if="gasha.source_type!=='item-masterdata'" class="detail-section">
      <div class="section-heading">
        <div>
          <h3>关联卡片</h3>
          <p>{{ relationDescription }}</p>
        </div>
        <span class="relation-count">{{ pickupCards.length }} 张 · {{ relationBadge }}</span>
      </div>
      <ArchiveRelationList
        layout="grid"
        :items="pickupRelationItems"
        @select="emit('open-card', $event.payload)"
      />
    </section>

    <ArchiveTechnicalDetails :key="gasha.code" :evidence="gasha">
      <dl class="evidence-grid">
        <div v-if="gasha.phase!=='ticket_record'"><dt>公告阶段</dt><dd>{{ phaseLabel(gasha.phase) }}</dd></div>
        <div><dt>公告</dt><dd>{{ gasha.source_type==='item-masterdata'?'未收录公告，仅有道具记录':'游戏内主数据' }}</dd></div>
        <div><dt>卡片关系</dt><dd>{{ gasha.source_type==='item-masterdata'?'未确认':relationEvidence }}</dd></div>
        <div><dt>名称</dt><dd>{{ gasha.source_type==='item-masterdata'?'道具主数据名称':`人工核对：${gasha.name_source?.source_label || 'Wiki 与卡池横幅'}` }}</dd></div>
        <div v-if="gasha.ticket_evidence"><dt>中文译名</dt><dd>{{ gasha.ticket_evidence.status==='reviewed' ? '已校对，非终稿' : '初译，待校对' }}</dd></div>
        <div><dt>服务端卡池信息</dt><dd>关服后未能保存</dd></div>
      </dl>
    </ArchiveTechnicalDetails>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveSourceLink from './ArchiveSourceLink.vue'
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
  if (isReprintRelation.value) return `外部公告确认复刻自 ${props.gasha?.reprint_of || ''}`
  return usesRelatedCards.value
    ? `同一卡池主公告 ${props.gasha?.primary_code || ''} 收录`
    : '按开放时间与突破道具推定'
})
const pickupRelationItems = computed(() => pickupCards.value.map(card => ({
  id: `card-${card.card_resource_id}`,
  kind: 'card',
  label: usesRelatedCards.value ? relationBadge.value : '',
  title: cardText('card',card.card_title,'title') || '卡名待确认',
  meta: `${props.idolName(card.character_id)} · ${card.rarity}`,
  evidenceLabel: isReprintRelation.value ? 'Confirmed' : (usesRelatedCards.value ? 'Grouped' : 'Derived'),
  evidenceTone: isReprintRelation.value ? 'confirmed' : (usesRelatedCards.value ? 'grouped' : 'derived'),
  evidence: relationEvidence.value,
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
.gasha-detail { height: 100%; overflow-y: auto; background: var(--gs-paper); container-type: inline-size; font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
.gasha-identity { display: grid; grid-template-columns: minmax(420px, 1.45fr) minmax(280px, 0.55fr); gap: var(--gs-space-7); padding: var(--gs-space-7) max(var(--gs-space-7), calc((100% - 1120px) / 2)); border-bottom: 1px solid var(--gs-line); background: transparent; }
.gasha-banner { align-self: start; overflow: hidden; aspect-ratio: 940 / 510; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-media); background: var(--gs-line); }
.gasha-banner img { display: block; width: 100%; height: 100%; object-fit: contain; }
.gasha-summary { min-width: 0; padding-top: var(--gs-space-2); }
.gasha-summary h2 { margin: var(--gs-space-3) 0 var(--gs-space-6); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.45; text-wrap: balance; overflow-wrap: anywhere; }
.gasha-original { color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular);line-height:1.7;overflow-wrap:anywhere; }
.gasha-note { color:var(--gs-color-muted);font-size:var(--gs-text-body);font-weight:var(--gs-weight-regular);line-height:1.7;overflow-wrap:anywhere; }
.ticket-banner-label { display:grid;min-height:120px;place-items:center;color:var(--gs-ink-3); }
.gasha-identity.ticket-only { grid-template-columns:1fr;gap:var(--gs-space-4); }
.ticket-only .gasha-banner { aspect-ratio:auto; }
.ticket-only .ticket-banner-label { min-height:42px;margin:0;font-size:var(--gs-text-ui); }
.ticket-list { list-style:none;padding:0;display:grid;gap:0;border-top:1px solid var(--gs-rule); }
.ticket-list li { min-width:0;padding:var(--gs-space-4) 0;border-bottom:1px solid var(--gs-line); }
.ticket-list button { display:block;width:100%;min-height:var(--gs-control-touch);background:transparent;border:0;color:var(--gs-mint-ink);text-align:left;cursor:pointer;font:inherit;font-size:var(--gs-text-body);font-weight:var(--gs-weight-semibold);line-height:1.6;overflow-wrap:anywhere; }
.ticket-list p { font-size:var(--gs-text-body);font-weight:var(--gs-weight-regular);white-space:pre-wrap;color:var(--gs-ink-3);line-height:1.7;margin:var(--gs-space-2) 0 0;overflow-wrap:anywhere; }
.gasha-summary dl { margin: 0; }
.gasha-summary dl div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: var(--gs-space-4); padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); font-size: var(--gs-text-meta); }
.gasha-summary dt { color: var(--gs-ink-3); font-weight: var(--gs-weight-medium); }
.gasha-summary dd { margin: 0; color: var(--gs-ink-2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
/* Keep the source icon beside the first text line when a long label wraps. */
.gasha-summary :deep(.archive-source-link) { display: block; max-width: 100%; min-height: var(--gs-control-normal); margin-top: var(--gs-space-5); color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); line-height: 1.6; text-decoration: none; overflow-wrap: anywhere; }
.gasha-summary :deep(.archive-source-link svg) { display: inline; margin-right: var(--gs-space-2); vertical-align: middle; }
.gasha-summary :deep(.archive-source-link small) { display: block; margin-top: var(--gs-space-2); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-regular); }
.detail-section { padding: var(--gs-space-7) max(var(--gs-space-7), calc((100% - 1120px) / 2)); border-bottom: 1px solid var(--gs-line); background: transparent; }
.detail-section + .detail-section { margin-top: var(--gs-space-4); }
.section-heading { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--gs-space-4); margin-bottom: var(--gs-space-5); }
.section-heading > div { flex: 1 1 240px; min-width: 0; }
.section-heading > span { font-size: var(--gs-text-meta); }
.gasha-category { margin: 0 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.relation-count { flex: 0 0 auto; color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.section-heading h3 { margin: 0; color: var(--gs-ink); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.section-heading p { margin: var(--gs-space-2) 0 0; color: var(--gs-color-muted); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); line-height: 1.6; }
.evidence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--gs-space-7); margin: 0; }
.evidence-grid div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: var(--gs-space-4); padding: var(--gs-space-3) 0; border-bottom: 1px solid var(--gs-line); }
.evidence-grid dt { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.evidence-grid dd { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-meta); overflow-wrap: anywhere; }
.gasha-detail :deep(.relation-labels strong) { font-size: var(--gs-text-caption); font-weight: var(--gs-weight-semibold); }
.gasha-detail :deep(.relation-labels small) { font-size: var(--gs-text-caption); font-weight: var(--gs-weight-medium); }
.gasha-detail :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-bold); }
.gasha-detail :deep(.relation-meta), .gasha-detail :deep(.relation-proof) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.gasha-detail :deep(.relation-copy code) { font-size: var(--gs-text-caption); }
.gasha-detail > :deep(.archive-technical) { margin: var(--gs-space-7) max(var(--gs-space-7), calc((100% - 1120px) / 2)) var(--gs-space-9); }
.gasha-detail :deep(.archive-technical summary) { min-height: var(--gs-control-touch); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.gasha-detail :deep(.archive-technical-body) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.gasha-detail :deep(.archive-technical pre) { font-size: var(--gs-text-caption); }
.gasha-detail :deep(button:focus-visible), .gasha-detail :deep(a:focus-visible), .gasha-detail :deep(summary:focus-visible) { outline: var(--gs-focus-ring) solid var(--gs-color-accent); outline-offset: var(--gs-focus-offset); }
@container (max-width: 800px) {
  .gasha-identity { grid-template-columns: 1fr; gap: var(--gs-space-5); padding: var(--gs-space-5); }
}
@media (max-width: 800px) {
  .detail-section { padding: var(--gs-space-6) var(--gs-space-5); }
}
@media (max-width: 760px), (pointer: coarse) {
  .gasha-summary :deep(.archive-source-link) { min-height: var(--gs-control-touch); }
}
@media (max-width: 520px) {
  .evidence-grid { grid-template-columns: 1fr; }
}
</style>
