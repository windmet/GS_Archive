import { isDeepStrictEqual } from 'node:util'

import { resolveVoiceFilenameCandidates } from '../../src/utils/AssetResolver.js'

const TEXT_KEYS = new Set([
  'choice_id',
  'detail_source_text',
  'detail_text',
  'detail_text_ref',
  'option_id',
  'short_text',
  'short_text_ref',
  'source_text',
  'speaker_identity',
  'speaker_text_ref',
  'text',
  'text_cn',
  'text_jp',
  'text_ref',
])

const TOP_LEVEL_METADATA_KEYS = new Set([
  'compiler_version',
  'diagnostics',
  'schema_version',
  'source',
  'text_catalog_id',
  'text_contract_version',
])

function pointer(path) {
  if (path.length === 0) return '/'
  return `/${path.map(segment => String(segment).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`
}

function shouldStripTextKey(path, key) {
  if (TEXT_KEYS.has(key)) return true
  if (key === 'detail' && path.includes('options')) return true
  return key === 'speaker' && path.includes('dialogue')
    || key === 'voice' && path.includes('dialogue')
    || key === 'evidence'
}

function runtimeProjection(value, path = []) {
  if (Array.isArray(value)) return value.map((item, index) => runtimeProjection(item, [...path, index]))
  if (!value || typeof value !== 'object') return value

  const output = {}
  for (const key of Object.keys(value).sort()) {
    if (path.length === 0 && TOP_LEVEL_METADATA_KEYS.has(key)) continue
    if (shouldStripTextKey(path, key)) continue
    output[key] = runtimeProjection(value[key], [...path, key])
  }
  return output
}

function diffValues(oldValue, newValue, path = [], records = []) {
  if (isDeepStrictEqual(oldValue, newValue)) return records

  const oldArray = Array.isArray(oldValue)
  const newArray = Array.isArray(newValue)
  if (oldArray || newArray) {
    if (!oldArray || !newArray) {
      records.push({ path: pointer(path), kind: 'type_changed', old: oldValue, new: newValue })
      return records
    }
    const length = Math.max(oldValue.length, newValue.length)
    for (let index = 0; index < length; index += 1) {
      if (index >= oldValue.length) records.push({ path: pointer([...path, index]), kind: 'added', new: newValue[index] })
      else if (index >= newValue.length) records.push({ path: pointer([...path, index]), kind: 'removed', old: oldValue[index] })
      else diffValues(oldValue[index], newValue[index], [...path, index], records)
    }
    return records
  }

  const oldObject = oldValue && typeof oldValue === 'object'
  const newObject = newValue && typeof newValue === 'object'
  if (oldObject || newObject) {
    if (!oldObject || !newObject) {
      records.push({ path: pointer(path), kind: 'type_changed', old: oldValue, new: newValue })
      return records
    }
    const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)])
    for (const key of [...keys].sort()) {
      if (!(key in oldValue)) records.push({ path: pointer([...path, key]), kind: 'added', new: newValue[key] })
      else if (!(key in newValue)) records.push({ path: pointer([...path, key]), kind: 'removed', old: oldValue[key] })
      else diffValues(oldValue[key], newValue[key], [...path, key], records)
    }
    return records
  }

  records.push({ path: pointer(path), kind: 'changed', old: oldValue, new: newValue })
  return records
}

function stepTypeMismatches(oldSteps, newSteps) {
  const records = []
  const length = Math.max(oldSteps.length, newSteps.length)
  for (let index = 0; index < length; index += 1) {
    const oldStep = oldSteps[index]
    const newStep = newSteps[index]
    const oldIdentity = oldStep ? { step_id: oldStep.step_id ?? null, type: oldStep.type ?? null } : null
    const newIdentity = newStep ? { step_id: newStep.step_id ?? null, type: newStep.type ?? null } : null
    if (!isDeepStrictEqual(oldIdentity, newIdentity)) records.push({ index, old: oldIdentity, new: newIdentity })
  }
  return records
}

