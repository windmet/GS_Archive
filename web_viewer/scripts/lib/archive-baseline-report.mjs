import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  createReadStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadArchiveSources } from './archive-sources.mjs'

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)

export const reportPath = path.join(
  projectRoot,
  'public',
  'data',
  'archive_baseline_report.json',
)

export const authoritativeStoryRegistryPath = path.join(
  projectRoot,
  'public',
  'data',
  'authoritative_story_publications.json',
)

export const authoritativeStoryRegistrySchemaPath = path.join(
  projectRoot,
  'schemas',
  'authoritative-story-publications-v1.schema.json',
)

const analysisPaths = {
  rawSummary: path.join(projectRoot, '.analysis', 'raw-source', 'raw_manifest_summary.json'),
  storyCoverage: path.join(projectRoot, '.analysis', 'raw-migration', 'story', 'coverage.json'),
  voiceGaps: path.join(projectRoot, '.analysis', 'raw-migration', 'story', 'voice_gap_audit.json'),
  cardCoverage: path.join(projectRoot, '.analysis', 'raw-migration', 'card', 'coverage.json'),
  masterdataScan: path.join(projectRoot, '.analysis', 'masterdata', 'masterdata_table_scan.json'),
}

const publicPaths = {
  compiled: path.join(projectRoot, 'public', 'data', 'compiled'),
  cardIndex: path.join(projectRoot, 'public', 'data', 'masterdata', 'card_index.json'),
  backmonitor: path.join(projectRoot, 'public', 'assets', 'live-chibi', 'backmonitor', 'index.json'),
  publicationManifest: path.join(projectRoot, 'public', 'data', 'publication', 'manifest.json'),
}

function readJson(filename) {
  return JSON.parse(readFileSync(filename, 'utf8'))
}

function git(...args) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function listFiles(directory, predicate = () => true) {
  if (!existsSync(directory)) return []
  const files = []
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) visit(target)
      else if (entry.isFile() && predicate(entry, target)) files.push(target)
    }
  }
  visit(directory)
  return files.sort()
}

function directFiles(directory, predicate = () => true) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && predicate(entry))
    .map(entry => path.join(directory, entry.name))
    .sort()
}

function fileStats(files) {
  return files.reduce(
    (result, filename) => {
      result.files += 1
      result.bytes += statSync(filename).size
      return result
    },
    { files: 0, bytes: 0 },
  )
}

function trackedPngStats() {
  const output = git('ls-files', '--', '*.png')
  const files = output ? output.split(/\r?\n/).filter(Boolean) : []
  return fileStats(files.map(filename => path.resolve(projectRoot, filename)))
}

function compiledStats() {
  const isJson = entry => entry.name.toLowerCase().endsWith('.json')
  return {
    recursive_json_artifacts: listFiles(publicPaths.compiled, isJson).length,
    root_json_artifacts: directFiles(publicPaths.compiled, isJson).length,
    direct_episode_json_artifacts: directFiles(
      path.join(publicPaths.compiled, 'episodes'),
      isJson,
    ).length,
  }
}

