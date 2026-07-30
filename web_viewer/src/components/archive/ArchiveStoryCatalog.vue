<template>
  <section class="story-catalog">
    <div class="catalog-switcher" role="tablist" aria-label="故事浏览方式">
      <button :class="{ active: mode === 'portal' }" @click="emit('update:mode', 'portal')">
        <LayoutGrid :size="16" />
        <span>分类入口</span>
      </button>
      <button :class="{ active: mode === 'search' }" @click="emit('update:mode', 'search')">
        <Search :size="16" />
        <span>全部检索</span>
      </button>
    </div>

    <div v-if="mode === 'portal' && domain === 'main'" class="main-domain-landing">
      <header class="main-domain-hero">
        <div>
          <span>MAIN STORY ARCHIVE</span>
          <h2>主线剧情</h2>
          <p>按 masterdata 的正式章节与话目结构浏览主线。未公开章节保留档案位置，但不提供播放入口。</p>
        </div>
        <dl>
          <div><dt>章节</dt><dd>{{ mainDomain?.meta?.collectionCount || 0 }}</dd></div>
          <div><dt>正式话目</dt><dd>{{ mainDomain?.meta?.chapterCount || 0 }}</dd></div>
          <div><dt>剧情分段</dt><dd>{{ mainDomain?.meta?.logicalEntryCount || 0 }}</dd></div>
        </dl>
      </header>

      <section class="main-domain-collections" aria-labelledby="main-domain-collections-title">
        <div class="section-heading">
          <div>
            <span>CHAPTER COLLECTIONS</span>
            <h2 id="main-domain-collections-title">章节目录</h2>
          </div>
        </div>
        <div class="main-domain-grid">
          <button
            v-for="(collection, index) in mainDomain?.collections || []"
            :key="collection.id"
            class="main-domain-card"
            :class="{ placeholder: collection.isPlaceholder }"
            :disabled="collection.isPlaceholder"
            @click="browse('main', collection.masterId)"
          >
            <span class="main-domain-visual">
              <img
                v-if="!collection.isPlaceholder && index < 2"
                :src="mainVisual(index)"
                :alt="collection.title"
              />
              <span v-else aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            </span>
            <span class="main-domain-copy">
              <small>{{ collection.isPlaceholder ? 'MASTER PLACEHOLDER' : 'MAIN STORY' }}</small>
              <strong>{{ collection.title }}</strong>
              <span v-if="collection.chapterCount">
                {{ collection.chapterCount }} 话目 · {{ collection.logicalEntryCount }} 分段
              </span>
              <span v-else>尚无已发布话目</span>
            </span>
            <span class="main-domain-status">
              {{ collection.isPlaceholder ? '未公开' : '查看章节' }}
              <ArrowRight v-if="!collection.isPlaceholder" :size="16" />
            </span>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="mode === 'portal' && domain === 'extra'" class="extra-domain-landing">
      <header class="extra-domain-hero">
        <div>
          <span>EXTRA STORY ARCHIVE</span>
          <h2>额外剧情</h2>
          <p>按 masterdata 的正式逻辑条目归档；共享编译文件不会合并目录身份。</p>
        </div>
        <dl aria-label="额外剧情归档统计">
          <div><dt>正式条目</dt><dd>{{ extraDomain?.meta?.collectionCount || 0 }}</dd></div>
          <div><dt>资源身份</dt><dd>{{ extraDomain?.meta?.resourceIdCount || 0 }}</dd></div>
          <div><dt>播放文件</dt><dd>{{ extraDomain?.meta?.compiledFileCount || 0 }}</dd></div>
        </dl>
      </header>

      <section class="extra-domain-section" aria-labelledby="extra-domain-heading">
        <div class="section-heading">
          <div><span>MASTERDATA COLLECTIONS</span><h3 id="extra-domain-heading">正式剧情目录</h3></div>
          <strong>{{ extraCards.length }} collections</strong>
        </div>
        <div class="extra-card-grid">
          <button
            v-for="card in extraCards"
            :key="card.id"
            class="extra-card"
            @click="browse('extra', card.masterId)"
          >
            <span class="extra-card-index">{{ card.parentSeriesId }}</span>
            <span class="extra-card-copy">
              <small>{{ formatExtraDate(card.releaseAt) }}</small>
              <strong>{{ card.title }}</strong>
              <span>{{ card.entry?.title || card.entry?.resourceId }}</span>
              <code>{{ card.entry?.resourceId }}</code>
            </span>
            <span v-if="card.sharedPlayback" class="shared-playback">共享播放文件</span>
            <ArrowRight :size="17" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="mode === 'portal'" class="story-portal">
      <section class="main-story-band">
        <div class="band-heading">
          <div>
            <span>MAIN STORY</span>
            <h2>主线剧情</h2>
            <p>从 315 Production 启程，按章节阅读完整故事。</p>
          </div>
          <div class="band-actions">
            <strong>{{ domainCount('main') }} 篇</strong>
            <button @click="openDomain('main')">查看全部 <ArrowRight :size="15" /></button>
          </div>
        </div>
        <div class="main-chapters">
          <button
            v-for="(chapter, index) in mainSections"
            :key="chapter.id"
            class="chapter-entry"
            @click="browse('main', chapter.id)"
          >
            <img v-if="index < 2" :src="mainVisual(index)" :alt="chapter.label" />
            <span v-else class="chapter-fallback">{{ chapter.label }}</span>
            <span class="chapter-copy">
              <small>{{ chapter.label }}</small>
              <strong>{{ chapter.entries[0]?.title }}</strong>
              <span>{{ chapter.entries.length }} 篇剧情</span>
            </span>
            <ArrowRight :size="18" />
          </button>
        </div>
      </section>

      <section class="portal-section event-section">
        <div class="section-heading">
          <div><span>EVENT STORY</span><h2>活动剧情</h2></div>
          <button @click="browse('event')">查看全部 <ArrowRight :size="15" /></button>
        </div>
        <div class="event-strip">
          <button v-for="entry in featuredEvents" :key="entry.id" @click="emit('select', entry)">
            <img :src="eventBanner(entry)" :alt="entry.title" />
            <span><small>{{ entry.eventScopeLabel || entry.domainLabel }}</small><strong>{{ entry.title }}</strong></span>
          </button>
        </div>
      </section>

      <section class="portal-section unit-section">
        <div class="section-heading">
          <div><span>UNIT EPISODE ZERO</span><h2>组合前传</h2></div>
          <button @click="browse('unit_story')">查看全部 <ArrowRight :size="15" /></button>
        </div>
        <div class="unit-grid">
          <button v-for="unit in unitGateways" :key="unit.id" @click="browse('unit_story', unit.id)">
            <img :src="unitVisual(unit.id)" :alt="unit.label" />
            <span>{{ unit.entries.length }} 篇</span>
          </button>
        </div>
      </section>

      <section class="portal-section archive-section">
        <div class="section-heading"><div><span>STORY ARCHIVE</span><h2>更多故事</h2></div></div>
        <div class="domain-grid">
          <button v-for="gateway in secondaryGateways" :key="gateway.id" @click="openGateway(gateway)">
            <span class="gateway-icon"><component :is="gateway.icon" :size="20" /></span>
            <span><strong>{{ gateway.label }}</strong><small>{{ gatewayCount(gateway) }} {{ gateway.unit || '篇' }}</small></span>
            <ArrowRight :size="16" />
          </button>
        </div>
      </section>
    </div>

    <div v-else class="search-view">
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
            <option value="domain">故事分类</option><option value="title">标题</option><option value="resource">资源 ID</option><option value="steps_desc">步骤数</option>
          </select>
        </label>
        <button v-if="section" class="section-filter" @click="emit('clear-section')">
          {{ sectionLabel }} <X :size="14" />
        </button>
        <span class="catalog-count">{{ filteredTotal }} results</span>
      </div>

      <p v-if="!entries.length" class="empty-state">没有符合当前条件的故事</p>

      <div v-if="domain === 'event' && entries.length" class="event-entity-grid">
        <button v-for="entry in entries" :key="entry.id" @click="emit('select', entry)">
          <span class="event-entity-visual">
            <img :src="eventBanner(entry)" :alt="entry.masterEvent?.name || entry.title" />
            <span>{{ entry.eventScopeLabel || '活动剧情' }}</span>
          </span>
          <span class="event-entity-copy">
            <small>{{ eventTypeLabel(entry) }} · {{ formatEventDate(entry) }}</small>
            <strong>{{ entry.masterEvent?.name || entry.title }}</strong>
            <span>{{ entry.preplaySynopsis?.text || '已收录完整活动剧情与关联资料。' }}</span>
          </span>
          <span class="event-reward-icons">
            <img
              v-for="cardId in entry.rewardCardIds?.slice(0, 3)"
              :key="cardId"
              :src="getCardIconUrl(cardId, true)"
              :alt="cardId"
            />
            <small v-if="!entry.rewardCardIds?.length">无卡片报酬记录</small>
          </span>
          <ArrowRight :size="17" />
        </button>
      </div>

      <div v-else-if="domain !== 'event'" class="story-list">
        <button
          v-for="entry in entries"
          :key="entry.id"
          class="story-row"
          :class="{ missing: !entry.exists && !entry.eventRelation, event: entry.eventRelation }"
          :disabled="!entry.exists && !entry.eventRelation"
          @click="emit('select', entry)"
        >
          <span class="story-play" aria-hidden="true">
            <CalendarRange v-if="entry.eventRelation" :size="18" />
            <BookOpen v-else-if="entry.exists" :size="18" />
            <FileWarning v-else :size="18" />
          </span>
          <span class="story-domain">{{ entry.eventScopeLabel || entry.domainLabel }}</span>
          <span class="story-main">
            <small class="story-hierarchy">{{ hierarchyLabel(entry) }}</small>
            <strong>{{ entry.title }}</strong>
            <span v-if="entry.preplaySynopsis?.text" class="story-synopsis">{{ entry.preplaySynopsis.text }}</span>
            <small class="story-resource">{{ entry.resourceId }}</small>
          </span>
          <span class="story-stats"><span>{{ entry.playableStepCount || 0 }} steps</span><span>{{ entry.summary?.voice_count || 0 }} voices</span></span>
          <ArrowRight class="row-arrow" :size="17" />
        </button>
      </div>

      <button v-if="entries.length < filteredTotal" class="load-more" @click="emit('load-more')">
        <ChevronDown :size="17" /><span>显示更多</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowRight, BookOpen, Briefcase, Cake, CalendarRange, ChevronDown, CreditCard, FileWarning, Languages, LayoutGrid, Search, Sparkles, UserRound, X } from '@lucide/vue'
