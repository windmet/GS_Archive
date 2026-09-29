import {
  protectProducerAddressingForTranslation,
  restoreProducerAddressingAfterTranslation,
  validateProducerAddressingOverlay,
} from './ProducerAddressing.js'
import { collectStoryTextEvidence, parseStoryTextUnitId } from './TranslationDiagnostics.js'
import { validateStoryTranslationOverlay } from './TranslationRepository.js'

const HASH = /^sha256:[a-f0-9]{64}$/u

function sourceCatalog(evidence) {
  const catalog = collectStoryTextEvidence(evidence)
  if (catalog.collisions.length) throw new Error('Source text identities collide')
  const scenarioId = evidence?.text_catalog_id || evidence?.scenario_id
  const rawHash = evidence?.source?.raw_hash || evidence?.source_raw_hash
  if (typeof scenarioId !== 'string' || !scenarioId || !HASH.test(rawHash || '')) {
    throw new Error('Translation draft requires a published scenario id and RAW hash')
  }
  for (const record of catalog.records) {
    if (!parseStoryTextUnitId(record.unitId) || !HASH.test(record.sourceHash)
        || !record.sourceText || record.scenarioId !== scenarioId) {
      throw new Error(`Translation draft source lacks stable text identity: ${record.unitId || '(missing)'}`)
    }
  }
  return { catalog, scenarioId, rawHash }
}

/** Export source-bound model input; it never contains a local Producer display name. */
export function createStoryTranslationDraft(evidence, { locale = 'zh-CN', unitIds = null } = {}) {
  const { catalog, scenarioId, rawHash } = sourceCatalog(evidence)
  const selected = unitIds == null ? catalog.records.map(record => record.unitId) : unitIds
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length) {
    throw new Error('Translation draft unit selection is invalid or duplicated')
  }
  const entries = {}
  for (const unitId of selected) {
    const record = catalog.byUnitId.get(unitId)
    if (!record) throw new Error(`Translation source unit is missing: ${unitId}`)
    const protectedText = protectProducerAddressingForTranslation(record.sourceText)
    entries[unitId] = {
      source_hash: record.sourceHash,
      source: protectedText.text,
      translation: '',
    }
  }
  return { schema_version: 1, locale, scenario_id: scenarioId, source_raw_hash: rawHash, entries }
}

/** Import a completed draft into the existing strict overlay format. */
export function importStoryTranslationDraft(evidence, draft) {
  const { catalog, scenarioId, rawHash } = sourceCatalog(evidence)
  if (draft?.schema_version !== 1 || draft.scenario_id !== scenarioId
      || draft.source_raw_hash !== rawHash || typeof draft.locale !== 'string'
      || !draft.locale || !draft.entries || Array.isArray(draft.entries)
      || typeof draft.entries !== 'object') {
    throw new Error('Translation draft identity does not match source evidence')
  }
  const entries = {}
  for (const [unitId, item] of Object.entries(draft.entries)) {
    const record = catalog.byUnitId.get(unitId)
    if (!record || item?.source_hash !== record.sourceHash) {
      throw new Error(`Translation draft unit or hash changed: ${unitId}`)
    }
    const bundle = protectProducerAddressingForTranslation(record.sourceText)
    if (item.source !== bundle.text || typeof item.translation !== 'string'
        || !item.translation.trim()) {
      throw new Error(`Translation draft source or translated text is invalid: ${unitId}`)
    }
    const text = restoreProducerAddressingAfterTranslation(item.translation, bundle)
    if (!validateProducerAddressingOverlay(record.sourceText, text)) {
      throw new Error(`Translation draft Producer slots changed: ${unitId}`)
    }
    entries[unitId] = { source_hash: record.sourceHash, text, status: 'draft' }
  }
  const overlay = {
    schema_version: 1, locale: draft.locale, scenario_id: scenarioId,
    source_raw_hash: rawHash, entries,
  }
  const validation = validateStoryTranslationOverlay(overlay, { scenarioId, locale: draft.locale })
  if (!validation.valid) throw new Error(`Translation overlay rejected: ${validation.errors.join('; ')}`)
  return overlay
}
