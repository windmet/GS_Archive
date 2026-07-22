import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { PerformanceRegistry, createPerformanceHandle } from '../src/core/story-runtime/PerformanceRegistry.js'
import { normalizeScenario } from '../src/core/story-runtime/ScenarioNormalizer.js'
import { EffectScheduler } from '../src/core/story-runtime/EffectScheduler.js'
import { SceneSnapshotStore, isReadableHistoryStep } from '../src/core/story-runtime/SceneSnapshotStore.js'
import { PlayerPreferencesRepository } from '../src/core/story-runtime/PlayerPreferencesRepository.js'
import { ReadProgressRepository, createReadKey } from '../src/core/story-runtime/ReadProgressRepository.js'
import { PlaybackModeController } from '../src/core/story-runtime/PlaybackModeController.js'
import { applyStepSceneState } from '../src/core/applyStepSceneState.js'
import { applyScreenEntrySnapshot, createScreenCueHandle } from '../src/core/story-runtime/ScreenCueRuntime.js'
import { applyBackgroundEntrySnapshot, createBackgroundCueHandle } from '../src/core/story-runtime/BackgroundCueRuntime.js'
import { applyCameraEntrySnapshot, createCameraCueHandle } from '../src/core/story-runtime/CameraCueRuntime.js'
import { CameraController } from '../src/core/CameraController.js'
import { createSeCueHandle } from '../src/core/story-runtime/SeCueRuntime.js'
import { useStepSceneEffects } from '../src/core/useStepSceneEffects.js'
import { createDebugSnapshotCue, createDebugSnapshotHandle } from '../src/core/story-runtime/DebugSnapshotRuntime.js'

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

async function verifyScreenCueOwner() {
  const calls = []
  const manager = {
    clearScreenFade: () => calls.push(['fade:clear']),
    clearScreenSlide: () => calls.push(['slide:clear']),
    setScreenFade: (...args) => calls.push(['fade:set', ...args]),
    setScreenSlide: (...args) => calls.push(['slide:set', ...args]),
  }
  applyScreenEntrySnapshot(manager, {
    kind: 'fade', visible: true, color: '#ffffff', alpha: 0.75,
  })
  assert.deepEqual(calls, [
    ['fade:clear'],
    ['slide:clear'],
    ['fade:set', 'out', '#ffffff', 0, 0, 0.75],
  ], 'restore must atomically replace transient screen state with the entry snapshot')

  calls.length = 0
  const fadeCue = {
    cue_id: 'screen-fade',
    channel: 'screen',
    action: 'screen.fade',
    duration: 1.2,
    payload: { type: 'in', color: '#000000', alpha: 1 },
    lifecycle: { skippable: true, blocks_input: false, blocks_auto: true },
  }
  const fade = createScreenCueHandle(fadeCue, () => manager)
  await fade.start()
  assert.deepEqual(calls, [['fade:set', 'in', '#000000', 1.2, 0, 1]])
  await fade.settle('user-next')
  assert.deepEqual(calls.at(-1), ['fade:set', 'in', '#000000', 0, 0, 1],
    'settle must apply the authored terminal fade state without another timer')

  calls.length = 0
  const wipe = createScreenCueHandle({
    ...fadeCue,
    cue_id: 'screen-wipe',
    action: 'screen.directional_wipe',
    payload: { type: 'in', color: '#112233', direction: '4' },
  }, () => manager)
  await wipe.start()
  await wipe.cancel('navigation')
  assert.deepEqual(calls, [
    ['slide:set', 'in', '#112233', 1.2, 0, '4'],
    ['slide:clear'],
  ], 'cancel must invalidate the active wipe owner and clear its overlay')
}

