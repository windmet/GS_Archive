import assert from 'node:assert/strict'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { SpineManager } from '../src/core/SpineManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'

let wall = 0, next = 0
const frames = new Map()
const savedRequest = globalThis.requestAnimationFrame
const savedCancel = globalThis.cancelAnimationFrame
globalThis.requestAnimationFrame = callback => { frames.set(++next, callback); return next }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const tick = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()) }
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)
try {
  const clock = new StoryClock({ nowMilliseconds: () => wall })
  clock.start()
  const spine = { x: 0, y: 0 }
  const entry = { spine }
  const stage = Object.assign(Object.create(PixiStageManager.prototype), { spineInstances: { idol: entry } })
  const animate = (x, y, duration) => stage.animateSpinePosition('idol', x, y, duration, () => clock.elapsed() * 1000)
  animate(100, 200, 2)
  wall = 500; tick()
  close(spine.x, 57.8125); close(spine.y, 115.625)
  clock.pause()
  wall = 10000; tick()
  close(spine.x, 57.8125)
  clock.resume()
  wall = 10500; tick()
  close(spine.x, 87.5)
  animate(0, 0, 1)
  assert.equal(frames.size, 1, 'replacement cancels prior frame')
  wall = 11500; tick()
  close(spine.x, 0); close(spine.y, 0)
  assert.equal(frames.size, 0)
  assert.equal(entry._slideTweenRaf, null)
  clock.setRate(2)
  animate(100, 200, 2)
  wall += 500; tick()
  close(spine.x, 87.5)
  clock.start({ offset: 0, rate: 2 })
  wall += 500; tick()
  close(spine.x, 100)
  animate(0, 0, 0)
  animate(10, 20, 1)
  stage.cancelAllSpineTweens()
  wall += 2000; tick()
  close(spine.x, 0)
  assert.equal(frames.size, 0)
  animate(10, 20, 0)
  close(spine.x, 10); close(spine.y, 20)
  assert.equal(frames.size, 0)

  // Exercise the actual stage -> SpineManager -> RAF alpha path without a GPU.
  stage.spineManager = new SpineManager(stage)
  const filter = { alpha: 1, enabled: false }
  stage.spineManager._wholeModelAlphaFilter = () => filter
  spine.visible = true
  clock.setRate(1)
  const alpha = (value, duration, delay) => stage.animateSpineAlpha('idol', value, duration, delay, () => clock.elapsed() * 1000)
  alpha(0, 2, 1)
  wall += 500; tick()
  close(filter.alpha, 1)
  clock.pause()
  wall += 5000; tick()
  close(filter.alpha, 1)
  clock.resume()
  wall += 1000; tick()
  close(filter.alpha, 0.421875)
  clock.setRate(2)
  wall += 750; tick()
  close(filter.alpha, 0)
  assert.equal(spine.visible, false)
  assert.equal(entry._alphaTween, null)
  assert.equal(frames.size, 0)
  alpha(1, 2, 0)
  assert.equal(spine.visible, true)
  wall += 500; tick()
  close(filter.alpha, 0.875)
  alpha(0, 1, 0)
  assert.equal(frames.size, 1)
  stage.spineManager.setSpineAlpha('idol', 1)
  wall += 1000; tick()
  close(filter.alpha, 1)
  assert.equal(filter.enabled, false)
  assert.equal(frames.size, 0)
} finally {
  globalThis.requestAnimationFrame = savedRequest
  globalThis.cancelAnimationFrame = savedCancel
}
console.log('Spine position: logical clock, pause/resume, rate, step reset, replacement, cancellation and immediate completion passed')
console.log('Spine alpha: stage forwarding, delayed pause/resume, rate, terminal visibility, replacement and immediate cancellation passed')
