import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashFile } from './lib/preview-source-baseline.mjs'
import { isPreviewDataSnapshotKey, resolvePreviewObjectKey } from '../shared/deploy/PreviewAssetTransform.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, '.deploy/storage-compression')
assert.equal(await fs.realpath(directory), directory, 'Refusing redirected output')
const baselinePath = path.join(directory, 'source-baseline.json')
const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'))
const revision = (await hashFile(baselinePath)).sha256
const selected = baseline.entries.filter(e => isPreviewDataSnapshotKey(e.request_key))
const selectedKeys = new Set(selected.map(e => e.request_key))
for (const key of [...baseline.drift.size_changed, ...baseline.drift.same_size_content_changed]) {
  assert.ok(selectedKeys.has(key), `Uncovered source drift: ${key}`)
}
const manifestPath = path.join(directory, 'data-snapshot-manifest.json')
const stage = 'data-snapshot'
const stageRoot = path.join(directory, stage)
const verify = process.argv[2] === '--verify'
assert.ok(verify || process.argv.length === 2, 'Use no arguments to prepare, or --verify')
if (!verify) await fs.mkdir(stageRoot) // refuse to overwrite an existing batch
assert.equal(await fs.realpath(stageRoot), stageRoot)
const entries = []
for (const entry of selected) {
  const source = path.resolve(root, entry.source)
  const sourceHash = await hashFile(source)
  assert.equal(sourceHash.sha256, entry.source_sha256, `Source drift: ${entry.request_key}`)
  assert.equal(sourceHash.size, entry.source_size)
  const object_key = resolvePreviewObjectKey(entry.request_key, { dataRevision: revision })
  const target = path.join(stageRoot, object_key)
  if (!verify) {
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL)
  }
  assert.equal(await fs.realpath(target), target)
  const placed = await hashFile(target)
  assert.deepEqual(placed, sourceHash, `Placement mismatch: ${entry.request_key}`)
  JSON.parse(await fs.readFile(target, 'utf8'))
  entries.push({ ...entry, object_key, transform: 'copy', deployed_size: placed.size,
    deployed_sha256: placed.sha256, deployed_content_type: 'application/json' })
}
const expected = new Set(entries.map(e => e.object_key))
async function walk(dir, prefix = '') {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const key = prefix + item.name
    if (item.isDirectory()) await walk(path.join(dir, item.name), key + '/')
    else { assert.ok(item.isFile() && expected.delete(key), `Unexpected staging entry: ${key}`) }
  }
}
await walk(stageRoot); assert.equal(expected.size, 0)
const manifest = { schema_version: 3, kind: 'preview-data-snapshot', scope: 'non-compiled-data-json',
  baseline_sha256: revision, revision, stage, totals: { files: entries.length, bytes: entries.reduce((s, e) => s + e.deployed_size, 0) }, entries }
if (verify) assert.deepEqual(JSON.parse(await fs.readFile(manifestPath, 'utf8')), manifest)
else await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ verified: verify, revision, ...manifest.totals }))
