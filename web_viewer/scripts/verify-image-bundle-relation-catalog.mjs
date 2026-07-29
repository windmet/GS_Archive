import { createHash } from 'node:crypto'
import {
  closeSync,
  createReadStream,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { loadArchiveSources } from './lib/archive-sources.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(projectRoot, '..')
const catalogPath = path.join(
  projectRoot,
  'public',
  'data',
  'image_bundle_relation_catalog.json',
)
const schemaPath = path.join(
  projectRoot,
  'schemas',
  'image-bundle-relation-catalog-v1.schema.json',
)
const masterdataRoot = path.join(projectRoot, 'public', 'data', 'masterdata')
const characterPromotionPath = path.join(
  projectRoot,
  'public',
  'data',
  'assets',
  'raw_character_image_promotions.json',
)
const sourceOnly = process.argv.includes('--source-only')
const failures = []
const readJson = filename => JSON.parse(readFileSync(filename, 'utf8'))
const catalog = readJson(catalogPath)
const schema = readJson(schemaPath)
const characterPromotions = readJson(characterPromotionPath)

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
if (!validate(catalog)) {
  failures.push(
    ...validate.errors.map(error =>
      `schema ${error.instancePath || '/'} ${error.message}`,
    ),
  )
}

const stable = value => JSON.stringify(value)
const assertEqual = (actual, expected, message) => {
  if (stable(actual) !== stable(expected)) {
    failures.push(`${message}: expected ${stable(expected)}, got ${stable(actual)}`)
  }
}
const increment = (counts, key, amount = 1) => {
  counts[key] = (counts[key] || 0) + amount
}
const sortedObject = value => Object.fromEntries(
  Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
)
const stringCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0
const sortedUnique = (values, compare = stringCompare) =>
  values.length === new Set(values).size &&
  values.every((value, index) => index === 0 || compare(values[index - 1], value) < 0)
const pathIdCompare = (left, right) => {
  const leftValue = BigInt(left)
  const rightValue = BigInt(right)
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
}
const promotionRecord = entry => ({
  kind: entry.kind,
  idol_code: entry.idol_code,
  asset_url: entry.asset_url,
  raw_source: {
    relative_path: entry.raw_source?.relative_path,
    bytes: entry.raw_source?.bytes,
    sha256: entry.raw_source?.sha256,
  },
  unity_object: {
    path_id: String(entry.unity_object?.path_id),
    object_type: entry.unity_object?.object_type,
    asset_name: entry.unity_object?.asset_name,
    container_path: entry.unity_object?.container_path,
  },
  output: {
    bytes: entry.output?.bytes,
    width: entry.output?.width,
    height: entry.output?.height,
    sha256: entry.output?.sha256,
  },
})
const promotionCompare = (left, right) =>
  stringCompare(left.kind, right.kind) ||
  stringCompare(left.idol_code, right.idol_code)
const recursiveAbsolutePaths = []
const findAbsolutePaths = (value, pointer = '') => {
  if (typeof value === 'string') {
    const stableAssetUrl =
      pointer.endsWith('/asset_url') && value.startsWith('/assets/')
    if (
      !stableAssetUrl &&
      (
        /^[A-Za-z]:[\\/]/.test(value) ||
        /^\\\\/.test(value) ||
        value.startsWith('/')
      )
    ) {
      recursiveAbsolutePaths.push(pointer || '/')
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => findAbsolutePaths(item, `${pointer}/${index}`))
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) =>
      findAbsolutePaths(item, `${pointer}/${key}`),
    )
  }
}
findAbsolutePaths(catalog)
if (recursiveAbsolutePaths.length) {
  failures.push(
    `catalog contains machine absolute paths at ${recursiveAbsolutePaths.join(', ')}`,
  )
}

