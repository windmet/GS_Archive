import assert from 'node:assert/strict'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { SpineManager } from '../src/core/SpineManager.js'
import { storyStageFrame } from '../src/core/StoryStageFraming.js'
import { advStageUnit } from '../shared/story/AdvStageLayout.js'
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
const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y } })
// Native skeleton root on a width x height stage: slot (posX, -50 + posY) + prefabY * zoom, 1/3 unit per px.
const expected = (width, height, { posX = 0, posY = 0, zoom = 1 }, prefabY) => {
  const unit = advStageUnit(width, height)
  return { x: width / 2 + posX * unit, y: height / 2 - (-50 + posY + prefabY * zoom) * unit, scale: unit * zoom / 3 }
}
function setup() {
  const spine = { alpha: 0.7, visible: true, position: point(), scale: point() }
  Object.defineProperties(spine, { x: { get() { return this.position.x } }, y: { get() { return this.position.y } } })
  const entry = { spine, modelId: 'fixture', figure: { prefabY: -600 } }
  const manager = Object.assign(Object.create(PixiStageManager.prototype), {
    width: 390, height: 844, spineInstances: { idol: entry },
    app: { renderer: { resize() {} } }, _silhouetteSprites: {}, _silhouettePending: {},
  })
  manager.spineManager = new SpineManager(manager)
  manager._observeResize()
  const resize = (width, height) => manager._resizeObserver.callback([{ contentRect: { width, height } }])
  return { manager, spine, entry, resize }
}
const check = (spine, width, height, placement, prefabY = -600) => {
  const want = expected(width, height, placement, prefabY)
  close(spine.x, want.x); close(spine.y, want.y); close(spine.scale.x, want.scale)
}
try {
  const { manager, spine, entry, resize } = setup()
  const clock = new StoryClock({ nowMilliseconds: () => wall })
  clock.start()
  const now = () => clock.elapsed() * 1000
  manager.placeActor('idol', { posX: 100, posY: 50 })
  check(spine, 390, 844, { posX: 100, posY: 50 })
  // 1280x720 is 16:9: 720 px for the 626.087-unit view height.
  resize(1280, 720)
  check(spine, 1280, 720, { posX: 100, posY: 50 })
  close(advStageUnit(1280, 720), 720 / 626.0869440000001)
  resize(320, 740)
  check(spine, 320, 740, { posX: 100, posY: 50 })
  assert.equal(spine.alpha, 0.7)
  assert.equal(spine.visible, true)
  assert.equal(frames.size, 0, 'static resize must not start animation frames')

  // IdolCharacter tweens are linear; position and zoom run independently.
  manager.placeActor('idol', { posX: -100 }, { nowMilliseconds: now })
  manager.placeActor('idol', { posX: 200, zoom: 1.5 }, { position: { duration: 2 }, zoom: { duration: 1, delay: 1 }, nowMilliseconds: now })
  wall = 500; tick()
  check(spine, 320, 740, { posX: -100 + 300 * 0.25, zoom: 1 })
  clock.pause()
  resize(1280, 720)
  check(spine, 1280, 720, { posX: -25, zoom: 1 })
  assert.equal(frames.size, 2, 'resize keeps both scheduled tweens')
  wall = 5000; tick()
  check(spine, 1280, 720, { posX: -25, zoom: 1 })
  clock.resume()
  wall = 6000; tick()
  check(spine, 1280, 720, { posX: 125, zoom: 1.25 })
  wall = 7000; tick()
  check(spine, 1280, 720, { posX: 200, zoom: 1.5 })
  assert.deepEqual(entry._advTweens, {})
  assert.equal(frames.size, 0)

  // Size 1 without a zoom transition applies at once; the cancelled slide stays where it was.
  manager.placeActor('idol', { posX: 0 }, { position: { duration: 1 }, nowMilliseconds: now })
  manager.cancelAllSpineTweens()
  resize(390, 844)
  check(spine, 390, 844, { posX: 200, zoom: 1 })
  assert.equal(frames.size, 0, 'cancelled tween must not restart on resize')

  // No stale object can be repositioned after removal.
  delete manager.spineInstances.idol
  resize(1280, 720)
  check(spine, 390, 844, { posX: 200, zoom: 1 })
} finally {
  Object.assign(globalThis, saved)
}
console.log('Stage resize verified: native ADV projection, linear position/zoom tweens across pause and resize, cancellation and removal')

// A fixed design height keeps the render resolution independent of CSS pixels; geometry scales with the stage.
for (const [width, height] of [[1280, 720], [1920, 1080], [1024, 768], [390, 632], [390, 844], [844, 390]]) {
  const frame = storyStageFrame(width, height)
  close(frame.width * frame.scale, width)
  close(frame.height * frame.scale, height)
  close(advStageUnit(frame.width, frame.height) * frame.scale, advStageUnit(width, height))
}
assert.equal(storyStageFrame(0, 720), null)
assert.equal(storyStageFrame(390, 0), null)
console.log('Portrait framing: screen coverage and placement invariance under the 720 px render frame passed')
