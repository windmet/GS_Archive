import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { PerformanceRegistry, createPerformanceHandle } from '../src/core/story-runtime/PerformanceRegistry.js'
import { normalizeScenario } from '../src/core/story-runtime/ScenarioNormalizer.js'
import { EffectScheduler } from '../src/core/story-runtime/EffectScheduler.js'
import { getRuntimeCueFeatureFlags } from '../src/core/story-runtime/RuntimeFeatureFlags.js'
import { SceneSnapshotStore, isReadableHistoryStep } from '../src/core/story-runtime/SceneSnapshotStore.js'
import { PlayerPreferencesRepository } from '../src/core/story-runtime/PlayerPreferencesRepository.js'
import { ReadProgressRepository, createReadKey } from '../src/core/story-runtime/ReadProgressRepository.js'
import { PlaybackModeController } from '../src/core/story-runtime/PlaybackModeController.js'
import { applyStepSceneState } from '../src/core/applyStepSceneState.js'

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

async function verifyEffectScheduler() {
  let nowMilliseconds = 0
  const clock = new StoryClock({ nowMilliseconds: () => nowMilliseconds })
  const scheduler = new EffectScheduler({
    clock,
    requestFrame: () => 1,
    cancelFrame: () => {},
  })
  const calls = []
  const handlers = new Map([
    ['camera.transform', cue => createPerformanceHandle({
      id: cue.cue_id,
      channel: cue.channel,
      onStart: () => calls.push('camera:start'),
      onSettle: () => calls.push('camera:settle'),
      onCancel: () => calls.push('camera:cancel'),
    })],
    ['se.play', cue => createPerformanceHandle({
      id: cue.cue_id,
      channel: cue.channel,
      blocksAuto: false,
      onStart: () => calls.push('se:start'),
      onSettle: () => calls.push('se:suppress'),
    })],
  ])
  scheduler.loadStep([
    { cue_id: 'camera', at: 5.5, duration: 0.2, channel: 'camera', action: 'camera.transform' },
    { cue_id: 'se', at: 5.6, duration: 0, channel: 'se', action: 'se.play' },
  ], { handlers })
  scheduler.start()
  nowMilliseconds = 5400
  scheduler.tick()
  assert.deepEqual(calls, [])
  assert.equal(scheduler.hasUnsettledSkippable(), true)
  assert.equal(scheduler.hasBlockingAuto(), true)
  await scheduler.settleSkippable('user-next')
  assert.deepEqual(calls, ['camera:settle', 'se:suppress'])
  assert.equal(scheduler.hasUnsettledSkippable(), false)
  assert.equal(scheduler.hasBlockingAuto(), false)

  assert.deepEqual(getRuntimeCueFeatureFlags('?runtimeCues=1'), { camera: true, se: true, screen: true, background: true, snapshot: true, spine: true })
  assert.deepEqual(getRuntimeCueFeatureFlags('?runtimeCamera=1'), { camera: true, se: false, screen: false, background: false, snapshot: false, spine: false })
  assert.deepEqual(getRuntimeCueFeatureFlags('?runtimeScreen=1'), { camera: false, se: false, screen: true, background: false, snapshot: false, spine: false })
  assert.deepEqual(getRuntimeCueFeatureFlags('?runtimeBackground=1'), { camera: false, se: false, screen: false, background: true, snapshot: false, spine: false })
  assert.deepEqual(getRuntimeCueFeatureFlags('?runtimeSnapshots=1'), { camera: false, se: false, screen: false, background: false, snapshot: true, spine: false })
  assert.deepEqual(getRuntimeCueFeatureFlags('?runtimeSpine=1'), { camera: false, se: false, screen: false, background: false, snapshot: false, spine: true })
  assert.deepEqual(getRuntimeCueFeatureFlags(''), { camera: false, se: false, screen: false, background: false, snapshot: false, spine: false })
  await scheduler.dispose()

  let releaseAsyncStart
  const asyncScheduler = new EffectScheduler({
    clock: new StoryClock({ nowMilliseconds: () => 0 }),
    requestFrame: () => 1,
    cancelFrame: () => {},
  })
  asyncScheduler.loadStep([{
    cue_id: 'async-spine',
    at: 0,
    duration: 0,
    channel: 'spine:a:body',
    action: 'spine.body.play',
  }], {
    handlers: new Map([['spine.body.play', cue => createPerformanceHandle({
      id: cue.cue_id,
      channel: cue.channel,
      onStart: () => new Promise(resolve => { releaseAsyncStart = resolve }),
    })]]),
  })
  asyncScheduler.start()
  asyncScheduler.tick()
  assert.equal(asyncScheduler.hasBlockingAuto(), true, 'async cue start must remain an Auto blocker')
  releaseAsyncStart()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(asyncScheduler.hasBlockingAuto(), false)
  await asyncScheduler.dispose()
}

