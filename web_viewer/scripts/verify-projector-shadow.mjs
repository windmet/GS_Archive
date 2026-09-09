import assert from 'node:assert/strict'
import { captureProjectorShadow } from '../src/core/story-runtime/ProjectorShadow.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { EffectScheduler } from '../src/core/story-runtime/EffectScheduler.js'
import { createPerformanceHandle } from '../src/core/story-runtime/PerformanceRegistry.js'
import { useStoryRuntimeCues } from '../src/core/story-runtime/useStoryRuntimeCues.js'
import { StoryReleaseProbe } from '../src/core/story-runtime/StoryReleaseProbe.js'

let originWall = 0
const originClock = new StoryClock({ nowMilliseconds: () => originWall })
originClock.start(); originWall = 1000; originClock.start()
assert.equal(originClock.elapsedOffset, 1)
originWall = 1500; originClock.pause()
assert.equal(originClock.elapsed() - originClock.now(), originClock.elapsedOffset)
originClock.seek(2); originClock.setRate(2); originClock.resume(); originWall = 2000
assert.equal(originClock.elapsed() - originClock.now(), originClock.elapsedOffset)
originClock.stop()

const cues = [
  { action: 'background.change', payload: { bg: 'B', type: 'dissolve' } },
  { action: 'camera.transform', payload: { zoom: 2 } },
  { action: 'screen.fade', payload: { type: 'out', color: '#FFFFFF', alpha: .8 } },
].map((c, index) => ({ ...c, cue_id: `c${index}`, at: .5, duration: 2 }))
const scenario = { schema_version: 2, steps: [{ step_id: 91, entry_snapshot: { bg: 'A' }, cues }] }
const runtime = { clock: { time: 3, state: 'paused' }, entries: cues.map(c => ({ ...c, started_at: .5, status: 'settled', completion_mode: 'natural' })) }
const bgSprite = alpha => ({ alpha, texture: { orig: { width: 1280, height: 720 } },
  width: 1280, height: 720, x: 0, y: 0, scale: { x: 1, y: 1 }, anchor: { x: 0, y: 0 } })
const manager = { width: 1280, height: 720,
  backgroundManager: { bgSprite: bgSprite(1), currentBgId: 'B' },
  spineContainer: { scale: { x: 2 }, x: -640, y: -360 },
  _fadeOverlay: { visible: true, tint: 0xFFFFFF, alpha: .8 },
  _slideOverlay: { visible: false, tint: 0xFFFFFF, x: 0, y: 0 },
}
const capture = (overrides = {}) => captureProjectorShadow({ scenario, stepIndex: 0, runtime, manager, ...overrides })
const before = JSON.stringify({ scenario, runtime, manager })
assert.equal(capture().status, 'match')
assert.deepEqual(capture(), capture())
assert.equal(JSON.stringify({ scenario, runtime, manager }), before, 'collector must not mutate Runtime or its input')
const shifted = structuredClone(manager); shifted.spineContainer.x += 12
const diff = capture({ manager: shifted })
assert.equal(diff.status, 'difference')
assert.deepEqual(diff.channels.camera.differences, [{ path: 'x', expected: -640, actual: -628, delta: 12 }])
const pending = structuredClone(manager)
pending.backgroundManager._bgTransition = { newSprite: null, newBgId: 'B' }
assert.equal(capture({ manager: pending }).channels.background.reason, 'texture-pending')
const settled = structuredClone(runtime); settled.entries[0].completion_mode = 'explicit-settlement'
assert.equal(capture({ runtime: settled }).channels.background.reason, 'explicit-settlement-requires-resolved-entry')
const delayed = structuredClone(manager)
delayed.backgroundManager._bgTransition = { oldBgId: 'A', newBgId: 'B', oldSprite: bgSprite(.5), newSprite: bgSprite(.5), startedAtMilliseconds: 1500 }
const midway = capture({ manager: delayed, runtime: { ...runtime, clock: { time: 2.5, state: 'paused' } } })
assert.equal(midway.channels.background.status, 'match', 'texture-ready clock must replace dispatch time for a live background transition')
const tweenTimed = structuredClone(manager)
const tweenStart = .507, sampledAt = 1.5
const eased = 1 - (1 - (sampledAt - tweenStart) / 2) ** 3
tweenTimed._fadeOverlay.alpha = .8 * eased
tweenTimed._screenFadeTween = { startedAtMilliseconds: tweenStart * 1000, sampledAtMilliseconds: sampledAt * 1000 }
const samplingRuntime = { ...runtime, clock: { time: sampledAt, state: 'paused' } }
assert.equal(capture({ manager: tweenTimed, runtime: samplingRuntime }).channels.screen.status, 'match')
delete tweenTimed._screenFadeTween
assert.equal(capture({ manager: tweenTimed, runtime: samplingRuntime }).channels.screen.status, 'difference', 'dispatch time is not the actual tween start')
const restored = capture({ scenario: { schema_version: 2, steps: [{ ...scenario.steps[0], entry_snapshot: {} }] },
  runtime: { ...runtime, entries: [] }, context: { historyId: 'visit:2', cuePolicy: 'suppressed',
    entrySnapshot: { bg: 'B', camera_zoom: { zoom: 2 }, screen_overlay: { visible: true, kind: 'fade', color: '#FFFFFF', alpha: .8 } } } })
