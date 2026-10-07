import assert from 'node:assert/strict'
import fs from 'node:fs'
import { readerStoryTitle, readerTitle, validateReaderTitles } from '../src/presentation/ReaderTitle.js'
const index = validateReaderTitles(JSON.parse(fs.readFileSync(new URL('../public/translations/zh-CN/reader-titles.json',import.meta.url))))
const manifest = JSON.parse(fs.readFileSync(new URL('../public/data/reading/manifest.json',import.meta.url)))
for (const id of Object.keys(index.documents)) {
  const entry = manifest.entries.find(item=>item.document_id===id)
  const translated = index.titles[index.documents[id].title]
  assert.equal(readerTitle(index,entry,entry.title),translated.text)
  assert.equal(readerTitle(index,entry,entry.title,'ja-JP'),entry.title,'Japanese metadata uses the source heading without changing story reading mode')
  assert.equal(readerTitle(index,{...entry,sha256:'sha256:'+'0'.repeat(64)},entry.title),entry.title,'new document revision does not reuse stale metadata')
  assert.equal(readerTitle(index,entry,'different source'),'different source','same ID cannot translate a different title')
}
assert.equal(readerTitle(index,{document_id:'untranslated'},'原文'),'原文')
assert.throws(()=>validateReaderTitles({...index,documents:{bad:{revision:'invalid',title:0}}}))
assert.ok(Buffer.byteLength(JSON.stringify(index)) < 64 * 1024,'optional title-only index stays below 64 KiB; split before expanding past this budget')
// Pages that know only the story file (the portal) bind by story id plus the exact source title.
for (const title of index.titles) {
  const story = title.unit_id.split(':')[2]
  assert.equal(readerStoryTitle(index, `${story}.json`, title.source), title.text, `${story}: story-file binding`)
  assert.equal(readerStoryTitle(index, `${story}.json`, `${title.source}x`), `${title.source}x`, 'a different source title keeps its text')
  assert.equal(readerStoryTitle(index, 'other_story.json', title.source), title.source, 'another story does not borrow the title')
  assert.equal(readerStoryTitle(index, `${story}.json`, title.source, 'ja-JP'), title.source, 'the Japanese UI keeps the source')
}
console.log(`Reader translated headings: ${index.titles.length} titles, ${Object.keys(index.documents).length} exact revision bindings, conservative fallback`)