export function authoritativeV2Stats({ sourceOnly = false } = {}) {
  const registry = readJson(authoritativeStoryRegistryPath)
  const publicationManifest = readJson(publicPaths.publicationManifest)
  const logicalIds = new Set()
  const artifactPaths = new Set()
  const collections = []
  const standalone = []
  const ledgerGoverned = []
  const preLedger = []

  for (const entry of registry.entries || []) {
    if (logicalIds.has(entry.logical_id)) {
      throw new Error(`duplicate authoritative Story logical ID: ${entry.logical_id}`)
    }
    logicalIds.add(entry.logical_id)

    const roles = new Set()
    for (const artifact of entry.artifacts || []) {
      if (artifactPaths.has(artifact.path)) {
        throw new Error(`duplicate authoritative Story artifact: ${artifact.path}`)
      }
      artifactPaths.add(artifact.path)
      roles.add(artifact.role)

      const requireMountedArtifact =
        !sourceOnly || entry.ownership.state === 'ledger-governed'
      if (requireMountedArtifact) {
        const filename = path.join(projectRoot, artifact.path)
        if (!existsSync(filename)) {
          throw new Error(`authoritative Story artifact does not exist: ${artifact.path}`)
        }
        const payload = readJson(filename)
        if (payload.schema_version !== 2 || payload.runtime_contract !== 'story-runtime-v2') {
          throw new Error(`authoritative Story artifact is not Runtime v2: ${artifact.path}`)
        }
        if (
          payload.scenario_id !== entry.scenario_id &&
          !payload.scenario_id?.startsWith(`${entry.scenario_id}_`)
        ) {
          throw new Error(`authoritative Story scenario identity drifted: ${artifact.path}`)
        }
      }
    }

    if (entry.kind === 'collection') {
      if (!roles.has('aggregate') || !roles.has('episode')) {
        throw new Error(`authoritative collection lacks aggregate or episode: ${entry.logical_id}`)
      }
      collections.push(entry.scenario_id)
    } else {
      if (entry.artifacts.length !== 1 || !roles.has('standalone')) {
        throw new Error(`authoritative standalone shape drifted: ${entry.logical_id}`)
      }
      standalone.push(entry.scenario_id)
    }

    const manifestState = publicationManifest.by_logical_id?.[entry.logical_id] || null
    if (entry.ownership.state === 'ledger-governed') {
      if (!manifestState || manifestState.release_id !== entry.ownership.release_id) {
        throw new Error(`ledger ownership drifted: ${entry.logical_id}`)
      }
      const registryPublishedPaths = entry.artifacts
        .map(artifact => `web_viewer/${artifact.path}`)
        .sort()
      const manifestPublishedPaths = (manifestState.artifacts || [])
        .map(artifact => artifact.path)
        .sort()
      if (stableJson(registryPublishedPaths) !== stableJson(manifestPublishedPaths)) {
        throw new Error(`ledger artifact ownership drifted: ${entry.logical_id}`)
      }
      ledgerGoverned.push(entry.logical_id)
    } else {
      if (manifestState) {
        throw new Error(`pre-ledger Story unexpectedly appears in ledger: ${entry.logical_id}`)
      }
      preLedger.push(entry.logical_id)
    }
  }

  return {
    collection_count: collections.length,
    standalone_count: standalone.length,
    artifact_count: artifactPaths.size,
    collections: collections.sort(),
    standalone: standalone.sort(),
    ledger_governed: ledgerGoverned.sort(),
    pre_ledger: preLedger.sort(),
  }
}

function publicCardStats() {
  const payload = readJson(publicPaths.cardIndex)
  const cards = Array.isArray(payload.cards) ? payload.cards : []
  return {
    normalized_entities: new Set(cards.map(card => card.resource_id).filter(Boolean)).size,
  }
}

function backmonitorStats({ sourceOnly = false } = {}) {
  if (sourceOnly || !existsSync(publicPaths.backmonitor)) {
    return {
      availability: 'not-mounted',
      mapped: null,
      movie_relations: null,
      transition_relations: null,
    }
  }
  const payload = readJson(publicPaths.backmonitor)
  const movies = Object.keys(payload.assets || {}).length
  const transitions = Object.keys(payload.transitions || {}).length
  return {
    availability: 'mounted',
    mapped: movies + transitions,
    movie_relations: movies,
    transition_relations: transitions,
  }
}

function resolveConfiguredSources() {
  const sources = loadArchiveSources()
  const config = readJson(sources.configPath)
  return {
    rawRoot: path.resolve(sources.archiveRoot, config.raw_root),
    masterdataSource: path.resolve(sources.archiveRoot, config.masterdata_source_file),
    masterdataDecoded: path.resolve(sources.archiveRoot, config.masterdata_decoded_file),
    expectedSourceSha256: config.masterdata_source_sha256,
    expectedDecodedSha256: config.masterdata_decoded_sha256,
  }
}

