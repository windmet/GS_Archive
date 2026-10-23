import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { songTrackReadTimeSeconds, songTrackSpanForSpeed } from '../src/presentation/SongTrackNativeTiming.js'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'
import { buildSongTrackGeometry, projectTrackPoint } from '../src/presentation/SongTrackPresentation.js'

const fixture = JSON.parse(readFileSync(new URL('../config/song-track-native-speed.v1.json', import.meta.url)))
function checkNative(readTime) {
  for (const sample of fixture.cases) assert.equal(readTime(sample.displaySpeed), sample.seconds, `native setting ${sample.setting}`)
}
checkNative(songTrackReadTimeSeconds)
for (const invalid of [0, 11.1, NaN, Infinity]) assert.throws(() => songTrackReadTimeSeconds(invalid), /speed/)
assert.throws(() => songTrackSpanForSpeed(5, null), /timing/)

// The consumer imports this same function. Reinstating the old estimate must
// fail against ARM64 outputs, even if somebody updates the old smoke assertions.
const source = readFileSync(new URL('../src/presentation/SongTrackNativeTiming.js', import.meta.url), 'utf8')
const mutant = source.replace('return Math.fround(Math.fround(120 - setting) * Math.fround(.05))', 'return 24000 / speed / 1000')
assert.notEqual(mutant, source)
const oldEstimate = await import(`data:text/javascript;base64,${Buffer.from(mutant).toString('base64')}`)
assert.throws(() => checkNative(oldEstimate.songTrackReadTimeSeconds), /native setting/)

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
console.log('Native track timing: 101 ARM64 cases; old estimate mutation rejected; 3 BPMs and cross-tempo geometry passed. Full mesh/GPU equivalence remains open.')
