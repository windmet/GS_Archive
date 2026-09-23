import assert from 'node:assert/strict'
import { useStoryRuntimeCues } from '../src/core/story-runtime/useStoryRuntimeCues.js'
import { useStepSceneEffects } from '../src/core/useStepSceneEffects.js'

const saved = { window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame }
const frames = new Map()
let frameId = 0
globalThis.window = {}
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const tick = async () => {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach(callback => callback())
  await Promise.resolve()
}
try {
  const pauseReasons = new Set()
  const currentStepIndex = { value: 0 }
  const starts = []
  const runtime = useStoryRuntimeCues({
    compiledData: { value: { schema_version: 2, scenario_id: 'playback-state', steps: [1, 2, 3].map(step_id => ({
      step_id, type: 'stage', entry_snapshot: {}, settled_snapshot: {},
      cues: [{ cue_id: `camera-${step_id}`, action: 'camera.transform', channel: 'camera', at: 0, duration: 10,
        payload: { zoom: 2, offset_x: 0, offset_y: 0 }, lifecycle: { skippable: true, blocks_auto: true } }],
    })) } },
    currentStepIndex, audioManager: {},
    spineStageRef: { value: { manager: { setCameraZoom: camera => { if (camera.duration > 0) starts.push(currentStepIndex.value) } } } },
    isPaused: () => pauseReasons.size > 0,
  })
  runtime.setRate(2)
  runtime.handleStepChange()
  await tick()
  assert.equal(runtime.inspect().clock.rate, 2, 'first step must retain preselected rate')
  assert.deepEqual(starts, [0])
  pauseReasons.add('menu')
  pauseReasons.add('hidden')
  await runtime.pause()
  runtime.cancelCurrentStep()
  currentStepIndex.value = 1
  runtime.handleStepChange()
  await tick()
  assert.equal(runtime.inspect().clock.state, 'paused')
  assert.equal(runtime.inspect().clock.time, 0)
  assert.equal(runtime.inspect().clock.rate, 2)
  assert.deepEqual(starts, [0], 'paused entry must not start even an at-zero cue')
  assert.equal(frames.size, 0)
  pauseReasons.delete('menu')
  await tick()
  assert.deepEqual(starts, [0], 'remaining pause reason still blocks playback')
  runtime.setRate(0.5)
  pauseReasons.delete('hidden')
  await runtime.resume()
  await tick()
  assert.deepEqual(starts, [0, 1])
  assert.equal(runtime.inspect().clock.rate, 0.5)
  runtime.cancelCurrentStep()
  currentStepIndex.value = 2
  runtime.handleStepChange()
  await tick()
  assert.equal(runtime.inspect().clock.rate, 0.5, 'subsequent step retains changed rate')
  assert.deepEqual(starts, [0, 1, 2])
  pauseReasons.add('history')
  await runtime.pause()
  runtime.prepareRestore(0, {})
  currentStepIndex.value = 0
  runtime.handleStepChange()
  await tick()
  assert.equal(runtime.inspect().clock.state, 'paused')
  assert.equal(runtime.inspect().entries.length, 0)
  assert.deepEqual(starts, [0, 1, 2], 'restored snapshot must not replay cues')
  runtime.cleanup()
  await Promise.resolve()
  assert.equal(frames.size, 0)
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
}

const waitFor = async predicate => {
  const deadline = Date.now() + 1000
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
  assert.ok(predicate(), 'auto advance did not settle before the deadline')
}
{
  const index = { value: 0 }
  const history = { value: [] }
  const captures = []
  let blocked = false
  let dedupResets = 0
  const effects = useStepSceneEffects({
    currentStepIndex: index, historyStack: history, isLastStep: { value: false },
    spineStageRef: { value: null }, audioManager: { inspect: () => ({}) },
    voicePlayer: { playVoice: () => {} }, resetVoiceDedup: () => { dedupResets++ },
    isAutoBlocked: () => blocked,
    beforeStepChange: target => captures.push({ source: index.value, target }),
  })
  try {
    effects.handleStepChange({ type: 'text_disable', duration: 0.2, entry_snapshot: {} }, null)
    await waitFor(() => index.value === 1)
    assert.deepEqual(captures, [{ source: 0, target: 1 }], 'text-disable bridge must capture before its auto navigation')
    assert.deepEqual(history.value, [], 'text-disable bridge must keep its authored history behavior')

    blocked = true
    effects.handleStepChange({ type: 'stage', duration: 0.05, entry_snapshot: {} }, null)
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(index.value, 1, 'blocked auto advance must not change the step')
    assert.equal(captures.length, 1, 'blocked auto advance must not capture a future frame')
    blocked = false
    await waitFor(() => index.value === 2)
    assert.deepEqual(captures[1], { source: 1, target: 2 })
    assert.deepEqual(history.value, [1], 'stage auto advance must retain its authored history push')
    assert.equal(dedupResets, 2)

    effects.handleStepChange({ type: 'text_disable', duration: 0.2, entry_snapshot: {} }, null)
    effects.cleanup()
    await new Promise(resolve => setTimeout(resolve, 330))
    assert.equal(index.value, 2, 'cleanup must revoke a pending auto advance and its frame capture')
    assert.equal(captures.length, 2)
  } finally {
    effects.cleanup()
  }
}
console.log('Step playback state: pause/rate/history restore and auto-transition frame capture ordering passed')
