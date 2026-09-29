import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { serveR2Resource } from '../functions/_shared/r2-resource.js'
import { isPreviewGzipCandidate, resolvePreviewObjectKey } from '../shared/deploy/PreviewAssetTransform.js'
import { encodeStructuredGzip, sha256 } from './lib/structured-gzip.mjs'

const nativeResponse = globalThis.Response
let init
globalThis.Response = class extends nativeResponse {
  constructor(body, options) { super(body, options); init = options }
}
try {
  for (const key of ['data/compiled/a.json', 'assets/lipsync/a.json', 'assets/live-chibi/motions/a.motion', 'assets/live-chibi/motions/a.bin']) {
    assert.equal(isPreviewGzipCandidate(key), true)
    assert.equal(resolvePreviewObjectKey(key), key, 'Rollout must default off')
    assert.equal(resolvePreviewObjectKey(key, { gzip: true }), `${key}.gz`)
    assert.equal(resolvePreviewObjectKey(`${key}.gz`, { gzip: true }), `${key}.gz`, 'No double encoding')
    const source = key.endsWith('.json') ? Buffer.from('{"test":"gzip source"}') : Buffer.from([0, 255, 128, 3, 3, 3, 0])
    const type = key.endsWith('.json') ? 'application/json' : 'application/octet-stream'
    const baseline = { request_key: key, source_size: source.length, source_sha256: sha256(source), source_content_type: type }
    const { encoded, entry } = encodeStructuredGzip(baseline, source)
    assert.deepEqual(encodeStructuredGzip(baseline, source).encoded, encoded, 'Deterministic encoding')
    const corrupted = Buffer.from(source); corrupted[0] ^= 1
    assert.throws(() => encodeStructuredGzip(baseline, corrupted), /Source hash drift/, 'Same-size drift must fail')
    const gets = [], heads = []
    let encoding = 'gzip', declaredType = type
    const env = { ARCHIVE_GZIP_MODE: 'all', ARCHIVE_ASSETS: {
      async head(objectKey) {
        heads.push(objectKey)
        return { size: encoded.length, httpEtag: `"${entry.deployed_sha256}"`,
          httpMetadata: { contentEncoding: encoding, contentType: declaredType },
          writeHttpMetadata(headers) { headers.set('Content-Encoding', encoding); headers.set('Content-Type', declaredType) } }
      },
      async get(objectKey, options) { gets.push({ objectKey, options }); return { body: encoded } },
    } }
    const call = (headers = {}, method = 'GET') => serveR2Resource({ env, prefix: key.split('/')[0],
      request: new Request(`https://canary.test/${key}`, { method, headers: { 'Accept-Encoding': 'gzip', ...headers } }) })
    let response = await call()
    assert.equal(response.status, 200)
    assert.equal(init.encodeBody, 'manual')
    assert.equal(response.headers.get('Content-Type'), type)
    assert.equal(response.headers.get('Content-Encoding'), 'gzip')
    assert.equal(response.headers.get('Content-Length'), String(encoded.length))
    assert.equal(response.headers.get('Accept-Ranges'), null)
    assert.equal(response.headers.get('Vary'), 'Accept-Encoding')
    assert.deepEqual(gunzipSync(Buffer.from(await response.arrayBuffer())), source)
    for (const range of ['bytes=0-2', 'bytes=9999999-', 'malformed']) {
      response = await call({ Range: range })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Content-Range'), null)
      assert.equal(gets.at(-1).options, undefined, 'No partial R2 get')
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), encoded)
    }
    response = await call({}, 'HEAD')
    assert.equal(response.status, 200)
    assert.equal((await response.arrayBuffer()).byteLength, 0)
    assert.equal(response.headers.get('Content-Length'), String(encoded.length))
    for (const validator of [`"${entry.deployed_sha256}"`, `W/"${entry.deployed_sha256}"`, `"other", "${entry.deployed_sha256}"`, '*']) {
      const before = gets.length
      response = await call({ 'If-None-Match': validator })
      assert.equal(response.status, 304)
      assert.equal(response.headers.get('Content-Length'), null)
      assert.equal(gets.length, before)
    }
    for (const accept of ['identity', '', 'br', 'gzip;q=0, *;q=1', '*;q=0']) {
      assert.equal((await call({ 'Accept-Encoding': accept })).status, 406)
    }
    for (const accept of ['gzip', 'br, gzip;q=0.5', '*', 'identity;q=0, gzip']) {
      assert.equal((await call({ 'Accept-Encoding': accept })).status, 200)
    }
    for (const original of ['identity', '', 'gzip;q=0', 'gzip']) {
      const request = new Request(`https://canary.test/${key}`, { headers: { 'Accept-Encoding': 'br, gzip' } })
      Object.defineProperty(request, 'cf', { value: { clientAcceptEncoding: original } })
      const edgeResponse = await serveR2Resource({ env, prefix: key.split('/')[0], request })
      assert.equal(edgeResponse.status, original === 'gzip' ? 200 : 406, 'Use original client encoding at the edge')
    }
    assert.ok(heads.every(k => k === `${key}.gz`))
    encoding = ''; assert.equal((await call()).status, 502); encoding = 'gzip'
    declaredType = 'text/plain'; assert.equal((await call()).status, 502); declaredType = type
    env.ARCHIVE_GZIP_MODE = 'canary'; env.ARCHIVE_GZIP_CANARY_KEYS = JSON.stringify([key])
    assert.equal((await call()).status, 200)
    env.ARCHIVE_GZIP_CANARY_KEYS = '[]'
    await call(); assert.equal(heads.at(-1), key, 'Unselected keys stay on the original representation')
    delete env.ARCHIVE_GZIP_MODE
    await call(); assert.equal(heads.at(-1), key)
  }
  for (const key of ['assets/voice/a.m4a', 'data/reading/a.json', 'data/compiled-extra/a.json', 'assets/lipsync/a.png', 'assets/live-chibi/motions/a.json', 'data/compiled/../a.json']) {
    assert.equal(isPreviewGzipCandidate(key), false, `Unexpected gzip scope: ${key}`)
  }
} finally { globalThis.Response = nativeResponse }
console.log('Structured gzip routing verified: rollout, metadata, manual body, gzip/identity negotiation, GET/HEAD/304, ignored Range, binary motions, source drift')
