import assert from 'node:assert/strict'
import { nativeSongNoteIsHold } from '../src/presentation/SongTrackNativeNoteTypes.js'
import { songNoteEndpoints } from '../src/presentation/SongNotePresentation.js'
import { buildSongChartGeometry } from '../src/presentation/SongChartPresentation.js'
import { readFileSync } from 'node:fs'
import { songTrackReadTimeSeconds, songTrackNoteTime, songTrackSpanForSpeed } from '../src/presentation/SongTrackNativeTiming.js'
import { buildSongTrackGeometry, projectTrackPoint } from '../src/presentation/SongTrackPresentation.js'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/song-track-native-special-timing.json', import.meta.url)))
for (const sample of fixture.settings) assert.equal(songTrackReadTimeSeconds(sample.displaySpeed), sample.commonLeadSeconds)
function checkNative(convert) {
  for (const sample of fixture.cases.filter(c => c.noteType === 9)) assert.equal(
    convert(sample.currentSeconds, sample.hitSeconds, sample.leadSeconds, sample.speed), sample.noteTime, 'native Special timing')
}
checkNative(songTrackNoteTime)
for (const sample of fixture.cases) assert.equal(songTrackNoteTime(sample.currentSeconds, sample.hitSeconds, sample.leadSeconds, sample.speed), sample.noteTime)
const source = readFileSync(new URL('../src/presentation/SongTrackNativeTiming.js', import.meta.url), 'utf8')
const mutant = source.replace('return leadSeconds / nativeSpeed', 'return 3.5 / nativeSpeed')
assert.notEqual(mutant, source)
const fixed = await import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`)
assert.throws(() => checkNative(fixed.songTrackNoteTime), /native Special/, 'invented fixed Special lead must fail')
const root = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))
function checkTypes(classify) {
  for (const c of fixture.classifications) assert.equal(classify({ type: c.name, duration: 480 }), c.isHold, 'native hold classification')
}
checkTypes(nativeSongNoteIsHold)
const typesSource = readFileSync(new URL('../src/presentation/SongTrackNativeNoteTypes.js', import.meta.url), 'utf8')
const oldDuration = typesSource.replace(/return note.type === 'HOLD'[\s\S]*?LARGE_VARIABLE_HOLD'/, 'return note.duration > 0')
assert.notEqual(oldDuration, typesSource)
const oldTypes = await import(`data:text/javascript;base64,${Buffer.from(oldDuration).toString('base64')}`)
assert.throws(() => checkTypes(oldTypes.nativeSongNoteIsHold), /native hold classification/)
let charts = 0, nonHoldDurations = 0

for (const song of Object.values(catalog.songs)) for (const difficulty of song.gameplay.difficulties) {
  const chart = JSON.parse(readFileSync(new URL(difficulty.chart.url.replace('/data/', ''), root)))
  const nonHolds = chart.notes.filter(n => n.duration > 0 && !nativeSongNoteIsHold(n))
  nonHoldDurations += nonHolds.length
  const endpoints = songNoteEndpoints(chart), long = buildSongChartGeometry(chart)
  for (const n of nonHolds) {
    assert.equal(endpoints.filter(p => p.sourceIndex === n.sourceIndex).length, 1, 'non-hold has one endpoint')
    const rendered = long.notes.find(p => p.id === n.sourceIndex)
    assert.equal(rendered.held, false)
    assert.equal(rendered.bodyTriangles.length, 0)
    const scene = buildSongTrackGeometry({ ...chart, notes: [n] }, n.tick, 1000)
    assert.equal(scene.glyphs.length, 1)
    assert.equal(scene.glyphs[0].endpoint, 'head')
    assert.equal(scene.holds.length, 0, 'non-hold duration cannot create hold mesh')
  }
  const note = chart.notes.find(n => n.type === 'SPECIAL')
  assert.ok(note)
  assert.equal(note.speed, 1)
  assert.ok(note.track > 0, 'native CalcAbsoluteTime assigns common lead to positive-track notes')
  const timing = buildSongChartTiming(chart)
  const hit = timing.tickToSeconds(note.tick), cursor = timing.secondsToTick(hit - 1)
  for (const displaySpeed of [1, 5, 11]) {
    const scene = buildSongTrackGeometry(chart, cursor, songTrackSpanForSpeed(displaySpeed, timing, cursor))
    const glyph = scene.glyphs.find(n => n.sourceIndex === note.sourceIndex && n.endpoint === 'head')
    if (displaySpeed === 11) assert.equal(glyph, undefined, 'Special waits for the common .5s read window')
    else {
      assert.ok(glyph)
      const fraction = (hit - timing.tickToSeconds(cursor)) / songTrackReadTimeSeconds(displaySpeed)
      assert.equal(glyph.y, projectTrackPoint(2, fraction).y, 'Special uses the common source clock')
    }
  }
  charts++
}
assert.equal(nonHoldDurations, 275)
console.log(`Native hold classification: ${fixture.classifications.length} types; ${nonHoldDurations} positive-duration non-holds do not gain fake tails/body; old-duration mutation rejected.`)
console.log(`Native Special timing: 3 sequence-reset settings/${fixture.cases.length} typed cases; ${charts} source Special notes at three settings; fixed-time mutation rejected.`)
