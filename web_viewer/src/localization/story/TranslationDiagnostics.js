import { validateStoryTranslationOverlay } from './TranslationRepository.js'

const UNIT_ID_PATTERN = /^story-text:v1:([A-Za-z0-9._-]+):([A-Za-z0-9._-]+):cmd-([0-9]{6}):([A-Za-z0-9._-]+):([0-9]{3})$/
const BIDI_OR_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asString(value) {
  return typeof value === 'string' ? value : ''
}

function sourceRawHash(value) {
  const record = asRecord(value)
  return asString(record.source_raw_hash) || asString(asRecord(record.source).raw_hash) || null
}

export function parseStoryTextUnitId(unitId) {
  const match = UNIT_ID_PATTERN.exec(asString(unitId))
  if (!match) return null
  return {
    scenarioId: match[1],
    partId: match[2],
    commandIndex: Number(match[3]),
    fieldKind: match[4],
    fieldOrdinal: Number(match[5]),
  }
}

function speakerSignature(value) {
  const speaker = asRecord(value)
  const entityType = asString(speaker.entity_type ?? speaker.entityType)
  const entityId = asString(speaker.entity_id ?? speaker.entityId)
  if (entityType && entityId) return `entity:${entityType}:${entityId}`
  const kind = asString(speaker.kind)
  const sourceName = asString(speaker.source_name ?? speaker.sourceName)
  return `${kind || 'none'}:${sourceName}`
}

function normalizeEvidenceRecord(record, order) {
  const ref = asRecord(record.ref ?? record.text_ref ?? record.textRef)
  const unitId = asString(record.unit_id ?? record.unitId ?? ref.unit_id)
  const parsedId = parseStoryTextUnitId(unitId) || {}
  const source = asRecord(record.source ?? ref.source)
  return {
    unitId,
    sourceHash: asString(record.source_hash ?? record.sourceHash ?? ref.source_hash),
    sourceText: asString(record.source_text ?? record.sourceText ?? record.text),
    scenarioId: asString(source.scenario_id ?? record.scenario_id ?? record.scenarioId ?? parsedId.scenarioId),
    partId: asString(source.part_id ?? record.part_id ?? record.partId ?? parsedId.partId),
    commandIndex: Number.isInteger(source.command_index)
      ? source.command_index
      : Number.isInteger(record.command_index) ? record.command_index : parsedId.commandIndex,
    fieldKind: asString(source.field_kind ?? record.field_kind ?? record.fieldKind ?? parsedId.fieldKind),
    fieldOrdinal: Number.isInteger(source.field_ordinal)
      ? source.field_ordinal
      : Number.isInteger(record.field_ordinal) ? record.field_ordinal : parsedId.fieldOrdinal,
    speaker: asRecord(record.speaker_identity ?? record.speaker),
    speakerSignature: speakerSignature(record.speaker_identity ?? record.speaker),
    previousSourceHash: record.previous_source_hash ?? record.previousSourceHash ?? ref.previous_source_hash ?? null,
    nextSourceHash: record.next_source_hash ?? record.nextSourceHash ?? ref.next_source_hash ?? null,
    order,
  }
}

function compiledEvidenceRecords(compiled) {
  const records = []
  const add = (textRef, sourceText, speaker = null) => {
    if (!textRef) return
    records.push(normalizeEvidenceRecord({
      text_ref: textRef,
      source_text: sourceText,
      speaker_identity: speaker,
    }, records.length))
  }

  for (const step of compiled.steps || []) {
    const dialogue = asRecord(step.dialogue)
    add(
      dialogue.speaker_text_ref,
      dialogue.speaker_source_text
        ?? (typeof dialogue.speaker === 'string'
        ? dialogue.speaker
        : asRecord(dialogue.speaker).source_name),
      dialogue.speaker_identity,
    )
    add(
      dialogue.text_ref,
      dialogue.source_text ?? dialogue.text_jp ?? dialogue.text,
      dialogue.speaker_identity,
    )
    for (const option of step.options || []) {
      add(option.text_ref, option.source_text ?? option.short_text ?? option.text, null)
      add(option.detail_text_ref, option.detail_source_text ?? option.detail_text ?? option.detail, null)
    }
    const time = asRecord(step.text_time)
    add(time.text_ref, time.source_text ?? time.text, null)
  }
  return records
}

