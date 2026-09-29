import assert from 'node:assert/strict'
import { resolvePreviewObjectKey, isPreviewDataSnapshotKey } from '../shared/deploy/PreviewAssetTransform.js'
import { serveR2Resource } from '../functions/_shared/r2-resource.js'

const revision = 'a'.repeat(64)
const key = 'data/reading/example.json'
assert.equal(resolvePreviewObjectKey(key), key, 'Default deployment keeps existing data')
assert.equal(resolvePreviewObjectKey(key, { dataRevision: revision }), `versions/${revision}/${key}`)
assert.throws(() => resolvePreviewObjectKey(key, { dataRevision: '../unsafe' }), /Invalid data snapshot/)
for (const untouched of ['data/compiled/a.json', 'data/a.png', 'assets/lipsync/a.json', 'assets/voice/a.m4a']) {
  assert.equal(isPreviewDataSnapshotKey(untouched), false)
  assert.equal(resolvePreviewObjectKey(untouched, { dataRevision: revision }), resolvePreviewObjectKey(untouched))
}
assert.equal(resolvePreviewObjectKey('data/compiled/a.json', { gzip: true, dataRevision: revision }), 'data/compiled/a.json.gz')
let requested
const env = { ARCHIVE_DATA_REVISION: revision, ARCHIVE_ASSETS: {
  async head(k) { requested = k; return k.startsWith('versions/') ? { size: 2, httpMetadata: { contentType: 'application/json' } } : null },
  async get(k) { assert.equal(k, requested); return { body: '{}' } },
} }
let response = await serveR2Resource({ request: new Request(`https://test/${key}`), env, prefix: 'data' })
assert.equal(requested, `versions/${revision}/${key}`)
assert.equal(response.status, 200); assert.equal(await response.text(), '{}')
// Missing versioned data must not silently mix in the shared old corpus.
env.ARCHIVE_ASSETS.head = async k => { requested = k; return null }
response = await serveR2Resource({ request: new Request(`https://test/${key}`), env, prefix: 'data' })
assert.equal(response.status, 404); assert.equal(requested, `versions/${revision}/${key}`)
console.log('Data revision routing verified: opt-in isolation, gzip coexistence, missing snapshot fails closed')
