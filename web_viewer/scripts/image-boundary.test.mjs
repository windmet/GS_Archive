import { ALPHA_MODES } from 'pixi.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadImageTexture as load } from '../src/core/loadImageTexture.js'
function image(mode = 'ok') {
  const img = { removed: false, removeAttribute() { this.removed = true } }
  Object.defineProperty(img, 'src', { set() {
    if (mode === 'ok') queueMicrotask(() => img.onload?.())
    if (mode === 'error') queueMicrotask(() => img.onerror?.())
  } })
  return img
}
const options = img => ({ createImage: () => img, createBaseTexture: () => ({ valid: true }), createTexture: base => ({ base }), allowFallback: false, networkTimeoutMs: 10, textureTimeoutMs: 10 })

test('valid image keeps PMA and resolves a texture', async () => {
  const img = image(); const texture = await load('/a.png', options(img))
  assert.equal(texture.base.alphaMode, ALPHA_MODES.PMA); assert.equal(img.crossOrigin, 'anonymous')
})
test('a stalled image request has a network deadline before onload', async () => {
  const img = image('stall')
  await assert.rejects(load('/a.png', options(img)), e => e.code === 'LOAD_TIMEOUT' && e.phase.startsWith('image-network'))
  assert.equal(img.removed, true); assert.equal(img.onload, null)
})
test('owner cancellation rejects promptly and detaches callbacks', async () => {
  const c = new AbortController(), img = image('stall')
  const pending = load('/a.png', { ...options(img), signal: c.signal })
  c.abort(new Error('closed-viewer')); await assert.rejects(pending, /closed-viewer/)
  assert.equal(img.onload, null)
})
test('invalid base texture times out, not treated as a successful image', async () => {
  const img = image(); let unsubscribed = 0
  const base = { valid: false, on() {}, off() { unsubscribed++ } }
  await assert.rejects(load('/a.png', { ...options(img), allowFallback: true, createBaseTexture: () => base }), e => e.phase.startsWith('texture-ready'))
  assert.equal(unsubscribed, 1)
})
test('explicit image-error fallback remains distinct from timeouts', async () => {
  const fallback = { kind: 'approved-placeholder' }
  const actual = await load('/a.png', { ...options(image('error')), allowFallback: true, fallbackTexture: () => fallback })
  assert.equal(actual, fallback)
})