assert.equal(restored.status, 'match')
assert.equal(capture({ manager: null }).reason, 'runtime-not-ready')
const missingTexture = structuredClone(manager)
delete missingTexture.backgroundManager.bgSprite.texture
assert.equal(capture({ manager: missingTexture }).channels.backgroundGeometry.reason, 'texture-dimensions-unavailable')
const shiftedBg = structuredClone(manager)
shiftedBg.backgroundManager.bgSprite.x = 7
assert.deepEqual(capture({ manager: shiftedBg }).channels.backgroundGeometry.differences,
  [{ path: '0.x', expected: 0, actual: 7, delta: 7 }])
assert.equal(capture({ manager: pending }).channels.backgroundGeometry.reason, 'texture-pending')
assert.equal(midway.channels.backgroundGeometry.status, 'match')
const filterShift = structuredClone(manager)
filterShift.backgroundManager._bgBlurAmount = 2
assert.equal(capture({ manager: filterShift }).channels.backgroundFilters.status, 'difference')
filterShift.backgroundManager._bgBlurTween = { rafId: 1 }
assert.equal(capture({ manager: filterShift }).channels.backgroundFilters.reason, 'filter-transition-active')

const tintScenario = structuredClone(scenario)
tintScenario.steps[0].entry_snapshot.spines = [{ id: '001tom', idol_color: '#FFFFFF' }]
tintScenario.steps[0].cues.push({ cue_id: 'tint', action: 'spine.visual.tint', target: '001tom', at: .5, duration: 2, payload: { value: '#000000' } })
const tintRuntime = structuredClone(runtime)
tintRuntime.clock.time = 3
tintRuntime.entries.push({ cue_id: 'tint', action: 'spine.visual.tint', at: .5, duration: 2, started_at: .5, status: 'settled', completion_mode: 'natural' })
const tintManager = { ...manager, spineInstances: { '001tom': { spine: { tint: 0 } } } }
const tintCapture = overrides => capture({ scenario: tintScenario, runtime: tintRuntime, manager: tintManager, isSpineReady: () => true, ...overrides }).channels.spineTints
assert.equal(tintCapture().status, 'match')
assert.equal(tintCapture({ isSpineReady: () => false }).entries[0].reason, 'spine-not-ready')
assert.equal(tintCapture({ manager: { ...tintManager, spineInstances: {} } }).entries[0].reason, 'spine-not-ready')
assert.equal(tintCapture({ manager: { ...tintManager, spineInstances: { '001tom': { spine: { tint: 1 } } } } }).status, 'difference', 'integer RGB mismatch must remain visible')
const activeTint = structuredClone(tintRuntime)
activeTint.clock.time = 2
activeTint.entries.at(-1).status = 'running'
assert.equal(tintCapture({ runtime: activeTint }).entries[0].reason, 'tint-start-not-observed')
const observedTint = { ...tintManager, spineInstances: { '001tom': { spine: { tint: 0x6C6C6C } } },
  _spineColorTweens: { '001tom': { startedAtMilliseconds: 1500, sampledAtMilliseconds: 2000, projectorCueId: 'tint' } } }
