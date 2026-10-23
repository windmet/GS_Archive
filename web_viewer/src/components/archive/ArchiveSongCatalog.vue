<template>
  <section class="song-catalog" data-archive-scroll-container>
    <ArchiveCatalogScope :idol="scopeIdol" :name="scopeIdol ? idolName(scopeIdol.id) : ''" @clear="emit('clear-idol')" />
    <header class="song-hero">
      <div>
        <p>浏览歌曲作品、演唱成员与不同演出版本；进入歌曲详情查看收录资料和可用试听。</p>
      </div>
      <dl aria-label="歌曲统计">
        <div><dt>歌曲作品</dt><dd>{{ catalog ? songs.length : '—' }}</dd></div>
        <div><dt>3DMV</dt><dd>{{ catalog ? summary.three_d_movie_count : '—' }}</dd></div>
        <div><dt>MV LIVE</dt><dd>{{ catalog ? summary.mvlive_count : '—' }}</dd></div>
        <div><dt>分轨演唱</dt><dd>{{ catalog ? summary.layered_song_count : '—' }}</dd></div>
      </dl>
    </header>

    <p v-if="status" class="song-catalog-status" role="status">
      {{ status }}
      <button v-if="status.includes('重试')" type="button" @click="$emit('retry')">重试</button>
    </p>

    <div class="song-toolbar">
      <div class="song-filters" role="group" aria-label="曲目过滤">
        <div class="song-filter-segment" role="group" aria-label="编制筛选">
          <button
            v-for="cat in lineupFilters"
            :key="cat.id"
            :class="{ active: activeLineup === cat.id }"
            :aria-pressed="activeLineup === cat.id"
            @click="setLineup(cat.id)"
          >
            {{ cat.label }}
            <span>{{ catalog ? lineupCount(cat.id) : '—' }}</span>
          </button>
        </div>
        <span class="song-filter-divider" aria-hidden="true"></span>
        <div class="song-filter-segment" role="group" aria-label="技术标签筛选">
          <button
            v-for="tag in techFilters"
            :key="tag.id"
            :class="{ active: activeTech === tag.id }"
            :aria-pressed="activeTech === tag.id"
            @click="setTech(tag.id)"
          >
            {{ tag.label }}
            <span>{{ catalog ? techCount(tag.id) : '—' }}</span>
          </button>
        </div>
      </div>
      <label class="song-search">
        <Search :size="16" aria-hidden="true" />
        <input
          :value="query"
          type="search"
          aria-label="搜索歌曲"
          placeholder="搜索曲名、读音或演唱者"
          @input="query = $event.target.value"
        />
      </label>
    </div>

    <div class="song-grid" :class="{ empty: !filteredSongs.length }">
      <button
        v-for="song in filteredSongs"
        :key="song.song_code"
        class="song-card"
        :data-archive-focus-id="`song:${song.song_code}`"
        @click="$emit('open', song.song_code)"
      >
        <span v-if="song.jacket_url" class="song-card-jacket">
          <img :src="song.jacket_url" :alt="`${song.title} 封面`" loading="lazy" decoding="async" width="365" height="360" />
        </span>
        <span v-else class="song-card-code">封面未收录</span>
        <span class="song-card-copy">
          <div class="song-card-head">
            <strong :title="song.title">{{ song.title }}</strong>
            <span v-if="songBadges(song).length" class="song-badges">
              <span
                v-for="badge in songBadges(song)"
                :key="badge.key"
                :class="['badge', badge.cls]"
              >{{ badge.label }}</span>
            </span>
          </div>
          <span class="song-performers" :title="performerLabel(song)">{{ performerSummary(song) }}</span>
          <span v-if="song.credits" class="song-credits" :title="song.credits">{{ songCreditsSingleLine(song.credits) }}</span>
        </span>
      </button>
    </div>
    <p v-if="!status && !filteredSongs.length" class="song-empty">没有匹配的曲目。</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Search } from '@lucide/vue'

import ArchiveCatalogScope from './ArchiveCatalogScope.vue'
import { songMatchesIdol } from '../../presentation/CatalogIdolScope.js'
import { SONG_LINEUP_TAXONOMY, classifySongLineup } from '../../presentation/SongPresentation.js'