function verifySceneSnapshotStore() {
  let now = 10
  const store = new SceneSnapshotStore({ now: () => now++ })
  store.beginScenario({
    scenarioId: '1_4_001_01_a',
    sourceHash: 'raw-hash',
    sourceRange: { start_step: 2, end_step: 42 },
  })
  const first = store.record({
    stepIndex: 10,
    step: {
      step_id: 11,
      episode_index: 0,
      type: 'adv',
      dialogue: { speaker: 'A', text_jp: 'first', voice: 'voice-1' },
    },
    snapshot: { bg: 'bg-a', se_events: [] },
    entrySnapshot: { bg: 'bg-entry', screen_overlay: null },
  })
  const second = store.record({
    stepIndex: 11,
    step: { step_id: 12, episode_index: 0, type: 'choice', dialogue: null },
    snapshot: { bg: 'bg-b', screen_overlay: null },
    selectedChoices: new Map([[11, 'Passion!!']]),
    captured: true,
  })
  assert.equal(first.snapshot_source, 'compiled-settled')
  assert.equal(first.navigation_snapshot_source, 'compiled-entry')
  assert.deepEqual(first.navigation_snapshot, { bg: 'bg-entry', screen_overlay: null })
  assert.equal(second.snapshot_source, 'captured-runtime')
  assert.equal(store.size, 2)
  assert.equal(store.list({ readableOnly: true }).length, 2)
  assert.equal(store.get(first.node_id).voice.cue, 'voice-1')
  const detached = store.get(first.node_id)
  detached.snapshot.bg = 'mutated'
  assert.equal(store.get(first.node_id).snapshot.bg, 'bg-a', 'history snapshots must be detached copies')
  assert.equal(store.truncateAfter(first.node_id), true)
  assert.equal(store.size, 1)
  assert.equal(store.popPrevious().node_id, first.node_id)
  assert.equal(store.size, 0)
  assert.equal(isReadableHistoryStep({ type: 'stage', dialogue: null }), false)
  assert.equal(isReadableHistoryStep({ type: 'adv', dialogue: { text_jp: 'line' } }), true)
}

function verifyNavigationOverlayReset() {
  const calls = []
  const manager = {
    clearScreenEffects: () => calls.push('clear-effects'),
    setCameraFilter: () => {},
    applyBgEffects: () => {},
    setBackground: () => {},
    clearBackground: () => {},
    setBgBlur: () => {},
    setBgColorOverlay: () => {},
    resetCameraZoom: () => {},
    clearScreenFade: () => {},
  }
  applyStepSceneState({
    manager,
    step: { step_id: 1 },
    state: { bg: 'bg-a', screen_effects: [] },
    resetScreenEffects: true,
  })
  assert.deepEqual(calls, ['clear-effects'],
    'reverse and non-contiguous navigation must discard a late overlay from the previous step')
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
}

function verifyPlayerStateRepositories() {
  const storage = memoryStorage()
  const preferences = new PlayerPreferencesRepository({ storage })
  assert.equal(preferences.load().auto_delay_ms, 800)
  const saved = preferences.save({
    schema_version: 1,
    auto_enabled: true,
    auto_delay_ms: 99999,
    skip_mode: 'all',
    volumes: { master: -1, voice: 2 },
  })
  assert.equal(saved.auto_enabled, true)
  assert.equal(saved.auto_delay_ms, 10000)
  assert.equal(saved.skip_mode, 'all')
  assert.equal(saved.volumes.master, 0)
  assert.equal(saved.volumes.voice, 1)
  assert.equal(new PlayerPreferencesRepository({ storage }).load().skip_mode, 'all')

  const readProgress = new ReadProgressRepository({ storage })
  const identity = { scenarioId: 'main-1', sourceHash: 'raw-a', stepId: 37 }
  assert.equal(createReadKey(identity), 'main-1:raw-a:step-37')
  assert.equal(readProgress.has(identity), false)
  readProgress.mark(identity)
  assert.equal(readProgress.has(identity), true)
  assert.equal(new ReadProgressRepository({ storage }).has(identity), true)
}

