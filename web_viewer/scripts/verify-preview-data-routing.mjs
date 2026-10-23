import assert from 'node:assert/strict'
import { resolvePreviewObjectKey, isPreviewDataSnapshotKey, isPreviewCompiledSnapshotKey } from '../shared/deploy/PreviewAssetTransform.js'
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
// Compiled stories: only a deployment that pins ARCHIVE_COMPILED_REVISION leaves the shared corpus.
const compiled = 'data/compiled/1_1_001_01.json', compiledRevision = 'b'.repeat(64)
assert.equal(isPreviewCompiledSnapshotKey(compiled), true)
for (const other of [key, 'data/compiled/a.png', 'data/compiledx/a.json', 'assets/lipsync/a.json', 'data/compiled/../a.json']) {
  assert.equal(isPreviewCompiledSnapshotKey(other), false, other)
}
assert.equal(resolvePreviewObjectKey(compiled, { gzip: true, dataRevision: revision }), `${compiled}.gz`, 'Unpinned deployments keep the shared key')
assert.equal(resolvePreviewObjectKey(compiled, { gzip: true, dataRevision: revision, compiledRevision }),
  `versions/compiled/${compiledRevision}/${compiled}.gz`)
assert.equal(resolvePreviewObjectKey(compiled, { compiledRevision }), `versions/compiled/${compiledRevision}/${compiled}`)
assert.equal(resolvePreviewObjectKey(key, { dataRevision: revision, compiledRevision }), `versions/${revision}/${key}`, 'Data snapshot keys ignore the compiled revision')
assert.equal(resolvePreviewObjectKey('assets/voice/a.m4a', { compiledRevision }), 'assets/voice/a.m4a')
assert.throws(() => resolvePreviewObjectKey(compiled, { compiledRevision: '../unsafe' }), /Invalid compiled snapshot/)
const gzipHead = k => ({ size: 2, httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' } })
for (const [compiledEnv, expected] of [[undefined, `${compiled}.gz`], [compiledRevision, `versions/compiled/${compiledRevision}/${compiled}.gz`]]) {
  const store = { async head(k) { requested = k; return k === expected ? gzipHead(k) : null }, async get(k) { return { body: '{}' } } }
  response = await serveR2Resource({ request: new Request(`https://test/${compiled}`, { headers: { 'Accept-Encoding': 'gzip' } }),
    env: { ARCHIVE_DATA_REVISION: revision, ARCHIVE_GZIP_MODE: 'all', ARCHIVE_COMPILED_REVISION: compiledEnv, ARCHIVE_ASSETS: store }, prefix: 'data' })
  assert.equal(requested, expected); assert.equal(response.status, 200)
}
// A pinned deployment whose compiled snapshot is absent fails closed instead of reading the shared corpus.
response = await serveR2Resource({ request: new Request(`https://test/${compiled}`, { headers: { 'Accept-Encoding': 'gzip' } }),
  env: { ARCHIVE_DATA_REVISION: revision, ARCHIVE_GZIP_MODE: 'all', ARCHIVE_COMPILED_REVISION: compiledRevision,
    ARCHIVE_ASSETS: { async head(k) { requested = k; return k.startsWith('versions/compiled/') ? null : gzipHead(k) } } }, prefix: 'data' })
assert.equal(response.status, 404); assert.equal(requested, `versions/compiled/${compiledRevision}/${compiled}.gz`)
console.log('Data revision routing verified: opt-in isolation, gzip coexistence, missing snapshot fails closed; compiled snapshot opt-in')
