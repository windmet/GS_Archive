import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildCompiledScenarioMigrationReport,
  renderCompiledScenarioMigrationSummary,
} from './lib/compiled-scenario-migration.mjs'
import { parseJsonStrict } from './lib/strict-json.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function parseArguments(argv) {
  const options = { check: false, 'max-differences': '200' }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--check') {
      options.check = true
      continue
    }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`Missing value for --${key}`)
    options[key] = argv[index + 1]
    index += 1
  }
  return options
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

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (!options.old || !options.new) {
    throw new Error('Usage: node scripts/report-compiled-scenario-migration.mjs --old <old.json> --new <new.json> [--json-out <report.json>] [--summary-out <summary.txt>] [--max-differences <count>] [--check]')
  }

  const maxDifferences = Number.parseInt(options['max-differences'], 10)
  if (!Number.isInteger(maxDifferences) || maxDifferences < 1) throw new Error('--max-differences must be a positive integer')

  const report = buildCompiledScenarioMigrationReport(
    await loadJson(options.old),
    await loadJson(options.new),
    { maxDifferences },
  )
  const summary = renderCompiledScenarioMigrationSummary(report)

  if (options['json-out']) await writeText(options['json-out'], `${JSON.stringify(report, null, 2)}\n`)
  else console.log(JSON.stringify(report, null, 2))

  if (options['summary-out']) await writeText(options['summary-out'], `${summary}\n`)
  else console.error(summary)

  if (options.check && !report.acceptance.passed) process.exitCode = 2
}

await main()
