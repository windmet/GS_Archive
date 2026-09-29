import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { sha256 } from './lib/structured-gzip.mjs'
import { resolvePreviewObjectKey, isPreviewGzipCandidate } from '../shared/deploy/PreviewAssetTransform.js'

export async function verifyStructuredGzip(manifestPath) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  assert.equal(manifest.schema_version, 3)
  assert.equal(manifest.scope, 'structured-gzip-delta')
  assert.ok(['canary', 'structured'].includes(manifest.stage))
  assert.ok(manifest.entries.length > 0, 'Refusing an empty candidate')
  const directory = path.dirname(manifestPath), stage = path.join(directory, manifest.stage)
  assert.equal(await fs.realpath(stage), stage, 'Refusing redirected stage')
  const baselineBytes = await fs.readFile(path.join(directory, 'source-baseline.json'))
  assert.equal(sha256(baselineBytes), manifest.baseline_sha256)
  const baseline = new Map(JSON.parse(baselineBytes).entries.map(e => [e.request_key, e]))
  if (manifest.stage === 'structured') {
    assert.deepEqual(manifest.entries.map(e => e.request_key).sort(),
      [...baseline.keys()].filter(isPreviewGzipCandidate).sort(), 'Full delta must cover the whole allowlist')
  }
  const keys = new Set(), requests = new Set()
  let sourceBytes = 0, deployedBytes = 0
  for (const e of manifest.entries) {
    assert.ok(isPreviewGzipCandidate(e.request_key))
    assert.equal(e.object_key, resolvePreviewObjectKey(e.request_key, { gzip: true }))
    assert.ok(!keys.has(e.object_key) && !requests.has(e.request_key), 'Duplicate key')
    keys.add(e.object_key); requests.add(e.request_key)
    assert.equal(e.source_sha256, baseline.get(e.request_key)?.source_sha256)
    assert.equal(e.source_size, baseline.get(e.request_key)?.source_size)
    assert.equal(e.transform, 'gzip-v1')
    assert.equal(e.deployed_content_encoding, 'gzip')
    assert.equal(e.deployed_content_type, baseline.get(e.request_key)?.source_content_type)
    const bytes = await fs.readFile(path.join(stage, e.object_key))
    assert.equal(bytes.length, e.deployed_size)
    assert.equal(sha256(bytes), e.deployed_sha256)
    const source = gunzipSync(bytes)
    assert.equal(source.length, e.source_size)
    assert.equal(sha256(source), e.source_sha256)
    sourceBytes += source.length; deployedBytes += bytes.length
  }
  let files = 0
  async function walk(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name)
      assert.ok(!e.isSymbolicLink(), 'Linked stage entry')
      if (e.isDirectory()) await walk(file)
      else { assert.ok(e.isFile() && keys.has(path.relative(stage, file).replaceAll('\\', '/')), `Unexpected stage entry: ${file}`); files++ }
    }
  }
  await walk(stage)
  assert.equal(files, keys.size)
  assert.deepEqual(manifest.totals, { files, source_bytes: sourceBytes, deployed_bytes: deployedBytes })
  return manifest
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await verifyStructuredGzip(path.resolve(process.argv[2] || '.deploy/storage-compression/canary-manifest.json'))
  console.log('Verified structured gzip placement, decoded hashes, baseline binding and exact stage closure:', manifest.totals)
}
