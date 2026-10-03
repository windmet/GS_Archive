<template>
  <div class="portal-overview-scroll" data-archive-scroll-container>
    <div class="portal-overview">
      <header class="overview-toolbar">
        <div class="overview-brand">
          <button v-if="canGoBack" class="overview-icon-button" type="button" aria-label="返回来源页" data-archive-focus-id="portal-back" @click="emit('back')"><ArrowLeft :size="20" aria-hidden="true" /></button>
          <span>SideM <b>ARCHIVE</b></span>
        </div>
        <div class="overview-toolbar-actions"><slot name="toolbar" /></div>
      </header>

      <header class="overview-intro">
        <div><h1 id="portal-title" ref="heading" tabindex="-1">资料馆</h1><p class="overview-description">从担当的卡片、歌曲与故事，继续资料探索。</p></div>
        <button class="overview-home-button" type="button" data-archive-focus-id="portal-home" @click="emit('open-home')"><Sparkles :size="18" aria-hidden="true" />前往首页<ArrowUpRight :size="16" aria-hidden="true" /></button>
      </header>

      <slot name="notices" />

      <section class="overview-search" aria-labelledby="portal-search-title">
        <h2 id="portal-search-title" class="overview-visually-hidden">搜索核心档案</h2>
        <form class="overview-search-form" role="search" @submit.prevent="emit('search', query)">
          <Search :size="21" aria-hidden="true" />
          <input id="portal-global-search" type="search" :value="query" aria-label="搜索偶像、卡片、歌曲、故事" placeholder="搜索偶像、卡片、歌曲、故事" autocomplete="off" data-archive-focus-id="portal-search" @input="emit('search', $event.target.value)" />
          <button v-if="query" class="overview-icon-button" type="button" aria-label="清空搜索" @click="emit('search', '')"><X :size="18" aria-hidden="true" /></button>
          <button class="overview-search-submit" type="submit">搜索</button>
        </form>
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

      <dl v-if="counts.length" class="overview-counts" aria-label="资料收录数量"><div v-for="count in counts" :key="count.id"><dt>{{ count.label }}</dt><dd>{{ formatCount(count.value) }}</dd></div><div><dt>组合</dt><dd>{{ formatCount(desktopOverview.unitCount) }}</dd></div></dl>

      <p v-if="desktopOverview.loading" class="overview-status" role="status">正在读取门户资料…</p>
      <p v-if="desktopOverview.error" class="overview-error" role="status">{{ desktopOverview.error }}<button type="button" data-archive-focus-id="portal-overview-retry" @click="emit('retry-overview')">重试门户资料</button></p>

      <div class="overview-bento">
          <section class="overview-panel overview-featured" aria-labelledby="portal-workbench-title">
            <header class="overview-section-heading overview-personal-heading">
              <div class="overview-identity">
                <button class="overview-avatar-trigger" type="button" aria-label="编辑担当偶像" data-archive-focus-id="portal-preferred-edit" @click="emit('edit-personal')"><ArchiveIdolAvatar v-if="preferredReference?.actionable" class="overview-preferred-avatar" :idol-code="preferredReference.idolCode" :accent-color="preferredReference.accentColor" :size="42" decorative /><span v-else class="overview-avatar-empty"><Users :size="22" aria-hidden="true" /></span></button>
                <div class="overview-identity-copy"><p class="overview-producer-name">{{ producerDisplayName }}</p><h2 id="portal-workbench-title">{{ preferredReference?.actionable ? preferredName : '我的工作台' }}</h2><p v-if="desktopOverview.preferredUnitName" class="overview-unit-name">{{ desktopOverview.preferredUnitName }}</p></div>
              </div>
              <button type="button" data-archive-focus-id="portal-personal-edit" aria-label="编辑制作人工作台" @click="emit('edit-personal')"><Pencil :size="16" aria-hidden="true" />编辑担当</button>
            </header>
            <div v-if="preferredReference?.actionable" class="overview-personal-meta">
              <dl v-if="preferredStats.length" class="overview-preferred-stats" aria-label="担当个人档案数量"><div v-for="stat in preferredStats" :key="stat.id"><dt>{{ stat.label }}</dt><dd>{{ formatCount(stat.value) }}</dd></div></dl>
              <nav class="overview-preferred-actions" aria-label="担当快捷入口"><button v-for="action in preferredActions" :key="action.id" type="button" :data-archive-focus-id="`portal-preferred:${action.id}`" @click="emit('open-preferred', action.id)">{{ action.label }}<ChevronRight :size="14" aria-hidden="true" /></button></nav>
            </div>
            <p v-else class="overview-personal-note">选择担当后，可继续查阅个人资料与关联内容。</p>
            <header class="overview-section-heading overview-card-heading"><h3 id="portal-card-preview-title">{{ preferredReference?.actionable ? '担当卡片' : '卡片档案' }}</h3><button type="button" data-archive-focus-id="portal-cards-all" @click="emit('navigate', 'cards')">卡片目录<ChevronRight :size="16" aria-hidden="true" /></button></header>
            <div v-if="cards.length" class="overview-card-grid">
              <article v-for="card in cards" :key="card.id" class="overview-card">
                <DomainMediaPreview class="overview-card-image" :binding="card.image" :name="card.title" />
                <div class="overview-card-meta"><span v-if="card.rarity">{{ card.rarity }}</span><span v-if="card.idolName">{{ card.idolName }}</span></div>
                <button type="button" :disabled="!card.target" :data-archive-focus-id="`portal-card:${card.id}`" @click="emit('open-result', card)"><strong>{{ card.title }}</strong><ArrowUpRight :size="16" aria-hidden="true" /></button>
              </article>
            </div>
            <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取卡片预览…' : '暂无可展示的卡片预览，可前往目录查阅。' }}</p>
          </section>

          <section class="overview-panel overview-music" aria-labelledby="portal-song-preview-title">
            <header class="overview-section-heading"><h2 id="portal-song-preview-title">歌曲与舞台</h2><button type="button" data-archive-focus-id="portal-songs-all" @click="emit('navigate', 'songs')">歌曲目录<ChevronRight :size="16" aria-hidden="true" /></button></header>
            <div v-if="songs.length" class="overview-song-list">
              <article v-for="song in songs" :key="song.id" class="overview-song">
                <DomainMediaPreview class="overview-song-image" :binding="song.image" :name="song.title" />
                <div class="overview-song-copy"><button class="overview-song-detail" type="button" :disabled="!song.target" :data-archive-focus-id="`portal-song:${song.id}`" @click="emit('open-result', song)"><span><strong>{{ song.title }}</strong><small v-if="song.unitName">{{ song.unitName }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button><button v-if="song.stageTarget" class="overview-stage-button" type="button" :aria-label="`在舞台中打开 ${song.title}`" :data-archive-focus-id="`portal-song-stage:${song.id}`" @click="emit('open-stage', song.stageTarget)">进入舞台<ArrowUpRight :size="14" aria-hidden="true" /></button></div>
              </article>
            </div>
            <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取歌曲预览…' : '暂无可展示的歌曲预览，可前往目录查阅。' }}</p>
          </section>
      </div>
      <div class="overview-reading">
        <section class="overview-panel" aria-labelledby="portal-story-preview-title">
          <header class="overview-section-heading"><h2 id="portal-story-preview-title">故事档案</h2><button type="button" data-archive-focus-id="portal-stories-all" @click="emit('navigate', 'stories')">故事目录<ChevronRight :size="16" aria-hidden="true" /></button></header>
          <div v-if="stories.length" class="overview-story-list"><article v-for="story in stories" :key="story.id" class="overview-story"><DomainMediaPreview v-if="story.image?.url" class="overview-story-image" :binding="story.image" :name="story.title" /><button type="button" :disabled="!story.target" :data-archive-focus-id="`portal-story:${story.id}`" @click="emit('open-result', story)"><span><strong>{{ story.title }}</strong><small v-if="story.subtitle">{{ story.subtitle }}</small><span v-if="story.summary" class="overview-story-summary">{{ story.summary }}</span></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
          <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取故事预览…' : '暂无可展示的故事预览，可前往目录查阅。' }}</p>
        </section>
        <section class="overview-panel" aria-labelledby="portal-event-preview-title">
          <header class="overview-section-heading"><h2 id="portal-event-preview-title">活动记录</h2><button type="button" data-archive-focus-id="portal-events-all" @click="emit('navigate', 'events')">活动目录<ChevronRight :size="16" aria-hidden="true" /></button></header>
          <div v-if="events.length" class="overview-event-grid"><article v-for="event in events" :key="event.id" class="overview-event"><DomainMediaPreview v-if="event.image?.url" class="overview-event-image" :binding="event.image" :name="event.title" /><button type="button" :disabled="!event.target" :data-archive-focus-id="`portal-event:${event.id}`" @click="emit('open-result', event)"><span><strong>{{ event.title }}</strong><small v-if="event.subtitle">{{ event.subtitle }}</small></span><ArrowUpRight :size="16" aria-hidden="true" /></button></article></div>
          <p v-else class="overview-empty">{{ desktopOverview.loading ? '正在读取活动预览…' : '暂无可展示的活动记录，可前往目录查阅。' }}</p>
        </section>
      </div>
      <footer class="overview-footer">SideM Archive · 非官方资料存档</footer>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowUpRight, ChevronRight, Pencil, Search, Sparkles, Users, X } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import DomainMediaPreview from './DomainMediaPreview.vue'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'

