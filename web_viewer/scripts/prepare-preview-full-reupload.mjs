import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { hashFile } from './lib/preview-source-baseline.mjs'
import { verifyStructuredGzip } from './verify-structured-gzip.mjs'
import { resolvePreviewObjectKey } from '../shared/deploy/PreviewAssetTransform.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, '.deploy/storage-compression')
const read = async name => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'))
const baseline = await read('source-baseline.json')
const revision = (await hashFile(path.join(directory, 'source-baseline.json'))).sha256
const oldPath = path.join(root, '.deploy/r2-manifest.json')
assert.equal((await hashFile(oldPath)).sha256, baseline.previous_manifest_sha256)
const old = JSON.parse(await fs.readFile(oldPath, 'utf8'))
const gzip = await verifyStructuredGzip(path.join(directory, 'structured-manifest.json'))
execFileSync(process.execPath, ['scripts/prepare-preview-data-snapshot.mjs', '--verify'], { cwd: root, stdio: 'inherit' })
const snapshot = await read('data-snapshot-manifest.json')
assert.equal(snapshot.revision, revision)
const byRequest = new Map()
for (const [manifest, stage] of [[gzip, '.deploy/storage-compression/structured'], [snapshot, '.deploy/storage-compression/data-snapshot']]) {
  for (const entry of manifest.entries) {
    assert.ok(!byRequest.has(entry.request_key))
    byRequest.set(entry.request_key, { ...entry, stage })
  }
}
const oldByKey = new Map(old.entries.map(e => [e.request_key, e]))
for (const source of baseline.entries) {
  if (byRequest.has(source.request_key)) continue
  const entry = oldByKey.get(source.request_key)
  assert.ok(entry, `No local package for ${source.request_key}`)
  const historicalSourceHash = entry.source_sha256 || (entry.transform === 'copy' ? entry.sha256 : null)
  if (historicalSourceHash) assert.equal(historicalSourceHash, source.source_sha256)
  else {
    // Preserve the existing deployed image bytes, whose SHA is recorded in v2.
    // The old manifest did not record PNG source hashes; do not claim it did.
    assert.equal(entry.transform, 'webp-lossless-alpha0-rgb0')
    assert.equal(entry.source_size, source.source_size)
  }
  const deployed = await hashFile(path.join(root, '.deploy/r2', entry.object_key))
  assert.equal(deployed.sha256, entry.sha256, `Local package changed: ${entry.object_key}`)
  assert.equal(deployed.size, entry.deployed_size)
  const currentSource = await hashFile(path.resolve(root, source.source))
  assert.equal(currentSource.sha256, source.source_sha256, `Source changed: ${source.request_key}`)
  byRequest.set(source.request_key, { ...source, object_key: entry.object_key, transform: entry.transform,
    deployed_size: deployed.size, deployed_sha256: deployed.sha256,
    deployed_content_type: entry.deployed_content_type, stage: '.deploy/r2',
    reused_historical_image_without_source_hash: !historicalSourceHash })
  if (byRequest.size % 10000 === 0) console.log(`Full package verified ${byRequest.size}/${baseline.entries.length}`)
}
assert.equal(byRequest.size, baseline.entries.length)
const keys = new Set(), groups = new Map()
for (const entry of byRequest.values()) {
  assert.equal(entry.object_key, resolvePreviewObjectKey(entry.request_key, { gzip: true, dataRevision: revision }))
  assert.ok(!keys.has(entry.object_key)); keys.add(entry.object_key)
  const groupKey = JSON.stringify([entry.stage, entry.deployed_content_type, entry.deployed_content_encoding || ''])
  if (!groups.has(groupKey)) groups.set(groupKey, { stage: entry.stage, content_type: entry.deployed_content_type,
    content_encoding: entry.deployed_content_encoding || '', entries: [] })
  groups.get(groupKey).entries.push(entry)
}
let number = 0
const uploadGroups = []
for (const group of groups.values()) {
  const list = `full-reupload-${String(++number).padStart(2, '0')}-keys.txt`
  await fs.writeFile(path.join(directory, list), group.entries.map(e => e.object_key).join('\n') + '\n')
  uploadGroups.push({ stage: group.stage, content_type: group.content_type, content_encoding: group.content_encoding,
    list, files: group.entries.length, bytes: group.entries.reduce((s, e) => s + e.deployed_size, 0) })
}
const manifest = { kind: 'full-preview-reupload', remote: 'cloudflare:sidem-archive-preview', baseline_sha256: revision,
  checked_at: new Date().toISOString(), totals: { files: byRequest.size,
    bytes: [...byRequest.values()].reduce((s, e) => s + e.deployed_size, 0) },
  groups: uploadGroups, missing_dependencies: baseline.missing, entries: [...byRequest.values()] }
await fs.writeFile(path.join(directory, 'full-reupload-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ totals: manifest.totals, groups: uploadGroups, inherited_missing: baseline.missing.length }, null, 2))
