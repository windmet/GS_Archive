import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { resolvePreviewObjectKey } from '../shared/deploy/PreviewAssetTransform.js'
import { encodeLosslessWebp, runPool, shutdownEncoderPool } from './lib/lossless-webp.mjs'

/**
 * Second-stage audit of the PNG corpus the first WebP pass deliberately left
 * alone. Read-only against the archive: it decodes sources to classify alpha
 * and writes only a small temporary sample to measure a likely encode ratio.
 *
 * Scope: the numbers under "remaining" cover ONLY the untransformed PNGs. The
 * already-converted domains are reported separately as context so their savings
 * are never counted twice.
 *
 * Usage: node scripts/report-preview-remaining-png.mjs [sampleSize]
 *   PREVIEW_MANIFEST=.deploy/r2-manifest.pre-webp.json  overrides the manifest
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = process.env.PREVIEW_MANIFEST
  ? path.resolve(root, process.env.PREVIEW_MANIFEST)
  : path.join(root, '.deploy', 'r2-manifest.json')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const sampleSize = Number(process.argv[2] || 12)

// Schema v1 wrote `key`/`size`; v2 splits request from object and renames the
// size fields. Normalize so this reads either shape.
const PNG = /\.png$/i
const entries = manifest.entries.map(entry => ({
  key: entry.request_key ?? entry.key,
  size: entry.source_size ?? entry.size,
  source: entry.source,
}))

const corpus = entries.filter(entry => PNG.test(entry.key))
const remaining = corpus
  .filter(entry => resolvePreviewObjectKey(entry.key) === entry.key)
  .sort((a, b) => b.size - a.size)
const converted = corpus.filter(entry => resolvePreviewObjectKey(entry.key) !== entry.key)

const MiB = bytes => Number((bytes / 1024 ** 2).toFixed(2))
const sum = list => list.reduce((total, entry) => total + entry.size, 0)
const prefixOf = key => key.split('/').slice(0, 2).join('/') + '/'
const directoryOf = key => key.slice(0, key.lastIndexOf('/') + 1)

// `keyOf` receives the key itself, not the entry.
function group(list, keyOf) {
  const map = new Map()
  for (const entry of list) {
    const name = keyOf(entry.key)
    const bucket = map.get(name) || { name, files: 0, bytes: 0 }
    bucket.files++
    bucket.bytes += entry.size
    map.set(name, bucket)
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes)
}

if (!remaining.length) throw new Error('No untransformed PNG entries found; check the manifest')

// Alpha classification.
//
// A PNG can carry an alpha channel that is never anything but 255, which is
// functionally as opaque as a 3-channel image and therefore as safe to convert;
// only genuinely partial alpha needs scrutiny. `alphaMin` is the decisive
// number, so the classes are keyed on it directly:
//   255           fully opaque (with or without an alpha channel)
//   0 < min < 255 partial transparency - the risky class
//   0             true transparency, where the alpha==0 RGB cleanup applies
async function classify(entry) {
  const meta = await sharp(entry.source, { failOn: 'error' }).metadata()
  if (!meta.hasAlpha) return { ...entry, width: meta.width, height: meta.height, klass: 'opaque-no-channel', alphaMin: 255, alphaMax: 255 }
  const stats = await sharp(entry.source, { failOn: 'error' }).stats()
  const alpha = stats.channels[stats.channels.length - 1]
  const klass = alpha.min === 255 ? 'opaque-min-255' : alpha.min === 0 ? 'transparent-min-0' : 'partial-min-1-to-254'
  return { ...entry, width: meta.width, height: meta.height, klass, alphaMin: alpha.min, alphaMax: alpha.max }
}

const classified = await runPool(remaining, 4, async entry => {
  try { return await classify(entry) } catch (error) { return { ...entry, klass: 'unreadable', error: String(error.message).slice(0, 80) } }
})

// The three classes the background decision hinges on. A channel-less PNG is
// folded into the 255 group because that is what it decodes to.
const ALPHA_GROUPS = [
  { label: 'alphaMin = 255 (fully opaque)', test: entry => entry.klass === 'opaque-min-255' || entry.klass === 'opaque-no-channel' },
  { label: '0 < alphaMin < 255 (partial)', test: entry => entry.klass === 'partial-min-1-to-254' },
  { label: 'alphaMin = 0 (true transparent)', test: entry => entry.klass === 'transparent-min-0' },
]
function rollup(list) {
  const rows = ALPHA_GROUPS.map(({ label, test }) => {
    const matched = list.filter(test)
    return { label, files: matched.length, bytes: sum(matched), MiB: MiB(sum(matched)) }
  })
  const other = list.filter(entry => !ALPHA_GROUPS.some(({ test }) => test(entry)))
  if (other.length) rows.push({ label: 'unreadable', files: other.length, bytes: sum(other), MiB: MiB(sum(other)) })
  return rows
}
const classRollup = list => {
  const map = new Map()
  for (const entry of list) {
    const bucket = map.get(entry.klass) || { klass: entry.klass, files: 0, bytes: 0 }
    bucket.files++
    bucket.bytes += entry.size
    map.set(entry.klass, bucket)
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes)
}

const backgrounds = classified.filter(entry => entry.key.startsWith('assets/bg/'))
const nonBackground = classified.filter(entry => !entry.key.startsWith('assets/bg/'))
const bgTotalBytes = sum(backgrounds)

// Representative encode sample: proportionate across alpha classes, spread over
// the size range within each, so the estimate is not skewed by one huge file.
const sample = []
for (const { test } of ALPHA_GROUPS) {
  const pool = backgrounds.filter(test).sort((a, b) => b.size - a.size)
  if (!pool.length) continue
  const want = Math.max(1, Math.round((sum(pool) / (bgTotalBytes || 1)) * sampleSize))
  const step = Math.max(1, Math.floor(pool.length / want))
  sample.push(...pool.filter((_, index) => index % step === 0).slice(0, want))
}

const sampleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sidem-bg-sample-'))
const encoded = await runPool(sample, 4, async (entry, index) => {
  const target = path.join(sampleDir, `${index}-${path.basename(entry.key)}.webp`)
  const result = await encodeLosslessWebp({ source: entry.source, target })
  return { key: entry.key, klass: entry.klass, source: entry.size, deployed: (await fs.stat(target)).size, alphaClearedPixels: result.alphaClearedPixels }
})

const simple = list => list.map(item => ({ ...item, MiB: MiB(item.bytes) }))
const report = {
  generated_from: path.relative(root, manifestPath).replaceAll('\\', '/'),
  scope: 'remaining = untransformed PNGs only; converted = first pass, listed for context and NOT part of the savings below',
  full_png_corpus: { files: corpus.length, bytes: sum(corpus), MiB: MiB(sum(corpus)) },
  already_converted: { files: converted.length, bytes: sum(converted), MiB: MiB(sum(converted)) },
  remaining_png: { files: remaining.length, bytes: sum(remaining), MiB: MiB(sum(remaining)) },
  remaining_by_prefix: simple(group(remaining, prefixOf)),
  remaining_by_alpha_class: simple(classRollup(classified)),
  remaining_alpha_rollup: rollup(classified),
  background: {
    files: backgrounds.length,
    bytes: bgTotalBytes,
    MiB: MiB(bgTotalBytes),
    by_alpha_group: rollup(backgrounds),
    by_alpha_class: simple(classRollup(backgrounds)),
  },
  non_background: {
    files: nonBackground.length,
    bytes: sum(nonBackground),
    MiB: MiB(sum(nonBackground)),
    by_prefix: simple(group(nonBackground, prefixOf)),
    by_alpha_group: rollup(nonBackground),
  },
  largest_directories: simple(group(remaining, directoryOf)).slice(0, 12),
  largest_files: remaining.slice(0, 12).map(entry => ({ key: entry.key, MiB: MiB(entry.size), bytes: entry.size })),
  background_sample: encoded.map(item => ({ ...item, MiB: MiB(item.source), deployedMiB: MiB(item.deployed), retained: Number((item.deployed / item.source).toFixed(4)) })),
}
const reportPath = path.join(root, '.deploy', 'r2-footprint-remaining-png.json')
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')

const bytes = value => String(MiB(value)).padStart(9)
console.log(`Scope: the figures below are the REMAINING (untransformed) PNGs, not the whole corpus.`)
console.log(`  full PNG corpus      ${String(corpus.length).padStart(5)} files ${bytes(sum(corpus))} MiB`)
console.log(`  already converted    ${String(converted.length).padStart(5)} files ${bytes(sum(converted))} MiB   (first pass; not counted as remaining)`)
console.log(`  remaining            ${String(remaining.length).padStart(5)} files ${bytes(sum(remaining))} MiB   <- everything below is this set\n`)

console.log('Remaining PNG by prefix:')
for (const item of group(remaining, prefixOf)) console.log(`  ${item.name.padEnd(24)} ${String(item.files).padStart(5)} files ${bytes(item.bytes)} MiB`)

console.log('\nRemaining PNG by alpha class:')
for (const item of classRollup(classified)) console.log(`  ${item.klass.padEnd(22)} ${String(item.files).padStart(5)} files ${bytes(item.bytes)} MiB`)

console.log('\nBACKGROUNDS  (assets/bg/)')
console.log(`  total ${backgrounds.length} files, ${MiB(bgTotalBytes)} MiB`)
for (const item of rollup(backgrounds)) console.log(`  ${item.label.padEnd(34)} ${String(item.files).padStart(4)} files ${bytes(item.bytes)} MiB`)

console.log('\nNon-background prefixes:')
for (const item of report.non_background.by_prefix) console.log(`  ${item.name.padEnd(24)} ${String(item.files).padStart(5)} files ${bytes(item.bytes)} MiB`)
console.log('Non-background by alpha group:')
for (const item of report.non_background.by_alpha_group) console.log(`  ${item.label.padEnd(34)} ${String(item.files).padStart(4)} files ${bytes(item.bytes)} MiB`)

console.log('\nLargest directories:')
for (const item of report.largest_directories) console.log(`  ${bytes(item.bytes)} MiB  ${String(item.files).padStart(5)} files  ${item.name}`)
console.log('\nLargest files:')
for (const item of report.largest_files) console.log(`  ${bytes(item.bytes)} MiB  ${item.key}`)

if (encoded.length) {
  // Encoded items carry `source`/`deployed`, not `size`; sum() reads `size`.
  const inBytes = encoded.reduce((total, item) => total + item.source, 0)
  const outBytes = encoded.reduce((total, item) => total + item.deployed, 0)
  const ratio = outBytes / inBytes
  console.log(`\nBackground lossless-WebP sample (${encoded.length} files):`)
  for (const item of [...encoded].sort((a, b) => b.source - a.source)) {
    console.log(`  ${String(MiB(item.source)).padStart(8)} -> ${String(MiB(item.deployed)).padStart(8)} MiB  ${(item.deployed / item.source * 100).toFixed(1).padStart(5)}%  ${item.klass.padEnd(18)} ${item.key.slice('assets/bg/'.length)}`)
  }
  console.log(`  sample total ${MiB(inBytes)} -> ${MiB(outBytes)} MiB (${(ratio * 100).toFixed(1)}% retained)`)
  console.log(`\n  Extrapolated to all ${backgrounds.length} backgrounds: ${MiB(bgTotalBytes)} MiB -> ~${MiB(bgTotalBytes * ratio)} MiB (saving ~${MiB(bgTotalBytes * (1 - ratio))} MiB)`)
  console.log('  Extrapolation is indicative only; exact figures come from a real export.')
  for (const { label, test } of ALPHA_GROUPS) {
    const pool = backgrounds.filter(test)
    if (!pool.length) continue
    const subset = encoded.filter(item => pool.some(entry => entry.key === item.key))
    if (!subset.length) continue
    const sub = subset.reduce((total, item) => total + item.deployed, 0) / subset.reduce((total, item) => total + item.source, 0)
    const total = sum(pool)
    console.log(`    ${label.padEnd(34)} ${MiB(total)} -> ~${MiB(total * sub)} MiB (${(sub * 100).toFixed(1)}%)`)
  }
}
console.log(`\nReport written to ${path.relative(root, reportPath).replaceAll('\\', '/')}`)

// Cleanup last, and never fatal: libvips can still hold a handle on a file it
// just wrote on Windows, and that must not discard an otherwise complete audit.
try { await fs.rm(sampleDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }) }
catch (error) { console.warn(`Note: could not remove ${sampleDir} (${error.code}); harmless`) }

// Live encoder children keep the event loop non-empty, so the report would
// otherwise print everything and then never exit.
shutdownEncoderPool()
