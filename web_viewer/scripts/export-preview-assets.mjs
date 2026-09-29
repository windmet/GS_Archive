import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { resolvePreviewObjectKey, previewTransformKind, COPY_TRANSFORM } from '../shared/deploy/PreviewAssetTransform.js'
import { encodeLosslessWebp, runPool, shutdownEncoderPool } from './lib/lossless-webp.mjs'
import { createArchiveAssetResolver } from './lib/archive-assets.mjs'
import { getBgmUrl, getSeUrl, getAmbientUrl, getLipSyncUrl } from '../src/utils/AssetResolver.js'
import { getCardPortraitUrl, getCardLandscapeUrl } from '../src/utils/CardAssetResolver.js'
import { writeSourceBaseline } from './lib/preview-source-baseline.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(root, 'public')
const outputRoot = path.join(root, '.deploy')
const stageRoot = path.join(outputRoot, 'r2')
const manifestPath = path.join(outputRoot, 'r2-manifest.json')
const mode = process.argv[2]
if (!['--audit', '--export', '--baseline'].includes(mode)) throw new Error('Use --audit, --export or --baseline')
const allowMissing = process.argv.includes('--allow-missing')

function safeKey(url) {
  const key = url.replace(/^\//, '')
  if (!/^(assets|data)\//.test(key) || key.split('/').some(part => !part || part === '.' || part === '..' || part.includes('\\'))) {
    throw new Error(`Unsafe runtime URL: ${url}`)
  }
  return key
}
function typeFor(key) {
  const ext = path.extname(key).toLowerCase()
  return ({ '.atlas': 'text/plain', '.css': 'text/css', '.gif': 'image/gif', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.json': 'application/json', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg', '.png': 'image/png', '.skel': 'application/octet-stream',
    '.svg': 'image/svg+xml', '.webp': 'image/webp' })[ext] || 'application/octet-stream'
}
async function isFile(file) {
  try { return (await fs.lstat(file)).isFile() } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}
const files = new Map()
const missing = new Map()
async function add(url, source, provenance) {
  const key = safeKey(url)
  if (files.has(key)) return
  if (!source || !(await isFile(source))) { if (!missing.has(key)) missing.set(key, { request_key: key, provenance }); return }
  const stat = await fs.stat(source)
  files.set(key, { request_key: key, source, size: stat.size, 'content-type': typeFor(key), provenance })
}
async function walk(dir, prefix) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name)
    const key = `${prefix}/${entry.name}`
    if (entry.isDirectory()) await walk(absolute, key)
    else if (entry.isFile()) await add(`/${key.replaceAll('\\', '/')}`, absolute, 'public')
    else throw new Error(`Unexpected link or special file in public corpus: ${absolute}`)
  }
}
for (const prefix of ['assets', 'data']) await walk(path.join(publicRoot, prefix), prefix)

const resolver = createArchiveAssetResolver()
async function addExternal(url, candidatePaths, provenance) {
  const key = safeKey(url)
  if (files.has(key)) return
  let source = null
  for (const candidate of candidatePaths.filter(Boolean)) {
    if (await isFile(candidate)) { source = candidate; break }
  }
  await add(url, source, provenance)
}

const compiledRoot = path.join(publicRoot, 'data', 'compiled')
let plans = 0
async function scanPlans(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { await scanPlans(file); continue }
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const scenario = JSON.parse(await fs.readFile(file, 'utf8'))
    if (!Array.isArray(scenario.steps)) continue // indexes and catalogs are not scenarios
    const sourceFile = path.relative(compiledRoot, file).replaceAll('\\', '/')
    const plan = createStoryAssetPlan(scenario, { file: `preview/${plans}.json`, sha256: `sha256:${'0'.repeat(64)}` })
    plans++
    for (const asset of plan.assets) {
      if (!asset.required) continue
      if (asset.kind === 'bgm' || asset.kind === 'se' || asset.kind === 'ambient') {
        const url = asset.kind === 'bgm' ? getBgmUrl(asset.id) : asset.kind === 'se' ? getSeUrl(asset.id) : getAmbientUrl(asset.id)
        await addExternal(url, resolver.audioCandidates(url.slice('/assets/audio'.length)), `plan:${sourceFile}`)
      } else if (asset.kind === 'lipsync') {
        const url = getLipSyncUrl(asset.id)
        await addExternal(url, [resolver.lipsyncPath(url.slice('/assets/lipsync/adxlip'.length))], `plan:${sourceFile}`)
      }
    }
  }
}
await scanPlans(compiledRoot)

const archiveManifest = JSON.parse(await fs.readFile(path.join(publicRoot, 'data', 'archive_manifest.json'), 'utf8'))
for (const [id, flags] of Object.entries(archiveManifest.card_assets_by_id)) {
  for (const awakened of [false, true]) {
    const variant = awakened ? 'awakened' : 'normal'
    if (flags[`${variant}_portrait`]) for (const framed of [false, true]) {
      const url = getCardPortraitUrl(id, awakened, framed)
      await addExternal(url, [resolver.cardArtPath(url.slice('/assets/card-art'.length))], `card:${id}`)
    }
    if (flags[`${variant}_landscape`]) {
      const url = getCardLandscapeUrl(id, awakened)
      await addExternal(url, [resolver.cardArtPath(url.slice('/assets/card-art'.length))], `card:${id}`)
    }
  }
}

