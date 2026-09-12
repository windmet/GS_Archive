import assert from 'node:assert/strict'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { SpineManager } from '../src/core/SpineManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'

const saved = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, ResizeObserver: globalThis.ResizeObserver }
let frameId = 0, wall = 0
const frames = new Map()
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId }
globalThis.cancelAnimationFrame = id => frames.delete(id)
globalThis.ResizeObserver = class {
  constructor(callback) { this.callback = callback }
  observe() {}
}
const tick = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()) }
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)
function setup(responsiveSpinePositions) {
  const spine = { x: 0, y: 0, alpha: 0.7, visible: true, scale: { x: 0.75, y: 0.75 } }
  const entry = { spine, positioning: {}, modelId: 'fixture' }
  const manager = Object.assign(Object.create(PixiStageManager.prototype), {
    width: 390, height: 844, responsiveSpinePositions, spineInstances: { idol: entry },
    app: { renderer: { resize() {} } }, _silhouetteSprites: {},
  })
  manager.spineManager = new SpineManager(manager)
  manager._observeResize()
  const resize = (width, height) => manager._resizeObserver.callback([{ contentRect: { width, height } }])
  return { manager, spine, entry, resize }
}
try {
  const { manager, spine, entry, resize } = setup(true)
  manager.setSpinePositionByGameCoord('idol', 100, 50, 780)
  close(spine.x, 225.46875); close(spine.y, 764.765625)
  resize(1280, 800)
  close(spine.x, 740); close(spine.y, 730)
  resize(320, 740)
  close(spine.x, 185); close(spine.y, 767.5)
  assert.equal(spine.alpha, 0.7)
  assert.equal(spine.visible, true)
  assert.deepEqual(spine.scale, { x: 0.75, y: 0.75 })
  assert.equal(frames.size, 0, 'static resize must not start animation frames')
  close(entry.positioning.finalRootY, spine.y)

  const clock = new StoryClock({ nowMilliseconds: () => wall })
  clock.start()
  manager.setSpinePositionByGameCoord('idol', -100, 0, 780)
  manager.animateSpinePosition('idol', 185, 730, 2, () => clock.elapsed() * 1000, 780)
  wall = 500; tick()
  const eased = 1 - 0.75 ** 3
  close(spine.x, 135 + 50 * eased)
  clock.pause()
  const pendingFrame = entry._slideTweenRaf
  resize(1280, 800)
  close(spine.x, 540 + 200 * eased)
  close(spine.y, 780 - 200 * eased)
  assert.equal(entry._slideTweenRaf, pendingFrame, 'resize preserves the scheduled tween')
  assert.equal(frames.size, 1)
  wall = 5000; tick()
  close(spine.x, 540 + 200 * eased)
  clock.resume()
  wall = 6500; tick()
  close(spine.x, 740); close(spine.y, 580)
  assert.equal(entry._positionTween, null)
  assert.equal(frames.size, 0)
  resize(320, 740)
  close(spine.x, 185); close(spine.y, 730)

  manager.animateSpinePosition('idol', 300, 700, 1, () => clock.elapsed() * 1000, 780)
  manager.cancelAllSpineTweens()
  assert.equal(entry._positionTween, null)
  resize(1280, 800)
  close(spine.x, 740); close(spine.y, 580)
  assert.equal(frames.size, 0, 'cancelled tween must not restart on resize')

  // Default Lab behavior remains pixel-based, including manually moved values.
  const lab = setup(false)
  lab.manager.setSpinePositionByGameCoord('idol', 100, 50, 780)
  lab.spine.x = 123; lab.spine.y = 456
  lab.resize(1280, 800)
  close(lab.spine.x, 123); close(lab.spine.y, 456)
  assert.equal(lab.entry._positionLayout, undefined)
  // No stale object can be repositioned after removal.
  delete manager.spineInstances.idol
  resize(390, 844)
  close(spine.x, 740)
} finally {
  Object.assign(globalThis, saved)
}
console.log('Stage resize verified: game-coordinate projection, fixed baseline, paused active tween, completion/cancel, no pose changes, removal and Lab pixel preservation')
