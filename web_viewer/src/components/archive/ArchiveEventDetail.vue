<template>
  <article v-if="view" class="event-detail" data-archive-scroll-container>
    <!-- Head in reading order (线框减法册 L3): KV → type and name → time → cast; the story follows. Every picture
         of the event (KV, entry banner, backgrounds, logo) opens one gallery. The right column keeps one left edge. -->
    <section class="event-identity">
      <div class="event-visual-column">
        <div class="event-visual">
          <button v-if="bannerBinding?.url && !bannerFailed" type="button" class="event-banner-open" :aria-label="`放大查看活动图片（共 ${gallery.length} 张）`" @click="openGallery(0)">
            <img class="event-banner" :src="bannerBinding.url" :alt="view.identity.title" @error="bannerFailed=true" />
            <span class="event-gallery-count" aria-hidden="true"><Maximize2 :size="13" />{{ gallery.length }}</span>
          </button>
          <p v-else class="event-banner-unavailable">{{ event.title }}<small>活动图片暂不可用</small></p>
        </div>
        <small v-if="bannerBinding?.url && !bannerFailed && resources?.heroRole==='original-announcement'" class="event-media-note">原活动宣传图：图上的日期是原活动的</small>
        <ul v-if="galleryStrip.length" class="event-media-strip is-wide" aria-label="活动图片">
          <li v-for="item in galleryStrip" :key="item.role"><button type="button" :aria-label="`放大查看${item.label}`" @click="openGallery(item.index)"><img :src="item.src" alt="" loading="lazy" /></button><small>{{ item.label }}</small></li>
        </ul>
      </div>
      <div class="event-summary">
        <p class="event-kicker">{{ eventTypeLabel }} · {{ scopeLabel }}</p>
        <h2>{{ view.identity.title }}</h2>
        <div class="event-time">
          <p class="event-time-caption">活动时间 · {{ timeBlock.year }} · 日本时间</p>
          <p class="event-time-range">{{ timeBlock.range }}</p>
          <p v-if="timeBlock.after" class="event-time-after">{{ timeBlock.after }}</p>
          <button v-if="originalEvent" type="button" class="event-time-original" :data-archive-focus-id="`event-original:${view.identity.id}`" @click="emit('open-event', originalEvent.related)">原活动 {{ originalEvent.range }}<ChevronRight :size="15" aria-hidden="true" /></button>
        </div>
        <div v-if="castReferences.length || units.length" class="event-cast">
          <h3 class="event-cast-title">{{ units.length > 1 ? `出演 · ${castReferences.length} 人 · ${units.length} 个组合` : '出演' }}</h3>
          <button v-if="units.length === 1" type="button" class="event-cast-unit" :aria-label="`打开组合 ${units[0].unit_name}`" :data-archive-focus-id="`event-unit:${view.identity.id}:${units[0].unit_id}`" @click="emit('open-unit', units[0])">
            <img v-if="!unitLogoFailed" :src="getUnitLogoUrl(units[0].unit_code)" alt="" decoding="async" @error="unitLogoFailed=true" /><span v-else>{{ units[0].unit_name }}</span><ChevronRight :size="16" aria-hidden="true" />
          </button>
          <div v-if="castReferences.length" class="event-cast-people" :class="{ 'is-multi': units.length > 1 }">
            <ArchiveIdolReference v-for="entry in castReferences" :key="entry.idol.idol_code" class="event-person" :reference="entry.reference" density="identity" @open="emit('open-idol', entry.idol)" />
          </div>
          <span v-if="units.length > 1" class="event-cast-units"><button v-for="unit in units" :key="unit.unit_id" type="button" class="event-cast-unit-name" :data-archive-focus-id="`event-unit:${view.identity.id}:${unit.unit_id}`" @click="emit('open-unit', unit)">{{ unit.unit_name }}<ChevronRight :size="14" aria-hidden="true" /></button></span>
        </div>
        <ArchiveSourceLink v-if="exchangeRewards" :url="exchangeRewards.source.url" :label="exchangeRewards.source.title" />
      </div>
    </section>
    <!-- Story block in the story-family idiom: heading with count, synopsis as a quotation,
         one row of actions (reading is the page's primary action), then hairline episode rows. -->
    <section v-if="episodes.length || event.exists || view.seasonalCampaign || view.identity.kind!=='collection'" class="detail-section event-story" aria-labelledby="event-story-title">
      <div class="section-heading">
        <h3 id="event-story-title">活动剧情</h3>
        <small v-if="episodes.length" class="section-count">{{ episodes.length }} 话</small>
      </div>
      <blockquote class="event-synopsis" :aria-busy="synopsisView.pending.value || undefined">
        <strong v-if="synopsisTitle" :class="{ 'is-pending': synopsisView.titlePending.value }">{{ presentProducerAddressingText(synopsisTitle) }}</strong>
        <p v-if="synopsisView.view.value.primary.text" class="gs-flow" :lang="synopsisView.view.value.primary.locale" :class="{ 'is-pending': synopsisView.pending.value }">{{ flowForLocale(presentProducerAddressingText(synopsisView.view.value.primary.text), synopsisView.view.value.primary.locale) }}</p>
        <p v-else>{{ view.seasonalCampaign ? '引子及角色篇章已收录于关联季节企划。' : event.exists ? '剧情已收录，可选择章节观看。' : '剧情暂未收录。' }}</p>
        <small v-if="synopsisView.notice.value" class="event-synopsis-notice" role="status">{{ synopsisView.notice.value }}</small>
      </blockquote>
      <div class="story-actions" aria-label="观看方式">
        <button v-if="view.seasonalCampaign" class="story-action primary" :data-archive-focus-id="`event-seasonal:${view.identity.id}:${view.seasonalCampaign.id}`" @click="emit('open-seasonal',view.seasonalCampaign.id)"><BookOpen :size="16"/>阅读季节企划</button>
        <button v-else-if="firstReading" class="story-action primary" :data-archive-focus-id="`event-read:${view.identity.id}:overview:${firstReading.document_id}`" @click="emit('read',firstReading.document_id)"><BookOpen :size="16" />从第一话阅读</button>
        <button v-if="!view.seasonalCampaign" class="story-action" :class="{ primary: !firstReading }" :disabled="!event.exists" @click="emit('play')">
          <Play :size="15" fill="currentColor" />{{ event.exists ? '播放活动剧情' : '缺少剧情文件' }}
        </button>
        <a
          v-for="resource in externalResources"
          :key="resource.external_id"
          class="story-action"
          :href="resource.platform.canonical_url"
          target="_blank"
          rel="noopener noreferrer external"
          :title="`在 Bilibili 观看 ${resource.uploader.name} 投稿的社区中文资源`"
        >
          <ExternalLink :size="15" />社区中文资源 · {{ resource.uploader.name }}
        </a>
      </div>

      <ol v-if="episodes.length" class="episode-list" :class="{ 'is-collapsed': !episodesOpen && episodes.length > 5 }">
        <!-- As on the personal-story pages: the row reads the episode, the icon plays it. -->
        <li v-for="episode in episodes" :key="episode.id" class="episode-entry">
          <button v-if="readingByFile.has(episode.file)" class="episode-main" :aria-label="`阅读 ${presentIdolEpisodeLabel({ sourceName: episode.label })}`" :data-archive-focus-id="`event-read:${view.identity.id}:episode:${episode.id}`"
            @click="emit('read', readingByFile.get(episode.file).document_id)">
            <span class="episode-copy"><strong>{{ presentIdolEpisodeLabel({ sourceName: episode.label }) }}</strong><small>{{ episodeStats(episode) }}</small></span>
          </button>
          <div v-else class="episode-main">
            <span class="episode-copy"><strong>{{ presentIdolEpisodeLabel({ sourceName: episode.label }) }}</strong><small>{{ event.exists ? '暂无文字版，可观看演出' : '暂未收录' }}</small></span>
          </div>
          <button class="episode-play" :disabled="!event.exists" :aria-label="`播放 ${presentIdolEpisodeLabel({ sourceName: episode.label })}`" :title="`播放 ${presentIdolEpisodeLabel({ sourceName: episode.label })}`" @click="emit('play-episode', episode)">
            <Play :size="17" fill="currentColor" aria-hidden="true" />
          </button>
        </li>
      </ol>
      <!-- Phones list the first five episodes; the rest open in place. -->
      <button v-if="episodes.length > 5 && !episodesOpen" type="button" class="episode-more" @click="episodesOpen = true">显示全部 {{ episodes.length }} 话</button>
      <p v-if="readingError" role="status">{{ readingError }} <button @click="emit('retry-reading')">重试阅读目录</button></p>
    </section>

    <!-- Phones: the event's pictures come after its story, as an ordinary section (wide screens keep them under the KV). -->
    <section v-if="galleryStrip.length" class="detail-section event-gallery-section" aria-labelledby="event-gallery-title">
      <div class="section-heading"><h3 id="event-gallery-title">活动图片</h3><small class="section-count">{{ gallery.length }} 张</small></div>
      <ul class="event-media-strip" aria-label="活动图片">
        <li v-for="item in galleryStrip" :key="item.role"><button type="button" :aria-label="`放大查看${item.label}`" @click="openGallery(item.index)"><img :src="item.src" alt="" loading="lazy" /></button><small>{{ item.label }}</small></li>
      </ul>
    </section>

    <section v-if="songRelationItems.length" class="detail-section event-songs" aria-labelledby="event-songs-title">
      <div class="section-heading"><h3 id="event-songs-title">活动曲</h3></div>
      <ArchiveRelationList :items="songRelationItems" @select="emit('open-song',$event.payload)" />
    </section>

    <section class="detail-section reward-section" aria-labelledby="event-rewards-title">
      <div class="section-heading">
        <div>
          <h3 id="event-rewards-title">活动报酬卡</h3>
          <p>{{ view.identity.kind==='collection' ? '收集活动道具后，在活动商店兑换卡片。' : rewardWikiNote?.text.includes('任务') ? '通过阅读剧情、累计活动点数或完成活动任务获得的报酬卡。' : '通过阅读剧情或累计活动点数获得的报酬卡。' }}</p>
        </div>
        <small class="section-count">{{ rewardCards.length + (exchangeRewards?.cards.length || 0) }} 张</small>
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
                <Flag v-else-if="method.kind === 'mission'" :size="13" />
                <Gauge v-else :size="13" />
                <span>{{ rewardMethodLabel(card,method) }}</span>
              </li>
            </ul>
          </div>
          </button>
        </div>
      </div>
      <p v-if="rewardWikiNote" class="exchange-source">{{ rewardWikiNote.text }}<template v-for="source in rewardWikiNote.sources" :key="source.url"> <ArchiveSourceLink :url="source.url" :label="source.label" /></template></p>
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
    </section>

    <!-- Related events (the same series, the original of a reprint) as banner rows. -->
    <section v-if="relatedEventItems.length" class="detail-section event-related" aria-labelledby="event-related-events-title">
      <div class="section-heading"><h3 id="event-related-events-title">关联活动</h3><small class="section-count">{{ relatedEventItems.length }} 场</small></div>
      <ArchiveRelationList :items="relatedEventItems" @select="emit('open-event', $event.payload)" />
    </section>

    <section v-if="derivedOnlyCards.length" class="detail-section" aria-labelledby="event-related-title">
      <div class="section-heading">
        <div><h3 id="event-related-title">其他同期关联</h3><p>仅由开放时间与出演阵容推导，尚未在报酬表中确认获得方式。</p></div>
        <small class="section-count">{{ derivedOnlyCards.length }} 张</small>
      </div>
      <ArchiveRelationList layout="grid" :items="derivedRelationItems" @select="emit('open-card', $event.payload)" />
    </section>

    <CollectionQuickView v-if="quickEntity" :client="client" :bootstrap="bootstrap" :entity-key="quickEntity" :display-idol-name="displayIdolName" @close="quickEntity=''" @open-entity="emit('open-entity',$event)" @open-card="emit('open-collection-card',$event)" />

    <ArchiveImageLightbox :open="galleryIndex >= 0" :items="gallery" :initial-index="Math.max(galleryIndex, 0)" @close="galleryIndex = -1" />

    <ArchiveTechnicalDetails :key="event.event_id" :evidence="{ provenance: view.provenance, file: event.file, classification: event.classification_source }">
      <p>活动信息、累计 PT 报酬与剧情阅读报酬均来自游戏内主数据，未经改写。</p>
    </ArchiveTechnicalDetails>
  </article>
</template>

<script setup>
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { computed,ref,watch,defineAsyncComponent } from 'vue'
import { BookOpen, ChevronRight, ExternalLink, Flag, Gauge, Maximize2, Play } from '@lucide/vue'
import ArchiveImageLightbox from './ArchiveImageLightbox.vue'
import { getUnitLogoUrl } from '../../utils/AssetResolver.js'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveSourceLink from './ArchiveSourceLink.vue'
import {archiveText as cardText} from './useArchiveCardTitle.js'
const cardTitle=source=>cardText('card',source,'title')
import ArchiveRelationList from './ArchiveRelationList.vue'
import ArchiveIdolReference from './ArchiveIdolReference.vue'
import ArchiveRewardTable from './ArchiveRewardTable.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
import '../../styles/archive-domains.css'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'
import {eventBannerUrl,eventResources} from '../../data/eventResourceGraph.js'
import { useStorySynopsis } from './useStorySynopsis.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { flowForLocale } from '../../../shared/reading/ReadingTypography.js'
import {rewardConditions} from './DomainPresentation.mjs'
import {collectionKindForEntity} from '../../core/CollectionRouteState.js'

const CollectionQuickView=defineAsyncComponent(()=>import('./CollectionQuickView.vue'))
const quickEntity=ref('')
function openQuick(key){if(collectionKindForEntity(key))quickEntity.value=key}
const props = defineProps({
  displayIdolName:{type:Function,default:()=>''},
  client: Object,
  bootstrap: Object,
  view: {type:Object,default:null},
  externalResources: { type: Array, default: () => [] },
  readingError: { type: String, default: '' },
  loadReadingDocument: { type: Function, default: null },
})
const emit = defineEmits(['read', 'retry-reading', 'play', 'play-episode', 'open-card', 'open-collection-card', 'open-idol', 'open-unit','open-entity','open-event','open-song','open-target','open-seasonal'])
const bannerFailed=ref(false),unitLogoFailed=ref(false),episodesOpen=ref(false),galleryIndex=ref(-1)
watch(()=>props.view?.identity.eventCode,()=>{bannerFailed.value=false;unitLogoFailed.value=false;episodesOpen.value=false;galleryIndex.value=-1;quickEntity.value=''})
// One gallery for every picture of the event: the KV first, then the entry banner, the two backgrounds and the
// logo (which no longer repeats beside the name). The strip lists everything after the KV.
const MEDIA_NAMES={banner:'剧情入口横幅',background:'活动背景',resultBackground:'结算背景',logo:'活动 logo'}
const gallery=computed(()=>{
  const seen=new Set(), items=[]
  const add=(role,label,url)=>{ if(url && !seen.has(url)){ seen.add(url); items.push({role,label,src:url}) } }
  if(!bannerFailed.value) add('hero','活动主图',bannerBinding.value?.url)
  for(const [role,label] of Object.entries(MEDIA_NAMES)) add(role,label,props.view?.media?.[role]?.url)
  return items
})
const galleryStrip=computed(()=>gallery.value.map((item,index)=>({...item,index})).filter(item=>item.role!=='hero'))
const openGallery=index=>{ galleryIndex.value=index }
const relatedEventItems=computed(()=>(props.view?.relatedEvents||[]).map(related=>({
  id:`event-related:${related.event_id}`,kind:'event',label:'',title:related.title,meta:'',
  imageUrl:eventBannerUrl(related),imageAlt:related.title,payload:related,
})))
const readingByFile = computed(() => new Map((props.view?.readingEntries || []).filter(entry => entry.status === 'ready').map(entry => [entry.source_file, entry])))
const firstReading=computed(()=>readingByFile.value.get(props.view?.episodes?.[0]?.file))
// The synopsis is the first episode's synopsis row, translated like the story pages show it; the
// projection's source text is the fallback. It usually repeats the event title, so it gets its own
// heading only when the source titles differ.
const synopsisView=useStorySynopsis({ entry: firstReading, loadDocument: computed(() => props.loadReadingDocument),
  fallback: computed(() => props.view?.story?.preplaySynopsis), title: computed(() => props.view?.story?.preplaySynopsis?.title || '') })
const synopsisTitle=computed(()=>{
  const title=props.view?.story?.preplaySynopsis?.title
  return title && title!==props.view?.identity.title ? synopsisView.displayTitle.value : ''
})
const episodeStats=episode=>[episode.dialogueCount&&`${episode.dialogueCount} 段对白`,episode.voiceCount&&`${episode.voiceCount} 段语音`].filter(Boolean).join(' · ')

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
// The reward table was checked against Wikiwiki's 限定報酬 list; mission cards come from the event page itself.
const rewardWikiNote=computed(()=>{
  const check=props.view?.rewards.wikiCheck
  if(!check||!rewardCards.value.length)return null
  const missions=rewardCards.value.flatMap(card=>card.methods.filter(method=>method.kind==='mission'))
  return {text:missions.length?`报酬卡已与 Wikiwiki 活动限定報酬核对；${missions.length} 张活动任务报酬卡据活动页补录。`:'报酬卡已与 Wikiwiki 活动限定報酬核对。',
    sources:[{url:check.source.url,label:'过往活动一览'},...missions.slice(0,1).map(method=>({url:method.source.url,label:'活动页任务'}))]}
})
const rewardCardIds = computed(() => new Set(rewardCards.value.map(card => card.card_resource_id)))
const derivedOnlyCards = computed(() => (props.view?.cards || []).filter(card => !rewardCardIds.value.has(card.card_resource_id)))
// The event's BGM song; a reprint plays the original event's song.
const songRelationItems = computed(() => (props.view?.songs || []).map(song => ({
  id: `song:${song.song_code}`, kind: 'song', label: props.view.identity.isReprint ? '原活动曲' : '', title: song.title,
  meta: song.unit_name ? `演唱 · ${song.unit_name}` : '', imageUrl: song.jacket_url || '', imageAlt: `${song.title} 封面`, payload: song.song_code,
})))
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
      // Same presenter as the episode list above, so the condition names the row it points at.
      const label=presentIdolEpisodeLabel({ sourceName: episode.label })
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
// Time block: the year and the zone said once in the caption, the event period on its own line with weekdays
// (they match the KV's 「(月)」), what happens after it on a smaller line. A year is repeated only where it changes.
const WEEKDAYS=['日','一','二','三','四','五','六']
function jstParts(timestamp) {
  const at=Number(timestamp)
  if(!Number.isFinite(at) || at<=0 || at>=4102412400) return null
  const date=new Date((at+9*3600)*1000)
  return { year:date.getUTCFullYear(), month:date.getUTCMonth()+1, day:date.getUTCDate(), weekday:WEEKDAYS[date.getUTCDay()],
    time:`${String(date.getUTCHours()).padStart(2,'0')}:${String(date.getUTCMinutes()).padStart(2,'0')}` }
}
function shortDate(parts, year, { weekday=false }={}) {
  if(!parts) return '未记录'
  return `${parts.year!==year?`${parts.year}/`:''}${parts.month}/${parts.day}${weekday?` (${parts.weekday})`:''} ${parts.time}`
}
function periodRange(period, { weekday=true, withYear=false }={}) {
  const start=jstParts(period?.startAt), end=jstParts(period?.endAt)
  return `${shortDate(start,withYear ? null : start?.year,{weekday})} → ${shortDate(end,start?.year,{weekday})}`
}
const timeBlock=computed(()=>{
  const period=props.view?.period || {}, start=jstParts(period.startAt)
  const after=[['结果公示至',period.displayEndAt],['兑换至',period.exchangeEndAt]]
    .map(([label,at])=>[label,jstParts(at)]).filter(([,parts])=>parts).map(([label,parts])=>`${label} ${shortDate(parts,start?.year)}`)
  return { year:start ? `${start.year} 年` : '年份未记录', range:periodRange(period), after:after.join(' · ') }
})
// A reprint names its original event and that event's period, read from the original's own detail.
const originalPeriod=ref(null)
const originalRelated=computed(()=>props.view?.identity?.isReprint ? (props.view.relatedEvents || [])[0] || null : null)
watch(originalRelated, async related => {
  originalPeriod.value=null
  if(!related || !props.client || !props.bootstrap?.domains?.events) return
  try {
    const index=await props.client.load(props.bootstrap.domains.events)
    const pages=await Promise.all(index.pages.map(descriptor=>props.client.load(descriptor)))
    const row=pages.flatMap(page=>page.rows || []).find(entry=>String(entry.id)===String(related.event_id))
    const detail=row && await props.client.load({...row.detail,expectedId:String(row.id)},{expectedId:String(row.id)})
    if(originalRelated.value===related && detail?.view?.period) originalPeriod.value=detail.view.period
  } catch { originalPeriod.value=null }
}, { immediate:true })
const originalEvent=computed(()=>originalRelated.value && originalPeriod.value
  ? { related:originalRelated.value, range:periodRange(originalPeriod.value,{weekday:false,withYear:true}) } : null)
function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}
</script>

