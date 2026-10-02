import assert from 'node:assert/strict'
import { createStoryTranslationDraft, importStoryTranslationDraft } from '../src/localization/story/StoryTranslationDraft.js'
import { protectProducerAddressingForTranslation } from '../src/localization/story/ProducerAddressing.js'
import { loadStudioIndexes, loadStudioDocument } from './lib/ai-studio-source.mjs'
import { parseStudioResult, checkStudioRows, escapeCell, renderStudioInput } from './lib/ai-studio-markdown.mjs'

assert.equal(escapeCell('A\\B|C\nD'), 'A\\\\B\\|C<br>D')
const parsed = parseStudioResult('# Result\n\n| ID | Chinese |\n|---|---|\n| T000002 | C |\n| T000001 | A\\|B<br>D |\n',
  ['T000001', 'T000002'])
assert.deepEqual(parsed.errors, [])
assert.equal(parsed.translations.get('T000001'), 'A|B\nD')
assert(parseStudioResult('| T000001 | A |\n| T000001 | B |\n| T000999 | C |',
  ['T000001', 'T000002']).errors.some(error => error.includes('duplicate')))
assert(parseStudioResult('| T000001 | A |', ['T000001', 'T000002']).missing.includes('T000002'))
assert(parseStudioResult('| T000001 | A |\n| T000999 | C |', ['T000001']).errors.some(error => error.includes('unknown')))

const source = '●'.repeat(10) + 'さん、' + '●'.repeat(4) + 'プロデューサーちゃん'
const protectedText = protectProducerAddressingForTranslation(source).text
const row = { rid: 'T000001', source_text: source, protected_source: protectedText, kind: 'dialogue' }
assert.deepEqual(checkStudioRows([row], new Map([['T000001', protectedText]])).blocking, [])
assert(checkStudioRows([row], new Map([['T000001', protectedText.replace('producer_name_with_p', 'producer_name')]])).blocking.length)

const indexes = await loadStudioIndexes()
let units = 0
for (const entry of indexes.reading.entries) {
  const item = await loadStudioDocument(entry, indexes)
  units += item.rows.length
}
assert.equal(units, 30121)

for (const id of ['1_1_002_02_j', '025suz_403_2_4_025_03_09_b']) {
  const entry = indexes.reading.entries.find(item => item.document_id === id)
  assert(entry, id)
  const item = await loadStudioDocument(entry, indexes)
  const draft = createStoryTranslationDraft(item.evidence)
  for (const value of Object.values(draft.entries)) value.translation = `中${value.source}`
  const overlay = importStoryTranslationDraft(item.evidence, draft)
  assert.equal(overlay.scenario_id, item.evidence.scenario_id)
  assert(Object.values(overlay.entries).every(value => value.status === 'draft'))
  const batch = { batch_id: 'B001-test', source_commit: 'test', documents: [{ document_id: id, title: entry.title }],
    rows: item.rows.map((sourceRow, index) => ({ rid: `T${String(index + 1).padStart(6, '0')}`,
      document_id: id, protected_source: item.draft.entries[sourceRow.text_ref.unit_id].source,
      kind: sourceRow.kind, speaker: sourceRow.speaker?.sourceName || '' })) }
  const markdown = renderStudioInput(batch)
  assert(!markdown.includes('●'), 'Model input contains raw Producer placeholder')
  assert(!markdown.includes('story-text:v1:'), 'Model input contains canonical unit ID')
}
console.log(`AI Studio translation adapter verified: ${indexes.reading.entries.length} Reader documents / ${units} source-bound units`)
