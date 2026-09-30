import { resolveCommunicationContext } from '../../src/core/story-runtime/CommunicationPresentationContext.js'
import { normalizeLegacyDialogue } from '../../src/localization/story/LegacyDialogueAdapter.js'
import { normalizeScenario } from '../story/ScenarioNormalizer.js'
import { projectReadingIdentity, readingVisualAvatarEntity } from './ReadingVisualIdentity.js'
import { validatedFiniteForks } from '../story/FiniteBranchFlow.js'

export const READING_SCHEMA_VERSION = 2
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value))
const none = () => ({ kind: 'none', entityType: null, entityId: null, sourceName: '' })
const text = value => typeof value === 'string' ? value : ''
const TEXT_TYPES = new Set(['adv', 'talk', 'talk_stamp', 'call', 'synopsis', 'title', 'text_time', 'choice'])
const VISUAL_TYPES = new Set(['stage', 'fadein', 'fadeout', 'slidein', 'slideout', 'fadecolor', 'text_disable'])

/** A text projection of published compiled input. No RAW interpretation or media loading. */
export function createReadingDocument(input, { documentId, logicalId, file, sha256, knownIdolIds }) {
  const version = input?.schema_version ?? 1
  if (![1, 2].includes(version) || !Array.isArray(input?.steps)) throw new TypeError('Unsupported compiled scenario')
  if (version === 2 && !['story-runtime-v2', 'story-runtime-v2-compat'].includes(input.runtime_contract)) {
    throw new TypeError('Unknown compiled runtime contract')
  }
  const steps = input.steps
  const normalized = normalizeScenario(input)
  const ids = new Map()
  for (const [index, step] of steps.entries()) {
    if (!Number.isInteger(step.step_id) || ids.has(step.step_id)) throw new TypeError('Steps require unique integer IDs')
    ids.set(step.step_id, index)
  }
  const diagnostics = []
  let forks = []
  try { forks = validatedFiniteForks(input) } catch { diagnostics.push({ code: 'invalid-branch-evidence', step_index: null, severity: 'unsupported' }) }
  const rows = []
  const controls = []
  const diagnose = (code, stepIndex, severity = 'warning') => diagnostics.push({ code, step_index: stepIndex, severity })
  const strict = version === 2 && input.runtime_contract === 'story-runtime-v2'
  if (!strict) diagnose('compatibility-source-fields-may-be-missing', null)

  for (const [stepIndex, step] of steps.entries()) {
    const medium = resolveCommunicationContext({ step, stepIndex, steps, scenarioId: input.scenario_id }).mode
    const structuralTitle = ['title', 'synopsis'].includes(step.type)
    if (!TEXT_TYPES.has(step.type) && !VISUAL_TYPES.has(step.type)) diagnose('unsupported-step-kind', stepIndex, 'unsupported')
    if (step.stamp && !/^[A-Za-z0-9_-]+$/.test(step.stamp.id || '')) diagnose('invalid-stamp-identity', stepIndex, 'unsupported')
    // Published formats do not define a complete branch-exit graph. Never infer
    // reconvergence from label names, adjacency, or the existing player's behavior.
    const fork = forks.find(fork => fork.choice_index === stepIndex)
    if (step.type === 'choice' && !fork && (step.options?.length ?? 0) !== 1) diagnose('branch-exits-unavailable', stepIndex, 'unsupported')
    if (step.jump || step.jump_to || step.next_step_id || step.flow?.target_step_id) diagnose('unsupported-control-flow', stepIndex, 'unsupported')

    const anchor = slot => ({
      row_id: `${documentId}:step-${step.step_id}:${slot}`,
      step_id: step.step_id,
      step_index: stepIndex,
      source_part_id: step.evidence?.source_part_id ?? step.dialogue?.text_ref?.source?.part_id ?? input.episodes?.find(e => e.episode_index === step.episode_index)?.source_scenario_id ?? null,
      source_file: step.evidence?.source_file ?? null,
      command_start: step.evidence?.command_start ?? null,
      command_end: step.evidence?.command_end ?? null,
    })
    const append = ({ kind, source, textRef, speaker = none(), inline = null, slot, option = null }) => {
      if (!source) return
      if (!textRef) diagnose('missing-text-ref', stepIndex)
      rows.push({ kind, source_text: source, text_ref: clone(textRef), speaker: clone(speaker),
        ...projectReadingIdentity({ step: normalized.steps[stepIndex], rowKind: kind, speaker, knownIdolIds }),
        inline_translation: clone(inline), has_voice: Boolean(step.dialogue?.voice),
        anchor: anchor(slot), option: clone(option),
        ...(medium ? { presentation: medium } : {}) })
    }
    if (step.stamp && /^[A-Za-z0-9_-]+$/.test(step.stamp.id || '')) {
      const speaker = normalizeLegacyDialogue({ speaker: step.stamp.speaker || step.dialogue?.speaker || '' }).speaker
      rows.push({ kind: 'stamp', source_text: '', text_ref: null, speaker,
        ...projectReadingIdentity({ step: normalized.steps[stepIndex], rowKind: 'stamp', speaker, knownIdolIds }),
        inline_translation: null, has_voice: Boolean(step.dialogue?.voice),
        anchor: anchor('stamp'), option: null, presentation: 'talk', media: { kind: 'stamp', id: step.stamp.id } })
    }
    if (step.dialogue && !step.stamp) {
      const d = normalizeLegacyDialogue(step.dialogue)
      if (structuralTitle) {
        append({ kind: 'title', source: text(step.dialogue.speaker_source_text ?? step.dialogue.speaker),
          textRef: step.dialogue.speaker_text_ref, slot: 'heading' })
      }
      append({ kind: structuralTitle ? step.type : (d.speaker.kind === 'none' ? 'narration' : 'dialogue'),
        source: d.source, textRef: d.textRef, speaker: structuralTitle ? none() : d.speaker,
        inline: d.overlayEntry, slot: 'text' })
    }
    if (step.text_time) append({ kind: 'caption', source: text(step.text_time.source_text ?? step.text_time.text),
      textRef: step.text_time.text_ref, slot: 'caption' })
    if (step.type === 'choice') {
      const options = (step.options || []).map((o, index) => {
        const targetId = o.target_step_id ?? o.step_id ?? null
        const terminal = fork?.join_step_type === 'end' && o.target_kind === 'end'
        const targetIndex = terminal ? steps.length : ids.get(targetId) ?? null
        if (targetIndex === null) diagnose('unresolved-choice-target', stepIndex, 'unsupported')
        // Single-option back jumps or skips also require explicit traversal support.
        if (!fork && targetIndex !== null && targetIndex !== stepIndex + 1) diagnose('nonsequential-choice-path', stepIndex, 'unsupported')
        const option = { choice_id: step.choice_id ?? null, option_id: o.option_id ?? null,
          source_label: o.label ?? null, target_step_id: targetId, target_step_index: targetIndex,
          resolution: targetIndex === null ? 'unresolved' : 'resolved', ...(terminal ? { target_kind:'end' } : {}) }
        append({ kind: 'choice', source: text(o.source_text ?? o.text), textRef: o.text_ref,
          slot: `option-${index}`, option })
        // Preserve the third RAW slot as source evidence: it may be prose or a
        // presentation marker. Its kind comes from compiler classification.
        append({ kind: o.detail_kind === 'presentation-marker' ? 'choice_metadata' : 'choice_detail', source: text(o.detail_source_text ?? o.detail), textRef: o.detail_text_ref,
          slot: `option-${index}-detail`, option })
        return option
      })
      controls.push({ step_id: step.step_id, step_index: stepIndex, kind: 'choice', options,
        ...(fork ? { fork: clone(fork) } : {}) })
    }
  }
  return {
    schema_version: READING_SCHEMA_VERSION, document_id: documentId, logical_id: logicalId,
    scenario_id: input.scenario_id, text_catalog_id: input.text_catalog_id ?? input.scenario_id,
    playback: { file, start_step_index: 0, end_step_index: steps.length - 1 },
    source: { file, sha256, schema_version: version, runtime_contract: input.runtime_contract ?? null,
      raw_hash: input.source?.raw_hash ?? null, aggregate_source: clone(input.aggregate_source), step_count: steps.length },
    status: diagnostics.some(d => d.severity === 'unsupported') ? 'unsupported' : (rows.length ? 'ready' : 'empty'),
    rows, controls, diagnostics,
  }
}

