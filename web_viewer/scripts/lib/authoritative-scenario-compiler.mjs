import { normalizeScenario } from '../../src/core/story-runtime/ScenarioNormalizer.js'
import { isDeepStrictEqual } from 'node:util'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function requireValue(value, label) {
  if (value == null || value === '') throw new TypeError(`${label} is required for authoritative v2 output`)
  return value
}

function projectEvidence(evidence, fallback = {}, { confidence = null, parserRule = null } = {}) {
  const source = evidence && typeof evidence === 'object' ? evidence : {}
  const base = fallback && typeof fallback === 'object' ? fallback : {}
  const output = {
    source_file: requireValue(source.source_file ?? base.source_file, 'evidence.source_file'),
    source_part_id: requireValue(source.source_part_id ?? base.source_part_id, 'evidence.source_part_id'),
    command_start: Number(source.command_start ?? source.command_index ?? base.command_start ?? base.command_index),
    command_end: Number(source.command_end ?? source.command_index ?? base.command_end ?? base.command_index),
    raw_type: requireValue(source.raw_type ?? base.raw_type, 'evidence.raw_type'),
    confidence: confidence ?? source.confidence ?? base.confidence ?? 'exact',
  }
  if (!Number.isInteger(output.command_start) || output.command_start < 0) throw new TypeError('evidence.command_start is invalid')
  if (!Number.isInteger(output.command_end) || output.command_end < output.command_start) throw new TypeError('evidence.command_end is invalid')
  if (Array.isArray(source.raw_values ?? base.raw_values)) output.raw_values = clone(source.raw_values ?? base.raw_values)
  if (source.parser_rule ?? base.parser_rule ?? parserRule) {
    output.parser_rule = String(source.parser_rule ?? base.parser_rule ?? parserRule)
  }
  return output
}

function projectDialogue(dialogue) {
  if (!dialogue) return undefined
  const output = {
    speaker_identity: clone(requireValue(dialogue.speaker_identity, 'dialogue.speaker_identity')),
    source_text: String(dialogue.source_text ?? ''),
    text_ref: clone(requireValue(dialogue.text_ref, 'dialogue.text_ref')),
  }
  if (dialogue.speaker_text_ref) {
    output.speaker_source_text = String(dialogue.speaker_source_text ?? dialogue.speaker ?? '')
    output.speaker_text_ref = clone(dialogue.speaker_text_ref)
  }
  if ('voice' in dialogue) output.voice = dialogue.voice || null
  if ('lip' in dialogue) output.lip = clone(dialogue.lip)
  return output
}

function projectOption(option) {
  const output = {
    option_id: requireValue(option.option_id, 'choice option.option_id'),
    source_text: String(option.source_text ?? ''),
    text_ref: clone(requireValue(option.text_ref, 'choice option.text_ref')),
    target_step_id: Number(requireValue(option.target_step_id ?? option.step_id, 'choice option.target_step_id')),
  }
  if (!Number.isInteger(output.target_step_id) || output.target_step_id < 1) {
    throw new TypeError('choice option.target_step_id is invalid')
  }
  if (option.detail_source_text != null || option.detail_text_ref) {
    output.detail_source_text = String(option.detail_source_text ?? '')
    output.detail_text_ref = clone(requireValue(option.detail_text_ref, 'choice option.detail_text_ref'))
  }
  return output
}

function projectTextUnit(value, label) {
  if (!value) return undefined
  return {
    source_text: String(value.source_text ?? ''),
    text_ref: clone(requireValue(value.text_ref, `${label}.text_ref`)),
  }
}

function projectCue(cue, stepEvidence) {
  return {
    cue_id: cue.cue_id,
    at: cue.at,
    duration: cue.duration,
    channel: cue.channel,
    action: cue.action,
    target: cue.target ?? null,
    payload: clone(cue.payload || {}),
    lifecycle: clone(cue.lifecycle),
    evidence: projectEvidence(cue.evidence, stepEvidence, {
      confidence: cue.evidence?.confidence ?? 'derived',
      parserRule: cue.evidence?.legacy_field ? `legacy:${cue.evidence.legacy_field}` : 'scenario-normalizer-v2',
    }),
  }
}

function projectStep(step) {
  const evidence = projectEvidence(step.evidence)
  const output = {
    step_id: step.step_id,
    type: step.type,
    entry_snapshot: clone(step.entry_snapshot || {}),
    settled_snapshot: clone(step.settled_snapshot || {}),
    snapshot_format: 'story-snapshot-v2',
    cues: (step.cues || []).map(cue => projectCue(cue, evidence)),
    flow: {
      advance: step.flow?.advance,
      blocks_skip: step.flow?.blocks_skip === true,
      choice_id: step.type === 'choice' ? (step.choice_id ?? step.flow?.choice_id ?? null) : null,
    },
    evidence,
  }
  for (const key of ['episode_index', 'episode_part', 'chara_id', 'auto_advance', 'duration', 'hide_dialogue', 'lipSync']) {
    if (key in step) output[key] = clone(step[key])
  }
  if (step.dialogue) output.dialogue = projectDialogue(step.dialogue)
  if (Array.isArray(step.options)) output.options = step.options.map(projectOption)
  if (step.choice_id) output.choice_id = step.choice_id
  if (step.text_time) output.text_time = projectTextUnit(step.text_time, 'text_time')
  if (step.stamp) output.stamp = clone(step.stamp)
  return output
}

function projectEpisodes(episodes = []) {
  return episodes.map(episode => {
    const output = {
      episode_index: Number(episode.episode_index ?? 0),
      start_step_id: Number(episode.start_step_id),
      end_step_id: Number(episode.end_step_id),
    }
    if (episode.source_scenario_id) output.source_scenario_id = String(episode.source_scenario_id)
    if (episode.episode_part != null) output.episode_part = String(episode.episode_part)
    return output
  })
}

