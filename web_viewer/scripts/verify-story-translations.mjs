import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  diagnoseStoryTranslations,
  hasBlockingTranslationDiagnostics,
  renderTranslationDiagnosticsSummary,
} from '../src/localization/story/TranslationDiagnostics.js'
import { parseJsonStrict } from './lib/strict-json.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function argumentsMap(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (['require-complete', 'allow-issues'].includes(key)) values[key] = true
    else {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`Missing value for --${key}`)
      values[key] = argv[index + 1]
      index += 1
    }
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

async function verifyFixtures() {
  const fixture = await loadJson('fixtures/localization/translation-diagnostics-case.json')
  const report = diagnoseStoryTranslations({
    evidence: fixture.evidence,
    overlay: fixture.overlay,
    locale: fixture.locale,
  })
  assert.deepEqual(report.counts, fixture.expected_counts)
  assert.equal(hasBlockingTranslationDiagnostics(report), true)
  assert.equal(hasBlockingTranslationDiagnostics({ diagnostics: [{ code: 'missing' }] }), false)
  assert.equal(hasBlockingTranslationDiagnostics({ diagnostics: [{ code: 'missing' }] }, { requireComplete: true }), true)
  assert.match(renderTranslationDiagnosticsSummary(report), /stale=1/u)

  assert.throws(() => parseJsonStrict('{"entries":{"same":1,"same":2}}', 'duplicate-probe.json'), /duplicate object key "same"/u)

  const evidence = await loadJson('fixtures/localization/scenario-text-evidence-1_4_001_01_d.json')
  const overlay = await loadJson('fixtures/localization/scenario-overlay-zh-CN.json')
  const realFixtureReport = diagnoseStoryTranslations({ evidence, overlay, locale: 'zh-CN' })
  assert.equal(realFixtureReport.counts.source_units, 8)
  assert.equal(realFixtureReport.counts.overlay_entries, 3)
  assert.equal(realFixtureReport.counts.valid, 3)
  assert.equal(realFixtureReport.counts.missing, 5)
  assert.equal(realFixtureReport.counts.stale, 0)
  assert.equal(realFixtureReport.counts.orphaned, 0)
  assert.equal(realFixtureReport.counts.collision, 0)
  assert.equal(realFixtureReport.counts.invalid, 0)

  console.log('Story translation diagnostics verification passed')
  console.log('  missing/stale/orphaned/collision/invalid/control-character cases covered')
  console.log('  duplicate JSON keys rejected before object materialization')
  console.log('  1_4_001_01_d fixture: 3 translated, 5 explicitly reported missing')
}

async function main() {
  const options = argumentsMap(process.argv.slice(2))
  if (!options.evidence && !options.overlay) {
    await verifyFixtures()
    return
  }
  if (!options.evidence || !options.overlay) {
    throw new Error('Both --evidence and --overlay are required')
  }
  const report = diagnoseStoryTranslations({
    evidence: await loadJson(options.evidence),
    overlay: await loadJson(options.overlay),
    locale: options.locale || null,
  })
  const summary = renderTranslationDiagnosticsSummary(report)
  console.log(summary)
  if (options['json-out']) await writeText(options['json-out'], `${JSON.stringify(report, null, 2)}\n`)
  if (options['summary-out']) await writeText(options['summary-out'], `${summary}\n`)
  if (!options['allow-issues'] && hasBlockingTranslationDiagnostics(report, {
    requireComplete: options['require-complete'] === true,
  })) process.exitCode = 1
}

await main()
