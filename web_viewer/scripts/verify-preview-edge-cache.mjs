// Image edge cache in the R2 Function (docs/GS_ARCHIVE_PREVIEW_IMAGE_EDGE_CACHE_20261013.md): off unless
// ARCHIVE_EDGE_CACHE=images; then a whole-object picture GET under /assets/ misses once (R2 head + get, stored with
// the data revision in the key) and later requests hit without touching R2. Ranges, audio, data, JSON and misses
// in the bucket never enter the cache. Stubbed caches.default and R2 bucket; no network.
import assert from 'node:assert/strict'
import { serveR2Resource } from '../functions/_shared/r2-resource.js'

const store = new Map(), puts = []
globalThis.caches = { default: {
  async match(request) { const hit = store.get(request.url); return hit ? new Response(hit.body, { status: 200, headers: hit.headers }) : undefined },
  async put(request, response) { puts.push(request.url); store.set(request.url, { body: Buffer.from(await response.arrayBuffer()), headers: new Headers(response.headers) }) },
} }
const objects = {
  'assets/idols/icons/a.webp': { bytes: Buffer.from('RIFF-webp-bytes'), type: 'image/webp' },
  'assets/voice/v.m4a': { bytes: Buffer.from('m4a-audio-bytes-0123456789'), type: 'audio/mp4' },
}
let heads = 0, gets = 0
const bucket = {
  async head(key) { heads++; const o = objects[key]; return o && { size: o.bytes.length, httpEtag: `"${key.length}"`, httpMetadata: { contentType: o.type } } },
  async get(key, options) {
    gets++; const o = objects[key]; if (!o) return null
    const bytes = options?.range ? o.bytes.subarray(options.range.offset, options.range.offset + options.range.length) : o.bytes
    return { body: new Response(bytes).body }
  },
}
const pending = []
const waitUntil = promise => pending.push(promise)
const env = (extra = {}) => ({ ARCHIVE_ASSETS: bucket, ARCHIVE_DATA_REVISION: 'a'.repeat(64), ARCHIVE_EDGE_CACHE: 'images', ...extra })
const call = async (key, { headers = {}, method = 'GET', environment = env(), withWaitUntil = true } = {}) => {
  const before = { heads, gets }
  const response = await serveR2Resource({ request: new Request(`https://preview.test/${key}`, { method, headers }), env: environment,
    prefix: key.split('/')[0], ...(withWaitUntil ? { waitUntil } : {}) })
  await Promise.all(pending.splice(0))
  const body = method === 'HEAD' || response.status === 304 ? null : Buffer.from(await response.arrayBuffer())
  return { response, body, r2: { heads: heads - before.heads, gets: gets - before.gets }, edge: response.headers.get('X-GS-Edge-Cache') }
}
const picture = 'assets/idols/icons/a.png'
const pictureBytes = objects['assets/idols/icons/a.webp'].bytes

// Off by default: today's behaviour, nothing stored.
let r = await call(picture, { environment: env({ ARCHIVE_EDGE_CACHE: undefined }) })
assert.equal(r.response.status, 200); assert.equal(r.edge, null); assert.deepEqual(r.r2, { heads: 1, gets: 1 }); assert.equal(puts.length, 0)

// First request misses and fills the cache under the revision; the browser still gets one hour.
r = await call(picture)
assert.equal(r.edge, 'MISS'); assert.deepEqual(r.r2, { heads: 1, gets: 1 }); assert.deepEqual(r.body, pictureBytes)
assert.equal(r.response.headers.get('Cache-Control'), 'public, max-age=3600')
assert.deepEqual(puts, [`https://preview.test/__edge-cache/${'a'.repeat(64)}/assets/idols/icons/a.webp`], 'keyed by revision and physical object key')
const stored = store.get(puts[0])
assert.equal(stored.headers.get('Cache-Control'), 'public, max-age=86400'); assert.equal(stored.headers.get('X-GS-Edge-Cache'), null)

// Hits skip R2 entirely and keep the object's validators and type.
r = await call(picture)
assert.equal(r.edge, 'HIT'); assert.deepEqual(r.r2, { heads: 0, gets: 0 }); assert.deepEqual(r.body, pictureBytes)
assert.equal(r.response.headers.get('Content-Type'), 'image/webp'); assert.equal(r.response.headers.get('Cache-Control'), 'public, max-age=3600')
const etag = r.response.headers.get('ETag'); assert.ok(etag)
r = await call(picture, { headers: { 'If-None-Match': `W/${etag}` } })
assert.equal(r.response.status, 304); assert.equal(r.edge, 'HIT'); assert.deepEqual(r.r2, { heads: 0, gets: 0 })
r = await call(picture, { method: 'HEAD' })
assert.equal(r.response.status, 200); assert.equal(r.edge, 'HIT'); assert.deepEqual(r.r2, { heads: 0, gets: 0 })

// A new R2 snapshot is a different key: it misses rather than serving the old revision's bytes.
r = await call(picture, { environment: env({ ARCHIVE_DATA_REVISION: 'b'.repeat(64) }) })
assert.equal(r.edge, 'MISS'); assert.deepEqual(r.r2, { heads: 1, gets: 1 })

// Never cached: ranged requests, audio, data, bucket misses; without waitUntil nothing is stored.
const putsBefore = puts.length
r = await call(picture, { headers: { Range: 'bytes=0-3' } })
assert.equal(r.response.status, 206); assert.equal(r.edge, null); assert.deepEqual(r.r2, { heads: 1, gets: 1 })
r = await call('assets/voice/v.m4a')
assert.equal(r.response.status, 200); assert.equal(r.edge, null)
r = await call('assets/voice/v.m4a', { headers: { Range: 'bytes=0-3' } })
assert.equal(r.response.status, 206); assert.equal(r.response.headers.get('Content-Range'), `bytes 0-3/${objects['assets/voice/v.m4a'].bytes.length}`)
r = await call('data/fx_extracted/cell.png')
assert.equal(r.edge, null, 'only /assets/ pictures')
r = await call('assets/idols/icons/missing.png')
assert.equal(r.response.status, 404)
r = await call('assets/idols/icons/a.png', { environment: env({ ARCHIVE_DATA_REVISION: 'c'.repeat(64) }), withWaitUntil: false })
assert.equal(r.edge, 'MISS'); assert.deepEqual(r.body, pictureBytes)
assert.equal(puts.length, putsBefore, 'nothing else entered the cache')
assert.ok(!store.has(`https://preview.test/__edge-cache/${'c'.repeat(64)}/assets/idols/icons/a.webp`))

delete globalThis.caches
console.log('Preview edge cache: off by default; picture GET misses once then hits without R2 (304/HEAD too); revision-keyed; ranges, audio, data and 404s bypass')
