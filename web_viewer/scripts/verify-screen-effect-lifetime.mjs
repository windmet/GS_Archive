import assert from 'node:assert/strict'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { BaseTexture, Container, Texture } from 'pixi.js'

const saved = [globalThis.setTimeout, globalThis.clearTimeout]
const timers = new Map()
let sequence = 0
globalThis.setTimeout = (fn, delay) => { timers.set(++sequence, { fn, delay }); return sequence }
globalThis.clearTimeout = id => timers.delete(id)
function create() {
  const calls = []
  const stage = Object.assign(Object.create(PixiStageManager.prototype), {
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
    active.width = 1280; active.height = 720
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
  console.log('Screen effect lifetime: delayed replacement, pending textures, active particle cleanup and shared texture retention passed')
} finally {
  [globalThis.setTimeout, globalThis.clearTimeout] = saved
}
