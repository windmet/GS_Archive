import { normalizeLegacyDialogue } from '../../src/localization/story/LegacyDialogueAdapter.js'

export const READING_SCHEMA_VERSION = 1
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value))
const none = () => ({ kind: 'none', entityType: null, entityId: null, sourceName: '' })
const text = value => typeof value === 'string' ? value : ''
const TEXT_TYPES = new Set(['adv', 'talk', 'call', 'synopsis', 'title', 'text_time', 'choice'])
const VISUAL_TYPES = new Set(['stage', 'fadein', 'fadeout', 'slidein', 'slideout', 'text_disable'])

/** A text projection of published compiled input. No RAW interpretation or media loading. */
export function createReadingDocument(input, { documentId, logicalId, file, sha256 }) {
  const version = input?.schema_version ?? 1
  if (![1, 2].includes(version) || !Array.isArray(input?.steps)) throw new TypeError('Unsupported compiled scenario')
  if (version === 2 && !['story-runtime-v2', 'story-runtime-v2-compat'].includes(input.runtime_contract)) {
    throw new TypeError('Unknown compiled runtime contract')
  }
  const steps = input.steps
  const ids = new Map()
  for (const [index, step] of steps.entries()) {
    if (!Number.isInteger(step.step_id) || ids.has(step.step_id)) throw new TypeError('Steps require unique integer IDs')
    ids.set(step.step_id, index)
  }
  const diagnostics = []
  const rows = []
  const controls = []
  const diagnose = (code, stepIndex, severity = 'warning') => diagnostics.push({ code, step_index: stepIndex, severity })
  const strict = version === 2 && input.runtime_contract === 'story-runtime-v2'
  if (!strict) diagnose('compatibility-source-fields-may-be-missing', null)

  for (const [stepIndex, step] of steps.entries()) {
    const structuralTitle = ['title', 'synopsis'].includes(step.type)
    if (!TEXT_TYPES.has(step.type) && !VISUAL_TYPES.has(step.type)) diagnose('unsupported-step-kind', stepIndex, 'unsupported')
    if (step.stamp) diagnose('nontext-message-not-represented', stepIndex, 'unsupported')
    // Published formats do not define a complete branch-exit graph. Never infer
    // reconvergence from label names, adjacency, or the existing player's behavior.
    if (step.type === 'choice' && (step.options?.length ?? 0) !== 1) diagnose('branch-exits-unavailable', stepIndex, 'unsupported')
    if (step.jump || step.jump_to || step.next_step_id || step.flow?.target_step_id) diagnose('unsupported-control-flow', stepIndex, 'unsupported')

    const anchor = slot => ({
      row_id: `${documentId}:step-${step.step_id}:${slot}`,
      step_id: step.step_id,
      step_index: stepIndex,
      source_part_id: step.evidence?.source_part_id ?? step.dialogue?.text_ref?.source?.part_id ?? input.episodes?.find(e => e.episode_index === step.episode_index)?.source_scenario_id ?? null,
      source_file: step.evidence?.source_file ?? null,
      command_start: step.evidence?.command_start ?? null,
      command_end: step.evidence?.command_end ?? null,
      playback: { file, start_step_index: 0, end_step_index: steps.length - 1, target_step_index: stepIndex },
    })
    const append = ({ kind, source, textRef, speaker = none(), inline = null, slot, option = null }) => {
      if (!source) return
      if (!textRef) diagnose('missing-text-ref', stepIndex)
      rows.push({ kind, source_text: source, text_ref: clone(textRef), speaker: clone(speaker),
        inline_translation: clone(inline), has_voice: Boolean(step.dialogue?.voice),
        anchor: anchor(slot), option: clone(option) })
    }
    if (step.dialogue) {
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
        const targetIndex = ids.get(targetId) ?? null
        if (targetIndex === null) diagnose('unresolved-choice-target', stepIndex, 'unsupported')
        // Single-option back jumps or skips also require explicit traversal support.
        if (targetIndex !== null && targetIndex !== stepIndex + 1) diagnose('nonsequential-choice-path', stepIndex, 'unsupported')
        const option = { choice_id: step.choice_id ?? null, option_id: o.option_id ?? null,
          source_label: o.label ?? null, target_step_id: targetId, target_step_index: targetIndex,
          resolution: targetIndex === null ? 'unresolved' : 'resolved' }
        append({ kind: 'choice', source: text(o.source_text ?? o.text), textRef: o.text_ref,
          slot: `option-${index}`, option })
        append({ kind: 'choice_detail', source: text(o.detail_source_text ?? o.detail), textRef: o.detail_text_ref,
          slot: `option-${index}-detail`, option })
        return option
      })
      controls.push({ step_id: step.step_id, step_index: stepIndex, kind: 'choice', options })
    }
  }
  return {
    schema_version: READING_SCHEMA_VERSION, document_id: documentId, logical_id: logicalId,
    scenario_id: input.scenario_id, text_catalog_id: input.text_catalog_id ?? input.scenario_id,
    source: { file, sha256, schema_version: version, runtime_contract: input.runtime_contract ?? null,
      raw_hash: input.source?.raw_hash ?? null, aggregate_source: clone(input.aggregate_source), step_count: steps.length },
    status: diagnostics.some(d => d.severity === 'unsupported') ? 'unsupported' : (rows.length ? 'ready' : 'empty'),
    rows, controls, diagnostics,
  }
}

/** Only a confirmed, publicly named single idol can have a portrait. */
export function readingAvatarEntity(row) {
  const s = row?.speaker
  return ['named', 'idol'].includes(s?.kind) && s.entityType === 'idol' && /^[0-9]{3}[a-z]{3}$/.test(s.entityId || '')
    ? s.entityId : null
}
