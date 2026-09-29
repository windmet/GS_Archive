import assert from 'node:assert/strict'
import { buildIdolIndex, projectChoiceEntryLinks, projectStudioContext } from './lib/ai-studio-context.mjs'
import { checkStudioRows, parseStudioResult, renderRepair, renderStudioInput } from './lib/ai-studio-markdown.mjs'
import { loadStudioPolicy, projectDocumentContext } from './lib/ai-studio-projection.mjs'

const policy = await loadStudioPolicy()
const idolIndex = buildIdolIndex({ idols: [
  { idol_code: '047shu', display_name: '天峰 秀' },
  { idol_code: '049eis', display_name: '眉見 鋭心' },
] })
const row = (id, speaker, performance = null) => ({
  kind: 'dialogue', source_text: 'あれ？', speaker, performance,
  text_ref: { unit_id: id, source_hash: `sha256:${'a'.repeat(64)}` },
})
const concealed = row('hidden', { kind: 'unknown', sourceName: '？？？', entityType: 'idol', entityId: '047shu' },
  { entityType: 'idol', entityId: '047shu' })
const hiddenContext = projectStudioContext(concealed, idolIndex)
assert.equal(hiddenContext.actor.entity_id, '047shu')
assert.equal(hiddenContext.display_speaker_source, '？？？')
assert.equal(hiddenContext.display_label_policy, 'keep-source-concealment')
assert.equal(projectStudioContext(row('eis', { kind: 'unknown', sourceName: '？？？', entityType: 'idol', entityId: '049eis' }), idolIndex).actor.entity_id, '049eis')
assert.equal(projectStudioContext(row('unresolved', { kind: 'unknown', sourceName: '？？？' }), idolIndex).actor.status, 'unresolved')
assert.equal(projectStudioContext(row('conflict', concealed.speaker, { entityType: 'idol', entityId: '049eis' }), idolIndex).actor.status, 'conflict')
assert.equal(projectStudioContext(row('producer', { kind: 'producer', sourceName: '●●●●●●●●●●' }, { entityType: 'idol', entityId: '047shu' }), idolIndex).actor.status, 'producer')

const choice = { ...row('choice', { kind: 'none' }), kind: 'choice', anchor: { step_index: 3 },
  option: { resolution: 'resolved', target_step_index: 0, target_step_id: 'step-zero' } }
const target = { ...row('target', { kind: 'none' }), anchor: { step_index: 0 } }
assert.deepEqual(projectChoiceEntryLinks([choice, target])[0].target_text_unit_ids, ['target'])
assert.equal(projectChoiceEntryLinks([choice, target])[0].graph_completeness, 'entry-only')
assert.equal(projectDocumentContext([choice, target], policy)[0].choice_entry.target_step_index, 0)

const malformed = parseStudioResult('| T000001 | text\n', ['T000001'])
assert(malformed.errors.some(error => error.includes('missing final pipe')))
assert.deepEqual(malformed.missing, ['T000001'])
const qa = checkStudioRows([{ rid: 'T000001', kind: 'dialogue', source_text: 'ARROW・B', protected_source: 'ARROW・B' }],
  new Map([['T000001', 'ARROW・B']]))
assert(!qa.review.some(error => error.includes('kana')))
assert(checkStudioRows([{ rid: 'T000001', kind: 'dialogue', source_text: 'っす', protected_source: 'っす' }],
  new Map([['T000001', 'っす']])).review.some(error => error.includes('kana')))

const batch = { batch_id: 'B001-test', source_commit: 'test', projection_version: 2,
  voice_roster: { '047shu': { name: '天峰 秀', style: 'Trial only', avoid: '', status: 'proposed-for-retrial-not-approved' } },
  documents: [{ document_id: 'doc', title: 'Test' }], rows: [
    { rid: 'T000001', document_id: 'doc', speaker: '？？？', kind: 'dialogue', protected_source: 'あれ？', context: hiddenContext },
    { rid: 'T000002', document_id: 'doc', speaker: '', kind: 'dialogue', protected_source: '次', context: projectStudioContext(row('next', { kind: 'none' }), idolIndex) },
  ] }
const input = renderStudioInput(batch)
assert(input.includes('| T000001 | ？？？ | 047shu | dialogue | dialogue | あれ？ |'))
const repair = renderRepair(batch, ['T000002'])
assert(repair.includes('| C000001 |'))
assert(repair.includes('| T000002 |'))
assert(repair.includes('C rows are read-only context'))
console.log('AI Studio context projection, concealment, choice entry, repair and QA verification passed')
