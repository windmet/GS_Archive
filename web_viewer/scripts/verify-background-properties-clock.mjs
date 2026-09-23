import assert from 'node:assert/strict'
import { BaseTexture, Container, Sprite, Texture } from 'pixi.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { applyStepSceneState } from '../src/core/applyStepSceneState.js'

let wall = 0, sequence = 0
const frames = new Map(), saved = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame]
globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const tick = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
try {
  const texture = new Texture(new BaseTexture(null, { width: 4, height: 4 }))
  const container = new Container(), overlay = new Sprite(texture), bg = new Sprite(texture)
  const manager = Object.assign(Object.create(BackgroundManager.prototype), {
    bgContainer: container, bgSprite: bg, _blurFilter: { blur: 0 },
    _bgBlurAmount: 0, _bgOverlayColor: 0xFFFFFF, _bgOverlaySprite: overlay,
    _bgEffectEntries: {}, _bgTransitionToken: 0,
    getWidth: () => 1280, getHeight: () => 720,
  })
  const stage = Object.assign(Object.create(PixiStageManager.prototype), {
    backgroundManager: manager, setCameraFilter: () => {}, applyBgEffects: () => {},
  })
  const clock = new StoryClock({ nowMilliseconds: () => wall }); clock.start({ offset: 9 })
  const apply = (color, dof) => applyStepSceneState({ manager: stage, step: { step_id: 'properties' },
    state: { bg_color: color, bg_dof: dof, bg_color_transition: { duration: 2, delay: 1 },
      bg_dof_transition: { duration: 2, delay: 1 } }, nowMilliseconds: () => clock.now() * 1000,
  })
  apply('#000000', 2)
  wall += 500; tick(); clock.pause(); wall += 10000; tick()
  assert.equal(manager._bgBlurAmount, 0); assert.equal(overlay.tint, 0xFFFFFF)
  clock.setRate(2); clock.resume(); wall += 750; tick()
  assert.equal(manager._bgBlurAmount, 10.5); assert.equal(overlay.tint, 0x202020)
  clock.pause(); wall += 10000; tick()
  assert.equal(manager._bgBlurAmount, 10.5); assert.equal(overlay.tint, 0x202020)
  clock.resume(); wall += 500; tick()
  assert.equal(manager._bgBlurAmount, 12); assert.equal(overlay.tint, 0)
  assert.equal(frames.size, 0)
  apply('#FFFFFF', 0)
  wall += 1000; tick()
  assert.equal(manager._bgBlurAmount, 1.5)
  assert.ok(Math.abs(overlay.alpha - 0.85 * 0.125) < 1e-9)
  clock.pause(); wall += 10000; tick()
  assert.ok(Math.abs(overlay.alpha - 0.85 * 0.125) < 1e-9)
  assert.equal(overlay.parent, container)
  clock.resume(); wall += 500; tick()
  assert.equal(manager._bgBlurAmount, 0); assert.equal(bg.filters, null)
  assert.equal(overlay.parent, null); assert.equal(frames.size, 0)
  apply('#000000', 2)
  const oldFrames = [...frames.values()]
  stage.setBgBlur(3); stage.setBgColorOverlay('#123456')
  oldFrames.forEach(fn => fn())
  assert.equal(manager._bgBlurAmount, 3); assert.equal(overlay.tint, 0x123456)
  assert.equal(frames.size, 0)
  let filterDisposals = 0
  manager._blurFilter.destroy = () => { filterDisposals++ }
  // Isolate the manager-owned overlay from the independent background sprite
  // in this fixture; the overlay's shared texture must survive disposal.
  manager.bgSprite = null
  apply('#000000', 2)
  assert.equal(frames.size, 2)
  manager.destroy()
  assert.equal(frames.size, 0)
  assert.equal(overlay.destroyed, true)
  assert.equal(texture.destroyed, false)
  assert.equal(filterDisposals, 1)
  assert.equal(manager._bgOverlaySprite, null)
  assert.equal(manager._blurFilter, null)
  assert.equal(manager._bgBlurTween, null); assert.equal(manager._bgColorTween, null)
  manager.destroy(); assert.equal(filterDisposals, 1)
  bg.destroy(); container.destroy(); texture.destroy(true)
  console.log('Background properties: scene-to-renderer delay, pause/rate, color reset and replacement passed')
} finally {
  [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = saved
}
