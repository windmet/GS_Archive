<template>
  <section class="chart-table" aria-labelledby="live-song-start">
    <h2 id="live-song-start">从一首歌开始</h2>
    <GsTabs v-model="difficulty" :options="DIFFICULTIES" aria-label="难度" />
    <div class="chart-table-tools">
      <label class="chart-table-search">
        <Search :size="17" aria-hidden="true" />
        <input v-model="query" type="search" aria-label="搜索曲目" placeholder="搜索歌名或组合" autocomplete="off" />
      </label>
      <GsFilterPanel v-model="filters" :sections="sections" :result-label="`显示 ${rows.length} 张`">
        <template #sheet>
          <section class="chart-table-sort" aria-label="排序">
            <div class="chart-table-sort-head"><h3>排序</h3><button type="button" class="chart-table-dir" @click="direction = -direction">{{ direction > 0 ? '升序' : '降序' }}<component :is="direction > 0 ? ArrowUp : ArrowDown" :size="15" aria-hidden="true" /></button></div>
            <div class="chart-table-sort-options">
              <button v-for="column in SORTS" :key="column.key" type="button" :aria-pressed="sort === column.key" @click="sortBy(column.key, false)">{{ column.label }}</button>
            </div>
          </section>
        </template>
      </GsFilterPanel>
    </div>

    <p v-if="!songs.length" class="chart-table-status" role="status">正在读取曲目…</p>
    <template v-else>
      <div class="chart-table-meta">
        <span>{{ rows.length }} 张谱面 · 按{{ sortLabel }}{{ direction > 0 ? '升序' : '降序' }}</span>
        <span class="chart-table-legend" aria-hidden="true">音符构成<span v-for="kind in NOTE_KINDS" :key="kind.key"><i :class="`is-${kind.key}`"></i>{{ kind.label }}</span></span>
      </div>
      <div class="chart-grid chart-head">
        <template v-for="column in COLUMNS" :key="column.key">
          <span class="chart-head-cell" :class="[`col-${column.key}`, { 'is-end': column.num }]">
            <button v-if="column.sort" type="button" :aria-pressed="sort === column.sort" :aria-label="`按${column.label}排序`" @click="sortBy(column.sort, true)">{{ column.label }}<component :is="direction > 0 ? ArrowUp : ArrowDown" v-if="sort === column.sort" :size="13" aria-hidden="true" /></button>
            <span v-else-if="column.label">{{ column.label }}</span>
            <GsInfo v-if="column.source" :label="`${column.label}的来源`">{{ column.source }}</GsInfo>
          </span>
        </template>
      </div>
      <p v-if="!rows.length" class="chart-table-status">没有符合条件的谱面。<button type="button" @click="reset">清除筛选</button></p>
      <ul v-else class="chart-rows">
        <li v-for="row in rows" :key="row.key" class="song-row chart-grid chart-row" :style="{ '--diff': DIFF_COLORS[row.type] }">
          <button type="button" class="chart-row-open" :aria-label="`打开谱面：${row.title} ${row.label} ${row.levelLabel}`" @click="emit('chart-song', row.code, row.type)"></button>
          <span class="col-song">
            <img v-if="row.jacket" :src="row.jacket" alt="" width="40" height="40" loading="lazy" decoding="async" />
            <span v-else class="chart-row-nojacket" aria-hidden="true"></span>
            <span class="chart-row-copy">
              <strong :title="row.title">{{ row.title }}</strong>
              <small><i class="chart-attr" :style="{ backgroundImage: ATTRIBUTES[row.attribute].icon }" :title="ATTRIBUTES[row.attribute].label" aria-hidden="true"></i>{{ row.unit }}</small>
              <small class="chart-row-stats">{{ row.maxCombo }} combo · BPM {{ row.bpm }} · {{ row.time }}</small>
              <span class="chart-mix is-inline" aria-hidden="true"><i v-for="kind in NOTE_KINDS" :key="kind.key" :class="`is-${kind.key}`" :style="{ flexGrow: row.mix[kind.key] }"></i></span>
            </span>
          </span>
          <span class="col-diff chart-row-diff">{{ row.label }}</span>
          <span class="col-level chart-row-level">{{ row.levelLabel }}</span>
          <span class="col-combo is-num">{{ row.maxCombo }}</span>
          <span class="col-bpm is-num">{{ row.bpm }}</span>
          <span class="col-time is-num">{{ row.time }}</span>
          <span class="col-mix chart-mix" :title="row.mixLabel" aria-hidden="true"><i v-for="kind in NOTE_KINDS" :key="kind.key" :class="`is-${kind.key}`" :style="{ flexGrow: row.mix[kind.key] }"></i></span>
          <span class="col-since"><span>{{ UNLOCKS[row.unlock] }}</span><small>{{ row.since }}</small></span>
          <span class="col-stage"><button type="button" class="chart-row-stage" :aria-label="`${row.title} 的 2D 舞台`" title="2D 舞台" @click="emit('stage-song', row.code)"><Clapperboard :size="18" aria-hidden="true" /></button></span>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Clapperboard, Search } from '@lucide/vue'
