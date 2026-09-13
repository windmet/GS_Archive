import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { COPY_TRANSFORM, LOSSLESS_WEBP_TRANSFORM, previewTransformKind, resolvePreviewObjectKey } from '../shared/deploy/PreviewAssetTransform.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await fs.readFile(path.join(root, '.deploy', 'r2-manifest.json'), 'utf8'))
assert.equal(manifest.schema_version, 2)
assert.equal(manifest.entries.length, manifest.totals.source_files)
assert.equal(manifest.missing.length, manifest.totals.missing)

const requestKeys = new Set()
const objectKeys = new Set()
const byPrefix = new Map()
let sourceBytes = 0
let deployedBytes = 0
let converted = 0

for (const entry of manifest.entries) {
  assert.match(entry.request_key, /^(assets|data)\//, `Request key escaped the served prefixes: ${entry.request_key}`)
  assert.match(entry.object_key, /^(assets|data)\//, `Object key escaped the served prefixes: ${entry.object_key}`)
  assert.ok(!requestKeys.has(entry.request_key), `Duplicate request key ${entry.request_key}`)
  assert.ok(!objectKeys.has(entry.object_key), `Object key collision ${entry.object_key}`)
  requestKeys.add(entry.request_key)
  objectKeys.add(entry.object_key)
  // Re-derive the expected policy from the request key rather than trusting the
  // manifest's own `transform` label; otherwise a labelling bug self-validates.
  assert.equal(entry.object_key, resolvePreviewObjectKey(entry.request_key), `Object key does not match the shared transform policy: ${entry.request_key}`)
  assert.equal(entry.transform, previewTransformKind(entry.request_key), `Manifest transform disagrees with the shared policy: ${entry.request_key}`)
  const expectedWebp = entry.object_key.endsWith('.webp')
  assert.equal(entry.deployed_content_type === 'image/webp', expectedWebp, `Content type disagrees with the physical extension: ${entry.object_key}`)

  const transformed = previewTransformKind(entry.request_key) === LOSSLESS_WEBP_TRANSFORM
  if (!transformed) {
    assert.equal(entry.request_key, entry.object_key, `Copy entry must not be renamed: ${entry.request_key}`)
    assert.equal(entry.deployed_content_type, entry.source_content_type, `Copy entry changed content type: ${entry.request_key}`)
  } else {
    assert.equal(entry.transform, LOSSLESS_WEBP_TRANSFORM, `Unknown transform for ${entry.request_key}`)
    assert.ok(entry.request_key.endsWith('.png'), `Transform source must be a PNG: ${entry.request_key}`)
    assert.ok(entry.object_key.endsWith('.webp'), `Transform target must be a WebP: ${entry.object_key}`)
    assert.equal(entry.deployed_content_type, 'image/webp', `Transform target must be served as WebP: ${entry.object_key}`)
    assert.notEqual(entry.request_key, entry.object_key, `Transform must rename the object: ${entry.request_key}`)
    converted++
  }

  const content = await fs.readFile(path.join(root, '.deploy', 'r2', ...entry.object_key.split('/')))
  assert.equal(content.length, entry.deployed_size, `Deployed size mismatch for ${entry.object_key}`)
  assert.equal(createHash('sha256').update(content).digest('hex'), entry.sha256, `Hash mismatch for ${entry.object_key}`)
  deployedBytes += content.length
  sourceBytes += entry.source_size
  const prefix = entry.request_key.split('/').slice(0, 2).join('/')
  const bucket = byPrefix.get(prefix) || { source: 0, deployed: 0, converted: 0, convertedSource: 0, convertedDeployed: 0 }
  bucket.source += entry.source_size
  bucket.deployed += content.length
  if (transformed) {
    bucket.converted++
    bucket.convertedSource += entry.source_size
    bucket.convertedDeployed += content.length
  }
  byPrefix.set(prefix, bucket)
}

assert.equal(deployedBytes, manifest.totals.deployed_bytes)
assert.equal(sourceBytes, manifest.totals.source_bytes)
assert.equal(manifest.totals.deployed_objects, manifest.entries.length)
assert.equal(manifest.totals.converted_pngs, converted, 'converted_pngs must equal the number of transformed entries')
assert.equal(manifest.totals.saved_bytes, manifest.totals.source_bytes - manifest.totals.deployed_bytes)
for (const item of manifest.missing) {
  assert.match(item.request_key, /^(assets|data)\//, `Missing key escaped the served prefixes: ${item.request_key}`)
  assert.ok(!requestKeys.has(item.request_key) && !objectKeys.has(item.request_key), `Missing key staged unexpectedly: ${item.request_key}`)
}

// The staging tree must contain nothing the manifest does not describe. A
// leftover object from an earlier layout (for example the pre-WebP `.png`s)
// would otherwise be uploaded as an orphan that no request key resolves to.
let orphans = 0
async function assertNoOrphans(directory, prefix) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    const key = `${prefix}/${entry.name}`
    if (entry.isDirectory()) await assertNoOrphans(absolute, key)
    else { assert.ok(objectKeys.has(key), `Staged object is not described by the manifest: ${key}`); orphans++ }
  }
}
for (const entry of await fs.readdir(path.join(root, '.deploy', 'r2'), { withFileTypes: true })) {
  assert.ok(entry.isDirectory() && ['assets', 'data'].includes(entry.name), `Unexpected entry in the R2 stage root: ${entry.name}`)
  await assertNoOrphans(path.join(root, '.deploy', 'r2', entry.name), entry.name)
}
assert.equal(orphans, objectKeys.size, `Staged object count ${orphans} does not match the manifest's ${objectKeys.size}`)

const GiB = bytes => (bytes / 1024 ** 3).toFixed(2)
const MiB = bytes => (bytes / 1024 ** 2).toFixed(1)
const saved = manifest.totals.saved_bytes
console.log('Preview stage verified')
console.log(`  ${manifest.entries.length} logical requests`)
console.log(`  ${objectKeys.size} physical objects`)
console.log(`  ${manifest.totals.converted_pngs} lossless WebP conversions`)
console.log(`  source   ${GiB(manifest.totals.source_bytes)} GiB (${manifest.totals.source_bytes} bytes)`)
console.log(`  deployed ${GiB(manifest.totals.deployed_bytes)} GiB (${manifest.totals.deployed_bytes} bytes)`)
console.log(`  saved    ${GiB(saved)} GiB (${manifest.totals.saved_bytes} bytes), ratio ${manifest.totals.ratio}`)
console.log(`  ${manifest.missing.length} unresolved runtime keys remain (unchanged)`)
// Report every transformed domain, derived from the data rather than a hardcoded
// list, so a domain added by a later policy change cannot go unreported.
console.log('\nPer-prefix savings for transformed domains:')
const transformed = [...byPrefix.entries()].filter(([, bucket]) => bucket.converted > 0)
  .sort((a, b) => b[1].convertedDeployed - a[1].convertedDeployed)
for (const [prefix, bucket] of transformed) {
  console.log(`  ${prefix.padEnd(20)} ${String(bucket.converted).padStart(5)} files  ${MiB(bucket.convertedSource).padStart(9)} -> ${MiB(bucket.convertedDeployed).padStart(9)} MiB  saved ${MiB(bucket.convertedSource - bucket.convertedDeployed).padStart(8)} MiB  ${(bucket.convertedDeployed / bucket.convertedSource * 100).toFixed(1)}%`)
}
const convSource = transformed.reduce((sum, [, bucket]) => sum + bucket.convertedSource, 0)
const convDeployed = transformed.reduce((sum, [, bucket]) => sum + bucket.convertedDeployed, 0)
console.log(`  ${String(transformed.length + ' domains').padEnd(20)} ${String(converted).padStart(5)} files  ${MiB(convSource).padStart(9)} -> ${MiB(convDeployed).padStart(9)} MiB  saved ${MiB(convSource - convDeployed).padStart(8)} MiB  ${(convDeployed / convSource * 100).toFixed(1)}%`)
