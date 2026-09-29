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

export async function loadStudioPolicy() {
  const bytes = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) =>
    [key, await fs.readFile(path.join(projectRoot, file))])))
  const dictionary = JSON.parse(bytes.dictionary)
  const voice = JSON.parse(bytes.voice)
  const glossary = JSON.parse(bytes.glossary)
  assert.equal(voice.schema, 'GS-VOICE-PROPOSAL-V1')
  assert.equal(glossary.status, 'pending-human-policy-selection')
  assert(voice.profiles.every(profile => profile.status === 'proposed-for-retrial-not-approved'))
  assert(glossary.items.every(item => item.chosen_zh === null), 'Approved terminology requires an explicit policy revision')
  return {
    idolIndex: buildIdolIndex(dictionary), voice, glossary,
    hashes: Object.fromEntries(Object.entries(bytes).map(([key, data]) => [`${key}_sha256`, sha256(data)])),
  }
}

export function projectDocumentContext(rows, policy) {
  const choices = new Map(projectChoiceEntryLinks(rows).map(choice => [choice.choice_unit_id, choice]))
  return rows.map(row => {
    const context = projectStudioContext(row, policy.idolIndex)
    context.choice_entry = choices.get(row.text_ref.unit_id) || null
    return context
  })
}

export function studioPolicyManifest(policy) {
  return { context_schema: CONTEXT_SCHEMA, ...policy.hashes,
    voice_policy_status: 'proposed-for-retrial-not-approved',
    glossary_status: 'pending-human-policy-selection',
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
    out.set(id, { name: actor.canonical_ja, status: profile?.status || 'no-profile',
      style: profile?.style || '', avoid: profile?.avoid || '' })
  }
  return out
}