<style scoped>
/* Programme layout like the story pages: content sits on the paper, sections are split by a
   heading rule and hairlines, colours come from the role tokens. Only controls and floating
   things get a surface or a border. */
.event-detail { container: event-detail / inline-size; min-width: 0; height: 100%; overflow-y: auto; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
.event-detail button { font-family: inherit; font-weight: var(--gs-weight-semibold); }

/* Identity: banner beside the title and the period table. */
.event-identity { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, .6fr); gap: var(--gs-space-7); padding: var(--gs-space-8) max(var(--gs-space-7), calc((100% - var(--gs-content-width)) / 2)) var(--gs-space-7); }
.event-visual-column { display: grid; align-content: start; gap: var(--gs-space-4); min-width: 0; }
.event-visual { position: relative; align-self: start; min-width: 0; overflow: hidden; aspect-ratio: 940 / 510; border-radius: var(--gs-radius-media); background: var(--gs-line); }
/* The strip: the event's other pictures at thumbnail size, each named underneath. */
/* Pictures after the KV: thumbnails that open the gallery, each named underneath. */
.event-media-strip { display: flex; gap: var(--gs-space-5); margin: 0; padding: 0; overflow-x: auto; list-style: none; scrollbar-width: none; }
.event-media-strip li { display: grid; flex: none; gap: var(--gs-space-1); }
.event-media-strip button { display: block; width: 96px; height: 54px; padding: 0; border: 0; border-radius: var(--gs-radius-media); background: var(--gs-paper-2); overflow: hidden; cursor: zoom-in; }
.event-media-strip img { display: block; width: 100%; height: 100%; object-fit: contain; }
.event-media-strip small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.event-gallery-section { display: none; }
.event-banner-open { position: relative; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none; cursor: zoom-in; }
.event-gallery-count { position: absolute; top: var(--gs-space-3); right: var(--gs-space-3); display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--gs-radius-control); background: rgb(16 28 44 / 58%); color: var(--gs-media-ink); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; }
/* Time: a caption with the year and zone, the period, then what follows it; no rules. */
.event-time { display: grid; gap: var(--gs-space-1); }
.event-time p { margin: 0; }
.event-time-caption { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.event-time-range { color: var(--gs-ink); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; }
.event-time-after { color: var(--gs-ink-2); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.event-time-original { display: inline-flex; align-items: center; gap: 2px; justify-self: start; min-height: var(--gs-control-compact); margin-top: var(--gs-space-1); padding: 0; border: 0; background: none; color: var(--gs-ink-2); cursor: pointer; font: inherit; font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
/* Cast: a small heading; one unit = its logo and ›, then its people; several units = people in two columns,
   each with the unit they belong to (from the idol dictionary, not the order of the faces). */
.event-cast { margin-top: var(--gs-space-6); }
.event-cast-title { margin: 0 0 var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.event-cast-unit { display: inline-flex; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-touch); padding: 0; border: 0; background: none; color: var(--gs-ink-3); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); }
.event-cast-unit img { display: block; height: 30px; max-width: 160px; object-fit: contain; object-position: left center; }
.event-cast-people { display: flex; flex-wrap: wrap; gap: 0 var(--gs-space-4); }
.event-cast-people.is-multi { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 0 var(--gs-space-3); }
/* One person per cell through the shared reference (it skips half-body story art for avatars and falls back on a
   failed image): name only with one unit, name over unit with several. */
.event-person { padding: 0; }
.event-cast-people:not(.is-multi) .event-person :deep(.idol-reference-copy small) { display: none; }
.is-multi .event-person { min-height: 52px; }
.is-multi .event-person :deep(.idol-reference-copy) { flex-direction: column; align-items: flex-start; gap: 0; min-width: 0; }
.is-multi .event-person :deep(.idol-reference-copy small::before) { content: none; }
.event-person :deep(.idol-reference-arrow) { display: none; }
.event-cast-units { display: flex; flex-wrap: wrap; column-gap: var(--gs-space-4); margin-top: var(--gs-space-1); }
.event-cast-unit-name { display: inline-flex; align-items: center; gap: 2px; min-height: var(--gs-control-compact); padding: 0; border: 0; background: none; color: var(--gs-ink-2); cursor: pointer; font: inherit; font-size: var(--gs-text-meta); }
.episode-more { display: none; }
.event-banner { display: block; width: 100%; height: 100%; object-fit: contain; }
.event-media-note { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.event-banner-unavailable { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--gs-space-4); height: 100%; margin: 0; padding: var(--gs-space-6); color: var(--gs-ink-3); text-align: center; overflow-wrap: anywhere; }
.event-banner-unavailable small { font-size: var(--gs-text-meta); }
.event-summary { min-width: 0; }
.event-kicker { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.event-summary h2 { margin: var(--gs-space-2) 0 var(--gs-space-5); font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); line-height: 1.35; overflow-wrap: anywhere; }


/* Sections: heading and count on one baseline over a rule, a grey lede beneath the heading. */
.detail-section { min-width: 0; padding: var(--gs-space-5) max(var(--gs-space-7), calc((100% - var(--gs-content-width)) / 2)) var(--gs-space-8); }
.section-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--gs-space-3) var(--gs-space-5); margin-bottom: var(--gs-space-4); padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
.section-heading > div { min-width: 0; }
.section-heading h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); overflow-wrap: anywhere; }
.section-heading p { margin: var(--gs-space-2) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-ui); line-height: 1.65; }
.section-count { flex: 0 0 auto; color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }

