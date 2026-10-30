<template>
  <section class="story-catalog story-page" data-archive-scroll-container>
    <ArchiveCatalogScope :idol="scopeIdol" :name="scopeIdol ? idolName(scopeIdol.id) : ''" @clear="emit('clear-idol')" />
    <div class="catalog-switcher" role="group" aria-label="故事浏览方式">
      <button v-if="!scopeIdol" :class="{ active: mode === 'portal' }" :aria-pressed="mode === 'portal'" @click="emit('update:mode', 'portal')">
        <LayoutGrid :size="16" />
        <span>分类入口</span>
      </button>
      <button :class="{ active: mode === 'search' }" :aria-pressed="mode === 'search'" @click="emit('update:mode', 'search')">
        <Search :size="16" />
        <span>全部检索</span>
      </button>
    </div>
    <div v-if="mode === 'portal' && domain === 'main'" class="main-domain-landing">
      <header class="story-head">
        <h2 class="shell-named">主线剧情</h2>
        <ul class="story-footprint" aria-label="主线剧情收录">
          <li><b>{{ count(mainDomain?.meta?.collectionCount) }}</b>章</li>
          <li><b>{{ count(mainDomain?.meta?.chapterCount) }}</b>话</li>
          <li><b>{{ count(mainDomain?.meta?.logicalEntryCount) }}</b>段剧情</li>
        </ul>
      </header>

      <section class="story-section" aria-label="章节">
        <div class="story-tiles">
          <button
            v-for="(collection, index) in mainDomain?.collections || []"
            :key="collection.id"
            class="story-tile"
            :class="{ placeholder: collection.isPlaceholder }"
            :disabled="collection.isPlaceholder"
            @click="browse('main', collection.masterId)"
          >
            <span class="story-tile-media">
              <img
                v-if="!collection.isPlaceholder && index < 2"
                :src="mainVisual(index)"
                :alt="collection.title"
                class="main-art" :style="mainArtStyle(index)"
                loading="eager" :fetchpriority="index === 0 ? 'high' : 'auto'"
                width="1456" height="553"
              />
              <span v-else aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            </span>
            <span class="story-tile-copy">
              <strong>{{ presentProducerAddressingText(collection.title) }}</strong>
              <small v-if="collection.chapterCount">{{ collection.chapterCount }} 话 · {{ collection.logicalEntryCount }} 段剧情</small>
              <small v-else>未公开 · 尚无已发布话目</small>
            </span>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="mode === 'portal' && domain === 'extra'" class="extra-domain-landing">
      <header class="story-head">
        <h2 class="shell-named">额外剧情</h2>
        <ul class="story-footprint" aria-label="额外剧情收录">
          <li><b>{{ count(extraDomain?.meta?.officialCollectionCount) }}</b>部作品</li>
          <li><b>{{ count(extraDomain?.meta?.logicalEntryCount) }}</b>章</li>
        </ul>
      </header>

      <section class="story-section" aria-labelledby="extra-domain-heading">
        <div class="story-section-head">
          <h3 id="extra-domain-heading">官方 Extra Story</h3>
          <small>{{ officialExtraCards.length }} 部作品</small>
        </div>
        <div class="story-rows">
          <button
            v-for="(card, index) in officialExtraCards"
            :key="card.id"
            class="story-row extra-row"
            @click="browse('extra', card.masterId)"
          >
            <span class="story-row-thumb">
              <img v-if="card.bannerUrl" :src="card.bannerUrl" alt=""
                :loading="index < 3 ? 'eager' : 'lazy'"
                :decoding="index < 3 ? 'auto' : 'async'"
                :fetchpriority="index === 0 ? 'high' : 'auto'" />
              <BookOpen v-else :size="20" aria-hidden="true" />
            </span>
            <span class="story-row-copy">
              <strong>{{ card.title }}</strong>
              <small>{{ extraMeta(card) }}</small>
            </span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section v-if="supplementaryExtraCards.length" class="story-section" aria-labelledby="extra-supplementary-heading">
        <div class="story-section-head">
          <h3 id="extra-supplementary-heading">其他特别剧情记录</h3>
          <small>{{ supplementaryExtraCards.length }} 部作品</small>
        </div>
        <p class="story-note">以下特别剧情尚未在所核对的作品清单中确认分类，作为补充资料保留。</p>
        <div class="story-rows">
          <button
            v-for="card in supplementaryExtraCards"
            :key="card.id"
            class="story-row extra-row"
            @click="browse('extra', card.masterId)"
          >
            <span class="story-row-thumb">
              <img v-if="card.bannerUrl" :src="card.bannerUrl" alt="" loading="lazy" decoding="async" />
              <BookOpen v-else :size="20" aria-hidden="true" />
            </span>
            <span class="story-row-copy">
              <strong>{{ card.title }}</strong>
              <small>{{ extraMeta(card) }}</small>
            </span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="mode === 'portal' && domain === 'birthday'" class="birthday-domain-landing">
      <header class="story-head">
        <h2 class="shell-named">生日剧情</h2>
        <ul class="story-footprint" aria-label="生日剧情收录">
          <li><b>{{ count(birthdayDomain?.meta?.collectionCount) }}</b>位角色</li>
          <li><b>{{ count(birthdayDomain?.meta?.logicalEntryCount) }}</b>篇</li>
          <li>其中<b class="inline-count">{{ count(birthdayDomain?.meta?.crossDomainSharedFileCount) }}</b>篇也收在个人剧情</li>
        </ul>
      </header>

      <section class="story-section" aria-label="角色生日剧情">
        <div class="story-rows">
          <button
            v-for="card in birthdayCards"
            :key="card.id"
            class="story-row birthday-row"
            @click="browse('birthday', card.subject.code)"
          >
            <ArchiveIdolAvatar v-if="card.subject.kind === 'idol'" :idol-code="card.subject.code" :size="40" decorative />
            <span v-else class="birthday-mark" aria-hidden="true"><Cake :size="18" /></span>
            <span class="story-row-copy">
              <strong>{{ birthdayName(card) }}</strong>
              <small><template v-if="card.subject.kind !== 'idol'">{{ card.subject.kind === 'shared' ? '公共篇' : '事务所' }} · </template>{{ card.logicalEntryCount }} 篇<template v-if="card.sharedCount"> · 含 {{ card.sharedCount }} 篇个人故事</template></small>
            </span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="mode === 'portal' && domain === 'unit_story'" class="unit-domain-landing">
      <header class="story-head">
        <h2 class="shell-named">组合前传</h2>
        <ul class="story-footprint" aria-label="组合前传收录">
          <li><b>{{ count(unitGateways.length) }}</b>组</li>
          <li><b>{{ count(domainCount('unit_story')) }}</b>篇</li>
          <li>又称「{{ STORY_KINDS.unit_story.alias }}」</li>
        </ul>
      </header>
      <section class="story-section" aria-label="组合">
        <div class="unit-grid unit-grid-full">
          <button v-for="unit in unitGateways" :key="unit.id" @click="browse('unit_story', unit.id)">
            <img :src="unitVisual(unit.id)" alt="" loading="lazy" decoding="async" width="446" height="150" />
            <span><strong>{{ unit.label }}</strong><small>{{ unit.entries.length }} 篇</small></span>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="mode === 'portal' && domain === 'event'" class="event-domain-landing">
      <header class="story-head">
        <h2 class="shell-named">活动剧情</h2>
        <ul class="story-footprint" aria-label="活动剧情收录">
          <li><b>{{ count(props.allEntries.length ? eventEntries.length : null) }}</b>部活动</li>
          <li><b>{{ count(eventEpisodeCount) }}</b>话</li>
        </ul>
      </header>
      <section class="story-section" aria-label="活动剧情">
        <div class="story-chips" role="group" aria-label="活动类型">
          <button type="button" :aria-pressed="eventScope === 'all'" @click="emit('update:event-scope', 'all')">全部 <small>{{ eventEntries.length }}</small></button>
          <button v-for="option in eventScopeOptions" :key="option.id" type="button" :aria-pressed="eventScope === option.id"
            @click="emit('update:event-scope', option.id)">{{ option.label }} <small>{{ option.count }}</small></button>
        </div>
        <section v-for="year in eventYears" :key="year.id" class="event-year" :aria-labelledby="`event-year-${year.id}`">
          <div class="story-section-head">
            <h3 :id="`event-year-${year.id}`">{{ year.label }}</h3>
            <small>{{ year.entries.length }} 部</small>
          </div>
          <div class="story-rows">
            <EventStoryRow v-for="entry in year.entries" :key="entry.id" :entry="entry" :idol-name="idolName" @open="emit('select', $event)" />
          </div>
        </section>
      </section>
    </div>

    <div v-else-if="mode === 'portal'" class="story-portal">
      <section class="story-section main-story-section" aria-labelledby="main-story-title">
        <div class="story-section-head">
          <h2 id="main-story-title">主线剧情 <small>{{ domainCount('main') }} 篇</small></h2>
          <button class="story-more" @click="openDomain('main')">查看全部 <ArrowRight :size="15" /></button>
        </div>
        <!-- A chapter band: two 250-wide covers, then where to start reading. -->
        <div class="main-band">
          <button
            v-for="(chapter, index) in mainSections"
            :key="chapter.id"
            class="story-tile main-cover"
            @click="browse('main', chapter.id)"
          >
            <span class="story-tile-media">
              <img v-if="index < 2" :src="mainVisual(index)" :alt="chapter.label" class="main-art" :style="mainBandArtStyle(index)"
                loading="eager" :fetchpriority="index === 0 ? 'high' : 'auto'" width="1456" height="553" />
              <span v-else aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            </span>
            <span class="story-tile-copy">
              <strong>{{ chapterLabel(chapter.label) }}</strong>
              <small>{{ chapter.entries.length }} 篇</small>
            </span>
          </button>
          <div v-if="mainStart" class="main-start">
            <small>从头读起</small>
            <strong>{{ chapterLabel(mainSections[0].label) }} · {{ presentProducerAddressingText(mainStart.title) }}</strong>
            <button type="button" class="main-start-action" @click="emit('select', mainStart)">开始阅读 <ChevronRight :size="15" aria-hidden="true" /></button>
          </div>
        </div>
      </section>

      <section class="story-section event-section" aria-labelledby="event-story-title">
        <!-- The year tabs' rule is this section's line; the heading above carries none (线框减法册 rule 2). -->
        <div class="story-section-head has-tabs">
          <h2 id="event-story-title">活动剧情 <small>{{ eventCount }} 部</small></h2>
          <button class="story-more" @click="openDomain('event')">查看全部 {{ eventCount }} 部 <ArrowRight :size="15" /></button>
        </div>
        <div class="story-chips event-year-chips" role="group" aria-label="年份">
          <button type="button" :aria-pressed="!eventYear" @click="eventYear = ''">全部</button>
          <button v-for="year in recentEventYears" :key="year" type="button" :aria-pressed="eventYear === year" @click="eventYear = year">{{ year }}</button>
        </div>
        <!-- The newest four, the same size: they read as "latest", not as one recommended event. -->
        <div v-if="featuredEvents.length" class="event-four">
          <button v-for="entry in featuredEvents" :key="entry.id" type="button" class="event-four-item"
            :data-archive-focus-id="`event:${entry.id}`" @click="emit('select', entry)">
            <EventResourceImage :binding="eventPlate(entry)" :name="storyEventTitle(entry)" />
            <strong>{{ storyEventTitle(entry) }}</strong>
            <small>{{ eventDate(entry) }}</small>
          </button>
        </div>
        <button type="button" class="story-row no-thumb event-browse-row" @click="openDomain('event')">
          <span class="story-row-copy"><strong>按年份浏览全部 {{ eventCount }} 部</strong></span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </section>

      <section class="story-section unit-section" aria-labelledby="unit-story-title">
        <div class="story-section-head">
          <h2 id="unit-story-title">组合前传 <small>{{ unitGateways.length }} 组</small></h2>
          <button class="story-more" @click="openDomain('unit_story')">查看全部 <ArrowRight :size="15" /></button>
        </div>
        <!-- Logos only, in hairline cells; the member banners wait on each unit's own page. -->
        <div class="unit-logos" aria-label="组合前传">
          <button v-for="unit in unitGateways" :key="unit.id" type="button" :aria-label="`${unit.label} · ${unit.entries.length} 篇`" @click="browse('unit_story', unit.id)">
            <img :src="unitLogo(unit.id)" alt="" loading="lazy" decoding="async" />
          </button>
        </div>
      </section>

      <section class="story-section" aria-labelledby="quick-archives-title">
        <div class="story-section-head"><h2 id="quick-archives-title">更多故事</h2></div>
        <div class="story-rows gateway-rows">
          <button v-for="gateway in secondaryGateways" :key="gateway.id" class="story-row no-thumb gateway-row" @click="openGateway(gateway)">
            <span class="story-row-copy"><strong>{{ gateway.label }}</strong><small>{{ gatewayCount(gateway) }} {{ gateway.unit || '篇' }}<template v-if="storyGatewayNote(gateway, props)"> · {{ storyGatewayNote(gateway, props) }}</template></small></span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </div>
      </section>

    </div>

    <div v-else-if="mode!=='portal'" class="search-view">
      <StoryDiscovery :external-filters-active="Boolean(domain || section || availability !== 'all' || sort !== 'domain')" @reset-filters="emit('update:availability','all');emit('update:sort','domain')" :entries="searchEntries" :query="searchQuery" @update:query="emit('update:search-query',$event)" :idol-directory="idolDirectory" :idol-name="idolName" :idol-search="idolSearch" @series-change="emit('update:domain','');emit('clear-section')" @select="emit('select',$event)">
      <template #filters>
      <div class="catalog-toolbar">
        <GsFilterMenu label="故事分类" neutral="" :model-value="domain" :options="[{ value: '', label: '全部', count: catalogTotal }, ...domainOptions.map(option => ({ value: option.id, label: option.label, count: option.count }))]" @update:model-value="emit('update:domain', $event)" />
        <GsFilterMenu v-if="domain === 'event'" label="活动类型" neutral="all" :model-value="eventScope" :options="[{ value: 'all', label: '全部活动' }, ...eventScopeOptions.map(option => ({ value: option.id, label: option.label, count: option.count }))]" @update:model-value="emit('update:event-scope', $event)" />
        <GsFilterMenu label="可用性" neutral="all" :model-value="availability" :options="[{ value: 'all', label: '全部' }, { value: 'playable', label: '可播放' }, { value: 'missing', label: '缺少文件' }]" @update:model-value="emit('update:availability', $event)" />
        <GsFilterMenu label="排序" neutral="domain" :model-value="sort" :options="[{ value: 'latest', label: '最新优先' }, { value: 'domain', label: '故事分类' }, { value: 'title', label: '标题' }, { value: 'resource', label: '资源 ID' }, { value: 'steps_desc', label: '步骤数' }]" @update:model-value="emit('update:sort', $event)" />
        <button v-if="section" class="section-filter" @click="emit('clear-section')">
          {{ chapterLabel(sectionLabel) }} <X :size="14" />
        </button>
        <span class="catalog-count">{{ filteredTotal }} 条结果</span>
      </div>
      </template>
      </StoryDiscovery>


    </div>
    <ArchiveTechnicalDetails :key="`${mode}:${domain}:${section}`" :evidence="mode === 'portal' ? { mainDomain, extraDomain, birthdayDomain } : { entries, filteredTotal }" />
  </section>