const props = defineProps({
  scopeIdol: { type: Object, default: null },
  catalog: { type: Object, default: null },
  status: { type: String, default: '' },
  scope: { type: String, default: 'all' },
  query: { type: String, default: '' },
  idolName: { type: Function, default: () => '' },
  idolSearch: { type: Function, default: () => '' },
})
const emit = defineEmits(['open', 'retry', 'update:scope', 'update:query', 'clear-idol'])

const query = computed({
  get: () => props.query,
  set: value => emit('update:query', value),
})

const songs = computed(() => {
  const map = props.catalog?.songs || {}
  return Object.values(map)
    .filter(song => song.variant_kind === 'primary' && songMatchesIdol(song, props.scopeIdol))
    .sort((a, b) => (a.song_id || 0) - (b.song_id || 0))
})

const summary = computed(() => props.scopeIdol ? {
  three_d_movie_count: techCount('movie'), mvlive_count: techCount('mvlive'), layered_song_count: techCount('layered'),
} : props.catalog?.summary || {})

const lineupFilters = SONG_LINEUP_TAXONOMY

const techFilters = [
  { id: 'movie', label: '3DMV' },
  { id: 'mvlive', label: 'MV LIVE' },
  { id: 'layered', label: '分轨演唱' },
  { id: 'oneshot', label: 'Center 台词' },
  { id: 'special', label: '特殊版本' },
]

const TECH_TAG_IDS = new Set(['movie', 'mvlive', 'layered', 'oneshot', 'special'])
const LINEUP_IDS = new Set(['configurable_formation', 'fixed_unit', 'fixed_special_lineup'])

const activeLineup = computed(() => {
  const raw = props.scope || 'all'
  const parts = raw.split('+')
  const found = parts.find(p => LINEUP_IDS.has(p))
  return found || 'all'
})

const activeTech = computed(() => {
  const raw = props.scope || 'all'
  const parts = raw.split('+')
  const found = parts.find(p => TECH_TAG_IDS.has(p))
  return found || 'all'
})

function setLineup(id) {
  emitScope(id, activeTech.value)
}

function setTech(id) {
  const nextTech = activeTech.value === id ? 'all' : id
  emitScope(activeLineup.value, nextTech)
}

function emitScope(lineup, tech) {
  if (lineup !== 'all' && tech !== 'all') {
    emit('update:scope', `${lineup}+${tech}`)
  } else if (lineup !== 'all') {
    emit('update:scope', lineup)
  } else if (tech !== 'all') {
    emit('update:scope', tech)
  } else {
    emit('update:scope', 'all')
  }
}

function performerLabel(song) {
  const performance = song.performance || {}
  if (performance.unitName) return performance.unitName
  if (performance.scope === 'configurable_formation') return '自由编成 · 全组合可选'
  if (performance.performers?.length) return performance.performers.map(entry => props.idolName(entry.id) || entry.displayName).join('、')
  if (performance.scope === 'unspecified_special') return '特别演出'
  return '演唱者待确认'
}

function performerSummary(song) {
  return song.performance?.scope === 'configurable_formation' ? '自由编成' : performerLabel(song)
}

function hasMovie(song, kind) {
  return (song.movies || []).some(movie => movie.kind === kind)
}

function hasSpecialVariant(song) {
  return (song.variants || []).some(variant => variant.archive_status === 'special')
}

function songBadges(song) {
  const list = []
  if (hasSpecialVariant(song)) list.push({ key: 'special', label: '含特殊版本', cls: 'badge-special' })
  if (hasMovie(song, '3dmv')) list.push({ key: '3dmv', label: '3DMV', cls: 'badge-movie' })
  if (hasMovie(song, 'mvlive')) list.push({ key: 'mvlive', label: 'MV LIVE', cls: 'badge-movie' })
  if (song.audio_form === 'layered') list.push({ key: 'layered', label: '分轨演唱', cls: 'badge-layered' })
  if (song.audio_form === 'oneshot') list.push({ key: 'oneshot', label: 'Center 台词', cls: 'badge-oneshot' })
  return list
}

function songCreditsSingleLine(credits) {
  return String(credits || '').replace(/\r?\n+/g, ' · ').trim()
}

function lineupCount(id) {
  if (id === 'all') return songs.value.length
  return songs.value.filter(song => classifySongLineup(song) === id).length
}

