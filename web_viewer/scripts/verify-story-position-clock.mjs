import assert from 'node:assert/strict'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
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
} finally {
  globalThis.requestAnimationFrame = savedRequest
  globalThis.cancelAnimationFrame = savedCancel
}
console.log('Spine position: logical clock, pause/resume, rate, step reset, replacement, cancellation and immediate completion passed')