assert.equal(tintCapture({ runtime: activeTint, manager: observedTint }).status, 'match', 'use actual tween start after readiness delay')
assert.equal(tintCapture({ runtime: activeTint, manager: { ...observedTint, _spineColorTweens: { '001tom': { startedAtMilliseconds: 1500 } } } }).entries[0].reason, 'unattributed-tint-transition')
const tintBefore = JSON.stringify({ tintScenario, activeTint, observedTint })
tintCapture({ runtime: activeTint, manager: observedTint })
assert.equal(JSON.stringify({ tintScenario, activeTint, observedTint }), tintBefore)

let wall = 0
const clock = new StoryClock({ nowMilliseconds: () => wall })
const scheduler = new EffectScheduler({ clock, requestFrame: () => 1, cancelFrame: () => {} })
const timedCue = { cue_id: 'timed', action: 'camera.transform', channel: 'camera', at: .5, duration: 2 }
const handlers = new Map([['camera.transform', c => createPerformanceHandle({ id: c.cue_id, channel: c.channel })]])
scheduler.loadStep([timedCue], { handlers }); scheduler.start()
wall = 800; scheduler.tick(); await Promise.resolve()
assert.equal(scheduler.inspect().entries[0].started_at, .8)
await scheduler.settleSkippable()
assert.equal(scheduler.inspect().entries[0].completion_mode, 'explicit-settlement')
scheduler.loadStep([timedCue], { handlers }); scheduler.start()
wall = 1400; scheduler.tick(); await Promise.resolve()
wall = 4000; scheduler.tick(); await Promise.resolve()
assert.equal(scheduler.inspect().entries[0].completion_mode, 'natural')
await scheduler.dispose()
const probe = new StoryReleaseProbe()
let inspections = 0
const detach = probe.registerViewer(({ includeProjector }) => {
  if (includeProjector) inspections++
  return includeProjector ? { projector_shadow: capture() } : {}
})
assert.ok(!Object.hasOwn(probe.collectSnapshot(), 'projector_shadow'))
assert.equal(inspections, 0, 'ordinary soak recording must not invoke shadow projection')
assert.equal(probe.collectSnapshot({ includeProjector: true }).projector_shadow.status, 'match')
detach()
assert.equal(probe.collectSnapshot({ includeProjector: true }).projector_shadow.reason, 'viewer-not-mounted')
const savedWindow = globalThis.window
try {
  globalThis.window = {}
  const entry = { bg: 'B', camera_zoom: { zoom: 2 }, screen_overlay: { visible: true, kind: 'fade', color: '#FFFFFF', alpha: .8 } }
  const data = { value: { schema_version: 2, steps: [{ step_id: 91, entry_snapshot: entry, cues: [] }] } }
  const index = { value: 0 }
  let writes = 0
  const trackedManager = { ...manager, setBackground: () => writes++, setCameraZoom: () => writes++,
    clearScreenFade: () => writes++, clearScreenSlide: () => writes++, setScreenFade: () => writes++ }
  const stageRef = { value: { manager: trackedManager } }
  const runtimeCues = useStoryRuntimeCues({ compiledData: data, currentStepIndex: index, spineStageRef: stageRef })
  assert.equal(runtimeCues.inspectProjectorShadow().reason, 'not-started')
  runtimeCues.handleStepChange()
  const priorWrites = writes
  assert.equal(runtimeCues.inspectProjectorShadow().status, 'match')
  assert.equal(writes, priorWrites, 'on-demand inspection cannot write to managers')
  stageRef.value = { manager: { ...trackedManager } }
  assert.equal(runtimeCues.inspectProjectorShadow().reason, 'stage-manager-replaced')
  stageRef.value = { manager: trackedManager }
  index.value = 1
  assert.equal(runtimeCues.inspectProjectorShadow().reason, 'navigation-pending')
  index.value = 0
  runtimeCues.cancelCurrentStep('history-restore')
  runtimeCues.prepareRestore(0, entry)
  runtimeCues.handleStepChange()
  assert.equal(runtimeCues.inspectProjectorShadow().expected.basis.cue_policy, 'suppressed')
  runtimeCues.cleanup()
  assert.equal(runtimeCues.inspectProjectorShadow().reason, 'cleanup')
} finally { globalThis.window = savedWindow }
console.log('Projector shadow verified: read-only collection, exact differences, delayed textures, settlement, restore and opt-in diagnostics')
