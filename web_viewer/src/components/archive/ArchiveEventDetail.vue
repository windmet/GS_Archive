<template>
  <article v-if="view" class="event-detail" data-archive-scroll-container>
    <section class="event-identity">
      <div class="event-visual">
        <template v-if="bannerBinding?.url && !bannerFailed">
          <img class="event-banner" :src="bannerBinding.url" :alt="view.identity.title" @error="bannerFailed=true" />
          <small v-if="resources?.heroRole==='original-announcement'" class="event-media-note">原活动宣传图 · 复刻时间见本页记录</small>
        </template>
        <p v-else class="event-banner-unavailable">{{ event.title }}<small>活动图片暂不可用</small></p>
      </div>
      <div class="event-summary">
        <div class="event-kicker">
          <small>{{ eventTypeLabel }}</small>
          <small>{{ scopeLabel }}</small>
        </div>
        <h2>{{ view.identity.title }}</h2>
        <ArchiveSourceLink v-if="exchangeRewards" :url="exchangeRewards.source.url" :label="exchangeRewards.source.title" />
        <dl>
          <div><dt>活动开始</dt><dd>{{ formatDateTime(view.period.startAt) }}</dd></div>
          <div><dt>活动结束</dt><dd>{{ formatDateTime(view.period.endAt) }}</dd></div>
          <div><dt>展示结束</dt><dd>{{ formatDateTime(view.period.displayEndAt) }}</dd></div>
          <div v-if="view.period.exchangeEndAt>0&&view.period.exchangeEndAt<4102412400"><dt>兑换结束</dt><dd>{{ formatDateTime(view.period.exchangeEndAt) }}</dd></div>
          <div><dt>活动形式</dt><dd>{{ eventTypeLabel }}</dd></div>

        </dl>
      </div>
    </section>

    <details class="event-media-archive">
      <summary>活动视觉资料</summary>
      <div class="event-media-grid"><DomainMediaPreview v-for="role in ['banner','logo','background','resultBackground']" :key="role" :binding="view.media[role]" :name="({banner:'剧情入口横幅',logo:'活动标志',background:'活动背景',resultBackground:'结算背景'})[role]"/></div>
    </details>
    <section v-if="event.exists || view.seasonalCampaign || view.identity.kind!=='collection'" class="story-band" aria-labelledby="event-synopsis-title">
      <div>
        <span>故事简介</span>
        <h3 id="event-synopsis-title">{{ story?.preplaySynopsis?.title || event.title }}</h3>
        <p>{{ story?.preplaySynopsis?.text || (view.seasonalCampaign ? '引子及角色篇章已收录于关联季节企划。' : event.exists ? '剧情已收录，可选择章节观看。' : '剧情暂未收录。') }}</p>
      </div>
      <div class="story-actions">
        <button v-if="view.seasonalCampaign" :data-archive-focus-id="`event-seasonal:${view.identity.id}:${view.seasonalCampaign.id}`" @click="emit('open-seasonal',view.seasonalCampaign.id)"><BookOpen :size="17"/>阅读季节企划</button>
        <button v-else-if="firstReading" :data-archive-focus-id="`event-read:${view.identity.id}:overview:${firstReading.document_id}`" @click="emit('read',firstReading.document_id)"><BookOpen :size="17" />阅读本期活动剧情（共 {{ episodes.length }} 话）</button>
        <button v-if="!view.seasonalCampaign" :disabled="!event.exists" @click="emit('play')">
          <Play :size="17" fill="currentColor" />
          <span>{{ event.exists ? '播放活动剧情' : '缺少剧情文件' }}</span>
        </button>
        <a
          v-for="resource in externalResources"
          :key="resource.external_id"
          :href="resource.platform.canonical_url"
          target="_blank"
          rel="noopener noreferrer external"
        >
          <ExternalLink :size="16" />
          <span><strong>社区中文资源</strong><small>{{ resource.uploader.name }} · Bilibili</small></span>
        </a>
      </div>
    </section>

    <section v-if="episodes.length" class="detail-section episode-section" aria-labelledby="event-episodes-title">
      <div class="section-heading">
        <div>
          <h3 id="event-episodes-title">活动剧情</h3>
          <p>选择章节开始观看剧情。</p>
        </div>
        <span class="episode-count">{{ episodes.length }} 章</span>
      </div>
      <div class="episode-list">
        <div v-for="(episode, index) in episodes" :key="episode.id" class="episode-entry">
        <button
          :disabled="!event.exists"
          @click="emit('play-episode', episode)"
        >
          <span class="episode-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="episode-copy">
            <strong>{{ episode.label }}</strong>
          </span>
          <span class="episode-stats">
            <span>{{ episode.dialogueCount }} 段对白</span>
            <span>{{ episode.voiceCount }} 段语音</span>
          </span>
          <Play :size="16" fill="currentColor" />
        </button>
        <button v-if="readingByFile.has(episode.file)" class="episode-reading" :aria-label="`阅读 ${episode.label}`" :data-archive-focus-id="`event-read:${view.identity.id}:episode:${episode.id}`"
          @click="emit('read', readingByFile.get(episode.file).document_id)"><BookOpen :size="16" />阅读</button>
        </div>
      </div>
      <p v-if="readingError" role="status">{{ readingError }} <button @click="emit('retry-reading')">重试阅读目录</button></p>
    </section>

    <section class="detail-section reward-section" aria-labelledby="event-rewards-title">
      <div class="section-heading">
        <div>
          <h3 id="event-rewards-title">活动报酬卡</h3>
          <p>{{ view.identity.kind==='collection' ? '收集活动道具后，在活动商店兑换卡片。' : '通过阅读剧情或累计活动点数获得的报酬卡。' }}</p>
        </div>
        <span class="raw-badge">{{ rewardCards.length + (exchangeRewards?.cards.length || 0) }} 张</span>
      </div>
      <div v-if="rewardCards.length" class="reward-grid">
        <div v-for="card in rewardCards" :key="card.card_resource_id" class="event-reward-card">
          <DomainMediaPreview :binding="card.image" :name="card.card_title" compact/>
          <button type="button" class="event-reward-open" :data-archive-focus-id="`event-card:${view.identity.id}:reward:${card.card_resource_id}`" @click="emit('open-card',card)"><div class="reward-copy">
            <div class="reward-identity"><span v-if="card.rarity" class="reward-rarity">{{ card.rarity }}</span><span class="reward-name">{{ displayIdolName(card.character_id,card.character_name) || card.character_name || idolName(card.character_id) }}</span></div>
            <strong>{{ cardTitle(card.card_title) }}</strong>
            <ul>
              <li v-for="method in card.methods" :key="method.key">
                <BookOpen v-if="method.kind === 'story'" :size="13" />
                <Gauge v-else :size="13" />
                <span>{{ rewardMethodLabel(card,method) }}</span>
              </li>
            </ul>
          </div>
          </button>
        </div>
      </div>
      <div v-if="exchangeRewards" class="exchange-rewards">
        <p class="exchange-source">兑换归属与数量据 Wikiwiki 补录，卡片身份与资源对应客户端资料。</p>
        <div class="reward-grid">
          <div v-for="card in exchangeRewards.cards" :key="card.card_resource_id" class="event-reward-card">
            <DomainMediaPreview :binding="card.image" :name="card.card_title" compact/>
            <button type="button" class="event-reward-open" :data-archive-focus-id="`event-card:${view.identity.id}:exchange:${card.card_resource_id}`" @click="emit('open-card',card)">
              <div class="reward-copy"><div class="reward-identity"><span v-if="card.rarity" class="reward-rarity">{{ card.rarity }}</span><span class="reward-name">{{ displayIdolName(card.character_id,card.character_name) || card.character_name }}</span></div><strong>{{ cardTitle(card.card_title) }}</strong>
                <ul><li>{{ card.cost.nameJa }} × {{ card.cost.amount }}</li><li>限兑 {{ card.exchangeLimit }} 次 · Wiki 补录</li></ul>
              </div>
            </button>
          </div>
        </div>
        <details v-if="exchangeRewards.exchangeRows?.length" class="wiki-exchange-table"><summary>完整兑换清单 · {{ exchangeRewards.exchangeRows.length }} 条（Wikiwiki）</summary><p><ArchiveSourceLink :url="exchangeRewards.source.url" label="核对本期兑换表" /></p><div class="exchange-table-scroll"><table><thead><tr><th>兑换报酬（原文）</th><th>所需道具</th><th>限兑次数</th></tr></thead><tbody><tr v-for="(row,index) in exchangeRewards.exchangeRows" :key="index"><td>{{ row.label }}</td><td>{{ row.cost }}</td><td>{{ row.limit }}</td></tr></tbody></table></div></details>
      </div>
      <p v-if="!rewardCards.length&&!exchangeRewards" class="empty-copy">{{ view.identity.kind==='collection' ? '尚未收录兑换商店的卡片明细。' : '尚未收录此活动的卡片报酬信息。' }}</p>
    </section>

    <section v-if="view.rewards" class="detail-section general-reward-section" aria-labelledby="event-general-rewards">
      <div class="section-heading"><div><h3 id="event-general-rewards">{{ view.identity.kind==='collection' ? '活动兑换道具' : '奖励明细与藏品' }}</h3><p>{{ exchangeRewards ? '通过演唱会与工作收集道具，用于兑换活动报酬。完整兑换清单见上方 Wikiwiki 补录。' : '历史客户端配置。兑换商店明细与实时排行榜尚未收录。' }}</p></div></div>
      <nav v-if="view.rewards.materials?.length" class="event-materials" aria-label="活动材料"><div v-for="item in view.rewards.materials" :key="`${item.role}:${item.itemId}`" class="event-material"><DomainMediaPreview v-if="item.image?.url" :binding="item.image" :name="item.nameJa" compact/><button type="button" @click="openQuick(`item:${item.itemId}`)">{{ item.nameJa }}</button></div></nav>
      <ArchiveRewardTable :rows="view.rewards.general || []" @open-entity="openQuick" @open-target="emit('open-target',$event)" />
      <div v-if="view.relatedEvents?.length" class="event-related-history"><h3>关联活动</h3><button v-for="related in view.relatedEvents" :key="related.event_id" type="button" class="domain-link" @click="emit('open-event',related)">{{ related.title }}</button></div>
    </section>

    <section v-if="castReferences.length||units.length" class="detail-section" aria-labelledby="event-cast-title">
      <div class="section-heading"><h3 id="event-cast-title">出演与归属</h3></div>
      <div class="cast-layout">
        <div class="idol-list" :class="{ 'has-story-visuals': hasStoryVisuals }">
          <ArchiveIdolReference
            v-for="entry in castReferences"
            :key="entry.idol.idol_code"
            :reference="entry.reference"
            :density="entry.reference.imageCandidates[0]?.kind === 'event_story_visual' ? 'visual' : 'portrait'"
            @open="emit('open-idol', entry.idol)"
          />
        </div>
        <div class="unit-list">
          <button v-for="unit in units" :key="unit.unit_id" :data-archive-focus-id="`event-unit:${view.identity.id}:${unit.unit_id}`" @click="emit('open-unit', unit)">
            <img :src="getUnitLogoUrl(unit.unit_code)" alt="" />
            <span>{{ unit.unit_name }}</span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="derivedOnlyCards.length" class="detail-section" aria-labelledby="event-related-title">
      <div class="section-heading">
        <div><h3 id="event-related-title">其他同期关联</h3><p>仅由开放时间与出演阵容推导，尚未在报酬表中确认获得方式。</p></div>
        <span class="derived-badge">{{ derivedOnlyCards.length }} 张</span>
      </div>
      <ArchiveRelationList layout="grid" :items="derivedRelationItems" @select="emit('open-card', $event.payload)" />
    </section>

    <CollectionQuickView v-if="quickEntity" :client="client" :bootstrap="bootstrap" :entity-key="quickEntity" :display-idol-name="displayIdolName" @close="quickEntity=''" @open-entity="emit('open-entity',$event)" @open-card="emit('open-collection-card',$event)" />

    <ArchiveTechnicalDetails :key="event.event_id" :evidence="{ provenance: view.provenance, file: event.file, classification: event.classification_source }">
      <p>活动信息、累计 PT 报酬与剧情阅读报酬均来自游戏内主数据，未经改写。</p>
    </ArchiveTechnicalDetails>
  </article>
