import fs from 'node:fs/promises'
import path from 'node:path'
import { checkStudioBatch } from './lib/ai-studio-check.mjs'

if (process.argv.length !== 3) throw Error('Usage: node scripts/check-ai-studio-batch.mjs .analysis/translation-studio/RUN/BATCH')
const { folder, report, repair } = await checkStudioBatch(process.argv[2])
await fs.writeFile(path.join(folder, 'check-report.json'), JSON.stringify(report, null, 2) + '\n')
await fs.writeFile(path.join(folder, 'repair.md'), repair)
console.log(JSON.stringify(report, null, 2))
if (report.structure !== 'PASS') process.exitCode = 1