function collectEpisodeBoundaries(scenario) {
  const boundaries = []
  let previousKey = null
  for (const [index, step] of (scenario.steps || []).entries()) {
    const key = `${step?.episode_index ?? ''}:${step?.episode_part ?? ''}`
    if (index === 0 || key !== previousKey) {
      boundaries.push({
        step_index: index,
        step_id: step?.step_id ?? null,
        episode_index: step?.episode_index ?? null,
        episode_part: step?.episode_part ?? null,
      })
    }
    previousKey = key
  }
  return boundaries
}

function optionCollections(step) {
  const direct = Array.isArray(step?.options) ? step.options : []
  const nested = Array.isArray(step?.choice?.options) ? step.choice.options : []
  return direct.length ? direct : nested
}

function collectChoiceTargets(scenario) {
  return (scenario.steps || []).flatMap((step, stepIndex) => optionCollections(step).map((option, optionIndex) => ({
    step_index: stepIndex,
    step_id: step?.step_id ?? null,
    choice_id: step?.choice_id ?? step?.choice?.choice_id ?? null,
    option_index: optionIndex,
    option_id: option?.option_id ?? null,
    label: option?.label ?? null,
    target_step_id: option?.target_step_id ?? option?.step_id ?? option?.target ?? null,
  })))
}

function collectDialogueAudio(scenario) {
  return (scenario.steps || []).map((step, stepIndex) => ({
    step_index: stepIndex,
    step_id: step?.step_id ?? null,
    voice: step?.dialogue?.voice ?? null,
    lip: step?.dialogue?.lip ?? null,
  })).filter(record => record.voice !== null || record.lip !== null)
}

function voicesEquivalent(oldVoice, newVoice, oldScenarioId, newScenarioId) {
  if (oldVoice === newVoice) return true
  if (!oldVoice || !newVoice) return false
  const oldCandidates = new Set(resolveVoiceFilenameCandidates(oldVoice, oldScenarioId))
  const newCandidates = resolveVoiceFilenameCandidates(newVoice, newScenarioId)
  return newCandidates.some(candidate => oldCandidates.has(candidate))
}

function dialogueAudioEquivalent(oldRecords, newRecords, oldScenarioId, newScenarioId) {
  if (oldRecords.length !== newRecords.length) return false
  return oldRecords.every((oldRecord, index) => {
    const newRecord = newRecords[index]
    return oldRecord.step_index === newRecord.step_index
      && oldRecord.step_id === newRecord.step_id
      && voicesEquivalent(oldRecord.voice, newRecord.voice, oldScenarioId, newScenarioId)
      && isDeepStrictEqual(oldRecord.lip, newRecord.lip)
  })
}

function cueArray(step) {
  if (Array.isArray(step?.cues)) return step.cues
  if (Array.isArray(step?.timeline)) return step.timeline
  return []
}

function collectCueProfile(scenario) {
  return (scenario.steps || []).map((step, stepIndex) => ({
    step_index: stepIndex,
    step_id: step?.step_id ?? null,
    cues: cueArray(step).map(cue => ({
      channel: cue?.channel ?? null,
      action: cue?.action ?? cue?.type ?? null,
      at: cue?.at ?? cue?.delay ?? cue?.time ?? 0,
      duration: cue?.duration ?? 0,
    })),
  })).filter(record => record.cues.length > 0)
}

function collectTextIdentity(scenario) {
  const unitIds = new Set()
  const speakerIdentities = []
  const choiceIds = new Set()
  const optionIds = new Set()

  function visit(value, path = []) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index]))
      return
    }
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'text_ref' || key.endsWith('_text_ref')) && child?.unit_id) unitIds.add(child.unit_id)
      if (key === 'speaker_identity' && child) speakerIdentities.push({ path: pointer([...path, key]), value: child })
      if (key === 'choice_id' && typeof child === 'string') choiceIds.add(child)
      if (key === 'option_id' && typeof child === 'string') optionIds.add(child)
      visit(child, [...path, key])
    }
  }

  visit(scenario)
  return {
    unit_ids: [...unitIds].sort(),
    speaker_identities: speakerIdentities,
    choice_ids: [...choiceIds].sort(),
    option_ids: [...optionIds].sort(),
  }
}

