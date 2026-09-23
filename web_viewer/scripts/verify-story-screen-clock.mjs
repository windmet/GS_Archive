import assert from 'node:assert/strict'
import { BaseTexture, Sprite, Texture } from 'pixi.js'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { createScreenCueHandle } from '../src/core/story-runtime/ScreenCueRuntime.js'

let wallTime = 0, frameId = 0
const frames = new Map()
const savedRequest = globalThis.requestAnimationFrame
const savedCancel = globalThis.cancelAnimationFrame
globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const tick = () => {
  const callbacks = [...frames.values()]
  frames.clear()
  for (const callback of callbacks) callback()
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)
try {
  for (const action of ['screen.fade', 'screen.directional_wipe']) {
    for (const type of ['in', 'out']) {
      for (const direction of action === 'screen.fade' ? ['6'] : ['2', '4', '6', '8']) {
        // Exercise production methods without constructing a GPU renderer.
        const stage = Object.assign(Object.create(PixiStageManager.prototype), {
          width: 1280, height: 720, _screenFadeToken: 0, _screenSlideToken: 0,
          _fadeOverlay: new Sprite(new Texture(new BaseTexture(null, { width: 4, height: 4 }))),
          _slideOverlay: new Sprite(new Texture(new BaseTexture(null, { width: 4, height: 4 }))),
        })
        const clock = new StoryClock({ nowMilliseconds: () => wallTime })
        clock.start()
        const cue = {
          cue_id: `${action}-${type}-${direction}`, action, channel: 'screen', duration: 2,
          payload: { type, color: '#FFFFFF', alpha: 0.8, direction }, lifecycle: { skippable: true },
        }
        const make = () => createScreenCueHandle(cue, () => stage, { nowMilliseconds: () => clock.now() * 1000 })
        const overlay = action === 'screen.fade' ? stage._fadeOverlay : stage._slideOverlay
        const check = progress => {
          if (action === 'screen.fade') close(overlay.alpha, 0.8 * (type === 'in' ? 1 - progress : progress))
          else {
            const offset = { '2': [0, 720], '4': [-1280, 0], '6': [1280, 0], '8': [0, -720] }[direction]
            const factor = type === 'in' ? progress - 1 : progress
            close(overlay.x, offset[0] * factor)
            close(overlay.y, offset[1] * factor)
          }
        }
        const handle = make()
        await handle.start()
        wallTime += 1000
        tick()
        check(0.875)
        clock.pause()
        await handle.pause()
        wallTime += 10000
        tick()
        check(0.875)
        clock.setRate(2)
        clock.resume()
        await handle.resume()
        wallTime += 250
        tick()
        check(0.984375)
        clock.setRate(0.5)
        wallTime += 1000
        tick()
        check(1)
        assert.equal(overlay.visible, action === 'screen.fade' ? type === 'out' : type === 'in')
        assert.equal(frames.size, 0)

        const settled = make()
        await settled.start()
        clock.pause()
        await settled.pause()
        await settled.settle()
        tick()
        check(1)
        assert.equal(frames.size, 0)
        const cancelled = make()
        await cancelled.start()
        await cancelled.cancel()
        tick()
        assert.equal(overlay.visible, false)
        assert.equal(frames.size, 0, 'stale transition must stop after cancellation')
        stage._fadeOverlay.destroy({ texture: true, baseTexture: true })
        stage._slideOverlay.destroy({ texture: true, baseTexture: true })
      }
    }
  }
} finally {
  if (savedRequest === undefined) delete globalThis.requestAnimationFrame
  else globalThis.requestAnimationFrame = savedRequest
  if (savedCancel === undefined) delete globalThis.cancelAnimationFrame
  else globalThis.cancelAnimationFrame = savedCancel
}
console.log('Screen clock: both fades, four wipe directions, pause/resume, rates, terminal visibility, paused settle and cancellation passed')
