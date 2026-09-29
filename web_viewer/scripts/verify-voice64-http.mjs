import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const origin = process.argv[2]
assert.match(origin || '', /^https:\/\/[^/]+\/?$/)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, '.deploy/voice64')
const raw = await fs.readFile(path.join(directory, 'manifest.json'))
const manifest = JSON.parse(raw)
const samples = JSON.parse(await fs.readFile(path.join(root, '.analysis/voice-compression/listening-plan.json'), 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const selected = new Set(samples.entries.map(e => 'assets/voice/' + e.file))
const sorted = [...manifest.entries].sort((a, b) => a.deployed_size - b.deployed_size)
selected.add(sorted[0].object_key); selected.add(sorted.at(-1).object_key)
for (const entry of manifest.entries) if (entry.channels > 1) selected.add(entry.object_key)
const entries = manifest.entries.filter(e => selected.has(e.object_key))
assert.equal(entries.length, selected.size)
// A unique query avoids a browser/CDN's still-fresh 128k response at the stable
// path. Existing caches can retain that playable representation for max-age=3600.
const request = (entry, options = {}) => fetch(new URL(`/${entry.request_key}?voice64=${sha(raw).slice(0, 16)}`, origin), {
  ...options, headers: { 'Accept-Encoding': 'identity', ...options.headers }, signal: AbortSignal.timeout(45000),
})
let next = 0, done = 0
const failures = []
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < entries.length) {
    const entry = entries[next++]
    try {
      const local = await fs.readFile(path.join(root, entry.stage, entry.object_key))
      assert.equal(sha(local), entry.deployed_sha256)
      let response = await request(entry)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'audio/mp4')
      assert.equal(response.headers.get('content-encoding'), null)
      assert.equal(Number(response.headers.get('content-length')), entry.deployed_size)
      assert.equal(sha(Buffer.from(await response.arrayBuffer())), entry.deployed_sha256)
      const etag = response.headers.get('etag'); assert.ok(etag)
      response = await request(entry, { method: 'HEAD' })
      assert.equal(response.status, 200); assert.equal(Number(response.headers.get('content-length')), entry.deployed_size)
      assert.equal(response.headers.get('etag'), etag)
      response = await request(entry, { headers: { 'If-None-Match': etag } })
      assert.equal(response.status, 304); await response.arrayBuffer()
      for (const [range, start, end] of [['bytes=0-31', 0, 32], ['bytes=-32', local.length - 32, local.length]]) {
        response = await request(entry, { headers: { Range: range } })
        assert.equal(response.status, 206)
        assert.equal(response.headers.get('content-range'), `bytes ${start}-${end - 1}/${local.length}`)
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), local.subarray(start, end))
      }
      response = await request(entry, { headers: { Range: `bytes=${local.length}-` } })
      assert.equal(response.status, 416); await response.arrayBuffer()
    } catch (error) { failures.push({ key: entry.object_key, error: error.message }) }
    if (++done % 25 === 0) console.log(`Voice HTTP ${done}/${entries.length}; failures ${failures.length}`)
  }
}))
const receipt = { origin, checked_at: new Date().toISOString(), manifest_sha256: sha(raw),
  files: done, passed: failures.length === 0, checks: ['GET SHA256', 'HEAD', '304', 'MIME', 'first/suffix Range 206', '416'],
  scope: 'Original-source listening sample keys plus size extremes and every stereo item; HTTP only, not browser playback.', failures }
await fs.writeFile(path.join(directory, 'http-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
assert.equal(failures.length, 0)
