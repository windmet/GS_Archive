<template>
  <section class="chart-song-picker" aria-label="选择曲目">
    <label class="chart-song-search">
      <Search :size="17" aria-hidden="true" />
      <input v-model="query" type="search" aria-label="搜索曲目" placeholder="搜索歌名或组合" autocomplete="off" enterkeyhint="search" />
    </label>
    <div class="chart-song-units" role="group" aria-label="按组合筛选">
      <button v-for="unit in units" :key="unit.id" type="button" :aria-pressed="unitFilter === unit.id" @click="unitFilter = unit.id">{{ unit.label }} <small>{{ unit.count }}</small></button>
    </div>
    <p class="chart-song-status" role="status">{{ songs.length ? `${matches.length} 首有谱面的曲目` : '正在读取曲目…' }}</p>
    <ul class="chart-song-list">
      <li v-for="song in matches" :key="song.code">
        <button type="button" class="chart-song-row" :data-song-code="song.code" :aria-pressed="song.code === selected" @click="emit('select', song.code)">
          <img v-if="song.jacketUrl && !failed.has(song.jacketUrl)" :src="song.jacketUrl" alt="" width="48" height="48" loading="lazy" @error="failed.add(song.jacketUrl)" />
          <span v-else class="chart-song-jacket" aria-hidden="true"><Music2 :size="20" /></span>
          <span class="chart-song-copy"><strong>{{ song.title }}</strong><small>{{ [song.unitName || '其他', `${song.difficultyCount} 档难度`].join(' · ') }}</small></span>
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-if="songs.length && !matches.length" class="chart-song-status">没有匹配的曲目，试试别的名字或组合。</p>
  </section>
</template>
<script setup>
import { computed, reactive, ref } from 'vue'
import { ChevronRight, Music2, Search } from '@lucide/vue'
// The chart tool's own song picker: the tool chooses its song inside, as the Chibi stage does.
const props = defineProps({ songs: { type: Array, default: () => [] }, selected: { type: String, default: '' } })
const emit = defineEmits(['select'])
const query = ref(''), unitFilter = ref(''), failed = reactive(new Set())
const OTHER = '__other'
const unitOf = song => song.unitName || OTHER
const units = computed(() => {
  const counts = new Map()
  for (const song of props.songs) counts.set(unitOf(song), (counts.get(unitOf(song)) || 0) + 1)
  const named = [...counts].filter(([id]) => id !== OTHER).map(([id, count]) => ({ id, label: id, count }))
  return [{ id: '', label: '全部', count: props.songs.length }, ...named, ...(counts.has(OTHER) ? [{ id: OTHER, label: '其他', count: counts.get(OTHER) }] : [])]
})
const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '')
const matches = computed(() => props.songs.filter(song => (!unitFilter.value || unitOf(song) === unitFilter.value) &&
  normalize(`${song.title} ${song.kana || ''} ${song.unitName || ''} ${song.code}`).includes(normalize(query.value))))
</script>
<style scoped>
.chart-song-picker { container: chart-song-picker / inline-size; color: var(--gs-ink); font-family: var(--gs-font-body); }
.chart-song-search { display: flex; align-items: center; gap: var(--gs-space-3); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink-3); }
.chart-song-search input { flex: 1; min-width: 0; min-height: var(--gs-control-touch); border: 0; outline: none; background: none; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-subtitle); }
.chart-song-search:focus-within { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.chart-song-units { display: flex; gap: var(--gs-space-2); overflow-x: auto; margin-top: var(--gs-space-4); padding: var(--gs-space-1) 0; scrollbar-width: none; }
.chart-song-units button { display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); white-space: nowrap; cursor: pointer; }
.chart-song-units button small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.chart-song-units button[aria-pressed=true] { border-color: var(--gs-ink); background: var(--gs-ink); color: var(--gs-paper); }
.chart-song-units button[aria-pressed=true] small { color: inherit; }
.chart-song-status { margin: var(--gs-space-3) 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.chart-song-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); column-gap: var(--gs-space-7); margin: 0; padding: 0; list-style: none; }
.chart-song-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) 18px; align-items: center; gap: var(--gs-space-4); width: 100%; min-height: 64px; padding: var(--gs-space-3) var(--gs-space-2); border: 0; border-bottom: 1px solid var(--gs-line); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.chart-song-row img, .chart-song-jacket { width: 48px; height: 48px; border-radius: var(--gs-radius-media); object-fit: cover; }
.chart-song-jacket { display: grid; place-items: center; background: var(--gs-line); color: var(--gs-ink-3); }
.chart-song-copy { display: flex; flex-direction: column; gap: var(--gs-space-1); min-width: 0; }
.chart-song-copy strong { display: -webkit-box; overflow: hidden; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.chart-song-copy small { overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
.chart-song-row > svg { color: var(--gs-ink-3); }
.chart-song-row[aria-pressed=true] { background: var(--gs-mint-wash); box-shadow: inset 2px 0 var(--gs-mint); }
.chart-song-row:hover strong { color: var(--gs-mint-ink); }
.chart-song-picker button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: calc(-1 * var(--gs-focus-ring)); }
@container chart-song-picker (max-width: 560px) {
  .chart-song-units button { min-height: var(--gs-control-touch); }
  .chart-song-list { grid-template-columns: 1fr; }
}
</style>
