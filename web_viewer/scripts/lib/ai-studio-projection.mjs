import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { buildIdolIndex, CONTEXT_SCHEMA, projectChoiceEntryLinks, projectStudioContext } from './ai-studio-context.mjs'
import { projectRoot, sha256 } from './ai-studio-source.mjs'

const files = {
  dictionary: 'public/data/masterdata/idol_unit_dictionary.json',
  voice: 'translation/studio/policy/voice-profiles.proposal.json',
  glossary: 'translation/studio/policy/term-decisions.template.json',
  alias: 'translation/bible/reference/SideM_stable_aliases_from_calltable.json',
}

export async function loadStudioPolicy({ version = 2 } = {}) {
  assert(version === 2 || version === 3, 'Unsupported Studio projection version')
  const selected = version === 3 ? {
    ...files,
    voice: 'translation/studio/policy/voice-profiles.trial.v1.1.json',
    trial: 'translation/studio/policy/trial-policy.v2.2.json',
    prompt: 'translation/studio/policy/translation-r3.2.md',
    names: 'translation/studio/policy/idol-names.v1.json',
  } : files
  const bytes = Object.fromEntries(await Promise.all(Object.entries(selected).map(async ([key, file]) =>
    [key, await fs.readFile(path.join(projectRoot, file))])))
  const dictionary = JSON.parse(bytes.dictionary)
  const voice = JSON.parse(bytes.voice)
  const glossary = JSON.parse(bytes.glossary)
  assert.equal(voice.schema, version === 3 ? 'GS-VOICE-TRIAL-V1' : 'GS-VOICE-PROPOSAL-V1')
  assert.equal(glossary.status, 'pending-human-policy-selection')
  if (version === 2) assert(voice.profiles.every(profile => profile.status === 'proposed-for-retrial-not-approved'))
  else assert(voice.profiles.every(profile => profile.editorial_status === 'frozen-for-trial'
    && profile.public_approval === false && profile.required && profile.forbidden))
  assert(glossary.items.every(item => item.chosen_zh === null), 'Approved terminology requires an explicit policy revision')
  const trial = version === 3 ? JSON.parse(bytes.trial) : null
  const names = version === 3 ? JSON.parse(bytes.names) : null
  if (names) {
    assert.equal(names.schema, 'GS-IDOL-NAME-POLICY-V1')
    assert.equal(names.entries.length, 49)
    assert.equal(new Set(names.entries.map(entry => entry.entity_id)).size, 49)
    const ids = buildIdolIndex(dictionary)
    assert(names.entries.every(entry => ids.has(entry.entity_id) && entry.name && entry.source_name))
  }
  if (trial) {
    assert.equal(trial.schema, 'GS-TRIAL-POLICY-V2')
    assert.equal(trial.editorial_status, 'frozen-for-trial')
    assert.equal(trial.public_approval, false)
    assert(trial.items.every(item => item.editorial_status === 'frozen-for-trial'
      && item.public_approval === false && item.chosen_rendering))
    assert.equal(new Set(trial.items.map(item => item.key)).size, trial.items.length, 'Duplicate trial key')
    for (const item of trial.items) if (item.target_term) {
      assert(!item.target_entity_id, 'Term hints must not also claim an idol target')
      assert(item.target_term.entity_id.startsWith('trial:') && item.target_term.entity_type
        && item.target_term.canonical_ja, `Invalid trial term: ${item.key}`)
    }
  }
  return {
    version, idolIndex: buildIdolIndex(dictionary), voice, glossary, trial,
    prompt: version === 3 ? `${bytes.prompt.toString('utf8').trim()}\n\n## 项目姓名显示表\n\n${names.entries.map(entry =>
      `- ${[entry.source_name, ...(entry.source_aliases || [])].join('／')} → ${entry.name}${entry.status === 'pending-human-name-selection' ? '（中文名待确认，暂保留原名）' : ''}`).join('\n')}\n` : null,
    hashes: Object.fromEntries(Object.entries(bytes).map(([key, data]) => [`${key}_sha256`, sha256(data)])),
  }
}

export function projectDocumentContext(rows, policy) {
  const choices = new Map(projectChoiceEntryLinks(rows).map(choice => [choice.choice_unit_id, choice]))
  return rows.map(row => {
    const context = projectStudioContext(row, policy.idolIndex)
    context.choice_entry = choices.get(row.text_ref.unit_id) || null
    if (policy.version === 3) context.mentions = projectMentions(row, policy, context.actor)
    return context
  })
}

function projectMentions(row, policy, actor) {
  const matches = []
  for (const item of policy.trial.items) {
    if (!item.source_form || (!item.target_entity_id && !item.target_term)) continue
    if (item.actor_ids && (actor.status !== 'resolved' || !item.actor_ids.includes(actor.entity_id))) continue
    const target = item.target_term || policy.idolIndex.get(item.target_entity_id)
    assert(target, `Trial mention target absent from registry: ${item.key}`)
    let from = 0, index
    while ((index = row.source_text.indexOf(item.source_form, from)) !== -1) {
      matches.push({ source_form: item.source_form, source_start: index,
        target_entity_id: target.entity_id, canonical_ja: target.canonical_ja,
        ...(item.target_term ? { target_entity_type: target.entity_type } : {}),
        chosen_rendering: item.chosen_rendering, policy_key: item.key,
        evidence: 'exact-source-form+trial-policy', status: 'editorial-trial-hint' })
      from = index + item.source_form.length
    }
  }
  return matches.sort((a, b) => a.source_start - b.source_start || a.policy_key.localeCompare(b.policy_key))
}

export function studioPolicyManifest(policy) {
  return { context_schema: CONTEXT_SCHEMA, ...policy.hashes,
    voice_policy_status: policy.version === 3 ? 'frozen-for-trial-not-public' : 'proposed-for-retrial-not-approved',
    glossary_status: 'pending-human-policy-selection',
    ...(policy.version === 3 ? { trial_policy_status: 'frozen-for-trial-not-public' } : {}),
    alias_policy: 'external-reference-only-no-automatic-linking' }
}

export function voiceRoster(rows, voice) {
  const byName = new Map(voice.profiles.map(profile => [profile.canonical_ja.replace(/\s/gu, ''), profile]))
  const out = new Map()
  for (const row of rows) {
    const actor = row.context?.actor
    if (actor?.status !== 'resolved') continue
    const id = actor.entity_id
    if (out.has(id)) continue
    const profile = byName.get(actor.canonical_ja.replace(/\s/gu, ''))
    out.set(id, { name: actor.canonical_ja, status: profile?.status || profile?.editorial_status || 'no-profile',
      style: profile?.style || '', ...(profile?.required ? { required: profile.required } : {}),
      ...(profile?.forbidden ? { forbidden: profile.forbidden } : {}),
      ...(profile?.avoid ? { avoid: profile.avoid } : {}) })
  }
  return out
}
