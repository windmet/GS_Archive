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
      <section class="overview-panel overview-featured" :class="{'is-all-view': !preferredReference?.actionable}" :aria-labelledby="preferredReference?.actionable ? 'portal-workbench-title' : 'portal-card-preview-title'">
          <div v-if="preferredReference?.actionable" class="overview-personal" :class="{'has-portrait': activePortrait && !portraitFailed}" :style="heroStyle">
            <header class="overview-identity">
              <div class="overview-portrait-slot"><span class="overview-signature" aria-hidden="true"></span><img v-if="activePortrait && !portraitFailed" class="overview-idol-art" :src="activePortrait.url" alt="" decoding="async" @error="portraitFailed = true" />
              <ArchiveIdolAvatar v-else-if="preferredReference?.actionable" :idol-code="preferredReference.idolCode" :size="88" :accent-color="preferredReference.accentColor" decorative />
              <Users v-else class="overview-all-mark" :size="76" aria-hidden="true" />
              </div><div class="overview-identity-copy">
                <p class="overview-eyebrow" :class="{'is-favorite':preferredReference?.idolCode === savedIdolCode}">{{ preferredReference?.idolCode === savedIdolCode ? '我的担当' : preferredReference?.actionable ? '偶像档案' : '全站档案' }}</p>
                <h2 id="portal-workbench-title">{{ preferredReference?.actionable ? preferredName : '每一颗星的故事' }}</h2>
                <p v-if="desktopOverview.kana" class="overview-kana">{{ desktopOverview.kana }}</p>
                <p v-if="desktopOverview.preferredUnitName" class="overview-unit-name"><img v-if="unitLogoUrl && !unitLogoFailed" :src="unitLogoUrl" :alt="desktopOverview.preferredUnitName" decoding="async" @error="unitLogoFailed = true" /><span v-else>{{ desktopOverview.preferredUnitName }}</span></p>
              </div>
            </header>
            <button class="overview-home-action" type="button" data-archive-focus-id="portal-open-home" @click="emit('open-home', preferredReference.idolCode)">进入主页<ChevronRight :size="16" aria-hidden="true" /></button>
            <nav v-if="preferredReference?.actionable" class="overview-preferred-actions" aria-label="当前偶像快捷入口"><button v-for="action in preferredActions" :key="action.id" type="button" :data-archive-focus-id="`portal-preferred:${action.id}`" @click="emit('open-preferred', {action: action.id, idolCode: preferredReference.idolCode})"><component :is="preferredActionIcons[action.id]" :size="15" aria-hidden="true" />{{ action.label }}</button></nav>
            <!-- Quiet settings for this hero, as one caption line under the shortcuts. -->
            <p class="overview-personal-meta">
              <button v-if="preferredReference?.actionable && preferredReference.idolCode !== savedIdolCode" class="overview-save-idol" type="button" @click="emit('save-preferred', preferredReference.idolCode)">设为我的担当</button>
              <button class="overview-producer-badge" type="button" @click="emit('edit-personal')">{{ producerDisplayName }}<ArrowUpRight :size="12" /></button>
            </p>
          </div>
          <div class="overview-card-showcase">
            <header class="overview-section-heading overview-card-heading"><h3 id="portal-card-preview-title">{{ preferredReference?.actionable ? '精选卡片' : '卡面探索' }}</h3><span class="overview-heading-actions"><button v-if="!preferredReference?.actionable" class="overview-shuffle" type="button" @click="shuffleCards">换一组<Shuffle :size="15" aria-hidden="true" /></button><button type="button" data-archive-focus-id="portal-cards-all" @click="openDirectory('cards')">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></span></header>
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
          <div v-if="!preferredReference?.actionable" class="overview-story-hub">          <div class="overview-main-index"><article v-for="chapter in readableMainCollections" :key="chapter.id"><button type="button" @click="emit('open-result', chapter)"><DomainMediaPreview v-if="chapter.image" :binding="chapter.image" :name="chapter.title" /><span><strong>{{ chapterLabel(chapter.title) }}</strong><small>{{ chapter.chapterCount }} 节 · {{ chapter.episodeCount }} 话</small><ChevronRight :size="16" /></span></button></article></div><div class="overview-story-gateways"><button v-for="gateway in gateways" :key="gateway.id" type="button" @click="emit('open-result',{target:{view:'story_gateway',gateway:gateway.id}})"><component :is="gateway.icon" :size="18" /><span><strong>{{ gateway.label }}</strong><small>{{ formatCount(gatewayCount(gateway)) }} {{ gateway.unit || '篇' }}</small></span><ArrowUpRight :size="14" /></button></div></div>
          <div v-else-if="stories.length" class="overview-story-list"><article v-for="story in stories" :key="story.id" class="overview-story"><DomainMediaPreview v-if="story.image?.url" class="overview-story-image" :binding="story.image" :name="story.title" /><span v-else class="overview-story-mark" aria-hidden="true"><BookOpen :size="21" /></span><button type="button" :disabled="!story.target" :data-archive-focus-id="`portal-story:${story.id}`" @click="emit('open-result', story)"><span class="overview-story-copy"><small v-if="story.subtitle">{{ storySubtitle(story.subtitle) }}</small><strong :class="{ 'is-title-pending': storyTitle.pending() }">{{ storyTitle(story.id, story.title) }}</strong></span><span v-if="story.cast?.length" class="overview-story-cast" role="img" :aria-label="`登场偶像：${story.cast.map(idol => idol.name).join('、')}`"><ArchiveIdolAvatar v-for="idol in story.cast.slice(0, 3)" :key="idol.id" :idol-code="idol.id" :accent-color="idol.accentColor" :size="24" :ring-width="1" :gap="1" decorative /><small v-if="story.cast.length > 3">+{{ story.cast.length - 3 }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
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
      <footer class="overview-footer">SideM Archive · 非官方资料存档 · <button type="button" class="overview-footer-link" @click="emit('navigate', 'about')">关于本站</button></footer>
    </div>
  </div>
</template>

<script setup>
import { chapterLabel } from '../../presentation/chapterLabel.js'
import { useStoryTitles } from './useReaderTitles.js'
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
import { getCharaSignUrl, getUnitLogoUrl } from '../../utils/AssetResolver.js'
import { idolStageLight } from '../../presentation/idolStageLight.js'
import idolVisualFocus from '../../presentation/idolVisualFocus.json'

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
// Story rows carry only their file: the title comes from the Reader title index when one is bound,
// and "主线剧情 · 第5話" shows its chapter word in the reader's language.
const storyTitle = useStoryTitles()
const storySubtitle = text => String(text || '').split(' · ').map(chapterLabel).join(' · ')
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
const activePortrait=computed(()=>props.desktopOverview.portrait)
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
// The 担当 hero on phones: the idol's light wash, ink and light (idolStageLight keeps every colour
// readable), the autograph behind the figure, and the figure placed by where the person stands in the
// picture (idolVisualFocus) rather than by the picture's edge.
const HERO_FIGURE_HEIGHT = 300
const heroStyle = computed(() => {
  if (!props.preferredReference?.actionable) return undefined
  const light = idolStageLight(props.preferredReference.accentColor)
  const portrait = activePortrait.value
  const focus = portrait ? idolVisualFocus.focusX[portrait.url] ?? 0.5 : 0.5
  const width = portrait?.width && portrait?.height ? HERO_FIGURE_HEIGHT * portrait.width / portrait.height : HERO_FIGURE_HEIGHT * 0.66
  return {
    '--hero-wash': light?.wash, '--hero-ink': light?.ink, '--hero-light': light?.light,
    '--hero-sign': `url(${getCharaSignUrl(props.preferredReference.idolCode)})`,
    '--hero-figure-left': `calc(76% - ${Math.round(focus * width)}px)`,
  }
})
const unitLogoFailed = ref(false)
watch(unitLogoUrl, () => { unitLogoFailed.value = false })
function formatCount(value) { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN') : '—' }
function domainLabel(domain) { return { cards: '卡片', songs: '歌曲', idols: '偶像', stories: '故事' }[domain] || '档案' }
</script>

<style scoped>
/* A title still waiting for its translation keeps its place but stays hidden (no Japanese flash). */
.is-title-pending { visibility:hidden; }
/* The archive portal on the programme layout. One stylesheet, one order: base, toolbar and search,
   the footprint and the phone directory, the 担当 hero and featured cards, then the sections.
   Sections sit on the paper under a heading and a rule; only controls, the search popover and the
   art carry a surface. Component layout follows the page's own width (container portal); the
   viewport tiers decide only the shell-level rows (toolbar, phone directory). */
.portal-overview-scroll { position:relative;z-index:2;width:100%;height:100%;min-height:0;overflow:auto;padding:var(--gs-space-7) var(--gs-space-8) var(--gs-space-9);scrollbar-width:thin; }
.portal-overview {
  --portal-accent:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 36%,var(--gs-ink));
  --portal-tint:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 7%,var(--gs-surface));
  --portal-line:color-mix(in srgb,var(--portal-idol-color,var(--gs-mint)) 15%,var(--gs-line));
  container:portal / inline-size;width:min(1200px,100%);min-width:0;margin:0 auto;color:var(--gs-ink);font-family:var(--gs-font-directory);font-size:var(--gs-text-ui);line-height:1.6;
}
.portal-overview *, .portal-overview-scroll { box-sizing:border-box; }
.portal-overview button, .portal-overview input { font:inherit; }
.portal-overview button { cursor:pointer; }
.portal-overview button:disabled { cursor:default;color:var(--gs-ink-3); }
.portal-overview button:focus-visible, .portal-overview input:focus-visible, .portal-overview :deep(.domain-media-preview button:focus-visible) { outline:var(--gs-focus-ring) solid var(--gs-mint);outline-offset:var(--gs-focus-offset); }
.overview-visually-hidden { position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap; }