</template>

<script setup>
import { chapterLabel } from '../../presentation/chapterLabel.js'
import {storyGateways,storyGatewayCount,storyGatewayNote} from '../../presentation/StoryGateways.js'
import { EXTERNAL_STORY_RESOURCES_ENABLED } from '../../../shared/deploy/ExternalStoryResourcePolicy.js'
import { computed, ref } from 'vue'
import GsFilterMenu from '../gs/GsFilterMenu.vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import { ArrowRight, BookOpen, Cake, ChevronRight, LayoutGrid, Search, X } from '@lucide/vue'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import EventStoryRow from './EventStoryRow.vue'
import EventResourceImage from './EventResourceImage.vue'
import { storyEventResources, storyEventTitle } from '../../data/eventResourceGraph.js'
import { getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { STORY_KINDS } from '../../core/archiveSections.js'
import StoryDiscovery from './StoryDiscovery.vue'
import '../../styles/archive-story.css'

import ArchiveCatalogScope from './ArchiveCatalogScope.vue'
const props = defineProps({
  scopeIdol: { type: Object, default: null },
  idolName:{type:Function,default:()=>''},
  idolSearch:{type:Function,default:()=>''},
  entries: { type: Array, default: () => [] }, allEntries: { type: Array, default: () => [] },
  searchEntries: { type: Array, default: () => [] },
  idolDirectory: { type: Array, default: () => [] },
  searchQuery: {type:String,default:''},
  domainOptions: { type: Array, default: () => [] }, domain: { type: String, default: '' },
  section: { type: String, default: '' }, mode: { type: String, default: 'portal' },
  eventScopeOptions: { type: Array, default: () => [] }, eventScope: { type: String, default: 'all' },
  availability: { type: String, default: 'all' }, sort: { type: String, default: 'domain' },
  catalogTotal: { type: Number, default: 0 }, filteredTotal: { type: Number, default: 0 },
  seasonalCount: { type: Number, default: 0 },
  workCount: { type: Number, default: 0 },
  birthdayCount: { type: Number, default: 0 },
  birthdaySharedCount: { type: Number, default: 0 },
  idolStoryCount: { type: Number, default: 0 },
  externalResourceCount: { type: Number, default: 0 },
  mainDomain: { type: Object, default: null },
  extraDomain: { type: Object, default: null },
  birthdayDomain: { type: Object, default: null },
})
const emit = defineEmits([
  'clear-idol','select', 'read-event', 'open-event', 'browse', 'open-seasonal', 'open-work', 'open-idol-story', 'open-external-resources', 'load-more', 'clear-section', 'update:mode', 'update:domain', 'update:event-scope', 'update:availability', 'update:sort','update:search-query'])

const groupEntries = domain => {
  const groups = new Map()
  for (const entry of props.allEntries.filter(item => item.domain === domain)) {
    const id = entry.sectionId || 'unclassified'
    const group = groups.get(id) || { id, label: entry.sectionLabel || entry.unitName || '未分类', entries: [] }
    group.entries.push(entry)
    groups.set(id, group)
  }
  return [...groups.values()].sort((a, b) => Number(a.id) - Number(b.id) || a.label.localeCompare(b.label, 'ja'))
}
const mainSections = computed(() => groupEntries('main'))
const unitGateways = computed(() => groupEntries('unit_story'))
// The chapter band starts at chapter 1's first published entry (there is no reading history to resume from).
const mainStart = computed(() => mainSections.value[0]?.entries.find(entry => entry.exists !== false) || null)
// The newest four events, equal width, narrowed by one of the three latest years.
const eventEntries = computed(() => props.allEntries.filter(entry => entry.domain === 'event'))
const eventCount = computed(() => eventEntries.value.length)
const eventYear = ref('')
const yearOf = entry => entry.releaseAt ? new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date(entry.releaseAt * 1000)) : ''
const recentEventYears = computed(() => [...new Set(eventEntries.value.map(yearOf).filter(Boolean))].sort().reverse().slice(0, 3))
const featuredEvents = computed(() => [...eventEntries.value]
  .filter(entry => !eventYear.value || yearOf(entry) === eventYear.value)
  .sort((a, b) => b.releaseAt - a.releaseAt).slice(0, 4))