const entries = [...files.values()].sort((a, b) => a.request_key.localeCompare(b.request_key))
for (const item of entries) {
  item.object_key = resolvePreviewObjectKey(item.request_key)
  item.transform = previewTransformKind(item.request_key)
  item.source_size = item.size
  item.source_content_type = item['content-type']
  item.deployed_content_type = typeFor(item.object_key)
  delete item.key
  delete item.size
  delete item['content-type']
}
const objectKeys = new Set()
for (const item of entries) {
  if (objectKeys.has(item.object_key)) throw new Error(`Deployment object key collision: ${item.object_key}`)
  objectKeys.add(item.object_key)
}
const sourceBytes = entries.reduce((sum, item) => sum + item.source_size, 0)
const convertedPngs = entries.filter(item => item.transform !== COPY_TRANSFORM).length
const totals = { source_files: entries.length, source_bytes: sourceBytes, plans, missing: missing.size, converted_pngs: convertedPngs }
const missingEntries = [...missing.values()].sort((a, b) => a.request_key.localeCompare(b.request_key))
if (mode === '--baseline') {
  // Enumerate current sources with the SAME closure as export, without changing
  // the old manifest or copying any media. Missing dependencies remain explicit.
  await writeSourceBaseline({ root, entries, missing: missingEntries, plans })
  process.exit(0)
}
const missingPrefix = item => item.request_key.split('/').slice(0, 3).join('/')
console.log(JSON.stringify({ mode, totals, missingByKind: Object.fromEntries([...new Set(missingEntries.map(missingPrefix))].map(kind => [kind, missingEntries.filter(item => missingPrefix(item) === kind).length])), missingExamples: missingEntries.slice(0, 30) }, null, 2))
if (mode === '--audit') process.exit(missing.size ? 2 : 0)
if (missing.size && !allowMissing) throw new Error(`Refusing incomplete export: ${missing.size} runtime keys have no local source; use --allow-missing for an explicitly incomplete Preview`)
await fs.mkdir(outputRoot, { recursive: true })
if ((await fs.lstat(outputRoot)).isSymbolicLink()) throw new Error('Refusing linked .deploy root')
await fs.mkdir(stageRoot, { recursive: true })
if ((await fs.lstat(stageRoot)).isSymbolicLink()) throw new Error('Refusing linked R2 stage')
let staged = 0
let deployedBytes = 0
async function stage(item) {
  const target = path.join(stageRoot, ...item.object_key.split('/'))
  await fs.mkdir(path.dirname(target), { recursive: true })
  if (item.transform === COPY_TRANSFORM) await fs.copyFile(item.source, target)
  else await encodeLosslessWebp({ source: item.source, target })
  const content = await fs.readFile(target)
  item.deployed_size = content.length
  item.sha256 = createHash('sha256').update(content).digest('hex')
  deployedBytes += content.length
  if (++staged % 2000 === 0) console.log(`Staged ${staged}/${entries.length}`)
}
// method=6 is CPU-bound and single-threaded per image, so throughput is set by
// how many encodes run at once. Default to a fraction of the machine rather
// than a fixed 4, and let an operator raise or lower it without editing code.
const stageConcurrency = Number(process.env.SIDEM_EXPORT_CONCURRENCY || Math.max(2, Math.min(8, (os.availableParallelism?.() ?? 4) - 2)))
await runPool(entries, stageConcurrency, stage)

// Staging must end up exactly equal to the manifest. A previous run may have
// staged a different physical layout for the same logical corpus (for example
// the pre-WebP pass, whose `.png` objects now map to `.webp` ones); leaving
// those behind would silently upload objects the manifest never describes.
// Pruning deletes files, so refuse to run it on a key set that looks degenerate.
assert.ok(entries.length > 0 && objectKeys.size === entries.length, 'Refusing to prune against an empty or inconsistent object key set')
let removed = 0
let scanned = 0
async function removeStale(directory, prefix) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    const key = `${prefix}/${entry.name}`
    if (entry.isDirectory()) await removeStale(absolute, key)
    else {
      scanned++
      // Bound the retries: an external handle on a stale object must surface as
      // a loud failure rather than stalling the whole export indefinitely.
      if (!objectKeys.has(key)) { await fs.rm(absolute, { maxRetries: 5, retryDelay: 200 }); if (++removed % 2000 === 0) console.log(`Pruned ${removed} stale objects`) }
    }
  }
}
async function removeEmptyDirectories(directory) {
  let empty = true
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!(await removeEmptyDirectories(path.join(directory, entry.name)))) empty = false }
    else empty = false
  }
  if (empty && directory !== stageRoot) await fs.rmdir(directory)
  return empty
}
async function isDirectory(candidate) {
  try { return (await fs.lstat(candidate)).isDirectory() } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}
for (const prefix of ['assets', 'data']) {
  const directory = path.join(stageRoot, prefix)
  if (await isDirectory(directory)) await removeStale(directory, prefix)
}
await removeEmptyDirectories(stageRoot)
console.log(`Scanned ${scanned} staged objects; removed ${removed} that the new manifest does not describe`)

for (const item of entries) item.source = path.relative(root, item.source).replaceAll('\\', '/')
totals.deployed_objects = entries.length
totals.deployed_bytes = deployedBytes
totals.saved_bytes = sourceBytes - deployedBytes
totals.ratio = sourceBytes ? Number((deployedBytes / sourceBytes).toFixed(4)) : 0
await fs.writeFile(manifestPath, JSON.stringify({ schema_version: 2, totals, missing: missingEntries, entries }, null, 2) + '\n')
console.log(`Exported ${entries.length} objects (${convertedPngs} lossless WebP) to ${stageRoot}; manifest ${manifestPath}`)

// The encoder pool holds live child processes, and a live child keeps Node's
// event loop non-empty. Without this the export finishes all its work, writes
// the manifest, and then sits at zero CPU forever -- the process never exits.
shutdownEncoderPool()
