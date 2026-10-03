import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Execute the actual SFC camera sampler, including its tween implementation.
// Source-only sampler/projection tests; paint still needs Browser QA.
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
// Execute the actual consumer with Pixi's position/pivot/scale contract.
// Independent image shifts establish the sign, rather than copying its formula.
const projectionStart = source.indexOf('function applyCameraTransform()')
const projectionEnd = source.indexOf('function applyLayerDebugVisibility()', projectionStart)
assert.ok(projectionStart >= 0 && projectionEnd > projectionStart)
const project = new Function('cameraContainer', 'app', 'cameraEnabled', 'stageViewScale', 'currentCameraState', 'STAGE_BASE_ZOOM',
  source.slice(projectionStart, projectionEnd) + '; applyCameraTransform()')
const witness = JSON.parse(readFileSync(new URL('./fixtures/chibi-camera-video-registration.json', import.meta.url), 'utf8'))
function transform(time, width, height, enabled = true, viewScale = 1, resolution = 1) {
  const vector = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y } })
  const container = { position: vector(), pivot: vector(), scale: vector(), rotation: 0 }
  project(container, { renderer: { width: width * resolution, height: height * resolution, resolution } },
    { value: enabled }, { value: viewScale }, { value: sample(time) }, 1)
  return container
}
function screenPoint(container, point) {
  assert.ok(Math.abs(container.rotation) < 1e-12, 'registration shots have no rotation')
  return { x: container.position.x + (point.x - container.pivot.x) * container.scale.x,
    y: container.position.y + (point.y - container.pivot.y) * container.scale.y }
}
for (const [width, height, resolution] of [[1280, 720, 1], [819, 461, 2], [357, 201, 3], [800, 500, 1]]) {
  const fit = Math.min(width / 1280, height / 720)
  for (const shot of witness.observations) {
    const before = screenPoint(transform(shot.fromMs, width, height, true, 1, resolution), { x: width / 2, y: height / 2 })
    const after = screenPoint(transform(shot.toMs, width, height, true, 1, resolution), { x: width / 2, y: height / 2 })
    for (const axis of ['x', 'y']) {
      const sourceDelta = (after[axis] - before[axis]) / fit
      const observed = shot[axis === 'x' ? 'imageShiftX' : 'imageShiftY']
      assert.ok(Math.abs(sourceDelta - observed) <= witness.toleranceSourcePixels,
        `${shot.fromMs}->${shot.toMs} ${axis}: ${sourceDelta} vs independent recording ${observed}`)
    }
  }
  const neutral = transform(32101, width, height, true, 1, resolution)
  assert.deepEqual(screenPoint(neutral, { x: width / 2, y: height / 2 }), { x: width / 2, y: height / 2 })
  const disabled = transform(3300, width, height, false, 1.25, resolution)
  assert.equal(disabled.scale.x, 1.25)
  assert.equal(disabled.scale.y, 1.25)
  assert.deepEqual(screenPoint(disabled, { x: width / 2, y: height / 2 }), { x: width / 2, y: height / 2 })
}
console.log('Actual SFC Camera: reset/seek/legacy sampler, two independent recorded pan directions across four viewports/DPRs and disabled centred overview passed; not full native projection acceptance')
