import assert from 'node:assert/strict'
import { ScreenEffectManager } from '../src/core/ScreenEffectManager.js'
import { BackgroundEffectManager } from '../src/core/BackgroundEffectManager.js'
import { PixiStageManager } from '../src/core/PixiStageManager.js'

for (const Manager of [ScreenEffectManager, BackgroundEffectManager]) {
  const requests = []
  const load = url => new Promise((resolve, reject) => requests.push({ url, resolve, reject }))
  const manager = new Manager({ loadTextureFromUrl: load })
  const first = manager._loadEffectTexture('fx_adv_rain')
  assert.equal(manager._loadEffectTexture('fx_adv_rain'), first)
  await Promise.resolve()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/data/fx_extracted/unity_fx_adv_rain.png')
  const error = new Error('offline')
  requests[0].reject(error)
  await assert.rejects(first, actual => actual === error)
  const retried = manager._loadEffectTexture('fx_adv_rain')
  await Promise.resolve(); assert.equal(requests.length, 2)
  const texture = { recovered: true }; requests[1].resolve(texture)
  assert.equal(await retried, texture)
  assert.equal(manager._loadEffectTexture('fx_adv_rain'), retried)
  assert.equal(requests.length, 2)
  const old = manager._loadEffectTexture('fx_adv_sakura')
  await Promise.resolve()
  const replacement = Promise.resolve({ fresh: true })
  manager._effectTextureCache.fx_adv_sakura = replacement
  requests[2].reject(error); await assert.rejects(old)
  assert.equal(manager._loadEffectTexture('fx_adv_sakura'), replacement)
  const sync = new Manager({ loadTextureFromUrl: () => { throw error } })
  await assert.rejects(sync._loadEffectTexture('fx_adv_rain'), actual => actual === error)
  assert.equal(sync._effectTextureCache.fx_adv_rain, undefined)
}
const savedImage = globalThis.Image
const images = []
globalThis.Image = class { constructor() { images.push(this) } }
try {
  const fallback = { placeholder: true }
  const stage = Object.assign(Object.create(PixiStageManager.prototype), { _getFallbackTexture: () => fallback })
  const strict = stage._loadTextureFromUrl('fixture.png', { allowFallback: false })
  images.at(-1).onerror()
  await assert.rejects(strict, /Failed to load texture/)
  const ordinary = stage._loadTextureFromUrl('fixture.png')
  images.at(-1).onerror()
  assert.equal(await ordinary, fallback, 'ordinary background fallback must remain available')
} finally {
  globalThis.Image = savedImage
}
console.log('Both effect managers: shared loading, retry, stale failure isolation and strict image failure passed')
