import fs from 'node:fs/promises'
import path from 'node:path'
import { checkStudioBatch } from './lib/ai-studio-check.mjs'

if (process.argv.length !== 3) throw Error('Usage: node scripts/import-ai-studio-batch.mjs .analysis/translation-studio/RUN/BATCH')
const { folder, report, completed, overlays } = await checkStudioBatch(process.argv[2])
if (report.scope === 'pilot-only') throw Error('Pilot output is review-only; complete the parent batch before draft import')
if (report.structure !== 'PASS') throw Error(`Batch ${report.batch_id} has ${report.blocking.length} blocking errors`)
const draftDir = path.join(folder, 'completed-drafts'), overlayDir = path.join(folder, 'draft-overlays')
await fs.mkdir(draftDir, { recursive: true })
await fs.mkdir(overlayDir, { recursive: true })
const documents = [...completed.keys()]
for (const id of documents) {
  if (!/^[A-Za-z0-9._-]+$/u.test(id)) throw Error(`Unsafe document ID: ${id}`)
  for (const target of [path.join(draftDir, `${id}.json`), path.join(overlayDir, `${id}.json`)]) {
    try { await fs.access(target); throw Error(`Import target already exists: ${target}`) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}
for (const id of documents) {
  await fs.writeFile(path.join(draftDir, `${id}.json`), JSON.stringify(completed.get(id), null, 2) + '\n', { flag: 'wx' })
  await fs.writeFile(path.join(overlayDir, `${id}.json`), JSON.stringify(overlays.get(id), null, 2) + '\n', { flag: 'wx' })
}
console.log(JSON.stringify({ batch_id: report.batch_id, documents: documents.length,
  units: report.expected, status: 'draft', output: overlayDir, review_warnings: report.review.length }, null, 2))
