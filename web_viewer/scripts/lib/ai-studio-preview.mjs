import assert from 'node:assert/strict'
import { validateStoryTranslationOverlay } from '../../src/localization/story/TranslationRepository.js'

/** Combine complete Reader documents that share the runtime text catalogue. */
export function mergeStudioPreviewOverlays(overlays) {
  const byCatalog = new Map()
  let units = 0
  for (const [documentId, overlay] of overlays) {
    const check = validateStoryTranslationOverlay(overlay, { locale: 'zh-CN' })
    assert(check.valid, `${documentId}: ${check.errors.join('; ')}`)
    assert(Object.values(overlay.entries).every(entry => entry.status === 'draft'), 'Preview accepts draft entries only')
    const id = overlay.scenario_id
    let target = byCatalog.get(id)
    if (!target) {
      target = { schema_version: 1, locale: 'zh-CN', scenario_id: id,
        source_raw_hash: overlay.source_raw_hash, entries: {} }
      byCatalog.set(id, target)
    }
    assert.equal(target.source_raw_hash, overlay.source_raw_hash, `RAW identity conflict: ${id}`)
    for (const [unitId, entry] of Object.entries(overlay.entries)) {
      assert(!Object.hasOwn(target.entries, unitId), `Duplicate preview unit: ${unitId}`)
      target.entries[unitId] = entry
      units += 1
    }
  }
  for (const [id, overlay] of byCatalog) {
    const check = validateStoryTranslationOverlay(overlay, { scenarioId: id, locale: 'zh-CN' })
    assert(check.valid, `${id}: ${check.errors.join('; ')}`)
  }
  return { byCatalog, units }
}
