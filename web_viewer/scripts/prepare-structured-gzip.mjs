import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib'
import { performance } from 'node:perf_hooks'
import { PREVIEW_GZIP_PREFIXES, isPreviewGzipCandidate } from '../shared/deploy/PreviewAssetTransform.js'
import { encodeStructuredGzip, sha256 } from './lib/structured-gzip.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, '.deploy/storage-compression')
const mode = process.argv[2]
assert.ok(['--canary', '--full'].includes(mode), 'Use --canary or --full (after acceptance)')
const baselineBytes = await fs.readFile(path.join(directory, 'source-baseline.json'))
const baseline = JSON.parse(baselineBytes)
assert.equal(baseline.kind, 'source-baseline')
const baselineHash = sha256(baselineBytes)
const candidates = baseline.entries.filter(e => isPreviewGzipCandidate(e.request_key))
const selected = new Map()
const pinFile = process.argv[3]
if (mode === '--canary') {
  // Optional keys pin actual Story/Reading/Chibi journeys, then size quantiles
  // fill the remaining slots. At most 30 per domain keeps this a small canary.
  const pinned = pinFile ? JSON.parse(await fs.readFile(path.resolve(pinFile), 'utf8')) : []
  assert.ok(Array.isArray(pinned) && pinned.every(isPreviewGzipCandidate), 'Invalid pinned keys')
  for (const key of pinned) {
    const entry = candidates.find(e => e.request_key === key)
    assert.ok(entry, `Pinned source missing: ${key}`)
    selected.set(key, entry)
  }
  for (const prefix of PREVIEW_GZIP_PREFIXES) {
    const rows = candidates.filter(e => e.request_key.startsWith(prefix))
      .sort((a, b) => a.source_size - b.source_size || a.request_key.localeCompare(b.request_key))
    const count = () => [...selected.keys()].filter(k => k.startsWith(prefix)).length
    assert.ok(rows.length >= 20 && count() <= 30, `Invalid canary domain: ${prefix}`)
    for (let i = 0; i < 30 && count() < Math.max(20, pinned.filter(k => k.startsWith(prefix)).length); i++) {
      const entry = rows[Math.round(i * (rows.length - 1) / 29)]
      selected.set(entry.request_key, entry)
    }
  }
} else {
  const acceptance = JSON.parse(await fs.readFile(path.join(directory, 'canary-acceptance.json'), 'utf8'))
  const canaryBytes = await fs.readFile(path.join(directory, 'canary-manifest.json'))
  assert.equal(acceptance.baseline_sha256, baselineHash, 'Acceptance belongs to another baseline')
  assert.equal(acceptance.canary_manifest_sha256, sha256(canaryBytes), 'Canary changed after acceptance')
  assert.equal(acceptance.http_passed, true)
  assert.equal(acceptance.browser_passed, true)
  assert.ok(acceptance.evidence && acceptance.environment, 'Acceptance must identify actual evidence/environment')
  for (const entry of candidates) selected.set(entry.request_key, entry)
}
const name = mode === '--canary' ? 'canary' : 'structured'
const stageRoot = path.join(directory, name)
await fs.mkdir(directory, { recursive: true })
assert.equal(await fs.realpath(directory), directory, 'Refusing redirected output')
// Do not erase an old candidate or accepted package on rerun.
await fs.mkdir(stageRoot)
const entries = [], benchmark = {}
for (const entry of selected.values()) {
  const source = await fs.readFile(path.resolve(root, entry.source))
  const start = performance.now()
  const result = encodeStructuredGzip(entry, source)
  const gzipMs = performance.now() - start
  if (mode === '--canary') {
    const brStart = performance.now()
    const br = brotliCompressSync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } })
    const brMs = performance.now() - brStart
    assert.deepEqual(brotliDecompressSync(br), source)
    const prefix = PREVIEW_GZIP_PREFIXES.find(p => entry.request_key.startsWith(p))
    const group = benchmark[prefix] ||= { files: 0, source_bytes: 0, gzip_bytes: 0, brotli_bytes: 0, gzip_ms: 0, brotli_ms: 0 }
    group.files++; group.source_bytes += source.length; group.gzip_bytes += result.encoded.length
    group.brotli_bytes += br.length; group.gzip_ms += gzipMs; group.brotli_ms += brMs
  }
  const target = path.join(stageRoot, result.entry.object_key)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, result.encoded, { flag: 'wx' })
  entries.push(result.entry)
  if (entries.length % 5000 === 0) console.log(`gzip ${entries.length}/${selected.size}`)
}
const manifest = { schema_version: 3, kind: `structured-gzip-${name}`, baseline_sha256: baselineHash,
  source_head: baseline.head, created_at: new Date().toISOString(), stage: name,
  // This is a delta, NOT a complete deployable package; unchanged objects and
  // current non-gzip data still require reconciliation before any live switch.
  scope: 'structured-gzip-delta', missing_dependencies: baseline.missing,
  totals: { files: entries.length, source_bytes: entries.reduce((s, e) => s + e.source_size, 0),
    deployed_bytes: entries.reduce((s, e) => s + e.deployed_size, 0) }, entries, benchmark }
await fs.writeFile(path.join(directory, `${name}-manifest.json`), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ mode, totals: manifest.totals, benchmark }, null, 2))