import { getCardIconUrl } from '../../utils/CardAssetResolver.js'

const props = defineProps({
  entries: { type: Array, default: () => [] }, allEntries: { type: Array, default: () => [] },
  domainOptions: { type: Array, default: () => [] }, domain: { type: String, default: '' },
  section: { type: String, default: '' }, mode: { type: String, default: 'portal' },
  eventScopeOptions: { type: Array, default: () => [] }, eventScope: { type: String, default: 'all' },
  availability: { type: String, default: 'all' }, sort: { type: String, default: 'domain' },
  catalogTotal: { type: Number, default: 0 }, filteredTotal: { type: Number, default: 0 },
  seasonalCampaigns: { type: Array, default: () => [] },
  workIdols: { type: Array, default: () => [] },
  idolStoryCount: { type: Number, default: 0 },
  externalResourceCount: { type: Number, default: 0 },
  mainDomain: { type: Object, default: null },
  extraDomain: { type: Object, default: null },
})
const emit = defineEmits(['select', 'browse', 'open-seasonal', 'open-work', 'open-idol-story', 'open-external-resources', 'load-more', 'clear-section', 'update:mode', 'update:domain', 'update:event-scope', 'update:availability', 'update:sort'])

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
const extraCards = computed(() => {
  const entries = new Map((props.extraDomain?.logicalEntries || []).map(entry => [entry.id, entry]))
  const playbackUse = new Map()
  for (const entry of props.extraDomain?.logicalEntries || []) {
    if (!entry.compiledFile) continue
    playbackUse.set(entry.compiledFile, (playbackUse.get(entry.compiledFile) || 0) + 1)
  }
  return (props.extraDomain?.collections || []).map(collection => {
    const entry = entries.get(collection.logicalEntryIds?.[0]) || null
    return {
      ...collection,
      entry,
      releaseAt: entry?.releaseAt || 0,
      sharedPlayback: (playbackUse.get(entry?.compiledFile) || 0) > 1,
    }
  })
})
const secondaryGateways = [
  { id: 'external_story_resources', label: '社区中文剧情', icon: Languages, unit: '条', action: 'external-resources' },
  { id: 'idol_story', label: '个人故事', icon: UserRound, action: 'idol-story' }, { id: 'card_scenarios', label: '卡片剧情', icon: CreditCard },
  { id: 'work', label: '工作剧情', icon: Briefcase, unit: '人', action: 'work' }, { id: 'birthday', label: '生日剧情', icon: Cake },
  { id: 'extra', label: '额外剧情', icon: Sparkles },
  { id: 'seasonal_campaign', label: '季节企划', icon: CalendarRange, unit: '组', action: 'seasonal' },
]
const sectionLabel = computed(() => props.allEntries.find(entry => entry.domain === props.domain && entry.sectionId === props.section)?.sectionLabel || props.section)

