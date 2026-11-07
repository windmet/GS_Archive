import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createSongTrackRenderer, songTrackSpanForSpeed } from '../src/presentation/SongTrackPresentation.js'
import { compileSongFlickConnectors } from '../src/presentation/SongTrackFlickConnectors.js'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'
import { songTrackNoteReadTime, songTrackReadTimeSeconds } from '../src/presentation/SongTrackNativeTiming.js'

// The perspective renderer looks up each frame's read window in a tick index instead of scanning the
// chart. Oracle: a note rendered alone (same tempos, so the same clock) needs no index; whatever it
// draws must appear identically in the full-chart frame, and nothing else may.
const root = new URL('../public/data/song_charts/', import.meta.url)
const pick = scene => ({
  glyphs: scene.glyphs.map(g => JSON.stringify(g)).sort(),
  holds: scene.holds.filter(h => !h.flickConnector).map(h => JSON.stringify({ ...h, triangles: undefined })).sort(),
  middleNodes: scene.middleNodes.map(n => JSON.stringify(n)).sort(),
  connectors: scene.holds.filter(h => h.flickConnector).map(h => JSON.stringify({ ...h, triangles: undefined })).sort(),
})
// The three densest charts, the most tempo changes (infoct Expert, 6 BPMs), the only chart with
// per-note speeds (drv999, 11 speeds), and long holds that start well before the window.
let frames = 0, drawn = 0, longHolds = 0, slowFrames = 0
const files = ['hndmkh-4.json', 'ldyrdm-4.json', 'jfhtmk-4.json', 'infoct-4.json', 'drv999-1.json']
for (const file of files) {
  const chart = JSON.parse(readFileSync(new URL(file, root)))
  const timing = buildSongChartTiming(chart), full = createSongTrackRenderer(chart)
  const order = new Map(chart.notes.map((note, i) => [note.sourceIndex, i]))
  const alone = chart.notes.map(note => createSongTrackRenderer({ ...chart, notes: [note] }))
  const pairs = compileSongFlickConnectors(chart).map(c => ({ id: c.id, render: createSongTrackRenderer({ ...chart, notes: [c.fromNote, c.toNote] }) }))
  const longest = chart.notes.reduce((a, b) => (b.duration > a.duration ? b : a))
  const cursors = Array.from({ length: 24 }, (_, i) => timing.secondsToTick(timing.duration * i / 24))
  cursors.push(longest.tick + longest.duration * .9)
  // 3 s before a slow note's hit: at user speed 11 (0.5 s read time) only its own speed shows it.
  const slow = chart.notes.filter(n => (n.speed ?? 1) < 1)
  for (const n of slow) cursors.push(timing.secondsToTick(Math.max(0, timing.tickToSeconds(n.tick) - 3)))
  // Independent of the renderer's window code: NoteMesh.GetNoteTime divides the read time by the note's speed.
  for (const n of slow) if (songTrackNoteReadTime(songTrackReadTimeSeconds(11), n.speed) > 3.2) {
    const cursor = timing.secondsToTick(timing.tickToSeconds(n.tick) - 3)
    assert.ok(full(cursor, songTrackSpanForSpeed(11, timing, cursor)).glyphs.some(g => g.id === `${n.sourceIndex}-head`), `${file}: speed ${n.speed} note ${n.sourceIndex} visible 3 s ahead`)
    slowFrames++
  }
  for (const cursor of cursors) for (const speed of [1, 6, 11]) {
    const span = songTrackSpanForSpeed(speed, timing, cursor)
    const expected = { glyphs: [], holds: [], middleNodes: [], connectors: [] }
    for (const render of alone) {
      const part = pick(render(cursor, span))
      for (const key of ['glyphs', 'holds', 'middleNodes']) expected[key].push(...part[key])
    }
    for (const pair of pairs) expected.connectors.push(...pick(pair.render(cursor, span)).connectors.filter(c => JSON.parse(c).id === pair.id))
    const scene = full(cursor, span), actual = pick(scene)
    const holdOrder = scene.holds.filter(h => !h.flickConnector).map(h => order.get(h.id))
    assert.deepEqual(holdOrder, [...holdOrder].sort((a, b) => a - b), `${file}: holds draw in source order`)
    for (const key of Object.keys(expected)) assert.deepEqual(actual[key], expected[key].sort(), `${file} tick ${Math.round(cursor)} speed ${speed}: ${key}`)
    if (actual.holds.some(h => JSON.parse(h).id === longest.sourceIndex) && longest.tick < cursor - 2000) longHolds++
    frames++; drawn += actual.glyphs.length + actual.holds.length
  }
}
assert.ok(drawn > 5000, `windows were not empty (${drawn})`)
assert.ok(longHolds > 0, 'a hold that began long before the window is still drawn')
assert.ok(slowFrames > 0, 'slow per-note speeds were sampled')

// Holds draw in source order even when the source is not in tick order (no chart is today).
const shuffled = createSongTrackRenderer({ tempos: [{ tick: 0, tempo: 120 }], maxTick: 2000, notes: [
  { sourceIndex: 1, type: 'HOLD', tick: 300, duration: 500, start: 1, end: 1 },
  { sourceIndex: 2, type: 'HOLD', tick: 100, duration: 500, start: 3, end: 3 },
] })(0, 3000).holds.map(h => h.id)
assert.deepEqual(shuffled, [1, 2])

// Equal-tick glyphs keep the chart's source order (their SVG stacking).
const ties = createSongTrackRenderer({ tempos: [{ tick: 0, tempo: 120 }], maxTick: 1000, notes: [
  { sourceIndex: 9, type: 'SMALL', tick: 100, duration: 0, start: 0, end: 0 },
  { sourceIndex: 3, type: 'SMALL', tick: 100, duration: 0, start: 4, end: 4 },
  { sourceIndex: 5, type: 'SMALL', tick: 50, duration: 0, start: 2, end: 2 },
] })(0, 2000).glyphs.map(g => g.sourceIndex)
assert.deepEqual(ties, [9, 3, 5])
console.log(`Track window index: ${frames} frames on ${files.length} dense/variable-BPM/variable-speed charts match per-note renders and source order, ${drawn} drawn objects, long holds kept`)