import GsFilterPanel from '../gs/GsFilterPanel.vue'
import GsInfo from '../gs/GsInfo.vue'
import GsTabs from '../gs/GsTabs.vue'
import { classifySongLineup } from '../../presentation/SongPresentation.js'
import { formatChartTime } from '../../presentation/SongChartTiming.js'
import table from '../../data/liveChartTable.json'

// LIVE 「从一首歌开始」 as a chart table: one row per chart, sortable by level, combo, BPM and length, so a song's four
// difficulties can be compared across the whole catalogue. A row opens the chart tool on that difficulty; the stage
// door sits at the row's end on wide screens. Figures come from scripts/generate-live-chart-table.mjs; titles, units and
// jackets from the catalogue rows the page already holds. No score multipliers: the archive has no such data.
const props = defineProps({ songs: { type: Array, default: () => [] } })
const emit = defineEmits(['chart-song', 'stage-song'])

const DIFFICULTIES = [{ value: 4, label: 'EXPERT' }, { value: 3, label: 'HARD' }, { value: 2, label: 'NORMAL' }, { value: 1, label: 'EASY · PASSION' }, { value: 0, label: '全部难度' }]
const DIFF_COLORS = { 1: 'var(--gs-diff-easy)', 2: 'var(--gs-diff-normal)', 3: 'var(--gs-diff-hard)', 4: 'var(--gs-diff-expert)' }
const ATTRIBUTES = {
  physical: { label: 'Physical', icon: 'var(--gs-attr-icon-physical)' }, intelli: { label: 'Intelli', icon: 'var(--gs-attr-icon-intelli)' },
  mental: { label: 'Mental', icon: 'var(--gs-attr-icon-mental)' }, all: { label: '全属性', icon: 'var(--gs-attr-icon-all)' },
}
const UNLOCKS = { initial: '初始开放', free: '追加', story: '主线解锁', event: '活动先行', limited: '限定' }
const NOTE_KINDS = [{ key: 'tap', label: '点击' }, { key: 'hold', label: '长按' }, { key: 'flick', label: '滑键' }, { key: 'large', label: '大音符' }, { key: 'special', label: 'Special' }]
const SORTS = [{ key: 'order', label: '实装顺序' }, { key: 'level', label: '等级' }, { key: 'combo', label: 'Combo' }, { key: 'bpm', label: 'BPM' }, { key: 'time', label: '时长' }]
const COLUMNS = [
  { key: 'song', label: '曲目', sort: 'order' }, { key: 'diff', label: '难度' }, { key: 'level', label: '等级', sort: 'level', num: true },
  { key: 'combo', label: 'Combo', sort: 'combo', num: true }, { key: 'bpm', label: 'BPM', sort: 'bpm', num: true, source: '由谱面文件的速度标记读出，不是主数据字段。' },
  { key: 'time', label: '时长', sort: 'time', num: true, source: '完整混音音频的长度，不是主数据字段。' },
  { key: 'mix', label: '音符构成', source: '由谱面文件逐个音符统计：点击、长按、滑键、大音符、Special。' },
  { key: 'since', label: '实装', sort: 'since' }, { key: 'stage', label: '' },
]
const SORT_KEYS = {
  order: row => row.songId * 10 + row.type, level: row => row.level * 10000 + row.maxCombo, combo: row => row.maxCombo,
  bpm: row => row.bpmMax, time: row => row.seconds, since: row => Number(row.since.replaceAll('-', '')) * 10 + row.type,
}