function browse(domain, section = '') { emit('browse', { domain, section }) }
function openDomain(domain) { emit('browse', { domain, section: '', mode: 'portal' }) }
function domainCount(domain) { return props.allEntries.filter(entry => entry.domain === domain).length }
function gatewayCount(gateway) {
  if (gateway.action === 'external-resources') return props.externalResourceCount
  if (gateway.action === 'seasonal') return props.seasonalCampaigns.length
  if (gateway.action === 'work') return props.workIdols.length
  if (gateway.action === 'idol-story') return props.idolStoryCount
  return domainCount(gateway.id)
}
function openGateway(gateway) {
  if (gateway.action === 'external-resources') emit('open-external-resources')
  else if (gateway.action === 'seasonal') emit('open-seasonal')
  else if (gateway.action === 'work') emit('open-work')
  else if (gateway.action === 'idol-story') emit('open-idol-story')
  else browse(gateway.id)
}
function mainVisual(index) { return `/assets/stories/main/image_story_main_button_${String(index + 1).padStart(2, '0')}.png` }
function eventBanner(entry) { return `/assets/events/banners/image_home_announce_event_${entry.eventRelation?.event_code || entry.sectionId}_01.png` }
function eventTypeLabel(entry) {
  return ({ theater: 'THEATER', tour: 'TOUR', carnival: '315 CARNIVAL' })[entry.masterEvent?.event_type_label] || 'EVENT'
}
function formatEventDate(entry) {
  const timestamp = Number(entry.masterEvent?.start_at || entry.releaseAt || 0)
  if (!timestamp) return '日期未记录'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo',
  }).format(new Date(timestamp * 1000))
}
function unitVisual(id) {
  const codes = ['01jup', '02dra', '03alt', '04bei', '05w00', '06fra', '07sai', '08hig', '09shi', '10caf', '11mof', '12sem', '13the', '14fla', '15leg', '16cfi']
  return `/assets/stories/units/image_unit_story_button_${codes[Number(id) - 1] || codes[0]}.png`
}
function hierarchyLabel(entry) { return [entry.sectionLabel, entry.episodeLabel].filter(Boolean).join(' · ') || entry.domainLabel }
function formatExtraDate(timestamp) {
  if (!Number(timestamp)) return '开放日期未记录'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo',
  }).format(new Date(Number(timestamp) * 1000))
}
</script>

