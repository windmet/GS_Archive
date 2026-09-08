import assert from 'node:assert/strict'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { createSpineCueHandle } from '../src/core/story-runtime/SpineCueRuntime.js'

let wall = 0, sequence = 0
const frames = new Map()
const saved = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame]
globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const tick = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
try {
  const stage = Object.assign(Object.create(PixiStageManager.prototype), {
    spineInstances: { fixture: { spine: { tint: 0xFFFFFF } } }, _spineColorTweens: {},
    backgroundManager: Object.create(BackgroundManager.prototype),
    removeSilhouette: () => {}, clearAllSilhouettes: () => {},
  })
  const clock = new StoryClock({ nowMilliseconds: () => wall })
  clock.start()
  const cue = { cue_id: 'tint', action: 'spine.visual.tint', target: 'fixture', channel: 'tint',
    duration: 2, payload: { value: '#000000' }, lifecycle: { persistence: 'stateful', skippable: true } }
  const make = () => createSpineCueHandle(cue, { step: { entry_snapshot: { spines: [{ id: 'fixture' }] } } }, {
    getManager: () => stage, getGeneration: () => 1, nowMilliseconds: () => clock.now() * 1000,
  })
  const handle = make(); await handle.start()
  wall = 1000; tick()
  assert.equal(stage.spineInstances.fixture.spine.tint, 0x202020)
  clock.pause(); wall += 10000; tick()
  assert.equal(stage.spineInstances.fixture.spine.tint, 0x202020)
  clock.setRate(2); clock.resume(); wall += 500; tick()
  assert.equal(stage.spineInstances.fixture.spine.tint, 0)
  assert.equal(frames.size, 0); assert.deepEqual(stage._spineColorTweens, {})
  stage.setSpineColor('fixture', '#FFFFFF')
  const cancelled = make(); await cancelled.start(); wall += 100; tick()
  const intermediate = stage.spineInstances.fixture.spine.tint
  await cancelled.cancel('navigation'); wall += 10000; tick()
  assert.equal(stage.spineInstances.fixture.spine.tint, intermediate)
  assert.equal(frames.size, 0)
  const older = make(); await older.start()
  const newer = stage.setSpineColor('fixture', '#FF0000', 2, 0, () => clock.now() * 1000)
  await older.cancel('navigation')
  assert.equal(stage._spineColorTweens.fixture, newer, 'old cancellation must not remove the new owner')
  assert.equal(frames.size, 1)
  const settled = make(); await settled.start(); await settled.settle('skip')
  assert.equal(stage.spineInstances.fixture.spine.tint, 0)
  assert.equal(frames.size, 0); assert.deepEqual(stage._spineColorTweens, {})
  for (const remove of [() => stage.removeSpine('fixture'), () => stage.clearAllSpines()]) {
    stage.setSpineColor('fixture', '#FFFFFF', 2)
    assert.equal(frames.size, 1); remove()
    assert.equal(frames.size, 0); assert.deepEqual(stage._spineColorTweens, {})
  }
  console.log('Spine tint: logical pause/rate, cancel ownership, settle and model removal passed')
} finally {
  [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = saved
}
