import assert from 'node:assert/strict'
import { useStoryRuntimeCues } from '../src/core/story-runtime/useStoryRuntimeCues.js'

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
console.log('Step playback state: selected rate, paused navigation, multiple reasons, resumed cues and paused history restore passed')