/* Toolbar: 资料馆 / scope · search · tools. */
.overview-toolbar { display:grid;grid-template-columns:auto minmax(180px,1fr) auto;align-items:center;gap:var(--gs-space-4);min-height:var(--gs-control-touch); }
.overview-brand { display:flex;align-items:center;gap:var(--gs-space-3);min-width:0; }
.overview-brand h1 { margin:0;font-size:var(--gs-text-section);font-weight:var(--gs-weight-bold);line-height:1.3;white-space:nowrap; }
.overview-brand h1:focus { outline:none; }
.overview-breadcrumb-divider { color:var(--gs-ink-3); }
.overview-icon-button { display:grid;place-items:center;flex:none;width:var(--gs-control-touch);height:var(--gs-control-touch);padding:0;border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-2); }
.overview-lens-trigger { display:flex;align-items:center;gap:var(--gs-space-3);min-width:0;min-height:var(--gs-control-toolbar);padding:0 var(--gs-space-3);border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink);font-size:var(--gs-text-body);font-weight:var(--gs-weight-semibold); }
.overview-lens-trigger span { max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.overview-lens-trigger > svg:last-child { color:var(--gs-ink-3); }
.overview-toolbar-actions { display:flex;align-items:center;justify-content:flex-end;gap:var(--gs-space-1); }
.overview-toolbar-actions :deep(.archive-language-switch) { border:0;padding:0;background:transparent; }

.overview-search { position:relative;justify-self:end;width:100%;max-width:420px;min-width:0; }
.overview-search-form { display:flex;align-items:center;gap:var(--gs-space-3);min-width:0;min-height:var(--gs-control-touch);padding:2px 2px 2px var(--gs-space-4);border:1px solid var(--gs-line);border-radius:var(--gs-radius-field);background:var(--gs-surface);color:var(--gs-ink-3); }
.overview-search-form:focus-within { border-color:var(--gs-selected-line); }
.overview-search-form > svg { flex:none;width:17px; }
.overview-search-form input { flex:1;min-width:0;height:38px;padding:0;border:0;background:transparent;color:var(--gs-ink);font-size:var(--gs-text-ui); }
.overview-search-form input:focus-visible { outline:none; }
.overview-search-form input::placeholder { color:var(--gs-ink-3); }
.overview-search-form input::-webkit-search-cancel-button { display:none; }
.overview-search-form .overview-icon-button { width:32px;height:38px; }
.overview-search-submit { min-height:38px;padding:0 var(--gs-space-4);border:0;border-radius:6px;background:var(--gs-action-bg);color:var(--gs-action-ink);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-search-results { position:absolute;z-index:12;top:52px;right:0;width:min(620px,calc(100cqw - 24px));max-height:min(560px,calc(100dvh - 160px));overflow:auto;overscroll-behavior:contain;padding:var(--gs-space-3) var(--gs-space-5);border-radius:var(--gs-radius-panel);background:var(--gs-surface);box-shadow:var(--gs-shadow-float); }
.overview-search-collapse { display:flex;align-items:center;gap:var(--gs-space-2);min-height:var(--gs-control-normal);margin-left:auto;padding:0 var(--gs-space-3);border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-3); }
.overview-search-shortcuts { display:flex;flex-wrap:wrap;align-items:center;gap:var(--gs-space-3);margin:var(--gs-space-3) 0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-search-shortcuts > button { min-height:var(--gs-control-compact);padding:0 var(--gs-space-4);border:1px solid var(--gs-line);border-radius:var(--gs-radius-pill);background:var(--gs-surface);color:var(--gs-ink-2);font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-search-total { margin:var(--gs-space-3) 0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-search-results ul { margin:0;padding:0;list-style:none; }
.overview-result-group + .overview-result-group { margin-top:var(--gs-space-3);padding-top:var(--gs-space-3);border-top:1px solid var(--gs-line); }
.overview-result-group > header { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-4); }
.overview-result-group h3 { margin:0;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold); }
.overview-result-group h3 > span { margin-left:var(--gs-space-3);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-result-group > header > button { display:flex;align-items:center;gap:var(--gs-space-2);min-height:var(--gs-control-touch);padding:0;border:0;background:transparent;color:var(--gs-mint-ink);font-size:var(--gs-text-ui); }
.overview-search-results li { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-3) 0; }
.overview-search-results li + li { border-top:1px solid var(--gs-line); }
.overview-search-results li > button { display:flex;flex:1;align-items:center;justify-content:space-between;gap:var(--gs-space-5);min-width:0;min-height:var(--gs-control-touch);padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-search-results li > button > svg { flex:none;color:var(--gs-ink-3); }
.overview-result-copy { display:grid;min-width:0; }
.overview-result-copy small, .overview-result-copy > span { color:var(--gs-ink-3);font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-result-copy strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);overflow-wrap:anywhere; }
.overview-result-kind { display:grid;place-items:center;flex:none;width:var(--gs-control-touch);height:var(--gs-control-touch);color:var(--gs-ink-3); }

/* Footprint: one line of counts that open their directories. */
.overview-footprint { display:flex;flex-wrap:wrap;gap:var(--gs-space-2) var(--gs-space-6);margin:var(--gs-space-4) 0 0;color:var(--gs-ink-3);font-size:var(--gs-text-ui); }
.overview-footprint button { min-height:var(--gs-control-compact);padding:0;border:0;background:none;color:inherit; }
.overview-footprint b { margin-right:var(--gs-space-2);color:var(--gs-ink);font-family:var(--gs-font-stage);font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);font-variant-numeric:tabular-nums; }
.overview-footprint b small { color:var(--gs-ink-3);font-family:var(--gs-font-body);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-directory { display:none; }

.overview-status, .overview-error, .overview-empty { margin:0;padding:var(--gs-space-4) 0;color:var(--gs-ink-3);font-size:var(--gs-text-ui); }
.overview-error { color:#875a40; }
.overview-error > button { min-height:var(--gs-control-touch);margin-left:var(--gs-space-4);padding:0 var(--gs-space-4);border:1px solid var(--gs-line);border-radius:var(--gs-radius-control);background:var(--gs-surface);color:inherit;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }

/* Sections: heading and count on one baseline over a rule, the directory link at the end. */
.overview-panel { min-width:0;margin-top:var(--gs-space-section); }
.overview-section-heading { display:flex;align-items:baseline;justify-content:space-between;gap:var(--gs-space-4);margin-bottom:var(--gs-space-4);padding-bottom:var(--gs-space-3);border-bottom:1px solid var(--gs-rule); }
.overview-section-heading h2, .overview-section-heading h3 { margin:0;font-size:var(--gs-text-section);font-weight:var(--gs-weight-semibold);line-height:1.4; }
.overview-section-heading h2 > small { margin-left:var(--gs-space-3);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-section-heading button, .overview-heading-actions { display:flex;flex:none;align-items:center;gap:var(--gs-space-2); }
.overview-section-heading button { min-height:var(--gs-control-compact);padding:0;border:0;background:transparent;color:var(--gs-mint-ink);font-size:var(--gs-text-ui); }
.overview-heading-actions { gap:var(--gs-space-5); }
.overview-section-heading .overview-shuffle { color:var(--gs-ink-2); }

/* Featured: the 担当 hero beside the featured cards. */
.overview-featured { display:grid;grid-template-columns:minmax(300px,30%) minmax(0,1fr);gap:var(--gs-space-8);margin-top:var(--gs-space-7); }
.overview-featured.is-all-view { grid-template-columns:minmax(0,1fr); }
.overview-unit-hub + .overview-featured { margin-top:var(--gs-space-section); }
.overview-personal, .overview-card-showcase { min-width:0; }
.overview-personal { position:relative;display:flex;flex-direction:column;gap:var(--gs-space-3); }
/* The hero is artwork: the idol's light wash, the autograph in the idol's ink behind the figure,
   the figure placed by where the person stands. It gets the media radius and nothing else. */
.overview-identity { position:relative;height:228px;overflow:hidden;border-radius:var(--gs-radius-media);background:radial-gradient(circle at 76% 62%,var(--gs-surface) 0,var(--hero-wash,var(--gs-paper)) 58%); }
.overview-identity::before { content:'';position:absolute;inset:0 0 auto;z-index:3;height:3px;background:var(--hero-light,var(--gs-mint)); }
.overview-portrait-slot { position:absolute;inset:0; }
.overview-idol-art { position:absolute;left:var(--hero-figure-left,40%);bottom:-40px;z-index:2;width:auto;max-width:none;height:300px;object-fit:contain;mask-image:linear-gradient(#000 85%,transparent);-webkit-mask-image:linear-gradient(#000 85%,transparent); }
.overview-signature { position:absolute;top:10px;right:12px;z-index:1;display:block;width:250px;height:232px;opacity:.28;background:var(--hero-ink,var(--gs-ink-3));-webkit-mask:var(--hero-sign) center/contain no-repeat;mask:var(--hero-sign) center/contain no-repeat;mask-mode:luminance; }
.overview-identity-copy { position:relative;z-index:3;display:flex;flex-direction:column;width:170px;padding:var(--gs-space-6) var(--gs-space-5); }
.overview-eyebrow { order:0;margin:0;color:var(--hero-ink,var(--gs-ink-3));font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold); }
.overview-unit-name { order:1;display:flex;align-items:center;margin:var(--gs-space-3) 0 0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-unit-name > img { width:auto;max-width:112px;height:28px;object-fit:contain;object-position:left center; }
.overview-identity-copy h2 { order:2;margin:6px 0 4px;font-size:var(--gs-text-section);font-weight:var(--gs-weight-bold);line-height:1.25;overflow-wrap:anywhere; }
.overview-kana { order:3;margin:0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
/* The way home sits on the art like the player's controls: a surface pill. */
.overview-home-action { position:absolute;top:176px;left:var(--gs-space-5);z-index:4;display:inline-flex;align-items:center;gap:2px;min-height:var(--gs-control-compact);padding:0 var(--gs-space-4);border:0;border-radius:var(--gs-radius-pill);background:color-mix(in srgb, var(--gs-surface) 88%, transparent);color:var(--gs-ink);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);box-shadow:var(--gs-shadow-float); }
/* Shortcuts: this idol's five archive pages, the main way on from the hero. They sit on a band of
   the hero's own wash with icons in the idol's ink (idolStageLight keeps both readable), so they
   read as part of the 担当 block and stand out from the quiet line below. */
.overview-preferred-actions { display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding:var(--gs-space-1);border-radius:var(--gs-radius-media);background:color-mix(in srgb,var(--hero-wash,var(--gs-mint-wash)) 75%,var(--gs-surface)); }
.overview-preferred-actions button { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--gs-space-1);min-height:52px;padding:var(--gs-space-2) 0;border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink);font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold); }
.overview-preferred-actions button svg { width:18px;height:18px;color:var(--hero-ink,var(--gs-mint-ink)); }
/* Quiet settings: 设为担当 and the producer — one caption line, separated by dots. */
.overview-personal-meta { display:flex;flex-wrap:wrap;align-items:center;gap:0 var(--gs-space-2);margin:0;padding-top:var(--gs-space-3);border-top:1px solid var(--gs-line);color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-personal-meta:empty { display:none; }
.overview-personal-meta button { display:inline-flex;align-items:center;gap:2px;min-height:var(--gs-control-compact);padding:0;border:0;background:none;color:var(--gs-ink-2);font-size:var(--gs-text-meta); }
.overview-personal-meta button + button::before { content:'·';margin-right:var(--gs-space-2);color:var(--gs-ink-3); }
.overview-personal-meta .overview-save-idol { color:var(--gs-mint-ink);font-weight:var(--gs-weight-semibold); }

/* Global view: the unit matrix, in each unit's own colour. */
.overview-unit-hub { margin-top:var(--gs-space-7); }
.overview-unit-matrix { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gs-space-3); }
.overview-unit-tile { position:relative;container:unit-tile / inline-size;min-width:0;height:100px;overflow:hidden;border-radius:var(--gs-radius-media);background:color-mix(in srgb,var(--unit-color) 12%,var(--gs-surface)); }
.overview-unit-logo { display:grid;place-items:center;width:100%;height:100%;padding:10px 12px 40px;border:0;border-radius:inherit;background:transparent; }
.overview-unit-logo img { width:100%;height:100%;max-width:118px;object-fit:contain; }
.overview-unit-members { position:absolute;right:0;bottom:8px;left:0;display:flex;justify-content:center;gap:3px; }
.overview-unit-members button { padding:0;border:0;border-radius:50%;background:transparent; }
/* Members sit side by side while they fit; a narrow tile with four or more overlaps them. */
@container unit-tile (max-width:150px) {
  .overview-unit-members { --idol-avatar-override-size:24px; }
  .overview-unit-members:has(> :nth-child(4)) { gap:0;--idol-avatar-override-size:22px; }
  .overview-unit-members:has(> :nth-child(4)) button + button { margin-left:-6px; }
  .overview-unit-members:has(> :nth-child(4)) button { box-shadow:0 0 0 1.5px color-mix(in srgb,var(--unit-color) 12%,var(--gs-surface)); }
}

/* Content sections. */
.overview-content-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-8); }
.overview-events { grid-column:1 / -1; }
.is-global-grid { grid-template-columns:minmax(0,1fr); }
.is-global-grid .overview-stories { grid-row:1; }

/* Filter chips: stories by kind, songs by lineup. One scrolling row. */
.overview-story-tabs { display:flex;gap:var(--gs-space-3);overflow-x:auto;margin:0 0 var(--gs-space-2);padding:var(--gs-space-1) 0;scrollbar-width:none; }
.overview-story-tabs button { flex:none;min-height:var(--gs-control-compact);padding:0 var(--gs-space-4);border:1px solid var(--gs-line);border-radius:var(--gs-radius-pill);background:var(--gs-surface);color:var(--gs-ink-2);font-size:var(--gs-text-meta);white-space:nowrap; }
.overview-story-tabs button[aria-pressed=true] { border-color:var(--gs-selected-line);background:var(--gs-selected-bg);color:var(--gs-selected-ink); }
.overview-story-tabs small { margin-left:var(--gs-space-2);color:inherit;opacity:.75;font-variant-numeric:tabular-nums; }

/* Rows: picture, title and one line of meta, split by hairlines; the whole row opens. */
.overview-song-list, .overview-story-list { display:grid; }
.overview-song, .overview-story { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-4) 0;border-bottom:1px solid var(--gs-line); }
.overview-song-cover { flex:none; }
.overview-song-copy { flex:1;min-width:0; }
.overview-song-detail { display:grid;gap:2px;width:100%;min-width:0;min-height:var(--gs-control-touch);padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-song strong, .overview-story strong, .overview-event strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.5;overflow-wrap:anywhere; }
.overview-song small, .overview-story small, .overview-event small { color:var(--gs-ink-3);font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
/* Relation labels are meta, not badges. */
.overview-relation { color:var(--gs-ink-2) !important; }
.overview-stage-button { display:grid;flex:none;place-items:center;width:var(--gs-control-touch);height:var(--gs-control-touch);padding:0;border:0;border-radius:var(--gs-radius-control);background:transparent;color:var(--gs-ink-2); }
.overview-song-image, .overview-story-image, .overview-event-image { position:relative;display:flex;flex:none;align-items:center;justify-content:center;margin:0;padding:0;border:0;border-radius:var(--gs-radius-media);overflow:hidden;background:var(--gs-line); }
.overview-song-image { width:56px;height:56px; }
.overview-story-image { width:44px;height:44px; }
.overview-event-image { width:128px;height:72px; }
.overview-song-image:deep(img), .overview-story-image:deep(img), .overview-event-image:deep(img) { display:block;width:100%;height:100%;margin:0;object-fit:cover; }
.overview-song-image:deep(.domain-resource-empty), .overview-story-image:deep(.domain-resource-empty), .overview-event-image:deep(.domain-resource-empty) { display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0;margin:0;background:transparent;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-song-image:deep(.domain-resource-empty span), .overview-story-image:deep(.domain-resource-empty span), .overview-song-image:deep(figcaption), .overview-story-image:deep(figcaption) { display:none; }
.overview-event-image:deep(figcaption) { position:absolute;inset:auto var(--gs-space-3) var(--gs-space-2);margin:0;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.portal-overview :deep(.domain-media-preview button) { min-height:var(--gs-control-touch);padding:0 var(--gs-space-3);border:1px solid var(--gs-line);border-radius:var(--gs-radius-control);background:var(--gs-surface);color:var(--gs-ink-2);font-size:var(--gs-text-ui); }
.overview-song-image:deep(button), .overview-story-image:deep(button) { width:var(--gs-control-touch);padding:0;font-size:var(--gs-text-meta); }
.overview-story-mark { display:grid;flex:none;place-items:center;width:44px;height:44px;color:var(--gs-ink-3); }
.overview-story > button, .overview-event > button { display:flex;flex:1;align-items:center;justify-content:space-between;gap:var(--gs-space-4);min-width:0;min-height:var(--gs-control-touch);padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-story > button > span, .overview-event > button > span { display:grid;gap:2px;min-width:0; }
.overview-story-copy { flex:1; }
.overview-story > button > svg, .overview-event > button > svg { flex:none;color:var(--gs-ink-3); }
.overview-story > button > .overview-story-cast { display:flex;flex:none;align-items:center;gap:0; }
.overview-story-cast :deep(.idol-avatar-shell + .idol-avatar-shell) { margin-left:-5px; }
.overview-story .overview-story-cast > small { margin-left:var(--gs-space-2);color:var(--gs-ink-3);font-size:var(--gs-text-meta);font-variant-numeric:tabular-nums; }
.overview-event-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:var(--gs-space-6); }
.overview-event { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-4) 0;border-bottom:1px solid var(--gs-line); }

/* Global stories: the main chapters as picture tiles (no frame), the other kinds as rows. */
.overview-story-hub { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gs-space-8); }
.overview-main-index { display:grid;align-content:start;gap:var(--gs-space-6); }
.overview-main-index button { display:block;width:100%;padding:0;border:0;background:none;color:inherit;text-align:left; }
.overview-main-index article :deep(.domain-media-preview) { display:block;margin:0;padding:0; }
.overview-main-index article :deep(img) { display:block;width:100%;height:auto;aspect-ratio:906 / 210;object-fit:cover;border-radius:var(--gs-radius-media); }
.overview-main-index article :deep(figcaption) { display:none; }
.overview-main-index button > span { display:flex;flex-wrap:wrap;align-items:baseline;gap:0 var(--gs-space-3);padding-top:var(--gs-space-3); }
.overview-main-index strong { font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold); }
.overview-main-index small { flex:1;color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-main-index button > span > svg { align-self:center;color:var(--gs-ink-3); }
.overview-main-index article:has(button:disabled) { opacity:.6; }
.overview-story-gateways { display:grid;align-content:start;border-top:1px solid var(--gs-line); }
.overview-story-gateways button { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;min-height:56px;padding:0 var(--gs-space-2);border:0;border-bottom:1px solid var(--gs-line);background:none;color:var(--gs-ink);text-align:left; }
.overview-story-gateways button > svg { flex:none;color:var(--gs-ink-3); }
.overview-story-gateways button > span { display:flex;flex:1;align-items:center;justify-content:space-between;gap:var(--gs-space-3);min-width:0; }
.overview-story-gateways strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);white-space:nowrap; }
.overview-story-gateways small { color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.is-global-grid .overview-song-list { grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--gs-space-8); }

