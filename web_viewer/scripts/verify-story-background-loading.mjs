import assert from 'node:assert/strict'
import { BaseTexture, Container, Texture } from 'pixi.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { EffectScheduler } from '../src/core/story-runtime/EffectScheduler.js'
import { createBackgroundCueHandle } from '../src/core/story-runtime/BackgroundCueRuntime.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function texture() { return new Texture(new BaseTexture(null, { width: 4, height: 4 })) }
function setup() {
  const requests = []
  const tickers = new Set()
  const container = new Container()
  const manager = new BackgroundManager({
    app: { ticker: { add: fn => tickers.add(fn), remove: fn => tickers.delete(fn) } },
    bgContainer: container, bgEffectContainer: new Container(),
    getWidth: () => 100, getHeight: () => 100, getBgUrl: id => id,
    loadTextureFromUrl: id => { const request = { id, ...deferred() }; requests.push(request); return request.promise },
  })
  return { manager, requests, tickers, container }
}
async function install(state, id) {
  const loading = state.manager.setBackground(id, { duration: 0 })
  state.requests.at(-1).resolve(texture())
  await loading
}

for (const outcome of ['fade', 'settle-before-load', 'failure', 'cancel']) {
  const state = setup()
  await install(state, 'A')
  let now = 0
  const first = state.manager.setBackground('B', { duration: 1, nowMilliseconds: () => now })
  const request = state.requests.at(-1)
  let completed = false
  const duplicate = state.manager.setBackground('B', outcome === 'settle-before-load' ? { duration: 0 } : null)
  duplicate.then(() => { completed = true })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(completed, false, `${outcome}: same-ID request cannot finish before texture arrives`)
  assert.equal(state.requests.length, 2, 'duplicate must reuse the existing load')
  const warn = console.warn
  try {
    if (outcome === 'failure') {
      console.warn = () => {}
      request.reject(new Error('shared failure'))
    } else {
      if (outcome === 'cancel') state.manager.clearBackground()
      request.resolve(texture())
      await Promise.resolve()
      if (outcome === 'fade') {
        assert.equal(completed, false, 'loaded texture is not yet a finished fade')
        now = 1000
        for (const tick of state.tickers) tick()
      }
    }
    const expected = outcome === 'failure' ? 'failed' : outcome === 'cancel' ? 'cancelled' : 'completed'
    assert.equal((await first).status, expected)
    assert.equal((await duplicate).status, expected, 'all callers receive the same terminal outcome')
    if (expected === 'completed') assert.equal(state.manager.bgSprite.alpha, 1)
    assert.equal(state.tickers.size, 0)
  } finally {
    console.warn = warn
    state.manager.clearBackground()
  }
}