const speakerDictionary = readJson(path.join(masterdataRoot, 'speaker_dictionary.json'))
const eventIndex = readJson(path.join(masterdataRoot, 'event_index.json'))
const gashaIndex = readJson(path.join(masterdataRoot, 'gasha_index.json'))
const campaignIndex = readJson(path.join(masterdataRoot, 'seasonal_campaign_index.json'))
const masterdataSets = {
  'speaker_dictionary.speakers': new Set(
    Object.keys(speakerDictionary.speakers || {}),
  ),
  'event_index.events': new Set(
    (eventIndex.events || []).map(row => String(row.event_code)),
  ),
  'gasha_index.gashas.id': new Set(
    (gashaIndex.gashas || []).map(row => String(row.id)),
  ),
  'gasha_index.gashas.code': new Set(
    (gashaIndex.gashas || []).map(row => String(row.code)),
  ),
  'seasonal_campaign_index.campaigns': new Set(
    (campaignIndex.campaigns || []).map(row => String(row.event_code)),
  ),
}
const trackedPngs = new Set(
  execFileSync(
    'git',
    ['ls-files', 'web_viewer/public/assets/**/*.png'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ).split(/\r?\n/u).filter(Boolean),
)
const promotionsByRawPath = new Map()
for (const registryEntry of characterPromotions.entries || []) {
  const relativePath = registryEntry.raw_source?.relative_path
  const rows = promotionsByRawPath.get(relativePath) || []
  rows.push(promotionRecord(registryEntry))
  promotionsByRawPath.set(relativePath, rows)
}
for (const rows of promotionsByRawPath.values()) rows.sort(promotionCompare)

const entries = Array.isArray(catalog.entries) ? catalog.entries : []
const entryIds = entries.map(entry => entry.id)
const rawPaths = entries.map(entry => entry.raw?.relative_path)
if (!sortedUnique(entryIds)) failures.push('entry IDs must be unique and sorted')
if (!sortedUnique(rawPaths)) failures.push('RAW relative paths must be unique and sorted')

let totalBytes = 0
let unityObjects = 0
let containerEntries = 0
let imageObjects = 0
let spriteObjects = 0
let textureObjects = 0
let directLinks = 0
let stablePromotionCount = 0
const familyCounts = {}
const mappingCounts = {}

for (const entry of entries) {
  totalBytes += entry.raw?.bytes || 0
  increment(familyCounts, entry.family)
  increment(mappingCounts, entry.mapping?.state)
  if (entry.raw?.filename !== `${entry.id}.unity3d`) {
    failures.push(`${entry.id}: filename must equal ID plus .unity3d`)
  }
  if (entry.raw?.relative_path !== `asset/${entry.raw?.filename}`) {
    failures.push(`${entry.id}: RAW relative path does not match filename`)
  }
  if (entry.family !== entry.id.split('_')[1]) {
    failures.push(`${entry.id}: family does not match the second filename token`)
  }

  const typeCounts = entry.unity?.object_type_counts || {}
  const bundleObjectCount = Object.values(typeCounts)
    .reduce((total, count) => total + count, 0)
  unityObjects += bundleObjectCount
  containerEntries += entry.unity?.container_entries?.length || 0
  imageObjects += entry.unity?.image_objects?.length || 0
  spriteObjects += typeCounts.Sprite || 0
  textureObjects += typeCounts.Texture2D || 0

  const containerRows = entry.unity?.container_entries || []
  const containerKeys = containerRows.map(
    row => `${row.path}\u0000${row.type}\u0000${row.path_id}`,
  )
  if (containerKeys.length !== new Set(containerKeys).size) {
    failures.push(`${entry.id}: Unity container entries must be unique`)
  }
  const sortedContainerRows = [...containerRows].sort((left, right) =>
    stringCompare(left.path, right.path) ||
    stringCompare(left.type, right.type) ||
    pathIdCompare(left.path_id, right.path_id)
  )
  assertEqual(
    containerRows,
    sortedContainerRows,
    `${entry.id}: Unity container entries must be sorted`,
  )
  const imageRows = entry.unity?.image_objects || []
  const imagePathIds = imageRows.map(row => row.path_id)
  if (imagePathIds.length !== new Set(imagePathIds).size) {
    failures.push(`${entry.id}: image-object PathIDs must be unique`)
  }
  const imagesByPathId = new Map(imageRows.map(row => [row.path_id, row]))
  const texturePathIds = new Set(
    imageRows.filter(row => row.type === 'Texture2D').map(row => row.path_id),
  )
  const imageTypeCounts = {}
  for (const row of imageRows) {
    increment(imageTypeCounts, row.type)
    if (row.probe_state === 'read' && (!row.name || !row.dimensions)) {
      failures.push(`${entry.id}:${row.path_id}: successful image read lacks name or dimensions`)
    }
    if (row.texture_path_id) {
      directLinks += 1
      if (row.type !== 'Sprite' || !texturePathIds.has(row.texture_path_id)) {
        failures.push(
          `${entry.id}:${row.path_id}: direct texture pointer does not target a local Texture2D`,
        )
      }
    }
    if (!sortedUnique(row.container_paths || [])) {
      failures.push(`${entry.id}:${row.path_id}: container paths must be unique and sorted`)
    }
  }
  if (
    (imageTypeCounts.Sprite || 0) !== (typeCounts.Sprite || 0) ||
    (imageTypeCounts.Texture2D || 0) !== (typeCounts.Texture2D || 0)
  ) {
    failures.push(`${entry.id}: image-object population differs from object type counts`)
  }
  for (const row of containerRows) {
    if (row.type === 'Sprite' || row.type === 'Texture2D') {
      const image = imagesByPathId.get(row.path_id)
      if (!image || image.type !== row.type || !image.container_paths.includes(row.path)) {
        failures.push(`${entry.id}:${row.path_id}: container relation is not bidirectional`)
      }
    }
  }

  const context = [
    entry.id,
    ...containerRows.map(row => row.path),
    ...imageRows.map(row => row.name).filter(Boolean),
  ].join('\n').toLowerCase()
  const tokenKeys = (entry.masterdata_tokens || [])
    .map(token => `${token.catalog}\u0000${token.key}`)
  if (!sortedUnique(tokenKeys)) {
    failures.push(`${entry.id}: masterdata tokens must be unique and sorted`)
  }
  for (const token of entry.masterdata_tokens || []) {
    if (!masterdataSets[token.catalog]?.has(token.key)) {
      failures.push(`${entry.id}: unknown ${token.catalog} identity ${token.key}`)
    }
    const escaped = token.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const numeric = /^[0-9]+$/u.test(token.key)
    const expression = numeric
      ? new RegExp(`(?<![0-9])${escaped}(?![0-9])`, 'u')
      : new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'u')
    if (!expression.test(context)) {
      failures.push(`${entry.id}: masterdata identity ${token.key} lacks exact boundary evidence`)
    }
  }

  for (const candidate of entry.organizer_export_candidates || []) {
    const image = imagesByPathId.get(candidate.object_path_id)
    if (!image || image.name !== candidate.object_name) {
      failures.push(`${entry.id}: organizer candidate does not identify a cataloged image object`)
      continue
    }
    const validBasenames = new Set(
      [
        image.name ? `${image.name}.png`.toLowerCase() : null,
        ...image.container_paths.map(containerPath =>
          path.posix.basename(containerPath).toLowerCase(),
        ),
      ].filter(Boolean),
    )
    if (!sortedUnique(candidate.tracked_public_paths || [])) {
      failures.push(`${entry.id}:${image.path_id}: tracked public paths must be sorted`)
    }
    for (const publicPath of candidate.tracked_public_paths || []) {
      if (!trackedPngs.has(publicPath)) {
        failures.push(`${entry.id}: organizer candidate is not a tracked PNG: ${publicPath}`)
      }
      if (!validBasenames.has(path.posix.basename(publicPath).toLowerCase())) {
        failures.push(`${entry.id}: organizer candidate lacks exact basename evidence`)
      }
    }
  }

  const expectedPromotions = promotionsByRawPath.get(
    `RAW/${entry.raw?.relative_path}`,
  ) || []
  stablePromotionCount += (entry.stable_promotions || []).length
  assertEqual(
    entry.stable_promotions || [],
    expectedPromotions,
    `${entry.id}: stable promotions differ from the authoritative registry`,
  )
  for (const promotion of entry.stable_promotions || []) {
    if (
      promotion.raw_source?.relative_path !== `RAW/${entry.raw.relative_path}` ||
      promotion.raw_source?.bytes !== entry.raw.bytes ||
      promotion.raw_source?.sha256 !== entry.raw.sha256
    ) {
      failures.push(`${entry.id}: stable promotion RAW identity differs from catalog`)
    }
    const image = imagesByPathId.get(promotion.unity_object?.path_id)
    if (
      !image ||
      image.type !== promotion.unity_object.object_type ||
      image.name !== promotion.unity_object.asset_name ||
      !image.container_paths.includes(promotion.unity_object.container_path)
    ) {
      failures.push(`${entry.id}: stable promotion Unity object evidence drifted`)
    }
    const publicPath = `web_viewer/public${promotion.asset_url}`
    if (!trackedPngs.has(publicPath)) {
      failures.push(`${entry.id}: stable promotion target is not tracked: ${publicPath}`)
    } else {
      const outputPath = path.join(repositoryRoot, publicPath)
      const outputBytes = readFileSync(outputPath)
      if (
        outputBytes.length !== promotion.output.bytes ||
        createHash('sha256').update(outputBytes).digest('hex') !==
          promotion.output.sha256
      ) {
        failures.push(`${entry.id}: stable promotion output identity drifted`)
      }
    }
  }

  const hasStablePromotion = (entry.stable_promotions || []).length > 0
  const hasOrganizer = (entry.organizer_export_candidates || []).length > 0
  const hasMasterdata = (entry.masterdata_tokens || []).length > 0
  const expectedState = hasStablePromotion
    ? 'stable-promotion'
    : hasOrganizer
      ? 'organizer-export-candidate'
      : hasMasterdata
        ? 'masterdata-candidate'
        : entry.consumer_candidates?.[0]?.consumer === 'unclassified-image-surface'
          ? 'unresolved'
          : 'filename-candidate'
  if (entry.mapping?.state !== expectedState) {
    failures.push(`${entry.id}: mapping-state precedence drifted`)
  }
}

