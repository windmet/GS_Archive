import assert from 'node:assert/strict'
import { loadStudioPolicy, projectDocumentContext, studioPolicyManifest, voiceRoster } from './lib/ai-studio-projection.mjs'
import { renderStudioInput, parseStudioResult, checkStudioRows, checkNamedSan } from './lib/ai-studio-markdown.mjs'
import { makeQualityRequest, mergeQualityPatch } from './lib/ai-studio-quality.mjs'

const policy = await loadStudioPolicy({ version: 3 })
assert.equal(policy.trial.schema, 'GS-TRIAL-POLICY-V2')
assert.equal(policy.trial.editorial_status, 'frozen-for-trial')
assert.equal(policy.trial.public_approval, false)
assert.equal(policy.trial.revision, 'R3.3')
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
assert(input.includes('T000099, T000100, T000999'))
for (const rid of ['T000099', 'T000100', 'T000999'])
  assert.deepEqual(parseStudioResult(`| ${rid} | 中文 |`, [rid]).errors, [])
for (const [invalid, expected] of [['T00100', 'T000100'], ['T00999', 'T000999']]) {
  const result = parseStudioResult(`| ${invalid} | 中文 |`, [expected])
  assert(result.errors.some(error => error.includes('Txxxxxx')))
  assert.deepEqual(result.missing, [expected]) // No silent padding or renumbering.
}
const idol = id => ({ kind: 'idol', entityType: 'idol', entityId: id })
const termSources = [
  sourceRow('cat', 'にゃこさんと315プロダクション', { kind: 'producer' }),
  sourceRow('master', '主よ、シモベとソーイチロー', idol('029ass')),
  sourceRow('other', '主よ、シモベとエンジェルちゃん', idol('025suz')),
  sourceRow('unknown', '主よ、シモベ', { kind: 'unknown', sourceName: '？？？' }),
  sourceRow('unit', 'もふもふえん'),
  sourceRow('slip', 'Beitのたきゃっ……', idol('009kyj')),
  sourceRow('angel', 'エンジェルちゃん', idol('003hok')),
]
const termContexts = projectDocumentContext(termSources, policy)
assert(termContexts[0].mentions.some(m => m.target_entity_type === 'animal' && m.chosen_rendering === '喵子'))
assert.equal(termContexts[0].actor.status, 'producer')
assert(termContexts[1].mentions.some(m => m.chosen_rendering === '吾主'))
assert(termContexts[1].mentions.some(m => m.target_entity_id === '028soi' && m.chosen_rendering === '庄一郎'))
assert.equal(termContexts[1].actor.entity_id, '029ass') // Mentioned idol never replaces actor.
assert.deepEqual(termContexts[2].mentions, [])
assert.deepEqual(termContexts[3].mentions, [])
assert.equal(termContexts[3].actor.status, 'unresolved')
assert(termContexts[4].mentions.some(m => m.chosen_rendering === 'もふもふえん'))
assert(termContexts[5].mentions.some(m => m.policy_key === 'kyoji-stutter'))
assert(termContexts[6].mentions.some(m => m.chosen_rendering === '天使酱'))
const roster = Object.fromEntries(voiceRoster(termSources.map((row, i) => ({ context: termContexts[i] })), policy.voice))
assert(roster['025suz'].style && roster['029ass'].required)
for (const id of ['026gen', '034kan']) {
  const context = projectDocumentContext([sourceRow(id, '台詞', idol(id))], policy)[0]
  assert(Object.fromEntries(voiceRoster([{ context }], policy.voice))[id].forbidden)
}
const wrongActor = checkStudioRows([{ rid: 'T000001', kind: 'dialogue',
  source_text: termSources[2].source_text, context: termContexts[2] }], new Map([['T000001', '主人，仆人和粉丝']]), { trialPolicy: policy.trial })
assert(!wrongActor.review.some(w => /aslan-|hokuto-angel/.test(w)))
const keptUnit = checkStudioRows([{ rid: 'T000001', kind: 'dialogue', source_text: 'もふもふえん',
  protected_source: 'もふもふえん' }], new Map([['T000001', 'もふもふえん']]), { trialPolicy: policy.trial })
