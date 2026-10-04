<template>
  <section class="song-catalog" data-archive-scroll-container>
    <ArchiveCatalogScope :idol="scopeIdol" :name="scopeIdol ? idolName(scopeIdol.id) : ''" @clear="emit('clear-idol')" />
    <header class="song-hero">
      <div>
        <span>SONG ARCHIVE</span>
        <p>浏览歌曲作品、演唱成员与不同演出版本；进入歌曲详情查看收录资料和可用试听。</p>
      </div>
      <dl aria-label="歌曲档案统计">
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
        <button
          v-for="filter in filters"
          :key="filter.id"
          :class="{ active: activeFilter === filter.id }"
          :aria-pressed="activeFilter === filter.id"
          @click="activeFilter = filter.id"
        >
          {{ filter.label }}
          <span>{{ catalog ? filterCount(filter.id) : '—' }}</span>
        </button>
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
          <small>{{ song.kana }}</small>
          <strong :title="song.title">{{ song.title }}</strong>
          <span class="song-performers" :title="performerLabel(song)">{{ performerSummary(song) }}</span>
          <span v-if="song.credits" class="song-credits">{{ song.credits }}</span>
          <span class="song-badges">
            <span v-if="hasSpecialVariant(song)" class="badge badge-special">含特殊版本</span>
            <span v-if="hasMovie(song, '3dmv')" class="badge badge-movie">3DMV</span>
            <span v-if="hasMovie(song, 'mvlive')" class="badge badge-movie">MV LIVE</span>
            <span v-if="song.audio_form === 'layered'" class="badge badge-layered">分轨演唱</span>
            <span v-if="song.audio_form === 'oneshot'" class="badge badge-oneshot">演出语音</span>
          </span>
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

const activeFilter = computed({
  get: () => props.scope,
  set: value => emit('update:scope', value),
})
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
  three_d_movie_count: filterCount('movie'), mvlive_count: filterCount('mvlive'), layered_song_count: filterCount('layered'),
} : props.catalog?.summary || {})

const filters = [
  { id: 'all', label: '全部' },
  { id: 'movie', label: '3DMV' },
  { id: 'mvlive', label: 'MV LIVE' },
  { id: 'layered', label: '分轨演唱' },
  { id: 'oneshot', label: '演出语音' },
  { id: 'special', label: '特殊版本' },
]

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

