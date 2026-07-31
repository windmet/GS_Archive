<template>
  <section class="song-catalog">
    <header class="song-hero">
      <div>
        <span>SONG ARCHIVE</span>
        <h2>歌曲档案</h2>
        <p>按 masterdata 正式曲目归档歌曲与演出版本。档案只展示元数据与原始资源关系，不提供媒体播放。</p>
      </div>
      <dl aria-label="歌曲档案统计">
        <div><dt>正式曲目</dt><dd>{{ songs.length }}</dd></div>
        <div><dt>3DMV</dt><dd>{{ summary.three_d_movie_count }}</dd></div>
        <div><dt>MV LIVE</dt><dd>{{ summary.mvlive_count }}</dd></div>
        <div><dt>分层演出</dt><dd>{{ summary.layered_song_count }}</dd></div>
      </dl>
    </header>

    <div class="song-toolbar">
      <div class="song-filters" role="group" aria-label="曲目过滤">
        <button
          v-for="filter in filters"
          :key="filter.id"
          :class="{ active: activeFilter === filter.id }"
          @click="activeFilter = filter.id"
        >
          {{ filter.label }}
          <span>{{ filterCount(filter.id) }}</span>
        </button>
      </div>
      <label class="song-search">
        <Search :size="16" aria-hidden="true" />
        <input v-model="query" type="search" placeholder="搜索曲名、读音或曲目代码" />
      </label>
    </div>

    <div class="song-grid" :class="{ empty: !filteredSongs.length }">
      <button
        v-for="song in filteredSongs"
        :key="song.song_code"
        class="song-card"
        :class="{ unavailable: !song.available }"
        @click="$emit('open', song.song_code)"
      >
        <span v-if="song.jacket_url" class="song-card-jacket">
          <img :src="song.jacket_url" :alt="`${song.title} 封面`" loading="lazy" />
        </span>
        <span v-else class="song-card-code">{{ song.song_code }}</span>
        <span class="song-card-copy">
          <small>{{ song.kana }}</small>
          <strong>{{ song.title }}</strong>
          <span v-if="song.credits" class="song-credits">{{ song.credits }}</span>
        </span>
        <span class="song-badges">
          <span v-if="!song.available" class="badge badge-muted">未开放</span>
          <span v-if="hasMovie(song, '3dmv')" class="badge badge-movie">3DMV</span>
          <span v-if="hasMovie(song, 'mvlive')" class="badge badge-movie">MV LIVE</span>
          <span v-if="song.audio_form === 'layered'" class="badge badge-layered">分层演出</span>
          <span v-if="song.audio_form === 'oneshot'" class="badge badge-oneshot">演出语音</span>
        </span>
        <ChevronRight :size="17" aria-hidden="true" />
      </button>
    </div>
    <p v-if="!filteredSongs.length" class="song-empty">没有匹配的曲目。</p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ChevronRight, Search } from '@lucide/vue'

const props = defineProps({
  catalog: { type: Object, default: null },
})
defineEmits(['open'])

const activeFilter = ref('all')
const query = ref('')

const songs = computed(() => {
  const map = props.catalog?.songs || {}
  return Object.values(map).sort((a, b) => (a.song_id || 0) - (b.song_id || 0))
})
const summary = computed(() => props.catalog?.summary || {})

const filters = [
  { id: 'all', label: '全部' },
  { id: 'movie', label: '3DMV' },
  { id: 'mvlive', label: 'MV LIVE' },
  { id: 'layered', label: '分层演出' },
  { id: 'oneshot', label: '演出语音' },
  { id: 'unavailable', label: '未开放' },
]

function hasMovie(song, kind) {
  return (song.movies || []).some(movie => movie.kind === kind)
}

function filterCount(id) {
  if (id === 'all') return songs.value.length
  if (id === 'movie') return songs.value.filter(song => hasMovie(song, '3dmv')).length
  if (id === 'mvlive') return songs.value.filter(song => hasMovie(song, 'mvlive')).length
  if (id === 'layered') return songs.value.filter(song => song.audio_form === 'layered').length
  if (id === 'oneshot') return songs.value.filter(song => song.audio_form === 'oneshot').length
  if (id === 'unavailable') return songs.value.filter(song => !song.available).length
  return 0
}

