import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import {
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
  report.movies?.raw_usm - report.movies?.backmonitor_mapped !==
  report.movies?.unresolved
) {
  failures.push('USM mapped and unresolved totals do not equal the RAW USM population')
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
]
for (const section of alwaysCheckedSections) {
  if (stableJson(report[section]) !== stableJson(actual[section])) {
    failures.push(`${section} drifted`)
  }
}

for (const section of ['story', 'cards', 'movies']) {
  const expected = structuredClone(report[section])
  const observed = structuredClone(actual[section])
  if (sourceOnly) {
    if (section === 'story') {
      for (const key of Object.keys(expected)) {
        if (!['availability', 'compiled_artifacts'].includes(key)) delete expected[key]
      }
      for (const key of Object.keys(observed)) {
        if (!['availability', 'compiled_artifacts'].includes(key)) delete observed[key]
      }
      delete expected.availability
      delete observed.availability
    }
    if (section === 'cards') {
      for (const key of ['availability', 'masterdata_rows', 'raw_matched']) {
        delete expected[key]
        delete observed[key]
      }
    }
    if (section === 'movies') {
      continue
    }
  }
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
