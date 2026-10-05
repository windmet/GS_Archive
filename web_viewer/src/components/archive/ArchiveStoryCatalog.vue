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
          <li>其中<b class="inline-count">{{ count(birthdayDomain?.meta?.crossDomainSharedFileCount) }}</b>篇也收在个人故事</li>
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

    <div v-else-if="mode === 'portal'" class="story-portal">
      <section class="story-section main-story-section" aria-labelledby="main-story-title">
        <div class="story-section-head">
          <h2 id="main-story-title">主线剧情</h2>
          <button class="story-more" @click="openDomain('main')">{{ domainCount('main') }} 篇 · 查看全部 <ArrowRight :size="15" /></button>
        </div>
        <div class="story-tiles">
          <button
            v-for="(chapter, index) in mainSections"
            :key="chapter.id"
            class="story-tile"
            @click="browse('main', chapter.id)"
          >
            <span class="story-tile-media">
              <img v-if="index < 2" :src="mainVisual(index)" :alt="chapter.label"
                loading="eager" :fetchpriority="index === 0 ? 'high' : 'auto'" width="1456" height="553" />
              <span v-else aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            </span>
            <span class="story-tile-copy">
              <strong>{{ chapter.label }}</strong>
              <small>{{ chapter.entries.length }} 篇剧情</small>
            </span>
          </button>
        </div>
      </section>

      <section class="story-section" aria-labelledby="quick-archives-title">
        <div class="story-section-head"><h2 id="quick-archives-title">更多故事</h2></div>
        <div class="story-rows">
          <button v-for="gateway in secondaryGateways" :key="gateway.id" class="story-row gateway-row" @click="openGateway(gateway)">
            <span class="gateway-icon" aria-hidden="true"><component :is="gateway.icon" :size="20" /></span>
            <span class="story-row-copy"><strong>{{ gateway.label }}</strong><small>{{ gatewayCount(gateway) }} {{ gateway.unit || '篇' }}</small></span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section class="story-section event-section" aria-labelledby="event-story-title">
        <div class="story-section-head">
          <h2 id="event-story-title">活动剧情</h2>
          <button class="story-more" @click="browse('event')">查看全部 <ArrowRight :size="15" /></button>
        </div>
        <div class="reading-card-grid">
          <EventStoryCard v-for="entry in featuredEvents" :key="entry.id" :entry="entry" :idol-name="idolName" @read="emit('select',$event)" @event="emit('open-event',$event)" />
        </div>
      </section>

      <section class="story-section unit-section" aria-labelledby="unit-story-title">
        <div class="story-section-head">
          <h2 id="unit-story-title">组合前传</h2>
          <div class="unit-actions"><button aria-label="上一组组合前传" @click="scrollUnits(-1)"><ChevronLeft :size="17" /></button><button aria-label="下一组组合前传" @click="scrollUnits(1)"><ChevronRight :size="17" /></button><button class="story-more" @click="browse('unit_story')">查看全部（{{ unitGateways.length }}） <ArrowRight :size="15" /></button></div>
        </div>
        <div ref="unitTrack" class="unit-grid" aria-label="组合前传横向列表">
          <button v-for="unit in unitGateways" :key="unit.id" @click="browse('unit_story', unit.id)">
            <img :src="unitVisual(unit.id)" :alt="unit.label" loading="lazy" decoding="async" width="446" height="150" />
            <small>{{ unit.entries.length }} 篇</small>
          </button>
        </div>
      </section>

    </div>

    <div v-else-if="mode!=='portal'" class="search-view">
      <StoryDiscovery :external-filters-active="Boolean(domain || section || availability !== 'all' || sort !== 'domain')" @reset-filters="emit('update:availability','all');emit('update:sort','domain')" :entries="searchEntries" :query="searchQuery" @update:query="emit('update:search-query',$event)" :idol-directory="idolDirectory" :idol-name="idolName" :idol-search="idolSearch" @series-change="emit('update:domain','');emit('clear-section')" @select="emit('select',$event)">
      <template #filters>
      <div class="catalog-toolbar">
        <label>
          <span>故事分类</span>
          <select :value="domain" @change="emit('update:domain', $event.target.value)">
            <option value="">全部（{{ catalogTotal }}）</option>
            <option v-for="option in domainOptions" :key="option.id" :value="option.id">
              {{ option.label }}（{{ option.count }}）
            </option>
          </select>
        </label>
        <label v-if="domain === 'event'">
          <span>活动类型</span>
          <select :value="eventScope" @change="emit('update:event-scope', $event.target.value)">
            <option value="all">全部活动</option>
            <option v-for="option in eventScopeOptions" :key="option.id" :value="option.id">
              {{ option.label }}（{{ option.count }}）
            </option>
          </select>
        </label>
        <label>
          <span>可用性</span>
          <select :value="availability" @change="emit('update:availability', $event.target.value)">
            <option value="all">全部</option><option value="playable">可播放</option><option value="missing">缺少文件</option>
          </select>
        </label>
        <label>
          <span>排序</span>
          <select :value="sort" @change="emit('update:sort', $event.target.value)">
            <option value="latest">最新优先</option>
            <option value="domain">故事分类</option><option value="title">标题</option><option value="resource">资源 ID</option><option value="steps_desc">步骤数</option>
          </select>
        </label>
        <button v-if="section" class="section-filter" @click="emit('clear-section')">
          {{ sectionLabel }} <X :size="14" />
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
import {storyGateways,storyGatewayCount} from '../../presentation/StoryGateways.js'
import { EXTERNAL_STORY_RESOURCES_ENABLED } from '../../../shared/deploy/ExternalStoryResourcePolicy.js'
import { computed, ref } from 'vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import { ArrowRight, BookOpen, Cake, ChevronLeft, ChevronRight, LayoutGrid, Search, X } from '@lucide/vue'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import EventStoryCard from './EventStoryCard.vue'
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
  idolStoryCount: { type: Number, default: 0 },
  externalResourceCount: { type: Number, default: 0 },
  mainDomain: { type: Object, default: null },
  extraDomain: { type: Object, default: null },
  birthdayDomain: { type: Object, default: null },
})
const emit = defineEmits([
  'clear-idol','select', 'open-event', 'browse', 'open-seasonal', 'open-work', 'open-idol-story', 'open-external-resources', 'load-more', 'clear-section', 'update:mode', 'update:domain', 'update:event-scope', 'update:availability', 'update:sort','update:search-query'])