assertEqual(
  stablePromotionCount,
  (characterPromotions.entries || []).length,
  'stable promotion registry coverage drifted',
)
assertEqual(catalog.summary?.bundles, entries.length, 'summary bundle count drifted')
assertEqual(catalog.summary?.total_bytes, totalBytes, 'summary byte count drifted')
assertEqual(catalog.summary?.unity_objects, unityObjects, 'summary Unity object count drifted')
assertEqual(
  catalog.summary?.container_entries,
  containerEntries,
  'summary container-entry count drifted',
)
assertEqual(catalog.summary?.image_objects, imageObjects, 'summary image-object count drifted')
assertEqual(catalog.summary?.sprite_objects, spriteObjects, 'summary Sprite count drifted')
assertEqual(catalog.summary?.texture_objects, textureObjects, 'summary Texture2D count drifted')
assertEqual(
  catalog.summary?.direct_sprite_texture_links,
  directLinks,
  'summary direct texture-link count drifted',
)
assertEqual(
  catalog.summary?.families,
  sortedObject(familyCounts),
  'summary family counts drifted',
)
assertEqual(
  catalog.summary?.mapping_states,
  sortedObject(mappingCounts),
  'summary mapping counts drifted',
)

const currentBoundary = {
  bundles: 1271,
  total_bytes: 263071090,
  unity_objects: 9157,
  container_entries: 7826,
  image_objects: 7816,
  sprite_objects: 3928,
  texture_objects: 3888,
  direct_sprite_texture_links: 3885,
}
for (const [key, expected] of Object.entries(currentBoundary)) {
  if (catalog.summary?.[key] !== expected) {
    failures.push(`current image-bundle baseline ${key} must remain ${expected}`)
  }
}