const filteredSongs = computed(() => {
  const q = query.value.trim().toLowerCase()
  return songs.value.filter(song => {
    if (activeFilter.value === 'movie' && !hasMovie(song, '3dmv')) return false
    if (activeFilter.value === 'mvlive' && !hasMovie(song, 'mvlive')) return false
    if (activeFilter.value === 'layered' && song.audio_form !== 'layered') return false
    if (activeFilter.value === 'oneshot' && song.audio_form !== 'oneshot') return false
    if (activeFilter.value === 'unavailable' && song.available) return false
    if (q && !(
      song.title?.toLowerCase().includes(q) ||
      song.kana?.toLowerCase().includes(q) ||
      song.song_code.toLowerCase().includes(q)
    )) return false
    return true
  })
})
</script>

<style scoped>
.song-catalog { height: 100%; padding: 24px; overflow-y: auto; background: #f7f9fa; }
.song-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 22px 26px;
  border-bottom: 3px solid #28b6ac;
  background: #17212b;
  color: #fff;
}
.song-hero span { color: #56d0c7; font-size: 0.68rem; font-weight: 800; }
.song-hero h2 { margin: 6px 0 0; font-size: 1.4rem; }
.song-hero p { margin: 8px 0 0; color: #aeb9c2; font-size: 0.76rem; max-width: 520px; }
.song-hero dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; }
.song-hero dl div { min-width: 0; padding: 7px 14px; border-left: 1px solid #34414c; }
.song-hero dt { color: #98a6b1; font-size: 0.64rem; white-space: nowrap; }
.song-hero dd { margin: 5px 0 0; font-size: 1.15rem; font-weight: 750; }
.song-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 16px 0 12px; }
.song-filters { display: flex; gap: 7px; flex-wrap: wrap; }
.song-filters button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 11px;
  border: 1px solid #dfe4e8;
  border-radius: 999px;
  background: #fff;
  color: #5c6771;
  font: inherit;
  font-size: 0.74rem;
  cursor: pointer;
}
.song-filters button span { color: #9aa4ad; font-size: 0.66rem; }
.song-filters button.active { border-color: #2bb3aa; background: #eaf8f6; color: #158f87; }
.song-search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  min-width: 240px;
  padding: 0 11px;
  border: 1px solid #d7dde2;
  border-radius: 6px;
  color: #8a949e;
  background: #fff;
}
.song-search input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: #18212b; font: inherit; font-size: 0.78rem; }
.song-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.song-grid.empty { display: block; }
.song-card {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  min-height: 92px;
  padding: 13px 14px;
  border: 1px solid #dfe4e8;
  border-radius: 6px;
  background: #fff;
  color: #26313a;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.song-card:hover { border-color: #7bcfc9; background: #f0fbfa; }
.song-card.unavailable { opacity: 0.62; }
.song-card-code {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 6px;
  background: #eaf8f6;
  color: #158f87;
  font-size: 0.66rem;
  font-weight: 750;
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
.song-card-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.song-card-copy small { color: #8a949e; font-size: 0.66rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-card-copy strong { font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-credits { color: #7a858e; font-size: 0.66rem; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.song-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.badge { padding: 2px 8px; border-radius: 999px; font-size: 0.62rem; font-weight: 700; }
.badge-movie { background: #fff3e0; color: #b26a00; }
.badge-layered { background: #e8f0fe; color: #2f5fd0; }
.badge-oneshot { background: #f3e8fd; color: #7a3fd0; }
.badge-muted { background: #eef1f4; color: #68727d; }
.song-card > svg { color: #9aa4ad; }
.song-empty { color: #7a858e; font-size: 0.8rem; padding: 22px 4px; }

@media (max-width: 980px) {
  .song-hero { grid-template-columns: 1fr; }
  .song-hero dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .song-hero dl div:nth-child(3) { border-left: 0; }
  .song-grid { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .song-catalog { padding: 12px; }
  .song-hero { padding: 18px; }
  .song-card { grid-template-columns: 40px minmax(0, 1fr) auto; }
  .song-card-jacket { width: 40px; height: 40px; }
  .song-badges { grid-column: 2 / -1; flex-direction: row; align-items: center; }
}
</style>