</template>

<script setup>
import { computed,ref,watch,defineAsyncComponent } from 'vue'
import { BookOpen, ExternalLink, Gauge, Play } from '@lucide/vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveSourceLink from './ArchiveSourceLink.vue'
import {archiveText as cardText} from './useArchiveCardTitle.js'
const cardTitle=source=>cardText('card',source,'title')
import ArchiveRelationList from './ArchiveRelationList.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import ArchiveRewardTable from './ArchiveRewardTable.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
import '../../styles/archive-domains.css'
import { getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'
import {eventResources} from '../../data/eventResourceGraph.js'
import {rewardConditions} from './DomainPresentation.mjs'
import {uiLocale} from '../../localization/ui/UiLocaleStore.js'

const CollectionQuickView=defineAsyncComponent(()=>import('./CollectionQuickView.vue'))
const quickEntity=ref('')
function openQuick(key){if(/^(item|honor):\d+$/.test(key))quickEntity.value=key}
const props = defineProps({
  displayIdolName:{type:Function,default:()=>''},
  client: Object,
  bootstrap: Object,
  view: {type:Object,default:null},
  externalResources: { type: Array, default: () => [] },
  readingError: { type: String, default: '' },
})
const emit = defineEmits(['read', 'retry-reading', 'play', 'play-episode', 'open-card', 'open-collection-card', 'open-idol', 'open-unit','open-entity','open-event','open-target','open-seasonal'])
const bannerFailed=ref(false)
watch(()=>props.view?.identity.eventCode,()=>{bannerFailed.value=false;quickEntity.value=''})
const readingByFile = computed(() => new Map((props.view?.readingEntries || []).filter(entry => entry.status === 'ready').map(entry => [entry.source_file, entry])))
const firstReading=computed(()=>readingByFile.value.get(props.view?.episodes?.[0]?.file))

const event=computed(()=>props.view?.story.entry)
const story=computed(()=>props.view?.story)
const episodes=computed(()=>props.view?.episodes || [])
const units=computed(()=>props.view?.units || [])
const resources=computed(()=>eventResources(props.view?.identity))
const exchangeRewards=computed(()=>resources.value?.exchangeRewards)
const bannerBinding=computed(()=>resources.value?.hero || props.view?.media.background || props.view?.media.logo)
const castReferences=computed(()=>(props.view?.castReferences || []).map(entry=>({
  idol:props.view.cast.find(idol=>idol.idol_code===entry.idol_code),
  reference:{...entry.reference,displayName:props.displayIdolName(entry.idol_code,entry.reference.displayName)||entry.reference.displayName},
})))
const hasStoryVisuals=computed(()=>castReferences.value.some(entry=>entry.reference.imageCandidates[0]?.kind==='event_story_visual'))
const eventTypeLabel=computed(()=>({theater:'THEATER 累计 PT',tour:'TOUR 累计 PT',collection:'315 CARNIVAL',valentine:'VALENTINE',whiteday:'WHITEDAY'}[props.view?.identity.kind] || '活动剧情'))
const scopeLabel=computed(()=>({fixed_unit_event:'固定组合团活',attribute_event:`${props.view?.identity.attribute || ''} 属性团曲`.trim(),mixed_unit_event:'跨组合团活'}[props.view?.identity.scope] || (props.view?.identity.isReprint?'复刻活动':'历史活动')))
const rewardCards=computed(()=>props.view?.rewards.cards || [])
const rewardRowsByKey=computed(()=>{
  const rows=new Map()
  for(const row of props.view?.rewards.general || []) {
    if(row.key) rows.set(row.key,rows.has(row.key)?null:row)
  }
  return rows
})
const rewardEpisodesById=computed(()=>{
  const entries=new Map()
  for(const episode of episodes.value) entries.set(String(episode.id),entries.has(String(episode.id))?null:episode)
  return entries
})
const rewardCardIds = computed(() => new Set(rewardCards.value.map(card => card.card_resource_id)))
const derivedOnlyCards = computed(() => (props.view?.cards || []).filter(card => !rewardCardIds.value.has(card.card_resource_id)))
const derivedRelationItems = computed(() => derivedOnlyCards.value.map(card => ({
  id: `event-derived-card:${props.view.identity.id}:${card.card_resource_id}`,
  kind: 'card',
  label: '同期关联卡',
  title: card.card_title,
  meta: `${props.displayIdolName(card.character_id,card.character_name) || card.character_name} · ${card.rarity}`,
  evidenceLabel: 'Derived',
  evidenceTone: 'derived',
  evidence: card.relation_type,
  statusLabel: '已建档',
  statusTone: 'available',
  resource: card.card_resource_id,
  imageUrl: getCardIconUrl(card.card_resource_id, true),
  imageAlt: card.card_title,
  payload: card,
})))

function idolName(id) {
  return props.view.cast.find(idol => idol.idol_code === id)?.display_name || '姓名待确认'
}
function rewardMethodLabel(card,method) {
  // The method key and target identify the raw reward; the episode ID joins the
  // published chapter label. Resource-ID suffixes are not player-facing numbers.
  const row=rewardRowsByKey.value.get(method.key)
  if(row?.product?.kind==='card' && row.product.target?.card===card.card_resource_id) {
    if(method.kind==='story' && row.scope?.startsWith('story') && row.episodeId) {
      const episode=rewardEpisodesById.value.get(String(row.episodeId))
      if(!episode?.label) return method.label
      let label=episode.label
      if(uiLocale.value==='zh-CN') {
        const ordinal=label.match(/^エピソード\s*(\d+)$/)
        if(ordinal) label=`第${ordinal[1]}话`
        else if(label==='プロローグ') label='序章'
      }
      return `${label} 阅读${row.scope==='story-in-event-term'?'（活动期内）':''}`
    }
    if(method.kind==='point' && ['point','repeated'].includes(row.scope) &&
      [row.totalPoint,row.intervalPoint,row.offsetPoint,row.limitPoint].some(Number.isFinite)) {
      const quantity=Number.isFinite(row.product.amount)?` · ×${formatNumber(row.product.amount)}`:''
      return `${rewardConditions(row).join(' · ')}${quantity}`
    }
  }
  if(method.key===`fragments-${card.card_resource_id}`) {
    const fragments=(props.view?.rewards.general || []).filter(entry=>
      entry.product?.kind==='cardFragment' && entry.product.target?.card===card.card_resource_id)
    // Summarize only finite, one-off point grants; panel/repeated or incomplete
    // records retain the producer label instead of inventing an acquisition rule.
    if(fragments.length && fragments.every(entry=>entry.scope==='point' &&
      Number.isFinite(entry.totalPoint) && Number.isFinite(entry.product.amount) &&
      [entry.intervalPoint,entry.offsetPoint,entry.limitPoint].every(value=>value===undefined))) {
      const quantity=fragments.reduce((sum,entry)=>sum+entry.product.amount,0)
      return `${formatNumber(fragments[0].totalPoint)} PT 起 · ${fragments.length} 次碎片 · 共 ×${formatNumber(quantity)}`
    }
  }
  return method.label
}
function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}
function formatDateTime(timestamp) {
  if(Number(timestamp)>=4102412400)return '配置占位日期'
  if (timestamp===null || timestamp===undefined || !Number.isFinite(Number(timestamp)) || Number(timestamp)<=0) return '未记录'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo',
  }).format(new Date(Number(timestamp) * 1000))
}
</script>