/** Normalize compiled scenarios and compact fixture catalogs to one evidence shape. */
export function collectStoryTextEvidence(input = {}) {
  let sourceRecords
  if (Array.isArray(input)) sourceRecords = input
  else if (Array.isArray(input.text_units)) sourceRecords = input.text_units
  else if (Array.isArray(input.units)) sourceRecords = input.units
  else if (Array.isArray(input.expected)) sourceRecords = input.expected
  else sourceRecords = compiledEvidenceRecords(input)

  const records = sourceRecords.map((record, index) => normalizeEvidenceRecord(record, index))
  const groups = new Map()
  for (const record of records) {
    if (!groups.has(record.unitId)) groups.set(record.unitId, [])
    groups.get(record.unitId).push(record)
  }

  const byPart = new Map()
  for (const record of records) {
    if (!byPart.has(record.partId)) byPart.set(record.partId, [])
    byPart.get(record.partId).push(record)
  }
  for (const partRecords of byPart.values()) {
    partRecords.sort((left, right) => (
      (left.commandIndex ?? Number.MAX_SAFE_INTEGER) - (right.commandIndex ?? Number.MAX_SAFE_INTEGER)
      || (left.fieldOrdinal ?? 0) - (right.fieldOrdinal ?? 0)
      || left.order - right.order
    ))
    for (let index = 0; index < partRecords.length; index += 1) {
      const record = partRecords[index]
      if (record.previousSourceHash == null) record.previousSourceHash = partRecords[index - 1]?.sourceHash || null
      if (record.nextSourceHash == null) record.nextSourceHash = partRecords[index + 1]?.sourceHash || null
    }
  }

  return {
    records,
    byUnitId: new Map([...groups].map(([unitId, matches]) => [unitId, matches[0]])),
    collisions: [...groups]
      .filter(([unitId, matches]) => !unitId || matches.length > 1)
      .map(([unitId, matches]) => ({ unitId, records: matches })),
  }
}

function diagnostic(code, unitId, message, severity = 'error', details = null) {
  return { code, severity, unit_id: unitId || null, message, ...(details ? { details } : {}) }
}

/** Compare a strict overlay with compiler evidence without mutating either input. */
export function diagnoseStoryTranslations({ evidence, overlay, locale = null } = {}) {
  const catalog = collectStoryTextEvidence(evidence)
  const expectedScenarioId = catalog.records.find(record => record.scenarioId)?.scenarioId || null
  const validation = validateStoryTranslationOverlay(overlay, {
    scenarioId: expectedScenarioId || undefined,
    locale: locale || undefined,
  })
  const diagnostics = validation.errors.map(message => diagnostic('invalid_overlay', null, message))
  const entries = asRecord(asRecord(overlay).entries)

  for (const collision of catalog.collisions) {
    diagnostics.push(diagnostic(
      'collision',
      collision.unitId,
      `source evidence contains ${collision.records.length} records for the same unit id`,
      'error',
      { source_hashes: [...new Set(collision.records.map(record => record.sourceHash))] },
    ))
  }

  for (const [unitId, source] of catalog.byUnitId) {
    const entry = entries[unitId]
    if (!entry) {
      diagnostics.push(diagnostic('missing', unitId, 'translation entry is missing', 'warning'))
      continue
    }
    if (entry.source_hash !== source.sourceHash) {
      diagnostics.push(diagnostic('stale', unitId, 'translation source hash does not match current evidence'))
    } else {
      diagnostics.push(diagnostic('valid', unitId, 'translation matches current source evidence', 'info'))
    }
    if (typeof entry.text === 'string' && entry.text.trim().length === 0) {
      diagnostics.push(diagnostic('invalid_entry', unitId, 'translation text is empty or whitespace-only'))
    }
    if (typeof entry.text === 'string' && BIDI_OR_CONTROL_PATTERN.test(entry.text)) {
      diagnostics.push(diagnostic('control_character_risk', unitId, 'translation contains bidi or control characters', 'warning'))
    }
  }

  for (const unitId of Object.keys(entries)) {
    if (!catalog.byUnitId.has(unitId)) {
      diagnostics.push(diagnostic('orphaned', unitId, 'translation has no current source evidence'))
    }
  }

  diagnostics.sort((left, right) => (
    String(left.unit_id).localeCompare(String(right.unit_id))
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message)
  ))
  const count = code => diagnostics.filter(item => item.code === code).length
  return {
    schema_version: 1,
    scenario_id: expectedScenarioId || asString(asRecord(overlay).scenario_id),
    locale: locale || asString(asRecord(overlay).locale),
    counts: {
      source_units: catalog.byUnitId.size,
      overlay_entries: Object.keys(entries).length,
      valid: count('valid'),
      missing: count('missing'),
      stale: count('stale'),
      orphaned: count('orphaned'),
      collision: count('collision'),
      invalid: count('invalid_overlay') + count('invalid_entry'),
      control_character_risk: count('control_character_risk'),
    },
    diagnostics,
  }
}

function sameNullable(left, right) {
  return (left || null) === (right || null)
}

function isHighConfidenceCandidate(oldRecord, nextRecord) {
  return oldRecord.sourceHash === nextRecord.sourceHash
    && oldRecord.partId === nextRecord.partId
    && oldRecord.fieldKind === nextRecord.fieldKind
    && oldRecord.speakerSignature === nextRecord.speakerSignature
    && sameNullable(oldRecord.previousSourceHash, nextRecord.previousSourceHash)
    && sameNullable(oldRecord.nextSourceHash, nextRecord.nextSourceHash)
}

function migrationRecord(classification, oldUnitId, newUnitId = null, extra = {}) {
  return {
    classification,
    old_unit_id: oldUnitId || null,
    new_unit_id: newUnitId,
    ...extra,
  }
}