async function verifyBackgroundCueOwner() {
  const calls = []
  let canSettle = true
  const manager = {
    setBackground: (bg, transition) => { calls.push(['background:set', bg, transition]) },
    clearBackground: () => calls.push(['background:clear']),
    backgroundManager: {
      settleBackgroundTransition: () => { calls.push(['background:settle']); return canSettle },
      cancelBackgroundTransition: () => calls.push(['background:cancel']),
    },
  }
  applyBackgroundEntrySnapshot(manager, 'bg-entry')
  assert.deepEqual(calls, [[
    'background:set', 'bg-entry', { duration: 0, delay: 0 },
  ]], 'restore must install the entry background without a transition')

  calls.length = 0
  const cue = {
    cue_id: 'background-change',
    channel: 'background',
    action: 'background.change',
    duration: 1.5,
    payload: { bg: 'bg-next', type: 'dissolve', color: '#ffffff' },
    lifecycle: { skippable: true, blocks_input: false, blocks_auto: true },
  }
  const settled = createBackgroundCueHandle(cue, () => manager)
  await settled.start()
  await settled.settle('user-next')
  assert.deepEqual(calls, [
    ['background:set', 'bg-next', { type: 'dissolve', color: '#ffffff', duration: 1.5, delay: 0 }],
    ['background:settle'],
  ], 'settle must finish the manager-owned transition instead of starting a second tween')

  calls.length = 0
  canSettle = false
  const fallback = createBackgroundCueHandle({ ...cue, cue_id: 'background-fallback' }, () => manager)
  await fallback.settle('user-next')
  assert.deepEqual(calls, [
    ['background:settle'],
    ['background:clear'],
    ['background:set', 'bg-next', { type: 'dissolve', color: '#ffffff', duration: 0, delay: 0 }],
  ], 'settling before texture readiness must still apply the authored terminal background')

  calls.length = 0
  const cancelled = createBackgroundCueHandle({ ...cue, cue_id: 'background-cancel' }, () => manager)
  await cancelled.start()
  await cancelled.cancel('navigation')
  assert.deepEqual(calls.at(-1), ['background:cancel'],
    'cancel must return ownership to the entry snapshot before navigation applies it')
}

async function verifyCameraCueOwner() {
  const calls = []
  const manager = {
    setCameraZoom: value => calls.push(['camera:set', value]),
    resetCameraZoom: () => calls.push(['camera:reset']),
    cameraController: { cancelCameraTween: () => calls.push(['camera:cancel']) },
  }
  applyCameraEntrySnapshot(manager, { zoom: 1.1, offset_x: 4, offset_y: 8, duration: 2, delay: 1 })
  assert.deepEqual(calls, [['camera:set', { zoom: 1.1, offset_x: 4, offset_y: 8, duration: 0, delay: 0 }]])
  calls.length = 0
  const cue = {
    cue_id: 'camera-transform', channel: 'camera', action: 'camera.transform', duration: 0.2,
    payload: { zoom: 1.2, offset_x: 0, offset_y: 20 },
    lifecycle: { skippable: true, blocks_input: false, blocks_auto: true },
  }
  const settled = createCameraCueHandle(cue, () => manager)
  await settled.start()
  await settled.settle('user-next')
  assert.deepEqual(calls, [
    ['camera:set', { zoom: 1.2, offset_x: 0, offset_y: 20, duration: 0.2, delay: 0 }],
    ['camera:set', { zoom: 1.2, offset_x: 0, offset_y: 20, duration: 0, delay: 0 }],
  ])
  const cancelled = createCameraCueHandle({ ...cue, cue_id: 'camera-cancel' }, () => manager)
  await cancelled.start()
  await cancelled.cancel('navigation')
  assert.deepEqual(calls.at(-1), ['camera:cancel'])
}

async function verifySeCueOwner() {
  const calls = []
  const audioManager = {
    preloadSE: cue => calls.push(['se:preload', cue]),
    playSE: cue => calls.push(['se:play', cue]),
  }
  const makeCue = (id, cue) => ({
    cue_id: id, channel: 'se', action: 'se.play', duration: 0,
    payload: { cue }, lifecycle: { skippable: true, blocks_input: false, blocks_auto: false },
  })
  const first = createSeCueHandle(makeCue('se-cloth', 'cloth_move_l01'), audioManager)
  const second = createSeCueHandle(makeCue('se-vibraslap', 'vibraslap_comical'), audioManager)
  assert.deepEqual(calls, [['se:preload', 'cloth_move_l01'], ['se:preload', 'vibraslap_comical']])
  await first.start()
  await second.settle('user-next')
  assert.deepEqual(calls, [
    ['se:preload', 'cloth_move_l01'], ['se:preload', 'vibraslap_comical'], ['se:play', 'cloth_move_l01'],
  ], 'settling a scheduled transient SE must suppress it without affecting an earlier SE')
  const cancelled = createSeCueHandle(makeCue('se-cancel', 'cancel_me'), audioManager)
  await cancelled.cancel('navigation')
  assert.equal(calls.some(call => call[0] === 'se:play' && call[1] === 'cancel_me'), false)
}

