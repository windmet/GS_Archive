import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { checkStudioBatch } from './lib/ai-studio-check.mjs'
import { mergeStudioPreviewOverlays } from './lib/ai-studio-preview.mjs'
import { projectRoot, sha256 } from './lib/ai-studio-source.mjs'

if (process.argv.length !== 5 || process.argv[3] !== '--out')
  throw Error('Usage: node scripts/prepare-studio-reader-preview.mjs BATCH_FOLDER --out .analysis/translation-preview/NAME')
const { batch, report, overlays } = await checkStudioBatch(process.argv[2])
assert.equal(report.structure, 'PASS', `Batch structure failed: ${report.blocking.join('; ')}`)
assert.equal(report.scope, 'full-batch', 'Partial pilot cannot be presented as a full Reader batch')
const base = path.resolve(projectRoot, '.analysis/translation-preview')
const out = path.resolve(projectRoot, process.argv[4])
assert(out.startsWith(base + path.sep), 'Preview output must stay under .analysis/translation-preview')
const { byCatalog, units } = mergeStudioPreviewOverlays(overlays)
assert.equal(units, report.expected, 'Preview text coverage changed')
await fs.mkdir(base, { recursive: true })
await fs.mkdir(out)
const folder = path.join(out, 'zh-CN/scenarios')
await fs.mkdir(folder, { recursive: true })
const files = []
for (const [id, overlay] of byCatalog) {
  assert(/^[A-Za-z0-9._-]+$/u.test(id), `Unsafe scenario ID: ${id}`)
  const data = JSON.stringify(overlay, null, 2) + '\n'
  await fs.writeFile(path.join(folder, `${id}.json`), data, { flag: 'wx' })
  files.push({ scenario_id: id, entries: Object.keys(overlay.entries).length,
    sha256: sha256(data), path: `zh-CN/scenarios/${id}.json` })
}
const manifest = { schema: 'GS-LOCAL-READER-TRIAL-V1', source_commit: batch.source_commit,
  batch_id: batch.batch_id, output_sha256: report.output_sha256,
  documents: batch.documents.length, catalogues: byCatalog.size, units,
  overlay_status: 'draft', human_status: 'unreviewed',
  review_warnings: report.review.length, public_translation_changed: false, files }
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ out, documents: manifest.documents, catalogues: manifest.catalogues,
  units, overlay_status: manifest.overlay_status, human_status: manifest.human_status }, null, 2))
