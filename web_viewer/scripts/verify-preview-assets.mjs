import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await fs.readFile(path.join(root, '.deploy', 'r2-manifest.json'), 'utf8'))
assert.equal(manifest.schema_version, 1)
assert.equal(manifest.entries.length, manifest.totals.files)
assert.equal(manifest.missing.length, manifest.totals.missing)
let bytes = 0
const keys = new Set()
for (const entry of manifest.entries) {
  assert.match(entry.key, /^(assets|data)\//)
  assert.ok(!keys.has(entry.key), `Duplicate key ${entry.key}`)
  keys.add(entry.key)
  const file = path.join(root, '.deploy', 'r2', ...entry.key.split('/'))
  const content = await fs.readFile(file)
  assert.equal(content.length, entry.size, entry.key)
  assert.equal(createHash('sha256').update(content).digest('hex'), entry.sha256, entry.key)
  bytes += content.length
}
assert.equal(bytes, manifest.totals.bytes)
for (const item of manifest.missing) assert.ok(!keys.has(item.key), `Missing key staged unexpectedly: ${item.key}`)
console.log(`Preview stage verified: ${keys.size} objects, ${bytes} bytes, hashes and URL keys match; ${manifest.missing.length} unresolved runtime keys remain`)