/** Produce a conservative, offline-only migration report. */
export function createTranslationMigrationReport({ oldEvidence, oldOverlay, newEvidence } = {}) {
  const oldCatalog = collectStoryTextEvidence(oldEvidence)
  const newCatalog = collectStoryTextEvidence(newEvidence)
  const oldEntries = asRecord(asRecord(oldOverlay).entries)
  const records = []
  const claimedNewIds = new Set()

  for (const [oldUnitId, entry] of Object.entries(oldEntries)) {
    const oldRecord = oldCatalog.byUnitId.get(oldUnitId)
    const sameCoordinate = newCatalog.byUnitId.get(oldUnitId)
    if (sameCoordinate) {
      claimedNewIds.add(oldUnitId)
      if (entry.source_hash === sameCoordinate.sourceHash) {
        records.push(migrationRecord('matched_exact', oldUnitId, oldUnitId, {
          candidate_entry: { ...entry },
        }))
      } else {
        records.push(migrationRecord('stale_same_coordinate', oldUnitId, oldUnitId, {
          old_source_hash: entry.source_hash,
          new_source_hash: sameCoordinate.sourceHash,
          preserved_entry: { ...entry },
        }))
      }
      continue
    }

    if (!oldRecord) {
      records.push(migrationRecord('orphaned', oldUnitId, null, {
        reason: 'old overlay entry has no old source evidence',
      }))
      continue
    }
    const candidates = newCatalog.records.filter(candidate => isHighConfidenceCandidate(oldRecord, candidate))
    if (candidates.length === 1) {
      const candidate = candidates[0]
      claimedNewIds.add(candidate.unitId)
      records.push(migrationRecord('moved_high_confidence', oldUnitId, candidate.unitId, {
        requires_manual_confirmation: true,
        preserved_entry: { ...entry },
      }))
    } else if (candidates.length > 1) {
      records.push(migrationRecord('ambiguous', oldUnitId, null, {
        candidate_unit_ids: candidates.map(candidate => candidate.unitId).sort(),
      }))
    } else {
      records.push(migrationRecord('orphaned', oldUnitId, null, {
        reason: 'no high-confidence target',
      }))
    }
  }

  for (const unitId of [...newCatalog.byUnitId.keys()].sort()) {
    if (!claimedNewIds.has(unitId)) records.push(migrationRecord('new', null, unitId))
  }

  const classifications = [
    'matched_exact',
    'moved_high_confidence',
    'stale_same_coordinate',
    'ambiguous',
    'orphaned',
    'new',
  ]
  const counts = Object.fromEntries(classifications.map(classification => [
    classification,
    records.filter(record => record.classification === classification).length,
  ]))
  const candidateEntries = Object.fromEntries(records
    .filter(record => record.classification === 'matched_exact' && record.new_unit_id)
    .map(record => [record.new_unit_id, record.candidate_entry]))
  return {
    schema_version: 1,
    scenario_id: asString(asRecord(oldOverlay).scenario_id)
      || oldCatalog.records[0]?.scenarioId
      || newCatalog.records[0]?.scenarioId
      || '',
    old_source_raw_hash: asString(asRecord(oldOverlay).source_raw_hash) || null,
    new_source_raw_hash: sourceRawHash(newEvidence),
    counts,
    records,
    candidate_overlay: {
      schema_version: 1,
      locale: asString(asRecord(oldOverlay).locale),
      scenario_id: asString(asRecord(oldOverlay).scenario_id),
      source_raw_hash: sourceRawHash(newEvidence),
      entries: candidateEntries,
    },
  }
}

export function renderTranslationDiagnosticsSummary(report) {
  const counts = report.counts || {}
  return [
    `Story translation verification: ${report.scenario_id || '(unknown scenario)'} [${report.locale || '(unknown locale)'}]`,
    `source=${counts.source_units || 0} overlay=${counts.overlay_entries || 0} valid=${counts.valid || 0}`,
    `missing=${counts.missing || 0} stale=${counts.stale || 0} orphaned=${counts.orphaned || 0} collision=${counts.collision || 0} invalid=${counts.invalid || 0}`,
    `control-character-risk=${counts.control_character_risk || 0}`,
  ].join('\n')
}

export function renderTranslationMigrationSummary(report) {
  const order = [
    'matched_exact',
    'moved_high_confidence',
    'stale_same_coordinate',
    'ambiguous',
    'orphaned',
    'new',
  ]
  return [
    `Story translation migration: ${report.scenario_id || '(unknown scenario)'}`,
    ...order.map(key => `${key}: ${report.counts?.[key] || 0}`),
    '',
    'Only matched_exact entries are safe for automatic copy.',
    'moved_high_confidence and ambiguous records require human review.',
  ].join('\n')
}

export function hasBlockingTranslationDiagnostics(report, { requireComplete = false } = {}) {
  const blocking = new Set(['stale', 'orphaned', 'collision', 'invalid_overlay', 'invalid_entry'])
  if (requireComplete) blocking.add('missing')
  return report.diagnostics.some(item => blocking.has(item.code))
}
