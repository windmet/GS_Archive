import assert from 'node:assert/strict'
import { BaseTexture, Container, Sprite, Texture } from 'pixi.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'
import { CameraController } from '../src/core/CameraController.js'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { applyStepSceneState } from '../src/core/applyStepSceneState.js'
import { cameraBlurAlpha, lerpBackgroundColor } from '../shared/story/BackgroundBlur.js'

let wall = 0, sequence = 0
const frames = new Map(), saved = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame]
globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const tick = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
try {
  const texture = new Texture(new BaseTexture(null, { width: 4, height: 4 })), textureBase = texture.baseTexture
  const blurred = new Texture(new BaseTexture(null, { width: 4, height: 4 })), blurredBase = blurred.baseTexture
  const container = new Container(), bg = new Sprite(texture)
  container.addChild(bg)
  let blurTextures = 0
  const manager = Object.assign(Object.create(BackgroundManager.prototype), {
    bgContainer: container, bgSprite: bg, _bgEffectEntries: {}, _bgTransitionToken: 0,
    _bgBlurAmount: 0, _bgOffsetBlur: 0, _bgBlurTarget: 0, _bgBlurAlpha: 0,
    _bgColor: 0xFFFFFF, _bgColorTarget: 0xFFFFFF,
    getWidth: () => 1280, getHeight: () => 720,
    // The GPU pass is not available in Node; any texture stands in for the rendered Gaussian image.
    _createBlurTexture: source => { assert.equal(source, texture); blurTextures++; return blurred },
  })
  const stage = Object.assign(Object.create(PixiStageManager.prototype), {
    backgroundManager: manager, setCameraFilter: () => {}, setIdolBackgroundColorFilter: () => {}, applyBgEffects: () => {},
  })
  const clock = new StoryClock({ nowMilliseconds: () => wall }); clock.start({ offset: 9 })
  const apply = (color, dof, timing = { duration: 2, delay: 1 }) => applyStepSceneState({ manager: stage,
    step: { step_id: 'properties' }, state: { bg_color: color, bg_dof: dof, bg_color_transition: timing,
      bg_dof_transition: timing }, nowMilliseconds: () => clock.now() * 1000,
  })
  const layer = () => bg._nativeBlurLayer

  // Delay and duration run on the scene clock; both lerps are linear (Mathf.Lerp / Color.Lerp).
  apply('#000000', 0.8)
  wall += 500; tick(); clock.pause(); wall += 10000; tick()
  assert.equal(manager._bgBlurAmount, 0); assert.equal(bg.tint, 0xFFFFFF); assert.equal(layer(), undefined)
  clock.setRate(2); clock.resume(); wall += 750; tick()
  assert.ok(Math.abs(manager._bgBlurAmount - 0.4) < 1e-9); assert.equal(bg.tint, 0x808080)
  assert.equal(blurTextures, 1); assert.ok(Math.abs(layer().alpha - 0.4) < 1e-9); assert.equal(layer().tint, 0x808080)
  clock.pause(); wall += 10000; tick()
  assert.ok(Math.abs(manager._bgBlurAmount - 0.4) < 1e-9); assert.equal(bg.tint, 0x808080)
  clock.resume(); wall += 500; tick()
  assert.equal(manager._bgBlurAmount, 0.8); assert.equal(bg.tint, 0); assert.equal(layer().tint, 0)
  assert.equal(frames.size, 0)

  // The next cumulative snapshot repeats the settled targets without timing: nothing is rewritten, so a
  // camera move's alpha (StoryCamera.BlurBackGround overwrites, it does not add) survives.
  manager.setCameraBlur(1.28)
  assert.equal(cameraBlurAlpha(1.28), 0.5); assert.equal(layer().alpha, 0.5)
  apply('#000000', 0.8, null)
  assert.equal(layer().alpha, 0.5); assert.equal(frames.size, 0)
  manager.setCameraBlur(0.9)
  assert.equal(layer().alpha, 0); assert.equal(layer().visible, false)

  // A new amount lerps from the previous target, not from the camera-written alpha; values above 1 clamp.
  apply('#FFFFFF', 0)
  wall += 1000; tick()
  assert.ok(Math.abs(manager._bgBlurAmount - 0.4) < 1e-9); assert.ok(Math.abs(layer().alpha - 0.4) < 1e-9)
  assert.equal(bg.tint, 0x808080)
  clock.pause(); wall += 10000; tick()
  assert.equal(bg.tint, 0x808080)
  clock.resume(); wall += 500; tick()
  assert.equal(manager._bgBlurAmount, 0); assert.equal(layer().visible, false); assert.equal(bg.tint, 0xFFFFFF)
  assert.equal(frames.size, 0)
  apply('#FFFFFF', 1.5, null)
  assert.equal(manager._bgBlurAmount, 1.5); assert.equal(layer().alpha, 1)
  assert.equal(blurTextures, 1, 'the blurred image is built once per background sprite')

  // A replacement cancels the running lerps.
  apply('#000000', 2)
  const oldFrames = [...frames.values()]
  stage.setBgBlur(0.3); stage.setBgColor('#123456')
  oldFrames.forEach(fn => fn())
  assert.equal(manager._bgBlurAmount, 0.3); assert.equal(bg.tint, 0x123456); assert.equal(layer().tint, 0x123456)
  assert.equal(frames.size, 0)

  // A later step repeats the running targets without timing; both native lerps keep going.
  apply('#FFFFFF', 0.9)
  wall += 1000; tick()
  const midColor = lerpBackgroundColor(0x123456, 0xFFFFFF, 0.5)
  assert.ok(Math.abs(manager._bgBlurAmount - 0.6) < 1e-9); assert.equal(bg.tint, midColor)
  apply('#FFFFFF', 0.9, null)
  assert.ok(Math.abs(manager._bgBlurAmount - 0.6) < 1e-9); assert.equal(bg.tint, midColor); assert.equal(frames.size, 2)
  wall += 500; tick()
  assert.equal(manager._bgBlurAmount, 0.9); assert.equal(bg.tint, 0xFFFFFF); assert.equal(frames.size, 0)

  // Only real camera moves write the blur; re-applying the same transform is not a move.
  const moves = []
  const camera = new CameraController({ bgContainer: new Container(), spineContainer: new Container(),
    getWidth: () => 1280, getHeight: () => 720, onCameraMove: zoom => moves.push(zoom) })
  camera.setCameraZoom({ zoom: 1.28, offset_x: 0, offset_y: 0, duration: 0, delay: 0 })
  camera.setCameraZoom({ zoom: 1.28, offset_x: 0, offset_y: 0, duration: 0, delay: 0 })
  camera.handleResize()
  assert.deepEqual(moves, [1.28])
  camera.setCameraZoom({ zoom: 1.56, offset_x: 0, offset_y: 0, duration: 1, delay: 0, nowMilliseconds: () => wall })
  wall += 500; tick(); wall += 500; tick()
  assert.deepEqual(moves.map(zoom => Math.round(zoom * 100) / 100), [1.28, 1.42, 1.56])
  camera.resetCameraZoom(); camera.resetCameraZoom()
  assert.deepEqual(moves.slice(3), [1])
  camera.destroy()

  // Disposal cancels both lerps and releases the generated blur image with its sprite.
  apply('#000000', 2)
  assert.equal(frames.size, 2)
  manager.destroy()
  assert.equal(frames.size, 0)
  assert.equal(manager._bgBlurTween, null); assert.equal(manager._bgColorTween, null)
  assert.equal(bg.destroyed, true); assert.equal(blurred.destroyed, true); assert.equal(blurredBase.destroyed, true)
  assert.equal(textureBase.destroyed, false, 'the background keeps its pre-existing texture-only disposal')
  container.destroy(); textureBase.destroy()
  console.log('Background properties: scene-clock delay, pause/rate, linear blur/colour, camera overwrite, replacement and disposal passed')
} finally {
  [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = saved
}
