import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The reader has one language choice: the text's own (原文 / 译文 / 双语). The archive-wide
// switch for names and descriptions stays out of the reader so the two choices do not nest.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const controls = read('src/components/archive/ReaderWorkspaceControls.vue')
assert.doesNotMatch(controls, /<ArchiveLanguageSwitch/, 'the reader chrome carries no archive-wide language switch')
assert.match(controls, /\{id:'original',label:'原文'\},\{id:'translation',label:'译文'\},\{id:'bilingual',label:'双语'\}/,
  'the reader names its text modes in full')
assert.match(controls, /role="group" aria-label="正文语言"/, 'the text language group is labelled as such')
const settings = read('src/components/archive/ReaderControlBar.vue')
for (const label of ['原文', '译文', '双语']) assert.ok(settings.includes(`label:'${label}'`), `the settings sheet uses the same word: ${label}`)
for (const reader of ['ArchiveStoryReader', 'ChapterStoryReader']) {
  const source = read(`src/components/archive/${reader}.vue`)
  assert.match(source, /<ReaderWorkspaceControls/, `${reader} uses the shared reader chrome`)
  assert.doesNotMatch(source, /<ArchiveLanguageSwitch/, `${reader} adds no second language switch`)
}
console.log('Reader language control: one text-language choice, named in full, no archive switch inside the reader')