/* Story: synopsis quotation, one row of actions, hairline episode rows. */
.event-synopsis { max-width: 46em; margin: var(--gs-space-5) 0 0; padding-left: var(--gs-space-5); border-left: 2px solid var(--gs-mint); }
.event-synopsis strong { display: block; margin-bottom: var(--gs-space-2); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.event-synopsis .is-pending { visibility: hidden; }
.event-synopsis-notice { display: block; margin-top: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.event-synopsis p { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.85; white-space: pre-line; overflow-wrap: anywhere; }
.story-actions { display: flex; flex-wrap: wrap; gap: var(--gs-space-3); margin: var(--gs-space-6) 0; }
.story-action { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: var(--gs-control-normal); max-width: 100%; padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-decoration: none; overflow-wrap: anywhere; }
.story-action.primary { border-color: var(--gs-action-bg); background: var(--gs-action-bg); color: var(--gs-action-ink); }
.story-action:disabled { cursor: not-allowed; opacity: .45; }
.story-action svg { flex: 0 0 auto; }
.episode-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--gs-space-8); margin: 0; padding: 0; list-style: none; }
.episode-entry { display: flex; align-items: center; min-width: 0; border-bottom: 1px solid var(--gs-line); }
.episode-main { display: flex; flex: 1; align-items: center; min-width: 0; min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; }
button.episode-main { cursor: pointer; }
.episode-copy { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.episode-copy strong { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.episode-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-regular); }
.episode-copy small:empty { display: none; }
.episode-play { display: grid; flex: 0 0 auto; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); cursor: pointer; }
.episode-play:disabled { cursor: not-allowed; opacity: .35; }

