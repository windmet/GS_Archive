import assert from 'node:assert/strict'
import { onRequest as assets } from '../functions/assets/[[path]].js'
import { onRequest as data } from '../functions/data/[[path]].js'

const bytes = new TextEncoder().encode('abcdefghij')
const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])
const objects = new Map([
  ['assets/test.ogg', bytes],
  ['data/test.json', bytes],
  ['assets/card-art/test.webp', webpBytes],
  ['assets/spines/test/texture.webp', webpBytes],
])
const requestedKeys = []
const bucket = {
  async head(key) { requestedKeys.push(key); return objects.has(key) ? { size: objects.get(key).length, httpEtag: '"abc"' } : null },
  async get(key, options) {
    requestedKeys.push(key)
    const body = objects.get(key)
    if (!body) return null
    const range = options?.range
    return { body: new Blob([range ? body.slice(range.offset, range.offset + range.length) : body]).stream() }
  },
}
const call = (handler, path, method = 'GET', headers = {}) => handler({ request: new Request(`https://preview.pages.dev${path}`, { method, headers }), env: { ARCHIVE_ASSETS: bucket } })
let response = await call(assets, '/assets/test.ogg')
assert.equal(response.status, 200)
assert.equal(response.headers.get('Content-Type'), 'audio/ogg')
assert.equal(response.headers.get('ETag'), '"abc"')
assert.equal(await response.text(), 'abcdefghij')
response = await call(assets, '/assets/test.ogg', 'GET', { Range: 'bytes=2-5' })
assert.equal(response.status, 206)
assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/10')
assert.equal(await response.text(), 'cdef')
response = await call(assets, '/assets/test.ogg', 'HEAD')
assert.equal(response.status, 200)
assert.equal(response.headers.get('Content-Length'), '10')
response = await call(assets, '/assets/test.ogg', 'GET', { 'If-None-Match': '"abc"' })
assert.equal(response.status, 304)
response = await call(assets, '/assets/test.ogg', 'GET', { Range: 'bytes=99-' })
assert.equal(response.status, 416)
assert.equal(response.headers.get('Content-Range'), 'bytes */10')
assert.equal((await call(assets, '/assets/missing.ogg')).status, 404)
assert.equal((await call(assets, '/assets/test.ogg', 'POST')).status, 405)
assert.equal((await call(assets, '/assets/%2e%2e/test.ogg')).status, 404)
assert.equal((await call(data, '/data/test.json')).headers.get('Content-Type'), 'application/json; charset=utf-8')

// A transformed domain must serve the historical .png URL from the physical .webp
// object, and must report image/webp because the bytes really are WebP.
for (const requestKey of ['/assets/card-art/test.png', '/assets/spines/test/texture.png']) {
  const objectKey = requestKey.slice(1).replace(/\.png$/, '.webp')
  requestedKeys.length = 0
  response = await call(assets, requestKey)
  assert.equal(response.status, 200, `${requestKey} status`)
  assert.ok(requestedKeys.length > 0, `${requestKey} never reached the bucket`)
  assert.ok(requestedKeys.every(key => key === objectKey), `${requestKey} must only touch ${objectKey}, got ${requestedKeys.join(', ')}`)
  assert.equal(response.headers.get('Content-Type'), 'image/webp', `${requestKey} Content-Type`)
  assert.equal(response.headers.get('Content-Length'), String(webpBytes.length))
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), webpBytes, `${requestKey} body`)
}
// An untransformed PNG prefix keeps identity mapping and stays image/png.
requestedKeys.length = 0
assert.equal((await call(assets, '/assets/card-art/test.jpg')).status, 404)
assert.deepEqual(requestedKeys, ['assets/card-art/test.jpg'], 'Non-PNG keys must not be remapped')
console.log('Preview R2 routing verified: GET, HEAD, Range, ETag, 404, 405, traversal, data, webp mapping')