function techCount(id) {
  if (id === 'movie') return songs.value.filter(song => hasMovie(song, '3dmv')).length
  if (id === 'mvlive') return songs.value.filter(song => hasMovie(song, 'mvlive')).length
  if (id === 'layered') return songs.value.filter(song => song.audio_form === 'layered').length
  if (id === 'oneshot') return songs.value.filter(song => song.audio_form === 'oneshot').length
  if (id === 'special') return songs.value.filter(hasSpecialVariant).length
  return 0
}

const filteredSongs = computed(() => {
  const q = query.value.trim().toLowerCase()
  return songs.value.filter(song => {
    if (activeLineup.value !== 'all' && classifySongLineup(song) !== activeLineup.value) return false
    if (activeTech.value === 'movie' && !hasMovie(song, '3dmv')) return false
    if (activeTech.value === 'mvlive' && !hasMovie(song, 'mvlive')) return false
    if (activeTech.value === 'layered' && song.audio_form !== 'layered') return false
    if (activeTech.value === 'oneshot' && song.audio_form !== 'oneshot') return false
    if (activeTech.value === 'special' && !hasSpecialVariant(song)) return false
    const variants = song.variants || []
    if (q && !(
      song.title?.toLowerCase().includes(q) ||
      song.kana?.toLowerCase().includes(q) ||
      song.song_code.toLowerCase().includes(q) ||
      performerLabel(song).toLowerCase().includes(q) ||
      (song.performance?.performers || []).some(entry => props.idolSearch(entry.id, entry.displayName).toLowerCase().includes(q)) ||
      variants.some(variant => (
        variant.title?.toLowerCase().includes(q) ||
        variant.song_code?.toLowerCase().includes(q)
      ))
    )) return false
    return true
  })
})
</script>