const difficulty = ref(4), query = ref(''), sort = ref('order'), direction = ref(1)
const filters = ref({ attribute: 'all', unlock: 'all', unit: 'all' })
// A column header sorts and, pressed again, reverses; the sheet's sort chips only choose the column.
function sortBy(key, flip) {
  if (sort.value === key) { if (flip) direction.value = -direction.value; return }
  sort.value = key
  direction.value = key === 'order' || key === 'since' ? 1 : -1
}
const sortLabel = computed(() => (SORTS.find(entry => entry.key === sort.value) || { label: '实装日期' }).label)
function reset() { filters.value = { attribute: 'all', unlock: 'all', unit: 'all' }; query.value = '' }

// Variants (the April Fools DRIVE A LIVE) are not catalogue rows of their own; they borrow their parent's row.
const catalogue = computed(() => {
  const byCode = new Map()
  for (const song of props.songs) {
    byCode.set(song.song_code, { song, title: song.title })
    for (const variant of song.variants || []) if (!byCode.has(variant.song_code)) byCode.set(variant.song_code, { song, title: variant.title || song.title })
  }
  return byCode
})
const unitOf = song => classifySongLineup(song) === 'configurable_formation' ? '全员' : song.performance?.unitName || '特别编成'
const allRows = computed(() => table.songs.flatMap(entry => {
  const found = catalogue.value.get(entry.code)
  if (!found) return []
  const { song, title } = found
  const bpm = entry.bpm[0] === entry.bpm[1] ? String(entry.bpm[0]) : `${entry.bpm[0]}–${entry.bpm[1]}`
  return entry.charts.map(chart => ({
    ...chart, key: `${entry.code}:${chart.type}`, code: entry.code, songId: entry.songId, title, kana: song.kana || '',
    jacket: song.jacket_url || '', unit: unitOf(song), attribute: entry.attribute, unlock: entry.unlock, since: entry.firstImplementedOn,
    bpm, bpmMax: entry.bpm[1], seconds: entry.seconds, time: formatChartTime(entry.seconds),
    mixLabel: NOTE_KINDS.map(kind => `${kind.label} ${chart.mix[kind.key]}`).join(' · '),
  }))
}))
const units = computed(() => [...new Set(allRows.value.map(row => row.unit))])
const sections = computed(() => [
  { key: 'attribute', label: '属性', options: [{ value: 'all', label: '全部' },
    ...['physical', 'intelli', 'mental'].map(key => ({ value: key, label: ATTRIBUTES[key].label, swatch: ATTRIBUTES[key].icon })),
    { value: 'all-attribute', label: '全属性曲', swatch: ATTRIBUTES.all.icon }] },
  { key: 'unlock', label: '解锁方式', options: [{ value: 'all', label: '全部' }, ...Object.entries(UNLOCKS).map(([value, label]) => ({ value, label }))] },
  { key: 'unit', label: '组合', options: [{ value: 'all', label: '全部' }, ...units.value.map(unit => ({ value: unit, label: unit }))] },
])
const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '')
const rows = computed(() => {
  const needle = normalize(query.value), { attribute, unlock, unit } = filters.value
  const key = SORT_KEYS[sort.value]
  return allRows.value.filter(row => (!difficulty.value || row.type === difficulty.value)
    && (attribute === 'all' || row.attribute === (attribute === 'all-attribute' ? 'all' : attribute))
    && (unlock === 'all' || row.unlock === unlock) && (unit === 'all' || row.unit === unit)
    && (!needle || normalize([row.title, row.kana, row.code, row.unit].join(' ')).includes(needle)))
    .sort((a, b) => (key(a) - key(b)) * direction.value || a.songId - b.songId || a.type - b.type)
})
</script>

