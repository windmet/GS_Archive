<template>
  <div class="portal-overview-scroll" data-archive-scroll-container>
    <div class="portal-overview">
      <header class="overview-toolbar">
        <div class="overview-brand">
          <button v-if="canGoBack" class="overview-icon-button" type="button" aria-label="返回来源页" data-archive-focus-id="portal-back" @click="emit('back')"><ArrowLeft :size="20" aria-hidden="true" /></button>
          <h1 id="portal-title" ref="heading" tabindex="-1">资料馆 <span class="overview-title-view">· {{ preferredReference?.actionable ? '担当档案' : '全站档案' }}</span></h1>
        </div>
        <div class="overview-toolbar-actions"><slot name="toolbar" /></div>
      </header>

      <div class="overview-explorer">
      <div class="overview-scope-bar">
        <button class="overview-scope-trigger" type="button" aria-label="切换资料馆视角" :aria-expanded="scopeOpen" @click="scopeOpen = true">
          <ArchiveIdolAvatar v-if="preferredReference?.actionable" :idol-code="preferredReference.idolCode" :size="30" :accent-color="preferredReference.accentColor" decorative />
          <Users v-else :size="24" aria-hidden="true" />
          <span><small>当前视角</small><strong>{{ preferredReference?.actionable ? preferredName : '全体偶像' }}</strong></span><ChevronRight :size="16" aria-hidden="true" />
        </button>
        <button v-if="preferredReference?.actionable" class="overview-scope-reset" type="button" @click="emit('select-scope', '')">全站视角</button>
        <button v-else-if="savedIdolCode" class="overview-scope-reset" type="button" @click="emit('select-scope', savedIdolCode)">回到我的担当</button>
        <span class="overview-scope-note">{{ preferredReference?.actionable ? '卡片、歌曲、故事与活动，沿着他的足迹探索。' : '浏览全体偶像的卡片、歌曲、故事与活动。' }}</span>
      </div>

      <slot name="notices" />

      <section class="overview-search" aria-labelledby="portal-search-title">
        <h2 id="portal-search-title" class="overview-visually-hidden">搜索核心档案</h2>
        <form class="overview-search-form" role="search" @submit.prevent="emit('search', query)">
          <Search :size="21" aria-hidden="true" />
          <input id="portal-global-search" type="search" :value="query" aria-label="搜索偶像、卡片、歌曲、故事" placeholder="搜索全站：偶像、卡片、歌曲、故事" autocomplete="off" data-archive-focus-id="portal-search" @input="emit('search', $event.target.value)" />
          <button v-if="query" class="overview-icon-button" type="button" aria-label="清空搜索" @click="emit('search', '')"><X :size="18" aria-hidden="true" /></button>
          <button class="overview-search-submit" type="submit">搜索</button>
        </form>
        <div v-if="quickSearchTerms.length" class="overview-search-shortcuts" aria-label="担当相关搜索"><span>快捷搜索</span><button v-for="term in quickSearchTerms" :key="term" type="button" :aria-label="`搜索 ${term}`" @click="emit('search', term)">{{ term }}</button></div>
        <div v-if="query.trim()" class="overview-search-results" :aria-busy="Boolean(globalSearch.loading)">
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
          <p v-else-if="!globalSearch.loading && !globalSearch.error" class="overview-status" role="status">没有找到匹配的核心档案。试试名称或关键词。</p>
        </div>
      </section>

      </div>
      <nav class="overview-counts" aria-label="当前视角资料数量">
        <button v-for="count in footprints" :key="count.id" type="button" :disabled="count.value === null" :title="count.id === 'stories' ? '当前视角出场条目 / 全站可读故事条目' : '当前视角关联条目 / 全站收录条目'" :aria-label="`${count.label} ${formatCount(count.value)}，查看全部`" @click="collectionOpen = count.id">
          <component :is="archiveNavigationIcons[count.id]" :size="17" aria-hidden="true" />
          <span><strong>{{ formatCount(count.value) }}</strong><small v-if="preferredReference?.actionable"> / {{ formatCount(count.total) }}</small></span><span class="overview-count-label">{{ count.label }}</span>
        </button>
      </nav>

      <p v-if="desktopOverview.loading" class="overview-status" role="status">正在读取门户资料…</p>
      <p v-if="desktopOverview.error" class="overview-error" role="status">{{ desktopOverview.error }}<button type="button" data-archive-focus-id="portal-overview-retry" @click="emit('retry-overview')">重试门户资料</button></p>

      <section class="overview-panel overview-featured" aria-labelledby="portal-workbench-title">
          <div class="overview-personal" :class="{'has-portrait': desktopOverview.portrait && !portraitFailed}">
            <header class="overview-identity">
              <img v-if="desktopOverview.portrait && !portraitFailed" class="overview-idol-art" :src="desktopOverview.portrait.url" alt="" decoding="async" @error="portraitFailed = true" />
              <ArchiveIdolAvatar v-else-if="preferredReference?.actionable" :idol-code="preferredReference.idolCode" :size="88" :accent-color="preferredReference.accentColor" decorative />
              <Users v-else class="overview-all-mark" :size="76" aria-hidden="true" />
              <div class="overview-identity-copy">
                <p class="overview-eyebrow">{{ preferredReference?.idolCode === savedIdolCode ? '我的担当' : preferredReference?.actionable ? '偶像档案' : '315 STARS' }}</p>
                <h2 id="portal-workbench-title">{{ preferredReference?.actionable ? preferredName : '每一颗星的故事' }}</h2>
                <p v-if="desktopOverview.kana" class="overview-kana">{{ desktopOverview.kana }}</p>
                <p v-if="desktopOverview.preferredUnitName" class="overview-unit-name"><img v-if="unitLogoUrl && !unitLogoFailed" :src="unitLogoUrl" :alt="desktopOverview.preferredUnitName" decoding="async" @error="unitLogoFailed = true" /><span v-else>{{ desktopOverview.preferredUnitName }}</span></p>
              </div>
            </header>
            <nav v-if="preferredReference?.actionable" class="overview-preferred-actions" aria-label="当前偶像快捷入口"><button v-for="action in preferredActions" :key="action.id" type="button" :data-archive-focus-id="`portal-preferred:${action.id}`" @click="emit('open-preferred', {action: action.id, idolCode: preferredReference.idolCode})"><component :is="preferredActionIcons[action.id]" :size="15" aria-hidden="true" />{{ action.label }}</button></nav>
            <button v-if="preferredReference?.actionable && preferredReference.idolCode !== savedIdolCode" class="overview-save-idol" type="button" @click="emit('save-preferred', preferredReference.idolCode)">设为我的担当</button>
            <button v-else class="overview-save-idol" type="button" @click="emit('edit-personal')">{{ producerDisplayName }} · 工作台设置</button>
          </div>
          <div class="overview-card-showcase">
            <header class="overview-section-heading overview-card-heading"><h3 id="portal-card-preview-title">{{ preferredReference?.actionable ? '精选卡片' : '卡片档案' }}</h3><button type="button" data-archive-focus-id="portal-cards-all" @click="collectionOpen = 'cards'">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
            <div v-if="cards.length" class="overview-card-grid">
              <article v-for="card in cards" :key="card.id" class="overview-card">
                <div class="overview-card-art"><DomainMediaPreview class="overview-card-image" :binding="card.image" :name="card.title" /><span v-if="card.rarity" class="overview-rarity" :class="{ 'is-ssr': card.rarity === 'SSR' }">{{ card.rarity }}</span><button v-if="card.target && card.image?.url" class="overview-card-art-link" type="button" :aria-label="`打开卡片 ${card.title}`" :data-archive-focus-id="`portal-card-art:${card.id}`" @click="emit('open-result', card)"></button></div>
                <div v-if="card.idolName && !preferredReference?.actionable" class="overview-card-meta"><span>{{ card.idolName }}</span></div>
                <button type="button" :disabled="!card.target" :data-archive-focus-id="`portal-card:${card.id}`" @click="emit('open-result', card)"><strong>{{ card.title }}</strong><ArrowUpRight :size="16" aria-hidden="true" /></button>
              </article>
            </div>
            <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取卡片预览…' : '暂无可展示的卡片预览，可前往目录查阅。' }}</p>
          </div>
      </section>

      <div class="overview-content-grid">
          <section class="overview-panel overview-music" aria-labelledby="portal-song-preview-title">
            <header class="overview-section-heading"><h2 id="portal-song-preview-title">{{ preferredReference?.actionable ? '相关歌曲' : '歌曲与舞台' }} <small>{{ collectionCount('songs') }}</small></h2><button type="button" data-archive-focus-id="portal-songs-all" @click="collectionOpen = 'songs'">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
            <div v-if="songs.length" class="overview-song-list" :class="{'is-short-list': (desktopOverview.collections?.songs?.length || 0) <= 4}">
              <article v-for="song in songs" :key="song.id" class="overview-song">
                <div class="overview-song-cover"><DomainMediaPreview class="overview-song-image" :binding="song.image" :name="song.title" /></div>
                <div class="overview-song-copy"><button class="overview-song-detail" type="button" :disabled="!song.target" :data-archive-focus-id="`portal-song:${song.id}`" @click="emit('open-result', song)"><strong>{{ song.title }}</strong><small v-if="song.performers?.length">{{ song.performers.map(person => person.name).join('、') }}</small><small v-else-if="song.unitName">{{ song.unitName }}</small><small v-if="song.relationLabel" class="overview-relation">{{ song.relationLabel }}</small></button></div>
                <button v-if="song.stageTarget" class="overview-stage-button" type="button" :aria-label="`在舞台中打开 ${song.title}`" :title="`在舞台中打开 ${song.title}`" :data-archive-focus-id="`portal-song-stage:${song.id}`" @click="emit('open-stage', song.stageTarget)"><Play :size="15" aria-hidden="true" /><span class="overview-visually-hidden">打开舞台</span></button>
              </article>
            </div>
            <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取歌曲预览…' : '暂无可展示的歌曲预览，可前往目录查阅。' }}</p>
          </section>
        <section class="overview-panel overview-stories" aria-labelledby="portal-story-preview-title">
          <header class="overview-section-heading"><h2 id="portal-story-preview-title">{{ preferredReference?.actionable ? '出场故事' : '故事档案' }} <small>{{ collectionCount('stories') }}</small></h2><button type="button" data-archive-focus-id="portal-stories-all" @click="collectionOpen = 'stories'">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
          <div class="overview-story-tabs" role="group" aria-label="故事分类"><button v-for="tab in storyTabs" :key="tab.id" type="button" :aria-pressed="storyTab === tab.id" @click="storyTab = tab.id">{{ tab.label }} <small>{{ tab.count }}</small></button></div>
          <div v-if="stories.length" class="overview-story-list"><article v-for="story in stories" :key="story.id" class="overview-story"><DomainMediaPreview v-if="story.image?.url" class="overview-story-image" :binding="story.image" :name="story.title" /><span v-else class="overview-story-mark" aria-hidden="true"><BookOpen :size="21" /></span><button type="button" :disabled="!story.target" :data-archive-focus-id="`portal-story:${story.id}`" @click="emit('open-result', story)"><span class="overview-story-copy"><small v-if="story.subtitle">{{ story.subtitle }}</small><strong>{{ story.title }}</strong></span><span v-if="story.cast?.length" class="overview-story-cast" role="img" :aria-label="`登场偶像：${story.cast.map(idol => idol.name).join('、')}`"><ArchiveIdolAvatar v-for="idol in story.cast.slice(0, 3)" :key="idol.id" :idol-code="idol.id" :accent-color="idol.accentColor" :size="24" :ring-width="1" :gap="1" decorative /><small v-if="story.cast.length > 3">+{{ story.cast.length - 3 }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
          <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取故事预览…' : '暂无可展示的故事预览，可前往目录查阅。' }}</p>
        </section>
        <section class="overview-panel overview-events" aria-labelledby="portal-event-preview-title">
          <header class="overview-section-heading"><h2 id="portal-event-preview-title">{{ preferredReference?.actionable ? '活动足迹' : '活动记录' }} <small>{{ collectionCount('events') }}</small></h2><button type="button" data-archive-focus-id="portal-events-all" @click="collectionOpen = 'events'">查看全部<ChevronRight :size="16" aria-hidden="true" /></button></header>
          <div v-if="events.length" class="overview-event-grid"><article v-for="event in events" :key="event.id" class="overview-event"><DomainMediaPreview v-if="event.image?.url" class="overview-event-image" :binding="event.image" :name="event.title" /><button type="button" :disabled="!event.target" :data-archive-focus-id="`portal-event:${event.id}`" @click="emit('open-result', event)"><span><strong>{{ event.title }}</strong><small v-if="event.subtitle">{{ event.subtitle }}</small><small v-if="event.relationLabel" class="overview-relation">{{ event.relationLabel }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
          <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取活动预览…' : '暂无可展示的活动记录，可前往目录查阅。' }}</p>
        </section>
      </div>
      <ArchiveTerminalDialog :open="scopeOpen" title="切换资料馆视角" title-id="portal-scope-title" @close="scopeOpen = false">
        <p class="overview-dialog-note">切换浏览视角不会修改已保存的担当。</p>
        <button class="terminal-text-button" type="button" @click="chooseScope('')">查看全体偶像</button>
        <ArchiveIdolPickerPanel :idols="idols" :idol-name="idolName" :idol-search="idolSearch" :model-value="preferredReference?.idolCode || ''" @update:model-value="chooseScope" />
      </ArchiveTerminalDialog>
      <ArchiveTerminalDialog :open="Boolean(collectionOpen)" :title="collectionTitle" title-id="portal-collection-title" @close="collectionOpen = ''">
        <p class="overview-dialog-note">{{ preferredReference?.actionable ? preferredName : '全站档案' }} · {{ collectionRows.length }} 条{{ collectionOpen === 'stories' ? '可读故事' : '' }}</p>
        <ul class="overview-collection-list"><li v-for="row in collectionPageRows" :key="row.id"><button type="button" :disabled="!row.target" @click="openCollectionResult(row)"><img v-if="row.image?.url" :src="row.image.url" alt="" loading="lazy" /><span v-else class="overview-collection-mark"><component :is="archiveNavigationIcons[collectionOpen] || BookOpen" :size="22" aria-hidden="true" /></span><span><strong>{{ row.title }}</strong><small>{{ row.subtitle || row.unitName || row.idolName }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></li></ul>
        <nav v-if="collectionPages > 1" class="overview-collection-pages" aria-label="关联档案翻页"><button type="button" :disabled="collectionPage === 1" @click="collectionPage--">上一页</button><span>{{ collectionPage }} / {{ collectionPages }}</span><button type="button" :disabled="collectionPage === collectionPages" @click="collectionPage++">下一页</button></nav>
        <p v-if="!collectionRows.length" class="overview-empty">当前视角没有已确认的关联记录。</p>
        <button class="terminal-text-button" type="button" @click="openDirectory">打开全站目录<ChevronRight :size="16" aria-hidden="true" /></button>
      </ArchiveTerminalDialog>
      <footer class="overview-footer">SideM Archive · 非官方资料存档</footer>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowUpRight, BookOpen, BriefcaseBusiness, ChevronRight, ContactRound, Layers, MessageCircle, Play, Search, Users, X } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
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
const emit = defineEmits(['back', 'open-home', 'navigate', 'edit-personal', 'open-preferred', 'search', 'open-result', 'open-stage', 'retry-overview', 'select-scope', 'save-preferred'])
const heading = ref(null)
defineExpose({ focusHeading: () => heading.value?.focus({ preventScroll: true }) })
const footprints = computed(() => props.desktopOverview.footprints || [])
const collectionPage = ref(1)
const scopeOpen = ref(false), collectionOpen = ref(''), storyTab = ref('all'), portraitFailed = ref(false)
const collections = computed(() => props.desktopOverview.collections || {})
const collectionRows = computed(() => collections.value[collectionOpen.value] || [])
const collectionPages = computed(() => Math.max(1, Math.ceil(collectionRows.value.length / 24)))
const collectionPageRows = computed(() => collectionRows.value.slice((collectionPage.value - 1) * 24, collectionPage.value * 24))
watch(collectionOpen, () => { collectionPage.value = 1 })
const collectionTitle = computed(() => footprints.value.find(row => row.id === collectionOpen.value)?.label || '关联档案')
function collectionCount(id) { return formatCount(footprints.value.find(row => row.id === id)?.value) }
function chooseScope(code) { scopeOpen.value = false; emit('select-scope', code) }
function openCollectionResult(row) { collectionOpen.value = ''; emit('open-result', row) }
function openDirectory() { const id = collectionOpen.value; collectionOpen.value = ''; emit('navigate', id) }
const storyTabs = computed(() => [{id:'all',label:'全部',count:(collections.value.stories || []).length},
  ...[['main','主线'],['event','活动'],['personal','个人'],['other','其他']].map(([id,label]) => ({id,label,count:(collections.value.stories || []).filter(row => storyGroup(row) === id).length})).filter(row => row.count)])
function storyGroup(row) { return ['main','event'].includes(row.domain) ? row.domain : ['idol_story','card_scenarios','work','birthday'].includes(row.domain) ? 'personal' : 'other' }
watch(() => props.desktopOverview.scopeId, () => { storyTab.value = 'all'; collectionOpen.value = ''; portraitFailed.value = false })
const cards = computed(() => props.desktopOverview.cards || [])
const songs = computed(() => props.desktopOverview.songs || [])
const stories = computed(() => (collections.value.stories || []).filter(row => storyTab.value === 'all' || storyGroup(row) === storyTab.value).slice(0, 4))
const events = computed(() => props.desktopOverview.events || [])
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
.portal-overview-scroll { position:relative;z-index:2;width:100%;height:100%;min-height:0;overflow:auto;padding:24px;scrollbar-width:thin; }
.portal-overview { --portal-accent:color-mix(in srgb,var(--portal-idol-color,#33a8a5) 36%,#13232d);--portal-tint:color-mix(in srgb,var(--portal-idol-color,#33a8a5) 7%,#fff);--portal-line:color-mix(in srgb,var(--portal-idol-color,#33a8a5) 15%,#dce4e6);--portal-muted:color-mix(in srgb,var(--portal-idol-color,#33a8a5) 15%,#68777a);container-type:inline-size;width:min(1200px,100%);min-width:0;margin:0 auto;color:#283d43;font-family:var(--gs-font-directory);font-size:13px;line-height:1.6; }
.portal-overview *, .portal-overview-scroll { box-sizing:border-box; }
.portal-overview button, .portal-overview input { font:inherit; }
.portal-overview button { cursor:pointer; }
.portal-overview button:disabled { cursor:default;color:#687f78; }
.portal-overview button:focus-visible, .portal-overview input:focus-visible, .portal-overview :deep(.domain-media-preview button:focus-visible) { outline:var(--gs-focus-ring) solid var(--portal-accent);outline-offset:var(--gs-focus-offset); }
.overview-toolbar, .overview-brand, .overview-toolbar-actions { display:flex;align-items:center;gap:var(--gs-space-4); }
.overview-toolbar { justify-content:space-between;min-height:44px;gap:var(--gs-space-5); }
.overview-brand { flex:none;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);letter-spacing:-.03em; }
.overview-brand b { font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);letter-spacing:.12em;margin-left:var(--gs-space-2); }
.overview-toolbar-actions { flex-wrap:wrap;justify-content:flex-end;gap:4px;padding:4px;border:1px solid #ffffffa6;border-radius:14px;background:#ffffffc9; }
.overview-toolbar-actions :deep(.archive-language-switch) { border:0;padding:0;background:transparent; }
.overview-home-link { display:flex;align-items:center;gap:10px;min-height:44px;padding:0;border:0;background:transparent;color:inherit; }
.overview-home-link > svg { color:var(--portal-accent); }
.overview-icon-button { display:grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border:0;border-radius:var(--gs-radius-field);background:transparent;color:var(--portal-accent); }
.overview-brand h1 { margin:0;padding-left:14px;border-left:1px solid var(--portal-line);font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-.02em; }
.overview-brand h1:focus { outline:none; }
.overview-description { margin:8px 0 14px;color:var(--portal-muted);font-size:13px; }
.overview-search { margin-bottom:var(--gs-space-4); }
.overview-search-form { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;min-height:56px;padding:4px 6px 4px 16px;border:1px solid var(--portal-line);border-radius:12px;background:#ffffffed;color:var(--portal-accent);box-shadow:0 6px 24px #26394709; }
.overview-search-form:focus-within { border-color:var(--portal-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--portal-idol-color) 12%,transparent); }
.overview-search-form > svg { flex:none; }
.overview-search-form input { flex:1;min-width:0;height:44px;padding:var(--gs-space-3) 0;border:0;background:transparent;color:inherit;font-size:var(--gs-text-subtitle); }
.overview-search-form input::placeholder { color:var(--portal-muted); }
.overview-search-form input::-webkit-search-cancel-button { display:none; }
.overview-search-submit { min-height:44px;padding:var(--gs-space-3) var(--gs-space-6);border:0;border-radius:var(--gs-radius-field);background:var(--portal-accent);color:#fff;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-search-form .overview-icon-button { border:0;background:transparent; }
.overview-search-shortcuts { display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:4px;color:var(--portal-muted);font-size:12px; }
.overview-search-shortcuts > button { display:flex;align-items:center;min-height:36px;padding:4px 12px;border:1px solid color-mix(in srgb,var(--portal-line) 60%,transparent);border-radius:999px;background:#ffffff70;color:var(--portal-accent);overflow-wrap:anywhere;text-align:left; }
.overview-search-results { margin-top:var(--gs-space-4);padding:var(--gs-space-3) var(--gs-space-5);border:1px solid var(--portal-line);border-radius:var(--gs-radius-panel);background:#fffffff2; }
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
.overview-counts { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:12px 0 22px;padding:0;background:transparent; }
.overview-counts > button { display:flex;align-items:center;gap:10px;min-width:0;min-height:56px;padding:8px 16px;border:1px solid #ffffffa6;border-radius:12px;background:#ffffffa8;color:var(--portal-accent);text-align:left;box-shadow:0 4px 16px #1d344005; }
.overview-counts strong { font-size:24px;line-height:1.25;font-weight:650;font-variant-numeric:tabular-nums; }
.overview-counts small { color:var(--portal-muted);font-size:12px;font-variant-numeric:tabular-nums; }
.overview-count-label { margin-left:auto;color:var(--portal-muted);font-size:12px;white-space:nowrap; }
.overview-panel { min-width:0;padding:20px;border:1px solid #ffffffb3;border-radius:16px;background:#ffffffd9;box-shadow:0 10px 25px -5px #1d34400a; }
.overview-featured { display:grid;grid-template-columns:minmax(280px,32%) minmax(0,1fr);gap:24px;padding:20px 24px;background:radial-gradient(ellipse at 0 100%,color-mix(in srgb,var(--portal-idol-color) 8%,transparent),transparent 65%),#ffffffd1;border-color:#ffffffbd;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px); }
.overview-personal, .overview-card-showcase { min-width:0; }
.overview-personal { position:relative;align-self:stretch;display:flex;flex-direction:column;justify-content:center; }
.overview-card-showcase { width:100%;max-width:none;padding-left:24px;border-left:1px solid color-mix(in srgb,var(--portal-idol-color) 10%,#dce4e660); }
.overview-hero-heading { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px; }
.overview-eyebrow { color:var(--portal-accent);font-size:11px;font-weight:650;letter-spacing:.06em; }
.overview-hero-heading > button { display:flex;align-items:center;gap:6px;min-height:44px;padding:4px 0;border:0;background:transparent;color:var(--portal-accent);font-size:12px; }
.overview-section-heading { display:flex;justify-content:space-between;align-items:center;gap:var(--gs-space-4);margin-bottom:var(--gs-space-4); }
.overview-section-heading h2 { margin:0;font-size:16px;line-height:1.4;font-weight:650; }
.overview-section-heading > button { display:flex;align-items:center;gap:var(--gs-space-2);flex:none;min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:var(--portal-accent);font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-identity { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0; }
.overview-avatar-trigger { display:grid;place-items:center;flex:none;width:64px;height:64px;padding:0;border:0;border-radius:50%;background:transparent; }
/* Only the named copy grows. The shared avatar root remains a square circle. */
.overview-preferred-avatar, .overview-avatar-empty { flex:none;width:64px;height:64px;min-width:64px;max-width:64px;aspect-ratio:1; }
.overview-preferred-avatar { --idol-avatar-override-size:64px; }
.overview-avatar-empty { display:grid;place-items:center;border:1px dashed var(--portal-line);border-radius:50%;color:var(--portal-accent); }
.overview-identity-copy { min-width:0; }
.overview-identity-copy h2 { font-size:25px;line-height:1.3;overflow-wrap:anywhere; }
.overview-producer-name { margin:0 0 var(--gs-space-1);color:var(--portal-muted);font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-personal-meta { display:grid;gap:12px;margin-top:20px; }
.overview-preferred-stats { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0; }
.overview-preferred-stats > div { display:flex;flex-direction:column;gap:2px;min-width:0; }
.overview-preferred-stats dt { order:2;font-size:11px;color:var(--portal-muted); }
.overview-preferred-stats dd { margin:0;font-size:20px;font-weight:650;line-height:1.3;font-variant-numeric:tabular-nums; }
.overview-preferred-actions { display:flex;flex-wrap:wrap;align-items:center;gap:6px; }
.overview-preferred-actions button { display:flex;align-items:center;gap:6px;min-height:44px;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:var(--portal-accent);font-size:12px;font-weight:500; }
.overview-personal-note { margin:0 0 var(--gs-space-3);color:#718678;font-size:var(--gs-text-ui); }
.overview-card-heading { margin-bottom:10px; }
.overview-card-heading h3 { margin:0;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-card-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gs-space-4); }
.overview-card { min-width:0; }
.overview-card-meta { display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-height:22px;margin-top:6px;color:#6c8275;font-size:11px; }
.overview-rarity { position:absolute;z-index:1;top:8px;left:8px;padding:1px 6px;border:1px solid #ffffff60;border-radius:5px;background:#20353bd9;color:#f0f5f5;font-size:10px;font-weight:650;line-height:1.6;letter-spacing:.025em;pointer-events:none; }
.overview-rarity.is-ssr { border-color:#f5dfa280;background:#302d25de;color:#fff0b9; }
.overview-card-meta > span:first-child { color:var(--portal-accent); }
.overview-card > button { display:flex;align-items:start;justify-content:space-between;gap:6px;width:min(100%,160px);min-height:44px;margin:4px auto 0;padding:4px 0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-card > button strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.5;overflow-wrap:anywhere; }
.overview-card > button svg { flex:none;margin-top:var(--gs-space-1);color:var(--portal-accent); }
.overview-song-list { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px; }
.overview-song { display:flex;align-items:center;gap:10px;min-width:0;padding:10px 0; }
.overview-song:nth-child(n+3) { border-top:1px solid #edf1ed; }
.overview-song-copy { flex:1;min-width:0; }
.overview-song-detail { display:grid;gap:4px;width:100%;min-width:0;min-height:44px;padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-song strong { font-size:13px;line-height:1.45;font-weight:600;overflow-wrap:anywhere; }
.overview-song small { font-size:var(--gs-text-meta);color:var(--portal-muted);overflow-wrap:anywhere; }
.overview-song-detail > svg { flex:none;color:#739884; }
.overview-song-cover { position:relative;flex:none;width:64px; }
.overview-stage-button { display:grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border:1px solid var(--portal-line);border-radius:50%;background:#ffffff70;color:var(--portal-accent); }
.overview-card-image, .overview-song-image, .overview-story-image, .overview-event-image { display:flex;position:relative;align-items:center;justify-content:center;margin:0;padding:var(--gs-space-2);border:0;border-radius:var(--gs-radius-field);background:var(--portal-tint); }
/* Every card uses the same portrait frame; bound pixels retain their own ratio. */
.overview-card-art { position:relative;width:min(100%,160px);margin-inline:auto; }
.overview-card-art-link { position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;border-radius:var(--gs-radius-field);background:transparent; }
.overview-card-art:not(:has(img)) > .overview-card-art-link { display:none; }
.overview-card-image { width:100%;height:auto;aspect-ratio:4 / 5;margin-inline:auto;border-radius:10px;box-shadow:0 4px 12px #25384314,0 1px 2px #2538430d,0 0 0 1px #ffffff99; }
.overview-song-image { flex:none;width:64px;height:64px;box-shadow:0 2px 6px #2538430a; }
.overview-story-image { flex:none;width:44px;height:44px; }
.overview-event-image { flex:none;width:128px;height:72px;aspect-ratio:16 / 9;margin:0; }
.overview-card-image:deep(img), .overview-song-image:deep(img), .overview-story-image:deep(img), .overview-event-image:deep(img) { display:block;width:auto;height:auto;max-width:100%;max-height:100%;min-height:0;object-fit:contain;margin:0; }
.overview-card-image:deep(.domain-resource-empty), .overview-song-image:deep(.domain-resource-empty), .overview-story-image:deep(.domain-resource-empty), .overview-event-image:deep(.domain-resource-empty) { display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:var(--gs-space-3);min-height:0;width:100%;height:100%;margin:0;background:transparent;color:#6e887b;font-size:var(--gs-text-meta); }
.overview-song-image:deep(.domain-resource-empty span), .overview-story-image:deep(.domain-resource-empty span), .overview-song-image:deep(figcaption), .overview-story-image:deep(figcaption) { display:none; }
.overview-card-image:deep(figcaption), .overview-event-image:deep(figcaption) { position:absolute;inset:auto var(--gs-space-3) var(--gs-space-2);margin:0;color:#688273;font-size:var(--gs-text-meta); }
.portal-overview :deep(.domain-media-preview button) { min-height:44px;padding:var(--gs-space-2) var(--gs-space-3);border:1px solid var(--portal-line);border-radius:var(--gs-radius-control);background:#fff;color:var(--portal-accent);font-size:var(--gs-text-ui); }
.overview-song-image:deep(button), .overview-story-image:deep(button) { width:44px;padding:0;font-size:var(--gs-text-meta); }
.overview-content-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:20px;align-items:stretch; }
.overview-events { grid-column:1 / -1; }
.overview-story-list { display:grid; }
.overview-unit-name { display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0;color:var(--portal-muted);font-size:12px; }
.overview-unit-name > img { flex:none;width:48px;height:28px;object-fit:contain; }
.overview-story { display:flex;align-items:center;gap:12px;min-width:0;padding-block:10px; }
.overview-story-mark { display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:8px;background:var(--portal-tint);color:var(--portal-accent); }
.overview-story + .overview-story { border-top:1px solid #e5ece5; }
.overview-story > button, .overview-event > button { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-4);width:100%;min-width:0;min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-story > button > span, .overview-event > button > span { display:grid;gap:var(--gs-space-2);min-width:0; }
.overview-story-copy { flex:1; }
.overview-story > button > .overview-story-cast { display:flex;align-items:center;gap:0;flex:none; }
.overview-story-cast :deep(.idol-avatar-shell + .idol-avatar-shell) { margin-left:-5px; }
.overview-story .overview-story-cast > small { display:grid;place-items:center;min-width:26px;height:24px;margin-left:4px;padding-inline:4px;border:1px solid var(--portal-line);border-radius:999px;background:var(--portal-tint);color:var(--portal-accent);font-size:10px;font-variant-numeric:tabular-nums; }
.overview-story strong, .overview-event strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.5;overflow-wrap:anywhere; }
.overview-story small, .overview-event small { color:#708278;font-size:11px;overflow-wrap:anywhere; }
.overview-story > button > svg, .overview-event > button > svg { flex:none;color:var(--portal-accent); }
.overview-event-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px; }
.overview-event { display:flex;align-items:center;gap:12px;min-width:0;padding:12px;border:1px solid var(--portal-line);border-radius:12px;background:#ffffff65; }
.overview-status, .overview-error, .overview-empty { margin:0;padding:var(--gs-space-4) 0;color:#6b8274;font-size:var(--gs-text-ui); }
.overview-error { color:#875a40; }
.overview-error > button { min-height:44px;margin-left:var(--gs-space-4);padding:var(--gs-space-2) var(--gs-space-3);border:1px solid #dbc9bd;border-radius:var(--gs-radius-control);background:#fff;color:inherit;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-footer { margin-top:var(--gs-space-6);padding:var(--gs-space-5) 0;color:#829387;font-size:var(--gs-text-meta); }
.overview-visually-hidden { position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap; }
@media (hover:hover) and (pointer:fine) {
  .overview-icon-button:hover, .overview-search-shortcuts > button:hover, .overview-preferred-actions button:hover { background:var(--portal-tint); }
  .overview-stage-button:hover { border-color:var(--portal-accent);background:var(--portal-accent);color:#fff; }
  .overview-section-heading > button:hover, .overview-card > button:hover, .overview-song-detail:hover, .overview-search-results li > button:hover, .overview-story > button:hover, .overview-event > button:hover { color:var(--portal-accent); }
  .overview-search-submit:hover { background:color-mix(in srgb,var(--portal-accent) 88%,#000); }
  .overview-card-art { transition:transform 160ms cubic-bezier(.23,1,.32,1); }
  .overview-card-image { transition:box-shadow 160ms ease; }
  .overview-card:has(.overview-card-art-link:hover,>button:hover) .overview-card-art { transform:translateY(-4px); }
  .overview-card:has(.overview-card-art-link:hover,>button:hover) .overview-card-image { box-shadow:0 10px 22px #25384322,0 0 0 1px color-mix(in srgb,var(--portal-idol-color) 25%,#fff); }
}
.portal-overview button:active { background-color:var(--portal-tint); }
.portal-overview .overview-card-art-link:active { background-color:#ffffff18; }
.portal-overview .overview-search-submit:active { background-color:color-mix(in srgb,var(--portal-accent) 80%,#000); }
@media (prefers-reduced-motion:reduce) {
  .overview-card-art, .overview-card-image { transition:none; }
  .overview-card:has(.overview-card-art-link:hover,>button:hover) .overview-card-art { transform:none; }
}
@media (pointer:coarse) {
  .overview-search-shortcuts > button { min-height:44px; }
}
@container (max-width:900px) {
  .overview-featured { grid-template-columns:1fr;gap:18px; }
  .overview-card-showcase { max-width:none;padding:10px 0 0;border-left:0;border-top:1px solid color-mix(in srgb,var(--portal-idol-color) 10%,#dce4e660); }
  .overview-card-art { width:min(100%,144px); }
  .overview-hero-heading { grid-column:1 / -1;margin-bottom:0; }
  .overview-personal-heading { align-self:center;margin-bottom:0; }
  .overview-personal-meta { margin-top:0; }
  .overview-preferred-actions button { padding-inline:8px; }
  .overview-song-list { grid-template-columns:1fr;gap:0; }
  .overview-song:nth-child(n+2) { border-top:1px solid #edf1ed; }
  .overview-event-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@container (max-width:650px) {
  .overview-content-grid { grid-template-columns:1fr; }
  .overview-personal { display:flex; }
  .overview-hero-heading { margin-bottom:10px; }
  .overview-personal-meta { margin-top:16px; }
  .overview-song-list { grid-template-columns:repeat(2,minmax(0,1fr));gap:14px; }
  .overview-song:nth-child(2) { border-top:0; }
  .overview-counts > div { padding-inline:10px; }
  .overview-counts dd { font-size:20px; }
}
@media(max-width:900px) {
  .portal-overview-scroll { padding:16px; }
  .overview-toolbar { align-items:start; }
  .overview-brand b { display:none; }
}
/* The view controller, typography and original art share the existing GS palette. */
.overview-brand h1 { border:0;padding:0;font-size:24px; }
.overview-title-view { color:var(--portal-muted);font-size:18px;font-weight:500; }
.overview-scope-bar { display:flex;align-items:center;gap:12px;min-width:0;margin:16px 0 12px; }
.overview-scope-trigger { display:flex;align-items:center;gap:10px;flex:none;min-height:52px;padding:6px 12px;border:1px solid var(--portal-line);border-radius:12px;background:#ffffffd9;color:var(--portal-accent); }
.overview-scope-trigger > span { display:flex;align-items:baseline;gap:10px; }
.overview-scope-trigger small { flex:none;white-space:nowrap;color:var(--portal-muted);font-size:11px; }
.overview-scope-trigger strong { font-size:15px;font-weight:650; }
.overview-scope-reset,.overview-save-idol { min-height:44px;padding:6px 10px;border:0;border-radius:8px;background:transparent;color:var(--portal-accent);font-size:12px; }
.overview-scope-note { margin-left:auto;color:var(--portal-muted);font-size:12px; }
.overview-identity { position:relative;min-height:190px;gap:12px; }
.overview-idol-art { position:absolute;left:-20px;bottom:-5px;width:75%;height:270px;object-fit:contain;object-position:left bottom;pointer-events:none;filter:drop-shadow(0 6px 10px #26384312); }
.overview-identity-copy { position:relative;z-index:1; }
.has-portrait .overview-identity-copy { margin-left:48%;padding:12px 0 12px 10px;border-radius:10px;background:linear-gradient(90deg,#ffffff00,#ffffffce 30%,#ffffff85); }
.overview-identity-copy h2 { margin:8px 0 6px;font-size:27px;line-height:1.25;font-weight:650; }
.overview-kana { margin:0 0 12px;font-size:12px;color:var(--portal-muted); }
.overview-unit-name > img { width:min(120px,100%);height:40px; }
.overview-preferred-actions { position:relative;z-index:1;gap:2px;justify-content:space-between;margin-top:12px;padding:3px;border:1px solid #ffffff9c;border-radius:12px;background:#ffffffc9; }
.overview-preferred-actions button { gap:4px;padding:4px 5px;font-size:12px; }
.overview-save-idol { align-self:flex-start;margin-top:4px;padding-left:0; }
.overview-section-heading h2 > small { margin-left:6px;color:var(--portal-muted);font-size:12px;font-weight:500; }
.overview-story-tabs { display:flex;flex-wrap:wrap;gap:4px;margin:-6px 0 4px; }
.overview-story-tabs button { min-height:36px;padding:4px 10px;border:0;border-radius:999px;background:transparent;color:var(--portal-muted);font-size:12px; }
.overview-story-tabs button[aria-pressed=true] { color:var(--portal-accent);background:var(--portal-tint);box-shadow:inset 0 0 0 1px var(--portal-line); }
.overview-story-tabs small { margin-left:3px;font-variant-numeric:tabular-nums; }
.overview-song { min-height:100px; }
.overview-story { min-height:80px; }
.overview-relation { display:inline-flex;width:fit-content;padding:1px 6px;border-radius:5px;background:var(--portal-tint);color:var(--portal-accent)!important;font-size:10px!important; }
.overview-dialog-note { margin:0 0 12px;color:var(--portal-muted);font-size:13px; }
.overview-collection-list { margin:0;padding:0;list-style:none; }
.overview-collection-list li + li { border-top:1px solid var(--portal-line); }
.overview-collection-list button { display:flex;align-items:center;gap:14px;width:100%;min-height:72px;padding:10px 0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-collection-list img,.overview-collection-mark { flex:none;width:48px;height:56px;object-fit:contain; }
.overview-collection-mark { display:grid;place-items:center;color:var(--portal-accent); }
.overview-collection-list button > span:not(.overview-collection-mark) { display:grid;gap:4px;flex:1;min-width:0; }
.overview-collection-list strong { font-size:14px;overflow-wrap:anywhere; }
.overview-collection-list small { font-size:12px;color:var(--portal-muted);overflow-wrap:anywhere; }
.overview-collection-list svg { flex:none; }
@media(hover:hover) and (pointer:fine) {
  .overview-counts > button:hover,.overview-scope-trigger:hover { background:#ffffffeb;box-shadow:0 4px 16px #1d344014; }
  .overview-scope-reset:hover,.overview-save-idol:hover,.overview-story-tabs button:hover { background:var(--portal-tint); }
}
@container(max-width:1050px) {
  .overview-event-grid { grid-template-columns:1fr; }
  .overview-event-image { width:160px;height:90px; }
  .overview-counts > button { padding:8px 10px;gap:7px;flex-wrap:wrap; }
  .overview-count-label { margin-left:0; }
  .overview-counts strong { font-size:22px; }
  .overview-scope-note { display:none; }
  .overview-song-list { grid-template-columns:1fr;gap:0; }
  .overview-song:nth-child(n+2) { border-top:1px solid #edf1ed; }
}
@container(max-width:900px) {
  .overview-featured { grid-template-columns:minmax(250px,38%) minmax(0,1fr);gap:16px; }
  .overview-card-showcase { padding:0 0 0 16px;border-top:0;border-left:1px solid var(--portal-line); }
  .overview-idol-art { height:240px; }
  .overview-identity-copy h2 { font-size:23px; }
  .overview-preferred-actions { flex-wrap:wrap;justify-content:flex-start; }
  .overview-card-grid { gap:10px; }
}
@container(max-width:720px) {
  .overview-title-view { font-size:15px; }
  .overview-featured { grid-template-columns:1fr; }
  .overview-personal { min-height:260px; }
  .overview-identity { min-height:190px; }
  .overview-idol-art { width:50%;height:250px;left:0; }
  .has-portrait .overview-identity-copy { margin-left:45%; }
  .overview-preferred-actions { justify-content:center; }
  .overview-card-showcase { padding:16px 0 0;border-left:0;border-top:1px solid var(--portal-line); }
  .overview-counts { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .overview-content-grid { grid-template-columns:1fr; }
}
.overview-explorer { display:grid;grid-template-columns:280px minmax(0,1fr);align-items:start;gap:16px;margin-top:16px; }
.overview-explorer .overview-search { margin-bottom:0; }
.overview-explorer .overview-scope-bar { flex-wrap:wrap;gap:4px;margin:0; }
.overview-explorer .overview-scope-trigger { width:100%; }
.overview-explorer .overview-scope-trigger > svg:last-child { margin-left:auto; }
.overview-explorer .overview-scope-note { display:none; }
.overview-song-list.is-short-list { grid-template-columns:1fr;gap:0; }
.overview-song-list.is-short-list .overview-song { min-height:84px; }
.overview-song-list.is-short-list .overview-song + .overview-song { border-top:1px solid #edf1ed; }
@container(max-width:900px) {
  .overview-explorer { grid-template-columns:230px minmax(0,1fr);gap:12px; }
}
@container(max-width:720px) {
  .overview-explorer { grid-template-columns:1fr; }
  .overview-explorer .overview-scope-trigger { width:auto; }
}
.overview-collection-pages { display:flex;justify-content:center;align-items:center;gap:16px;margin:16px 0; }
.overview-collection-pages button { min-height:44px;padding:6px 12px;border:1px solid var(--portal-line);border-radius:8px;background:var(--portal-tint);color:var(--portal-accent); }
.overview-collection-pages span { font-variant-numeric:tabular-nums;color:var(--portal-muted); }
</style>