/* Rewards. */
.reward-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 var(--gs-space-6); }
.event-reward-card { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: var(--gs-space-4); min-width: 0; min-height: 96px; padding: var(--gs-space-4) 0; border-bottom: 1px solid var(--gs-line); }
.event-reward-open { display: block; min-width: 0; min-height: 84px; padding: 0; border: 0; background: transparent; color: var(--gs-ink); cursor: pointer; font: inherit; font-weight: var(--gs-weight-semibold); text-align: left; }
.event-reward-card :deep(.domain-media-compact) { width: 72px; height: 72px; min-width: 0; margin: 0; }
.reward-copy { min-width: 0; }
.reward-identity { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gs-space-3); min-width: 0; }
/* Rarity is one of the stage face's few jobs. */
.reward-rarity { flex: 0 0 auto; color: var(--gs-ink-2); font-family: var(--gs-font-stage); font-size: var(--gs-text-ui); font-style: italic; font-weight: var(--gs-weight-semibold); }
.reward-name { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); overflow-wrap: anywhere; }
.reward-copy strong { display: block; margin: var(--gs-space-2) 0 var(--gs-space-3); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.45; overflow-wrap: anywhere; }
.reward-copy ul { display: grid; gap: var(--gs-space-2); margin: 0; padding: 0; list-style: none; }
.reward-copy li { display: flex; align-items: flex-start; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); line-height: 1.4; }
.reward-copy li svg { flex: 0 0 auto; margin-top: 1px; color: var(--gs-mint-ink); }
.empty-copy { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-body); }
.exchange-source { margin: 0 0 var(--gs-space-5); color: var(--gs-ink-3); font-size: var(--gs-text-ui); line-height: 1.65; }
.exchange-source a { color: var(--gs-mint-ink); }
.wiki-exchange-table { margin-top: var(--gs-space-6); color: var(--gs-ink-2); font-size: var(--gs-text-body); }
.wiki-exchange-table summary { min-height: var(--gs-control-normal); padding: var(--gs-space-3) 0; color: var(--gs-mint-ink); cursor: pointer; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.exchange-table-scroll { overflow: auto; }
.wiki-exchange-table table { width: 100%; border-collapse: collapse; text-align: left; }
.wiki-exchange-table th, .wiki-exchange-table td { min-width: 90px; padding: var(--gs-space-3) var(--gs-space-4); border-bottom: 1px solid var(--gs-line); line-height: 1.5; }
.wiki-exchange-table th { border-bottom-color: var(--gs-rule); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.wiki-exchange-table td:first-child { min-width: 200px; }

/* Materials are entries on the paper: icon and name, no box. */
.event-materials { display: flex; flex-wrap: wrap; gap: var(--gs-space-3) var(--gs-space-6); margin: 0 0 var(--gs-space-5); }
.event-material { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; max-width: 100%; }
.event-material :deep(.domain-media-compact) { margin: 0; }
.event-material > button { min-width: 0; min-height: var(--gs-control-normal); padding: 0; border: 0; background: transparent; color: var(--gs-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-align: left; overflow-wrap: anywhere; }

.event-summary :deep(.archive-source-link), .wiki-exchange-table :deep(.archive-source-link) { gap: var(--gs-space-3); min-height: var(--gs-control-normal); max-width: 100%; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.event-summary :deep(.archive-source-link small), .wiki-exchange-table :deep(.archive-source-link small) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.event-reward-card :deep(.domain-media-preview button), .event-material :deep(.domain-media-preview button) { min-height: var(--gs-control-compact); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); border-radius: var(--gs-radius-control); }
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
.general-reward-section :deep(.domain-reward-condition) { padding: 0; border-radius: 0; background: transparent; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.general-reward-section :deep(.domain-reward-condition + .domain-reward-condition)::before { content: '·'; margin-right: var(--gs-space-2); color: var(--gs-ink-3); }
.detail-section :deep(.domain-reward-quantity) { font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.detail-section :deep(.domain-reward-product) { gap: var(--gs-space-4); }
.detail-section :deep(.domain-reward-name) { gap: var(--gs-space-3); padding: var(--gs-space-2) 0; font-family: inherit; font-size: var(--gs-text-body); border-radius: var(--gs-radius-control); }
.detail-section :deep(.domain-reward-name strong) { font-weight: var(--gs-weight-semibold); }
.detail-section :deep(.domain-reward-name small), .detail-section :deep(.domain-reward-unresolved), .detail-section :deep(.domain-reward-campaigns) { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.detail-section :deep(.domain-table-controls) { flex-wrap: wrap; gap: var(--gs-space-3) var(--gs-space-5); margin-bottom: var(--gs-space-5); font-size: var(--gs-text-meta); }
.detail-section :deep(.domain-table-controls label) { flex: 1 1 220px; gap: var(--gs-space-3); min-width: 0; font-size: var(--gs-text-ui); }
.detail-section :deep(.domain-table-controls select) { flex: 1; box-sizing: border-box; min-width: 0; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-regular); border-radius: var(--gs-radius-field); }
.detail-section :deep(.domain-pagination) { flex-wrap: wrap; gap: var(--gs-space-4); margin-top: var(--gs-space-6); font-size: var(--gs-text-meta); }
.detail-section :deep(.domain-pagination button) { min-height: var(--gs-control-normal); padding: var(--gs-space-3) var(--gs-space-4); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); border-radius: var(--gs-radius-control); }
.detail-section :deep(.archive-technical), .event-detail > :deep(.archive-technical) { margin-top: var(--gs-space-5); border-radius: var(--gs-radius-control); }
.detail-section :deep(.archive-technical summary), .event-detail > :deep(.archive-technical summary) { min-height: var(--gs-control-normal); padding: var(--gs-space-4) var(--gs-space-5); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.detail-section :deep(.archive-technical-body), .event-detail > :deep(.archive-technical-body) { padding: 0 var(--gs-space-5) var(--gs-space-5); font-size: var(--gs-text-meta); }
.detail-section :deep(.archive-technical pre), .event-detail > :deep(.archive-technical pre) { font-size: var(--gs-text-meta); }

.wiki-exchange-table > summary:focus-visible, .event-time-original:focus-visible, .event-cast-unit-name:focus-visible, .event-banner-open:focus-visible, .event-media-strip button:focus-visible, .event-cast-unit:focus-visible, .episode-more:focus-visible,
.story-actions > :focus-visible, .episode-entry button:focus-visible, .event-reward-open:focus-visible,
.event-material > button:focus-visible,
.event-summary :deep(a:focus-visible), .wiki-exchange-table :deep(a:focus-visible),
.event-media-strip :deep(.domain-media-preview button:focus-visible), .event-reward-card :deep(.domain-media-preview button:focus-visible), .event-material :deep(.domain-media-preview button:focus-visible),
.detail-section :deep(.relation-row:focus-visible),
.detail-section :deep(.domain-rewards button:focus-visible), .detail-section :deep(.domain-rewards select:focus-visible),
.detail-section :deep(.archive-technical summary:focus-visible), .event-detail > :deep(.archive-technical summary:focus-visible) {
  outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset);
}
@media (hover: hover) and (pointer: fine) {
  button.episode-main:hover strong, .episode-play:hover:not(:disabled),
  .event-reward-open:hover, .event-material > button:hover, .event-cast-unit:hover,
  .story-action:hover:not(:disabled):not(.primary) { color: var(--gs-ink-2); }
  .event-time-original:hover, .event-cast-unit-name:hover, .event-cast-unit:hover { color: var(--gs-ink); }
}
@media (hover: none), (pointer: coarse) {
  .detail-section :deep(.relation-row:hover) { border-color: var(--gs-line); background: var(--gs-surface); }
  .detail-section :deep(button.domain-reward-name:hover) { background: transparent; color: inherit; }
}
@media (max-width: 760px), (pointer: coarse) {
  .story-action, .wiki-exchange-table > summary, .event-material > button, .event-cast-unit, .episode-more,
  .event-summary :deep(.archive-source-link), .wiki-exchange-table :deep(.archive-source-link),
  .event-reward-card :deep(.domain-media-preview button), .event-material :deep(.domain-media-preview button),
  .detail-section :deep(.domain-pagination button), .detail-section :deep(.archive-technical summary), .event-detail > :deep(.archive-technical summary) { min-height: var(--gs-control-touch); }
  .detail-section :deep(.domain-table-controls select) { min-height: var(--gs-control-touch); max-width: 100%; font-size: var(--gs-text-subtitle); }
}
/* Columns follow the content width the Shell leaves, not the viewport. */
@container event-detail (max-width: 900px) {
  .reward-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container event-detail (max-width: 800px) {
  .event-identity { grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-6); }
  .episode-list { grid-template-columns: minmax(0, 1fr); }
}
/* Phones: the KV runs to the screen edges with the identity under it; 从第一话阅读 is a full-width
   primary action; the episodes list five, then 显示全部. */
@container event-detail (max-width: 560px) {
  .event-identity { padding: 0 var(--gs-space-5) var(--gs-space-5); }
  .event-visual-column { margin-inline: calc(-1 * var(--gs-space-5)); }
  .event-visual { border-radius: 0; }
  .event-media-strip.is-wide { display: none; }
  .event-media-note { padding-inline: var(--gs-space-5); }
  .event-gallery-section { display: block; }
  .event-summary h2 { font-size: var(--gs-text-section); }
  .detail-section { padding-inline: var(--gs-space-5); }
  .story-actions > * { flex: 1 1 140px; }
  .story-actions > .primary { flex-basis: 100%; }
  .reward-grid { grid-template-columns: minmax(0, 1fr); }
  .episode-list.is-collapsed > :nth-child(n+6) { display: none; }
  .episode-more { display: block; width: 100%; min-height: var(--gs-control-touch); margin-top: var(--gs-space-2); padding: 0; border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: var(--gs-ink-2); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); text-align: left; }
}
/* Wide screens: the section name sits in a 168px rail on the left, the content to its right; phones keep it above. */
@media (min-width: 1101px) {
  .detail-section { display: grid; grid-template-columns: var(--gs-rail-width) minmax(0, 1fr); column-gap: var(--gs-gap-group); align-items: start; }
  .detail-section > .section-heading { grid-column: 1; grid-row: 1 / span 24; flex-direction: column; flex-wrap: nowrap; align-items: stretch; gap: var(--gs-space-2); margin-bottom: 0; }
  .detail-section > .section-heading > div { flex: none; }
  .detail-section > :not(.section-heading) { grid-column: 2; min-width: 0; }
}
</style>
