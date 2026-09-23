import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const origin = process.argv[2]
if (!origin || !/^https:\/\/[^/]+\/?$/.test(origin)) throw new Error('Usage: npm run verify:preview-http -- https://<preview>.pages.dev')
const base = origin.replace(/\/$/, '')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await fs.readFile(path.join(root, '.deploy', 'r2-manifest.json'), 'utf8'))
const choose = predicate => {
  const item = manifest.entries.find(predicate)
  assert.ok(item, 'Manifest does not contain a required HTTP probe')
  return item
}
const image = choose(item => item.request_key.startsWith('assets/brand/') && item.request_key.endsWith('.png'))
const data = choose(item => item.request_key === 'data/archive_manifest.json')
const audio = choose(item => item.request_key.startsWith('assets/voice/') && item.request_key.endsWith('.m4a') && item.deployed_size > 32)
const local = item => path.join(root, '.deploy', 'r2', ...item.object_key.split('/'))
// This verifier compares served bytes against staged bytes, so it pins the
// identity representation. Cloudflare Brotli-compresses JSON and, correctly,
// drops Content-Length when it does; without this a transfer-coding detail
// reads as a content mismatch.
async function request(key, options = {}) {
  return fetch(`${base}/${key}`, { ...options, headers: { 'Accept-Encoding': 'identity', ...options.headers } })
}
const MiB = bytes => (bytes / 1024 ** 2).toFixed(2)

// Untransformed PNG prefixes must keep serving real PNG bytes at their own key.
assert.equal(image.object_key, image.request_key, 'brand PNG must not be transformed')
let response = await request(image.request_key)
assert.equal(response.status, 200, `${image.request_key} GET`)
assert.ok(response.headers.get('Content-Type')?.startsWith('image/png'))
assert.equal(Number(response.headers.get('Content-Length')), image.deployed_size)
assert.deepEqual(Buffer.from(await response.arrayBuffer()), await fs.readFile(local(image)))
const etag = response.headers.get('ETag')
assert.ok(etag, 'Image ETag missing')
response = await request(image.request_key, { headers: { 'If-None-Match': etag } })
assert.equal(response.status, 304, 'ETag revalidation')

response = await request(data.request_key, { method: 'HEAD' })
assert.equal(response.status, 200, `${data.request_key} HEAD`)
assert.ok(response.headers.get('Content-Type')?.startsWith('application/json'))
assert.equal(Number(response.headers.get('Content-Length')), data.deployed_size)
assert.equal((await response.arrayBuffer()).byteLength, 0)

response = await request(audio.request_key, { headers: { Range: 'bytes=0-31' } })
assert.equal(response.status, 206, `${audio.request_key} Range`)
assert.equal(response.headers.get('Content-Range'), `bytes 0-31/${audio.deployed_size}`)
assert.equal(Number(response.headers.get('Content-Length')), 32)
assert.deepEqual(Buffer.from(await response.arrayBuffer()), (await fs.readFile(local(audio))).subarray(0, 32))
response = await request(audio.request_key, { headers: { Range: `bytes=${audio.deployed_size}-` } })
assert.equal(response.status, 416, 'Unsatisfiable range')

// The load-bearing probe: the historical `.png` URL must be served from the
// physical `.webp` object. This is what proves the routing chain, not just that
// some file answered 200. Every transformed domain gets one probe, smallest file
// first so acceptance does not pull multi-megabyte backgrounds down the wire.
const TRANSFORMED_DOMAINS = ['assets/card-art/', 'assets/spines/', 'assets/live-chibi/', 'assets/bg/', 'assets/cards/',
  'assets/gasha/', 'assets/stories/', 'assets/events/', 'assets/idols/', 'assets/songs/', 'assets/units/', 'data/fx_extracted/']
for (const prefix of TRANSFORMED_DOMAINS) {
  const candidates = manifest.entries.filter(item => item.transform === 'webp-lossless-alpha0-rgb0' && item.request_key.startsWith(prefix))
  if (!candidates.length) continue
  const transformed = candidates.reduce((smallest, item) => item.deployed_size < smallest.deployed_size ? item : smallest)
  assert.ok(transformed.request_key.endsWith('.png'), `${prefix} request key must stay a PNG URL`)
  assert.ok(transformed.object_key.endsWith('.webp'), `${prefix} object key must be WebP`)
  response = await request(transformed.request_key)
  assert.equal(response.status, 200, `${transformed.request_key} GET`)
  assert.equal(response.headers.get('Content-Type'), 'image/webp', `${transformed.request_key} Content-Type`)
  assert.equal(Number(response.headers.get('Content-Length')), transformed.deployed_size, `${transformed.request_key} length`)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await fs.readFile(local(transformed)), `${transformed.request_key} body`)
  assert.ok(response.headers.get('ETag'), `${transformed.request_key} ETag missing`)
  console.log(`  ${transformed.request_key} -> ${transformed.object_key}  ${MiB(transformed.source_size)} -> ${MiB(transformed.deployed_size)} MiB  image/webp`)
}

response = await request('assets/__preview_probe_missing__.png')
assert.equal(response.status, 404, 'Missing R2 key')
response = await request(image.request_key, { method: 'POST' })
assert.equal(response.status, 405, 'Unsupported method')
console.log(`Preview HTTP verified at ${base}: brand PNG control, WebP mapping across transformed domains, ETag/304, data HEAD, voice Range/416, 404, 405`)
