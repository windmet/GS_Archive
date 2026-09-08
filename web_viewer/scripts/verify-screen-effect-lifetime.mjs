import assert from 'node:assert/strict'
import { PixiStageManager } from '../src/core/PixiStageManager.js'

const saved = [globalThis.setTimeout, globalThis.clearTimeout]
const timers = new Map()
let sequence = 0
globalThis.setTimeout = (fn, delay) => { timers.set(++sequence, { fn, delay }); return sequence }
globalThis.clearTimeout = id => timers.delete(id)
function create() {
  const calls = []
  const stage = Object.assign(Object.create(PixiStageManager.prototype), {
    _screenEffectToken: 0, _screenEffectTimers: new Set(),
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
  console.log('Screen effect lifetime: replacement, queued callbacks, missing overlay and pending texture disposal passed')
} finally {
  [globalThis.setTimeout, globalThis.clearTimeout] = saved
}