function verifyPlaybackModeController() {
  let now = 0
  let step = { step_id: 1, type: 'adv', dialogue: { voice: 'voice-a' } }
  let voiceState = 'playing'
  let blocking = true
  let read = true
  const advances = []
  const modeChanges = []
  const timers = []
  const controller = new PlaybackModeController({
    getStep: () => step,
    getVoiceState: () => voiceState,
    hasBlockingAuto: () => blocking,
    isRead: () => read,
    onAdvance: source => { advances.push(source); return 'advanced' },
    onModeChange: (_, reason) => modeChanges.push(reason),
    autoDelayMs: 800,
    now: () => now,
    setTimer: callback => { timers.push(callback); return callback },
    clearTimer: timer => { const index = timers.indexOf(timer); if (index >= 0) timers.splice(index, 1) },
  })
  const runTimer = () => timers.shift()?.()
  controller.setAuto(true)
  runTimer()
  assert.deepEqual(advances, [], 'Auto must wait for runtime blockers')
  blocking = false
  runTimer()
  assert.deepEqual(advances, [], 'Auto must wait for voice completion')
  voiceState = 'ended'
  runTimer()
  now = 799
  runTimer()
  assert.deepEqual(advances, [], 'Auto must honor its configured post-voice delay')
  now = 800
  runTimer()
  assert.deepEqual(advances, ['auto'])

  controller.setSkip(true, 'readOnly')
  read = false
  runTimer()
  assert.equal(controller.inspect().skip_enabled, false)
  assert.ok(modeChanges.includes('unread'))
  read = true
  step = { step_id: 2, type: 'choice', dialogue: null }
  controller.setSkip(true, 'all')
  runTimer()
  assert.equal(controller.inspect().skip_enabled, false)
  assert.ok(modeChanges.includes('choice'))
  controller.dispose()
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
  const doorBackground = normalizedCompiled.steps[3]
  const backgroundCue = doorBackground.cues.find(cue => cue.action === 'background.change')
  assert.equal(doorBackground.entry_snapshot.bg, 'bg002_sky_out_01')
  assert.equal(backgroundCue?.payload.bg, 'bg030_315prodoor_in_10')
  assert.equal(backgroundCue?.duration, 1.5)
  assert.equal(doorBackground.settled_snapshot.bg, 'bg030_315prodoor_in_10')
  const slideIn = normalizedCompiled.steps[5]
  const coveredStage = normalizedCompiled.steps[6]
  const slideOut = normalizedCompiled.steps[7]
  assert.equal(slideIn.cues.find(cue => cue.action === 'screen.directional_wipe')?.payload.type, 'in')
  assert.deepEqual(slideIn.settled_snapshot.screen_overlay, {
    kind: 'directional-wipe',
    visible: true,
    color: '#000000',
    direction: '6',
  })
  assert.deepEqual(coveredStage.entry_snapshot.screen_overlay, slideIn.settled_snapshot.screen_overlay)
  assert.equal(coveredStage.entry_snapshot.bg, 'bg001_315pro_in_11')
  assert.equal(slideOut.cues.find(cue => cue.action === 'screen.directional_wipe')?.payload.type, 'out')
  assert.equal(slideOut.entry_snapshot.screen_overlay?.visible, true)
  assert.equal(slideOut.settled_snapshot.screen_overlay, null)
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

  const fadeScenarioPath = path.join(root, 'public', 'data', 'compiled', 'episodes', '1_4_001_01_d.json')
  const fadeScenario = normalizeScenario(JSON.parse(await readFile(fadeScenarioPath, 'utf8')))
  const effectFadeIn = fadeScenario.steps.find(step => step.step_id === 12)
  const effectFadeCue = effectFadeIn.cues.find(cue => cue.evidence.legacy_field === 'state.screen_effects')
  assert.equal(effectFadeCue?.action, 'screen.fade')
  assert.equal(effectFadeCue?.at, 7.3)
  assert.equal(effectFadeCue?.duration, 1)
  assert.equal(effectFadeCue?.payload.type, 'out', 'effect fadein must cover through the shared fade channel')
  assert.equal(effectFadeIn.entry_snapshot.screen_overlay, null,
    'returning to the dialogue must restore its pre-cue scene, not its late black curtain')
  assert.equal(effectFadeIn.settled_snapshot.screen_overlay?.visible, true)
  const screenFadeOut = fadeScenario.steps.find(step => step.step_id === 14)
  assert.equal(screenFadeOut.entry_snapshot.screen_overlay?.visible, true)
  assert.equal(screenFadeOut.cues.find(cue => cue.action === 'screen.fade')?.payload.type, 'in')
  assert.equal(screenFadeOut.settled_snapshot.screen_overlay, null)
}

verifyStoryClock()
await verifyPerformanceRegistry()
await verifyEffectScheduler()
verifySceneSnapshotStore()
verifyNavigationOverlayReset()
verifyPlayerStateRepositories()
verifyPlaybackModeController()
await verifyScenarioNormalizer()

console.log('Story runtime foundation: clock, lifecycle, IR v2, Camera/SE, background, and directional wipe normalization verified')