async function sha256(filename) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk)
  return hash.digest('hex')
}

function rawLiveStats(rawRoot) {
  const sections = ['asset', 'audio', 'movie']
  const sectionFiles = Object.fromEntries(
    sections.map(section => [
      section,
      listFiles(path.join(rawRoot, section)),
    ]),
  )
  const rootFiles = directFiles(rawRoot)
  const allFiles = [...rootFiles, ...Object.values(sectionFiles).flat()]
  const extensions = {}
  for (const filename of allFiles) {
    const extension = path.extname(filename).toLowerCase()
    extensions[extension] = (extensions[extension] || 0) + 1
  }
  return {
    files: allFiles.length,
    total_bytes: fileStats(allFiles).bytes,
    sections: {
      asset: sectionFiles.asset.length,
      audio: sectionFiles.audio.length,
      movie: sectionFiles.movie.length,
      root: rootFiles.length,
    },
    types: {
      unity_bundles: extensions['.unity3d'] || 0,
      acb: extensions['.acb'] || 0,
      awb: extensions['.awb'] || 0,
      usm: extensions['.usm'] || 0,
      wav: extensions['.wav'] || 0,
    },
    image_bundles: sectionFiles.asset.filter(filename =>
      /^image_.*\.unity3d$/i.test(path.basename(filename)),
    ).length,
  }
}

function analysisStats() {
  const required = Object.values(analysisPaths)
  if (!required.every(existsSync)) return null

  const rawSummary = readJson(analysisPaths.rawSummary)
  const story = readJson(analysisPaths.storyCoverage).summary
  const voiceGaps = readJson(analysisPaths.voiceGaps).summary
  const cards = readJson(analysisPaths.cardCoverage).summary
  const masterdataScan = readJson(analysisPaths.masterdataScan)

  return {
    raw_manifest: {
      files: rawSummary.file_count,
      total_bytes: rawSummary.total_size,
      sections: rawSummary.section_counts,
      types: {
        unity_bundles: rawSummary.extension_counts?.['.unity3d'] || 0,
        acb: rawSummary.extension_counts?.['.acb'] || 0,
        awb: rawSummary.extension_counts?.['.awb'] || 0,
        usm: rawSummary.extension_counts?.['.usm'] || 0,
        wav: rawSummary.extension_counts?.['.wav'] || 0,
      },
    },
    masterdata: {
      records: Object.values(masterdataScan)
        .reduce((total, table) => total + (Number(table.records) || 0), 0),
      table_ids: Object.keys(masterdataScan).length,
    },
    story: {
      logical_groups: story.logical_groups,
      valid_parts: story.valid_scenario_text_assets,
      groups_with_unique_public_match: story.groups_with_unique_public_match,
      parts_represented_in_public: story.parts_represented_in_public,
      compile_errors: Array.isArray(readJson(analysisPaths.storyCoverage).compile_errors)
        ? readJson(analysisPaths.storyCoverage).compile_errors.length
        : null,
      compiled_steps: story.compiled_steps,
      voice_references: story.voice_references,
      voice_resolved: story.voice_resolved,
      voice_dangling: voiceGaps.raw_authored_dangling,
    },
    cards: {
      masterdata_rows: cards.masterdata_card_rows,
      unique_resource_ids: cards.masterdata_unique_resource_ids,
      raw_matched: cards.matched,
    },
  }
}

