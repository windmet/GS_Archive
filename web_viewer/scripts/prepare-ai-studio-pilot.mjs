import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { projectRoot, sha256 } from './lib/ai-studio-source.mjs'
import { renderStudioInput } from './lib/ai-studio-markdown.mjs'

if (process.argv.length !== 3) throw Error('Usage: node scripts/prepare-ai-studio-pilot.mjs .analysis/translation-studio/RUN')
const run = path.resolve(projectRoot, process.argv[2])
const base = path.resolve(projectRoot, '.analysis/translation-studio')
assert(run.startsWith(base + path.sep), 'Run must stay under .analysis/translation-studio')
const parentFolder = path.join(run, 'B001-main')
const parent = JSON.parse(await fs.readFile(path.join(parentFolder, 'batch-map.json'), 'utf8'))
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
assert.equal(parent.source_commit, head, 'Regenerate parent batch after HEAD changes')
assert.equal(parent.projection_version, 3, 'R3 pilot requires V3 parent')
assert.equal(parent.rows.length, 993)
const selectionBytes = await fs.readFile(path.join(projectRoot, 'translation/studio/pilots/r3-b001-selection.json'))
const selection = JSON.parse(selectionBytes)
const selectedIds = new Set(selection.ids)
const selectedDocs = new Set(selection.complete_documents)
const documents = parent.documents.filter((_, index) => selectedDocs.has(`D${String(index + 1).padStart(3, '0')}`))
assert.equal(documents.length, 7)
const documentIds = new Set(documents.map(document => document.document_id))
const rows = parent.rows.filter(row => documentIds.has(row.document_id))
assert.equal(rows.length, selection.rows)
assert.deepEqual(rows.map(row => row.rid), selection.ids, 'Pilot IDs or document boundaries drifted')
const actorIds = new Set(rows.map(row => row.context?.actor?.entity_id).filter(Boolean))
const voiceRoster = Object.fromEntries(Object.entries(parent.voice_roster).filter(([id]) => actorIds.has(id)))
const batch = { ...parent, batch_id: 'P001-r3-seven-docs', scope: 'pilot-only',
  parent: { batch_id: parent.batch_id, input_sha256: parent.input_sha256,
    rows: parent.rows.length, selection_sha256: sha256(selectionBytes) },
  documents, rows, voice_roster: voiceRoster,
  context_sha256: sha256(JSON.stringify(rows.map(row => row.context))) }
const input = renderStudioInput(batch)
batch.input_sha256 = sha256(input)
const folder = path.join(run, batch.batch_id)
await fs.mkdir(folder)
await fs.writeFile(path.join(folder, 'input.md'), input, { flag: 'wx' })
await fs.writeFile(path.join(folder, 'batch-map.json'), JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' })
await fs.writeFile(path.join(folder, 'run-record.template.json'), JSON.stringify({
  batch_id: batch.batch_id, scope: batch.scope, source_commit: head,
  input_sha256: batch.input_sha256, model_display_name: null, model_version: null,
  web_settings: null, new_session: null, generated_at: null, raw_output_sha256: null,
  human_review_status: 'unreviewed',
}, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ folder, documents: documents.length, rows: rows.length,
  input_bytes: Buffer.byteLength(input), input_sha256: batch.input_sha256,
  scope: batch.scope }, null, 2))