<style scoped>
.story-catalog { height: 100%; overflow-y: auto; overflow-x: hidden; background: #f5f7f8; color: #26343c; }
.catalog-switcher { position: sticky; top: 0; z-index: 4; display: flex; justify-content: center; gap: 2px; padding: 8px 16px; border-bottom: 1px solid #e0e5e7; background: rgba(255,255,255,.96); }
.catalog-switcher button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 120px; height: 34px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #718089; cursor: pointer; font: inherit; font-size: .7rem; }
.catalog-switcher button.active { border-color: #15978e; color: #126f69; font-weight: 800; }
.extra-domain-landing { min-height: calc(100% - 51px); background: #f7f9fa; }
.extra-domain-hero { display: flex; align-items: end; justify-content: space-between; gap: 28px; padding: 34px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dce4e6; background: linear-gradient(120deg, #f0faf8, #fff 62%); }
.extra-domain-hero > div > span, .extra-domain-section .section-heading span { color: #168a82; font-size: .6rem; font-weight: 800; letter-spacing: .08em; }
.extra-domain-hero h2 { margin: 5px 0 8px; font-size: 1.45rem; }
.extra-domain-hero p { max-width: 620px; margin: 0; color: #52636b; font-size: .7rem; line-height: 1.7; }
.extra-domain-hero dl { display: grid; grid-template-columns: repeat(3, minmax(74px, 1fr)); min-width: 300px; margin: 0; border: 1px solid #d8e5e4; border-radius: 6px; background: rgba(255,255,255,.86); }
.extra-domain-hero dl div { padding: 12px 14px; border-right: 1px solid #e1e9e9; text-align: center; }
.extra-domain-hero dl div:last-child { border-right: 0; }
.extra-domain-hero dt { color: #7a898f; font-size: .56rem; }.extra-domain-hero dd { margin: 4px 0 0; color: #176f69; font-size: 1rem; font-weight: 800; }
.extra-domain-section { padding: 25px max(24px, calc((100% - 1120px) / 2)) 42px; }
.extra-domain-section .section-heading h3 { margin: 3px 0 0; font-size: 1rem; }
.extra-domain-section .section-heading > strong { color: #7d8b92; font-size: .61rem; }
.extra-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 9px; }
.extra-card { position: relative; display: grid; grid-template-columns: 42px minmax(0,1fr) 18px; align-items: center; gap: 10px; min-height: 112px; padding: 13px 12px; border: 1px solid #dce4e6; border-radius: 6px; background: #fff; color: #293a42; cursor: pointer; font: inherit; text-align: left; }
.extra-card:hover { border-color: #65bbb5; box-shadow: 0 4px 14px rgba(28,66,66,.08); }
.extra-card-index { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #e8f6f4; color: #147c75; font-size: .61rem; font-weight: 800; }
.extra-card-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.extra-card-copy small { color: #849298; font-size: .53rem; }.extra-card-copy strong { overflow: hidden; font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }
.extra-card-copy span { overflow: hidden; color: #53666e; font-size: .61rem; text-overflow: ellipsis; white-space: nowrap; }
.extra-card-copy code { overflow: hidden; color: #8a969b; font-size: .51rem; text-overflow: ellipsis; white-space: nowrap; }
.shared-playback { position: absolute; top: 8px; right: 9px; padding: 2px 5px; border-radius: 3px; background: #fff2d9; color: #8a641d; font-size: .49rem; }
.story-portal { background: #fff; }
.main-domain-landing { min-height: 100%; background: #f5f7f8; }
.main-domain-hero { display: flex; align-items: end; justify-content: space-between; gap: 32px; padding: 34px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #dfe6e7; background-color: rgba(255,255,255,.82); background-image: url('/assets/stories/story_background.png'); background-position: center; background-size: cover; background-blend-mode: screen; }
.main-domain-hero > div { max-width: 660px; }
.main-domain-hero span, .main-domain-collections .section-heading span { color: #168d85; font-size: .6rem; font-weight: 800; letter-spacing: .06em; }
.main-domain-hero h2 { margin: 5px 0 8px; font-size: 1.5rem; }
.main-domain-hero p { margin: 0; color: #52636b; font-size: .72rem; line-height: 1.7; }
.main-domain-hero dl { display: grid; grid-template-columns: repeat(3, minmax(76px,1fr)); gap: 1px; min-width: 300px; margin: 0; overflow: hidden; border: 1px solid #dbe3e5; border-radius: 7px; background: #dbe3e5; }
.main-domain-hero dl > div { padding: 11px 14px; background: rgba(255,255,255,.94); }
.main-domain-hero dt { color: #7a888f; font-size: .56rem; }
.main-domain-hero dd { margin: 4px 0 0; color: #25353d; font-size: 1.15rem; font-weight: 800; }
.main-domain-collections { padding: 28px max(24px, calc((100% - 1120px) / 2)) 40px; }
.main-domain-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
.main-domain-card { display: grid; grid-template-rows: 155px minmax(104px,auto) 38px; overflow: hidden; padding: 0; border: 1px solid #d8e0e2; border-radius: 7px; background: #fff; color: #293840; cursor: pointer; font: inherit; text-align: left; }
.main-domain-card:hover { border-color: #5db7b0; box-shadow: 0 7px 22px rgba(28,66,66,.11); transform: translateY(-1px); }
.main-domain-card:focus-visible { outline: 3px solid rgba(21,151,142,.35); outline-offset: 2px; }
.main-domain-card:disabled { cursor: not-allowed; opacity: .72; }
.main-domain-card:disabled:hover { border-color: #d8e0e2; box-shadow: none; transform: none; }
.main-domain-visual { display: grid; place-items: center; overflow: hidden; background: #172126; color: rgba(255,255,255,.5); font-size: 2rem; font-weight: 800; letter-spacing: .08em; }
.main-domain-visual img { width: 100%; height: 100%; object-fit: cover; }
.main-domain-copy { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px 12px; }
.main-domain-copy small { color: #168a82; font-size: .55rem; font-weight: 800; letter-spacing: .05em; }
.main-domain-copy strong { font-size: 1rem; }
.main-domain-copy > span { color: #75838a; font-size: .64rem; }
.main-domain-status { display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-top: 1px solid #e5eaec; color: #167e77; font-size: .62rem; font-weight: 700; }
.main-domain-card.placeholder .main-domain-status { color: #7f8b91; }
.main-story-band { padding: 28px max(24px, calc((100% - 1120px) / 2)) 32px; background-color: rgba(255,255,255,.76); background-image: url('/assets/stories/story_background.png'); background-position: center top; background-size: cover; background-blend-mode: screen; border-bottom: 1px solid #dfe6e7; }
.band-heading, .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.band-heading span, .section-heading span { color: #168d85; font-size: .6rem; font-weight: 800; }
.band-heading h2, .section-heading h2 { margin: 3px 0 0; font-size: 1.15rem; }
.band-heading p { margin: 5px 0 0; color: #4f5f67; font-size: .68rem; }
.band-heading > strong { color: #43545c; font-size: .68rem; }
.band-actions { display: flex; align-items: center; gap: 12px; }
.band-actions > strong { color: #43545c; font-size: .68rem; }
.band-actions > button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: #167e77; cursor: pointer; font: inherit; font-size: .66rem; }
.main-chapters { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.chapter-entry { position: relative; overflow: hidden; min-height: 150px; padding: 0; border: 1px solid #d7dfe2; border-radius: 6px; background: #172126; color: #fff; cursor: pointer; text-align: left; }
.chapter-entry > img { display: block; width: 100%; height: 100%; min-height: 150px; object-fit: cover; opacity: .86; }
.chapter-fallback { display: grid; place-items: center; min-height: 150px; font-size: 1rem; }
.chapter-entry::after { position: absolute; inset: 36% 0 0; content: ''; background: linear-gradient(transparent, rgba(7,15,18,.86)); }
.chapter-copy { position: absolute; z-index: 1; left: 15px; right: 42px; bottom: 13px; display: flex; flex-direction: column; gap: 3px; }
.chapter-copy small, .chapter-copy span { color: rgba(255,255,255,.78); font-size: .6rem; }
.chapter-copy strong { font-size: .82rem; }
.chapter-entry > svg { position: absolute; z-index: 2; right: 15px; bottom: 19px; }
.portal-section { padding: 24px max(24px, calc((100% - 1120px) / 2)); border-bottom: 1px solid #e3e7e9; }
.section-heading > button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: #167e77; cursor: pointer; font: inherit; font-size: .66rem; }
.event-strip { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.event-strip button { overflow: hidden; padding: 0; border: 1px solid #dfe5e7; border-radius: 6px; background: #fff; cursor: pointer; text-align: left; }
.event-strip img { display: block; width: 100%; aspect-ratio: 940/510; object-fit: contain; background: #eef2f3; }
.event-strip button > span { display: flex; flex-direction: column; gap: 3px; padding: 9px 10px 11px; }
.event-strip small { color: #168a82; font-size: .56rem; }
.event-strip strong { overflow: hidden; font-size: .7rem; text-overflow: ellipsis; white-space: nowrap; }
.unit-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; }
.unit-grid button { position: relative; overflow: hidden; min-height: 82px; padding: 0; border: 1px solid #dfe4e6; border-radius: 6px; background: #f7f9fa; cursor: pointer; }
.unit-grid img { display: block; width: 100%; height: 100%; min-height: 82px; object-fit: contain; }
.unit-grid span { position: absolute; right: 5px; bottom: 5px; padding: 2px 5px; border-radius: 3px; background: rgba(24,36,42,.76); color: #fff; font-size: .52rem; }
.domain-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.domain-grid button { display: grid; grid-template-columns: 34px minmax(0,1fr) 16px; align-items: center; gap: 8px; min-height: 66px; padding: 10px; border: 1px solid #dfe5e7; border-radius: 6px; background: #fff; color: #293840; cursor: pointer; text-align: left; }
.domain-grid button:hover, .event-strip button:hover, .unit-grid button:hover, .chapter-entry:hover { border-color: #66bdb7; box-shadow: 0 4px 14px rgba(28,66,66,.09); }
.gateway-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #e8f6f4; color: #147f78; }
.domain-grid button > span:nth-child(2) { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.domain-grid strong { font-size: .68rem; }.domain-grid small { color: #819097; font-size: .56rem; }
.catalog-toolbar { position: sticky; top: 51px; z-index: 3; display: flex; align-items: end; gap: 10px; min-height: 62px; padding: 9px 16px; border-bottom: 1px solid #dfe4e8; background: #fff; }
.catalog-toolbar label { display: flex; flex-direction: column; gap: 4px; min-width: 145px; }.catalog-toolbar label > span { color: #7b858e; font-size: .6rem; }
.catalog-toolbar select { height: 32px; padding: 0 28px 0 9px; border: 1px solid #d7dde2; border-radius: 6px; background: #fff; color: #26313a; font: inherit; font-size: .69rem; }
.section-filter { display: inline-flex; align-items: center; gap: 5px; height: 30px; margin-bottom: 1px; padding: 0 8px; border: 1px solid #b9dedb; border-radius: 4px; background: #edf9f8; color: #147c75; cursor: pointer; font: inherit; font-size: .62rem; }
.catalog-count { margin: 0 0 8px auto; color: #7b858e; font-size: .65rem; white-space: nowrap; }
.story-list { display: flex; flex-direction: column; gap: 7px; padding: 12px 16px; }
.event-entity-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; padding: 12px max(16px, calc((100% - 1120px) / 2)) 30px; }
.event-entity-grid > button { display: grid; grid-template-columns: 168px minmax(0,1fr) auto 18px; align-items: center; gap: 11px; overflow: hidden; min-height: 112px; padding: 0 11px 0 0; border: 1px solid #dfe5e7; border-radius: 6px; background: #fff; color: #293840; cursor: pointer; font: inherit; text-align: left; }
.event-entity-grid > button:hover { border-color: #62b9b2; box-shadow: 0 4px 14px rgba(31,72,70,.08); }
.event-entity-visual { position: relative; align-self: stretch; overflow: hidden; background: #edf1f2; }.event-entity-visual > img { width: 100%; height: 100%; object-fit: contain; }.event-entity-visual > span { position: absolute; right: 5px; bottom: 5px; left: 5px; overflow: hidden; padding: 3px 5px; border-radius: 3px; background: rgba(24,37,42,.78); color: #fff; font-size: .49rem; text-overflow: ellipsis; white-space: nowrap; }
.event-entity-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }.event-entity-copy > small { color: #15857d; font-size: .53rem; font-weight: 700; }.event-entity-copy > strong { overflow: hidden; font-size: .72rem; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }.event-entity-copy > span { display: -webkit-box; overflow: hidden; color: #718087; font-size: .56rem; line-height: 1.45; white-space: pre-line; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.event-reward-icons { display: flex; flex-direction: column; align-items: center; min-width: 34px; }.event-reward-icons img { width: 30px; height: 30px; margin-top: -6px; border: 2px solid #fff; border-radius: 50%; object-fit: contain; box-shadow: 0 1px 4px rgba(33,49,54,.2); }.event-reward-icons img:first-child { margin-top: 0; }.event-reward-icons small { max-width: 52px; color: #99a3a8; font-size: .45rem; line-height: 1.3; text-align: center; }
.story-row { display: grid; grid-template-columns: 30px 76px minmax(0,1fr) 92px 20px; align-items: center; gap: 10px; min-height: 92px; width: 100%; padding: 10px 12px; border: 1px solid #e0e5e8; border-radius: 6px; background: #fff; color: #29343d; cursor: pointer; text-align: left; }
.story-row:hover { border-color: #6ac2bc; background: #f5fbfa; }.story-row:disabled { cursor: not-allowed; opacity: .7; }.story-row.missing { border-style: dashed; background: #f3f5f6; }
.story-play { display: grid; place-items: center; color: #15978e; }.story-domain { display: inline-flex; align-items: center; justify-content: center; min-height: 24px; padding: 3px 6px; border-radius: 4px; background: #eaf8f6; color: #147f78; font-size: .6rem; text-align: center; }
.story-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }.story-hierarchy { color: #16877f; font-size: .59rem; }.story-main strong { overflow: hidden; font-size: .79rem; text-overflow: ellipsis; white-space: nowrap; }
.story-synopsis { display: -webkit-box; overflow: hidden; color: #69777f; font-size: .63rem; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: pre-line; }.story-resource { color: #99a2a7; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .55rem; }
.story-stats { display: flex; flex-direction: column; gap: 3px; color: #73808a; font-size: .6rem; text-align: right; }.row-arrow { color: #819097; }
.empty-state { margin: 32px 0; color: #7a858e; font-size: .75rem; text-align: center; }.load-more { display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 32px); min-height: 38px; margin: 0 16px 20px; border: 1px solid #d4dcdf; border-radius: 6px; background: #fff; color: #4f5c65; cursor: pointer; font: inherit; font-size: .69rem; }
@media (max-width: 850px) { .main-domain-hero { align-items: start; flex-direction: column; }.main-domain-hero dl { width: 100%; }.main-domain-grid, .extra-card-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.extra-domain-hero { align-items: stretch; flex-direction: column; }.extra-domain-hero dl { min-width: 0; width: 100%; }.event-strip { grid-template-columns: repeat(2,minmax(0,1fr)); }.unit-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }.domain-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 980px) { .event-entity-grid { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .main-domain-hero, .main-domain-collections, .main-story-band, .portal-section { padding: 18px 12px; }.main-domain-hero { gap: 18px; }.main-domain-hero h2 { font-size: 1.3rem; }.main-domain-hero dl { min-width: 0; }.main-domain-hero dl > div { padding: 9px; }.main-domain-grid { grid-template-columns: 1fr; }.main-domain-card { grid-template-rows: 136px minmax(92px,auto) 38px; }.extra-domain-hero { padding: 22px 12px; }.extra-domain-section { padding: 18px 10px 30px; }.extra-card-grid { grid-template-columns: 1fr; }.extra-domain-hero dl div { padding: 10px 6px; }.band-heading { align-items: start; }.band-actions { align-items: end; flex-direction: column; gap: 5px; }.main-chapters { grid-template-columns: 1fr; }.event-strip { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; }.event-strip button { flex: 0 0 78%; scroll-snap-align: start; }.unit-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }.catalog-toolbar { top: 51px; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); padding: 8px 10px; }.catalog-toolbar label { min-width: 0; }.catalog-count { justify-self: end; margin: 0; }.story-list { padding: 9px; }.story-row { grid-template-columns: 25px 64px minmax(0,1fr) 16px; gap: 7px; }.story-stats { grid-column: 3; flex-direction: row; gap: 8px; text-align: left; }.row-arrow { grid-column: 4; grid-row: 1 / span 2; }.story-synopsis { -webkit-line-clamp: 3; }.event-entity-grid { padding: 9px; }.event-entity-grid > button { grid-template-columns: 116px minmax(0,1fr) 16px; min-height: 92px; padding-right: 8px; }.event-reward-icons { display: none; }.event-entity-copy > strong { white-space: normal; }.event-entity-copy > span { -webkit-line-clamp: 1; } }
</style>