/* Global events: a horizontal timeline of banners. */
.overview-timeline { display:flex;gap:var(--gs-space-5);overflow-x:auto;padding:var(--gs-space-1) 0 var(--gs-space-4);scroll-snap-type:x proximity;scrollbar-width:thin; }
.overview-timeline article { position:relative;flex:1 0 210px;max-width:300px;min-width:0;scroll-snap-align:start; }
.overview-timeline article::before { content:'';position:absolute;top:33px;right:calc(-1 * var(--gs-space-5));left:0;height:1px;background:var(--gs-line); }
.overview-timeline article:last-child::before { right:0; }
.timeline-date { display:block;margin-bottom:22px;color:var(--gs-ink);font-family:var(--gs-font-stage);font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);font-variant-numeric:tabular-nums; }
.timeline-dot { position:absolute;top:30px;left:0;width:8px;height:8px;border-radius:50%;background:var(--gs-mint); }
.overview-timeline button { position:relative;display:grid;align-content:start;gap:var(--gs-space-2);width:100%;padding:0;border:0;background:none;color:inherit;text-align:left; }
.overview-timeline img { width:100%;height:auto;aspect-ratio:2 / 1;object-fit:contain;border-radius:var(--gs-radius-media); }
.overview-timeline button > small { color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-timeline strong { font-size:var(--gs-text-ui);line-height:1.5;overflow-wrap:anywhere; }
.overview-timeline button > svg { justify-self:end;color:var(--gs-ink-3); }

/* Scope dialog and footer. */
.overview-dialog-note { margin:0 0 var(--gs-space-4);color:var(--gs-ink-3);font-size:var(--gs-text-ui); }
.overview-scope-actions { display:grid;grid-template-columns:1fr 1fr;gap:var(--gs-space-4);margin-bottom:var(--gs-space-5); }
.overview-scope-actions button { display:flex;align-items:center;justify-content:center;gap:var(--gs-space-3);min-height:52px;border:1px solid var(--gs-line);border-radius:var(--gs-radius-control);background:var(--gs-surface);color:var(--gs-ink);font:inherit; }
.overview-scope-actions button[aria-pressed=true] { border-color:var(--gs-selected-line);background:var(--gs-selected-bg);color:var(--gs-selected-ink); }
.overview-footer { margin-top:var(--gs-space-section);padding:var(--gs-space-5) 0;border-top:1px solid var(--gs-line);color:var(--gs-ink-3);font-size:var(--gs-text-meta); }
.overview-footer-link { min-height:var(--gs-control-touch);padding:0;border:0;background:none;color:var(--gs-mint-ink);font:inherit;text-decoration:underline;text-underline-offset:3px; }

@media (hover:hover) and (pointer:fine) {
  .overview-icon-button:hover, .overview-lens-trigger:hover { background:var(--gs-mint-wash); }
  .overview-preferred-actions button:hover { background:color-mix(in srgb, var(--gs-surface) 70%, transparent); }
  .overview-search-submit:hover { background:color-mix(in srgb,var(--gs-action-bg) 88%,var(--gs-chrome)); }
  .overview-section-heading button:hover, .overview-personal-meta button:hover, .overview-search-results li > button:hover,
  .overview-story-gateways button:hover strong, .overview-main-index button:hover strong { color:var(--gs-mint-ink); }
  .overview-song-detail:hover strong, .overview-story > button:hover strong, .overview-event > button:hover strong, .overview-timeline button:hover strong { color:var(--gs-mint-ink); }
  .overview-stage-button:hover, .overview-home-action:hover { color:var(--gs-mint-ink); }
  .overview-unit-tile:hover { background:color-mix(in srgb,var(--unit-color) 20%,var(--gs-surface)); }
}

/* Narrow page (the shell's middle tier or a phone): the hero spans the row above the cards. */
@container portal (max-width:980px) {
  .overview-featured { grid-template-columns:minmax(0,1fr);gap:var(--gs-space-section); }
  .overview-personal { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:var(--gs-space-3) var(--gs-space-7); }
  .overview-identity { grid-row:1 / span 2; }
  .overview-content-grid { grid-template-columns:minmax(0,1fr); }
  .overview-event-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .overview-story-hub { grid-template-columns:minmax(0,1fr);gap:var(--gs-space-6); }
}
@container portal (max-width:640px) {
  .overview-personal { display:flex;align-items:stretch; }
  .overview-unit-matrix { grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gs-space-2); }
  .overview-unit-tile { height:84px; }
  .overview-event-grid, .is-global-grid .overview-song-list { grid-template-columns:minmax(0,1fr); }
  .overview-event-image { width:112px;height:63px; }
  .overview-scope-actions { grid-template-columns:minmax(0,1fr); }
  .overview-section-heading h2, .overview-section-heading h3 { font-size:var(--gs-text-subtitle); }
}

