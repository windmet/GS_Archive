import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { songTrackReadTimeSeconds, songTrackSpanForSpeed, songTrackNoteTime, songTrackNoteReadTime } from '../src/presentation/SongTrackNativeTiming.js'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'
import { buildSongTrackGeometry, projectTrackPoint } from '../src/presentation/SongTrackPresentation.js'

const fixture = JSON.parse(readFileSync(new URL('../config/song-track-native-speed.v1.json', import.meta.url)))
function checkNative(readTime) {
  for (const sample of fixture.cases) assert.equal(readTime(sample.displaySpeed), sample.seconds, `native setting ${sample.setting}`)
}
checkNative(songTrackReadTimeSeconds)
function checkNativeNoteTime(convert) {
  for (const sample of fixture.noteTimeCases) {
    assert.equal(convert(sample.currentSeconds, sample.hitSeconds, sample.leadSeconds, sample.speed), sample.noteTime,
      `native per-note speed ${sample.speed}`)
  }
}
checkNativeNoteTime(songTrackNoteTime)
assert.throws(() => songTrackNoteReadTime(3.5, 0), /timing/)
for (const invalid of [0, 11.1, NaN, Infinity]) assert.throws(() => songTrackReadTimeSeconds(invalid), /speed/)
assert.throws(() => songTrackSpanForSpeed(5, null), /timing/)

// The consumer imports this same function. Reinstating the old estimate must
// fail against ARM64 outputs, even if somebody updates the old smoke assertions.
const source = readFileSync(new URL('../src/presentation/SongTrackNativeTiming.js', import.meta.url), 'utf8')
const mutant = source.replace('return Math.fround(Math.fround(120 - setting) * Math.fround(.05))', 'return 24000 / speed / 1000')
assert.notEqual(mutant, source)
const oldEstimate = await import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`)
assert.throws(() => checkNative(oldEstimate.songTrackReadTimeSeconds), /native setting/)
const speedMutant = source.replace('const nativeSpeed = Math.fround(speed)', 'const nativeSpeed = Math.fround(1)')
assert.notEqual(speedMutant, source)
const ignoredSpeed = await import(`data:text/javascript;base64,${Buffer.from(speedMutant).toString('base64')}`)
assert.throws(() => checkNativeNoteTime(ignoredSpeed.songTrackNoteTime), /native per-note/)

for (const bpm of [60, 120, 220]) {
  const chart = { offset: 0, maxTick: 20000, tempos: [{ tick: 0, tempo: bpm }] }
  const timing = buildSongChartTiming(chart)
  const span = songTrackSpanForSpeed(5, timing, 480)
  assert.ok(Math.abs(timing.tickToSeconds(480 + span) - timing.tickToSeconds(480) - 3.5) < 1e-10)
}
const chart = { offset: 0, maxTick: 20000, tempos: [{ tick: 0, tempo: 120 }, { tick: 960, tempo: 240 }], notes: [
  { sourceIndex: 1, tick: 960, duration: 0, start: 2, type: 'SMALL' },
  { sourceIndex: 2, tick: 1920, duration: 0, start: 2, type: 'SMALL' },
] }
const timing = buildSongChartTiming(chart)
const span = songTrackSpanForSpeed(5, timing)
assert.equal(span, 5760, 'cross-tempo native 3.5s window')
const scene = buildSongTrackGeometry(chart, 0, span)
for (const glyph of scene.glyphs) {
  assert.equal(glyph.y, projectTrackPoint(2, timing.tickToSeconds(glyph.tick) / 3.5).y)
  assert.notEqual(glyph.y, projectTrackPoint(2, glyph.tick / span).y, 'old tick fraction must differ')
}
assert.equal(songTrackSpanForSpeed(11, timing, 1920), 960)
const speedChart = { offset: 0, maxTick: 20000, tempos: [{ tick: 0, tempo: 120 }], notes: [
  { sourceIndex: 1, tick: 1920, duration: 0, start: 0, type: 'SMALL', speed: 2 },
  { sourceIndex: 2, tick: 5760, duration: 0, start: 1, type: 'SMALL', speed: .5 },
  { sourceIndex: 3, tick: 1920, duration: 0, start: 2, type: 'SMALL', speed: 1 },
  { sourceIndex: 4, tick: 0, duration: 6000, start: 3, end: 3, type: 'VARIABLE_HOLD', speed: .5,
    poly: [{ subtick: 0, posx: 3 }, { subtick: 4000, posx: 4 }, { subtick: 6000, posx: 3 }] },
  ...[0, 1, 3].map((start, i) => ({ sourceIndex: 5 + i, tick: 960, duration: 0, start, type: 'SMALL', speed: i === 2 ? 2 : 1 })),
] }
const speedTiming = buildSongChartTiming(speedChart)
const speedScene = buildSongTrackGeometry(speedChart, 0, songTrackSpanForSpeed(5, speedTiming))
assert.ok(!speedScene.glyphs.some(n => n.sourceIndex === 1), 'fast note must wait for its shorter native lead time')
assert.ok(speedScene.glyphs.some(n => n.sourceIndex === 2), 'slow note beyond the base tick window must remain visible')
assert.ok(speedScene.glyphs.some(n => n.sourceIndex === 3))
assert.equal(speedScene.holds[0].to, 6000)
assert.ok(speedScene.middleNodes.some(n => n.tick === 4000))
assert.equal(speedScene.links.find(l => l.tick === 960).to, 1, 'different speeds cannot share a visual timing link')
const driver = JSON.parse(readFileSync(new URL('../public/data/song_charts/drv999-1.json', import.meta.url)))
const driverTiming = buildSongChartTiming(driver)
const speedNote = driver.notes.find(n => n.sourceIndex === 10)
const lead = songTrackReadTimeSeconds(5)
const justBefore = driverTiming.secondsToTick(driverTiming.tickToSeconds(speedNote.tick) - lead / 1.5 - .001)
const justAfter = driverTiming.secondsToTick(driverTiming.tickToSeconds(speedNote.tick) - lead / 1.5 + .001)
assert.ok(!buildSongTrackGeometry(driver, justBefore, songTrackSpanForSpeed(5, driverTiming, justBefore)).glyphs.some(n => n.sourceIndex === 10))
assert.ok(buildSongTrackGeometry(driver, justAfter, songTrackSpanForSpeed(5, driverTiming, justAfter)).glyphs.some(n => n.sourceIndex === 10))
console.log('Native track timing: 101 settings + 132 per-note ARM64 cases; old estimate/ignored speed mutations rejected; BPM changes, slow/fast windows, holds and source drv999 boundary passed.')
