import assert from 'node:assert/strict'
import { BaseTexture, Container, Texture } from 'pixi.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'

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
console.log('Background loading: pending cancellation, successor rollback, same-ID stale failure and clear-before-load passed')
