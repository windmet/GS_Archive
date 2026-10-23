import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { nativeSongHoldMiddlePoints } from '../src/presentation/SongTrackNativeMiddleNodes.js'
import { songHoldMiddleNodes } from '../src/presentation/SongNotePresentation.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/song-track-native-middle-nodes.json', import.meta.url)))
const enumBytes = readFileSync(new URL('../config/song-track-native-note-geometry.v1.json', import.meta.url))
assert.equal(createHash('sha256').update(enumBytes).digest('hex'), fixture.source.enumContractSha256)
const enums = JSON.parse(enumBytes).source.nativeEnumValues
const names = Object.fromEntries(Object.entries(enums).map(([name, value]) => [value, name]))
function input(sample) {
  return { sourceIndex: 1, type: names[sample.noteType], tick: sample.tick, speed: sample.speed,
    duration: sample.duration, poly: sample.poly.map(([subtick, posx]) => ({ subtick, posx })) }
}
function checkNative(build) {
  for (const sample of fixture.cases) {
    const actual = build(input(sample)).map(({ polyIndex, ...child }) => child)
    assert.deepEqual(actual, sample.children, `native middle children: ${sample.noteType}/${JSON.stringify(sample.poly)}`)
  }
}
checkNative(nativeSongHoldMiddlePoints)
const source = readFileSync(new URL('../src/presentation/SongTrackNativeMiddleNodes.js', import.meta.url), 'utf8')
for (const [name, mutant] of [
  ['old subtick range filter', source.replace('.slice(1, -1)', '.filter(p => p.subtick > 0 && p.subtick < note.duration)')],
  ['all hold types', source.replace("note.type !== 'VARIABLE_HOLD' && note.type !== 'LARGE_VARIABLE_HOLD'", "!note.type.includes('HOLD')")],
  ['rounded float speed ignored', source.replace('Math.fround(note.speed ?? 1)', '1')],
]) {
  assert.notEqual(mutant, source, `${name} must apply`)
  const module = await import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`)
  assert.throws(() => checkNative(module.nativeSongHoldMiddlePoints), /native middle/, `${name} must fail`)
}
const root = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))
let charts = 0, children = 0
for (const song of Object.values(catalog.songs)) for (const difficulty of song.gameplay.difficulties) {
  const chart = JSON.parse(readFileSync(new URL(difficulty.chart.url.replace('/data/', ''), root)))
  const expected = chart.notes.flatMap(n => nativeSongHoldMiddlePoints(n).map(p => ({
    id: `${n.sourceIndex}-middle-${p.polyIndex}`, sourceIndex: n.sourceIndex, endpoint: 'middle', tick: p.tick, lane: p.lane, role: 'middle',
  })))
  assert.deepEqual(songHoldMiddleNodes(chart), expected, 'shared native middle consumer')
  children += expected.length; charts++
}
assert.equal(children, 2285)
const judgement = JSON.parse(readFileSync(new URL('./fixtures/song-track-native-judgement.json', import.meta.url)))
assert.equal(judgement.source.elfSha256, fixture.source.elfSha256)
assert.deepEqual(judgement.margins.find(c => c.mode === 'normal' && c.debugRangeDiff === 0).seconds,
  { bad: .25, good: .12, great: .1, perfect: .05 })
assert.deepEqual(judgement.onTarget.map(c => c.accepted), [false, false, true, true, true, false, false],
  'native middle time predicate excludes exact Perfect boundaries')
assert.deepEqual(judgement.touches.filter(c => !c.timingAdjust).map(c => c.accepted), [true, true, true, false, false, false, true],
  'native touch predicate has inclusive X and upper Y boundaries, with no lower Y limit')
assert.ok(judgement.touches.filter(c => c.timingAdjust).every(c => c.accepted))
console.log(`Native middle generation: ${fixture.cases.length} ARM64 cases; ${charts} charts/${children} children; old range/all-holds/ignored-speed mutations rejected; native range/time/touch receipts checked.`)