const eventEpisodeCount = computed(() => props.allEntries.length
  ? eventEntries.value.reduce((sum, entry) => sum + (storyEventResources(entry)?.episodeCount || 0), 0) : null)
// The event landing: newest year first, each year's events newest first, under the chosen event type.
const eventYears = computed(() => {
  const years = new Map()
  const entries = eventEntries.value.filter(entry => props.eventScope === 'all' || entry.eventScope === props.eventScope)
  for (const entry of [...entries].sort((a, b) => b.releaseAt - a.releaseAt)) {
    const year = yearOf(entry)
    const group = years.get(year) || { id: year || 'undated', label: year ? `${year} 年` : '开放日期未记录', entries: [] }
    group.entries.push(entry)
    years.set(year, group)
  }
  return [...years.values()]
})
const extraCards = computed(() => [...(props.extraDomain?.collections || [])]
  .sort((left, right) => left.releaseAt - right.releaseAt || left.masterId.localeCompare(right.masterId)))
const officialExtraCards = computed(() => extraCards.value.filter(card => card.official))
const supplementaryExtraCards = computed(() => extraCards.value.filter(card => !card.official))
const birthdayCards = computed(() => {
  const entries = new Map((props.birthdayDomain?.logicalEntries || []).map(entry => [entry.id, entry]))
  return (props.birthdayDomain?.collections || []).map(collection => ({
    ...collection,
    sharedCount: collection.logicalEntryIds
      .map(id => entries.get(id))
      .filter(entry => entry?.domainMemberships?.length > 1)
      .length,
  }))
})
const secondaryGateways = storyGateways.filter(gateway => EXTERNAL_STORY_RESOURCES_ENABLED || gateway.action !== 'external-resources')
const sectionLabel = computed(() => props.allEntries.find(entry => entry.domain === props.domain && entry.sectionId === props.section)?.sectionLabel || props.section)