function sourceSpeaker(dialogue) {
  if (typeof dialogue?.speaker === 'string') return dialogue.speaker
  return dialogue?.speaker?.source_name ?? dialogue?.speaker_identity?.source_name ?? ''
}

function sourceDialogueText(dialogue) {
  return dialogue?.source_text ?? dialogue?.text_jp ?? dialogue?.text ?? ''
}

function collectTextContent(scenario) {
  return (scenario.steps || []).map((step, stepIndex) => ({
    step_index: stepIndex,
    step_id: step?.step_id ?? null,
    speaker: sourceSpeaker(step?.dialogue),
    source_text: sourceDialogueText(step?.dialogue),
    options: optionCollections(step).map(option => ({
      source_text: option?.source_text ?? option?.short_text ?? option?.text ?? option?.label ?? '',
      detail_source_text: option?.detail_source_text ?? option?.detail_text ?? option?.detail ?? '',
    })),
  })).filter(record => record.speaker || record.source_text || record.options.length > 0)
}

function collectStepEvidence(scenario) {
  return (scenario.steps || []).map((step, stepIndex) => ({
    step_index: stepIndex,
    step_id: step?.step_id ?? null,
    evidence: step?.evidence ?? null,
  })).filter(record => record.evidence !== null)
}

function addedValues(oldValues, newValues) {
  const oldSet = new Set(oldValues)
  return newValues.filter(value => !oldSet.has(value))
}