/* Shell tiers. Middle and phone: tighter gutters, the search on its own row. */
@media (max-width:1100px) {
  .portal-overview-scroll { padding:var(--gs-space-5); }
  .overview-toolbar { grid-template-columns:minmax(0,1fr) auto; }
  .overview-toolbar-actions { grid-column:2;grid-row:1; }
  .overview-toolbar > .overview-search { grid-column:1 / -1;grid-row:2;max-width:none; }
}
/* Phones have no sidebar: 资料馆 and the tools share the first row, the scope chip the second, then
   the search, then the index of every section. */
@media (max-width:760px) {
  .portal-overview-scroll { padding:var(--gs-space-4) var(--gs-space-4) var(--gs-space-8); }
  .overview-toolbar { grid-template-columns:auto minmax(0,1fr) auto;row-gap:var(--gs-space-2); }
  .overview-brand { display:contents; }
  .overview-breadcrumb-divider { display:none; }
  .overview-toolbar-actions { grid-column:3;grid-row:1; }
  .overview-lens-trigger { grid-column:1 / -1;grid-row:2;justify-self:start;max-width:100%;border:1px solid var(--gs-line);border-radius:var(--gs-radius-pill);background:var(--gs-surface); }
  .overview-lens-trigger span { max-width:none; }
  .overview-toolbar > .overview-search { grid-row:3; }
  .overview-search-results { width:100%; }
  /* Counts are links: two rows of two, each a full touch target, numbers aligned in a column. */
  .overview-footprint { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 var(--gs-space-5);font-size:var(--gs-text-meta); }
  .overview-footprint button { display:flex;align-items:baseline;min-width:0;min-height:var(--gs-control-touch);text-align:left;white-space:nowrap; }
  .overview-footprint b { font-size:var(--gs-text-subtitle); }
  /* The archive tab is the index of every section: all of them, in sidebar order, visible at once
     as a compact grid between two hairlines — no tiles, neutral icons, labels always shown. */
  .overview-directory { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:var(--gs-space-4) 0 0;padding:var(--gs-space-2) 0;border-block:1px solid var(--gs-line); }
  .overview-directory button { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--gs-space-2);min-width:0;min-height:60px;padding:var(--gs-space-2) 0;border:0;border-radius:var(--gs-radius-control);background:none;color:var(--gs-ink);font-size:var(--gs-text-ui); }
  .overview-directory button svg { width:22px;height:22px;color:var(--gs-ink-2); }
  .overview-directory button:active { background:var(--gs-mint-wash); }
  .overview-panel { margin-top:var(--gs-space-8); }
  .overview-featured { margin-top:var(--gs-space-6); }
  .overview-story-tabs button, .overview-search-shortcuts > button, .overview-personal-meta button, .overview-section-heading button { min-height:var(--gs-control-touch); }
}
@media (prefers-reduced-motion:reduce) { .portal-overview * { transition:none !important;animation:none !important; } }
</style>
