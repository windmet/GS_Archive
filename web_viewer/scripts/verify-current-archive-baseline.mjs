import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import {
  authoritativeStoryRegistryPath,
  authoritativeStoryRegistrySchemaPath,
  collectArchiveBaseline,
  findAbsolutePathStrings,
  projectRoot,
  reportPath,
  stableJson,
} from './lib/archive-baseline-report.mjs'

const sourceOnly = process.argv.includes('--source-only') ||
  process.env.SIDEM_ARCHIVE_BASELINE_SOURCE_ONLY === '1'
const failures = []
const report = JSON.parse(await readFile(reportPath, 'utf8'))
const [authoritativeRegistry, authoritativeRegistrySchema] = await Promise.all([
  readFile(authoritativeStoryRegistryPath, 'utf8').then(JSON.parse),
  readFile(authoritativeStoryRegistrySchemaPath, 'utf8').then(JSON.parse),
])
const validateAuthoritativeRegistry = new Ajv2020({ allErrors: true, strict: true })
  .compile(authoritativeRegistrySchema)

if (!validateAuthoritativeRegistry(authoritativeRegistry)) {
  failures.push(
    ...validateAuthoritativeRegistry.errors.map(error =>
      `authoritative Story registry ${error.instancePath || '/'} ${error.message}`,
    ),
  )
}

if (report.schema_version !== 1) failures.push('schema_version must be 1')
if (!/^[0-9a-f]{40}$/.test(report.repository?.commit || '')) {
  failures.push('repository.commit must be a full Git SHA')
}
if (Number.isNaN(Date.parse(report.generated_at))) {
  failures.push('generated_at must be an ISO date')
}

const absolutePaths = findAbsolutePathStrings(report)
if (absolutePaths.length) {
  failures.push(`report contains machine absolute paths: ${absolutePaths.join(', ')}`)
}

if (
  report.movies?.backmonitor_mapped !==
  report.movies?.evidence?.movie_relations + report.movies?.evidence?.transition_relations
) {
  failures.push('BackMonitor mapped total differs from movie plus transition evidence')
}
if (
  report.movies?.raw_usm -
    report.movies?.backmonitor_mapped -
    report.movies?.exact_client_relations -
    report.movies?.exact_masterdata_relations !==
  report.movies?.unresolved
) {
  failures.push(
    'USM consumer, masterdata, and unresolved totals do not equal the RAW USM population',
  )
}
if (report.movies?.exact_client_relations !== 12) {
  failures.push(
    'USM exact client population must remain 11 gasha start movies + 1 SSR movie',
  )
}
if (report.movies?.exact_masterdata_relations !== 166) {
  failures.push(
    'USM exact masterdata population must remain 30 MovieAnnounce + ' +
    '124 CardData skill-movie + 12 SongData movie relations',
  )
}
if (
  report.images?.relation_catalog?.bundles !== 1271 ||
  report.images?.relation_catalog?.image_objects !== 7816
) {
  failures.push('image relation catalog must remain 1271 bundles / 7816 image objects')
}
if (
  report.story?.voice_resolved + report.story?.voice_dangling !==
  report.story?.voice_references
) {
  failures.push('resolved and dangling voices do not equal total voice references')
}
if (
  report.story?.logical_groups !== report.story?.groups_with_unique_public_match ||
  report.story?.valid_parts !== report.story?.parts_represented_in_public
) {
  failures.push('story RAW population differs from the recorded public-match population')
}
if (
  report.story?.authoritative_v2?.collection_count !== 3 ||
  report.story?.authoritative_v2?.standalone_count !== 1 ||
  report.story?.authoritative_v2?.artifact_count !== 18
) {
  failures.push('authoritative Story v2 population must be 3 collections + 1 standalone / 18 artifacts')
}

