import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PREVIEW_WEBP_EXCLUDED_PREFIXES,
  COPY_TRANSFORM,
  LOSSLESS_WEBP_TRANSFORM,
  isPreviewLosslessWebpCandidate,
  resolvePreviewObjectKey,
  previewTransformKind,
} from '../shared/deploy/PreviewAssetTransform.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const manifest = JSON.parse(await fs.readFile(path.join(root, '.deploy', 'r2-manifest.json'), 'utf8'))
assert.equal(manifest.schema_version, 2, 'The transform policy check needs a schema v2 manifest; export first')

// Every excluded prefix must be a real staging prefix; a typo here would
// silently transform a domain that was meant to stay PNG.
const stagedPrefixes = new Set(manifest.entries.map(entry => entry.request_key.split('/').slice(0, 2).join('/') + '/'))
for (const prefix of PREVIEW_WEBP_EXCLUDED_PREFIXES) {
  assert.ok(stagedPrefixes.has(prefix), `Excluded prefix matches nothing in the corpus: ${prefix}`)
  assert.ok(prefix.endsWith('/'), `Excluded prefixes must end with a slash: ${prefix}`)
}
assert.ok(PREVIEW_WEBP_EXCLUDED_PREFIXES.includes('assets/brand/'), 'brand PNG must stay untransformed as the PNG control probe')

// The load-bearing coverage check: after this pass no PNG may remain untransformed
// except the named exclusions. Without it a prefix added to the corpus later would
// silently keep serving PNG while the Function resolved it to `.webp` and 404ed.
const PNG = /\.png$/i
const uncovered = manifest.entries.filter(entry => PNG.test(entry.request_key)
  && resolvePreviewObjectKey(entry.request_key) === entry.request_key
  && !PREVIEW_WEBP_EXCLUDED_PREFIXES.some(prefix => entry.request_key.startsWith(prefix)))
assert.equal(uncovered.length, 0, `Untransformed PNGs outside the exclusion list: ${uncovered.slice(0, 5).map(item => item.request_key).join(', ')}`)

const transformedByPrefix = new Map()
for (const entry of manifest.entries) {
  if (PNG.test(entry.request_key) && resolvePreviewObjectKey(entry.request_key) !== entry.request_key) {
    const prefix = entry.request_key.split('/').slice(0, 2).join('/')
    transformedByPrefix.set(prefix, (transformedByPrefix.get(prefix) || 0) + 1)
  }
}
assert.ok(transformedByPrefix.size >= 4, `Expected the transform to cover several domains, found ${transformedByPrefix.size}`)

assert.equal(resolvePreviewObjectKey('assets/card-art/portrait/card.png'), 'assets/card-art/portrait/card.webp')
assert.equal(resolvePreviewObjectKey('assets/spines/001/chara.png'), 'assets/spines/001/chara.webp')
assert.equal(resolvePreviewObjectKey('assets/live-chibi/costumes/x/cos.png'), 'assets/live-chibi/costumes/x/cos.webp')
assert.equal(resolvePreviewObjectKey('assets/bg/room.png'), 'assets/bg/room.webp', 'backgrounds are now in scope')
assert.equal(resolvePreviewObjectKey('assets/cards/icons/i.png'), 'assets/cards/icons/i.webp')
assert.equal(resolvePreviewObjectKey('data/fx_extracted/tex.png'), 'data/fx_extracted/tex.webp', 'data PNGs are in scope')
assert.equal(resolvePreviewObjectKey('assets/card-art/portrait/CARD.PNG'), 'assets/card-art/portrait/CARD.webp', 'extension match must be case-insensitive')
assert.equal(resolvePreviewObjectKey('assets/brand/logo.png'), 'assets/brand/logo.png', 'brand must keep identity as the control probe')
assert.equal(resolvePreviewObjectKey('assets/card-art/portrait/card.jpg'), 'assets/card-art/portrait/card.jpg', 'only PNG is transformed')
assert.equal(resolvePreviewObjectKey('data/compiled/x.json'), 'data/compiled/x.json', 'JSON is never transformed')
assert.equal(resolvePreviewObjectKey('assets/spines/a/comu.atlas'), 'assets/spines/a/comu.atlas', 'atlas text is never transformed')
assert.equal(previewTransformKind('assets/bg/room.png'), LOSSLESS_WEBP_TRANSFORM)
assert.equal(previewTransformKind('assets/spines/a/comu.atlas'), COPY_TRANSFORM)
assert.equal(isPreviewLosslessWebpCandidate('assets/spines/a/texture.webp'), false, 'an existing WebP must not be re-resolved')
// Idempotence: resolving twice must not produce a different key.
for (const key of ['assets/spines/a/texture.png', 'assets/brand/logo.png']) {
  assert.equal(resolvePreviewObjectKey(resolvePreviewObjectKey(key)), resolvePreviewObjectKey(key), `Resolution is not idempotent for ${key}`)
}

// The exporter and the Pages Function must both defer to this module rather
// than re-implementing the policy, or the two sides can drift apart.
const read = file => fs.readFile(path.join(root, file), 'utf8')
const exporter = await read('scripts/export-preview-assets.mjs')
const fn = await read('functions/_shared/r2-resource.js')
for (const [name, source, importPath] of [
  ['exporter', exporter, '../shared/deploy/PreviewAssetTransform.js'],
  ['functions', fn, '../../shared/deploy/PreviewAssetTransform.js'],
]) {
  assert.ok(source.includes(importPath), `${name} must import the shared transform module (${importPath})`)
  assert.ok(source.includes('resolvePreviewObjectKey'), `${name} must call resolvePreviewObjectKey`)
  assert.ok(!/\.png['"]?\s*\)?\s*\.replace\([^)]*webp/i.test(source) || source.includes('resolvePreviewObjectKey'), `${name} must not hand-roll PNG->WebP rewriting`)
}
// The Function must not infer the content type from the extension in the URL,
// which is `.png` even when the physical object is WebP.
assert.ok(/contentType\(objectKey/.test(fn), 'the Function must derive Content-Type from the object key')
assert.ok(!/bucket\.(head|get)\(requestKey/.test(fn), 'the Function must never read the bucket with the request key')

const domains = [...transformedByPrefix.entries()].sort((a, b) => b[1] - a[1])
console.log(`Preview transform policy verified: all PNGs converted across ${domains.length} domains, excluding only ${PREVIEW_WEBP_EXCLUDED_PREFIXES.join(', ')}`)
console.log(`  ${domains.map(([prefix, count]) => `${prefix} ${count}`).join('  ')}`)
