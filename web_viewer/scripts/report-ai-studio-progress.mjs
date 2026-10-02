import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { projectRoot } from './lib/ai-studio-source.mjs'

if (process.argv.length !== 3) throw Error('Usage: node scripts/report-ai-studio-progress.mjs .analysis/translation-studio/RUN')
const folder = path.resolve(projectRoot, process.argv[2])
const base = path.resolve(projectRoot, '.analysis/translation-studio')
assert(folder.startsWith(base + path.sep), 'Run must stay under .analysis/translation-studio')
const plan = JSON.parse(await fs.readFile(path.join(folder, 'plan.json'), 'utf8'))
const summary = { source_commit: plan.source_commit, planned_batches: plan.batches.length,
  planned_documents: plan.documents, planned_units: plan.units,
  structure_pass_batches: 0, structure_fail_batches: 0, untested_batches: 0,
  imported_draft_documents: 0, imported_draft_units: 0, review_flags: 0 }
for (const item of plan.batches) {
  const target = path.join(folder, item.batch_id)
  let report
  try { report = JSON.parse(await fs.readFile(path.join(target, 'check-report.json'), 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!report) summary.untested_batches++
  else {
    assert.equal(report.batch_id, item.batch_id)
    if (report.structure === 'PASS') summary.structure_pass_batches++
    else summary.structure_fail_batches++
    summary.review_flags += report.review.length
  }
  let files = []
  try { files = (await fs.readdir(path.join(target, 'draft-overlays'))).filter(file => file.endsWith('.json')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (files.length) {
    assert(report?.structure === 'PASS', `Imported draft with failed structural check: ${item.batch_id}`)
    const map = JSON.parse(await fs.readFile(path.join(target, 'batch-map.json'), 'utf8'))
    assert.equal(files.length, map.documents.length)
    summary.imported_draft_documents += files.length
    summary.imported_draft_units += item.units
  }
}
console.log(JSON.stringify(summary, null, 2))
