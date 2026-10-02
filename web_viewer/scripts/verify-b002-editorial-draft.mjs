import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { loadStudioIndexes, loadStudioDocument, projectRoot, sha256 } from './lib/ai-studio-source.mjs'
import { parseStudioResult, renderStudioInput, checkStudioRows } from './lib/ai-studio-markdown.mjs'
import { validateStoryTranslationOverlay } from '../src/localization/story/TranslationRepository.js'
const root = path.join(projectRoot,'translation/studio/reviews/B002-main-r31-edited-20261001')
const read = async file => JSON.parse(await fs.readFile(file,'utf8'))
const receipt = await read(path.join(root,'receipt.json'))
const batch = await read(path.join(root,'batch-map.json'))
const originalBytes = await fs.readFile(path.join(root,'output.original.md'))
const editedBytes = await fs.readFile(path.join(root,'output.edited.md'))
const editBytes = await fs.readFile(path.join(root,'edits.json'))
assert.equal(receipt.status,'draft')
assert.equal(receipt.not_final,true)
assert.equal(receipt.source_commit,batch.source_commit)
assert.equal(sha256(renderStudioInput(batch)),receipt.input_sha256)
assert.equal(sha256(originalBytes),receipt.original_output_sha256)
assert.equal(sha256(editedBytes),receipt.edited_output_sha256)
assert.equal(sha256(editBytes),receipt.edits_sha256)
const ids = batch.rows.map(r=>r.rid)
const before = parseStudioResult(originalBytes.toString('utf8'),ids)
const after = parseStudioResult(editedBytes.toString('utf8'),ids)
assert.deepEqual(before.errors,[])
assert.deepEqual(after.errors,[])
assert.equal(after.translations.size,999)
assert.deepEqual(checkStudioRows(batch.rows,after.translations,{trialPolicy:batch.trial_policy}).blocking,[])
const replay = new Map(before.translations)
for (const edit of JSON.parse(editBytes)) {
  const row = batch.rows.find(r=>r.rid===edit.rid)
  assert.equal(edit.unit_id,row.unit_id)
  assert.equal(edit.source_hash,row.source_hash)
  assert.equal(edit.source,row.source_text)
  assert.equal(replay.get(edit.rid),edit.before)
  replay.set(edit.rid,edit.after)
}
assert.deepEqual(replay,after.translations)
assert(after.translations.get('T000287').includes('こうひょう'))
assert(after.translations.get('T000289').includes('しゅうにん'))
assert(after.translations.get('T000188').startsWith('实，'))
for (const id of ['T000138','T000569','T000690','T000365'])
  assert.equal(before.translations.get(id),after.translations.get(id))
const indexes = await loadStudioIndexes()
for (const doc of batch.documents) {
  const entry = indexes.reading.entries.find(e=>e.document_id===doc.document_id)
  const live = await loadStudioDocument(entry,indexes)
  assert.equal(doc.reader_sha256,live.readerHash)
  assert.equal(doc.compiled_sha256,live.compiledHash)
  assert.deepEqual(doc.evidence,live.evidence)
}
let units=0
for (const file of receipt.files) {
  const bytes=await fs.readFile(path.join(projectRoot,`public/translations/zh-CN/scenarios/${file.scenario_id}.json`))
  assert.equal(sha256(bytes),file.sha256)
  const overlay=JSON.parse(bytes)
  assert(validateStoryTranslationOverlay(overlay,{scenarioId:file.scenario_id,locale:'zh-CN'}).valid)
  const doc=batch.documents.find(d=>d.scenario_id===file.scenario_id)
  assert.equal(overlay.source_raw_hash,doc.evidence.source_raw_hash)
  for(const [id,value] of Object.entries(overlay.entries)) {
    const row=batch.rows.find(r=>r.unit_id===id)
    assert.equal(value.status,'draft')
    assert.equal(value.source_hash,row.source_hash)
    // importStoryTranslationDraft restores immutable addressing tokens to RAW macros.
    const { restoreProducerAddressingAfterTranslation, protectProducerAddressingForTranslation } = await import('../src/localization/story/ProducerAddressing.js')
    assert.equal(value.text,restoreProducerAddressingAfterTranslation(after.translations.get(row.rid),protectProducerAddressingForTranslation(row.source_text)))
    units++
  }
}
assert.equal(units,999)
assert.equal(receipt.files.length,59)
console.log('B002 edited draft verified: 59 documents/catalogues, 999 rows, source identities, edit replay and protected addresses')