const unitTrack=ref(null)
function scrollUnits(direction){const track=unitTrack.value;if(track)track.scrollBy({left:direction*track.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}

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
const featuredEvents = computed(() => props.allEntries.filter(entry => entry.domain === 'event').sort((a, b) => b.releaseAt - a.releaseAt).slice(0, 6))
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
function unitVisual(id) {
  const codes = ['01jup', '02dra', '03alt', '04bei', '05w00', '06fra', '07sai', '08hig', '09shi', '10caf', '11mof', '12sem', '13the', '14fla', '15leg', '16cfi']
  return `/assets/stories/units/image_unit_story_button_${codes[Number(id) - 1] || codes[0]}.png`
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
.catalog-switcher button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 120px; min-height: var(--gs-control-touch); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--gs-ink-3); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); }
.catalog-switcher button.active { border-color: var(--gs-ink); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }

.story-footprint .inline-count { margin-inline: var(--gs-space-2); }
.story-tile.placeholder .story-tile-copy strong { color: var(--gs-ink-3); }
.extra-row { --thumb: 112px; }
.extra-row .story-row-thumb { aspect-ratio: 1456 / 548; }
.birthday-row, .gateway-row { --thumb: 40px; }
.birthday-mark, .gateway-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--gs-line); color: var(--gs-ink-2); }
.gateway-icon { background: none; color: var(--gs-ink-2); }

.reading-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--gs-space-7) var(--gs-space-5); }
.unit-actions { display: flex; flex-shrink: 0; align-items: center; gap: var(--gs-space-2); }
.unit-actions > button:not(.story-more) { display: grid; place-items: center; width: var(--gs-control-compact); height: var(--gs-control-compact); padding: 0; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-2); cursor: pointer; }
.unit-actions > .story-more { margin-left: var(--gs-space-3); }
.unit-grid { display: flex; gap: var(--gs-space-4); overflow-x: auto; padding: var(--gs-space-1) 0 var(--gs-space-4); scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: thin; }
.unit-grid button { display: flex; flex: 0 0 23%; flex-direction: column; gap: var(--gs-space-2); min-width: 0; padding: 0; border: 0; background: none; color: var(--gs-ink-3); cursor: pointer; font: inherit; font-size: var(--gs-text-meta); text-align: left; scroll-snap-align: start; }
.unit-grid img { display: block; width: 100%; height: auto; border-radius: var(--gs-radius-media); }

.catalog-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: var(--gs-space-4); }
.catalog-toolbar label { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 120px; }
.catalog-toolbar label > span { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.catalog-toolbar select { min-height: 34px; padding: 0 28px 0 9px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-meta); }
.section-filter { display: inline-flex; align-items: center; gap: 5px; height: 30px; margin-bottom: 1px; padding: 0 8px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-mint-wash); color: var(--gs-mint-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-caption); }
.catalog-count { display: none; }
.search-view { isolation: isolate; }

/* Clear the bottom navigation the shell shows on phones. */
@media (max-width: 760px) { .story-catalog { padding-bottom: 70px; } }
@container story-page (max-width: 560px) {
  .unit-grid button { flex-basis: 76%; }
  .unit-actions > button:not(.story-more) { display: none; }
  .catalog-toolbar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .catalog-toolbar label { min-width: 0; }
}
</style>
