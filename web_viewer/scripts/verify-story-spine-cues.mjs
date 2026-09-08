import assert from 'node:assert/strict'
import { useStoryRuntimeCues } from '../src/core/story-runtime/useStoryRuntimeCues.js'
import { createSpineCueHandle } from '../src/core/story-runtime/SpineCueRuntime.js'
import { createPerformanceHandle } from '../src/core/story-runtime/PerformanceRegistry.js'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { normalizeScenario } from '../src/core/story-runtime/ScenarioNormalizer.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'

const saved = Object.fromEntries(['window', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globalThis[key]]))
let sequence = 0
const frames = new Map()
globalThis.window = {}
globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
async function frame() {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach(callback => callback())
  await flush()
}

function makeStep(id, { target = 'fixture', action = 'spine.face.set', at = 0, transient = false } = {}) {
  return {
    step_id: id, type: 'dialogue', entry_snapshot: { spines: [{ id: 'fixture', model: 'fixture_model' }] },
    cues: [{
      cue_id: `step-${id}:${action}`, action, target, channel: `spine:${target}:fixture`, at, duration: 0,
      payload: { value: `value-${id}`, anim_flag: '1', blush_flag: '0', sweat_flag: '1' },
      lifecycle: { persistence: transient ? 'transient' : 'stateful', skippable: true, blocks_auto: true, blocks_input: false, restore_policy: transient ? 'suppress' : 'settled' },
    }],
  }
}

function setup(steps, { ready = true, sceneReady = null } = {}) {
  const calls = []
  const manager = {
    spineInstances: ready ? { fixture: { modelId: 'fixture_model' } } : {},
    updateSpineFace: (...args) => calls.push(['face', ...args]),
    playSpineAnim: (...args) => calls.push(['body', ...args]),
    setSpineColor: (...args) => calls.push(['tint', ...args]),
    playSpineNeckAnim: (...args) => calls.push(['neck', ...args]),
    stopSpineNeckAnim: (...args) => calls.push(['neck-stop', ...args]),
    flushSpinePose: (...args) => calls.push(['flush', ...args]),
  }
  const currentStepIndex = { value: 0 }
  const stage = { manager }
  if (sceneReady) stage.isSpineReady = (target, step) => sceneReady.value && step === steps[currentStepIndex.value]
  const runtime = useStoryRuntimeCues({ compiledData: { value: { schema_version: 2, steps } }, currentStepIndex, spineStageRef: { value: stage }, audioManager: {} })
  return { runtime, manager, calls, currentStepIndex }
}

const runtimes = []
function create(...args) { const context = setup(...args); runtimes.push(context.runtime); return context }