async function sha256(filename) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk)
  return hash.digest('hex')
}

if (!sourceOnly) {
  const sources = loadArchiveSources()
  const config = readJson(sources.configPath)
  const rawAssetRoot = path.resolve(sources.archiveRoot, config.raw_root, 'asset')
  if (!existsSync(rawAssetRoot)) {
    failures.push(`mounted RAW asset root is unavailable: ${rawAssetRoot}`)
  } else {
    const mountedNames = readdirSync(rawAssetRoot, { withFileTypes: true })
      .filter(entry =>
        entry.isFile() &&
        entry.name.startsWith('image_') &&
        entry.name.endsWith('.unity3d')
      )
      .map(entry => entry.name)
      .sort()
    assertEqual(
      mountedNames,
      entries.map(entry => entry.raw.filename),
      'mounted image-bundle population differs from catalog',
    )
    for (const entry of entries) {
      const filename = path.join(rawAssetRoot, entry.raw.filename)
      if (!existsSync(filename)) continue
      if (statSync(filename).size !== entry.raw.bytes) {
        failures.push(`${entry.id}: mounted byte count differs from catalog`)
      }
      const magic = Buffer.alloc(7)
      const descriptor = openSync(filename, 'r')
      try {
        readSync(descriptor, magic, 0, magic.length, 0)
      } finally {
        closeSync(descriptor)
      }
      if (magic.toString('ascii') !== 'UnityFS') {
        failures.push(`${entry.id}: mounted source does not begin with UnityFS`)
      }
      if (await sha256(filename) !== entry.raw.sha256) {
        failures.push(`${entry.id}: mounted SHA-256 differs from catalog`)
      }
    }
  }
}

if (failures.length) {
  console.error('RAW image bundle relation catalog verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(
    `RAW image bundle relation catalog verified (${sourceOnly ? 'source-only' : 'mounted'}): ` +
    `${entries.length} bundles / ${imageObjects} image objects`,
  )
}