<style scoped>
.song-catalog { height: 100%; padding: var(--gs-space-7); overflow-y: auto; background: var(--gs-paper); font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
.song-catalog-status { padding: var(--gs-space-4) var(--gs-space-5); background: var(--gs-mint-wash); color: var(--gs-mint-ink); font-size: var(--gs-text-ui); }
.song-catalog-status button { margin-left: var(--gs-space-3); border: 0; background: none; color: var(--gs-mint-ink); font: inherit; text-decoration: underline; cursor: pointer; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); min-height: var(--gs-control-normal); }
.song-hero { display: grid; gap: var(--gs-space-4); padding-bottom: var(--gs-space-5); border-bottom: 1px solid var(--gs-line); }
.song-hero p { max-width: 62ch; margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.7; }
/* Archive scale as one line of figures. */
.song-hero dl { display: flex; flex-wrap: wrap; gap: var(--gs-space-2) var(--gs-space-8); margin: 0; }
.song-hero dl div { display: flex; flex-direction: row-reverse; align-items: baseline; gap: var(--gs-space-2); }
.song-hero dt { color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.song-hero dd { margin: 0; font-family: var(--gs-font-stage); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.song-toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); flex-wrap: wrap; padding: var(--gs-space-5) 0 var(--gs-space-4); }
.song-filters { display: flex; align-items: center; gap: var(--gs-space-2, 8px); flex-wrap: wrap; }
.song-filter-segment { display: flex; align-items: center; gap: var(--gs-space-2, 8px); flex-wrap: wrap; }
.song-filter-divider { width: 1px; height: 18px; background: var(--gs-line); margin: 0 var(--gs-space-2, 8px); align-self: center; flex: none; }
.song-filters button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--gs-control-compact);
  padding: 0 var(--gs-space-4);
  border: 1px solid var(--gs-line);
  border-radius: var(--gs-radius-pill);
  background: var(--gs-surface);
  color: var(--gs-ink-2);
  font: inherit;
  font-size: var(--gs-text-ui);
  cursor: pointer;
  font-weight: var(--gs-weight-regular);
}
.song-filters button span { color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-medium); }
.song-filters button.active { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }
.song-filters button.active span { color: inherit; }
.song-search {
  display: inline-flex;
  align-items: center;
  gap: var(--gs-space-3);
  height: var(--gs-control-normal);
  min-width: 240px;
  padding: 0 var(--gs-space-4);
  border: 1px solid var(--gs-line);
  border-radius: var(--gs-radius-field);
  color: var(--gs-ink-3);
  background: var(--gs-surface);
}
.song-search input { min-width: 0; width: 100%; height: 100%; border: 0; outline: 0; background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-regular); }
.song-search:focus-within { border-color: var(--gs-mint-ink); outline: var(--gs-focus-ring) solid var(--gs-mint-ink); outline-offset: var(--gs-focus-offset); }
.song-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--gs-space-6); }
.song-grid.empty { display: block; }
.song-card {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: var(--gs-space-4, 12px);
  min-height: 88px;
  padding: var(--gs-space-3, 10px) var(--gs-space-4, 12px);
  border: 0;
  border-bottom: 1px solid var(--gs-line);
  border-radius: var(--gs-radius-control, 6px);
  box-shadow: none;
  background: transparent;
  color: var(--gs-ink);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: background .15s ease;
}
.song-card:focus-visible, .song-filters button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint-ink); outline-offset: calc(-1 * var(--gs-focus-ring)); }
.song-card-code {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 8px;
  background: var(--gs-mint-wash);
  color: var(--gs-mint-ink);
  font-size: var(--gs-text-caption);
  font-weight: var(--gs-weight-semibold);
  word-break: break-all;
  padding: 4px;
  text-align: center;
  flex: none;
}
.song-card-jacket {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--gs-line);
  flex: none;
}
.song-card-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
.song-card-copy { display: flex; flex-direction: column; justify-content: center; gap: 4px; min-width: 0; }
.song-card-head { display: flex; align-items: baseline; gap: var(--gs-space-2, 8px); min-width: 0; }
.song-card-head strong { font-size: var(--gs-text-subtitle, 16px); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--gs-weight-semibold); }
.song-badges { display: inline-flex; align-items: baseline; gap: var(--gs-space-1, 4px) var(--gs-space-2, 8px); flex-shrink: 0; }
.song-credits { color: var(--gs-ink-3); font-size: var(--gs-text-caption, 11px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: var(--gs-weight-regular); }
.song-performers { color: var(--gs-ink-2); font-size: var(--gs-text-meta, 12px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--gs-weight-regular); }
/* Song forms read as a quiet text list, not coloured pills. */
.badge { color: var(--gs-mint-ink); font-size: var(--gs-text-meta, 12px); font-weight: var(--gs-weight-medium); white-space: nowrap; }
.badge + .badge::before { content: "·"; margin-right: var(--gs-space-2); color: var(--gs-ink-3); }
.badge-muted { color: var(--gs-ink-3); }
.song-empty { color: var(--gs-ink-3); font-size: var(--gs-text-ui); padding: 22px 4px; font-weight: var(--gs-weight-regular); }

@media (max-width: 980px) {
  .song-grid { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .song-catalog { padding: 0 var(--gs-space-4) calc(76px + env(safe-area-inset-bottom)); }
  .song-hero { display: none; }
  .song-toolbar { position: sticky; top: 0; z-index: 2; display: grid; gap: var(--gs-space-3); padding: var(--gs-space-3) 0 var(--gs-space-4); background: var(--gs-paper); }
  .song-filters { min-width: 0; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
  .song-filters::-webkit-scrollbar { display: none; }
  .song-filter-segment { flex-wrap: nowrap; flex: none; }
  .song-filters button { flex: 0 0 auto; min-height: var(--gs-control-touch); white-space: nowrap; }
  .song-search { min-width: 0; height: var(--gs-control-touch); }
  .song-grid { gap: 0; }
  .song-card { grid-template-columns: 60px minmax(0, 1fr); gap: var(--gs-space-3); padding: var(--gs-space-3) 0; }
  .song-card-jacket, .song-card-code { width: 60px; height: 60px; border-radius: 8px; }
  .song-card-copy { gap: 2px; }
  .song-credits { display: none; }
  .song-performers { font-size: var(--gs-text-meta); line-height: 15px; }
  .song-badges { gap: var(--gs-space-2); }
  .badge { line-height: 1.4; padding: 0; }
}

@media (hover: hover) and (pointer: fine) {
  .song-card:hover { background: var(--gs-mint-wash); }
}

@media (max-width: 760px), (pointer: coarse) {
  .song-search { height: var(--gs-control-touch); }
  .song-search input { font-size: var(--gs-text-subtitle); }
  .song-filters button, .song-catalog-status button { min-height: var(--gs-control-touch); }
  .song-catalog-status button { min-width: var(--gs-control-touch); }
}
</style>
