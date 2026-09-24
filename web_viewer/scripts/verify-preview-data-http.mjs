import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'

const origin = process.argv[2]
assert.ok(/^https:\/\/[^/]+\/?$/.test(origin || ''), 'Supply HTTPS preview origin')
const directory = new URL('../.deploy/storage-compression/', import.meta.url)
const raw = await fs.readFile(new URL('data-snapshot-manifest.json', directory))
const manifest = JSON.parse(raw)
assert.equal(manifest.kind, 'preview-data-snapshot')
const sha = value => createHash('sha256').update(value).digest('hex')
let next = 0, completed = 0
const failures = []
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < manifest.entries.length) {
    const entry = manifest.entries[next++]
    try {
      const response = await fetch(new URL('/' + entry.request_key, origin), {
        headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(45000),
      })
      assert.equal(response.status, 200)
      assert.match(response.headers.get('Content-Type') || '', /^application\/json/)
      const bytes = Buffer.from(await response.arrayBuffer())
      assert.equal(bytes.length, entry.source_size)
      assert.equal(sha(bytes), entry.source_sha256)
    } catch (error) { failures.push({ request_key: entry.request_key, error: error.message }) }
    if (++completed % 250 === 0) console.log(`Data HTTP ${completed}/${manifest.entries.length}; failures ${failures.length}`)
  }
}))
const receipt = { origin, checked_at: new Date().toISOString(), baseline_sha256: manifest.baseline_sha256,
  manifest_sha256: sha(raw), files: completed, passed: failures.length === 0, failures }
await fs.writeFile(new URL('data-snapshot-http-receipt.json', directory), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify({ ...receipt, failures: failures.slice(0, 5) }, null, 2))
assert.equal(failures.length, 0, 'Data snapshot HTTP verification failed')
