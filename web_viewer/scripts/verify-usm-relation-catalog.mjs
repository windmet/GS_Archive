import { createHash } from 'node:crypto'
import {
  createReadStream,
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { loadArchiveSources } from './lib/archive-sources.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(projectRoot, 'public', 'data', 'usm_relation_catalog.json')
const schemaPath = path.join(projectRoot, 'schemas', 'usm-relation-catalog-v1.schema.json')
const backmonitorPath = path.join(
  projectRoot,
  'public',
  'assets',
  'live-chibi',
  'backmonitor',
  'index.json',
)
const musicCatalogPath = path.join(
  projectRoot,
  'public',
  'data',
  'masterdata',
  'music_catalog.json',
)
const sourceOnly = process.argv.includes('--source-only')
const failures = []

const readJson = filename => JSON.parse(readFileSync(filename, 'utf8'))
const [catalog, schema, musicCatalog] = [
  catalogPath,
  schemaPath,
  musicCatalogPath,
].map(readJson)
const backmonitor = !sourceOnly && existsSync(backmonitorPath)
  ? readJson(backmonitorPath)
  : null
if (!sourceOnly && !backmonitor) {
  failures.push(`mounted BackMonitor index is unavailable: ${backmonitorPath}`)
}

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
if (!validate(catalog)) {
  failures.push(
    ...validate.errors.map(error =>
      `schema ${error.instancePath || '/'} ${error.message}`,
    ),
  )
}

const addCount = (counts, key) => {
  counts[key] = (counts[key] || 0) + 1
}
const sortedUnique = values =>
  values.length === new Set(values).size &&
  values.every((value, index) => index === 0 || values[index - 1] < value)
const stable = value => JSON.stringify(value)
const assertEqual = (actual, expected, message) => {
  if (stable(actual) !== stable(expected)) {
    failures.push(`${message}: expected ${stable(expected)}, got ${stable(actual)}`)
  }
}
const absolutePathStrings = []
const findAbsolutePaths = (value, pointer = '') => {
  if (typeof value === 'string') {
    if (/^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value) || value.startsWith('/')) {
      absolutePathStrings.push(pointer || '/')
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findAbsolutePaths(entry, `${pointer}/${index}`))
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) =>
      findAbsolutePaths(entry, `${pointer}/${key}`),
    )
  }
}
findAbsolutePaths(catalog)
if (absolutePathStrings.length) {
  failures.push(`catalog contains machine absolute paths at ${absolutePathStrings.join(', ')}`)
}

const entries = Array.isArray(catalog.entries) ? catalog.entries : []
const ids = entries.map(entry => entry.id)
const rawPaths = entries.map(entry => entry.raw?.relative_path)
const hashes = entries.map(entry => entry.raw?.sha256)
if (!sortedUnique(ids)) failures.push('entry IDs must be unique and sorted')
if (!sortedUnique(rawPaths)) failures.push('RAW relative paths must be unique and sorted')
if (hashes.length !== new Set(hashes).size) failures.push('RAW SHA-256 values must be unique')

