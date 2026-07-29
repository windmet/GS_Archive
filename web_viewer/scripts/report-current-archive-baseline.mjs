import { writeFile } from 'node:fs/promises'
import {
  collectArchiveBaseline,
  reportPath,
  stableJson,
} from './lib/archive-baseline-report.mjs'

const args = new Set(process.argv.slice(2))
const sourceOnly = args.has('--source-only') ||
  process.env.SIDEM_ARCHIVE_BASELINE_SOURCE_ONLY === '1'
const report = await collectArchiveBaseline({ sourceOnly })
const output = stableJson(report)

if (args.has('--stdout')) {
  process.stdout.write(output)
} else {
  await writeFile(reportPath, output, 'utf8')
  console.log(`Archive baseline report written: ${reportPath}`)
}
