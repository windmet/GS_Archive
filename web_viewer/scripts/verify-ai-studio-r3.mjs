import assert from 'node:assert/strict'
import { loadStudioPolicy, projectDocumentContext, studioPolicyManifest, voiceRoster } from './lib/ai-studio-projection.mjs'
import { renderStudioInput, parseStudioResult, checkStudioRows } from './lib/ai-studio-markdown.mjs'
import { makeQualityRequest, mergeQualityPatch } from './lib/ai-studio-quality.mjs'

const policy = await loadStudioPolicy({ version: 3 })
assert.equal(policy.trial.schema, 'GS-TRIAL-POLICY-V2')
assert.equal(policy.trial.editorial_status, 'frozen-for-trial')
assert.equal(policy.trial.public_approval, false)
assert(policy.voice.profiles.every(profile => profile.required && profile.forbidden))
const sourceRow = (id, text, speaker = { kind: 'none' }, extra = {}) => ({
  kind: 'dialogue', source_text: text, speaker,
  text_ref: { unit_id: id, source_hash: `sha256:${'a'.repeat(64)}` }, ...extra,
})
const sources = [
  sourceRow('nao', 'なおくんやしろうくんと', { kind: 'idol', entityType: 'idol', entityId: '034kan', sourceName: '姫野 かのん' }),
  sourceRow('michiru', '道流さんと話しました', { kind: 'producer', sourceName: '<P>' }),
  sourceRow('choice', 'どちら？', { kind: 'none' }, { kind: 'choice', option: { resolution: 'resolved', target_step_index: 0 } }),
  sourceRow('target', 'この道', { kind: 'none' }, { anchor: { step_index: 0 } }),
]
const contexts = projectDocumentContext(sources, policy)
assert(contexts[0].mentions.some(item => item.target_entity_id === '032nao' && item.chosen_rendering === '直央君'))
assert(contexts[0].mentions.some(item => item.target_entity_id === '033shr' && item.chosen_rendering === '志狼君'))
assert(contexts[1].mentions.some(item => item.target_entity_id === '039mcr' && item.chosen_rendering === '道流先生'))
assert.equal(contexts[2].choice_entry.target_step_index, 0)
assert.deepEqual(contexts[2].choice_entry.target_text_unit_ids, ['target'])
const batch = { schema: 'GS-STUDIO-MD-V1', projection_version: 3,
  ...studioPolicyManifest(policy), batch_id: 'P001-test', source_commit: 'test',
  trial_prompt: policy.prompt, trial_policy: policy.trial,
  documents: [{ document_id: 'doc', title: 'test' }],
  rows: sources.map((source, index) => ({ rid: `T${String(index + 1).padStart(6, '0')}`,
    document_id: 'doc', unit_id: source.text_ref.unit_id, source_hash: source.text_ref.source_hash,
    kind: source.kind, speaker: source.speaker.sourceName || '', source_text: source.source_text,
    protected_source: source.source_text, context: contexts[index] })) }
batch.voice_roster = Object.fromEntries(voiceRoster(batch.rows, policy.voice))
const input = renderStudioInput(batch)
assert(input.includes('Mention T000001: なおくん → 岡村 直央 (032nao)'))
assert(input.includes('Mention T000002: 道流さん → 円城寺 道流 (039mcr)'))
assert(input.includes('Choice entry T000003: resolved; target T000004'))
assert(!input.includes('Avoid:'))
const qa = checkStudioRows([batch.rows[1]], new Map([['T000002', '道夫先生']]), { trialPolicy: policy.trial })
assert(qa.review.some(item => item.includes('trial term name-michiru')))
const name = checkStudioRows([{ rid: 'T1', source_text: 'タケルさん', protected_source: 'タケルさん', kind: 'dialogue' }],
  new Map([['T1', '武先生']]), { trialPolicy: policy.trial })
assert(!name.review.some(item => item.includes('kana')))
const grammar = checkStudioRows([{ rid: 'T1', source_text: 'タケルっす', protected_source: 'タケルっす', kind: 'dialogue' }],
  new Map([['T1', 'タケルっす']]), { trialPolicy: policy.trial })
assert(grammar.review.some(item => item.includes('kana')))

const qualityBatch = { ...batch, rows: [
  { ...batch.rows[0], rid: 'T000057' },
  { ...batch.rows[1], rid: 'T000058' },
  { ...batch.rows[2], rid: 'T000059' },
] }
const parentOutput = '| ID | Chinese |\n|---|---|\n| T000057 | 前文 |\n| T000058 | 旧甲 |\n| T000059 | 旧乙 |\n'
const { request, map } = makeQualityRequest(qualityBatch, parentOutput, ['T000058'])
assert.deepEqual(map.targets.map(item => item.rid), ['T000058', 'T000059'])
assert(request.includes('| C000057 |'))
const patch = '| ID | Chinese |\n|---|---|\n| T000058 | 修订甲 |\n| T000059 | 修订乙 |\n'
const merged = mergeQualityPatch(qualityBatch, parentOutput, request, map, patch)
assert.deepEqual(merged.changed, ['T000058', 'T000059'])
assert.equal(parseStudioResult(merged.output, qualityBatch.rows.map(item => item.rid)).translations.get('T000059'), '修订乙')
assert.throws(() => mergeQualityPatch(qualityBatch, parentOutput + ' ', request, map, patch), /Parent output changed/)
assert.throws(() => mergeQualityPatch(qualityBatch, parentOutput, request, map, '| T000058 | only one |'), /Patch must contain exactly/)
console.log('AI Studio R3 policy, mentions, choice mapping and quality repair verified')