const props = defineProps({
  canGoBack: Boolean,
  producerDisplayName: { type: String, default: '' },
  preferredReference: { type: Object, default: null },
  idolName: { type: Function, default: () => '' },
  preferredActions: { type: Array, default: () => [] },
  desktopOverview: { type: Object, default: () => ({}) },
  globalSearch: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['back', 'open-home', 'navigate', 'edit-personal', 'open-preferred', 'search', 'open-result', 'open-stage', 'retry-overview'])
const heading = ref(null)
defineExpose({ focusHeading: () => heading.value?.focus({ preventScroll: true }) })
const counts = computed(() => props.desktopOverview.counts || [])
const preferredStats = computed(() => props.desktopOverview.preferredStats || [])
const cards = computed(() => props.desktopOverview.cards || [])
const songs = computed(() => props.desktopOverview.songs || [])
const stories = computed(() => props.desktopOverview.stories || [])
const events = computed(() => props.desktopOverview.events || [])
const query = computed(() => props.globalSearch.query || '')
const searchResults = computed(() => props.globalSearch.results || [])
const searchGroups = computed(() => ['idols', 'cards', 'songs', 'stories'].map(domain => {
  const rows = searchResults.value.filter(result => result.domain === domain)
  return { domain, total: rows.length, rows: rows.slice(0, 6) }
}).filter(group => group.total > 0))
const preferredName = computed(() => props.idolName(props.preferredReference?.idolCode, props.preferredReference?.displayName) || props.preferredReference?.displayName || '')
function formatCount(value) { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN') : '—' }
function domainLabel(domain) { return { cards: '卡片', songs: '歌曲', idols: '偶像', stories: '故事' }[domain] || '档案' }
</script>

<style scoped>
.portal-overview-scroll { position:relative;z-index:2;width:100%;height:100%;min-height:0;overflow:auto;padding:var(--gs-space-7);scrollbar-width:thin; }
.portal-overview { container-type:inline-size;width:min(1200px,100%);min-width:0;margin:0 auto;color:#24463f;font-family:var(--gs-font-directory);font-size:var(--gs-text-ui);line-height:1.6; }
.portal-overview *, .portal-overview-scroll { box-sizing:border-box; }
.portal-overview button, .portal-overview input { font:inherit; }
.portal-overview button { cursor:pointer; }
.portal-overview button:disabled { cursor:default;color:#687f78; }
.portal-overview button:focus-visible, .portal-overview input:focus-visible, .portal-overview :deep(.domain-media-preview button:focus-visible) { outline:var(--gs-focus-ring) solid #168f79;outline-offset:var(--gs-focus-offset); }
.overview-toolbar, .overview-brand, .overview-toolbar-actions { display:flex;align-items:center;gap:var(--gs-space-4); }
.overview-toolbar { justify-content:space-between;min-height:44px;gap:var(--gs-space-5); }
.overview-brand { flex:none;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);letter-spacing:-.03em; }
.overview-brand b { font-size:var(--gs-text-meta);font-weight:var(--gs-weight-semibold);letter-spacing:.12em;margin-left:var(--gs-space-2); }
.overview-toolbar-actions { flex-wrap:wrap;justify-content:flex-end; }
.overview-icon-button { display:grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border:1px solid #d8e6e0;border-radius:var(--gs-radius-field);background:#fff;color:#466d61; }
.overview-intro { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-6);margin:var(--gs-space-4) 0; }
.overview-intro > div { min-width:0; }
.overview-intro h1 { margin:0;font-size:var(--gs-text-subtitle);line-height:1.4;font-weight:var(--gs-weight-semibold); }
.overview-intro h1:focus { outline:none; }
.overview-description { margin:var(--gs-space-2) 0 0;color:#5f7c72;font-size:var(--gs-text-ui); }
.overview-home-button { display:flex;align-items:center;gap:var(--gs-space-3);flex:none;min-height:44px;padding:var(--gs-space-3) var(--gs-space-4);border:1px solid #ccdfd6;border-radius:var(--gs-radius-field);background:#f2f9f5;color:#287a61;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-search { margin-bottom:var(--gs-space-4); }
.overview-search-form { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;min-height:52px;padding:var(--gs-space-2) var(--gs-space-3) var(--gs-space-2) var(--gs-space-5);border:1px solid #c7dcd3;border-radius:var(--gs-radius-panel);background:#fff;color:#5a8172; }
.overview-search-form > svg { flex:none; }
.overview-search-form input { flex:1;min-width:0;height:44px;padding:var(--gs-space-3) 0;border:0;background:transparent;color:#234e3e;font-size:var(--gs-text-subtitle); }
.overview-search-form input::placeholder { color:#7d9289; }
.overview-search-form input::-webkit-search-cancel-button { display:none; }
.overview-search-submit { min-height:44px;padding:var(--gs-space-3) var(--gs-space-6);border:0;border-radius:var(--gs-radius-field);background:#257f66;color:#fff;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-search-form .overview-icon-button { border:0;background:transparent; }
.overview-search-results { margin-top:var(--gs-space-4);padding:var(--gs-space-3) var(--gs-space-5);border:1px solid #d7e4dd;border-radius:var(--gs-radius-panel);background:#fff; }
.overview-search-results ul { list-style:none;padding:0;margin:0; }
.overview-search-total { margin:var(--gs-space-3) 0;color:#6f8477;font-size:var(--gs-text-meta); }
.overview-result-group + .overview-result-group { border-top:1px solid #dfe9e2;margin-top:var(--gs-space-3);padding-top:var(--gs-space-3); }
.overview-result-group > header { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-4); }
.overview-result-group h3 { margin:0;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold); }
.overview-result-group h3 > span { margin-left:var(--gs-space-3);color:#768b7c;font-size:var(--gs-text-meta);font-weight:var(--gs-weight-regular); }
.overview-result-group > header > button { display:flex;align-items:center;gap:var(--gs-space-2);min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:#458369;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-search-results li { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-3) 0; }
.overview-search-results li + li { border-top:1px solid #edf2ee; }
.overview-search-results li > button { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-5);flex:1;min-width:0;min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-result-copy { display:grid;min-width:0; }
.overview-result-copy small { font-size:var(--gs-text-meta);color:#688777; }
.overview-result-copy strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);overflow-wrap:anywhere; }
.overview-result-copy > span { color:#6d8077;font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-search-results li > button > svg { flex:none; }
.overview-result-kind { display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:var(--gs-radius-field);background:#f0f7f3;color:#558570; }
.overview-counts { display:flex;flex-wrap:wrap;align-items:center;gap:var(--gs-space-3) var(--gs-space-6);margin:0 0 var(--gs-space-4);padding:var(--gs-space-3) 0;border-block:1px solid #dfe8df; }
.overview-counts > div { display:flex;align-items:baseline;gap:var(--gs-space-3); }
.overview-counts dt { font-size:var(--gs-text-meta);color:#708575; }
.overview-counts dd { margin:0;font-size:var(--gs-text-subtitle);font-weight:var(--gs-weight-semibold);font-variant-numeric:tabular-nums; }
.overview-bento { display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:var(--gs-space-5);align-items:start; }
.overview-panel { min-width:0;padding:var(--gs-space-5);border:1px solid #dce7df;border-radius:var(--gs-radius-panel);background:#ffffffed; }
.overview-featured { background:#fcfefbea; }
.overview-section-heading { display:flex;justify-content:space-between;align-items:center;gap:var(--gs-space-4);margin-bottom:var(--gs-space-4); }
.overview-section-heading h2 { margin:0;font-size:var(--gs-text-subtitle);line-height:1.4;font-weight:var(--gs-weight-semibold); }
.overview-section-heading > button { display:flex;align-items:center;gap:var(--gs-space-2);flex:none;min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:#458369;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-identity { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0; }
.overview-avatar-trigger { display:grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:transparent; }
/* Only the named copy grows. The shared avatar root remains a square circle. */
.overview-preferred-avatar, .overview-avatar-empty { flex:none;width:42px;height:42px;min-width:42px;max-width:42px;aspect-ratio:1; }
.overview-preferred-avatar { --idol-avatar-override-size:42px; }
.overview-avatar-empty { display:grid;place-items:center;border:1px dashed #b8d4c3;border-radius:50%;color:#6f9b81; }
.overview-identity-copy { min-width:0; }
.overview-identity-copy h2 { overflow-wrap:anywhere; }
.overview-producer-name { margin:0 0 var(--gs-space-1);color:#6b8476;font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-personal-meta { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--gs-space-2) var(--gs-space-4);margin-bottom:var(--gs-space-3); }
.overview-preferred-stats { display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--gs-space-2) var(--gs-space-4);margin:0; }
.overview-preferred-stats > div { display:flex;align-items:baseline;gap:var(--gs-space-2); }
.overview-preferred-stats dt { font-size:var(--gs-text-meta);color:#738b7b; }
.overview-preferred-stats dd { margin:0;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);font-variant-numeric:tabular-nums; }
.overview-preferred-actions { display:flex;flex-wrap:wrap;align-items:center;gap:var(--gs-space-2); }
.overview-preferred-actions button { display:flex;align-items:center;gap:var(--gs-space-2);min-height:44px;padding:var(--gs-space-2) var(--gs-space-2);border:0;background:transparent;color:#497961;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-personal-note { margin:0 0 var(--gs-space-3);color:#718678;font-size:var(--gs-text-ui); }
.overview-card-heading { margin-bottom:var(--gs-space-3);padding-top:var(--gs-space-2);border-top:1px solid #e3ece3; }
.overview-card-heading h3 { margin:0;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-card-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--gs-space-4); }
.overview-card { min-width:0; }
.overview-card-meta { display:flex;flex-wrap:wrap;gap:var(--gs-space-3);margin-top:var(--gs-space-3);color:#6c8275;font-size:var(--gs-text-meta); }
.overview-card-meta > span:first-child { color:#4b7865; }
.overview-card > button { display:flex;align-items:start;justify-content:space-between;gap:var(--gs-space-3);width:100%;min-height:44px;padding:var(--gs-space-3) 0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-card > button strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.5;overflow-wrap:anywhere; }
.overview-card > button svg { flex:none;margin-top:var(--gs-space-1);color:#6d927d; }
.overview-song-list { display:grid;gap:var(--gs-space-3); }
.overview-song { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding:var(--gs-space-3) 0; }
.overview-song + .overview-song { border-top:1px solid #e5ece5; }
.overview-song-copy { flex:1;min-width:0; }
.overview-song-detail { display:flex;align-items:center;gap:var(--gs-space-3);justify-content:space-between;width:100%;min-width:0;min-height:44px;padding:0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-song-detail > span { display:grid;min-width:0;gap:var(--gs-space-2); }
.overview-song strong { font-size:var(--gs-text-ui);line-height:1.5;font-weight:var(--gs-weight-semibold);overflow-wrap:anywhere; }
.overview-song small { font-size:var(--gs-text-meta);color:#708278;overflow-wrap:anywhere; }
.overview-song-detail > svg { flex:none;color:#739884; }
.overview-stage-button { display:flex;align-items:center;gap:var(--gs-space-2);min-height:44px;margin-top:var(--gs-space-2);padding:var(--gs-space-2) var(--gs-space-3);border:1px solid #cfe2d5;border-radius:var(--gs-radius-control);background:#f0f8f1;color:#36775a;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-card-image, .overview-song-image, .overview-story-image, .overview-event-image { display:flex;position:relative;align-items:center;justify-content:center;margin:0;padding:var(--gs-space-2);border:0;border-radius:var(--gs-radius-field);background:#f0f5f1; }
/* Every card uses the same portrait frame; bound pixels retain their own ratio. */
.overview-card-image { width:min(100%,144px);height:auto;aspect-ratio:4 / 5;margin-inline:auto; }
.overview-song-image, .overview-story-image { flex:none;width:64px;height:64px; }
.overview-event-image { width:100%;height:100px;margin-bottom:var(--gs-space-3); }
.overview-card-image:deep(img), .overview-song-image:deep(img), .overview-story-image:deep(img), .overview-event-image:deep(img) { display:block;width:auto;height:auto;max-width:100%;max-height:100%;min-height:0;object-fit:contain;margin:0; }
.overview-card-image:deep(.domain-resource-empty), .overview-song-image:deep(.domain-resource-empty), .overview-story-image:deep(.domain-resource-empty), .overview-event-image:deep(.domain-resource-empty) { display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:var(--gs-space-3);min-height:0;width:100%;height:100%;margin:0;background:transparent;color:#6e887b;font-size:var(--gs-text-meta); }
.overview-song-image:deep(.domain-resource-empty span), .overview-story-image:deep(.domain-resource-empty span), .overview-song-image:deep(figcaption), .overview-story-image:deep(figcaption) { display:none; }
.overview-card-image:deep(figcaption), .overview-event-image:deep(figcaption) { position:absolute;inset:auto var(--gs-space-3) var(--gs-space-2);margin:0;color:#688273;font-size:var(--gs-text-meta); }
.portal-overview :deep(.domain-media-preview button) { min-height:44px;padding:var(--gs-space-2) var(--gs-space-3);border:1px solid #d1e2d8;border-radius:var(--gs-radius-control);background:#fff;color:#40765d;font-size:var(--gs-text-ui); }
.overview-song-image:deep(button), .overview-story-image:deep(button) { width:44px;padding:0;font-size:var(--gs-text-meta); }
.overview-reading { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gs-space-5);margin-top:var(--gs-space-5); }
.overview-story-list { display:grid; }
.overview-unit-name { margin:0;color:#6f8377;font-size:12px; }
.overview-story-summary { display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#637d6f;font-size:13px;line-height:1.6;font-weight:400; }
.overview-story { display:flex;align-items:center;gap:var(--gs-space-4);min-width:0;padding-block:var(--gs-space-3); }
.overview-story + .overview-story { border-top:1px solid #e5ece5; }
.overview-story > button, .overview-event > button { display:flex;align-items:center;justify-content:space-between;gap:var(--gs-space-4);width:100%;min-width:0;min-height:44px;padding:var(--gs-space-2) 0;border:0;background:transparent;color:inherit;text-align:left; }
.overview-story > button > span, .overview-event > button > span { display:grid;gap:var(--gs-space-2);min-width:0; }
.overview-story strong, .overview-event strong { font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold);line-height:1.5;overflow-wrap:anywhere; }
.overview-story small, .overview-event small { color:#708278;font-size:var(--gs-text-meta);overflow-wrap:anywhere; }
.overview-story > button > svg, .overview-event > button > svg { flex:none;color:#739884; }
.overview-event-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gs-space-4); }
.overview-event { min-width:0; }
.overview-status, .overview-error, .overview-empty { margin:0;padding:var(--gs-space-4) 0;color:#6b8274;font-size:var(--gs-text-ui); }
.overview-error { color:#875a40; }
.overview-error > button { min-height:44px;margin-left:var(--gs-space-4);padding:var(--gs-space-2) var(--gs-space-3);border:1px solid #dbc9bd;border-radius:var(--gs-radius-control);background:#fff;color:inherit;font-size:var(--gs-text-ui);font-weight:var(--gs-weight-semibold); }
.overview-footer { margin-top:var(--gs-space-6);padding:var(--gs-space-5) 0;color:#829387;font-size:var(--gs-text-meta); }
.overview-visually-hidden { position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap; }
@media (hover:hover) and (pointer:fine) {
  .overview-icon-button:hover, .overview-home-button:hover, .overview-stage-button:hover { background:#eaf5ee;border-color:#99c3ac; }
  .overview-section-heading > button:hover, .overview-card > button:hover, .overview-song-detail:hover, .overview-preferred-actions button:hover, .overview-search-results li > button:hover, .overview-story > button:hover, .overview-event > button:hover { color:#16825f; }
  .overview-search-submit:hover { background:#17684f; }
}
.portal-overview button:active { background-color:#e7f1eb; }
.overview-search-submit:active { background-color:#145b46; }
@container (max-width:900px) {
  .overview-card-image { width:min(100%,120px); }
  .overview-personal-meta { align-items:start; }
}
@container (max-width:800px) {
  .overview-bento, .overview-reading { grid-template-columns:1fr; }
  .overview-song-list { grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gs-space-4); }
  .overview-song + .overview-song { border-top:0; }
}
@media(max-width:900px) {
  .portal-overview-scroll { padding:var(--gs-space-6); }
  .overview-toolbar { align-items:start; }
  .overview-brand b { display:none; }
}
</style>
