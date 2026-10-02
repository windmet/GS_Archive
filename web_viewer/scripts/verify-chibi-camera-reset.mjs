import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Execute the actual SFC camera sampler, including its tween implementation.
// This is a source-only timeline test; camera projection/paint need Browser QA.
const source = readFileSync(new URL('../src/components/ChibiStageViewer.vue', import.meta.url), 'utf8')
const start = source.indexOf('function sampleCameraTween(')
const end = source.indexOf('function backmonitorStateAt(', start)
assert.ok(start >= 0 && end > start)
const makeSampler = new Function('selectedSong', 'layoutCoordinatesForStage', source.slice(start, end) + '; return cameraStateAt')
const fixture = JSON.parse(readFileSync(new URL('./fixtures/chibi-camera-controls.json', import.meta.url), 'utf8'))
const study = fixture.songs.steqmg.events
const sample = makeSampler({ value: { cameraEvents: study } }, () => ({ x: 100 }))
const reset = sample(32101)
assert.deepEqual(reset, { zoom: 1, x: 0, y: 360, rotation: 0, focusSlot: null, stagePosition: null, eventTime: 32100 })
assert.ok(Math.abs(sample(32099).zoom - 1.25) < 1e-8)
assert.equal(sample(32200).zoom, 1, 'new shot starts wide instead of inheriting 1.25x')
assert.equal(sample(32200).x, 0)
assert.equal(sample(38800).zoom, 1.4)
assert.equal(sample(38800).x, 180)
const before = sample(32000), after = sample(33500)
for (const time of [33500, 32000, 32101, 33500, 32000]) {
  assert.deepEqual(sample(time), time === 32000 ? before : time === 32101 ? reset : after, 'backward seeks rebuild the authored shot')
}
const focus = { time: 0, zoom: 2000, zoomDuration: 10000, focusSlot: 1, stagePosition: 3, x: 20, y: 0, moveDuration: 0, rotation: 40, rotationDuration: 0 }
const erase = { time: 500, reset: true, resetDuration: 1000 }
const focused = makeSampler({ value: { cameraEvents: [focus, erase] } }, () => ({ x: 100 }))
assert.equal(focused(499).stagePosition, 3)
assert.equal(focused(500).stagePosition, null)
assert.equal(focused(1500).zoom, 1)
assert.equal(focused(1500).x, 0)
assert.equal(focused(1500).y, 360)
assert.equal(focused(1500).rotation, 0)
assert.ok(focused(1000).x > 0 && focused(1000).x < 120, 'reset transition samples instead of snapping early')
const legacy = makeSampler({ value: { cameraEvents: [focus] } }, () => ({ x: 100 }))
assert.equal(legacy(10000).zoom, 2, 'legacy entries without erase controls retain existing behavior')
for (const code of ['tkstp1', 'tkstp2']) {
  const events = fixture.songs[code].events
  assert.ok(events.every(event => event.reset === false))
  const old = events.map(({ reset, resetDuration, ...event }) => event)
  const upgraded = makeSampler({ value: { cameraEvents: events } }, () => ({ x: 100 }))
  const prior = makeSampler({ value: { cameraEvents: old } }, () => ({ x: 100 }))
  for (const time of [0, 20000, 60000, 100000]) assert.deepEqual(upgraded(time), prior(time), code + ' without reset preserves the prior shot')
}
console.log('Actual SFC Camera sampler: Study wide-shot reset, interrupted focus/pan/rotation, timed reset, backward seek and legacy entries passed; not native projection acceptance')
