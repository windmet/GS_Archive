import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { createArchiveAssetResolver } from './lib/archive-assets.mjs'
import { getBgmUrl, getSeUrl, getAmbientUrl, getLipSyncUrl } from '../src/utils/AssetResolver.js'
import { getCardPortraitUrl, getCardLandscapeUrl } from '../src/utils/CardAssetResolver.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(root, 'public')
const outputRoot = path.join(root, '.deploy')
const stageRoot = path.join(outputRoot, 'r2')
const manifestPath = path.join(outputRoot, 'r2-manifest.json')
const mode = process.argv[2]
if (mode !== '--audit' && mode !== '--export') throw new Error('Use --audit or --export')
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
  if (!source || !(await isFile(source))) { if (!missing.has(key)) missing.set(key, { key, provenance }); return }
  const stat = await fs.stat(source)
  files.set(key, { key, source, size: stat.size, 'content-type': typeFor(key), provenance })
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

const entries = [...files.values()].sort((a, b) => a.key.localeCompare(b.key))
const totals = { files: entries.length, bytes: entries.reduce((sum, item) => sum + item.size, 0), plans, missing: missing.size }
const missingEntries = [...missing.values()].sort((a, b) => a.key.localeCompare(b.key))
console.log(JSON.stringify({ mode, totals, missingByKind: Object.fromEntries([...new Set(missingEntries.map(item => item.key.split('/').slice(0, 3).join('/')))].map(kind => [kind, missingEntries.filter(item => item.key.startsWith(kind + '/')).length])), missingExamples: missingEntries.slice(0, 30) }, null, 2))
if (mode === '--audit') process.exit(missing.size ? 2 : 0)
if (missing.size && !allowMissing) throw new Error(`Refusing incomplete export: ${missing.size} runtime keys have no local source; use --allow-missing for an explicitly incomplete Preview`)
await fs.mkdir(outputRoot, { recursive: true })
if ((await fs.lstat(outputRoot)).isSymbolicLink()) throw new Error('Refusing linked .deploy root')
await fs.mkdir(stageRoot, { recursive: true })
if ((await fs.lstat(stageRoot)).isSymbolicLink()) throw new Error('Refusing linked R2 stage')
for (let index = 0; index < entries.length; index++) {
  const item = entries[index]
  const target = path.join(stageRoot, ...item.key.split('/'))
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(item.source, target)
  const hash = createHash('sha256').update(await fs.readFile(target)).digest('hex')
  item.sha256 = hash
  item.source = path.relative(root, item.source).replaceAll('\\', '/')
  if ((index + 1) % 5000 === 0) console.log(`Staged ${index + 1}/${entries.length}`)
}
await fs.writeFile(manifestPath, JSON.stringify({ schema_version: 1, totals, missing: missingEntries, entries }, null, 2) + '\n')
console.log(`Exported ${entries.length} objects to ${stageRoot}; manifest ${manifestPath}`)
