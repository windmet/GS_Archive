import assert from 'node:assert/strict'
import { ScreenEffectManager } from '../src/core/ScreenEffectManager.js'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { BaseTexture, Container, Texture } from 'pixi.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { applyStepSceneState } from '../src/core/applyStepSceneState.js'

const saved = [globalThis.setTimeout, globalThis.clearTimeout, globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame, globalThis.performance]
const timers = new Map()
const frames = new Map()
let wall = 0
let sequence = 0
globalThis.setTimeout = (fn, delay) => { timers.set(++sequence, { fn, delay }); return sequence }
globalThis.clearTimeout = id => timers.delete(id)
globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
globalThis.cancelAnimationFrame = id => frames.delete(id)
globalThis.performance = { now: () => wall }
const frame = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
function create() {
  const calls = []
  const stage = Object.assign(Object.create(ScreenEffectManager.prototype), {
    _screenEffectToken: 0, _screenEffectTimers: new Set(),
    _screenEffectCleanups: new Set(),
    _effectOverlay: { alpha: 0, visible: false },
    _playSingleScreenEffect: effect => calls.push(effect),
    _playFadeScreenEffect: effect => calls.push(effect),
    _spineColorTweens: {}, clearAllSilhouettes: () => {},
  })
  return { stage, calls }
}
try {
  {
    const owner = Object.assign(Object.create(PixiStageManager.prototype), {
      _spineColorTweens: {}, clearAllSilhouettes: () => {},
    })
    const effects = new ScreenEffectManager({ app: {}, overlay: { visible: false, alpha: 0 },
      spineContainer: {}, getWidth: () => 1280, getHeight: () => 720, loadTextureFromUrl: () => {} })
    owner.screenEffects = effects
    assert.equal(effects.width, 1280); assert.equal(effects.height, 720)
    owner.playScreenEffects([{ type: 'single', delay: 10 }])
    assert.equal(timers.size, 1)
    owner.clearScreenEffects(); assert.equal(timers.size, 0)
    owner.playScreenEffects([{ type: 'single', delay: 10 }])
    owner.destroy()
    assert.equal(timers.size, 0); assert.equal(owner.screenEffects, null)
    owner.destroy()
  }
  const { stage, calls } = create()
  stage.playScreenEffects([{ type: 'single', id: 'old', delay: 10 }, { type: 'fadein', delay: 20 }])
  assert.equal(timers.size, 2)
  assert.deepEqual([...timers.values()].map(timer => timer.delay), [10000, 20000])
  const staleCallback = [...timers.values()][0].fn
  stage.playScreenEffects([{ type: 'single', id: 'new', delay: 1 }])
  assert.equal(timers.size, 1)
  staleCallback()
  assert.equal(calls.length, 0, 'an already-queued old callback cannot dispatch after replacement')
  const [id, timer] = [...timers][0]
  timers.delete(id); timer.fn()
  assert.equal(calls[0].id, 'new')
  assert.equal(stage._screenEffectTimers.size, 0)
  stage.playScreenEffects([{ type: 'fadeout', delay: 5 }])
  stage._effectOverlay = null
  stage.clearScreenEffects()
  assert.equal(timers.size, 0, 'missing overlay cannot prevent timer cleanup')

  const disposed = create().stage
  disposed.playScreenEffects([{ type: 'single', delay: 100 }])
  let resolveTexture
  disposed._loadEffectTexture = () => new Promise(resolve => { resolveTexture = resolve })
  let stageWrites = 0
  // Keep the renderer surface observable even after destruction to prove token
  // invalidation, rather than relying only on app = null to suppress late work.
  const oldApp = { stage: { addChild: () => { stageWrites++ } }, destroy: () => {} }
  disposed.app = oldApp
  const loading = disposed._playPunchTexture({})
  disposed.destroy()
  assert.equal(timers.size, 0)
  disposed.app = oldApp
  let textureRead = false
  resolveTexture({ get width() { textureRead = true; return 30 } })
  await loading
  assert.equal(textureRead, false, 'disposed texture must not be consumed')
  assert.equal(stageWrites, 0)
  disposed.app = null
  disposed.destroy()
  assert.equal(timers.size, 0)
  for (const kind of ['punch', 'sakura', 'momiji', 'stars']) {
    const active = create().stage
    const ticks = new Set()
    const root = new Container()
    const base = new BaseTexture(null, { width: 30, height: 20 })
    const texture = new Texture(base)
    active.getWidth = () => 1280; active.getHeight = () => 720
    active.app = { stage: root, ticker: { add: fn => ticks.add(fn), remove: fn => ticks.delete(fn) }, destroy: () => {} }
    active._loadEffectTexture = async () => texture
    if (kind === 'punch') await active._playPunchTexture({ duration: 2 })
    else await active._playFallingScreenTexture(kind === 'momiji' ? 'fx_adv_momiji' : 'fx_adv_sakura', {}, { useStar: kind === 'stars' })
    assert.equal(ticks.size, 1)
    assert.equal(active._screenEffectCleanups.size, 1)
    const display = root.children[0]
    assert.ok(display)
    const queuedTick = [...ticks][0]
    if (kind === 'punch' || kind === 'stars') active.destroy()
    else active.clearScreenEffects()
    assert.equal(ticks.size, 0, `${kind} must release its ticker without waiting for a frame`)
    assert.equal(display.destroyed, true)
    assert.equal(root.children.length, 0)
    assert.equal(active._screenEffectCleanups.size, 0)
    queuedTick(); active.clearScreenEffects()
    assert.equal(base.destroyed, false, 'shared cached texture must survive effect cleanup')
    root.destroy(); texture.destroy(true)
  }
  for (const kind of ['punch', 'fade']) {
    for (const end of ['clear', 'destroy', 'natural']) {
      const active = create().stage
      active.spineContainer = { x: 123, y: 456 }
      active._playPunchTexture = () => {}
      active.getWidth = () => 1280; active.getHeight = () => 720
      if (kind === 'punch') active._playPunchEffect({ duration: 2 })
      else ScreenEffectManager.prototype._playFadeScreenEffect.call(active, { duration: 2, type: 'fadeout' })
      wall += 200; frame()
      assert.equal(frames.size, 1)
      assert.equal(active._screenEffectCleanups.size, 1)
      if (kind === 'punch') assert.notEqual(active.spineContainer.x, 123)
      const queued = [...frames.values()][0]
      if (end === 'natural') { wall += 2000; frame() }
      else if (end === 'clear') active.clearScreenEffects()
      else active.destroy()
      assert.equal(frames.size, 0)
      assert.equal(active._screenEffectCleanups.size, 0)
      assert.equal(active.spineContainer.x, 123)
      assert.equal(active.spineContainer.y, 456)
      assert.equal(active._effectOverlay.visible, false)
      if (end !== 'natural') {
        active.spineContainer.x = 900
        active._effectOverlay.alpha = 0.7
        queued()
        assert.equal(active.spineContainer.x, 900, 'queued cancelled shake cannot overwrite the next camera position')
        assert.equal(active._effectOverlay.alpha, 0.7)
        assert.equal(frames.size, 0)
      }
    }
  }
  for (const id of ['fx_adv_punch', 'fx_adv_sakura', 'fx_adv_momiji', 'fx_adv_kamifubuki']) {
    const active = create().stage
    delete active._playSingleScreenEffect; delete active._playFadeScreenEffect
    const ticks = new Set(), root = new Container()
    const texture = new Texture(new BaseTexture(null, { width: 30, height: 20 }))
    active.getWidth = () => 1280; active.getHeight = () => 720; active.spineContainer = { x: 0, y: 0 }
    active.app = { stage: root, ticker: { add: fn => ticks.add(fn), remove: fn => ticks.delete(fn) } }
    active._loadEffectTexture = async () => texture
    active.setCameraFilter = active.setBgBlur = active.setBgColorOverlay = () => {}
    active.applyBgEffects = () => {}
    const clock = new StoryClock({ nowMilliseconds: () => wall }); clock.start({ offset: 18 })
    applyStepSceneState({ manager: active, step: { step_id: id },
      state: { screen_effects: [{ type: 'single', id, delay: 1, duration: 2 }] },
      nowMilliseconds: () => clock.now() * 1000,
    })
    assert.equal(timers.size, 0, 'story effects must not schedule wall-time timers')
    wall += 500; frame(); clock.pause(); wall += 20000; frame()
    assert.equal(root.children.length, 0, 'paused authored delay cannot dispatch')
    clock.setRate(2); clock.resume(); wall += 250; frame()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    assert.equal(root.children.length, 1, `${id} must dispatch through production scene state`)
    const tick = () => { frame(); [...ticks].forEach(fn => fn()) }
    wall += 250; tick()
    const snapshot = () => JSON.stringify({
      spine: active.spineContainer, overlay: active._effectOverlay,
      particles: root.children.flatMap(child => child.children?.length ? child.children : [child])
        .map(sprite => [sprite.x, sprite.y, sprite.rotation, sprite.alpha, sprite.scale.x]),
    })
    const moving = snapshot()
    // Repeated frames at the same logical time must not accumulate rotation.
    tick(); tick(); assert.equal(snapshot(), moving)
    clock.pause(); wall += 20000; tick(); assert.equal(snapshot(), moving, `${id} must freeze all effects`)
    clock.resume(); wall += 750; tick()
    assert.equal(root.children.length, 0)
    assert.equal(ticks.size, 0); assert.equal(frames.size, 0)
    assert.equal(active._screenEffectCleanups.size, 0)
    active.clearScreenEffects(); root.destroy(); texture.destroy(true)
  }
  console.log('Screen effects: lifetime, authored delay, pause/rate and frame-independent particles passed')
} finally {
  [globalThis.setTimeout, globalThis.clearTimeout, globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame, globalThis.performance] = saved
}
