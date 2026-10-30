// The LIVE 谱面难度表's figures: level and combo from the song catalogue; BPM and note mix from the chart files, read
// with the same note-type functions the chart tool draws with; length from the full-mix audio (its source sample count).
// A chart's last note is not a length: three charts carry stray flicks long after the song (tibeti EXPERT ends at 44:42).
//   node scripts/generate-live-chart-table.mjs           write src/data/liveChartTable.json
//   node scripts/generate-live-chart-table.mjs --check   fail when the file differs from what the sources give
// Titles, units and jackets are not copied: the page joins the catalogue rows it already loads.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { nativeSongNoteIsFlick, nativeSongNoteIsHold } from '../src/presentation/SongTrackNativeNoteTypes.js'

const root = new URL('..', import.meta.url)
const read = file => JSON.parse(fs.readFileSync(new URL(file, root), 'utf8'))
const OUT = new URL('src/data/liveChartTable.json', root)
const KINDS = new Set(['initial', 'free', 'story', 'event', 'limited'])
const ATTRIBUTES = new Set(['physical', 'intelli', 'mental', 'all'])

// One bucket per note object, in the order the legend reads.
export function noteKind(note) {
  if (note.type === 'SPECIAL') return 'special'
  if (nativeSongNoteIsHold(note)) return 'hold'
  if (nativeSongNoteIsFlick(note)) return 'flick'
  if (note.type === 'LARGE') return 'large'
  if (note.type === 'SMALL') return 'tap'
  throw new Error(`Unclassified note type ${note.type}`)
}

export function buildLiveChartTable(catalog, playback, readChart) {
  const songs = Object.values(catalog.songs || catalog).filter(song => song.gameplay?.difficulties?.length)
    .sort((a, b) => a.song_id - b.song_id || a.song_code.localeCompare(b.song_code))
  return { schemaVersion: 1, songs: songs.map(song => {
    const { history } = song.gameplay
    if (!KINDS.has(history.historicalKind)) throw new Error(`${song.song_code}: unknown unlock kind ${history.historicalKind}`)
    if (!ATTRIBUTES.has(song.attribute?.key)) throw new Error(`${song.song_code}: unknown attribute ${song.attribute?.key}`)
    const duration = playback.songs[song.song_code]?.source?.duration_seconds
    if (!(duration > 0)) throw new Error(`${song.song_code}: no full-mix duration`)
    let tempos = []
    const charts = song.gameplay.difficulties.map(difficulty => {
      const chart = readChart(difficulty.chart.url)
      if (chart.songCode !== song.song_code || chart.difficultyType !== difficulty.type) throw new Error(`${difficulty.chart.url}: identity mismatch`)
      const mix = { tap: 0, hold: 0, flick: 0, large: 0, special: 0 }
      for (const note of chart.notes) mix[noteKind(note)]++
      tempos = tempos.concat(chart.tempos.map(tempo => tempo.tempo))
      return { type: difficulty.type, label: difficulty.label, level: difficulty.level, levelLabel: difficulty.levelLabel,
        maxCombo: difficulty.maxCombo, mix }
    })
    return { code: song.song_code, songId: song.song_id, attribute: song.attribute.key, unlock: history.historicalKind,
      firstImplementedOn: history.firstImplementedOn || '', bpm: [Math.min(...tempos), Math.max(...tempos)], seconds: Math.round(duration), charts }
  }) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const table = buildLiveChartTable(read('public/data/song_catalog.json'), read('public/data/song_playback_audio.json'), url => read(`public${url}`))
  const text = `${JSON.stringify(table)}\n`
  const count = table.songs.reduce((n, song) => n + song.charts.length, 0)
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
    if (current !== text) { console.error('FAIL src/data/liveChartTable.json is stale: run node scripts/generate-live-chart-table.mjs'); process.exit(1) }
    console.log(`PASS live chart table matches the catalogue and charts (${table.songs.length} songs, ${count} charts)`)
  } else {
    fs.writeFileSync(OUT, text)
    console.log(`Wrote ${table.songs.length} songs, ${count} charts, ${text.length} bytes`)
  }
}
