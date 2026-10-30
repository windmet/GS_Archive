// LIVE 谱面难度表: the bundled figures match the catalogue and the chart files, and the page wires them the agreed way.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildLiveChartTable } from './generate-live-chart-table.mjs'

const root = new URL('..', import.meta.url)
const text = file => fs.readFileSync(new URL(file, root), 'utf8')
const json = file => JSON.parse(text(file))
const catalog = json('public/data/song_catalog.json'), manifest = json('public/data/song_charts/manifest.json')
const playback = json('public/data/song_playback_audio.json')

// The file is exactly what the generator gives from the tracked sources (same note-type functions as the tool).
assert.equal(text('src/data/liveChartTable.json'), `${JSON.stringify(buildLiveChartTable(catalog, playback, url => json(`public${url}`)))}\n`,
  'src/data/liveChartTable.json is stale: run node scripts/generate-live-chart-table.mjs')
const table = json('src/data/liveChartTable.json')
const charts = table.songs.flatMap(song => song.charts.map(chart => ({ code: song.code, ...chart })))
const expected = Object.values(catalog.songs || catalog).flatMap(song => (song.gameplay?.difficulties || []).map(d => `${song.song_code}:${d.type}`))
assert.deepEqual(charts.map(chart => `${chart.code}:${chart.type}`).sort(), expected.sort(), 'every catalogue difficulty has one row')
assert.ok(charts.length >= 244, `expected at least 244 charts, got ${charts.length}`)
for (const chart of charts) {
  const entry = manifest.songs[chart.code][String(chart.type)]
  const notes = Object.values(chart.mix).reduce((sum, count) => sum + count, 0)
  assert.equal(notes, entry.noteObjectCount, `${chart.code}-${chart.type}: note mix must account for every note object`)
}
// Length is the song's, from its audio; a chart's last note would give tibeti 44:42.
for (const song of table.songs) assert.ok(song.seconds > 60 && song.seconds < 240, `${song.code}: implausible length ${song.seconds}s`)
assert.equal(charts.find(chart => chart.code === 'drv999' && chart.type === 1).label, 'PASSION')

// The page: rows open the chart at their difficulty, figures are formatted by the chart tool's own formatter, the table
// loads only on LIVE, and hover / chosen states use the stage light (--gs-mint*), never the neutral --gs-hover.
const page = text('src/components/archive/ArchiveLiveChartTable.vue'), panel = text('src/components/gs/GsFilterPanel.vue')
const landing = text('src/components/archive/ArchiveToolLanding.vue')
assert.match(page, /import table from '\.\.\/\.\.\/data\/liveChartTable\.json'/)
assert.match(page, /import \{ formatChartTime \} from '\.\.\/\.\.\/presentation\/SongChartTiming\.js'/)
assert.match(page, /emit\('chart-song', row\.code, row\.type\)/, 'a row opens the chart tool at its own difficulty')
assert.match(page, /<GsFilterPanel v-model="filters"/, 'filters live in the one filter widget')
assert.match(landing, /defineAsyncComponent\(\(\) => import\('\.\/ArchiveLiveChartTable\.vue'\)\)/, 'the studio landing must not download the table')
assert.doesNotMatch(landing, /liveChartTable\.json/)
for (const [file, source] of [['ArchiveLiveChartTable.vue', page], ['GsFilterPanel.vue', panel]]) {
  const style = source.slice(source.indexOf('<style'))
  assert.doesNotMatch(style, /--gs-hover\b/, `${file}: hover follows the stage light (--gs-mint-wash)`)
  assert.match(style, /:hover[^{]*\{[^}]*var\(--gs-mint-wash\)/, `${file}: a hover state uses --gs-mint-wash`)
  assert.match(style, /\[aria-pressed=true\][^{]*\{[^}]*var\(--gs-selected-bg\)/, `${file}: chosen chips use the selected role`)
}
assert.match(page, /\.chart-row:hover \{ background: var\(--gs-mint-wash\); \}/)
console.log(`PASS live chart table: ${table.songs.length} songs, ${charts.length} charts match the sources; wiring and stage-light states ok`)
