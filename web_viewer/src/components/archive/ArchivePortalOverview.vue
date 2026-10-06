<template>
  <div class="portal-overview-scroll" data-archive-scroll-container>
    <div class="portal-overview">
      <header class="overview-toolbar">
        <div class="overview-brand">
          <button v-if="canGoBack" class="overview-icon-button" type="button" aria-label="返回来源页" data-archive-focus-id="portal-back" @click="emit('back')"><ArrowLeft :size="20" aria-hidden="true" /></button>
          <h1 id="portal-title" ref="heading" tabindex="-1">资料馆</h1>
          <span class="overview-breadcrumb-divider" aria-hidden="true">/</span>
          <button class="overview-lens-trigger" type="button" aria-label="切换资料馆视角" :aria-expanded="scopeOpen" @click="scopeOpen = true"><ArchiveIdolAvatar v-if="preferredReference?.actionable" :idol-code="preferredReference.idolCode" :size="26" decorative /><Users v-else :size="17" /><span>{{ preferredReference?.actionable ? preferredName : '全站档案' }}</span><ChevronRight :size="15" /></button>
        </div>



      <section ref="searchPanel" class="overview-search" @keydown.esc.prevent="searchOpen = false" aria-labelledby="portal-search-title">
        <h2 id="portal-search-title" class="overview-visually-hidden">搜索核心档案</h2>
        <form class="overview-search-form" role="search" @submit.prevent="searchOpen = true; emit('search', query)">
          <Search :size="21" aria-hidden="true" />
          <input id="portal-global-search" type="search" :value="query" aria-label="搜索偶像、卡片、歌曲、故事" placeholder="搜索全站档案…" autocomplete="off" aria-controls="portal-search-results" :aria-expanded="searchOpen" data-archive-focus-id="portal-search" @focus="searchOpen = true" @input="searchOpen = true; emit('search', $event.target.value)" />
          <button v-if="query" class="overview-icon-button" type="button" aria-label="清空搜索" @click="emit('search', '')"><X :size="18" aria-hidden="true" /></button>
          <button class="overview-search-submit" type="submit">搜索</button>
        </form>

        <div v-if="searchOpen" id="portal-search-results" class="overview-search-results" role="region" aria-label="搜索结果" :aria-busy="Boolean(globalSearch.loading)">
          <button class="overview-search-collapse" type="button" aria-label="收起搜索结果" @click="searchOpen = false"><X :size="16" />收起</button>
          <div v-if="quickSearchTerms.length" class="overview-search-shortcuts" aria-label="担当相关搜索"><span>相关搜索</span><button v-for="term in quickSearchTerms" :key="term" type="button" :aria-label="`搜索 ${term}`" @click="emit('search',term)">{{ term }}</button></div>
          <p v-if="globalSearch.loading" class="overview-status" role="status">正在搜索档案…</p>
          <p v-if="globalSearch.error" class="overview-error" role="status">{{ globalSearch.error }}</p>
          <template v-if="searchGroups.length">
            <p class="overview-search-total">匹配 {{ formatCount(searchResults.length) }} 条 · 每类展示最多 6 条</p>
            <section v-for="group in searchGroups" :key="group.domain" class="overview-result-group" :aria-labelledby="`portal-search-${group.domain}`">
              <header><h3 :id="`portal-search-${group.domain}`">{{ domainLabel(group.domain) }} <span>{{ formatCount(group.total) }} 条</span></h3><button type="button" :data-archive-focus-id="`portal-search-directory:${group.domain}`" @click="emit('navigate', group.domain)">查看目录<ChevronRight :size="15" aria-hidden="true" /></button></header>
              <ul>
            <li v-for="result in group.rows" :key="result.key">
              <DomainMediaPreview v-if="result.image?.url" class="overview-result-image" :binding="result.image" :name="result.label" compact />
              <span v-else class="overview-result-kind" aria-hidden="true"><component :is="archiveNavigationIcons[result.domain] || Search" :size="21" /></span>
              <button type="button" :disabled="!result.target" :data-archive-focus-id="`portal-search:${result.key}`" @click="emit('open-result', result)"><span class="overview-result-copy"><small>{{ domainLabel(result.domain) }}</small><strong>{{ result.label }}</strong><span v-if="result.subtitle">{{ result.subtitle }}</span></span><ArrowUpRight :size="18" aria-hidden="true" /></button>
            </li>
              </ul>
            </section>
          </template>
          <p v-else-if="!globalSearch.loading && !globalSearch.error" class="overview-status" role="status">{{ query.trim() ? '没有找到匹配的核心档案。试试名称或关键词。' : '搜索全站的偶像、卡片、歌曲与故事。' }}</p>
        </div>
      </section>
      <div class="overview-toolbar-actions"><slot name="toolbar" /></div>
      </header>
      <slot name="notices" />
      <!-- Scale of the archive as one line of links, not a row of number tiles. -->
      <p v-if="footprints.length" class="overview-footprint" aria-label="当前视角资料数量">
        <button v-for="count in footprints" :key="count.id" type="button" :disabled="count.value === null" :title="count.id === 'stories' ? '当前视角出场条目 / 全站可读故事条目' : '当前视角关联条目 / 全站收录条目'" @click="openDirectory(count.id)">
          <b>{{ formatCount(count.value) }}<small v-if="preferredReference?.actionable"> / {{ formatCount(count.total) }}</small></b> <span>{{ count.label }}</span>
        </button>
      </p>
      <!-- Phones have no sidebar: the archive home doubles as the index of every destination. -->
      <nav class="overview-directory" aria-label="全部栏目">
        <button v-for="item in directoryItems" :key="item.id" type="button" :data-archive-focus-id="`portal-directory:${item.id}`" @click="emit('navigate', item.id)"><component :is="archiveNavigationIcons[item.id] || ChevronRight" :size="24" aria-hidden="true" />{{ item.label }}</button>
      </nav>

      <p v-if="desktopOverview.loading" class="overview-status" role="status">正在读取门户资料…</p>
      <p v-if="desktopOverview.error" class="overview-error" role="status">{{ desktopOverview.error }}<button type="button" data-archive-focus-id="portal-overview-retry" @click="emit('retry-overview')">重试门户资料</button></p>

      <section v-if="!preferredReference?.actionable" class="overview-panel overview-unit-hub" aria-labelledby="portal-units-title">
        <header class="overview-section-heading"><h2 id="portal-units-title">找到你的组合 <small>{{ desktopOverview.units?.length }} 个组合</small></h2><button type="button" @click="emit('navigate', 'idols')">偶像目录<ChevronRight :size="16" /></button></header>
        <div class="overview-unit-matrix"><article v-for="unit in desktopOverview.units || []" :key="unit.id" class="overview-unit-tile" :style="{'--unit-color':unit.color}">
          <button type="button" class="overview-unit-logo" :aria-label="`打开组合 ${unit.title}`" :data-archive-focus-id="`portal-unit:${unit.id}`" @click="emit('open-result', unit)"><img :src="getUnitLogoUrl(unit.id)" :alt="unit.title" loading="lazy" /></button>
          <div class="overview-unit-members" :aria-label="`${unit.title}成员`"><button v-for="idol in unit.members" :key="idol.id" type="button" :aria-label="`查看${idol.name}的档案`" @click="chooseScope(idol.id)"><ArchiveIdolAvatar :idol-code="idol.id" :size="28" :ring-width="0" decorative /></button></div>
        </article></div>
      </section>
      <section class="overview-panel overview-featured" :class="{'is-all-view': !preferredReference?.actionable, 'is-w-view': birthdayTheme && ['012yus','013kys'].includes(preferredReference?.idolCode)}" :aria-labelledby="preferredReference?.actionable ? 'portal-workbench-title' : 'portal-card-preview-title'">
          <div v-if="preferredReference?.actionable" class="overview-personal" :class="{'has-portrait': activePortrait && !portraitFailed}">
            <header class="overview-identity">
              <div class="overview-portrait-slot"><img v-if="activePortrait && !portraitFailed" class="overview-idol-art" :style="{transform: birthdayTheme && preferredReference?.idolCode === '012yus' ? 'translateX(8%)' : birthdayTheme && preferredReference?.idolCode === '013kys' ? 'translateX(-12%)' : undefined}" :src="activePortrait.url" alt="" decoding="async" @error="portraitFailed = true" />
              <ArchiveIdolAvatar v-else-if="preferredReference?.actionable" :idol-code="preferredReference.idolCode" :size="88" :accent-color="preferredReference.accentColor" decorative />
              <Users v-else class="overview-all-mark" :size="76" aria-hidden="true" />
              </div><div class="overview-identity-copy">
                <p class="overview-eyebrow" :class="{'is-favorite':preferredReference?.idolCode === savedIdolCode}">{{ preferredReference?.idolCode === savedIdolCode ? '我的担当' : preferredReference?.actionable ? '偶像档案' : '全站档案' }}</p>
                <h2 id="portal-workbench-title">{{ preferredReference?.actionable ? preferredName : '每一颗星的故事' }}</h2>
                <p v-if="desktopOverview.kana" class="overview-kana">{{ desktopOverview.kana }}</p>
                <p v-if="desktopOverview.preferredUnitName" class="overview-unit-name"><img v-if="unitLogoUrl && !unitLogoFailed" :src="unitLogoUrl" :alt="desktopOverview.preferredUnitName" decoding="async" @error="unitLogoFailed = true" /><span v-else>{{ desktopOverview.preferredUnitName }}</span></p>
              </div>
            </header>
            <button v-if="desktopOverview.birthdayPortrait" class="overview-art-theme" type="button" :aria-pressed="birthdayTheme" @click="birthdayTheme = !birthdayTheme; portraitFailed=false">{{ birthdayTheme ? '生日主题 · 切换原版立绘' : '原版立绘 · 切换生日主题' }}</button>
            <button class="overview-home-action" type="button" data-archive-focus-id="portal-open-home" @click="emit('open-home', preferredReference.idolCode)">打开他的主页<ArrowUpRight :size="16" /></button>
            <nav v-if="preferredReference?.actionable" class="overview-preferred-actions" aria-label="当前偶像快捷入口"><button v-for="action in preferredActions" :key="action.id" type="button" :data-archive-focus-id="`portal-preferred:${action.id}`" @click="emit('open-preferred', {action: action.id, idolCode: preferredReference.idolCode})"><component :is="preferredActionIcons[action.id]" :size="15" aria-hidden="true" />{{ action.label }}</button></nav>
            <button v-if="preferredReference?.actionable && preferredReference.idolCode !== savedIdolCode" class="overview-save-idol" type="button" @click="emit('save-preferred', preferredReference.idolCode)">设为我的担当</button>
            <button class="overview-producer-badge" type="button" @click="emit('edit-personal')">{{ producerDisplayName }}<ArrowUpRight :size="12" /></button>
          </div>
          <div class="overview-card-showcase">
            <header class="overview-section-heading overview-card-heading"><h3 id="portal-card-preview-title">{{ preferredReference?.actionable ? '精选卡片' : '卡面探索' }}</h3><button type="button" data-archive-focus-id="portal-cards-all" @click="openDirectory('cards')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
            <button v-if="!preferredReference?.actionable" class="overview-shuffle" type="button" @click="shuffleCards">换一组卡面 <Shuffle :size="15" /></button>
            <PortalCardBento :cards="collections.cards || []" :counts="desktopOverview.cardCounts" @expand="emit('expand-cards')" :global="!preferredReference?.actionable" :offset="cardOffset" @open="emit('open-result',$event)" @filter="openDirectory('cards', $event)" />
          </div>
      </section>

      <div class="overview-content-grid" :class="{'is-global-grid':!preferredReference?.actionable}">
          <section class="overview-panel overview-music" aria-labelledby="portal-song-preview-title">
            <header class="overview-section-heading"><h2 id="portal-song-preview-title">{{ preferredReference?.actionable ? '相关歌曲' : '歌曲与舞台' }} <small>{{ collectionCount('songs') }}</small></h2><button type="button" data-archive-focus-id="portal-songs-all" @click="openDirectory('songs')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
            <div v-if="!preferredReference?.actionable" class="overview-story-tabs" role="group" aria-label="歌曲演唱范围"><button v-for="category in songCategories" :key="category.id" type="button" :aria-pressed="songCategory === category.id" @click="songCategory = category.id">{{ category.label }} <small>{{ category.count }}</small></button></div>
            <div v-if="songs.length" class="overview-song-list">
              <article v-for="song in songs" :key="song.id" class="overview-song">
                <div class="overview-song-cover"><DomainMediaPreview class="overview-song-image" :binding="song.image" :name="song.title" /></div>
                <div class="overview-song-copy"><button class="overview-song-detail" type="button" :disabled="!song.target" :data-archive-focus-id="`portal-song:${song.id}`" @click="emit('open-result', song)"><strong>{{ song.title }}</strong><small v-if="song.performerLabel">{{ song.performerLabel }}</small><small v-else-if="song.performers?.length">{{ song.performers.map(person => person.name).join('、') }}</small><small v-else-if="song.unitName">{{ song.unitName }}</small><small v-if="song.relationLabel" class="overview-relation">{{ song.relationLabel }}</small></button></div>
                <button v-if="song.stageTarget" class="overview-stage-button" type="button" :aria-label="`在舞台中打开 ${song.title}`" :title="`在舞台中打开 ${song.title}`" :data-archive-focus-id="`portal-song-stage:${song.id}`" @click="emit('open-stage', song.stageTarget)"><Play :size="15" aria-hidden="true" /><span class="overview-visually-hidden">打开舞台</span></button>
              </article>
            </div>
            <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取歌曲预览…' : '暂无可展示的歌曲预览，可前往目录查阅。' }}</p>
          </section>
        <section class="overview-panel overview-stories" aria-labelledby="portal-story-preview-title">
          <header class="overview-section-heading"><h2 id="portal-story-preview-title">{{ preferredReference?.actionable ? '出场故事' : '故事档案' }} <small>{{ preferredReference?.actionable ? collectionCount('stories') : `${readableMainCollections.length} 章` }}</small></h2><button type="button" data-archive-focus-id="portal-stories-all" @click="openDirectory('stories')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
          <div v-if="preferredReference?.actionable" class="overview-story-tabs" role="group" aria-label="故事分类"><button v-for="tab in storyTabs" :key="tab.id" type="button" :aria-pressed="storyTab === tab.id" @click="storyTab = tab.id">{{ tab.label }} <small>{{ tab.count }}</small></button></div>
          <div v-if="!preferredReference?.actionable" class="overview-story-hub">          <div class="overview-main-index"><article v-for="chapter in readableMainCollections" :key="chapter.id"><button type="button" @click="emit('open-result', chapter)"><DomainMediaPreview v-if="chapter.image" :binding="chapter.image" :name="chapter.title" /><span><strong>{{ chapter.title }}</strong><small>{{ chapter.chapterCount }} 节 · {{ chapter.episodeCount }} 话</small><ChevronRight :size="16" /></span></button></article></div><div class="overview-story-gateways"><button v-for="gateway in gateways" :key="gateway.id" type="button" @click="emit('open-result',{target:{view:'story_gateway',gateway:gateway.id}})"><component :is="gateway.icon" :size="18" /><span><strong>{{ gateway.label }}</strong><small>{{ formatCount(gatewayCount(gateway)) }} {{ gateway.unit || '篇' }}</small></span><ArrowUpRight :size="14" /></button></div></div>
          <div v-else-if="stories.length" class="overview-story-list"><article v-for="story in stories" :key="story.id" class="overview-story"><DomainMediaPreview v-if="story.image?.url" class="overview-story-image" :binding="story.image" :name="story.title" /><span v-else class="overview-story-mark" aria-hidden="true"><BookOpen :size="21" /></span><button type="button" :disabled="!story.target" :data-archive-focus-id="`portal-story:${story.id}`" @click="emit('open-result', story)"><span class="overview-story-copy"><small v-if="story.subtitle">{{ story.subtitle }}</small><strong>{{ story.title }}</strong></span><span v-if="story.cast?.length" class="overview-story-cast" role="img" :aria-label="`登场偶像：${story.cast.map(idol => idol.name).join('、')}`"><ArchiveIdolAvatar v-for="idol in story.cast.slice(0, 3)" :key="idol.id" :idol-code="idol.id" :accent-color="idol.accentColor" :size="24" :ring-width="1" :gap="1" decorative /><small v-if="story.cast.length > 3">+{{ story.cast.length - 3 }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
          <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取故事预览…' : '暂无可展示的故事预览，可前往目录查阅。' }}</p>
        </section>
        <section class="overview-panel overview-events" aria-labelledby="portal-event-preview-title">
          <header class="overview-section-heading"><h2 id="portal-event-preview-title">{{ preferredReference?.actionable ? '活动足迹' : '运营轨迹 · 315 的回忆录' }} <small>{{ collectionCount('events') }}</small></h2><button type="button" data-archive-focus-id="portal-events-all" @click="openDirectory('events')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
          <div v-if="!preferredReference?.actionable" class="overview-timeline" tabindex="0" aria-label="运营时间画卷，可横向滚动"><article v-for="(event,index) in timeline" :key="event.id"><small class="timeline-date">{{ event.timelineDate }}</small><span class="timeline-dot" aria-hidden="true"></span><button type="button" @click="emit('open-result',event)"><img :src="event.image.url" alt="" loading="lazy" /><small>{{ event.seriesLabel }}</small><strong>{{ event.title }}</strong><ArrowUpRight :size="15" /></button></article></div>
          <div v-else-if="events.length" class="overview-event-grid"><article v-for="event in events" :key="event.id" class="overview-event"><DomainMediaPreview v-if="event.image?.url" class="overview-event-image" :binding="event.image" :name="event.title" /><button type="button" :disabled="!event.target" :data-archive-focus-id="`portal-event:${event.id}`" @click="emit('open-result', event)"><span><strong>{{ event.title }}</strong><small v-if="event.subtitle">{{ event.subtitle }}</small><small v-if="event.relationLabel" class="overview-relation">{{ event.relationLabel }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
          <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取活动预览…' : '暂无可展示的活动记录，可前往目录查阅。' }}</p>
        </section>
      </div>
      <ArchiveTerminalDialog class="portal-scope-dialog" :open="scopeOpen" title="切换资料馆视角" title-id="portal-scope-title" @close="scopeOpen = false">
        <p class="overview-dialog-note">切换浏览视角不会修改已保存的担当。</p>
        <div class="overview-scope-actions"><button type="button" :aria-pressed="!preferredReference?.actionable" @click="chooseScope('')"><Users :size="18" />全站档案大厅</button><button v-if="savedIdolCode" type="button" @click="chooseScope(savedIdolCode)"><ArchiveIdolAvatar :idol-code="savedIdolCode" :size="28" decorative />我的担当 · {{ idolName(savedIdolCode, idols.find(row=>row.id===savedIdolCode)?.name) }}</button></div>
        <ArchiveIdolPickerPanel compact :idols="idols" :idol-name="idolName" :idol-search="idolSearch" :model-value="preferredReference?.idolCode || ''" @update:model-value="chooseScope" />
      </ArchiveTerminalDialog>
      <footer class="overview-footer">SideM Archive · 非官方资料存档</footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeft, ArrowUpRight, BookOpen, BriefcaseBusiness, ChevronRight, ContactRound, Layers, MessageCircle, Play, Search, Shuffle, Users, X } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { ARCHIVE_NAVIGATION_GROUPS as destinations } from '../../core/archiveNavigationGroups.js'
import PortalCardBento from './PortalCardBento.vue'
import {portalTimeline} from '../../presentation/PortalBento.js'
import {storyGateways,storyGatewayCount} from '../../presentation/StoryGateways.js'
import { getUnitLogoUrl } from '../../utils/AssetResolver.js'

const props = defineProps({
  canGoBack: Boolean,
  savedIdolCode: { type: String, default: '' },
  idols: { type: Array, default: () => [] },
  idolSearch: { type: Function, default: () => '' },
  producerDisplayName: { type: String, default: '' },
  preferredReference: { type: Object, default: null },
  idolName: { type: Function, default: () => '' },
  preferredActions: { type: Array, default: () => [] },
  desktopOverview: { type: Object, default: () => ({}) },
  globalSearch: { type: Object, default: () => ({}) },
})
const readableMainCollections = computed(() => (props.desktopOverview.mainCollections || []).filter(row => row.target && row.episodeCount > 0))
const emit = defineEmits(['back', 'open-home', 'navigate', 'edit-personal', 'open-preferred', 'search', 'open-result', 'open-directory', 'open-stage', 'retry-overview', 'select-scope', 'save-preferred', 'expand-cards'])
const searchPanel = ref(null), searchOpen = ref(false)
function closeSearchOutside(event) { if (searchPanel.value && !searchPanel.value.contains(event.target)) searchOpen.value = false }
onMounted(() => document.addEventListener('pointerdown',closeSearchOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown',closeSearchOutside))
const heading = ref(null)
defineExpose({ focusHeading: () => heading.value?.focus({ preventScroll: true }) })
const footprints = computed(() => props.desktopOverview.footprints || [])
// Phones have no sidebar: every section, in sidebar order, as one grid of icons.
const directoryItems = destinations.flatMap(group => group.items)
const scopeOpen = ref(false), storyTab = ref('all'), portraitFailed = ref(false)
const collections = computed(() => props.desktopOverview.collections || {})
const birthdayTheme=ref(false)
const activePortrait=computed(()=>birthdayTheme.value ? props.desktopOverview.birthdayPortrait : props.desktopOverview.portrait)
const gateways=storyGateways.filter(row=>row.action!=='external-resources')
function gatewayCount(gateway){return props.desktopOverview.gatewayCountsByAction?.[gateway.id] ?? storyGatewayCount(gateway,collections.value.stories || [],props.desktopOverview.gatewayCounts)}
const timeline=computed(()=>props.desktopOverview.projectionVersion ? collections.value.events || [] : portalTimeline(collections.value.events || []))
function collectionCount(id) { return formatCount(footprints.value.find(row => row.id === id)?.value) }
function chooseScope(code) { scopeOpen.value = false; emit('select-scope', code) }
function openDirectory(domain, filters = {}) {
  emit('open-directory', { domain, idolCode: props.preferredReference?.actionable ? props.preferredReference.idolCode : '', ...filters })
}
const storyTabs = computed(() => [{id:'all',label:'全部',count:props.desktopOverview.storyCounts?.all ?? (collections.value.stories || []).length},
  ...[['main','主线'],['event','活动'],['personal','个人'],['other','其他']].map(([id,label]) => ({id,label,count:props.desktopOverview.storyCounts?.[id] ?? (collections.value.stories || []).filter(row => storyGroup(row) === id).length})).filter(row => row.count)])
function storyGroup(row) { return ['main','event'].includes(row.domain) ? row.domain : ['idol_story','card_scenarios','work','birthday'].includes(row.domain) ? 'personal' : 'other' }
watch(() => props.desktopOverview.scopeId, () => { storyTab.value = 'all'; portraitFailed.value = false })
const cardOffset = ref(0)
function shuffleCards() { cardOffset.value += 1; emit('expand-cards') }
const songCategory = ref('configurable_formation')
const songCategories = computed(() => [['configurable_formation','代表曲 · 自由编成'],['fixed_unit','组合曲'],['fixed_special_lineup','特别编成'],['all','全部歌曲']].map(([id,label]) => ({id,label,count:props.desktopOverview.songCounts?.[id] ?? (collections.value.songs || []).filter(row => id==='all' || row.performanceKind === id).length})))
const songs = computed(() => props.preferredReference?.actionable ? props.desktopOverview.songs || [] : (collections.value.songs || []).filter(row => songCategory.value==='all' || row.performanceKind === songCategory.value).slice(0,songCategory.value==='configurable_formation' ? 5 : 4))
const stories = computed(() => (collections.value.stories || []).filter(row => storyTab.value === 'all' || storyGroup(row) === storyTab.value).slice(0, 4))
const events = computed(() => collections.value.events || props.desktopOverview.events || [])
const query = computed(() => props.globalSearch.query || '')
const searchResults = computed(() => props.globalSearch.results || [])
const searchGroups = computed(() => ['idols', 'cards', 'songs', 'stories'].map(domain => {
  const rows = searchResults.value.filter(result => result.domain === domain)
  return { domain, total: rows.length, rows: rows.slice(0, 6) }
}).filter(group => group.total > 0))
const preferredName = computed(() => props.idolName(props.preferredReference?.idolCode, props.preferredReference?.displayName) || props.preferredReference?.displayName || '')
const quickSearchTerms = computed(() => props.preferredReference?.actionable
  ? [...new Set([props.desktopOverview.preferredUnitName, preferredName.value].filter(value => typeof value === 'string' && value.trim()))] : [])
const preferredActionIcons = { profile: ContactRound, story: BookOpen, cards: Layers, work: BriefcaseBusiness, mobile: MessageCircle }
const unitLogoUrl = computed(() => props.desktopOverview.preferredUnitCode ? getUnitLogoUrl(props.desktopOverview.preferredUnitCode) : '')
const unitLogoFailed = ref(false)
watch(unitLogoUrl, () => { unitLogoFailed.value = false })
function formatCount(value) { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN') : '—' }
function domainLabel(domain) { return { cards: '卡片', songs: '歌曲', idols: '偶像', stories: '故事' }[domain] || '档案' }
</script>

<style scoped>
.portal-overview-scroll { position:relative;z-index:2;width:100%;height:100%;min-height:0;overflow:auto;padding:var(--gs-space-7) var(--gs-space-8) var(--gs-space-9);scrollbar-width:thin; }
.portal-overview { --portal-accent:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 36%,#13232d);--portal-tint:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 7%,#fff);--portal-line:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 15%,#dce4e6);--portal-muted:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 15%,#68777a);container-type:inline-size;width:min(1200px,100%);min-width:0;margin:0 auto;color:#283d43;font-family:var(--gs-font-directory);font-size:var(--gs-text-ui);line-height:1.6; }
.portal-overview *, .portal-overview-scroll { box-sizing:border-box; }
.portal-overview button, .portal-overview input { font:inherit; }
.portal-overview button { cursor:pointer; }
.portal-overview button:disabled { cursor:default;color:#687f78; }
.portal-overview button:focus-visible, .portal-overview input:focus-visible, .portal-overview :deep(.domain-media-preview button:focus-visible) { outline:var(--gs-focus-ring) solid var(--portal-accent);outline-offset:var(--gs-focus-offset); }
.overview-toolbar, .overview-brand, .overview-toolbar-actions { display:flex;align-items:center;gap:var(--gs-space-4); }
.overview-toolbar { justify-content:space-between;min-height:44px;gap:var(--gs-space-5); }
.overview-brand { flex:none;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);letter-spacing:-.03em; }
.overview-brand b { font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);letter-spacing:.12em;margin-left:var(--gs-space-2); }
.overview-toolbar-actions { flex-wrap:wrap;justify-content:flex-end;gap:var(--gs-space-1); }
.overview-toolbar-actions :deep(.archive-language-switch) { border:0;padding:0;background:transparent; }
.overview-icon-button { display:grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border:0;border-radius:var(--gs-radius-field);background:transparent;color:var(--portal-accent); }
.overview-brand h1 { margin:0;padding-left:14px;border-left:1px solid var(--portal-line);font-size:var(--gs-text-section);line-height:1.3;font-weight:700;letter-spacing:-.02em; }
.overview-brand h1:focus { outline:none; }
.overview-search { position:relative;margin-bottom:var(--gs-space-4); }
.overview-search-form { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;min-height:56px;padding:4px 6px 4px 16px;border:1px solid var(--portal-line);border-radius:12px;background:#ffffffed;color:var(--portal-accent);box-shadow:0 6px 24px #26394709; }
.overview-search-form:focus-within { border-color:var(--portal-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--portal-idol-color) 12%,transparent); }
.overview-search-form > svg { flex:none; }
.overview-search-form input { flex:1;min-width:0;height:44px;padding:var(--gs-space-3) 0;border:0;background:transparent;color:inherit;font-size:var(--gs-text-subtitle); }
.overview-search-form input::placeholder { color:var(--portal-muted); }
.overview-search-form input::-webkit-search-cancel-button { display:none; }
.overview-search-submit { min-height:44px;padding:var(--gs-space-3) var(--gs-space-6);border:0;border-radius:var(--gs-radius-field);background:var(--portal-accent);color:#fff;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-search-form .overview-icon-button { border:0;background:transparent; }
.overview-search-shortcuts { display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:4px;color:var(--portal-muted);font-size:var(--gs-text-meta); }
.overview-search-shortcuts > button { display:flex;align-items:center;min-height:36px;padding:4px 12px;border:1px solid color-mix(in srgb,var(--portal-line) 60%,transparent);border-radius:999px;background:#ffffff70;color:var(--portal-accent);overflow-wrap:anywhere;text-align:left; }
.overview-search-results { position:absolute;z-index:12;left:0;right:0;top:60px;max-height:min(560px,calc(100dvh - 200px));overflow:auto;overscroll-behavior:contain;box-shadow:0 12px 32px #1c34452b;margin-top:0;padding:var(--gs-space-3) var(--gs-space-5);border:1px solid var(--portal-line);border-radius:var(--gs-radius-panel);background:#fffffff2; }
.overview-search-collapse {display:flex;align-items:center;gap:4px;min-height:36px;margin-left:auto;padding:4px 8px;border:0;border-radius:8px;background:transparent;color:var(--portal-muted);}
.overview-search-results ul { list-style:none;padding:0;margin:0; }
.overview-search-total { margin:var(--gs-space-3) 0;color:#6f8477;font-size:var(--gs-text-meta); }
.overview-result-group + .overview-result-group { border-top:1px solid #dfe9e2;margin-top:var(--gs-space-3);padding-top:var(--gs-space-3); }
.overview-result-group > header { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-4); }
.overview-result-group h3 { margin:0;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold); }
.overview-result-group h3 > span { margin-left:var(--gs-space-3);color:#768b7c;font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-result-group > header > button { display:flex;align-items:center;gap:var(--gs-space-2);min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:var(--portal-accent);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-search-results li { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-3) 0; }
.overview-search-results li + li { border-top:1px solid #edf2ee; }
.overview-search-results li > button { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-5);flex:1;min-width:0;min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-result-copy { display:grid;min-width:0; }
.overview-result-copy small { font-size:var(--gs-text-meta);color:#688777; }
.overview-result-copy strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);overflow-wrap:anywhere; }
.overview-result-copy > span { color:#6d8077;font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-search-results li > button > svg { flex:none; }
.overview-result-kind { display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:var(--gs-radius-field);background:var(--portal-tint);color:var(--portal-accent); }
.overview-panel { min-width:0;margin-top:var(--gs-space-section);padding-top:var(--gs-space-7);border-top:1px solid var(--gs-line); }
.overview-featured { display:grid;grid-template-columns:minmax(280px,32%) minmax(0,1fr);gap:var(--gs-space-7); }
.overview-personal, .overview-card-showcase { min-width:0; }
.overview-personal { position:relative;align-self:stretch;display:flex;flex-direction:column;justify-content:center; }
.overview-card-showcase { width:100%;max-width:none;padding-left:24px;border-left:1px solid color-mix(in srgb,var(--portal-idol-color) 10%,#dce4e660); }
.overview-eyebrow { color:var(--portal-accent);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold); }
.overview-section-heading { display:flex;justify-content:space-between;align-items:center;gap:var(--gs-space-4);margin-bottom:var(--gs-space-4); }
.overview-section-heading h2 { margin:0;font-size:var(--gs-text-section);line-height:1.4;font-weight:var(--gs-weight-bold); }
.overview-section-heading > button { display:flex;align-items:center;gap:var(--gs-space-2);flex:none;min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:var(--portal-accent);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-identity { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0; }
/* Only the named copy grows. The shared avatar root remains a square circle. */
.overview-identity-copy { min-width:0; }
.overview-identity-copy h2 { font-size:var(--gs-text-title);line-height:1.3;overflow-wrap:anywhere; }
.overview-preferred-actions { display:flex;flex-wrap:wrap;align-items:center;gap:6px; }
.overview-preferred-actions button { display:flex;align-items:center;gap:6px;min-height:44px;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:var(--portal-accent);font-size:var(--gs-text-meta);font-weight:500; }
.overview-card-heading { margin-bottom:10px; }
.overview-card-heading h3 { margin:0;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-song-list { display:grid;grid-template-columns:1fr;gap:0; }
.overview-song { display:flex;align-items:center;gap:10px;min-width:0;padding:10px 0; }
.overview-song + .overview-song { border-top:1px solid #edf1ed; }
.overview-song-copy { flex:1;min-width:0; }
.overview-song-detail { display:grid;gap:4px;width:100%;min-width:0;min-height:44px;padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-song strong { font-size:var(--gs-text-ui);line-height:1.45;font-weight:600;overflow-wrap:anywhere; }
.overview-song small { font-size:var(--gs-text-meta);color:var(--portal-muted);overflow-wrap:anywhere; }
.overview-song-detail > svg { flex:none;color:#739884; }
.overview-song-cover { position:relative;flex:none;width:64px; }
.overview-stage-button { display:grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border:1px solid var(--portal-line);border-radius:50%;background:#ffffff70;color:var(--portal-accent); }
.overview-song-image, .overview-story-image, .overview-event-image { display:flex;position:relative;align-items:center;justify-content:center;margin:0;padding:var(--gs-space-2);border:0;border-radius:var(--gs-radius-field);background:var(--portal-tint); }
/* Every card uses the same portrait frame; bound pixels retain their own ratio. */
.overview-song-image { flex:none;width:64px;height:64px;box-shadow:0 2px 6px #2538430a; }
.overview-story-image { flex:none;width:44px;height:44px; }
.overview-event-image { flex:none;width:128px;height:72px;aspect-ratio:16 / 9;margin:0; }
.overview-song-image:deep(img), .overview-story-image:deep(img), .overview-event-image:deep(img) { display:block;width:auto;height:auto;max-width:100%;max-height:100%;min-height:0;object-fit:contain;margin:0; }
.overview-song-image:deep(.domain-resource-empty), .overview-story-image:deep(.domain-resource-empty), .overview-event-image:deep(.domain-resource-empty) { display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:var(--gs-space-3);min-height:0;width:100%;height:100%;margin:0;background:transparent;color:#6e887b;font-size:var(--gs-text-meta); }
.overview-song-image:deep(.domain-resource-empty span), .overview-story-image:deep(.domain-resource-empty span), .overview-song-image:deep(figcaption), .overview-story-image:deep(figcaption) { display:none; }
.overview-event-image:deep(figcaption) { position:absolute;inset:auto var(--gs-space-3) var(--gs-space-2);margin:0;color:#688273;font-size:var(--gs-text-meta); }
.portal-overview :deep(.domain-media-preview button) { min-height:44px;padding:var(--gs-space-2) var(--gs-space-3);border:1px solid var(--portal-line);border-radius:var(--gs-radius-control);background:#fff;color:var(--portal-accent);font-size:var(--gs-text-ui); }
.overview-song-image:deep(button), .overview-story-image:deep(button) { width:44px;padding:0;font-size:var(--gs-text-meta); }
.overview-content-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:20px;align-items:stretch; }
.overview-events { grid-column:1 / -1; }
.overview-story-list { display:grid; }
.overview-unit-name { display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0;color:var(--portal-muted);font-size:var(--gs-text-meta); }
.overview-unit-name > img { flex:none;width:48px;height:28px;object-fit:contain; }
.overview-story { display:flex;align-items:center;gap:12px;min-width:0;padding-block:10px; }
.overview-story-mark { display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:8px;background:var(--portal-tint);color:var(--portal-accent); }
.overview-story + .overview-story { border-top:1px solid #e5ece5; }
.overview-story > button, .overview-event > button { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-4);width:100%;min-width:0;min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-story > button > span, .overview-event > button > span { display:grid;gap:var(--gs-space-2);min-width:0; }
.overview-story-copy { flex:1; }
.overview-story > button > .overview-story-cast { display:flex;align-items:center;gap:0;flex:none; }
.overview-story-cast :deep(.idol-avatar-shell + .idol-avatar-shell) { margin-left:-5px; }
.overview-story .overview-story-cast > small { display:grid;place-items:center;min-width:26px;height:24px;margin-left:4px;padding-inline:4px;border:1px solid var(--portal-line);border-radius:999px;background:var(--portal-tint);color:var(--portal-accent);font-size:var(--gs-text-meta);font-variant-numeric:tabular-nums; }
.overview-story strong, .overview-event strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.5;overflow-wrap:anywhere; }
.overview-story small, .overview-event small { color:#708278;font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-story > button > svg, .overview-event > button > svg { flex:none;color:var(--portal-accent); }
.overview-event-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px; }
.overview-event { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-4) 0;border-top:1px solid var(--gs-line); }
.overview-status, .overview-error, .overview-empty { margin:0;padding:var(--gs-space-4) 0;color:#6b8274;font-size:var(--gs-text-ui); }
.overview-error { color:#875a40; }
.overview-error > button { min-height:44px;margin-left:var(--gs-space-4);padding:var(--gs-space-2) var(--gs-space-3);border:1px solid #dbc9bd;border-radius:var(--gs-radius-control);background:#fff;color:inherit;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-footer { margin-top:var(--gs-space-6);padding:var(--gs-space-5) 0;color:#829387;font-size:var(--gs-text-meta); }
.overview-footprint { display:flex;flex-wrap:wrap;gap:var(--gs-space-2) var(--gs-space-6);margin:var(--gs-space-5) 0 0;color:var(--gs-ink-3);font-size:var(--gs-text-ui); }
.overview-footprint button { min-height:var(--gs-control-compact);padding:0;border:0;background:none;color:inherit; }
.overview-footprint b { margin-right:var(--gs-space-2);color:var(--gs-ink);font-family:var(--gs-font-stage);font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);font-variant-numeric:tabular-nums; }
.overview-footprint button:hover b { color:var(--gs-mint-ink); }
.overview-directory { display:none; }
@media (max-width:760px) {
  /* The stats as four equal columns, number over label. (The header rows live in portal-bento.css.) */
  .overview-footprint { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin-top:var(--gs-space-5);border-block:1px solid var(--gs-line); }
  .overview-footprint button { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;padding:var(--gs-space-3) 2px;text-align:center; }
  .overview-footprint button + button { border-left:1px solid var(--gs-line); }
  .overview-footprint b { margin:0;font-size:var(--gs-text-subtitle);line-height:1.2;white-space:nowrap; }
  .overview-footprint b small { color:var(--gs-ink-3);font-family:var(--gs-font-body);font-size:var(--gs-text-caption);font-weight:var(--gs-weight-regular); }
  .overview-footprint span { color:var(--gs-ink-3);font-size:var(--gs-text-meta);white-space:nowrap; }
  /* Every section as one grid of icons. */
  .overview-directory { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gs-space-1) 0;margin-top:var(--gs-space-4); }
  .overview-directory button { display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;min-height:var(--gs-control-touch);padding:var(--gs-space-3) 0;border:0;border-radius:var(--gs-radius-control);background:none;color:var(--gs-ink);font-size:var(--gs-text-ui); }
  .overview-directory button svg { color:var(--gs-mint-ink); }
}
.overview-visually-hidden { position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap; }
@media (hover:hover) and (pointer:fine) {
  .overview-icon-button:hover, .overview-search-shortcuts > button:hover, .overview-preferred-actions button:hover { background:var(--portal-tint); }
  .overview-stage-button:hover { border-color:var(--portal-accent);background:var(--portal-accent);color:#fff; }
  .overview-section-heading > button:hover, .overview-song-detail:hover, .overview-search-results li > button:hover, .overview-story > button:hover, .overview-event > button:hover { color:var(--portal-accent); }
  .overview-search-submit:hover { background:color-mix(in srgb,var(--portal-accent) 88%,#000); }
}
.portal-overview button:active { background-color:var(--portal-tint); }
.portal-overview .overview-search-submit:active { background-color:color-mix(in srgb,var(--portal-accent) 80%,#000); }
@media (pointer:coarse) {
  .overview-search-shortcuts > button { min-height:44px; }
}
@container (max-width:900px) {
  .overview-featured { grid-template-columns:1fr;gap:18px; }
  .overview-card-showcase { max-width:none;padding:10px 0 0;border-left:0;border-top:1px solid color-mix(in srgb,var(--portal-idol-color) 10%,#dce4e660); }
  .overview-preferred-actions button { padding-inline:8px; }
  .overview-event-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@container (max-width:650px) {
  .overview-content-grid { grid-template-columns:1fr; }
  .overview-personal { display:flex; }
}
@media(max-width:900px) {
  .portal-overview-scroll { padding:16px; }
  .overview-toolbar { align-items:start; }
  .overview-brand b { display:none; }
}
/* The view controller, typography and original art share the existing GS palette. */
.overview-brand h1 { border:0;padding:0;font-size:var(--gs-text-title); }
.overview-scope-bar { display:flex;align-items:center;gap:12px;min-width:0;margin:16px 0 12px; }
.overview-scope-trigger { display:flex;align-items:center;gap:10px;flex:none;min-height:52px;padding:6px 12px;border:1px solid var(--portal-line);border-radius:12px;background:#ffffffd9;color:var(--portal-accent); }
.overview-scope-trigger > span { display:flex;align-items:baseline;gap:10px; }
.overview-scope-trigger small { flex:none;white-space:nowrap;color:var(--portal-muted);font-size:var(--gs-text-meta); }
.overview-scope-trigger strong { font-size:var(--gs-text-subtitle);font-weight:650; }
.overview-scope-reset,.overview-save-idol { min-height:44px;padding:6px 10px;border:0;border-radius:8px;background:transparent;color:var(--portal-accent);font-size:var(--gs-text-meta); }
.overview-scope-note { margin-left:auto;color:var(--portal-muted);font-size:var(--gs-text-meta); }
.overview-identity { position:relative;min-height:190px;gap:12px; }
.overview-idol-art { position:absolute;left:-20px;bottom:-5px;width:75%;height:270px;object-fit:contain;object-position:left bottom;pointer-events:none;filter:drop-shadow(0 6px 10px #26384312); }
.overview-identity-copy { position:relative;z-index:1; }
.has-portrait .overview-identity-copy { margin-left:48%;padding:12px 0 12px 10px;border-radius:10px;background:linear-gradient(90deg,#ffffff00,#ffffffce 30%,#ffffff85); }
.overview-identity-copy h2 { margin:8px 0 6px;font-size:var(--gs-text-title);line-height:1.25;font-weight:650; }
.overview-kana { margin:0 0 12px;font-size:var(--gs-text-meta);color:var(--portal-muted); }
.overview-unit-name > img { width:min(120px,100%);height:40px; }
.overview-preferred-actions { position:relative;z-index:1;gap:2px;justify-content:space-between;margin-top:12px;padding:3px;border:1px solid #ffffff9c;border-radius:12px;background:#ffffffc9; }
.overview-preferred-actions button { gap:4px;padding:4px 5px;font-size:var(--gs-text-meta); }
.overview-save-idol { align-self:flex-start;margin-top:4px;padding-left:0; }
.overview-section-heading h2 > small { margin-left:6px;color:var(--portal-muted);font-size:var(--gs-text-meta);font-weight:500; }
.overview-story-tabs { display:flex;flex-wrap:wrap;gap:4px;margin:-6px 0 4px; }
.overview-story-tabs button { min-height:36px;padding:4px 10px;border:0;border-radius:999px;background:transparent;color:var(--portal-muted);font-size:var(--gs-text-meta); }
.overview-story-tabs button[aria-pressed=true] { color:var(--portal-accent);background:var(--portal-tint);box-shadow:inset 0 0 0 1px var(--portal-line); }
.overview-story-tabs small { margin-left:3px;font-variant-numeric:tabular-nums; }
.overview-song { min-height:100px; }
.overview-story { min-height:80px; }
.overview-relation { display:inline-flex;width:fit-content;padding:1px 6px;border-radius:5px;background:var(--portal-tint);color:var(--portal-accent)!important;font-size:var(--gs-text-meta)!important; }
.overview-dialog-note { margin:0 0 12px;color:var(--portal-muted);font-size:var(--gs-text-ui); }
@media(hover:hover) and (pointer:fine) {
  .overview-scope-reset:hover,.overview-save-idol:hover,.overview-story-tabs button:hover { background:var(--portal-tint); }
}
@container(max-width:1050px) {
  .overview-event-grid { grid-template-columns:1fr; }
  .overview-event-image { width:160px;height:90px; }
  .overview-scope-note { display:none; }
}
@container(max-width:900px) {
  .overview-featured { grid-template-columns:minmax(250px,38%) minmax(0,1fr);gap:16px; }
  .overview-card-showcase { padding:0 0 0 16px;border-top:0;border-left:1px solid var(--portal-line); }
  .overview-idol-art { height:240px; }
  .overview-identity-copy h2 { font-size:var(--gs-text-section); }
  .overview-preferred-actions { flex-wrap:wrap;justify-content:flex-start; }
}
@container(max-width:720px) {
  .overview-featured { grid-template-columns:1fr; }
  .overview-personal { min-height:260px; }
  .overview-identity { min-height:190px; }
  .overview-idol-art { width:50%;height:250px;left:0; }
  .has-portrait .overview-identity-copy { margin-left:45%; }
  .overview-preferred-actions { justify-content:center; }
  .overview-card-showcase { padding:16px 0 0;border-left:0;border-top:1px solid var(--portal-line); }
  .overview-content-grid { grid-template-columns:1fr; }
}

.overview-segment {display:flex;max-width:100%;min-width:0;gap:3px;padding:4px;border:1px solid var(--portal-line);border-radius:12px;background:#ffffffa8;}
.overview-segment > button {display:flex;min-width:0;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border:0;border-radius:8px;background:transparent;color:var(--portal-muted);white-space:nowrap;}
.overview-segment > button:first-child,.overview-segment > button > svg,.overview-segment :deep(.idol-avatar-shell) {flex:none;}
.overview-segment > button > span {min-width:0;overflow:hidden;text-overflow:ellipsis;}
.overview-segment > button[aria-pressed=true] {background:var(--portal-accent);color:#fff;box-shadow:0 2px 6px #213e421a;}
.overview-identity {display:grid;grid-template-columns:minmax(0,42%) minmax(0,1fr);gap:12px;min-height:210px;}
.overview-portrait-slot {height:210px;min-width:0;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;}
.overview-idol-art {position:static;flex:none;width:auto;max-width:none;height:210px;object-fit:contain;object-position:center bottom;mask-image:linear-gradient(#000 85%,transparent);-webkit-mask-image:linear-gradient(#000 85%,transparent);}
.has-portrait .overview-identity-copy {margin:0;padding:0;background:transparent;}
.overview-home-action,.overview-shuffle {display:flex;align-items:center;gap:8px;min-height:36px;width:fit-content;padding:4px 10px;border:1px solid var(--portal-line);border-radius:8px;background:#ffffffa8;color:var(--portal-accent);}
.overview-home-action {margin:6px 0 12px;align-self:flex-end;}
.overview-shuffle {margin:0 0 12px auto;}
.overview-featured.is-all-view {grid-template-columns:1fr;}
.overview-featured.is-w-view {grid-template-columns:minmax(340px,38%) minmax(0,1fr);}
.is-w-view .overview-identity {grid-template-columns:minmax(0,58%) minmax(0,1fr);}
@container(max-width:900px){.overview-featured.is-w-view {grid-template-columns:1fr;}}

.overview-unit-matrix {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
.overview-unit-tile {position:relative;min-width:0;height:100px;border-radius:var(--gs-radius-media);}
.overview-unit-logo {display:grid;place-items:center;width:100%;height:100%;padding:12px 18px 30px;border:0;border-radius:inherit;background:transparent;}
.overview-unit-logo img {width:100%;height:100%;max-width:150px;object-fit:contain;}
.overview-unit-members {position:absolute;bottom:4px;left:0;right:0;display:flex;justify-content:center;gap:4px;}
.overview-unit-members button {border:0;background:transparent;padding:0;border-radius:50%;}
@media(hover:hover) and (pointer:fine){.overview-unit-members {opacity:0;pointer-events:none;}.overview-unit-tile:hover .overview-unit-members,.overview-unit-tile:focus-within .overview-unit-members {opacity:1;pointer-events:auto;}.overview-unit-tile:hover {background:var(--portal-tint);}}
.overview-main-index {display:grid;gap:12px;}
.overview-main-index article {display:grid;grid-template-columns:110px minmax(0,1fr);min-height:84px;border-radius:var(--gs-radius-media);overflow:hidden;}
.overview-main-index button {display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:84px;padding:10px 14px;border:0;background:transparent;color:inherit;text-align:left;}
.overview-main-index small {flex-basis:100%;color:var(--portal-muted);}
.overview-main-index article:has(button:disabled) {grid-template-columns:1fr;opacity:.6;}
@container(max-width:760px){.overview-unit-matrix {gap:6px;}.overview-unit-tile {height:84px;}.overview-segment > button {padding:8px;font-size:var(--gs-text-meta);}.overview-identity {grid-template-columns:minmax(0,42%) minmax(0,1fr);}.overview-identity-copy h2 {font-size:var(--gs-text-title);}}
@media(prefers-reduced-motion:reduce){.portal-overview * {transition:none!important;animation:none!important;}}
</style>
<style scoped src="./portal-bento.css"></style>
