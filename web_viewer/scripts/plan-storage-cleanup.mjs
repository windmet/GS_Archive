import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashFile } from './lib/preview-source-baseline.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, '.deploy/storage-compression')
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
const snapshot = await read(path.join(dir, 'data-snapshot-manifest.json'))
const gzip = await read(path.join(dir, 'structured-manifest.json'))
const old = await read(path.join(root, '.deploy/r2-manifest.json'))
const partial = await read(path.join(dir, 'partial-snapshot-verified.json'))
const snapshotByKey = new Map(snapshot.entries.map(e => [e.object_key, e]))
const retract = []
for (const item of partial) {
  const key = `versions/${snapshot.revision}/${item.Path}`
  const entry = snapshotByKey.get(key)
  assert.ok(entry, `Unknown remote object; refuse cleanup: ${key}`)
  assert.equal(item.Size, entry.deployed_size)
  const local = path.join(dir, snapshot.stage, key)
  const hash = await hashFile(local)
  assert.equal(hash.sha256, entry.deployed_sha256, `Rollback bytes missing: ${key}`)
  assert.equal(hash.size, item.Size)
  retract.push({ object_key: key, bytes: item.Size, local_backup: local, sha256: hash.sha256 })
}
const oldByKey = new Map(old.entries.map(e => [e.request_key, e]))
const structured = []
for (const entry of gzip.entries) {
  const previous = oldByKey.get(entry.request_key)
  assert.equal(previous.transform, 'copy')
  assert.equal(previous.sha256, entry.source_sha256, `Old and current source differ: ${entry.request_key}`)
  structured.push({ object_key: previous.object_key, bytes: previous.deployed_size,
    replacement_key: entry.object_key, replacement_bytes: entry.deployed_size, source_sha256: entry.source_sha256 })
}
const reconciliation = await read(path.join(dir, 'remote-reconciliation.json'))
const orphan = reconciliation.extra.map(e => ({ object_key: e.Path, bytes: e.Size }))
const groups = { retract_unactivated_snapshot: retract, old_structured_requires_cutover: structured, legacy_png_review_only: orphan }
const summary = {}
for (const [name, entries] of Object.entries(groups)) {
  await fs.writeFile(path.join(dir, `cleanup-${name}.json`), JSON.stringify(entries, null, 2) + '\n')
  await fs.writeFile(path.join(dir, `cleanup-${name}-keys.txt`), entries.map(e => e.object_key).join('\n') + '\n')
  summary[name] = { files: entries.length, bytes: entries.reduce((s, e) => s + e.bytes, 0) }
}
summary.structured_replacement_bytes = gzip.entries.reduce((s, e) => s + e.deployed_size, 0)
summary.net_structured_reduction = summary.old_structured_requires_cutover.bytes - summary.structured_replacement_bytes
summary.policy = { account_budget_bytes: 10_000_000_000, preview_target_gib: [8.2, 8.3], upload_order: 'delete verified batch, remeasure, then upload; no full coexistence' }
await fs.writeFile(path.join(dir, 'cleanup-summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
