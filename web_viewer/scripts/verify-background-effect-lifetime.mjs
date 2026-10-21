import assert from 'node:assert/strict'
import { BaseTexture, Container, Texture } from 'pixi.js'
import { BackgroundEffectManager } from '../src/core/BackgroundEffectManager.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { advParticleEffectAlpha, advParticlePrefab, advParticleSystems, sampleAdvParticles } from '../src/core/advParticleEffects.js'

const frames = new Map(), ticks = new Set()
let sequence = 0, wall = 0
const saved = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame, globalThis.performance]
const whiteDescriptor = Object.getOwnPropertyDescriptor(Texture, 'WHITE')
const white = new Texture(new BaseTexture(null, { width: 16, height: 16 }))
Object.defineProperty(Texture, 'WHITE', { configurable: true, get: () => white })
globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
globalThis.cancelAnimationFrame = id => frames.delete(id)
globalThis.performance = { now: () => wall }
const frame = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
function setup() {
  const manager = new BackgroundEffectManager({
    app: { ticker: { add: fn => ticks.add(fn), remove: fn => ticks.delete(fn) } },
    bgEffectContainer: new Container(),
    getWidth: () => 100, getHeight: () => 100,
  })
  const entry = { id: 'fx_adv_rain', prefab: 'fx_adv_rain', container: new Container(), frontContainer: new Container(),
    token: 0, loadToken: 0, activatedAt: 0, nowMilliseconds: () => wall, graphics: [], sprites: [] }
  manager._bgEffectEntries[entry.id] = entry
  manager.bgEffectContainer.addChild(entry.container, entry.frontContainer)
  return { manager, entry }
}
try {
  {
    const images = new Container(), particles = new Container(), near = new Container()
    const owner = new BackgroundManager({ app: { ticker: { add: fn => ticks.add(fn), remove: fn => ticks.delete(fn) } },
      bgContainer: images, bgEffectContainer: particles, nearEffectContainer: near, getWidth: () => 100, getHeight: () => 100,
      loadTextureFromUrl: async () => white })
    assert.ok(owner.effects instanceof BackgroundEffectManager)
    owner.applyBgEffects([{ id: 'fx_adv_rain', duration: 1 }])
    for (let i = 0; i < 8; i++) await Promise.resolve()
    owner.handleResize()
    // Rain_far (sorting 5) stays behind the idols, Rain_near (15) goes to the near layer.
    assert.equal(particles.children.length, 1); assert.equal(near.children.length, 1)
    assert.equal(particles.children[0].children.length, 100); assert.equal(near.children[0].children.length, 100)
    assert.equal(ticks.size, 1)
    assert.equal(owner._bgEffectTargetAlpha('fx_adv_rain'), 1)
    owner.destroy()
    assert.equal(owner.effects, null)
    assert.equal(particles.children.length, 0); assert.equal(near.children.length, 0)
    assert.equal(frames.size, 0); assert.equal(ticks.size, 0)
    owner.destroy(); images.destroy(); particles.destroy(); near.destroy()
  }
  {
    const clock = new StoryClock({ nowMilliseconds: () => wall })
    clock.start({ offset: 99 }); assert.equal(clock.elapsed(), 0)
    wall += 1000; clock.setRate(2); wall += 500
    assert.equal(clock.elapsed(), 2)
    clock.seek(200); assert.equal(clock.now(), 200); assert.equal(clock.elapsed(), 2)
    clock.pause(); wall += 10000; assert.equal(clock.elapsed(), 2)
    clock.start({ offset: 0, rate: 0.5 }); wall += 2000
    assert.equal(clock.now(), 1); assert.equal(clock.elapsed(), 3)
    clock.stop(); clock.stop(); wall += 1000; assert.equal(clock.elapsed(), 3)
  }
  for (const removal of ['remove', 'destroy']) {
    const { manager, entry } = setup()
    let rejectTexture
    manager._loadEffectTexture = () => new Promise((_, reject) => { rejectTexture = reject })
    const pending = manager._createNativeParticleEffect(entry)
    manager._animateBgEffectAlpha(entry, 0.85, 2, 1)
    const queued = [...frames.values()][0]
    if (removal === 'remove') manager._removeBgEffect(entry.id)
    else manager.destroy()
    assert.equal(frames.size, 0)
    rejectTexture(new Error('late offline'))
    await pending
    queued()
    assert.equal(ticks.size, 0, 'late failure cannot register a ticker')
    assert.equal(entry.sprites.length, 0)
    assert.equal(entry.container.destroyed, true); assert.equal(entry.frontContainer.destroyed, true)
    assert.equal(manager.bgEffectContainer.children.length, 0)
    manager.bgEffectContainer.destroy()
  }
  {
    const { manager, entry } = setup()
    manager._loadEffectTexture = async () => { throw new Error('current offline') }
    const warn = console.warn; const warnings = []; console.warn = (...args) => warnings.push(args)
    try { await manager._createNativeParticleEffect(entry) } finally { console.warn = warn }
    // No handwritten fallback: a missing native texture shows nothing and says so.
    assert.equal(warnings.length, 1); assert.equal(entry.sprites.length, 0); assert.equal(ticks.size, 0)
    manager._animateBgEffectAlpha(entry, 1, 2, 1)
    wall += 2000; frame()
    assert.equal(entry.container.alpha, 1, 'entry starts opaque in this direct fixture')
    entry.container.alpha = 0
    manager._animateBgEffectAlpha(entry, 1, 2, 1)
    const obsolete = [...frames.values()][0]
    manager._animateBgEffectAlpha(entry, 0.8, 2, 1)
    assert.equal(frames.size, 1, 'replacement cancels the prior alpha RAF')
    obsolete(); assert.equal(frames.size, 1)
    wall += 2000; frame(); assert.equal(entry.container.alpha, 0.4); assert.equal(entry.frontContainer.alpha, 0.4)
    wall += 1000; frame(); assert.equal(entry.container.alpha, 0.8); assert.equal(entry.frontContainer.alpha, 0.8)
    assert.equal(entry.alphaTween, null); assert.equal(frames.size, 0)
    manager.destroy(); assert.equal(ticks.size, 0)
    manager.bgEffectContainer.destroy()
  }
  for (const id of ['fx_adv_rain', 'fx_adv_rain_heavy', 'fx_adv_sakura', 'fx_adv_momiji']) {
    const { manager, entry: unused } = setup()
    manager._removeBgEffect(unused.id)
    manager._loadEffectTexture = async () => white
    const clock = new StoryClock({ nowMilliseconds: () => wall }); clock.start()
    const now = () => clock.elapsed() * 1000
    manager.applyBgEffects([{ id, duration: 2 }], null, now)
    for (let i = 0; i < 8; i++) await Promise.resolve()
    const entry = manager._bgEffectEntries[id]
    assert.ok(entry.sprites.length > 0, id)
    const tick = () => { frame(); [...ticks].forEach(fn => fn(1000)) }
    const snapshot = () => JSON.stringify({ alpha: entry.container.alpha,
      sprites: entry.sprites.map(sprite => [sprite.visible, sprite.alpha, sprite.x, sprite.y, sprite.rotation]) })
    wall += 1000; tick()
    const beforeReset = snapshot()
    clock.start({ offset: 0 }); tick()
    assert.equal(snapshot(), beforeReset, `${id} cannot jump at a step reset`)
    clock.pause(); wall += 10000; tick(); assert.equal(snapshot(), beforeReset)
    clock.setRate(2); clock.resume(); wall += 500; tick()
    assert.notEqual(snapshot(), beforeReset)
    assert.equal(entry.container.alpha, manager._bgEffectTargetAlpha(id))
    const beforeRepeat = snapshot(); tick(); tick(); assert.equal(snapshot(), beforeRepeat)
    manager.applyBgEffects([{ id, action: 'end', duration: 2, delay: 1 }], null, now)
    clock.start({ offset: 0, rate: 2 })
    manager.applyBgEffects([], null, now)
    assert.equal(manager._bgEffectEntries[id], entry, 'ending effect persists across step omission until its logical fade finishes')
    clock.pause(); wall += 10000; tick()
    assert.equal(manager._bgEffectEntries[id], entry)
    clock.resume(); wall += 1500; tick()
    assert.equal(manager._bgEffectEntries[id], undefined)
    assert.equal(frames.size, 0); assert.equal(ticks.size, 0)
    manager.destroy(); manager.bgEffectContainer.destroy()
  }
  {
    // Client effect_bgstart [2] is the particle alpha and the start has no fade-in: the layer is opaque at
    // once and the particles carry the alpha (advParticleQuad).
    for (const [effect, expected] of [
      [{ id: 'fx_adv_rain', action: 'start', delay: 0, duration: 0, alpha: 0.5 }, 0.5],
      [{ id: 'fx_adv_rain', action: 'start', delay: 0, duration: 0.6 }, 0.6],
      [{ id: 'fx_adv_rain', action: 'start', delay: 0, duration: 0 }, 1],
    ]) {
      const { manager, entry: unused } = setup()
      manager._removeBgEffect(unused.id)
      manager._loadEffectTexture = async () => white
      manager.applyBgEffects([effect], null, () => wall)
      frame()
      const entry = manager._bgEffectEntries.fx_adv_rain
      assert.equal(entry.container.alpha, 1, `start layer alpha ${JSON.stringify(effect)}`)
      assert.equal(advParticleEffectAlpha(entry.id, entry.effectAlpha, null), expected, `start particle alpha ${JSON.stringify(effect)}`)
      manager.destroy(); manager.bgEffectContainer.destroy()
    }
    // effect_bgstart delay postpones CreateBgEffectCoroutine; no prewarm.
    {
      const { manager, entry: unused } = setup()
      manager._removeBgEffect(unused.id)
      manager.applyBgEffects([{ id: 'fx_adv_rain', action: 'start', delay: 1.5 }], null, () => wall)
      assert.equal(manager._bgEffectEntries.fx_adv_rain.activatedAt, wall + 1500)
      manager.destroy(); manager.bgEffectContainer.destroy()
    }
    assert.equal(advParticlePrefab('cameraflare', { lightPosition: 0 }), null)
    assert.equal(advParticlePrefab('cameraflare', { lightPosition: 1 }), 'fx_adv_cameraflare_left')
    assert.equal(advParticlePrefab('cameraflare', { lightPosition: 2 }), 'fx_adv_cameraflare_right')
    // The flare switches prefab when the background's light moves.
    {
      const { manager, entry: unused } = setup()
      manager._removeBgEffect(unused.id)
      manager._loadEffectTexture = async () => white
      manager.applyBgEffects([{ id: 'cameraflare' }], { lightPosition: 1 }, () => wall)
      const left = manager._bgEffectEntries.cameraflare
      manager.applyBgEffects([{ id: 'cameraflare' }], { lightPosition: 1, lightAlpha: 0.2 }, () => wall)
      assert.equal(manager._bgEffectEntries.cameraflare, left)
      manager.applyBgEffects([{ id: 'cameraflare' }], { lightPosition: 2 }, () => wall)
      assert.notEqual(manager._bgEffectEntries.cameraflare, left); assert.equal(left.container.destroyed, true)
      assert.equal(manager._bgEffectEntries.cameraflare.prefab, 'fx_adv_cameraflare_right')
      manager.destroy(); manager.bgEffectContainer.destroy()
    }
  }
  {
    // Pixi glue: every visible sprite is exactly its sampled quad (sheet frame, matrix, alpha, tint).
    const manager = new BackgroundEffectManager({
      app: { ticker: { add: fn => ticks.add(fn), remove: fn => ticks.delete(fn) } },
      bgEffectContainer: new Container(), nearEffectContainer: new Container(), getWidth: () => 1280, getHeight: () => 720,
    })
    const sheet = Texture.fromBuffer(new Uint8Array(64 * 64 * 4), 64, 64)
    manager._loadEffectTexture = async () => sheet
    const profile = { lightPosition: 2, lightAlpha: 0.3 }
    wall = 50000
    manager.applyBgEffects([{ id: 'cameraflare', action: 'start', delay: 0 }], profile, () => wall)
    for (let i = 0; i < 8; i++) await Promise.resolve()
    wall += 9500; [...ticks].forEach(fn => fn())
    const entry = manager._bgEffectEntries.cameraflare, [system] = advParticleSystems('fx_adv_cameraflare_right')
    const quads = sampleAdvParticles(system, wall, entry.activatedAt, 0.3, 1280, 720)
    const sprites = entry.frontContainer.children
    assert.equal(sprites.filter(sprite => sprite.visible).length, quads.filter(quad => quad.alpha > 0).length)
    assert.ok(new Set(quads.map(quad => quad.frame)).size > 1, 'fixture covers several sheet frames')
    quads.forEach((quad, index) => {
      const sprite = sprites[index], frame = sprite.texture.frame
      assert.deepEqual([frame.x, frame.y, frame.width, frame.height], [quad.frame % 2 * 32, Math.floor(quad.frame / 2) * 32, 32, 32])
      sprite.transform.updateLocalTransform(); const m = sprite.transform.localTransform
      for (const [actual, value] of [[m.a, quad.a / 32], [m.b, quad.b / 32], [m.c, quad.c / 32], [m.d, quad.d / 32], [m.tx, quad.x], [m.ty, quad.y], [sprite.alpha, quad.alpha]])
        assert.ok(Math.abs(actual - value) < 1e-6, `sprite ${index}`)
      assert.equal(sprite.tint, quad.tint)
    })
    manager.destroy(); assert.equal(ticks.size, 0); assert.equal(entry.frameTextures, null)
    manager.bgEffectContainer.destroy(); manager.nearEffectContainer.destroy(); sheet.destroy(true)
  }
  console.log('Background effects: lifecycle, continuous clock, step resets, pause/rate and logical retirement passed')
  console.log('Background effects: client start alpha (incl. legacy start duration) without fade-in and LightPosition None/Left/Right passed')
} finally {
  Object.defineProperty(Texture, 'WHITE', whiteDescriptor)
  white.destroy(true)
  ;[globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame, globalThis.performance] = saved
}