try {
  // Compile the committed RAW timing matrix through the real Python compiler.
  // Nothing is published and no mounted corpus is read or modified.
  const compiledFixtures = JSON.parse(execFileSync('python', ['-c', `
import json, sys, hashlib
from pathlib import Path
root = Path(sys.argv[1])
sys.path.insert(0, str(root.parent / 'data_pipeline'))
from scenario_compiler import ScenarioCompiler
fixtures = ['step9-missing-target-timing-raw.json', 'timing-pending-fade-target-raw.json', 'timing-visible-target-extension-raw.json', 'timing-authored-long-choreography-raw.json']
result = []
for name in fixtures:
    path = root / 'fixtures' / 'story-runtime' / name
    def compile(contract):
        return ScenarioCompiler(json.loads(path.read_text(encoding='utf-8-sig')), 'fixture_timing', 'fixture_timing', 'fixtures/story-runtime/' + name).compile(output_contract=contract, source={'raw_path': 'fixtures/story-runtime/' + name, 'raw_hash': 'sha256:' + hashlib.sha256(path.read_bytes()).hexdigest()})
    result.append({'name': name, 'legacy': compile('compatibility'), 'strict': compile('authoritative')})
print(json.dumps(result))
`, fileURLToPath(new URL('../', import.meta.url))], { encoding: 'utf8' }))
  for (const fixture of compiledFixtures) {
    const legacyStep = normalizeScenario(fixture.legacy).steps[0]
    const strictStep = fixture.strict.steps[0]
    const cue = strictStep.cues.find(item => item.action === 'spine.body.play')
    assert.ok(cue, fixture.name)
    const compatCue = legacyStep.cues.find(item => item.action === cue.action && item.at === cue.at)
    assert.equal(compatCue.target, cue.target)
    assert.equal(compatCue.payload.value, cue.payload.value)
    assert.equal(strictStep.duration, legacyStep.duration)
    assert.ok(Number.isInteger(cue.evidence.command_start), 'cue retains the RAW command location')
    const calls = []
    const manager = { spineInstances: Object.fromEntries(strictStep.entry_snapshot.spines.map(spine => [spine.id, { modelId: spine.model }])), playSpineAnim: (...args) => calls.push(args) }
    const handle = createSpineCueHandle(cue, { step: strictStep }, { getManager: () => manager, getGeneration: () => 1, motionSettingFor: () => null })
    await handle.settle('fixture-skip')
    const targetExists = strictStep.entry_snapshot.spines.some(spine => spine.id === cue.target)
    assert.equal(calls.length, Number(targetExists), fixture.name)
    if (targetExists) assert.deepEqual(calls[0].slice(0, 2), [cue.target, cue.payload.value])
  }

  // A mounted stage may still be loading a model when a cue starts.
  const sceneReady = { value: false }
  const existingButUnprojected = create([makeStep(1)], { sceneReady })
  existingButUnprojected.runtime.handleStepChange()
  await flush()
  assert.equal(existingButUnprojected.calls.length, 0, 'an existing model is not proof that the current entry pose is applied')
  sceneReady.value = true
  await frame()
  assert.equal(existingButUnprojected.calls.length, 1)
  existingButUnprojected.runtime.cleanup()

  const loading = create([makeStep(1)], { ready: false })
  loading.runtime.handleStepChange()
  assert.equal(loading.runtime.hasBlockingAuto(), true)
  loading.runtime.cleanup()
  await flush()
  assert.equal(frames.size, 0, 'cleanup must cancel model-readiness frames without needing another browser frame')
  assert.equal(loading.runtime.hasBlockingAuto(), false)

  const skipWhileLoading = create([makeStep(1)], { ready: false })
  skipWhileLoading.runtime.handleStepChange()
  skipWhileLoading.runtime.settleCurrentStep('skip')
  skipWhileLoading.runtime.cleanup()
  await flush()
  assert.equal(frames.size, 0, 'navigation must interrupt Skip settlement while a model is loading')
  assert.equal(skipWhileLoading.runtime.hasBlockingAuto(), false)

  const normal = create([makeStep(1)])
  normal.runtime.handleStepChange()
  await flush()
  assert.deepEqual(normal.calls, [['face', 'fixture', 'value-1', { anim_flag: '1', blush_flag: '0', sweat_flag: '1' }]])
  normal.runtime.cleanup()
  await flush()

  const delayed = create([makeStep(1, { at: 100 }), makeStep(2)])
  delayed.runtime.handleStepChange()
  assert.equal(delayed.calls.length, 0, 'a future cue must not execute at step entry')
  delayed.runtime.settleCurrentStep('skip')
  await flush()
  assert.equal(delayed.calls[0]?.[2], 'value-1', 'skip must apply the stateful destination')
  delayed.currentStepIndex.value = 1
  delayed.runtime.handleStepChange()
  await flush()
  assert.equal(delayed.calls.at(-1)?.[2], 'value-2')
  assert.equal(delayed.runtime.prepareRestore(0, { spines: [], bg: null }), true)
  delayed.currentStepIndex.value = 0
  delayed.runtime.handleStepChange()
  await flush()
  assert.equal(delayed.calls.length, 2, 'history restore must not replay a delayed cue')
  delayed.runtime.cleanup()
  await flush()

  const navigating = create([makeStep(1), makeStep(2)], { ready: false })
  navigating.runtime.handleStepChange()
  navigating.currentStepIndex.value = 1
  navigating.runtime.handleStepChange()
  navigating.manager.spineInstances.fixture = { modelId: 'fixture_model' }
  await frame()
  assert.deepEqual(navigating.calls.map(call => call[2]), ['value-2'], 'a late model must not receive the previous step pose')
  navigating.runtime.cleanup()
  await flush()

  const absent = create([makeStep(1, { target: 'not-in-entry' })], { ready: false })
  absent.runtime.handleStepChange()
  await flush()
  assert.equal(absent.runtime.hasBlockingAuto(), false)
  assert.equal(absent.calls.length, 0)
  absent.runtime.cleanup()
  await flush()
  assert.equal(frames.size, 0)

  // Exercise renderer arguments and owned completion frames without wall-clock sleeps.
  const track = { animationStart: 0, animationEnd: 2, trackTime: 0, listener: null }
  const direct = create([])
  direct.manager.spineInstances.fixture.spine = { state: { getCurrent: () => track } }
  let now = 0
  const dependencies = {
    getManager: () => direct.manager, getGeneration: () => 1,
    motionSettingFor: () => 'motion-fixture', now: () => now,
  }
  for (const action of ['spine.body.play', 'spine.visual.tint', 'spine.neck.stop']) {
    const step = makeStep(1, { action })
    step.cues[0].duration = 0.7
    step.cues[0].payload.no_back = true
    const handle = createSpineCueHandle(step.cues[0], { step }, dependencies)
    await handle.start()
    await handle.complete()
  }
  assert.deepEqual(direct.calls, [
    ['body', 'fixture', 'value-1', false, true, 'motion-fixture', true, 0.3],
    ['tint', 'fixture', 'value-1', 0.7, 0],
    ['neck-stop', 'fixture', 'step-1:spine.neck.stop'],
  ])
  direct.calls.length = 0

  for (const completion of ['natural', 'fallback', 'skip', 'step-change', 'cleanup']) {
    const step = makeStep(1, { action: 'spine.neck.play', transient: true })
    const handle = createSpineCueHandle(step.cues[0], { step }, dependencies)
    const start = handle.start()
    assert.equal(frames.size, 1)
    if (completion === 'natural') { track.listener.complete(); await start; await handle.complete() }
    else if (completion === 'fallback') { now += 2250; await frame(); await start; await handle.complete() }
    else if (completion === 'skip') { await handle.settle('skip'); await start; assert.equal(track.trackTime, 2) }
    else { await handle.cancel(completion); await start }
    assert.equal(frames.size, 0, `${completion} releases the neck fallback frame`)
    assert.equal(track.listener, null, `${completion} releases the owned completion listener`)
    if (completion === 'step-change') assert.equal(direct.calls.some(call => call[0] === 'neck-stop'), false, 'step change preserves the authored pose')
    if (completion === 'cleanup') assert.equal(direct.calls.at(-1)[0], 'neck-stop')
    direct.calls.length = 0
  }

  // Missing renderer completion must respect paused and accelerated story time.
  {
    let wall = 0, completed = false
    const clock = new StoryClock({ nowMilliseconds: () => wall })
    clock.start({ offset: 12 })
    const step = makeStep(1, { action: 'spine.neck.play', transient: true })
    const handle = createSpineCueHandle(step.cues[0], { step }, {
      ...dependencies, nowMilliseconds: () => clock.now() * 1000,
    })
    const pending = handle.start().then(() => { completed = true })
    wall = 500; await frame()
    clock.pause(); wall = 10000; await frame()
    assert.equal(completed, false, 'wall time during pause cannot release neck completion')
    assert.equal(frames.size, 1)
    clock.setRate(2); clock.resume()
    wall += 874; await frame()
    assert.equal(completed, false, 'fallback must retain the remaining logical duration')
    wall += 1; await frame(); await pending
    assert.equal(completed, true)
    assert.equal(track.listener, null)
    assert.equal(frames.size, 0)
    await handle.complete()
  }

  direct.calls.length = 0
  direct.manager.spineInstances = {}
  const timeoutStep = makeStep(1)
  const timeoutHandle = createSpineCueHandle(timeoutStep.cues[0], { step: timeoutStep }, dependencies)
  const waiting = timeoutHandle.start()
  now += 5001
  await frame()
  await waiting
  await timeoutHandle.complete()
  assert.equal(direct.calls.length, 0, 'unavailable model times out without inventing a renderer target')
  assert.equal(frames.size, 0)

  // A late asynchronous completion cannot overwrite cancellation or revive a handle.
  for (const outcome of ['resolve', 'reject']) {
    let finish
    let cancels = 0
    const handle = createPerformanceHandle({ id: `pending-${outcome}`, channel: 'fixture',
      onSettle: () => new Promise((resolve, reject) => { finish = outcome === 'resolve' ? resolve : reject }),
      onCancel: () => { cancels++ },
    })
    const settlement = handle.settle('skip')
    await Promise.all([handle.cancel('navigation'), handle.cancel('cleanup')])
    assert.equal(cancels, 1)
    assert.equal((await handle.finished).status, 'cancelled')
    finish(new Error('late fixture failure'))
    await settlement
    assert.equal(handle.status, 'cancelled')
  }
  for (const operation of ['start', 'pause', 'resume']) {
    let finish
    const delayedOperation = () => new Promise((resolve, reject) => { finish = operation === 'start' ? reject : resolve })
    const handle = createPerformanceHandle({ id: `late-${operation}`, channel: 'fixture',
      status: operation === 'pause' ? 'running' : operation === 'resume' ? 'paused' : 'scheduled',
      onStart: delayedOperation, onPause: delayedOperation, onResume: delayedOperation,
    })
    const pending = handle[operation]()
    await handle.cancel('cleanup')
    finish(new Error('late start failure'))
    await pending
    assert.equal(handle.status, 'cancelled', `${operation} must not overwrite cancellation`)
  }
  let starts = 0
  const cancelledBeforeStart = createPerformanceHandle({ id: 'cancel-before-start', channel: 'fixture', onStart: () => { starts++ } })
  const cancellation = cancelledBeforeStart.cancel('cleanup')
  await cancelledBeforeStart.start()
  await cancellation
  assert.equal(starts, 0, 'cancellation must take effect before its Promise continuation')
  console.log('Story Spine cue integration: model readiness, delayed stateful skip, navigation invalidation, restore suppression, logical neck fallback and cleanup verified.')
} finally {
  for (const runtime of runtimes) runtime.cleanup()
  await flush()
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
}
