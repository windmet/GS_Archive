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
const image = choose(item => item.key.startsWith('assets/brand/') && item.key.endsWith('.png'))
const data = choose(item => item.key === 'data/archive_manifest.json')
const audio = choose(item => item.key.startsWith('assets/voice/') && item.key.endsWith('.m4a') && item.size > 32)
const local = item => path.join(root, '.deploy', 'r2', ...item.key.split('/'))
async function request(key, options) { return fetch(`${base}/${key}`, options) }

let response = await request(image.key)
assert.equal(response.status, 200, `${image.key} GET`)
assert.ok(response.headers.get('Content-Type')?.startsWith('image/png'))
assert.equal(Number(response.headers.get('Content-Length')), image.size)
assert.deepEqual(Buffer.from(await response.arrayBuffer()), await fs.readFile(local(image)))
const etag = response.headers.get('ETag')
assert.ok(etag, 'Image ETag missing')
response = await request(image.key, { headers: { 'If-None-Match': etag } })
assert.equal(response.status, 304, 'ETag revalidation')

response = await request(data.key, { method: 'HEAD' })
assert.equal(response.status, 200, `${data.key} HEAD`)
assert.ok(response.headers.get('Content-Type')?.startsWith('application/json'))
assert.equal(Number(response.headers.get('Content-Length')), data.size)
assert.equal((await response.arrayBuffer()).byteLength, 0)

response = await request(audio.key, { headers: { Range: 'bytes=0-31' } })
assert.equal(response.status, 206, `${audio.key} Range`)
assert.equal(response.headers.get('Content-Range'), `bytes 0-31/${audio.size}`)
assert.equal(Number(response.headers.get('Content-Length')), 32)
assert.deepEqual(Buffer.from(await response.arrayBuffer()), (await fs.readFile(local(audio))).subarray(0, 32))
response = await request(audio.key, { headers: { Range: `bytes=${audio.size}-` } })
assert.equal(response.status, 416, 'Unsatisfiable range')

response = await request('assets/__preview_probe_missing__.png')
assert.equal(response.status, 404, 'Missing R2 key')
response = await request(image.key, { method: 'POST' })
assert.equal(response.status, 405, 'Unsupported method')
console.log(`Preview HTTP verified at ${base}: image GET/ETag, data HEAD, voice Range/416, 404, 405`)
