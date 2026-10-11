import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSongTrackGeometry, projectTrackPoint, trackReference } from '../src/presentation/SongTrackPresentation.js'

const root = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))
assert.equal(trackReference.constants.LaneCount.value, 5)
assert.equal(trackReference.constants.LaneCount.hex, '05000000')
for (const skin of Object.values(trackReference.skins)) {
  assert.deepEqual(Object.keys(skin).sort(), ['hold_line', 'normal', 'swipe_left', 'swipe_right', 'swipe_up'])
  for (const sprite of Object.values(skin)) assert.ok(readFileSync(new URL('../public/assets/song-chart-sprites/' + sprite.file, import.meta.url)).length)
}
const fixture = { notes: [
  { sourceIndex: 1, type: 'VARIABLE_HOLD', tick: 100, duration: 1000, start: 0, end: 0, endtype: 'END_FLICK_RIGHT',
    poly: [{ subtick: 0, posx: 0 }, { subtick: 500, posx: 2.35 }, { subtick: 1000, posx: 4 }] },
  { sourceIndex: 2, type: 'SMALL', tick: 1500, duration: 0, start: 1, end: 1 },
] }
const clipped = buildSongTrackGeometry(fixture, 300, 600)
assert.equal(clipped.glyphs.length, 0, 'window cannot invent hold endpoints')
const hold = clipped.holds[0]
assert.equal(hold.from, 300); assert.equal(hold.to, 900)
assert.ok(hold.samples.some(p => p.tick === 600 && p.lane === 2.35), 'keep fractional bend')
assert.equal(hold.samples[0].v, 40); assert.equal(hold.samples.at(-1).v, 160, 'clipping must keep full-hold UV')
const all = buildSongTrackGeometry(fixture, 0, 2000)
assert.equal(all.glyphs.find(p => p.endpoint === 'tail').lane, 4, 'poly endpoint overrides stale native end')
assert.equal(all.glyphs.find(p => p.endpoint === 'tail').role, 'swipe_right')
assert.equal(all.lanes.length, 6); assert.equal(all.judges.length, 5)
assert.deepEqual(all.judges.map(p => p.x), [288, 464, 640, 816, 992])
assert.ok(projectTrackPoint(0, .8).scale < projectTrackPoint(0, .2).scale)
assert.throws(() => buildSongTrackGeometry(fixture, 0, 0), /window/)
let charts = 0, windows = 0, paths = 0
for (const song of Object.values(catalog.songs)) for (const d of song.gameplay.difficulties) {
  const chart = JSON.parse(readFileSync(new URL(d.chart.url.replace('/data/', ''), root)))
  const firstHold = chart.notes.find(n => n.duration > 0)
  for (const cursor of [Math.min(...chart.notes.map(n => n.tick)), firstHold?.tick || 0, chart.maxTick - 500]) {
    const scene = buildSongTrackGeometry(chart, Math.max(cursor, 0))
    for (const n of scene.glyphs) {
      assert.ok(n.tick >= scene.cursor && n.tick <= scene.cursor + scene.span)
      assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y) && n.width > 0)
    }
    for (const h of scene.holds) for (const mesh of h.triangles) {
      assert.ok(!/NaN|Infinity/.test(mesh.matrix + mesh.points))
      paths++
    }
    windows++
  }
  charts++
}
console.log(`Track presentation verified: ${charts} charts, ${windows} windows, ${paths} textured triangles; clipped holds, fractional bends and flick tails retained`)