<style scoped>
.event-detail { container: event-detail / inline-size; min-width: 0; height: 100%; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
.event-detail button { font-family: inherit; font-weight: var(--gs-weight-semibold); }
.wiki-exchange-table { margin-top: var(--gs-space-6); font-size: var(--gs-text-body); color: #526b73; }
.wiki-exchange-table summary { min-height: var(--gs-control-normal); padding: var(--gs-space-3) 0; cursor: pointer; color: #1b7a73; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.exchange-table-scroll { overflow: auto; }
.wiki-exchange-table table { width: 100%; border-collapse: collapse; text-align: left; }
.wiki-exchange-table th, .wiki-exchange-table td { padding: var(--gs-space-3) var(--gs-space-4); border-bottom: 1px solid #e5ecee; min-width: 90px; line-height: 1.5; }
.wiki-exchange-table th { background: #f2f7f7; color: #497271; font-weight: var(--gs-weight-semibold); }
.wiki-exchange-table td:first-child { min-width: 200px; }
.exchange-source { margin: 0 0 var(--gs-space-5); color: #69767e; font-size: var(--gs-text-body); line-height: 1.65; }
.exchange-source a { color: #147d76; }
.event-banner-unavailable { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; margin: 0; padding: var(--gs-space-6); text-align: center; color: #57738a; gap: var(--gs-space-4); overflow-wrap: anywhere; }
.event-banner-unavailable small { font-size: var(--gs-text-meta); }
.event-related-history { margin-top: var(--gs-space-6); }
.event-related-history h3 { font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.event-related-history .domain-link { min-height: var(--gs-control-normal); padding: var(--gs-space-2) 0; font-size: var(--gs-text-ui); overflow-wrap: anywhere; }
.episode-entry { display: flex; min-width: 0; }
.episode-entry > button:first-child { flex: 1; min-width: 0; }
.episode-list .episode-reading { display: flex; justify-content: center; flex: 0 0 auto; min-width: 62px; gap: var(--gs-space-2); color: var(--gs-mint-ink); font-size: var(--gs-text-ui); }
.event-media-note { position: absolute; bottom: 0; left: 0; right: 0; padding: var(--gs-space-3); background: #fffffff2; font-size: var(--gs-text-meta); color: #536872; }
.event-media-archive { padding: var(--gs-space-4) var(--gs-space-7); border-bottom: 1px solid #dfe5e8; font-size: var(--gs-text-ui); }
.event-media-archive > summary { min-height: var(--gs-control-normal); padding-block: var(--gs-space-3); cursor: pointer; font-weight: var(--gs-weight-semibold); }
.event-media-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: var(--gs-space-5); margin-top: var(--gs-space-4); }
.event-identity { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, .6fr); gap: var(--gs-space-7); padding: var(--gs-space-7) max(var(--gs-space-7), calc((100% - 1120px) / 2)); border-bottom: 1px solid var(--gs-line); background: transparent; }
.event-visual { min-width: 0; position: relative; align-self: start; overflow: hidden; aspect-ratio: 940 / 510; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: #e9eef0; }
.event-banner { display: block; width: 100%; height: 100%; object-fit: contain; }
.event-summary { min-width: 0; padding-top: var(--gs-space-2); }
.event-kicker { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); color: #16857d; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.event-kicker small { padding: var(--gs-space-2); border-radius: var(--gs-radius-control); background: #eaf7f5; color: #277870; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.event-summary h2 { margin: var(--gs-space-4) 0 var(--gs-space-6); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.45; overflow-wrap: anywhere; }
.event-summary dl { margin: 0; }
.event-summary dl div { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: var(--gs-space-4); padding: var(--gs-space-3) 0; border-bottom: 1px solid #edf0f2; }
.event-summary dt { color: #849097; font-size: var(--gs-text-meta); }
.event-summary dd { margin: 0; color: #36474f; font-size: var(--gs-text-body); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.story-band { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-7); padding: var(--gs-space-7) max(var(--gs-space-7), calc((100% - 1120px) / 2)); border-bottom: 1px solid var(--gs-line); background: var(--gs-mint-wash); }
.story-band > div { min-width: 0; }
.story-band > div > span { color: #147d76; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.story-band h3 { margin: var(--gs-space-3) 0 var(--gs-space-2); font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); overflow-wrap: anywhere; }
.story-band p { max-width: 800px; margin: 0; color: #405159; font-size: var(--gs-text-body); line-height: 1.75; white-space: pre-line; overflow-wrap: anywhere; }
.story-actions { display: grid; flex: 0 0 auto; gap: var(--gs-space-3); min-width: 174px; max-width: 100%; }
.story-actions > button, .story-actions > a { display: inline-flex; align-items: center; justify-content: center; gap: var(--gs-space-3); min-height: var(--gs-control-normal); max-width: 100%; padding: var(--gs-space-3) var(--gs-space-4); border: 1px solid #158f87; border-radius: var(--gs-radius-control); background: #158f87; color: #fff; cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-decoration: none; }
.story-actions > button svg, .story-actions > a svg { flex: 0 0 auto; }
.story-actions > button:disabled { border-color: #cbd3d6; background: #dfe5e7; color: #78848a; cursor: not-allowed; }
.story-actions > a { justify-content: flex-start; border-color: #bedbd8; background: #fff; color: var(--gs-mint-ink); }
.story-actions > a span { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; overflow-wrap: anywhere; }
.story-actions > a strong { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.story-actions > a small { color: #63817e; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.detail-section { min-width: 0; padding: var(--gs-space-7) max(var(--gs-space-7), calc((100% - 1120px) / 2)); border-bottom: 1px solid var(--gs-line); background: transparent; }
.detail-section + .detail-section { margin-top: var(--gs-space-4); }
.section-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gs-space-3) var(--gs-space-6); margin-bottom: var(--gs-space-5); }
.section-heading > div { min-width: 0; }
.section-heading h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); overflow-wrap: anywhere; }
.section-heading p { margin: var(--gs-space-2) 0 0; color: #849097; font-size: var(--gs-text-body); line-height: 1.65; }
.raw-badge, .derived-badge { flex: 0 0 auto; padding: var(--gs-space-2) var(--gs-space-3); border-radius: var(--gs-radius-control); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.raw-badge { background: #e5f6f3; color: var(--gs-mint-ink); }
.derived-badge { background: #fff2d6; color: #8b6413; }
.episode-section { background: transparent; }
.episode-count { color: #6f7e85; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.episode-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--gs-space-7); border-top: 1px solid var(--gs-ink); }
.episode-list button { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto 28px; align-items: center; gap: var(--gs-space-3); min-height: 58px; padding: var(--gs-space-3) var(--gs-space-4); border: 0; border-bottom: 1px solid var(--gs-line); background: transparent; color: var(--gs-ink); cursor: pointer; font: inherit; font-weight: var(--gs-weight-semibold); text-align: left; }
.episode-list button:disabled { cursor: not-allowed; opacity: .55; }
.episode-number { color: var(--gs-mint-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.episode-copy { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; overflow-wrap: anywhere; }
.episode-copy strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.episode-copy small { overflow: hidden; color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); text-overflow: ellipsis; white-space: nowrap; }
.episode-stats { display: flex; flex-direction: column; align-items: flex-end; gap: var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.episode-list button > svg { color: var(--gs-mint-ink); }
.reward-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 var(--gs-space-6); }
.event-reward-card { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: 96px; padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.event-reward-open { display: block; min-width: 0; min-height: 84px; padding: 0; border: 0; background: transparent; color: #28363e; cursor: pointer; font: inherit; font-weight: var(--gs-weight-semibold); text-align: left; }
.event-reward-card :deep(.domain-media-compact) { width:72px;height:72px;min-width:0;margin:0; }
.event-materials { display: flex; flex-wrap: wrap; gap: var(--gs-space-4); margin: 0 0 var(--gs-space-5); }
.event-material { display: flex; align-items: center; gap: var(--gs-space-4); min-width: 0; max-width: 100%; padding: var(--gs-space-4); border: 1px solid #d3e2ed; border-radius: var(--gs-radius-panel); background: #fff; }
.event-material :deep(.domain-media-compact) { margin:0; }
.event-material > button { min-width: 0; min-height: var(--gs-control-normal); border: 0; padding: 0 var(--gs-space-2); background: transparent; color: #36506b; cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-align: left; overflow-wrap: anywhere; }
.reward-copy { min-width: 0; }
.reward-identity { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--gs-space-2); min-width: 0; }
.reward-rarity { flex: 0 0 auto; padding: 0 var(--gs-space-2); border: 1px solid #d7e2e1; border-radius: var(--gs-radius-control); color: #466862; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); line-height: 1.5; }
.reward-name { color: #5f7774; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); overflow-wrap: anywhere; }
.reward-copy strong { display: block; margin: var(--gs-space-2) 0 var(--gs-space-3); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.45; overflow-wrap: anywhere; }
.reward-copy ul { display: grid; gap: var(--gs-space-2); margin: 0; padding: 0; list-style: none; }
.reward-copy li { display: flex; align-items: flex-start; gap: var(--gs-space-2); color: #69767e; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); line-height: 1.4; }
.reward-copy li svg { flex: 0 0 auto; margin-top: 1px; color: #248980; }
.empty-copy { margin: 0; color: #7b878e; font-size: var(--gs-text-body); }
.cast-layout { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--gs-space-6); }
/* 64px portrait, arrow and card padding leave about 150px for a complete name. */
.idol-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: var(--gs-space-3); min-width: 0; }
.idol-list.has-story-visuals { grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); }
.idol-list :deep(.archive-idol-reference) { gap: var(--gs-space-4); padding: var(--gs-space-3); border-radius: var(--gs-radius-panel); }
.idol-list :deep(.idol-reference-copy) { gap: var(--gs-space-2); }
.idol-list :deep(.idol-reference-copy strong), .idol-list :deep(.idol-reference-copy small) { white-space: normal; text-overflow: clip; overflow-wrap: anywhere; line-height: 1.4; }
.idol-list :deep(.idol-reference-copy strong) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.idol-list :deep(.idol-reference-copy small) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
/* Keep the 170px artwork and 230px visual card; compact copy spacing fits both text roles. */
.idol-list :deep(.density-visual) { gap: var(--gs-space-2); padding: var(--gs-space-2) var(--gs-space-3); }
.unit-list { display: grid; gap: var(--gs-space-3); min-width: 180px; }
.unit-list button { display: flex; align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: 52px; padding: var(--gs-space-3) var(--gs-space-4); border: 1px solid #e0e5e8; border-radius: var(--gs-radius-control); background: #fff; color: #26323b; cursor: pointer; font: inherit; font-weight: var(--gs-weight-semibold); text-align: left; }
.unit-list img { width: 70px; height: 38px; object-fit: contain; }
.unit-list img { flex: 0 0 auto; }
.unit-list span { min-width: 0; font-size: var(--gs-text-body); overflow-wrap: anywhere; }
.evidence-section { margin-bottom: var(--gs-space-6); }
.evidence-section dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--gs-space-7); margin: 0; }
.evidence-section dl div { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: var(--gs-space-4); padding: var(--gs-space-3) 0; border-bottom: 1px solid #edf0f2; }
.evidence-section dt { color: #7d898f; font-size: var(--gs-text-meta); }
.evidence-section dd { margin: 0; overflow-wrap: anywhere; color: #394a52; font-size: var(--gs-text-meta); }

.event-summary :deep(.archive-source-link), .wiki-exchange-table :deep(.archive-source-link) { gap: var(--gs-space-3); min-height: var(--gs-control-normal); max-width: 100%; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.event-summary :deep(.archive-source-link small), .wiki-exchange-table :deep(.archive-source-link small) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.event-media-grid :deep(.domain-media-preview) { margin-bottom: var(--gs-space-6); padding: var(--gs-space-5); border-radius: var(--gs-radius-panel); }
.event-media-grid :deep(figcaption) { margin-top: var(--gs-space-4); font-size: var(--gs-text-meta); }
.event-media-grid :deep(.domain-media-preview button), .event-reward-card :deep(.domain-media-preview button), .event-material :deep(.domain-media-preview button) { min-height: var(--gs-control-compact); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); border-radius: var(--gs-radius-control); }
.detail-section :deep(.relation-list) { gap: var(--gs-space-3); }
.detail-section :deep(.relation-row) { gap: var(--gs-space-4); padding: var(--gs-space-3) var(--gs-space-4); font-family: inherit; border-radius: var(--gs-radius-control); }
.detail-section :deep(.relation-copy) { gap: var(--gs-space-2); }
.detail-section :deep(.relation-labels) { gap: var(--gs-space-2); }
.detail-section :deep(.relation-labels strong), .detail-section :deep(.relation-labels small), .detail-section :deep(.relation-meta), .detail-section :deep(.relation-proof), .detail-section :deep(.relation-copy code) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.detail-section :deep(.relation-labels small) { padding: var(--gs-space-1) var(--gs-space-2); }
.detail-section :deep(.relation-copy b) { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); }
.general-reward-section :deep(.domain-reward-list) { gap: 0; font-size: var(--gs-text-body); }
.general-reward-section :deep(.domain-reward-entry) { gap: var(--gs-space-4); padding: var(--gs-space-4) 0; border: 0; border-bottom: 1px solid var(--gs-line); border-radius: 0; background: transparent; }
.general-reward-section :deep(.domain-reward-entry.is-card) { border-left: 0; background: transparent; }
.general-reward-section :deep(.domain-reward-icon) { border: 0; border-radius: 0; background: transparent; }
.detail-section :deep(.domain-reward-conditions > small) { margin-bottom: var(--gs-space-3); font-size: var(--gs-text-meta); }
.detail-section :deep(.domain-reward-conditions > div) { gap: var(--gs-space-2); }
.general-reward-section :deep(.domain-reward-condition) { padding: 0; border-radius: 0; background: transparent; color: #5f7774; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.general-reward-section :deep(.domain-reward-condition + .domain-reward-condition)::before { content: '·'; margin-right: var(--gs-space-2); color: #9aa7aa; }
.detail-section :deep(.domain-reward-quantity) { font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.detail-section :deep(.domain-reward-product) { gap: var(--gs-space-4); }
.detail-section :deep(.domain-reward-name) { gap: var(--gs-space-3); padding: var(--gs-space-2) 0; font-family: inherit; font-size: var(--gs-text-body); border-radius: var(--gs-radius-control); }
.detail-section :deep(.domain-reward-name strong) { font-weight: var(--gs-weight-semibold); }
.detail-section :deep(.domain-reward-name small), .detail-section :deep(.domain-reward-unresolved), .detail-section :deep(.domain-reward-campaigns) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.detail-section :deep(.domain-table-controls) { flex-wrap: wrap; gap: var(--gs-space-3) var(--gs-space-5); margin-bottom: var(--gs-space-5); font-size: var(--gs-text-meta); }
.detail-section :deep(.domain-table-controls label) { flex: 1 1 220px; gap: var(--gs-space-3); min-width: 0; font-size: var(--gs-text-ui); }
.detail-section :deep(.domain-table-controls select) { flex: 1; min-width: 0; min-height: var(--gs-control-normal); padding: var(--gs-space-3) var(--gs-space-4); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); border-radius: var(--gs-radius-field); }
.detail-section :deep(.domain-pagination) { flex-wrap: wrap; gap: var(--gs-space-4); margin-top: var(--gs-space-6); font-size: var(--gs-text-meta); }
.detail-section :deep(.domain-pagination button) { min-height: var(--gs-control-normal); padding: var(--gs-space-3) var(--gs-space-4); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); border-radius: var(--gs-radius-control); }
.detail-section :deep(.archive-technical), .event-detail > :deep(.archive-technical) { margin-top: var(--gs-space-5); border-radius: var(--gs-radius-control); }
.detail-section :deep(.archive-technical summary), .event-detail > :deep(.archive-technical summary) { min-height: var(--gs-control-normal); padding: var(--gs-space-4) var(--gs-space-5); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.detail-section :deep(.archive-technical-body), .event-detail > :deep(.archive-technical-body) { padding: 0 var(--gs-space-5) var(--gs-space-5); font-size: var(--gs-text-meta); }
.detail-section :deep(.archive-technical pre), .event-detail > :deep(.archive-technical pre) { font-size: var(--gs-text-meta); }

.event-media-archive > summary:focus-visible, .wiki-exchange-table > summary:focus-visible,
.story-actions > :focus-visible, .episode-list button:focus-visible, .event-reward-open:focus-visible,
.event-material > button:focus-visible, .unit-list button:focus-visible, .event-related-history button:focus-visible,
.event-summary :deep(a:focus-visible), .wiki-exchange-table :deep(a:focus-visible),
.event-media-grid :deep(.domain-media-preview button:focus-visible), .event-reward-card :deep(.domain-media-preview button:focus-visible), .event-material :deep(.domain-media-preview button:focus-visible),
.idol-list :deep(button:focus-visible), .detail-section :deep(.relation-row:focus-visible),
.detail-section :deep(.domain-rewards button:focus-visible), .detail-section :deep(.domain-rewards select:focus-visible),
.detail-section :deep(.archive-technical summary:focus-visible), .event-detail > :deep(.archive-technical summary:focus-visible) {
  outline: var(--gs-focus-ring) solid #158f87; outline-offset: var(--gs-focus-offset);
}
@media (hover: hover) and (pointer: fine) {
  .episode-list button:hover:not(:disabled) { background: #eff9f7; }
  .event-reward-open:hover { color: #157c78; }
}
@media (hover: none), (pointer: coarse) {
  .idol-list :deep(button.archive-idol-reference:hover) { border-color: #dce8e8; background: #f8fbfb; }
  .detail-section :deep(.relation-row:hover) { border-color: #dfe5e8; background: #fff; }
  .detail-section :deep(button.domain-reward-name:hover) { background: transparent; color: inherit; }
}
@media (max-width: 900px) { .reward-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .event-identity { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-6); padding: var(--gs-space-5); }
  .story-band { align-items: stretch; flex-direction: column; gap: var(--gs-space-5); padding: var(--gs-space-6) var(--gs-space-5); }
  .detail-section { padding: var(--gs-space-6) var(--gs-space-5); }
  .event-media-archive { padding-inline: var(--gs-space-5); }
  .cast-layout { grid-template-columns: minmax(0, 1fr); }
  .unit-list { min-width: 0; }
  .evidence-section dl { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px), (pointer: coarse) {
  .story-actions > button, .story-actions > a, .event-media-archive > summary, .wiki-exchange-table > summary,
  .event-material > button, .event-related-history button,
  .event-summary :deep(.archive-source-link), .wiki-exchange-table :deep(.archive-source-link),
  .event-media-grid :deep(.domain-media-preview button), .event-reward-card :deep(.domain-media-preview button), .event-material :deep(.domain-media-preview button),
  .detail-section :deep(.domain-pagination button), .detail-section :deep(.archive-technical summary), .event-detail > :deep(.archive-technical summary) { min-height: var(--gs-control-touch); }
  .detail-section :deep(.domain-table-controls select) { min-height: var(--gs-control-touch); max-width: 100%; font-size: var(--gs-text-subtitle); }
}
@media (max-width: 620px) {
  .episode-list { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 520px) {
  .episode-list button { grid-template-columns: 28px minmax(0, 1fr) 26px; }
  .episode-stats { display: none; }
  .reward-grid { grid-template-columns: minmax(0, 1fr); }
}
/* Reading/play and cast columns also follow the content width left by the Shell. */
@container event-detail (max-width: 800px) {
  .event-identity { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-6); }
  .story-band { align-items: stretch; flex-direction: column; gap: var(--gs-space-5); }
  .cast-layout { grid-template-columns: minmax(0, 1fr); }
  .unit-list { min-width: 0; }
  .episode-list { grid-template-columns: minmax(0, 1fr); }
  .reward-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container event-detail (max-width: 520px) {
  .episode-list button { grid-template-columns: 28px minmax(0, 1fr) 26px; }
  .episode-stats { display: none; }
  .reward-grid, .event-media-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