// Rows remain canonical and unique. Reorder references, never duplicate units.
export function readingBranchRows(document) {
  const rows = document?.rows || [], result = [], consumed = new Set()
  const emitRow = (row, branch) => {
    if (consumed.has(row.anchor.row_id)) return
    consumed.add(row.anchor.row_id); result.push({row,branch})
  }
  const emitFork = (control, outer = null) => {
    for (const [index, branch] of control.fork.branches.entries()) {
      const ownRows = rows.filter(r => r.anchor.step_index === control.step_index && new RegExp(`:option-${index}($|-detail$)`).test(r.anchor.row_id))
      const context = {index,choice:control.step_id,first:true,shared:!branch.step_indices.length,terminal:control.fork.join_step_type==='end',parent:outer?.choice ?? null}
      for (const r of ownRows) { emitRow(r,{...context}); context.first=false }
      for (const stepIndex of branch.step_indices) {
        const nested = document.controls?.find(c => c.fork && c.step_index === stepIndex)
        if (nested) emitFork(nested,context)
        else for (const r of rows.filter(r => r.anchor.step_index===stepIndex)) emitRow(r,{...context,first:false})
      }
    }
  }
  for (const row of rows) {
    if (consumed.has(row.anchor.row_id)) continue
    const control = document.controls?.find(c => c.fork && c.step_index === row.anchor.step_index)
    if (control) emitFork(control)
    else emitRow(row,null)
  }
  return result
}

/** v2 portraits follow visual evidence, independently of the public label. */
export const readingAvatarEntity = readingVisualAvatarEntity

export function readingPresentationSpeaker(row) {
  const speaker = { ...row.speaker }
  // Keep canonical identity on the row, but do not reveal an unknown speaker
  // through translated entity names. Producer markup is a display token.
  if (speaker.kind === 'unknown') { speaker.entityId = null; speaker.entityType = null }
  if (speaker.kind === 'producer' && speaker.sourceName === '<P>') speaker.sourceName = 'プロデューサー'
  return speaker
}