function browse(domain, section = '') { emit('browse', { domain, section }) }
function openDomain(domain) { emit('browse', { domain, section: '', mode: 'portal' }) }
function domainCount(domain) { return props.allEntries.filter(entry => entry.domain === domain).length }
function gatewayCount(gateway) {return storyGatewayCount(gateway,props.allEntries,props)}
function openGateway(gateway) {
  if (gateway.action === 'external-resources') emit('open-external-resources')
  else if (gateway.action === 'seasonal') emit('open-seasonal')
  else if (gateway.action === 'work') emit('open-work')
  else if (gateway.action === 'idol-story') emit('open-idol-story')
  else browse(gateway.id)
}
// A landing that has not loaded shows "—", never a real-looking zero.
function count(value) { return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '—' }
function birthdayName(card) { return (card.subject.kind === 'idol' && props.idolName(card.subject.code)) || card.subject.displayName }
function extraMeta(card) { return `${formatExtraDate(card.releaseAt)} · ${card.logicalEntryCount} 章` }
function mainVisual(index) { return `/assets/stories/main/image_story_main_button_${String(index + 1).padStart(2, '0')}.png` }
// The 1456×553 main buttons have transparent flanks; [left, width] of each opaque art area.
// The tile is 1138:553, so object-fit: cover shows a 1138px-wide window; it is centred on the art
// area and scaled up when the art is narrower. Plain cover/position keeps iOS Safari painting it
// (the earlier absolutely positioned, over-wide image stayed blank there).
const MAIN_ART = [[178, 1138], [226, 1005]]
function mainArtStyle(index) {
  const [left, width] = MAIN_ART[index] || [0, 1456]
  const windowLeft = Math.min(1456 - 1138, Math.max(0, left + width / 2 - 1138 / 2))
  return { objectPosition: `${(windowLeft / (1456 - 1138) * 100).toFixed(2)}% 50%`, scale: String(Math.max(1, 1138 / width).toFixed(4)) }
}
// The band's 250:95 tile shows the whole 1456-wide button, flanks included; scale the art area up to fill it
// and shift so the art area, not the button, is centred.
function mainBandArtStyle(index) {
  const [left, width] = MAIN_ART[index] || [0, 1456]
  const scale = 1456 / width
  const shift = (728 - (left + width / 2)) / 1456 * scale * 100
  return { scale: scale.toFixed(4), translate: `${shift.toFixed(2)}% 0` }
}
function eventPlate(entry) { const resource = storyEventResources(entry); return resource?.storyCover || resource?.hero || null }
function eventDate(entry) {
  return entry.releaseAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date(entry.releaseAt * 1000)) : '开放日期未记录'
}
const UNIT_CODES = ['01jup', '02dra', '03alt', '04bei', '05w00', '06fra', '07sai', '08hig', '09shi', '10caf', '11mof', '12sem', '13the', '14fla', '15leg', '16cfi']
function unitLogo(id) { return getUnitLogoUrl(UNIT_CODES[Number(id) - 1] || UNIT_CODES[0]) }
function unitVisual(id) {
  return `/assets/stories/units/image_unit_story_button_${UNIT_CODES[Number(id) - 1] || UNIT_CODES[0]}.png`
}
function formatExtraDate(timestamp) {
  if (!Number(timestamp)) return '开放日期未记录'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo',
  }).format(new Date(Number(timestamp) * 1000))
}
</script>

