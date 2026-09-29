import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './lib/structured-gzip.mjs'
import { verifyStructuredGzip } from './verify-structured-gzip.mjs'

const origin = process.argv[2]
assert.ok(/^https?:\/\/[^/]+\/?$/.test(origin || ''), 'Supply canary origin')
const manifestPath = path.resolve(process.argv[3] || '.deploy/storage-compression/canary-manifest.json')
const manifest = await verifyStructuredGzip(manifestPath)
function raw(key, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/' + key, origin)
    const req = (url.protocol === 'https:' ? https : http).request(url, { method, headers: { 'Accept-Encoding': 'gzip', ...headers } }, res => {
      const chunks = []
      res.on('data', b => chunks.push(b)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.setTimeout(30000, () => req.destroy(new Error('HTTP timeout')))
    req.on('error', reject); req.end()
  })
}
for (const entry of manifest.entries) {
  const get = await raw(entry.request_key)
  assert.equal(get.status, 200, entry.request_key)
  assert.equal(get.headers['content-encoding'], 'gzip')
  assert.equal(get.headers['content-type'].split(';')[0], entry.deployed_content_type)
  assert.equal(get.headers['accept-ranges'], undefined)
  assert.equal(sha256(get.body), entry.deployed_sha256, 'Raw placement hash')
  assert.equal(sha256(gunzipSync(get.body)), entry.source_sha256, 'Decoded source hash')
  const head = await raw(entry.request_key, 'HEAD')
  assert.equal(head.status, 200); assert.equal(head.body.length, 0)
  assert.equal(Number(head.headers['content-length']), entry.deployed_size)
  assert.equal(head.headers.etag, get.headers.etag)
  assert.ok(get.headers.etag)
  const cached = await raw(entry.request_key, 'GET', { 'If-None-Match': get.headers.etag })
  assert.equal(cached.status, 304); assert.equal(cached.body.length, 0)
  const range = await raw(entry.request_key, 'GET', { Range: 'bytes=0-31' })
  assert.equal(range.status, 200); assert.equal(range.headers['content-range'], undefined)
  assert.equal(sha256(range.body), entry.deployed_sha256)
  const decoded = await fetch(new URL('/' + entry.request_key, origin), { headers: { 'Accept-Encoding': 'gzip' } })
  assert.equal(sha256(Buffer.from(await decoded.arrayBuffer())), entry.source_sha256, 'fetch auto-decoding source integrity')
  assert.equal((await raw(entry.request_key, 'GET', { 'Accept-Encoding': 'identity' })).status, 406)
}
const receipt = { origin, checked_at: new Date().toISOString(), files: manifest.entries.length,
  baseline_sha256: manifest.baseline_sha256, canary_manifest_sha256: sha256(await fs.readFile(manifestPath)),
  passed: true, checks: ['raw gzip hash', 'decoded source hash', 'GET', 'HEAD', '304', 'ignored Range 200', 'fetch decoding', 'identity 406'] }
await fs.writeFile(path.join(path.dirname(manifestPath), 'canary-http-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt, null, 2))