export async function collectArchiveBaseline({
  sourceOnly = false,
  captureCommit,
  generatedAt,
} = {}) {
  const repositoryCommit = captureCommit || git('rev-parse', 'HEAD')
  const capturedAt = generatedAt || git('show', '-s', '--format=%cI', repositoryCommit)
  const analysis = analysisStats()
  const compiled = compiledStats()
  const authoritativeV2 = authoritativeV2Stats({ sourceOnly })
  const trackedPng = trackedPngStats()
  const cards = publicCardStats()
  const backmonitor = backmonitorStats({ sourceOnly })
  const configured = resolveConfiguredSources()
  const rawMounted = !sourceOnly && existsSync(configured.rawRoot)
  const masterdataMounted = !sourceOnly &&
    existsSync(configured.masterdataSource) &&
    existsSync(configured.masterdataDecoded)
  const raw = rawMounted ? rawLiveStats(configured.rawRoot) : null

  const masterdata = masterdataMounted
    ? {
        availability: 'mounted',
        source: {
          bytes: statSync(configured.masterdataSource).size,
          sha256: await sha256(configured.masterdataSource),
          expected_sha256: configured.expectedSourceSha256,
        },
        decoded: {
          bytes: statSync(configured.masterdataDecoded).size,
          sha256: await sha256(configured.masterdataDecoded),
          expected_sha256: configured.expectedDecodedSha256,
        },
        records: analysis?.masterdata.records ?? null,
        table_ids: analysis?.masterdata.table_ids ?? null,
      }
    : {
        availability: 'not-mounted',
        source: null,
        decoded: null,
        records: analysis?.masterdata.records ?? null,
        table_ids: analysis?.masterdata.table_ids ?? null,
      }

  return {
    schema_version: 1,
    generated_at: capturedAt,
    repository: {
      commit: repositoryCommit,
    },
    source_availability: {
      raw: rawMounted ? 'mounted' : 'not-mounted',
      masterdata: masterdataMounted ? 'mounted' : 'not-mounted',
      local_analysis: analysis ? 'mounted' : 'not-mounted',
    },
    raw: {
      availability: rawMounted ? 'mounted' : 'not-mounted',
      files: raw?.files ?? null,
      total_bytes: raw?.total_bytes ?? null,
      sections: raw?.sections ?? null,
      types: raw?.types ?? null,
      image_bundles: raw?.image_bundles ?? null,
      recorded_manifest: analysis?.raw_manifest ?? null,
    },
    masterdata,
    story: {
      availability: analysis ? 'mounted' : 'not-mounted',
      ...(analysis?.story || {
        logical_groups: null,
        valid_parts: null,
        groups_with_unique_public_match: null,
        parts_represented_in_public: null,
        compile_errors: null,
        compiled_steps: null,
        voice_references: null,
        voice_resolved: null,
        voice_dangling: null,
      }),
      compiled_artifacts: compiled,
      authoritative_v2: authoritativeV2,
    },
    cards: {
      availability: analysis ? 'mounted' : 'source-only',
      masterdata_rows: analysis?.cards.masterdata_rows ?? null,
      unique_resource_ids: analysis?.cards.unique_resource_ids ?? cards.normalized_entities,
      raw_matched: analysis?.cards.raw_matched ?? null,
      portal_normalized_entities: cards.normalized_entities,
    },
    tracked_binaries: {
      png_files: trackedPng.files,
      png_bytes: trackedPng.bytes,
    },
    movies: {
      raw_usm: raw?.types.usm ?? analysis?.raw_manifest.types.usm ?? null,
      backmonitor_mapped: backmonitor.mapped,
      unresolved: backmonitor.mapped == null
        ? null
        : raw
        ? raw.types.usm - backmonitor.mapped
        : analysis
          ? analysis.raw_manifest.types.usm - backmonitor.mapped
          : null,
      evidence: {
        availability: backmonitor.availability,
        movie_relations: backmonitor.movie_relations,
        transition_relations: backmonitor.transition_relations,
      },
    },
  }
}

export function findAbsolutePathStrings(value, pointer = '$', results = []) {
  if (typeof value === 'string') {
    if (/^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value)) results.push(pointer)
    return results
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findAbsolutePathStrings(item, `${pointer}[${index}]`, results))
    return results
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      findAbsolutePathStrings(item, `${pointer}.${key}`, results)
    }
  }
  return results
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}