{
  const state = setup()
  await install(state, 'A')
  const oldSprite = state.manager.bgSprite
  const pending = state.manager.setBackground('B', { duration: 1 })
  assert.equal(state.manager.settleBackgroundTransition(), false, 'unloaded texture cannot be settled')
  assert.equal(state.manager.cancelBackgroundTransition(), true, 'pending load must be cancellable')
  state.requests.at(-1).resolve(texture())
  await pending
  assert.equal(state.manager.currentBgId, 'A')
  assert.equal(state.manager.bgSprite, oldSprite)
  assert.deepEqual(state.container.children, [oldSprite])
  assert.equal(state.tickers.size, 0)
  state.manager.clearBackground()
}
{
  const state = setup()
  await install(state, 'A')
  const pendingB = state.manager.setBackground('B')
  const requestB = state.requests.at(-1)
  const pendingC = state.manager.setBackground('C', { duration: 0 })
  const requestC = state.requests.at(-1)
  requestB.resolve(texture())
  await pendingB
  assert.equal(state.container.children.length, 1)
  assert.equal(state.manager.cancelBackgroundTransition(), true)
  requestC.resolve(texture())
  await pendingC
  assert.equal(state.manager.currentBgId, 'A', 'cancelled successor restores installed background, not superseded pending ID')
  state.manager.clearBackground()
}
{
  const state = setup()
  await install(state, 'A')
  const first = state.manager.setBackground('B')
  const stale = state.requests.at(-1)
  state.manager.cancelBackgroundTransition()
  const second = state.manager.setBackground('B', { duration: 0 })
  stale.reject(new Error('late failure'))
  await first
  assert.equal(state.manager.currentBgId, 'B', 'stale failure must not revert newer same-ID request')
  state.requests.at(-1).resolve(texture())
  await second
  assert.equal(state.manager.currentBgId, 'B')
  state.manager.clearBackground()
}
{
  const state = setup()
  const pending = state.manager.setBackground('A')
  state.manager.clearBackground()
  state.requests.at(-1).resolve(texture())
  await pending
  assert.equal(state.container.children.length, 0)
  assert.equal(state.manager.currentBgId, null)
}
{
  const state = setup()
  await install(state, 'A')
  const oldSprite = state.manager.bgSprite
  const pending = state.manager.setBackground('B', { duration: 1 })
  state.requests.at(-1).resolve(texture())
  await Promise.resolve()
  assert.equal(state.tickers.size, 1)
  assert.equal(state.container.children.length, 2)
  assert.equal(state.manager.cancelBackgroundTransition(), true)
  assert.equal((await pending).status, 'cancelled')
  assert.equal(state.manager.bgSprite, oldSprite)
  assert.equal(oldSprite.alpha, 1)
  assert.equal(state.tickers.size, 0)
  const next = state.manager.setBackground('C', { duration: 1 })
  state.requests.at(-1).resolve(texture())
  await Promise.resolve()
  assert.equal(state.manager.settleBackgroundTransition(), true)
  assert.equal((await next).status, 'settled')
  assert.equal(state.manager.currentBgId, 'C')
  assert.equal(state.container.children.length, 1)
  assert.equal(state.tickers.size, 0)
  state.manager.clearBackground()
}
{
  const state = setup()
  await install(state, 'A')
  const pending = state.manager.setBackground('B')
  const warn = console.warn
  const warnings = []
  console.warn = (...args) => warnings.push(args)
  try {
    state.requests.at(-1).reject(new Error('current failure'))
    await pending
  } finally { console.warn = warn }
  assert.equal(warnings.length, 1)
  assert.equal(state.manager.currentBgId, 'A')
  assert.equal(state.manager._bgTransition, null)
  assert.equal(state.container.children.length, 1)
  state.manager.clearBackground()
}
for (const pauseBeforeLoad of [false, true]) {
  const state = setup()
  await install(state, 'A')
  let wallTime = 0
  const clock = new StoryClock({ nowMilliseconds: () => wallTime })
  const scheduler = new EffectScheduler({ clock, requestFrame: () => 1, cancelFrame: () => {} })
  const cue = {
    cue_id: 'background-clock', action: 'background.change', channel: 'background',
    at: 0, duration: 2, payload: { bg: 'B' }, lifecycle: { skippable: true },
  }
  const stage = { backgroundManager: state.manager, setBackground: (...args) => state.manager.setBackground(...args) }
  scheduler.loadStep([cue], { handlers: new Map([
    ['background.change', item => createBackgroundCueHandle(item, () => stage, {
      nowMilliseconds: () => clock.now() * 1000,
    })],
  ]) })
  scheduler.start()
  if (pauseBeforeLoad) await scheduler.pause()
  state.requests.at(-1).resolve(texture())
  await Promise.resolve()
  const tick = () => { for (const fn of state.tickers) fn() }
  const oldSprite = state.container.children[0]
  const newSprite = state.manager.bgSprite
  if (pauseBeforeLoad) {
    wallTime += 10000
    tick()
    assert.equal(newSprite.alpha, 0, 'texture loaded during pause must not advance')
    await scheduler.resume()
  }
  wallTime += 500
  tick()
  assert.equal(newSprite.alpha, 0.25, 'background must use logical elapsed time')
  assert.equal(oldSprite.alpha, 0.75)
  await scheduler.pause()
  wallTime += 10000
  tick()
  assert.equal(newSprite.alpha, 0.25, 'paused background must hold its intermediate alpha')
  scheduler.setRate(2)
  await scheduler.resume()
  wallTime += 250
  tick()
  assert.equal(newSprite.alpha, 0.5, 'resumed background must follow 2x rate without a jump')
  scheduler.setRate(0.5)
  wallTime += 2000
  tick()
  assert.equal(newSprite.alpha, 1)
  assert.equal(state.tickers.size, 0)
  assert.equal(state.container.children.length, 1)
  await scheduler.dispose()
  state.manager.clearBackground()
}
console.log('Background loading: ownership, cancellation, pause during loading/fade, resume and playback rates passed')