assert(!keptUnit.review.some(w => w.includes('kana')))
const lesson = { rid: 'T000287', kind: 'dialogue', source_text: 'これは『こうひょう』だな。', protected_source: 'これは『こうひょう』だな。' }
assert(!checkStudioRows([lesson], new Map([[lesson.rid, '好评（こうひょう）']]), { trialPolicy: policy.trial }).review.length)
assert(checkStudioRows([lesson], new Map([[lesson.rid, '好评']]), { trialPolicy: policy.trial }).review.some(w => w.includes('meaningful reading')))
assert(checkStudioRows([lesson], new Map([[lesson.rid, '好评（こうひょう）っす']]), { trialPolicy: policy.trial }).review.some(w => w.includes('kana')))
const minori = projectDocumentContext([sourceRow('minori', 'みのりさん、ありがとう')], policy)[0]
assert(minori.mentions.some(m => m.target_entity_id === '011min' && m.chosen_rendering === '实'))
assert(policy.prompt.includes('渡辺 みのり → 渡边实'))
const qa = checkStudioRows([batch.rows[1]], new Map([['T000002', '道夫先生']]), { trialPolicy: policy.trial })
assert(qa.review.some(item => item.includes('trial term name-michiru')))
const name = checkStudioRows([{ rid: 'T1', source_text: 'タケルさん', protected_source: 'タケルさん', kind: 'dialogue' }],
  new Map([['T1', '武先生']]), { trialPolicy: policy.trial })
assert(!name.review.some(item => item.includes('kana')))
const grammar = checkStudioRows([{ rid: 'T1', source_text: 'タケルっす', protected_source: 'タケルっす', kind: 'dialogue' }],
  new Map([['T1', 'タケルっす']]), { trialPolicy: policy.trial })
assert(grammar.review.some(item => item.includes('kana')))
// R3.3 男極 event terms: per-line hints, and the nested division name satisfies both entries.
const league = projectDocumentContext([sourceRow('league', '『男極ッ！アイドルリーグ』のライブパフォーマンス部門')], policy)[0]
assert(league.mentions.some(m => m.policy_key === 'menkyoku-league-full' && m.chosen_rendering === '男极！偶像联赛'))
assert(league.mentions.some(m => m.policy_key === 'div-live-performance'))
const leagueRow = { rid: 'T1', kind: 'dialogue', source_text: '『男極ッ！アイドルリーグ』のライブパフォーマンス部門',
  protected_source: '『男極ッ！アイドルリーグ』のライブパフォーマンス部門', context: league }
assert.deepEqual(checkStudioRows([leagueRow], new Map([['T1', '“男极！偶像联赛”的现场表现力部门']]), { trialPolicy: policy.trial }).review, [])
assert(checkStudioRows([leagueRow], new Map([['T1', '“男极ッ！偶像联盟”的现场表现力部门']]), { trialPolicy: policy.trial })
  .review.some(item => item.includes('menkyoku-league-full')))
assert(!policy.trial.pending_terms.some(term => term.startsWith('男極')))
// R3.3: named さん keeps 先生 (B001 reviewed convention); せんせい is 老师.
assert(policy.prompt.includes('R3.3') && policy.prompt.includes('男性人名＋さん'))
const san = (source, text) => checkNamedSan(source, text, policy.trial)
assert.match(san('圭さん、麗くん、よろしく', '圭、丽君，请多关照'), /dropped \(0\/1\)/u)
assert.equal(san('圭さん、麗くん、よろしく', '圭先生、丽君，请多关照'), null)
assert.equal(san('わたなべさんとしんげんさん', '渡边先生和信玄先生'), null)
assert.match(san('わたなべさんとしんげんさん', '渡边和信玄先生'), /dropped \(1\/2\)/u)
assert.equal(san('またたくさんのお客さん、皆さん、スタッフさん', '还有很多客人、大家、工作人员'), null)
assert.equal(san('サンキュー！　お前さんたち', 'Thank you！你们几个'), null)
assert.equal(san('にゃこさんと番長さん、賢アニさん', '喵子和番长、贤哥'), null)
// B003 false positives: old man, roles, かのん's animal words, 賛成 in kana.
assert.equal(san('おじいさんとじいさん、トレーナーさん、主催者さん', '老爷爷和老头、指导老师、主办方'), null)
assert.equal(san('うさぎさんとひよこさん。かのんもさんせい！', '小兔子和小鸡。花音也赞成！'), null)
assert.match(san('おーい、享介さんよぉ！', '喂——，享介！'), /dropped \(0\/1\)/u)
assert.equal(san('先生、行こう！', '先生，我们走！'), 'せんせい rendered as 先生')
assert.equal(san('先生、行こう！', '老师，我们走！'), null)
assert(checkStudioRows([{ rid: 'T1', kind: 'dialogue', source_text: '恭二さん。', protected_source: '恭二さん。' }],
  new Map([['T1', '恭二。']]), { trialPolicy: policy.trial }).review.some(item => item.includes('honorific')))

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
