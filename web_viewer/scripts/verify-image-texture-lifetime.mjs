import assert from 'node:assert/strict'
import { loadImageTexture } from '../src/core/loadImageTexture.js'

function setup(options = {}) {
  const timers = new Map(), listeners = new Set(), image = {}
  let sequence = 0, creations = 0
  const base = { valid: false, on: (_, fn) => listeners.add(fn), off: (_, fn) => listeners.delete(fn) }
  const texture = { base }, fallback = { fallback: true }
  const pending = loadImageTexture('fixture.png', {
    allowFallback: false, createImage: () => image, createBaseTexture: () => base,
    createTexture: () => { creations++; return texture }, fallbackTexture: () => fallback,
    setTimer: (fn, delay) => { assert.equal(delay, 10000); timers.set(++sequence, fn); return sequence },
    clearTimer: id => timers.delete(id), ...options,
  })
  const clean = () => {
    assert.equal(image.onload, null); assert.equal(image.onerror, null)
    assert.equal(timers.size, 0); assert.equal(listeners.size, 0)
  }
  return { pending, image, base, texture, fallback, timers, listeners, clean, creations: () => creations }
}
{
  const t = setup(); const load = t.image.onload
  load(); assert.equal(t.timers.size, 1); assert.equal(t.listeners.size, 1)
  const update = [...t.listeners][0], timeout = [...t.timers.values()][0]
  update(); assert.equal(t.listeners.size, 1, 'invalid updates cannot consume the readiness listener')
  t.base.valid = true; update()
  assert.equal(await t.pending, t.texture); t.clean()
  timeout(); update(); load(); assert.equal(t.creations(), 1)
}
for (const allowFallback of [false, true]) {
  const t = setup({ allowFallback }); t.image.onload()
  const update = [...t.listeners][0]
  ;[...t.timers.values()][0]()
  if (allowFallback) assert.equal(await t.pending, t.texture)
  else await assert.rejects(t.pending, /Texture timeout/)
  t.clean(); t.base.valid = true; update()
  assert.equal(t.creations(), allowFallback ? 1 : 0)
}
{
  const t = setup(); t.image.onerror()
  await assert.rejects(t.pending, /Failed to load texture/); t.clean()
  const valid = setup(); valid.base.valid = true; valid.image.onload()
  assert.equal(await valid.pending, valid.texture); valid.clean()
}
for (const failure of ['createBaseTexture', 'createTexture']) {
  const error = new Error(failure)
  const t = setup({ [failure]: () => { throw error } })
  t.base.valid = true; t.image.onload()
  await assert.rejects(t.pending, actual => actual === error); t.clean()
}
{
  const base = { valid: true }, texture = {}
  let image
  const result = await loadImageTexture('immediate.png', {
    createImage: () => (image = { set src(url) {
      assert.equal(url, 'immediate.png')
      assert.equal(typeof this.onload, 'function'); assert.equal(typeof this.onerror, 'function')
      this.onload()
    } }), createBaseTexture: () => base, createTexture: () => texture,
  })
  assert.equal(result, texture); assert.equal(image.onload, null)
}
console.log('Image texture lifecycle: immediate completion, readiness, timeout, duplicate callbacks and exception cleanup passed')
