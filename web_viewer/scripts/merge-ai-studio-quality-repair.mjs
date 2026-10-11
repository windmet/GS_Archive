import fs from 'node:fs/promises'
import path from 'node:path'
import { checkStudioBatch } from './lib/ai-studio-check.mjs'
import { mergeQualityPatch } from './lib/ai-studio-quality.mjs'
import { sha256 } from './lib/ai-studio-source.mjs'

if (process.argv.length !== 3) throw Error('Usage: node scripts/merge-ai-studio-quality-repair.mjs BATCH_FOLDER')
const { folder, batch, report } = await checkStudioBatch(process.argv[2])
if (report.structure !== 'PASS') throw Error('Parent output has structural errors')
const [parent, request, mapText, patch] = await Promise.all([
  fs.readFile(path.join(folder, 'output.md'), 'utf8'),
  fs.readFile(path.join(folder, 'quality-repair.md'), 'utf8'),
  fs.readFile(path.join(folder, 'quality-repair-map.json'), 'utf8'),
  fs.readFile(path.join(folder, 'quality-patch.md'), 'utf8'),
])
const merged = mergeQualityPatch(batch, parent, request, JSON.parse(mapText), patch)
const scratch = path.join(path.dirname(folder), `QCHECK-${batch.batch_id}-${sha256(merged.output).slice(7, 19)}`)
await fs.mkdir(scratch)
await fs.copyFile(path.join(folder, 'batch-map.json'), path.join(scratch, 'batch-map.json'))
await fs.copyFile(path.join(folder, 'input.md'), path.join(scratch, 'input.md'))
await fs.writeFile(path.join(scratch, 'output.md'), merged.output, { flag: 'wx' })
const checked = await checkStudioBatch(scratch)
if (checked.report.structure !== 'PASS') throw Error(`Merged output failed full batch check: ${checked.report.blocking.join('; ')}`)
await fs.writeFile(path.join(folder, 'output.merged.md'), merged.output, { flag: 'wx' })
await fs.writeFile(path.join(folder, 'quality-merge-report.json'), JSON.stringify({
  batch_id: batch.batch_id, changed: merged.changed, language_review: merged.review,
  full_check: checked.report.structure, full_language_review: checked.report.review,
  human_status: 'unreviewed', complete_batch: batch.scope !== 'pilot-only',
}, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ folder, changed: merged.changed, output: 'output.merged.md',
  human_status: 'unreviewed' }, null, 2))
