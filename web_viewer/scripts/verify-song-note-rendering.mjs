import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { noteRendering, songNoteRole, songNoteEndpoints, songSimultaneousLinks } from '../src/presentation/SongNotePresentation.js'
import { buildSongChartGeometry } from '../src/presentation/SongChartPresentation.js'
import { buildSongTrackGeometry } from '../src/presentation/SongTrackPresentation.js'
const root = new URL('../public/data/', import.meta.url)
const cafe = JSON.parse(readFileSync(new URL('song_charts/cfprde-4.json', root)))
assert.equal(cafe.notes.find(n => n.sourceIndex === 239).tick, 30720)
assert.equal(songNoteRole(cafe.notes.find(n => n.sourceIndex === 239).type), 'p_skill', 'purple star belongs to LARGE, not SPECIAL')
assert.equal(songNoteRole(cafe.notes.find(n => n.sourceIndex === 1035).type), 'sp')
for (const direction of ['LEFT', 'UP', 'RIGHT']) {
  assert.equal(songNoteRole(`FLICK_${direction}`), `swipe_${direction.toLowerCase()}`)
  assert.equal(songNoteRole(`END_FLICK_${direction}`), `swipe_${direction.toLowerCase()}`)
}
assert.throws(() => songNoteRole('UNKNOWN'), /Unknown/)
for (const [url, expected] of Object.entries(noteRendering.assets)) {
  const bytes = readFileSync(new URL('../public' + url, import.meta.url))
  assert.equal(bytes.length, expected.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256)
}
const scene = buildSongTrackGeometry(cafe, 29000, 6000)
assert.equal(scene.glyphs.find(n => n.sourceIndex === 239).role, 'p_skill')
const endpoints = songNoteEndpoints(cafe)
assert.equal(endpoints.find(n => n.sourceIndex === 172 && n.endpoint === 'tail').role, 'swipe_right')
assert.equal(endpoints.find(n => n.sourceIndex === 181 && n.endpoint === 'tail').role, 'swipe_left')
assert.ok(songSimultaneousLinks(cafe).some(l => l.tick === 24960 && l.from === 0 && l.to === 4))
let charts = 0, purpleHeads = 0, tails = 0
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))
for (const song of Object.values(catalog.songs)) for (const difficulty of song.gameplay.difficulties) {
  const chart = JSON.parse(readFileSync(new URL(difficulty.chart.url.replace('/data/', ''), root)))
  const long = buildSongChartGeometry(chart)
  const notes = songNoteEndpoints(chart)
  assert.equal(notes.length, chart.notes.length + chart.notes.filter(n => n.duration > 0).length)
  assert.equal(long.notes.length, chart.notes.length)
  assert.equal(long.notes.filter(n => n.role === 'p_skill').length, chart.notes.filter(n => n.type.startsWith('LARGE')).length)
  for (const n of long.notes) for (const mesh of n.bodyTriangles) assert.ok(!/NaN|Infinity/.test(mesh.points + mesh.matrix))
  for (const link of long.links) assert.ok(link.x1 < link.x2)
  purpleHeads += long.notes.filter(n => n.role === 'p_skill').length
  tails += notes.filter(n => n.endpoint === 'tail').length
  charts++
}
console.log(`Native note roles verified: ${charts} charts, ${purpleHeads} purple LARGE heads, ${tails} hold tails; Cafe EX reference, native PNG hashes, direction roles and simultaneous links passed`)