<style scoped>
/* The tabs' own rule is the section's only line above the table (线框减法册 rule 2); rows sit on hairlines. Hover and the
   chosen chips use the stage light (--gs-mint*), which follows the idol when 跟随担当配色 is on. */
.chart-table { container: chart-table / inline-size; max-width: var(--gs-content-width); margin: var(--gs-space-7) auto 0;
  --mix-tap: var(--gs-mint); --mix-hold: var(--gs-mint-ink); --mix-flick: var(--gs-attr-mental); --mix-large: var(--gs-attr-intelli); --mix-special: var(--gs-diff-expert); }
.chart-table > h2 { margin: 0 0 var(--gs-space-2); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.chart-table button { font: inherit; }
.chart-table-tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); margin: var(--gs-space-5) 0 var(--gs-space-4); }
.chart-table-search { display: flex; flex: 1 1 200px; align-items: center; gap: var(--gs-space-3); min-width: 0; max-width: 360px; height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-3); }
.chart-table-search:focus-within { border-color: var(--gs-mint); }
.chart-table-search input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.chart-table-status { margin: var(--gs-space-5) 0; color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.chart-table-status button { min-height: var(--gs-control-normal); margin-left: var(--gs-space-3); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink); cursor: pointer; }
.chart-table-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gs-space-3); padding-bottom: var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.chart-table-legend { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-4); }
.chart-table-legend > span { display: inline-flex; align-items: center; gap: var(--gs-space-2); }
.chart-table-legend i { width: 10px; height: 10px; }
.is-tap { background: var(--mix-tap); } .is-hold { background: var(--mix-hold); } .is-flick { background: var(--mix-flick); }
.is-large { background: var(--mix-large); } .is-special { background: var(--mix-special); }

.chart-grid { display: grid; grid-template-columns: minmax(220px, 1fr) 80px 48px 64px 72px 72px minmax(112px, 168px) 88px 44px; align-items: center; column-gap: var(--gs-space-5); }
.chart-head { border-bottom: 1px solid var(--gs-rule); }
.chart-head-cell { display: flex; align-items: center; gap: var(--gs-space-1); min-width: 0; min-height: var(--gs-control-toolbar); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); white-space: nowrap; }
.chart-head-cell.is-end { justify-content: flex-end; }
.chart-head-cell button { display: inline-flex; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-toolbar); padding: 0; border: 0; background: none; color: inherit; font-weight: inherit; white-space: nowrap; cursor: pointer; }
.chart-head-cell button[aria-pressed=true] { color: var(--gs-ink); }
.chart-rows { margin: 0; padding: 0; list-style: none; }
.chart-row { position: relative; min-height: 60px; border-bottom: 1px solid var(--gs-line); }
.chart-row > span { position: relative; min-width: 0; pointer-events: none; }
.chart-row-open { position: absolute; inset: 0; padding: 0; border: 0; background: transparent; cursor: pointer; }
@media (hover: hover) { .chart-row:hover { background: var(--gs-mint-wash); } }
.chart-row:active { background: var(--gs-mint-wash); }
.chart-row-open:focus-visible, .chart-row-stage:focus-visible, .chart-head-cell button:focus-visible, .chart-table-dir:focus-visible, .chart-table-sort-options button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.col-song { display: flex; align-items: center; gap: var(--gs-space-4); padding: var(--gs-space-3) 0; }
.col-song img, .chart-row-nojacket { flex: none; width: 40px; height: 40px; border-radius: var(--gs-radius-media); object-fit: cover; background: var(--gs-line); }
.chart-row-copy { display: grid; gap: var(--gs-space-1); min-width: 0; }
.chart-row-copy strong { overflow: hidden; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.chart-row-copy small { display: flex; align-items: center; gap: var(--gs-space-2); overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.chart-attr { flex: none; width: 14px; height: 14px; background: center / contain no-repeat; }
.chart-row-copy .chart-row-stats, .chart-row-copy .chart-mix { display: none; }
.chart-row-diff { color: var(--diff); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); letter-spacing: .06em; white-space: nowrap; }
.chart-row-level { color: var(--diff); font-family: var(--gs-font-stage); font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); font-variant-numeric: tabular-nums; line-height: 1; text-align: right; }
.is-num { font-family: var(--gs-font-stage); font-size: var(--gs-text-subtitle); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.chart-mix { display: flex; height: 6px; overflow: hidden; border-radius: var(--gs-radius-pill); background: var(--gs-line); }
.chart-mix i { flex-basis: 0; }
.chart-row > .col-mix { pointer-events: auto; }
.col-since { display: grid; gap: var(--gs-space-1); color: var(--gs-ink-2); font-size: var(--gs-text-ui); white-space: nowrap; }
.col-since small { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); }
.chart-row > .col-stage { pointer-events: auto; text-align: right; }
.chart-row-stage { display: inline-grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-mint-ink); cursor: pointer; }
@media (hover: hover) { .chart-row-stage:hover { background: var(--gs-surface); } }

