import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { loadStudioIndexes, loadStudioDocument, projectRoot, sha256 } from './lib/ai-studio-source.mjs'
import { parseStudioResult, renderStudioInput, checkStudioRows } from './lib/ai-studio-markdown.mjs'
import { validateStoryTranslationOverlay } from '../src/localization/story/TranslationRepository.js'
import { restoreProducerAddressingAfterTranslation, protectProducerAddressingForTranslation } from '../src/localization/story/ProducerAddressing.js'

// Editorial drafts replay original model output → optional ID remap / metadata row fill → logged edits → public overlays.
const drafts = [
  { dir: 'B002-main-r31-edited-20261001', documents: 59, units: 999 },
  { dir: 'B003-main-r33-edited-20261007', documents: 63, units: 991 },
  { dir: 'B004-main-r33-edited-20261007', documents: 30, units: 500 },
  { dir: 'B005-unit-story-r33-edited-20261007', documents: 86, units: 995 },
  { dir: 'B006-unit-story-r33-edited-20261007', documents: 88, units: 999 },
  { dir: 'B007-unit-story-r33-edited-20261007', documents: 81, units: 997 },
  { dir: 'B008-unit-story-r33-edited-20261007', documents: 83, units: 997 },
  { dir: 'B009-unit-story-r33-edited-20261008', documents: 85, units: 996 },
  { dir: 'B010-unit-story-r33-edited-20261008', documents: 87, units: 998 },
  { dir: 'B011-unit-story-r33-edited-20261008', documents: 30, units: 360 },
  { dir: 'B012-idol-story-r33-edited-20261008', documents: 81, units: 997 },
  { dir: 'B013-idol-story-r33-edited-20261008', documents: 82, units: 1000 },
  { dir: 'B014-idol-story-r33-edited-20261008', documents: 73, units: 997 },
  { dir: 'B015-idol-story-r33-edited-20261008', documents: 76, units: 999 },
  { dir: 'B016-idol-story-r33-edited-20261008', documents: 81, units: 988 },
  { dir: 'B017-idol-story-r33-edited-20261008', documents: 26, units: 339 },
  { dir: 'B018-event-r33-edited-20261008', documents: 54, units: 993 },
  { dir: 'B019-event-r33-edited-20261008', documents: 67, units: 982 },
  { dir: 'B020-event-r33-edited-20261008', documents: 66, units: 995 },
  { dir: 'B021-event-r33-edited-20261008', documents: 71, units: 994 },
  { dir: 'B022-event-r33-edited-20261008', documents: 69, units: 991 },
  { dir: 'B023-event-r33-edited-20261008', documents: 59, units: 886 },
]
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'))
const indexes = await loadStudioIndexes()
for (const { dir, documents, units: expectedUnits } of drafts) {
  const root = path.join(projectRoot, 'translation/studio/reviews', dir)
  const receipt = await read(path.join(root, 'receipt.json'))
  const batch = await read(path.join(root, 'batch-map.json'))
  const originalBytes = await fs.readFile(path.join(root, 'output.original.md'))
  const editedBytes = await fs.readFile(path.join(root, 'output.edited.md'))
  const editBytes = await fs.readFile(path.join(root, 'edits.json'))
  assert.equal(receipt.status, 'draft')
  assert.equal(receipt.not_final, true)
  assert.equal(receipt.source_commit, batch.source_commit)
  assert.equal(sha256(renderStudioInput(batch)), receipt.input_sha256)
  assert.equal(sha256(originalBytes), receipt.original_output_sha256)
  assert.equal(sha256(editedBytes), receipt.edited_output_sha256)
  assert.equal(sha256(editBytes), receipt.edits_sha256)
  const ids = batch.rows.map(r => r.rid)
  let startText = originalBytes.toString('utf8')
  if (receipt.id_remap) {
    // The only permitted repair of model IDs: a recorded, uniform offset that keeps every text byte.
    const remap = await read(path.join(root, receipt.id_remap))
    assert.equal(remap.original_sha256, receipt.original_output_sha256)
    assert.match(remap.rule, /^T00xxxx \(>= T001000\) → minus 900$/u)
    startText = startText.split('\n').map(line => line.replace(/^\| T(\d{6}) \|/u, (match, digits) =>
      +digits < 1000 ? match : `| T${String(+digits - 900).padStart(6, '0')} |`)).join('\n')
    assert.equal(sha256(startText), remap.output_sha256)
    assert.equal(sha256(startText), receipt.remapped_output_sha256)
    assert.notDeepEqual(parseStudioResult(originalBytes.toString('utf8'), ids).errors, [], 'Remap recorded for output that needed none')
  }
  // The only permitted row fill: invisible choice metadata the model skipped, copied verbatim from source.
  for (const fill of receipt.row_fills || []) {
    const row = batch.rows.find(r => r.rid === fill.rid)
    assert.equal(row.kind, 'choice_metadata')
    assert.equal(fill.text, row.source_text)
    assert(parseStudioResult(startText, ids).missing.includes(fill.rid), `Fill recorded for a row the model returned: ${fill.rid}`)
    startText = startText.replace(/\n*$/u, `\n| ${fill.rid} | ${fill.text} |\n`)
  }
  const before = parseStudioResult(startText, ids)
  const after = parseStudioResult(editedBytes.toString('utf8'), ids)
  assert.deepEqual(before.errors, [])
  assert.deepEqual(after.errors, [])
  assert.equal(after.translations.size, expectedUnits)
  assert.deepEqual(checkStudioRows(batch.rows, after.translations, { trialPolicy: batch.trial_policy }).blocking, [])
  const replay = new Map(before.translations)
  for (const edit of JSON.parse(editBytes)) {
    const row = batch.rows.find(r => r.rid === edit.rid)
    assert.equal(edit.unit_id, row.unit_id)
    assert.equal(edit.source_hash, row.source_hash)
    assert.equal(edit.source, row.source_text)
    assert.equal(replay.get(edit.rid), edit.before)
    replay.set(edit.rid, edit.after)
  }
  assert.deepEqual(replay, after.translations)
  if (dir.startsWith('B002')) {
    assert(after.translations.get('T000287').includes('こうひょう'))
    assert(after.translations.get('T000289').includes('しゅうにん'))
    assert(after.translations.get('T000188').startsWith('实，'))
    for (const id of ['T000138', 'T000569', 'T000690', 'T000365'])
      assert.equal(before.translations.get(id), after.translations.get(id))
  }
  for (const doc of batch.documents) {
    const entry = indexes.reading.entries.find(e => e.document_id === doc.document_id)
    const live = await loadStudioDocument(entry, indexes)
    assert.equal(doc.reader_sha256, live.readerHash)
    assert.equal(doc.compiled_sha256, live.compiledHash)
    assert.deepEqual(doc.evidence, live.evidence)
  }
  let units = 0
  for (const file of receipt.files) {
    const bytes = await fs.readFile(path.join(projectRoot, `public/translations/zh-CN/scenarios/${file.scenario_id}.json`))
    assert.equal(sha256(bytes), file.sha256)
    const overlay = JSON.parse(bytes)
    assert(validateStoryTranslationOverlay(overlay, { scenarioId: file.scenario_id, locale: 'zh-CN' }).valid)
    const doc = batch.documents.find(d => d.scenario_id === file.scenario_id)
    assert.equal(overlay.source_raw_hash, doc.evidence.source_raw_hash)
    for (const [id, value] of Object.entries(overlay.entries)) {
      const row = batch.rows.find(r => r.unit_id === id)
      assert.equal(value.status, 'draft')
      assert.equal(value.source_hash, row.source_hash)
      // importStoryTranslationDraft restores immutable addressing tokens to RAW macros.
      assert.equal(value.text, restoreProducerAddressingAfterTranslation(after.translations.get(row.rid), protectProducerAddressingForTranslation(row.source_text)))
      units++
    }
  }
  assert.equal(units, expectedUnits)
  assert.equal(receipt.files.length, documents)
  console.log(`${dir}: ${documents} documents/catalogues, ${units} rows, source identities, edit replay and protected addresses verified`)
}