async function verifyDebugSnapshotCue() {
  assert.equal(createDebugSnapshotCue({ step_id: 7 }, null), null)
  const cue = createDebugSnapshotCue({ step_id: 7 }, 1.25)
  assert.equal(cue.at, 1.25)
  assert.equal(cue.action, 'debug.snapshot.capture')
  assert.equal(cue.lifecycle.skippable, false)
  assert.equal(cue.lifecycle.blocks_auto, false)
  let captures = 0
  const handle = createDebugSnapshotHandle(cue, () => { captures++ })
  await handle.start()
  assert.equal(captures, 1)
  const cancelled = createDebugSnapshotHandle({ ...cue, cue_id: 'step-8:debug-snapshot' }, () => { captures++ })
  await cancelled.cancel('step-change')
  assert.equal(captures, 1, 'navigation must cancel a pending debug capture without firing it')
}

function verifyCameraResize() {
  let width = 1280
  let height = 720
  const makeContainer = () => ({ x: 0, y: 0, scale: { x: 1, y: 1, set(value) { this.x = value; this.y = value } } })
  const bgContainer = makeContainer()
  const spineContainer = makeContainer()
  const controller = new CameraController({
    bgContainer, spineContainer, getWidth: () => width, getHeight: () => height, getBgSprite: () => null,
  })
  controller.setCameraZoom({ zoom: 1.5, offset_x: 0, offset_y: 0, duration: 0 })
  assert.equal(spineContainer.x, -320)
  assert.equal(spineContainer.y, -180)
  width = 390
  height = 844
  controller.handleResize()
  assert.equal(spineContainer.x, -97.5)
  assert.equal(spineContainer.y, -211)
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

function verifyRetiredLegacyOwners() {
  const calls = []
  const manager = {
    setCameraFilter: () => calls.push('camera-filter'),
    applyBgEffects: () => calls.push('background-effects'),
    setBgBlur: () => calls.push('background-blur'),
    setBgColorOverlay: () => calls.push('background-color'),
    setBackground: () => calls.push('legacy-background'),
    clearBackground: () => calls.push('legacy-background-clear'),
    setCameraZoom: () => calls.push('legacy-camera'),
    resetCameraZoom: () => calls.push('legacy-camera-reset'),
    setScreenSlide: () => calls.push('legacy-screen-wipe'),
    setScreenFade: () => calls.push('legacy-screen-fade'),
    clearScreenFade: () => calls.push('legacy-screen-fade-clear'),
    playScreenEffects: effects => calls.push(`screen-effect:${effects[0]?.type}`),
  }
  applyStepSceneState({
    manager,
    step: { step_id: 7 },
    state: {
      bg: 'bg030_315prodoor_in_10',
      bg_transition: { type: 'dissolve', duration: 1.5 },
      camera_zoom: { zoom: 1.2, duration: 0.2 },
      screen_slide: { type: 'in' },
      screen_fade: { type: 'out' },
      screen_effects: [{ type: 'fadein' }, { type: 'single', id: 'fx_adv_punch' }],
    },
  })
  assert.deepEqual(calls, [
    'camera-filter',
    'background-effects',
    'background-blur',
    'background-color',
    'screen-effect:single',
  ], 'scene application must retain non-runtime effects without invoking retired channel owners')

  const audioCalls = []
  const base = {
    currentStepIndex: { value: 0 }, isLastStep: { value: false }, historyStack: { value: [] },
    spineStageRef: { value: null },
    audioManager: {
      preloadSE: cue => audioCalls.push(['se:preload', cue]), playSE: cue => audioCalls.push(['se:play', cue]),
      playAmbient: () => {}, stopAmbient: () => {}, setAmbientVolume: () => {}, playBgm: () => {}, stopBgm: () => {},
    },
    voicePlayer: { playVoice: () => {} }, resetVoiceDedup: () => {},
  }
  const step = { step_id: 1, type: 'adv', state: { se_events: [{ cue: 'cloth_move_l01', delay: 0 }] } }
  const sceneEffects = useStepSceneEffects(base)
  sceneEffects.handleStepChange(step, null)
  assert.deepEqual(audioCalls, [], 'step watcher must not create a retired SE timer or playback')
  sceneEffects.cleanup()
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
    schema_version: 2,
    ui_locale: 'ja-JP',
    story_content_mode: 'bilingual',
    story_translation_locale: 'zh-CN',
    bilingual_primary: 'translation',
    auto_enabled: true,
    auto_delay_ms: 99999,
    skip_mode: 'all',
    volumes: { master: -1, voice: 2 },
  })
  assert.equal(saved.auto_enabled, true)
  assert.equal(saved.auto_delay_ms, 10000)
  assert.equal(saved.skip_mode, 'all')
  assert.equal(saved.schema_version, 2)
  assert.equal(saved.ui_locale, 'ja-JP')
  assert.equal(saved.story_content_mode, 'bilingual')
  assert.equal(saved.bilingual_primary, 'translation')
  assert.equal(saved.volumes.master, 0)
  assert.equal(saved.volumes.voice, 1)
  assert.equal('text_speed' in saved, false, 'retired text_speed must not survive normalization')
  assert.equal(new PlayerPreferencesRepository({ storage }).load().skip_mode, 'all')

  const retiredPreferenceStorage = memoryStorage({
    'sidem-story-player-preferences': JSON.stringify({
      ...saved,
      text_speed: 4,
    }),
  })
  const retiredPreference = new PlayerPreferencesRepository({ storage: retiredPreferenceStorage }).load()
  assert.equal('text_speed' in retiredPreference, false)
  assert.equal(
    'text_speed' in JSON.parse(retiredPreferenceStorage.getItem('sidem-story-player-preferences')),
    false,
    'loading an old v2 payload must rewrite the retired preference out of storage',
  )

  const migrationStorage = memoryStorage({
    'sidem-story-player-preferences': JSON.stringify({
      schema_version: 1,
      language_mode: 'CN',
      auto_enabled: true,
      auto_delay_ms: 1200,
      skip_mode: 'readOnly',
      volumes: { master: 0.4 },
    }),
  })
  const migrated = new PlayerPreferencesRepository({ storage: migrationStorage }).load()
  assert.equal(migrated.schema_version, 2)
  assert.equal(migrated.ui_locale, 'zh-CN')
  assert.equal(migrated.story_content_mode, 'translation')
  assert.equal(migrated.story_translation_locale, 'zh-CN')
  assert.equal(migrated.bilingual_primary, 'translation')
  assert.equal(migrated.auto_enabled, true)
  assert.equal(migrated.auto_delay_ms, 1200)
  assert.equal(JSON.parse(migrationStorage.getItem('sidem-story-player-preferences')).schema_version, 2)

  const savedLegacy = preferences.save({
    schema_version: 1,
    language_mode: 'BILINGUAL',
    auto_delay_ms: 1400,
  })
  assert.equal(savedLegacy.schema_version, 2)
  assert.equal(savedLegacy.story_content_mode, 'bilingual')
  assert.equal(savedLegacy.bilingual_primary, 'original')
  assert.equal(savedLegacy.auto_delay_ms, 1400)

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
  try {
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
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    console.log('Story runtime mounted-corpus anchors skipped: 1_4_001_01_a/d are not present in this source-only checkout')
  }
}

verifyStoryClock()
await verifyPerformanceRegistry()
await verifyEffectScheduler()
await verifyScreenCueOwner()
await verifyBackgroundCueOwner()
await verifyCameraCueOwner()
await verifySeCueOwner()
await verifyDebugSnapshotCue()
verifyCameraResize()
verifySceneSnapshotStore()
verifyNavigationOverlayReset()
verifyRetiredLegacyOwners()
verifyPlayerStateRepositories()
verifyPlaybackModeController()
await verifyScenarioNormalizer()

console.log('Story runtime foundation: clock, lifecycle, IR v2, sole Runtime channel owners, retired compatibility paths and cue normalization verified')