export function buildCompiledScenarioMigrationReport(oldScenario, newScenario, { maxDifferences = 200 } = {}) {
  const oldSteps = Array.isArray(oldScenario?.steps) ? oldScenario.steps : []
  const newSteps = Array.isArray(newScenario?.steps) ? newScenario.steps : []
  const oldRuntime = runtimeProjection(oldScenario)
  const newRuntime = runtimeProjection(newScenario)
  const allNonTextDifferences = diffValues(oldRuntime, newRuntime)
  const oldTextIdentity = collectTextIdentity(oldScenario)
  const newTextIdentity = collectTextIdentity(newScenario)
  const oldTextContent = collectTextContent(oldScenario)
  const newTextContent = collectTextContent(newScenario)
  const oldBoundaries = collectEpisodeBoundaries(oldScenario)
  const newBoundaries = collectEpisodeBoundaries(newScenario)
  const oldChoices = collectChoiceTargets(oldScenario)
  const newChoices = collectChoiceTargets(newScenario)
  const oldAudio = collectDialogueAudio(oldScenario)
  const newAudio = collectDialogueAudio(newScenario)
  const audioUnchanged = dialogueAudioEquivalent(
    oldAudio,
    newAudio,
    oldScenario?.scenario_id,
    newScenario?.scenario_id,
  )
  const oldCues = collectCueProfile(oldScenario)
  const newCues = collectCueProfile(newScenario)
  const oldStepEvidence = collectStepEvidence(oldScenario)
  const newStepEvidence = collectStepEvidence(newScenario)

  return {
    schema_version: 1,
    identity: {
      old: oldScenario?.scenario_id ?? null,
      new: newScenario?.scenario_id ?? null,
      unchanged: oldScenario?.scenario_id === newScenario?.scenario_id,
    },
    step_structure: {
      old_count: oldSteps.length,
      new_count: newSteps.length,
      count_unchanged: oldSteps.length === newSteps.length,
      type_sequence_unchanged: stepTypeMismatches(oldSteps, newSteps).length === 0,
      mismatches: stepTypeMismatches(oldSteps, newSteps),
    },
    episode_boundaries: {
      unchanged: isDeepStrictEqual(oldBoundaries, newBoundaries),
      old: oldBoundaries,
      new: newBoundaries,
    },
    choice_targets: {
      unchanged: isDeepStrictEqual(runtimeProjection({ steps: oldSteps }).steps?.flatMap((step, index) => optionCollections(step).map((option, optionIndex) => ({ index, optionIndex, label: option.label ?? null, target: option.target_step_id ?? option.step_id ?? option.target ?? null }))) || [], runtimeProjection({ steps: newSteps }).steps?.flatMap((step, index) => optionCollections(step).map((option, optionIndex) => ({ index, optionIndex, label: option.label ?? null, target: option.target_step_id ?? option.step_id ?? option.target ?? null }))) || []),
      old: oldChoices,
      new: newChoices,
    },
    dialogue_audio: {
      unchanged: audioUnchanged,
      old: oldAudio,
      new: newAudio,
    },
    cue_profile: {
      unchanged: isDeepStrictEqual(oldCues, newCues),
      old: oldCues,
      new: newCues,
    },
    scene_state: {
      difference_count: allNonTextDifferences.filter(record => /^\/steps\/\d+\/(entry_snapshot|settled_snapshot|state)(\/|$)/u.test(record.path)).length,
    },
    text_identity: {
      old: oldTextIdentity,
      new: newTextIdentity,
      added_unit_ids: addedValues(oldTextIdentity.unit_ids, newTextIdentity.unit_ids),
      added_choice_ids: addedValues(oldTextIdentity.choice_ids, newTextIdentity.choice_ids),
      added_option_ids: addedValues(oldTextIdentity.option_ids, newTextIdentity.option_ids),
    },
    text_content: {
      unchanged: isDeepStrictEqual(oldTextContent, newTextContent),
      old: oldTextContent,
      new: newTextContent,
    },
    step_evidence: {
      old_count: oldStepEvidence.length,
      new_count: newStepEvidence.length,
      added_count: Math.max(0, newStepEvidence.length - oldStepEvidence.length),
      old: oldStepEvidence,
      new: newStepEvidence,
    },
    non_text_differences: {
      count: allNonTextDifferences.length,
      truncated: allNonTextDifferences.length > maxDifferences,
      records: allNonTextDifferences.slice(0, maxDifferences),
    },
    acceptance: {
      passed: oldScenario?.scenario_id === newScenario?.scenario_id &&
        oldSteps.length === newSteps.length &&
        stepTypeMismatches(oldSteps, newSteps).length === 0 &&
        isDeepStrictEqual(oldBoundaries, newBoundaries) &&
        audioUnchanged &&
        isDeepStrictEqual(oldTextContent, newTextContent) &&
        allNonTextDifferences.length === 0,
    },
  }
}

export function renderCompiledScenarioMigrationSummary(report) {
  const lines = [
    `Compiled scenario migration audit: ${report.identity.old ?? '<missing>'} -> ${report.identity.new ?? '<missing>'}`,
    `  steps: ${report.step_structure.old_count} -> ${report.step_structure.new_count}`,
    `  step identity/type sequence: ${report.step_structure.type_sequence_unchanged ? 'unchanged' : 'changed'}`,
    `  episode boundaries: ${report.episode_boundaries.unchanged ? 'unchanged' : 'changed'}`,
    `  choice targets: ${report.choice_targets.unchanged ? 'unchanged' : 'changed'}`,
    `  dialogue voice/lip: ${report.dialogue_audio.unchanged ? 'unchanged' : 'changed'}`,
    `  cue profile: ${report.cue_profile.unchanged ? 'unchanged' : 'changed'}`,
    `  source text/speaker: ${report.text_content.unchanged ? 'unchanged' : 'changed'}`,
    `  added text units: ${report.text_identity.added_unit_ids.length}`,
    `  non-text differences: ${report.non_text_differences.count}`,
    `  acceptance: ${report.acceptance.passed ? 'PASS' : 'FAIL'}`,
  ]
  return lines.join('\n')
}
