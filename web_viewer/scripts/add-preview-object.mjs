import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolvePreviewObjectKey, previewTransformKind, COPY_TRANSFORM } from '../shared/deploy/PreviewAssetTransform.js'

/**
 * Adds one already-exported request key to the staging tree and the manifest.
 *
 * The full exporter re-encodes every converted object, which costs minutes for
 * the 15k-image corpus. When the only change is a new file under an untransformed
 * prefix (a plain copy, no encoding), patching the existing v2 manifest is
 * equivalent and immediate. `verify:preview-assets` still re-checks every hash,
 * so this cannot introduce a manifest that disagrees with the stage.
 *
 * Usage: node scripts/add-preview-object.mjs assets/brand/example.png
 */

const requestKey = process.argv[2]
assert.ok(requestKey, 'Usage: node scripts/add-preview-object.mjs <request-key>')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, '.deploy', 'r2-manifest.json')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
assert.equal(manifest.schema_version, 2, 'This patch targets a schema v2 manifest')

const objectKey = resolvePreviewObjectKey(requestKey)
const transform = previewTransformKind(requestKey)
assert.equal(transform, COPY_TRANSFORM, `${requestKey} is a converted key; run the full exporter so the WebP is encoded properly`)

const source = path.join(root, 'public', ...requestKey.split('/'))
const target = path.join(root, '.deploy', 'r2', ...objectKey.split('/'))

assert.ok(!manifest.entries.some(entry => entry.request_key === requestKey), `${requestKey} is already in the manifest`)
assert.ok(!manifest.entries.some(entry => entry.object_key === objectKey), `Object key collision: ${objectKey}`)

const stat = await fs.stat(source)
await fs.mkdir(path.dirname(target), { recursive: true })
await fs.copyFile(source, target)
const content = await fs.readFile(target)
assert.equal(content.length, stat.size, 'Copy changed the size')

manifest.entries.push({
  request_key: requestKey,
  source: path.relative(root, source).split(path.sep).join('/'),
  provenance: 'public',
  object_key: objectKey,
  transform,
  source_size: stat.size,
  source_content_type: 'image/png',
  deployed_content_type: 'image/png',
  deployed_size: content.length,
  sha256: createHash('sha256').update(content).digest('hex'),
})
manifest.entries.sort((a, b) => a.request_key.localeCompare(b.request_key))

assert.equal(new Set(manifest.entries.map(entry => entry.object_key)).size, manifest.entries.length, 'Object key collision after insert')

const totals = manifest.totals
totals.source_files = manifest.entries.length
totals.deployed_objects = manifest.entries.length
totals.source_bytes = manifest.entries.reduce((sum, entry) => sum + entry.source_size, 0)
totals.deployed_bytes = manifest.entries.reduce((sum, entry) => sum + entry.deployed_size, 0)
totals.converted_pngs = manifest.entries.filter(entry => previewTransformKind(entry.request_key) !== COPY_TRANSFORM).length
totals.saved_bytes = totals.source_bytes - totals.deployed_bytes
totals.ratio = Number((totals.deployed_bytes / totals.source_bytes).toFixed(4))

await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Added ${requestKey}`)
console.log(`  object   ${objectKey} (${content.length} bytes, ${transform})`)
console.log(`  sha256   ${createHash('sha256').update(content).digest('hex')}`)
console.log(`  manifest ${totals.source_files} entries, deployed ${totals.deployed_bytes} bytes, ratio ${totals.ratio}`)
