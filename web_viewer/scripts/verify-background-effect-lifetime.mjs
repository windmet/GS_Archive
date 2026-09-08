import assert from 'node:assert/strict'
import { BaseTexture, Container, Texture } from 'pixi.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'

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
  const manager = new BackgroundManager({
    app: { ticker: { add: fn => ticks.add(fn), remove: fn => ticks.delete(fn) } },
    bgContainer: new Container(), bgEffectContainer: new Container(),
    getWidth: () => 100, getHeight: () => 100,
  })
  const entry = { id: 'fx_adv_rain', container: new Container(), token: 0, loadToken: 0, nowMilliseconds: () => wall, graphics: [], sprites: [] }
  manager._bgEffectEntries[entry.id] = entry
  manager.bgEffectContainer.addChild(entry.container)
  return { manager, entry }
}
try {
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
    const pending = manager._createRainEffect(entry)
    manager._animateBgEffectAlpha(entry, 0.85, 2, 1)
    const queued = [...frames.values()][0]
    if (removal === 'remove') manager._removeBgEffect(entry.id)
    else manager.destroy()
    assert.equal(frames.size, 0)
    rejectTexture(new Error('late offline'))
    await pending
    queued()
    assert.equal(ticks.size, 0, 'late failure cannot register a fallback ticker')
    assert.equal(entry.graphics.length, 0)
    assert.equal(entry.container.destroyed, true)
    assert.equal(manager.bgEffectContainer.children.length, 0)
    manager.bgContainer.destroy(); manager.bgEffectContainer.destroy()
  }
  {
    const { manager, entry } = setup()
    manager._loadEffectTexture = async () => { throw new Error('current offline') }
    await manager._createRainEffect(entry)
    assert.equal(entry.graphics.length, 1, 'current load failure must retain the rain fallback')
    assert.equal(ticks.size, 1)
    manager._animateBgEffectAlpha(entry, 1, 2, 1)
    wall += 2000; frame()
    assert.equal(entry.container.alpha, 1, 'entry starts opaque in this direct fixture')
    entry.container.alpha = 0
    manager._animateBgEffectAlpha(entry, 1, 2, 1)
    const obsolete = [...frames.values()][0]
    manager._animateBgEffectAlpha(entry, 0.8, 2, 1)
    assert.equal(frames.size, 1, 'replacement cancels the prior alpha RAF')
    obsolete(); assert.equal(frames.size, 1)
    wall += 2000; frame(); assert.equal(entry.container.alpha, 0.4)
    wall += 1000; frame(); assert.equal(entry.container.alpha, 0.8)
    assert.equal(entry.alphaTween, null); assert.equal(frames.size, 0)
    manager.destroy(); assert.equal(ticks.size, 0)
    manager.bgContainer.destroy(); manager.bgEffectContainer.destroy()
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
      sprites: entry.sprites.map(sprite => [sprite.x, sprite.y, sprite.rotation, sprite.tilePosition?.x, sprite.tilePosition?.y]) })
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
    manager.destroy(); manager.bgContainer.destroy(); manager.bgEffectContainer.destroy()
  }
  console.log('Background effects: lifecycle, continuous clock, step resets, pause/rate and logical retirement passed')
} finally {
  Object.defineProperty(Texture, 'WHITE', whiteDescriptor)
  white.destroy(true)
  ;[globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame, globalThis.performance] = saved
}
