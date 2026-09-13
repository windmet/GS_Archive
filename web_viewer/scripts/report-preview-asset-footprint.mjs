import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Measures the archived runtime corpus before any deployment transform runs.
 * Reads a manifest only; it never reads the staged objects themselves.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(root, '.deploy')
const preWebpPath = path.join(outputRoot, 'r2-manifest.pre-webp.json')
const currentPath = path.join(outputRoot, 'r2-manifest.json')
const reportPath = path.join(outputRoot, 'r2-footprint-pre-webp.json')

async function exists(file) {
  try { await fs.access(file); return true } catch { return false }
}

const source = await exists(preWebpPath) ? preWebpPath : currentPath
if (!(await exists(source))) throw new Error(`No manifest to measure; run the exporter first: ${source}`)
const manifest = JSON.parse(await fs.readFile(source, 'utf8'))

// Schema v1 wrote `key`/`size`; v2 splits request from object and renames the
// size fields. Read both so this stays a before/after comparison tool.
const entries = manifest.entries.map(entry => ({
  key: entry.request_key ?? entry.key,
  size: entry.source_size ?? entry.size,
}))
const missing = manifest.missing.map(entry => ({ key: entry.request_key ?? entry.key }))

function extensionOf(key) {
  const base = key.slice(key.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '(none)' : base.slice(dot).toLowerCase()
}
function bytesToMiB(bytes) { return Number((bytes / 1024 / 1024).toFixed(2)) }

const total = { files: 0, bytes: 0 }
const byExtension = new Map()
const byPrefix = new Map()
const addTo = (map, name, entry) => {
  const bucket = map.get(name) || { name, files: 0, bytes: 0, png_files: 0, png_bytes: 0 }
  bucket.files++
  bucket.bytes += entry.size
  if (extensionOf(entry.key) === '.png') { bucket.png_files++; bucket.png_bytes += entry.size }
  map.set(name, bucket)
}
for (const entry of entries) {
  total.files++
  total.bytes += entry.size
  addTo(byExtension, extensionOf(entry.key), entry)
  const segments = entry.key.split('/')
  for (let depth = 1; depth <= Math.min(3, segments.length - 1); depth++) {
    addTo(byPrefix, segments.slice(0, depth).join('/') + '/', entry)
  }
}

const withShare = map => [...map.values()]
  .sort((a, b) => b.bytes - a.bytes)
  .map(item => ({ ...item, MiB: bytesToMiB(item.bytes), share_of_total: Number((item.bytes / total.bytes).toFixed(4)) }))

const report = {
  schema_version: manifest.schema_version,
  measured_from: path.relative(root, source).replaceAll('\\', '/'),
  total: { ...total, MiB: bytesToMiB(total.bytes), GiB: Number((total.bytes / 1024 ** 3).toFixed(3)) },
  by_extension: withShare(byExtension),
  by_prefix: withShare(byPrefix),
  missing: { count: missing.length, by_prefix: Object.fromEntries([...new Set(missing.map(item => item.key.split('/').slice(0, 3).join('/')))].map(prefix => [prefix, missing.filter(item => item.key.startsWith(prefix + '/')).length])) },
}

await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')

const perExtension = new Map(report.by_extension.map(item => [item.name, item]))
const perPrefix = new Map(report.by_prefix.map(item => [item.name, item]))
const png = perExtension.get('.png') || { files: 0, bytes: 0, MiB: 0 }
const format = item => `${String(item.files).padStart(7)} files  ${String(item.MiB).padStart(10)} MiB  ${(item.share_of_total * 100).toFixed(2).padStart(6)}%`

console.log(`Footprint from ${report.measured_from}`)
console.log(`\nBy extension (top 15 of ${report.by_extension.length}):`)
for (const item of report.by_extension.slice(0, 15)) console.log(`  ${item.name.padEnd(10)} ${format(item)}`)
console.log('\nBy prefix (2 segments, PNG share shown):')
for (const item of report.by_prefix.filter(entry => entry.name.split('/').length === 3)) {
  console.log(`  ${item.name.padEnd(24)} ${format(item)}   png ${String(item.png_files).padStart(6)} files ${String(bytesToMiB(item.png_bytes)).padStart(9)} MiB`)
}
console.log('\nTotal' + `\n  files ${report.total.files}\n  bytes ${report.total.bytes}\n  GiB   ${report.total.GiB}\n  PNG   ${png.files} files / ${png.MiB} MiB / ${(png.share_of_total * 100).toFixed(2)}% of corpus`)
console.log(`\nMissing runtime keys: ${report.missing.count}`)
for (const [prefix, count] of Object.entries(report.missing.by_prefix)) console.log(`  ${prefix}/ ${count}`)
if (png.bytes) console.log(`\nRough guidance only: at the historical SSR ratio of ~65% retained, the full PNG corpus would land near ${bytesToMiB(Math.round(png.bytes * 0.65))} MiB (saving ~${bytesToMiB(Math.round(png.bytes * 0.35))} MiB). This is an estimate; the real number comes from the exporter.`)
console.log(`\nReport written to ${path.relative(root, reportPath).replaceAll('\\', '/')}`)
