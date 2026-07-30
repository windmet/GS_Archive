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
const schemaPath = path.join(projectRoot, 'schemas', 'usm-relation-catalog-v5.schema.json')
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
const movieAnnounceIndexPath = path.join(
  projectRoot,
  'public',
  'data',
  'masterdata',
  'movie_announce_index.json',
)
const cardSkillMovieIndexPath = path.join(
  projectRoot,
  'public',
  'data',
  'masterdata',
  'card_skill_movie_index.json',
)
const songMovieIndexPath = path.join(
  projectRoot,
  'public',
  'data',
  'masterdata',
  'song_movie_index.json',
)
const gashaMovieContractPath = path.join(
  projectRoot,
  'public',
  'data',
  'client',
  'gasha_movie_contract.json',
)
const sourceOnly = process.argv.includes('--source-only')
const failures = []

const readJson = filename => JSON.parse(readFileSync(filename, 'utf8'))
const [
  catalog,
  schema,
  musicCatalog,
  movieAnnounceIndex,
  cardSkillMovieIndex,
  songMovieIndex,
  gashaMovieContract,
] = [
  catalogPath,
  schemaPath,
  musicCatalogPath,
  movieAnnounceIndexPath,
  cardSkillMovieIndexPath,
  songMovieIndexPath,
  gashaMovieContractPath,
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
let exactMasterdataCount = 0
let unresolvedCount = 0
const exactMovieAnnounceIds = new Set(
  (movieAnnounceIndex.movie_announces || []).map(
    entry => `movie_home_announce_${entry.resource_id}`,
  ),
)
const movieAnnounceById = new Map(
  (movieAnnounceIndex.movie_announces || []).map(entry => [
    `movie_home_announce_${entry.resource_id}`,
    entry,
  ]),
)
const exactCardSkillMovieIds = new Set(
  (cardSkillMovieIndex.skill_movies || []).map(
    entry => `skill_movie_${entry.resource_id}`,
  ),
)
const cardSkillMovieById = new Map(
  (cardSkillMovieIndex.skill_movies || []).map(entry => [
    `skill_movie_${entry.resource_id}`,
    entry,
  ]),
)
const exactSongMovieIds = new Set(
  (songMovieIndex.song_movies || []).map(
    entry => `${entry.kind}_${entry.resource_id}`,
  ),
)
const songMovieById = new Map(
  (songMovieIndex.song_movies || []).map(entry => [
    `${entry.kind}_${entry.resource_id}`,
    entry,
  ]),
)
const exactGashaMovieIds = new Set(
  (gashaMovieContract.resources || []).map(entry => entry.id),
)
const gashaMovieById = new Map(
  (gashaMovieContract.resources || []).map(entry => [entry.id, entry]),
)
if (
  movieAnnounceIndex.schema_version !== 1 ||
  movieAnnounceIndex.meta?.source_table !== 175 ||
  movieAnnounceIndex.meta?.record_count !== 30 ||
  movieAnnounceIndex.meta?.unique_resource_ids !== 30 ||
  exactMovieAnnounceIds.size !== 30
) {
  failures.push('MovieAnnounce index must contain 30 unique table-175 resource IDs')
}
if (
  gashaMovieContract.schema_version !== 1 ||
  gashaMovieContract.meta?.source_kind !== 'il2cpp-global-metadata-v27' ||
  gashaMovieContract.meta?.resource_count !== 12 ||
  gashaMovieContract.meta?.start_movie_count !== 11 ||
  gashaMovieContract.meta?.ssr_movie_count !== 1 ||
  gashaMovieContract.consumer?.namespace !== 'Growing.Theater' ||
  gashaMovieContract.consumer?.class !== 'GashaAnimationMovieManager' ||
  exactGashaMovieIds.size !== 12
) {
  failures.push(
    'gasha movie client contract must contain 11 start movies + 1 SSR movie',
  )
}
if (
  cardSkillMovieIndex.schema_version !== 1 ||
  cardSkillMovieIndex.meta?.source_table !== 1 ||
  cardSkillMovieIndex.meta?.resource_count !== 124 ||
  cardSkillMovieIndex.meta?.card_record_count !== 127 ||
  cardSkillMovieIndex.meta?.shared_resource_count !== 3 ||
  cardSkillMovieIndex.meta?.predicate !== 'CardData.HasSkillCutinResource == true' ||
  exactCardSkillMovieIds.size !== 124
) {
  failures.push(
    'card skill-movie index must contain 124 CardData resource IDs / ' +
    '127 card records / 3 shared resources',
  )
}
if (
  songMovieIndex.schema_version !== 1 ||
  songMovieIndex.meta?.source_table !== 46 ||
  songMovieIndex.meta?.resource_count !== 12 ||
  songMovieIndex.meta?.song_record_count !== 13 ||
  songMovieIndex.meta?.shared_resource_count !== 1 ||
  songMovieIndex.meta?.three_d_movie_count !== 11 ||
  songMovieIndex.meta?.mvlive_count !== 1 ||
  songMovieIndex.meta?.disabled_open_at !== 4102412400 ||
  exactSongMovieIds.size !== 12
) {
  failures.push(
    'SongData movie index must contain 11 3dmv + 1 mvlive resources / ' +
    '13 song records / 1 shared resource',
  )
}
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
    if (entry.mapping.masterdata_relation != null) {
      failures.push(`${entry.id}: exact consumer must not claim MovieAnnounce evidence`)
    }
    const exactConsumer = exactCandidates[0]?.consumer
    if (exactCandidates.length !== 1) {
      failures.push(`${entry.id}: exact relation must name exactly one consumer`)
    }
    if (entry.mapping.kind === 'gasha-animation-movie') {
      const source = gashaMovieById.get(entry.id)
      const relation = entry.mapping.client_relation
      if (
        exactConsumer !== 'Growing.Theater.GashaAnimationMovieManager' ||
        !source ||
        relation?.catalog !== 'gasha_movie_contract.resources' ||
        relation?.resource_id !== source.id ||
        relation?.role !== source.role
      ) {
        failures.push(`${entry.id}: exact gasha relation differs from client contract`)
      }
      assertEqual(
        relation?.format_arguments,
        source?.format_arguments,
        `${entry.id}: gasha format arguments drifted`,
      )
      if (
        entry.raw.filename !== source?.filename ||
        entry.mapping.raw_effect_scripts.length ||
        entry.mapping.derived_assets.length
      ) {
        failures.push(`${entry.id}: exact gasha relation claims invalid RAW or browser evidence`)
      }
      if (entry.mapping.masterdata_relation != null) {
        failures.push(`${entry.id}: exact gasha relation must not claim masterdata evidence`)
      }
    } else {
      if (exactConsumer !== 'ChibiStageViewer.backmonitor') {
        failures.push(`${entry.id}: exact BackMonitor relation names the wrong consumer`)
      }
      if (entry.mapping.client_relation != null) {
        failures.push(`${entry.id}: BackMonitor relation must not claim client metadata evidence`)
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
        assertEqual(
          roles,
          ['color', 'alpha'],
          `${entry.id}: transition derivative roles drifted`,
        )
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
    }
  } else if (entry.mapping?.state === 'exact-masterdata') {
    exactMasterdataCount += 1
    const relation = entry.mapping.masterdata_relation
    if (entry.mapping.kind === 'movie-announce') {
      const source = movieAnnounceById.get(entry.id)
      if (
        entry.family !== 'movie-home' ||
        !source ||
        relation?.catalog !== 'movie_announce_index.movie_announces' ||
        relation?.resource_id !== source.resource_id ||
        relation?.record_id !== source.id
      ) {
        failures.push(`${entry.id}: exact MovieAnnounce relation differs from table 175`)
      }
      if (entry.id !== `movie_home_announce_${relation?.resource_id}`) {
        failures.push(`${entry.id}: exact MovieAnnounce relation shape drifted`)
      }
    } else if (entry.mapping.kind === 'card-skill-movie') {
      const source = cardSkillMovieById.get(entry.id)
      const expectedCardIds = source?.cards?.map(card => card.card_id)
      if (
        entry.family !== 'skill-movie' ||
        !source ||
        relation?.catalog !== 'card_skill_movie_index.skill_movies' ||
        relation?.resource_id !== source.resource_id
      ) {
        failures.push(`${entry.id}: exact card skill-movie relation differs from table 1`)
      }
      assertEqual(
        relation?.card_ids,
        expectedCardIds,
        `${entry.id}: CardData card IDs drifted`,
      )
      if (
        entry.id !== `skill_movie_${relation?.resource_id}` ||
        !sortedUnique(relation?.card_ids || [])
      ) {
        failures.push(`${entry.id}: exact card skill-movie relation shape drifted`)
      }
    } else if (
      entry.mapping.kind === 'song-3dmv' ||
      entry.mapping.kind === 'song-mvlive'
    ) {
      const source = songMovieById.get(entry.id)
      const expectedKind = `song-${source?.kind}`
      const expectedSongIds = source?.songs?.map(song => song.song_id)
      if (
        !source ||
        entry.mapping.kind !== expectedKind ||
        relation?.catalog !== 'song_movie_index.song_movies' ||
        relation?.resource_id !== source.resource_id
      ) {
        failures.push(`${entry.id}: exact SongData movie relation differs from table 46`)
      }
      assertEqual(
        relation?.song_ids,
        expectedSongIds,
        `${entry.id}: SongData song IDs drifted`,
      )
      if (
        entry.id !== `${source?.kind}_${relation?.resource_id}` ||
        !sortedUnique(relation?.song_ids || [])
      ) {
        failures.push(`${entry.id}: exact SongData movie relation shape drifted`)
      }
    } else {
      failures.push(`${entry.id}: exact masterdata relation has an invalid mapping kind`)
    }
    if (
      entry.mapping.raw_effect_scripts.length ||
      entry.mapping.derived_assets.length
    ) {
      failures.push(`${entry.id}: exact masterdata relation must not claim consumer assets`)
    }
    if (exactCandidates.length) {
      failures.push(`${entry.id}: exact masterdata relation must not claim an exact consumer`)
    }
    if (entry.mapping.client_relation != null) {
      failures.push(`${entry.id}: exact masterdata relation must not claim client metadata evidence`)
    }
    if (backmonitor?.assets?.[entry.id] || backmonitor?.transitions?.[entry.id]) {
      failures.push(`${entry.id}: MovieAnnounce relation overlaps BackMonitor`)
    }
  } else {
    unresolvedCount += 1
    if (entry.mapping?.kind !== 'unresolved') {
      failures.push(`${entry.id}: unresolved relation must use unresolved kind`)
    }
    if (entry.mapping?.raw_effect_scripts?.length || entry.mapping?.derived_assets?.length) {
      failures.push(`${entry.id}: unresolved relation must not claim exact evidence or assets`)
    }
    if (entry.mapping?.masterdata_relation != null) {
      failures.push(`${entry.id}: unresolved relation must not claim exact masterdata evidence`)
    }
    if (entry.mapping?.client_relation != null) {
      failures.push(`${entry.id}: unresolved relation must not claim client metadata evidence`)
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
assertEqual(
  catalog.summary?.exact_masterdata,
  exactMasterdataCount,
  'summary exact masterdata count drifted',
)
assertEqual(catalog.summary?.unresolved, unresolvedCount, 'summary unresolved count drifted')
assertEqual(catalog.summary?.families, familyCounts, 'summary family counts drifted')

const exactCatalogIds = entries
  .filter(entry => entry.mapping?.state === 'exact-consumer')
  .map(entry => entry.id)
  .sort()
const exactBackmonitorCatalogIds = entries
  .filter(
    entry =>
      entry.mapping?.state === 'exact-consumer' &&
      entry.consumer_candidates?.[0]?.consumer === 'ChibiStageViewer.backmonitor',
  )
  .map(entry => entry.id)
  .sort()
const exactGashaCatalogIds = entries
  .filter(entry => entry.mapping?.kind === 'gasha-animation-movie')
  .map(entry => entry.id)
  .sort()
const exactMasterdataCatalogIds = entries
  .filter(entry => entry.mapping?.state === 'exact-masterdata')
  .map(entry => entry.id)
  .sort()
assertEqual(
  exactMasterdataCatalogIds,
  [
    ...exactMovieAnnounceIds,
    ...exactCardSkillMovieIds,
    ...exactSongMovieIds,
  ].sort(),
  'catalog and exact masterdata populations differ',
)
assertEqual(
  exactGashaCatalogIds,
  [...exactGashaMovieIds].sort(),
  'catalog and gasha client-contract populations differ',
)
if (backmonitor) {
  const exactIndexIds = [
    ...Object.keys(backmonitor.assets || {}),
    ...Object.keys(backmonitor.transitions || {}),
  ].sort()
  assertEqual(
    exactBackmonitorCatalogIds,
    exactIndexIds,
    'catalog and BackMonitor exact-ID populations differ',
  )
}
if (
  exactCatalogIds.length !== 89 ||
  exactCount !== 89 ||
  exactMasterdataCount !== 166 ||
  unresolvedCount !== 5
) {
  failures.push(
    'current USM relation baseline must remain ' +
    '260 total / 89 exact consumer / 166 exact masterdata / 5 unresolved',
  )
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
    `${entries.length} total / ${exactCount} exact consumer / ` +
    `${exactMasterdataCount} exact masterdata / ${unresolvedCount} unresolved`,
  )
}
