import assert from 'node:assert/strict'
import { Container } from 'pixi.js'
import { CameraController } from '../src/core/CameraController.js'
import { advStageUnit } from '../shared/story/AdvStageLayout.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { createCameraCueHandle } from '../src/core/story-runtime/CameraCueRuntime.js'

let wallTime = 0
let frameId = 0
const frames = new Map()
const originalRequest = globalThis.requestAnimationFrame
const originalCancel = globalThis.cancelAnimationFrame
globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const tick = () => {
  const pending = [...frames.values()]
  frames.clear()
  for (const fn of pending) fn()
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)
try {
  const clock = new StoryClock({ nowMilliseconds: () => wallTime })
  const spine = new Container()
  const bg = new Container()
  const controller = new CameraController({
    bgContainer: bg, spineContainer: spine,
    getWidth: () => 1280, getHeight: () => 720,
  })
  const stage = { cameraController: controller, setCameraZoom: value => controller.setCameraZoom(value) }
  const cue = {
    cue_id: 'camera-clock', action: 'camera.transform', channel: 'camera', duration: 2,
    payload: { zoom: 2, offset_x: 0, offset_y: 0 }, lifecycle: { skippable: true },
  }
  const create = () => createCameraCueHandle(cue, () => stage, { nowMilliseconds: () => clock.now() * 1000 })
  clock.start()
  const handle = create()
  await handle.start()
  wallTime += 1000
  tick()
  // StoryCamera.MoveCamera interpolates linearly.
  close(spine.scale.x, 1.5)
  close(spine.x, -320)
  clock.pause()
  await handle.pause()
  wallTime += 10000
  tick()
  close(spine.scale.x, 1.5)
  clock.setRate(2)
  clock.resume()
  await handle.resume()
  wallTime += 250
  tick()
  close(spine.scale.x, 1.75)
  clock.setRate(0.5)
  wallTime += 1000
  tick()
  close(spine.scale.x, 2)
  assert.equal(frames.size, 0)

  controller.resetCameraZoom()
  const cancelled = create()
  await cancelled.start()
  wallTime += 500
  tick()
  const intermediate = spine.scale.x
  await cancelled.cancel()
  wallTime += 10000
  tick()
  close(spine.scale.x, intermediate)
  assert.equal(frames.size, 0)

  const settled = create()
  await settled.start()
  clock.pause()
  await settled.pause()
  await settled.settle()
  close(spine.scale.x, 2)
  assert.equal(frames.size, 0)

  controller.resetCameraZoom()
  controller.setCameraZoom({ ...cue.payload, duration: 0, delay: 1, nowMilliseconds: () => clock.now() * 1000 })
  wallTime += 10000
  tick()
  close(spine.scale.x, 1)
  clock.resume()
  wallTime += 2000
  tick()
  close(spine.scale.x, 2)
  assert.equal(frames.size, 0)
  controller.destroy()
  spine.destroy()
  bg.destroy()
  // A canvas point at the camera target stays at screen centre; the background zooms in with the camera
  // but keeps its size when the camera widens (AdventureBackgroundPanel.UpdateBackGroundScale).
  for (const [width, height] of [[1280, 720], [1968, 1060], [390, 844]]) {
    const actors = new Container(), background = new Container()
    const camera = new CameraController({ bgContainer: background, spineContainer: actors,
      getWidth: () => width, getHeight: () => height })
    const unit = advStageUnit(width, height)
    for (const offset_y of [-90, 0, 90]) for (const zoom of [0.9, 1, 1.3, 2]) {
      const offset_x = 60
      camera.setCameraZoom({ zoom, offset_x, offset_y, duration: 0 })
      close(actors.scale.x, zoom)
      close(background.scale.x, Math.max(1, zoom))
      close((width / 2 + offset_x * unit) * zoom + actors.x, width / 2)
      close((height / 2 - offset_y * unit) * zoom + actors.y, height / 2)
      // The background panel centre (canvas origin) moves with the camera like any canvas point.
      close(width / 2 * background.scale.x + background.x, width / 2 - offset_x * unit * zoom)
      close(height / 2 * background.scale.x + background.y, height / 2 + offset_y * unit * zoom)
    }
    camera.destroy(); actors.destroy(); background.destroy()
  }
} finally {
  if (originalRequest === undefined) delete globalThis.requestAnimationFrame
  else globalThis.requestAnimationFrame = originalRequest
  if (originalCancel === undefined) delete globalThis.cancelAnimationFrame
  else globalThis.cancelAnimationFrame = originalCancel
}
console.log('Camera clock: linear tween, pause/resume, dynamic rates, cancel, paused settle and delayed instant transform passed')