function filterCount(id) {
  if (id === 'all') return songs.value.length
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
    if (activeFilter.value === 'movie' && !hasMovie(song, '3dmv')) return false
    if (activeFilter.value === 'mvlive' && !hasMovie(song, 'mvlive')) return false
    if (activeFilter.value === 'layered' && song.audio_form !== 'layered') return false
    if (activeFilter.value === 'oneshot' && song.audio_form !== 'oneshot') return false
    if (activeFilter.value === 'special' && !hasSpecialVariant(song)) return false
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
.song-catalog { height: 100%; padding: var(--gs-space-7); overflow-y: auto; background: #f7f9fa; font-family: var(--gs-font-directory); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); }
.song-catalog-status { padding: var(--gs-space-4) var(--gs-space-5); background: #eef8f7; color: #246d67; font-size: var(--gs-text-ui); }
.song-catalog-status button { margin-left: var(--gs-space-3); border: 0; background: none; color: #176f69; font: inherit; text-decoration: underline; cursor: pointer; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); min-height: var(--gs-control-normal); }
.song-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--gs-space-7);
  padding: 22px 26px;
  border-bottom: 3px solid #28b6ac;
  background: #17212b;
  color: #fff;
}
.song-hero span { color: #56d0c7; font-size: var(--gs-text-caption); font-weight: var(--gs-weight-heavy); }
.song-hero p { margin: var(--gs-space-3) 0 0; color: #aeb9c2; font-size: var(--gs-text-meta); max-width: 520px; font-weight: var(--gs-weight-regular); }
.song-hero dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; }
.song-hero dl div { min-width: 0; padding: 7px 14px; border-left: 1px solid #34414c; }
.song-hero dt { color: #98a6b1; font-size: var(--gs-text-caption); white-space: nowrap; font-weight: var(--gs-weight-regular); }
.song-hero dd { margin: 5px 0 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-bold); }
.song-toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); flex-wrap: wrap; padding: var(--gs-space-5) 0 var(--gs-space-4); }
.song-filters { display: flex; gap: var(--gs-space-3); flex-wrap: wrap; }
.song-filters button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--gs-control-compact);
  padding: 0 11px;
  border: 1px solid #dfe4e8;
  border-radius: 999px;
  background: #fff;
  color: #5c6771;
  font: inherit;
  font-size: var(--gs-text-ui);
  cursor: pointer;
  font-weight: var(--gs-weight-semibold);
}
.song-filters button span { color: #9aa4ad; font-size: var(--gs-text-caption); font-weight: var(--gs-weight-medium); }
.song-filters button.active { border-color: #2bb3aa; background: #eaf8f6; color: #158f87; }
.song-search {
  display: inline-flex;
  align-items: center;
  gap: var(--gs-space-3);
  height: var(--gs-control-normal);
  min-width: 240px;
  padding: 0 11px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  color: #8a949e;
  background: #fff;
}
.song-search input { min-width: 0; width: 100%; height: 100%; border: 0; outline: 0; background: transparent; color: #18212b; font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-regular); }
.song-search:focus-within { border-color: #158f87; outline: var(--gs-focus-ring) solid #158f87; outline-offset: var(--gs-focus-offset); }
.song-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--gs-space-6); }
.song-grid.empty { display: block; }
.song-card {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  align-items: center;
  gap: var(--gs-space-4);
  height: auto;
  min-height: 72px;
  padding: var(--gs-space-4);
  border: 0;
  border-bottom: 1px solid #dfe4e8;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  color: #26313a;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.song-card:focus-visible, .song-filters button:focus-visible { outline: var(--gs-focus-ring) solid #158f87; outline-offset: calc(-1 * var(--gs-focus-ring)); }
.song-card-code {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 6px;
  background: #eaf8f6;
  color: #158f87;
  font-size: var(--gs-text-caption);
  font-weight: var(--gs-weight-semibold);
  word-break: break-all;
}
.song-card-jacket {
  width: 46px;
  height: 46px;
  border-radius: 6px;
  overflow: hidden;
  background: #eef1f4;
}
.song-card-jacket img { width: 100%; height: 100%; object-fit: cover; display: block; }
.song-card-copy { display: flex; flex-direction: column; gap: var(--gs-space-2); min-width: 0; }
.song-card-copy small { color: #8a949e; font-size: var(--gs-text-caption); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--gs-weight-regular); }
.song-card-copy strong { font-size: var(--gs-text-subtitle); line-height: 1.4; overflow-wrap: anywhere; white-space: normal; font-weight: var(--gs-weight-semibold); }
.song-credits { color: #7a858e; font-size: var(--gs-text-caption); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; font-weight: var(--gs-weight-regular); }
.song-performers { color: #596d7c; font-size: var(--gs-text-meta); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--gs-weight-regular); }
.song-badges { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2); }
.badge { max-width: 100%; padding: var(--gs-space-1) var(--gs-space-3); border-radius: var(--gs-radius-pill); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-medium); overflow-wrap: anywhere; }
.badge-movie { background: #fff3e0; color: #b26a00; }
.badge-layered { background: #e8f0fe; color: #2f5fd0; }
.badge-oneshot { background: #f3e8fd; color: #7a3fd0; }
.badge-special { background: #f3e8fd; color: #7136a5; }
.badge-muted { background: #eef1f4; color: #68727d; }
.song-empty { color: #7a858e; font-size: var(--gs-text-ui); padding: 22px 4px; font-weight: var(--gs-weight-regular); }

@media (max-width: 980px) {
  .song-hero { grid-template-columns: 1fr; }
  .song-hero dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .song-hero dl div:nth-child(3) { border-left: 0; }
  .song-grid { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .song-catalog { padding: 0 var(--gs-space-4) calc(76px + env(safe-area-inset-bottom)); }
  .song-hero { display: none; }
  .song-toolbar { position: sticky; top: 0; z-index: 2; display: grid; gap: var(--gs-space-3); padding: var(--gs-space-3) 0 var(--gs-space-4); background: #f7f9fa; }
  .song-filters { min-width: 0; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
  .song-filters::-webkit-scrollbar { display: none; }
  .song-filters button { flex: 0 0 auto; min-height: var(--gs-control-touch); white-space: nowrap; }
  .song-search { min-width: 0; height: var(--gs-control-touch); }
  .song-grid { gap: 0; }
  .song-card { grid-template-columns: 52px minmax(0, 1fr); gap: var(--gs-space-4); padding: var(--gs-space-3) 0; }
  .song-card-jacket, .song-card-code { width: 52px; height: 52px; border-radius: 7px; }
  .song-card-copy { gap: var(--gs-space-1); }
  .song-card-copy small, .song-credits { display: none; }
  .song-performers { font-size: var(--gs-text-meta); line-height: 15px; }
  .song-badges { gap: var(--gs-space-2); }
  .badge { line-height: 1.4; padding: 0 var(--gs-space-2); }
}

@media (hover: hover) and (pointer: fine) {
  .song-card:hover { background: #eef7f6; }
}

@media (max-width: 760px), (pointer: coarse) {
  .song-search { height: var(--gs-control-touch); }
  .song-search input { font-size: var(--gs-text-subtitle); }
  .song-filters button, .song-catalog-status button { min-height: var(--gs-control-touch); }
  .song-catalog-status button { min-width: var(--gs-control-touch); }
}
</style>