const familyCounts = {}
let totalBytes = 0
let exactCount = 0
let unresolvedCount = 0
for (const entry of entries) {
  addCount(familyCounts, entry.family)
  totalBytes += entry.raw?.bytes || 0
  if (entry.raw?.filename !== `${entry.id}.usm`) {
    failures.push(`${entry.id}: filename must equal ID plus .usm`)
  }
  if (entry.raw?.relative_path !== `movie/${entry.raw?.filename}`) {
    failures.push(`${entry.id}: RAW relative path does not match filename`)
  }
  if (entry.media_probe?.state === 'ffprobe-header') {
    if (!String(entry.media_probe.format).split(',').includes('usm')) {
      failures.push(`${entry.id}: successful probe format does not include usm`)
    }
    if (!entry.media_probe.streams?.length) {
      failures.push(`${entry.id}: successful probe must include at least one stream`)
    }
  }
  if (!sortedUnique(entry.mapping?.raw_effect_scripts || [])) {
    failures.push(`${entry.id}: RAW effect-script evidence must be unique and sorted`)
  }

  for (const token of entry.masterdata_tokens || []) {
    const song = musicCatalog.songs?.[token.key]
    if (!song || song.song_code !== token.key) {
      failures.push(`${entry.id}: music token ${token.key} is absent from music_catalog.songs`)
    }
    const escaped = token.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!new RegExp(`(?:^|_)${escaped}(?:_|$)`).test(entry.id)) {
      failures.push(`${entry.id}: music token ${token.key} is not a filename token`)
    }
  }

  const exactCandidates = (entry.consumer_candidates || [])
    .filter(candidate => candidate.state === 'exact')
  if (entry.mapping?.state === 'exact-consumer') {
    exactCount += 1
    if (
      exactCandidates.length !== 1 ||
      exactCandidates[0].consumer !== 'ChibiStageViewer.backmonitor'
    ) {
      failures.push(`${entry.id}: exact relation must name ChibiStageViewer.backmonitor`)
    }
    if (!entry.mapping.raw_effect_scripts.length) {
      failures.push(`${entry.id}: exact relation must retain RAW effect-script evidence`)
    }
    const roles = entry.mapping.derived_assets.map(asset => asset.role)
    if (entry.mapping.kind === 'backmonitor-movie') {
      assertEqual(roles, ['movie'], `${entry.id}: movie derivative roles drifted`)
      const expectedPath =
        `web_viewer/public/assets/live-chibi/backmonitor/${entry.id}.mp4`
      if (entry.mapping.derived_assets[0]?.path !== expectedPath) {
        failures.push(`${entry.id}: movie derivative path does not match its identity`)
      }
    } else if (entry.mapping.kind === 'backmonitor-transition') {
      assertEqual(roles, ['color', 'alpha'], `${entry.id}: transition derivative roles drifted`)
      for (const asset of entry.mapping.derived_assets) {
        const expectedPath =
          `web_viewer/public/assets/live-chibi/backmonitor/${entry.id}.${asset.role}.mp4`
        if (asset.path !== expectedPath) {
          failures.push(`${entry.id}: ${asset.role} derivative path does not match its identity`)
        }
      }
    } else {
      failures.push(`${entry.id}: exact relation has an invalid mapping kind`)
    }
    if (backmonitor) {
      const asset = backmonitor.assets?.[entry.id]
      const transition = backmonitor.transitions?.[entry.id]
      if ((asset ? 1 : 0) + (transition ? 1 : 0) !== 1) {
        failures.push(`${entry.id}: exact relation must match one BackMonitor index record`)
        continue
      }
      const expectedKind = asset ? 'backmonitor-movie' : 'backmonitor-transition'
      if (entry.mapping.kind !== expectedKind) {
        failures.push(`${entry.id}: mapping kind must be ${expectedKind}`)
      }
      const expectedDerived = asset
        ? [{
            role: 'movie',
            path: `web_viewer/public/assets/live-chibi/${asset.file}`,
            width: asset.width,
            height: asset.height,
            frame_rate: asset.frameRate,
            duration_ms: asset.duration,
            bytes: asset.bytes,
          }]
        : ['color', 'alpha'].map(role => ({
            role,
            path: `web_viewer/public/assets/live-chibi/${transition[`${role}File`]}`,
            width: transition[role].width,
            height: transition[role].height,
            frame_rate: transition[role].frameRate,
            duration_ms: transition[role].duration,
            bytes: transition[role].bytes,
          }))
      assertEqual(
        entry.mapping.derived_assets,
        expectedDerived,
        `${entry.id}: derived BackMonitor metadata drifted`,
      )
    }
  } else {
    unresolvedCount += 1
    if (entry.mapping?.kind !== 'unresolved') {
      failures.push(`${entry.id}: unresolved relation must use unresolved kind`)
    }
    if (entry.mapping?.raw_effect_scripts?.length || entry.mapping?.derived_assets?.length) {
      failures.push(`${entry.id}: unresolved relation must not claim exact evidence or assets`)
    }
    if (exactCandidates.length) {
      failures.push(`${entry.id}: unresolved relation must not claim an exact consumer`)
    }
    if (backmonitor?.assets?.[entry.id] || backmonitor?.transitions?.[entry.id]) {
      failures.push(`${entry.id}: BackMonitor index record is incorrectly unresolved`)
    }
  }
}

assertEqual(catalog.summary?.total, entries.length, 'summary total drifted')
assertEqual(catalog.summary?.total_bytes, totalBytes, 'summary byte count drifted')
assertEqual(catalog.summary?.exact_consumer, exactCount, 'summary exact count drifted')
assertEqual(catalog.summary?.unresolved, unresolvedCount, 'summary unresolved count drifted')
assertEqual(catalog.summary?.families, familyCounts, 'summary family counts drifted')

const exactCatalogIds = entries
  .filter(entry => entry.mapping?.state === 'exact-consumer')
  .map(entry => entry.id)
  .sort()
if (backmonitor) {
  const exactIndexIds = [
    ...Object.keys(backmonitor.assets || {}),
    ...Object.keys(backmonitor.transitions || {}),
  ].sort()
  assertEqual(exactCatalogIds, exactIndexIds, 'catalog and BackMonitor exact-ID populations differ')
}
if (exactCatalogIds.length !== 77 || exactCount !== 77 || unresolvedCount !== 183) {
  failures.push('current USM relation baseline must remain 260 total / 77 exact / 183 unresolved')
}

async function sha256(filename) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk)
  return hash.digest('hex')
}

if (!sourceOnly) {
  const sources = loadArchiveSources()
  const config = readJson(sources.configPath)
  const rawMovieRoot = path.resolve(sources.archiveRoot, config.raw_root, 'movie')
  if (!existsSync(rawMovieRoot)) {
    failures.push(`mounted RAW movie root is unavailable: ${rawMovieRoot}`)
  } else {
    const mountedNames = readdirSync(rawMovieRoot, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.usm'))
      .map(entry => entry.name)
      .sort()
    assertEqual(
      mountedNames,
      entries.map(entry => entry.raw.filename),
      'mounted RAW USM population differs from catalog',
    )
    for (const entry of entries) {
      const filename = path.join(rawMovieRoot, entry.raw.filename)
      if (!existsSync(filename)) continue
      if (statSync(filename).size !== entry.raw.bytes) {
        failures.push(`${entry.id}: mounted byte count differs from catalog`)
      }
      const descriptor = Buffer.alloc(4)
      const fileDescriptor = openSync(filename, 'r')
      try {
        readSync(fileDescriptor, descriptor, 0, descriptor.length, 0)
      } finally {
        closeSync(fileDescriptor)
      }
      if (descriptor.toString('ascii') !== 'CRID') {
        failures.push(`${entry.id}: mounted source does not begin with CRID`)
      }
      if (await sha256(filename) !== entry.raw.sha256) {
        failures.push(`${entry.id}: mounted SHA-256 differs from catalog`)
      }
    }
  }
}

if (failures.length) {
  console.error('RAW USM relation catalog verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(
    `RAW USM relation catalog verified (${sourceOnly ? 'source-only' : 'mounted'}): ` +
    `${entries.length} total / ${exactCount} exact / ${unresolvedCount} unresolved`,
  )
}
