import assert from 'node:assert/strict'
import { onRequest as assets } from '../functions/assets/[[path]].js'
import { onRequest as data } from '../functions/data/[[path]].js'

const bytes = new TextEncoder().encode('abcdefghij')
const bucket = {
  async head(key) { return key === 'assets/test.ogg' || key === 'data/test.json' ? { size: bytes.length, httpEtag: '"abc"' } : null },
  async get(key, options) {
    const range = options?.range
    const result = range ? bytes.slice(range.offset, range.offset + range.length) : bytes
    return { body: new Blob([result]).stream() }
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
console.log('Preview R2 routing verified: GET, HEAD, Range, ETag, 404, 405, traversal, data')
