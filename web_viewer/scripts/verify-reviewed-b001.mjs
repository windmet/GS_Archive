import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { loadStudioIndexes, loadStudioDocument, projectRoot, sha256 } from './lib/ai-studio-source.mjs'
import { validateStoryTranslationOverlay } from '../src/localization/story/TranslationRepository.js'

const reviewDir = path.join(projectRoot, 'translation/studio/reviews/B001-main-r3-20260929')
const receipt = JSON.parse(await fs.readFile(path.join(reviewDir, 'receipt.json'), 'utf8'))
assert.equal(receipt.schema, 'GS-STUDIO-HUMAN-REVIEW-V1')
assert.equal(receipt.status, 'reviewed')
assert.equal(receipt.not_final, true)
assert.equal(receipt.documents, 52)
assert.equal(receipt.catalogues, 42)
assert.equal(receipt.units, 993)
assert.equal(receipt.machine_review_warnings.length, 15)
assert.equal(receipt.superseded_draft_units.length, 3)
assert.equal(sha256(await fs.readFile(path.join(reviewDir, 'output.md'))), receipt.output_sha256)
const reviewed = []
const documentIds = new Set()
for (const item of receipt.files) {
  const bytes = await fs.readFile(path.join(projectRoot, 'public/translations/zh-CN/scenarios', `${item.scenario_id}.json`))
  assert.equal(sha256(bytes), item.sha256, `Reviewed file drift: ${item.scenario_id}`)
  const overlay = JSON.parse(bytes)
  assert.deepEqual(validateStoryTranslationOverlay(overlay, { scenarioId: item.scenario_id, locale: 'zh-CN' }),
    { valid: true, errors: [] })
  assert.equal(Object.keys(overlay.entries).length, item.entries)
  for (const unitId of Object.keys(overlay.entries)) documentIds.add(unitId.split(':')[3])
  reviewed.push({ item, overlay })
}
assert.equal(documentIds.size, 52)
const indexes = await loadStudioIndexes()
const expected = new Map()
for (const entry of indexes.reading.entries.filter(item => documentIds.has(item.document_id))) {
  const document = await loadStudioDocument(entry, indexes)
  if (!document.evidence.text_units.length) continue
  const target = expected.get(document.evidence.scenario_id)
    || { rawHash: document.evidence.source_raw_hash, units: new Map() }
  assert.equal(target.rawHash, document.evidence.source_raw_hash)
  for (const unit of document.evidence.text_units) {
    assert(!target.units.has(unit.unit_id))
    target.units.set(unit.unit_id, unit.source_hash)
  }
  expected.set(document.evidence.scenario_id, target)
}
let units = 0
for (const { item, overlay } of reviewed) {
  const source = expected.get(item.scenario_id)
  assert(source, `Unknown reviewed catalogue: ${item.scenario_id}`)
  assert.equal(overlay.source_raw_hash, source.rawHash)
  assert.equal(item.entries, source.units.size)
  for (const [unitId, value] of Object.entries(overlay.entries)) {
    assert.equal(value.source_hash, source.units.get(unitId), `Source hash mismatch: ${unitId}`)
    assert.equal(value.status, 'reviewed', `Not reviewed: ${unitId}`)
    units += 1
  }
  expected.delete(item.scenario_id)
}
assert.equal(expected.size, 0)
assert.equal(units, 993)
console.log('B001 reviewed publication verified: 52 documents, 42 catalogues, 993 source-bound units')
