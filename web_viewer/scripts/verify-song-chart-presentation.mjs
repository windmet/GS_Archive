import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSongChartGeometry, playableSongChart, validateSongChart } from '../src/presentation/SongChartPresentation.js'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'
const root = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))
let notes = 0, slides = 0, flickEnds = 0, tempoChanges = 0
const playback = JSON.parse(readFileSync(new URL('song_playback_audio.json', root))).songs
const trimmed = new Map()
for (const [code, song] of Object.entries(catalog.songs)) {
  const view = buildSongPresentation(song, null)
  assert.deepEqual(view.gameplay, song.gameplay)
  for (const d of song.gameplay.difficulties) {
    const chart = validateSongChart(JSON.parse(readFileSync(new URL(d.chart.url.replace('/data/', ''), root))), code, d.type)
    const geometry = buildSongChartGeometry(chart)
    assert.equal(geometry.notes.length, chart.noteObjectCount)
    assert.equal(new Set(geometry.notes.map(n => n.id)).size, chart.noteObjectCount)
    for (let i = 0; i < chart.notes.length; i++) {
      const raw = chart.notes[i], rendered = geometry.notes[i]
      assert.ok(rendered.endY < geometry.height)
      if (raw.poly) {
        slides++
        // Curved holds must keep fractional intermediate lanes and their actual end,
        // even when the native `end` field still equals the start lane.
        assert.equal(rendered.endX, 105 + raw.poly.at(-1).posx * 55)
        assert.equal(rendered.path.split('L').length, raw.poly.length)
      }
      if (raw.endtype && raw.endtype !== 'END_NORMAL') {
        flickEnds++
        assert.ok(rendered.endFlick)
      }
    }
    tempoChanges += chart.tempos.length - 1
    // The viewer's timeline must end with the song, never at a stray note minutes later.
    const audioSeconds = playback[code]?.source?.duration_seconds
    const playable = playableSongChart(chart, audioSeconds)
    if (audioSeconds) assert.ok(buildSongChartTiming(playable).duration <= audioSeconds + 0.5, `${code}-${d.type} chart outlasts its audio`)
    if (playable !== chart) trimmed.set(`${code}-${d.type}`, playable.hiddenAfterSongEnd)
    notes += chart.noteObjectCount
  }
}
const fixture = JSON.parse(readFileSync(new URL('song_charts/brndnf-4.json', root)))
assert.throws(() => validateSongChart(fixture, 'drvalv', 4), /标识/)
assert.throws(() => validateSongChart(fixture, 'brndnf', 1), /标识/)
const changed = structuredClone(fixture); changed.notes[0].type = 'UNKNOWN'
assert.throws(() => validateSongChart(changed, 'brndnf', 4), /音符/)
const duplicate = structuredClone(fixture); duplicate.notes[1].sourceIndex = duplicate.notes[0].sourceIndex
assert.throws(() => validateSongChart(duplicate, 'brndnf', 4), /音符/)
const badPoly = structuredClone(fixture); badPoly.notes.find(n => n.poly).poly.at(-1).subtick++
assert.throws(() => validateSongChart(badPoly, 'brndnf', 4), /端点/)
assert.deepEqual(Object.fromEntries(trimmed), { 'ldyrdm-3': 1, 'mtples-4': 1, 'tibeti-4': 2, 'wathon-4': 1 })
assert.ok(slides > 3000 && flickEnds > 1000 && tempoChanges > 0)
console.log(`Chart presentation verified: 244 charts, ${notes} notes, ${slides} slide paths, ${flickEnds} flick endings, ${tempoChanges} tempo changes`)