const authoritativeSummary = report.story?.authoritative_v2
const authoritativeSummaryMarker =
  `<!-- authoritative-v2-summary collections=${authoritativeSummary?.collection_count} ` +
  `standalone=${authoritativeSummary?.standalone_count} ` +
  `artifacts=${authoritativeSummary?.artifact_count} -->`
const authoritativeSummaryDocuments = [
  '../README.md',
  'notes/03_audit/CURRENT_ARCHIVE_BASELINE_20260728.md',
  'notes/04_refactor/GS_ARCHIVE_P0_GOVERNANCE_HANDOFF_20260728.md',
]
for (const relativePath of authoritativeSummaryDocuments) {
  const document = await readFile(new URL(relativePath, new URL('../', import.meta.url)), 'utf8')
  if (!document.includes(authoritativeSummaryMarker)) {
    failures.push(`${relativePath} authoritative Story v2 summary marker drifted`)
  }
}
if (
  report.cards?.unique_resource_ids !== report.cards?.raw_matched ||
  report.cards?.unique_resource_ids !== report.cards?.portal_normalized_entities
) {
  failures.push('card resource, RAW match, and portal entity populations differ')
}

try {
  execFileSync(
    'git',
    ['merge-base', '--is-ancestor', report.repository.commit, 'HEAD'],
    { cwd: projectRoot, stdio: 'ignore' },
  )
} catch {
  failures.push('report repository.commit is not an ancestor of HEAD')
}

const actual = await collectArchiveBaseline({
  sourceOnly,
  captureCommit: report.repository.commit,
  generatedAt: report.generated_at,
})

const alwaysCheckedSections = [
  'schema_version',
  'generated_at',
  'repository',
  'tracked_binaries',
  'images',
]
for (const section of alwaysCheckedSections) {
  if (stableJson(report[section]) !== stableJson(actual[section])) {
    failures.push(`${section} drifted`)
  }
}

if (
  stableJson(report.story?.authoritative_v2) !==
  stableJson(actual.story?.authoritative_v2)
) {
  failures.push('story.authoritative_v2 drifted')
}

for (const section of ['story', 'cards', 'movies']) {
  if (sourceOnly) continue
  const expected = structuredClone(report[section])
  const observed = structuredClone(actual[section])
  if (stableJson(expected) !== stableJson(observed)) failures.push(`${section} drifted`)
}

if (!sourceOnly) {
  for (const section of ['source_availability', 'raw', 'masterdata']) {
    if (stableJson(report[section]) !== stableJson(actual[section])) {
      failures.push(`${section} drifted`)
    }
  }

  const rawManifest = report.raw?.recorded_manifest
  if (
    report.raw?.availability === 'mounted' &&
    rawManifest &&
    (
      report.raw.files !== rawManifest.files ||
      report.raw.total_bytes !== rawManifest.total_bytes ||
      stableJson(report.raw.sections) !== stableJson(rawManifest.sections) ||
      stableJson(report.raw.types) !== stableJson(rawManifest.types)
    )
  ) {
    failures.push('mounted RAW tree differs from recorded RAW manifest')
  }

  if (
    report.masterdata?.availability === 'mounted' &&
    (
      report.masterdata.source?.sha256 !== report.masterdata.source?.expected_sha256 ||
      report.masterdata.decoded?.sha256 !== report.masterdata.decoded?.expected_sha256
    )
  ) {
    failures.push('masterdata hash differs from configured expected SHA-256')
  }
} else if (
  actual.source_availability.raw !== 'not-mounted' ||
  actual.source_availability.masterdata !== 'not-mounted'
) {
  failures.push('source-only verification did not mark mounted sources as not-mounted')
}

if (failures.length) {
  console.error('Archive baseline verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(
    `Archive baseline verified (${sourceOnly ? 'source-only' : 'mounted'}): ` +
    `${report.story.compiled_artifacts.recursive_json_artifacts} compiled JSON artifacts, ` +
    `${report.tracked_binaries.png_files} tracked PNG files`,
  )
}