/* The sheet's sort block: the direction is a property of the chosen column, so it sits on the heading, not among the chips. */
.chart-table-sort-head { display: flex; align-items: center; justify-content: space-between; margin: calc(var(--gs-space-3) * -1) 0 var(--gs-space-1); }
.chart-table-sort-head h3 { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.chart-table-dir { display: inline-flex; align-items: center; gap: var(--gs-space-1); min-height: var(--gs-control-touch); padding: 0 var(--gs-space-2); border: 0; background: none; color: var(--gs-mint-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.chart-table-sort-options { display: flex; flex-wrap: wrap; gap: var(--gs-space-3); }
.chart-table-sort-options button { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: transparent; color: var(--gs-ink-2); font-size: var(--gs-text-ui); cursor: pointer; }
.chart-table-sort-options button[aria-pressed=true] { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }

/* Medium widths drop the note mix and the release column; the rest keeps its place. */
@container chart-table (max-width: 900px) {
  .chart-grid { grid-template-columns: minmax(200px, 1fr) 80px 48px 64px 72px 64px 44px; }
  .chart-grid > .col-mix, .chart-grid > .col-since { display: none; }
}
/* Phones: one tap target per row (手机端通用模式 4): jacket, title, one line of figures, the difficulty and level on the right. */
@container chart-table (max-width: 600px) {
  .chart-head, .chart-table-legend { display: none; }
  .chart-table-search { max-width: none; }
  .chart-grid { grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--gs-space-4); }
  .chart-row > .col-combo, .chart-row > .col-bpm, .chart-row > .col-time, .chart-row > .col-stage { display: none; }
  .col-song { grid-row: 1 / 3; gap: var(--gs-space-4); padding: var(--gs-space-4) 0; }
  .col-song img, .chart-row-nojacket { width: 56px; height: 56px; }
  .chart-row-copy strong { display: -webkit-box; white-space: normal; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: var(--gs-text-body); line-height: 1.4; }
  .chart-row-copy .chart-row-stats { display: flex; color: var(--gs-ink-2); font-family: var(--gs-font-stage); }
  .chart-row-copy .chart-mix { display: flex; height: 4px; margin-top: var(--gs-space-1); }
  .chart-row-diff { grid-column: 2; grid-row: 1; align-self: end; text-align: right; }
  .chart-row-level { grid-column: 2; grid-row: 2; align-self: start; }
}
</style>
