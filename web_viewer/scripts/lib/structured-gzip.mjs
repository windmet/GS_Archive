import { gzipSync, gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { isPreviewGzipCandidate, resolvePreviewObjectKey, previewTransformKind } from '../../shared/deploy/PreviewAssetTransform.js'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

export function encodeStructuredGzip(entry, source) {
  assert.ok(isPreviewGzipCandidate(entry.request_key), `Outside gzip allowlist: ${entry.request_key}`)
  assert.equal(source.length, entry.source_size, `Source size drift: ${entry.request_key}`)
  assert.equal(sha256(source), entry.source_sha256, `Source hash drift: ${entry.request_key}`)
  if (entry.request_key.endsWith('.json')) JSON.parse(source.toString('utf8'))
  const encoded = gzipSync(source, { level: 9 })
  assert.deepEqual(gunzipSync(encoded), source, `gzip round-trip: ${entry.request_key}`)
  return { encoded, entry: { ...entry,
    object_key: resolvePreviewObjectKey(entry.request_key, { gzip: true }),
    transform: previewTransformKind(entry.request_key, { gzip: true }),
    deployed_size: encoded.length, deployed_sha256: sha256(encoded),
    deployed_content_type: entry.source_content_type, deployed_content_encoding: 'gzip',
  } }
}