function projectJumpPoints(jumpPoints = {}) {
  if (Array.isArray(jumpPoints)) return clone(jumpPoints)
  return Object.entries(jumpPoints).map(([jumpId, target]) => ({
    jump_id: jumpId,
    target_step_id: Number(target),
  }))
}

export function compileAuthoritativeScenario(input, { compilerVersion = 'scenario-compiler+normalizer-v2' } = {}) {
  const normalized = normalizeScenario(input)
  const source = requireValue(normalized.source, 'scenario.source')
  const output = {
    schema_version: 2,
    compiler_version: requireValue(compilerVersion, 'compilerVersion'),
    runtime_contract: 'story-runtime-v2',
    scenario_id: requireValue(normalized.scenario_id, 'scenario.scenario_id'),
    text_catalog_id: requireValue(normalized.text_catalog_id, 'scenario.text_catalog_id'),
    text_contract_version: 1,
    source: {
      raw_path: requireValue(source.raw_path, 'scenario.source.raw_path'),
      raw_hash: requireValue(source.raw_hash, 'scenario.source.raw_hash'),
      ...(Array.isArray(source.masterdata_ids) ? { masterdata_ids: clone(source.masterdata_ids) } : {}),
      ...(source.compiled_at ? { compiled_at: source.compiled_at } : {}),
    },
    steps: normalized.steps.map(projectStep),
  }
  if (Array.isArray(normalized.capabilities)) output.capabilities = clone(normalized.capabilities)
  if (normalized.resource_manifest) output.resource_manifest = clone(normalized.resource_manifest)
  if (Array.isArray(normalized.episodes) && normalized.episodes.length) output.episodes = projectEpisodes(normalized.episodes)
  if (normalized.jump_points && Object.keys(normalized.jump_points).length) output.jump_points = projectJumpPoints(normalized.jump_points)
  return output
}

export function compareAuthoritativeRuntimeProjection(input, authoritative) {
  const normalized = normalizeScenario(input)
  const differences = []
  if (normalized.scenario_id !== authoritative.scenario_id) differences.push('scenario_id')
  if (normalized.source?.raw_path !== authoritative.source?.raw_path) differences.push('source.raw_path')
  if (normalized.source?.raw_hash !== authoritative.source?.raw_hash) differences.push('source.raw_hash')
  if (normalized.steps.length !== authoritative.steps.length) differences.push('step_count')
  if (Array.isArray(normalized.episodes) && !isDeepStrictEqual(projectEpisodes(normalized.episodes), authoritative.episodes)) {
    differences.push('episodes')
  }
  if (normalized.jump_points && Object.keys(normalized.jump_points).length && !isDeepStrictEqual(
    projectJumpPoints(normalized.jump_points),
    authoritative.jump_points,
  )) differences.push('jump_points')
  const count = Math.min(normalized.steps.length, authoritative.steps.length)
  for (let index = 0; index < count; index++) {
    const before = normalized.steps[index]
    const after = authoritative.steps[index]
    const comparableBefore = {
      step_id: before.step_id,
      type: before.type,
      entry_snapshot: before.entry_snapshot,
      settled_snapshot: before.settled_snapshot,
      cues: (before.cues || []).map(({ evidence: _evidence, ...cue }) => cue),
      flow: {
        ...before.flow,
        choice_id: before.type === 'choice' ? (before.choice_id ?? before.flow?.choice_id ?? null) : null,
      },
    }
    const comparableAfter = {
      step_id: after.step_id,
      type: after.type,
      entry_snapshot: after.entry_snapshot,
      settled_snapshot: after.settled_snapshot,
      cues: (after.cues || []).map(({ evidence: _evidence, ...cue }) => cue),
      flow: after.flow,
    }
    for (const key of ['episode_index', 'episode_part', 'chara_id', 'auto_advance', 'duration', 'hide_dialogue', 'lipSync']) {
      if (key in before) comparableBefore[key] = before[key]
      if (key in after) comparableAfter[key] = after[key]
    }
    if (!isDeepStrictEqual(clone(comparableBefore), clone(comparableAfter))) differences.push(`steps[${index}]`)
    const textBefore = {
      dialogue: before.dialogue ? {
        speaker_identity: before.dialogue.speaker_identity,
        speaker_source_text: before.dialogue.speaker_text_ref
          ? String(before.dialogue.speaker_source_text ?? before.dialogue.speaker ?? '')
          : undefined,
        speaker_text_ref: before.dialogue.speaker_text_ref,
        source_text: before.dialogue.source_text,
        text_ref: before.dialogue.text_ref,
        voice: 'voice' in before.dialogue ? (before.dialogue.voice || null) : undefined,
        lip: 'lip' in before.dialogue ? before.dialogue.lip : undefined,
      } : undefined,
      options: before.options?.map(option => ({
        option_id: option.option_id,
        source_text: option.source_text,
        text_ref: option.text_ref,
        detail_source_text: option.detail_source_text,
        detail_text_ref: option.detail_text_ref,
        target_step_id: Number(option.target_step_id ?? option.step_id),
      })),
      text_time: before.text_time ? {
        source_text: before.text_time.source_text,
        text_ref: before.text_time.text_ref,
      } : undefined,
    }
    const textAfter = {
      dialogue: after.dialogue,
      options: after.options,
      text_time: after.text_time,
    }
    if (!isDeepStrictEqual(clone(textBefore), clone(textAfter))) differences.push(`steps[${index}].text`)
  }
  return { passed: differences.length === 0, differences }
}
