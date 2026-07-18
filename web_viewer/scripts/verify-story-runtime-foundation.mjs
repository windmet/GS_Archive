import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { PerformanceRegistry, createPerformanceHandle } from '../src/core/story-runtime/PerformanceRegistry.js'
import { normalizeScenario } from '../src/core/story-runtime/ScenarioNormalizer.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function verifyStoryClock() {
  let nowMilliseconds = 1000
  const clock = new StoryClock({ nowMilliseconds: () => nowMilliseconds })
  const events = []
  clock.subscribe(event => events.push(event.reason))

  assert.equal(clock.start({ offset: 0.5, rate: 1 }), 0.5)
  nowMilliseconds += 1500
  assert.equal(clock.now(), 2)
  assert.equal(clock.pause(), 2)
  nowMilliseconds += 5000
  assert.equal(clock.now(), 2, 'paused time must not advance logical time')
  clock.resume()
  nowMilliseconds += 500
  assert.equal(clock.now(), 2.5)
  clock.setRate(2)
  nowMilliseconds += 500
  assert.equal(clock.now(), 3.5)
  clock.seek(5.5)
  assert.equal(clock.toAudioTime(5.6, { currentTime: 10 }), 10.05)
  assert.deepEqual(events, ['start', 'pause', 'resume', 'rate', 'seek'])
  clock.dispose()
}

async function verifyPerformanceRegistry() {
  const registry = new PerformanceRegistry()
  const calls = []
  const camera = createPerformanceHandle({
    id: 'camera-1',
    channel: 'camera',
    blocksAuto: true,
    onSettle: reason => calls.push(`camera:settle:${reason}`),
    onCancel: reason => calls.push(`camera:cancel:${reason}`),
  })
  const se = createPerformanceHandle({
    id: 'se-1',
    channel: 'se',
    blocksAuto: false,
    onSettle: reason => calls.push(`se:suppress:${reason}`),
  })
  registry.register(camera)
  registry.register(se)
  assert.equal(registry.hasUnsettled(), true)
  assert.equal(registry.hasBlockingAuto(), true)
  assert.equal(registry.hasBlockingInput(), false)
  assert.equal(await registry.settleSkippable('user-next'), 2)
  await Promise.resolve()
  assert.equal(registry.hasUnsettled(), false)
  assert.deepEqual(calls, ['camera:settle:user-next', 'se:suppress:user-next'])

  const first = createPerformanceHandle({
    id: 'camera-2',
    channel: 'camera',
    onCancel: reason => calls.push(`camera-2:cancel:${reason}`),
  })
  const second = createPerformanceHandle({ id: 'camera-3', channel: 'camera' })
  registry.register(first)
  await registry.replaceChannel(second)
  assert.equal(first.status, 'cancelled')
  assert.equal(registry.get('camera-3'), second)
  await registry.dispose()
}

async function verifyScenarioNormalizer() {
  const fixturePath = path.join(root, 'fixtures', 'story-runtime', 'legacy-passion-step.json')
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  const scenario = normalizeScenario(fixture)
  assert.equal(scenario.schema_version, 2)
  assert.equal(scenario.source_schema_version, 1)

  const choice = scenario.steps[0]
  assert.equal(choice.flow.advance, 'choice')
  assert.equal(choice.flow.blocks_skip, true)

  const passion = scenario.steps[1]
  assert.deepEqual(passion.entry_snapshot.camera_zoom, {
    zoom: 1,
    offset_x: 0,
    offset_y: 0,
    duration: 0,
  }, 'delayed camera cue must enter from the previous settled camera')
  assert.deepEqual(passion.settled_snapshot.camera_zoom, {
    zoom: 1.2,
    offset_x: 0,
    offset_y: 20,
    duration: 0,
  })
  assert.equal(passion.settled_snapshot.se, null)
  assert.deepEqual(passion.settled_snapshot.se_events, [])

  const camera = passion.cues.find(cue => cue.action === 'camera.transform')
  const soundEffects = passion.cues.filter(cue => cue.action === 'se.play')
  assert.equal(camera.at, 5.5)
  assert.equal(camera.duration, 0.2)
  assert.equal(camera.lifecycle.persistence, 'stateful')
  assert.deepEqual(soundEffects.map(cue => [cue.payload.cue, cue.at]), [
    ['cloth_move_l01', 4],
    ['vibraslap_comical', 5.6],
  ])
  assert.ok(soundEffects.every(cue => cue.lifecycle.restore_policy === 'suppress'))
  assert.deepEqual(passion.normalization.unmapped_legacy_fields, ['state.spines.102sha.fade'])

  const cueIds = scenario.steps.flatMap(step => step.cues.map(cue => cue.cue_id))
  assert.equal(new Set(cueIds).size, cueIds.length, 'cue ids must be unique')

  const schema = JSON.parse(await readFile(path.join(root, 'schemas', 'compiled-scenario-v2.schema.json'), 'utf8'))
  assert.equal(schema.properties.schema_version.const, 2)
  assert.ok(schema.$defs.cue.required.includes('lifecycle'))

  const compiledPath = path.join(root, 'public', 'data', 'compiled', 'episodes', '1_4_001_01_a.json')
  const compiled = JSON.parse(await readFile(compiledPath, 'utf8'))
  const normalizedCompiled = normalizeScenario(compiled)
  const authoredPassion = normalizedCompiled.steps.find(step =>
    step.dialogue?.text_jp?.includes('パパパ、パーッション！！'))
  assert.ok(authoredPassion, 'compiled anchor step for パパパ、パーッション！！ must exist')
  const authoredCamera = authoredPassion.cues.find(cue => cue.action === 'camera.transform')
  const authoredVibraslap = authoredPassion.cues.find(cue => cue.payload?.cue === 'vibraslap_comical')
  assert.equal(authoredCamera?.at, 5.5)
  assert.equal(authoredCamera?.duration, 0.2)
  assert.equal(authoredVibraslap?.at, 5.6)
  assert.ok(
    Math.abs(authoredVibraslap.at - authoredCamera.at) <= 0.1 + Number.EPSILON,
    'vibraslap must remain authored immediately after the Passion camera cue',
  )

  for (const step of normalizedCompiled.steps) {
    for (const cue of step.cues) {
      assert.ok(Number.isFinite(cue.at) && cue.at >= 0, `${cue.cue_id} has invalid at`)
      assert.ok(Number.isFinite(cue.duration) && cue.duration >= 0, `${cue.cue_id} has invalid duration`)
    }
  }
}

verifyStoryClock()
await verifyPerformanceRegistry()
await verifyScenarioNormalizer()

console.log('Story runtime foundation: clock, performance lifecycle, IR v2 schema, and legacy Camera/SE normalization verified')