<style scoped>
.catalog-switcher { position: sticky; top: 0; z-index: 30; display: flex; justify-content: center; gap: 2px; padding: 0 var(--gs-space-5); border-bottom: 1px solid var(--gs-line); background: var(--gs-paper); }
.catalog-switcher button { display: inline-flex; align-items: center; justify-content: center; gap: var(--gs-space-3); min-width: 120px; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--gs-ink-3); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); }
.catalog-switcher button.active { border-color: var(--gs-selected-line); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }

.story-footprint .inline-count { margin-inline: var(--gs-space-2); }
.story-tile.placeholder .story-tile-copy strong { color: var(--gs-ink-3); }
.extra-row { --thumb: 112px; }
.extra-row .story-row-thumb { aspect-ratio: 1456 / 548; }
.birthday-row, .gateway-row { --thumb: 40px; }
.birthday-mark, .gateway-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--gs-line); color: var(--gs-ink-2); }
.gateway-icon { background: none; color: var(--gs-ink-2); }

/* Main-story art fills the tile by its own opaque area (see MAIN_ART). */
.story-section-head h2 small { margin-left: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-regular); }

/* Unit prequels: all sixteen banners on the page, four to a row. */
.unit-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gs-space-6) var(--gs-space-5); }
.unit-grid button { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; padding: 0; border: 0; background: none; color: var(--gs-ink); cursor: pointer; font: inherit; text-align: left; }
.unit-grid img { display: block; width: 100%; height: auto; aspect-ratio: 446 / 150; border-radius: var(--gs-radius-media); }
.unit-grid button > span { display: flex; justify-content: space-between; gap: var(--gs-space-3); min-width: 0; font-size: var(--gs-text-ui); }
.unit-grid strong { overflow: hidden; font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.unit-grid small { flex: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
@media (hover: hover) { .unit-grid button:hover strong { color: var(--gs-mint-ink); } }

/* Main: one band about 140px tall — two 250×95 covers, then where to start. */
.main-band { display: grid; grid-template-columns: 250px 250px minmax(0, 1fr); align-items: start; gap: var(--gs-space-5); }
.main-cover .story-tile-media { aspect-ratio: 250 / 95; }
.main-cover .story-tile-copy { flex-direction: row; align-items: baseline; gap: var(--gs-space-3); }
.main-start { display: flex; flex-direction: column; align-self: stretch; justify-content: center; gap: var(--gs-space-1); min-width: 0; padding-left: var(--gs-space-5); border-left: 1px solid var(--gs-line); }
.main-start small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.main-start strong { overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.main-start-action { display: inline-flex; align-items: center; align-self: flex-start; gap: var(--gs-space-1); min-height: var(--gs-control-normal); margin-top: var(--gs-space-2); padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); box-shadow: inset 0 0 0 1px var(--gs-rule); background: var(--gs-surface); color: var(--gs-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); }

/* Events: year tabs under the heading; the newest four share one row at the same size. */
.event-section .story-section-head { justify-content: flex-start; }
.event-section .story-more { margin-left: auto; }
.story-section-head.has-tabs { margin-bottom: 0; border-bottom: 0; }
.event-four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gs-space-5); }
.event-four-item { display: flex; flex-direction: column; min-width: 0; padding: 0; border: 0; background: none; color: var(--gs-ink); cursor: pointer; font: inherit; text-align: left; }
.event-four-item :deep(.resource-image) { aspect-ratio: 940 / 510 !important; }
.event-four-item :deep(img) { object-fit: cover; }
.event-four-item strong { display: -webkit-box; overflow: hidden; margin-top: var(--gs-space-3); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.event-four-item small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.event-browse-row { margin-top: var(--gs-space-4); border-top: 1px solid var(--gs-line); }
.event-browse-row .story-row-copy strong { font-weight: var(--gs-weight-regular); color: var(--gs-ink-2); }

/* Unit prequels: sixteen logos, eight to a row, in hairline cells. */
.unit-logos { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); border-top: 1px solid var(--gs-line); }
.unit-logos button { display: grid; place-items: center; height: 60px; padding: 0; border: 0; border-right: 1px solid var(--gs-line); border-bottom: 1px solid var(--gs-line); background: none; cursor: pointer; }
.unit-logos button:nth-child(8n) { border-right: 0; }
.unit-logos img { width: 76%; height: 36px; object-fit: contain; }

