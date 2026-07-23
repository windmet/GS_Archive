import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createTranslationMigrationReport,
  renderTranslationMigrationSummary,
} from '../src/localization/story/TranslationDiagnostics.js'
import { parseJsonStrict } from './lib/strict-json.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function argumentsMap(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`Missing value for --${key}`)
    values[key] = argv[index + 1]
    index += 1
  }
  return values
}

async function loadJson(file) {
  const absolute = path.resolve(ROOT, file)
  return parseJsonStrict(await readFile(absolute, 'utf8'), absolute)
}

async function writeText(file, value) {
  const absolute = path.resolve(ROOT, file)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, value, 'utf8')
}

async function createReport(options) {
  return createTranslationMigrationReport({
    oldEvidence: await loadJson(options['old-evidence']),
    oldOverlay: await loadJson(options['old-overlay']),
    newEvidence: await loadJson(options['new-evidence']),
  })
}

async function verifyFixture() {
  const fixture = await loadJson('fixtures/localization/translation-migration-case.json')
  const report = createTranslationMigrationReport({
    oldEvidence: fixture.old_evidence,
    oldOverlay: fixture.old_overlay,
    newEvidence: fixture.new_evidence,
  })
  assert.deepEqual(report.counts, fixture.expected_counts)
  assert.deepEqual(Object.keys(report.candidate_overlay.entries), [
    'story-text:v1:migration_case:part_a:cmd-000001:dialogue:000',
  ])
  assert.equal(report.candidate_overlay.source_raw_hash, fixture.new_evidence.source_raw_hash)
  const nestedHashEvidence = structuredClone(fixture.new_evidence)
  delete nestedHashEvidence.source_raw_hash
  nestedHashEvidence.source = { raw_hash: fixture.new_evidence.source_raw_hash }
  const nestedHashReport = createTranslationMigrationReport({
    oldEvidence: fixture.old_evidence,
    oldOverlay: fixture.old_overlay,
    newEvidence: nestedHashEvidence,
  })
  assert.equal(nestedHashReport.new_source_raw_hash, fixture.new_evidence.source_raw_hash)
  assert.equal(nestedHashReport.candidate_overlay.source_raw_hash, fixture.new_evidence.source_raw_hash)
  assert.equal(
    report.records.find(record => record.classification === 'moved_high_confidence')?.requires_manual_confirmation,
    true,
  )
  assert.equal(
    report.records.find(record => record.classification === 'ambiguous')?.candidate_unit_ids.length,
    2,
  )
  assert.match(renderTranslationMigrationSummary(report), /Only matched_exact entries are safe/u)
  console.log('Story translation migration verification passed')
  console.log('  exact/stale/moved/ambiguous/orphaned/new classifications covered')
  console.log('  automatic candidate overlay contains exact matches only')
}

async function main() {
  const options = argumentsMap(process.argv.slice(2))
  if (Object.keys(options).length === 0) {
    await verifyFixture()
    return
  }
  for (const required of ['old-evidence', 'old-overlay', 'new-evidence']) {
    if (!options[required]) throw new Error(`--${required} is required`)
  }
  const report = await createReport(options)
  const summary = renderTranslationMigrationSummary(report)
  if (options['json-out']) await writeText(options['json-out'], `${JSON.stringify(report, null, 2)}\n`)
  else console.log(JSON.stringify(report, null, 2))
  if (options['summary-out']) await writeText(options['summary-out'], `${summary}\n`)
  else console.error(summary)
}

await main()
