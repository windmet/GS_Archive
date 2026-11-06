import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { readerOpening, readerTitleShardKey, validateReaderTitles, validateReaderTitleShard } from '../src/presentation/ReaderTitle.js'

// Work rows show their document's opening line. Its translation rides in the document's Reader title
// shard (which the work page preloads with its read model), so the list downloads no reading
// documents. Every row's shard opening must read exactly as the Reader would show that line, with and
// without a P name, and StoryLineText must not fetch the document when the shard carries it.
const read = path => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'))
const index = validateReaderTitles(read('translations/zh-CN/reader-titles.json'))
const documents = {}
for (const key of Object.keys(index.shards)) Object.assign(documents, validateReaderTitleShard(read(`translations/zh-CN/${index.shards[key].file}`), index, key).documents)
const merged = { ...index, documents }
const manifest = new Map(read('data/reading/manifest.json').entries.map(entry => [entry.source_file, entry]))
const work = read('data/masterdata/work_story_index.json')

const view = (binding, producer_name) => resolveStoryText({ source: binding.source, textRef: binding, overlayEntry: binding,
  preferences: { story_content_mode: 'translation', story_translation_locale: 'zh-CN', producer_name } })
let rows = 0, named = 0
for (const idol of work.idols) for (const row of [...idol.short_stories, ...idol.scene_lines]) {
  const entry = manifest.get(row.compiled_file)
  assert.ok(entry, `${row.compiled_file}: no reading entry`)
  const document = read(`data/reading/${entry.file}`)
  const line = document.rows.find(item => item.kind === 'dialogue' || item.kind === 'narration')
  const overlay = read(`translations/zh-CN/scenarios/${document.text_catalog_id || document.scenario_id}.json`)
  const binding = readerOpening(merged, entry, row.dialogue_preview)
  assert.ok(binding, `${entry.document_id}: no opening in shard ${readerTitleShardKey(entry.document_id)}`)
  for (const producer of ['', '测试']) {
    const reader = resolveStoryText({ source: line.source_text, textRef: line.text_ref, overlayEntry: overlay.entries[line.text_ref.unit_id],
      preferences: { story_content_mode: 'translation', story_translation_locale: 'zh-CN', producer_name: producer } })
    const shard = view(binding, producer)
    assert.equal(shard.translation.available, reader.translation.available, `${entry.document_id}: availability`)
    assert.equal(shard.primary.text, reader.primary.text, `${entry.document_id}: opening differs from the Reader (P name "${producer}")`)
    if (producer && shard.primary.text !== view(binding, '').primary.text) named++
  }
  rows++
}
assert.ok(rows >= 600, `only ${rows} work rows checked`)
assert.ok(named > 0, 'no opening carries a P-name slot; the P-name comparison is vacuous')

// A different revision or source line does not bind.
const sample = [...manifest.values()].find(entry => documents[entry.document_id]?.opening)
const source = documents[sample.document_id].opening.source
assert.equal(readerOpening(merged, { ...sample, sha256: `sha256:${'0'.repeat(64)}` }, source), null)
assert.equal(readerOpening(merged, sample, `${source}x`), null)
assert.equal(readerOpening(merged, sample, source, 'ja-JP'), null)

const component = readFileSync(new URL('../src/components/archive/StoryLineText.vue', import.meta.url), 'utf8')
assert.match(component, /useReaderOpenings\(\)/, 'StoryLineText reads shard openings')
assert.match(component, /!props\.source \|\| opening\.value \|\| openingPending\.value\) return/, 'a shard opening skips the document download')
console.log(`Work row openings: ${rows} rows read from title shards as the Reader shows them (${named} with a P-name slot)`)