/* 更多故事: three columns of text rows. */
.gateway-rows { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (hover: hover) {
  .event-four-item:hover strong, .main-start-action:hover { color: var(--gs-ink-2); }
  .unit-logos button:hover { background: var(--gs-paper-2); }
}

.catalog-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: var(--gs-space-4); }
.section-filter { display: inline-flex; align-items: center; gap: 5px; height: 30px; margin-bottom: 1px; padding: 0 8px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-mint-wash); color: var(--gs-mint-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-caption); }
.catalog-count { display: none; }
.search-view { isolation: isolate; }

/* Clear the bottom navigation the shell shows on phones. */
@media (max-width: 760px) { .story-catalog { padding-bottom: 70px; } }
@container story-page (max-width: 900px) {
  /* The start column drops below; the two covers share the width. Events and logos go 2 × 2 and 4 to a row. */
  .main-band { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .main-start { grid-column: 1 / -1; padding: var(--gs-space-3) 0 0; border-top: 1px solid var(--gs-line); border-left: 0; }
  .unit-grid { gap: var(--gs-space-5) var(--gs-space-4); }
  .event-four { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-5) var(--gs-space-4); }
  .gateway-rows { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container story-page (max-width: 560px) {
  /* Phones: chapters half-width each, no start column; the year chips leave the heading; the logos become one sideways row. */
  .main-start, .event-year-chips { display: none; }
  .story-section-head.has-tabs { margin-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); }
  .unit-logos { grid-auto-columns: 96px; grid-auto-flow: column; grid-template-columns: none; overflow-x: auto; margin-right: calc(-1 * var(--gs-space-5)); overscroll-behavior-x: contain; scrollbar-width: none; }
  .unit-logos button, .unit-logos button:nth-child(8n) { height: 54px; border-right: 1px solid var(--gs-line); }
  .unit-logos img { width: 72px; height: 32px; }
  .gateway-rows { grid-template-columns: 1fr; }
  /* The unit landing lists every unit, two to a row. */
  .unit-grid-full { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .catalog-toolbar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
