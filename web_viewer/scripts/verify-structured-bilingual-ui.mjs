import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { normalizeLocalizedDisplay } from '../src/localization/story/LocalizedDisplay.js'

const structured = normalizeLocalizedDisplay({
  text: '互換表示は構造判定に使わない\n兼容显示不参与结构推断',
  view: {
    unitId: 'story-text:v1:fixture:fixture:cmd-000001:dialogue:000',
    primary: { locale: 'ja-JP', text: '原文', source: 'original' },
    secondary: { locale: 'zh-CN', text: '译文', source: 'translation' },
    translation: { available: true, stale: false, fallbackUsed: false },
  },
})

assert.equal(structured.bilingual, true)
assert.equal(structured.primary.text, '原文')
assert.equal(structured.primary.locale, 'ja-JP')
assert.equal(structured.secondary.text, '译文')
assert.equal(structured.secondary.locale, 'zh-CN')
assert.equal(structured.unitId, 'story-text:v1:fixture:fixture:cmd-000001:dialogue:000')

const compatibility = normalizeLocalizedDisplay({ text: '一行\n二行' })
assert.equal(compatibility.bilingual, false)
assert.equal(compatibility.primary.text, '一行\n二行')
assert.equal(compatibility.primary.source, 'compatibility')
assert.equal(compatibility.secondary, null)

const missing = normalizeLocalizedDisplay(null)
assert.equal(missing.primary, null)
assert.equal(missing.secondary, null)

const componentUrl = new URL('../src/components/LocalizedTextBlock.vue', import.meta.url)
const targets = [
  ['ADV', new URL('../src/components/AdvUI.vue', import.meta.url)],
  ['Choice', new URL('../src/components/ChoiceUI.vue', import.meta.url)],
  ['Backlog', new URL('../src/components/StoryBacklog.vue', import.meta.url)],
]
const componentSource = await readFile(componentUrl, 'utf8')
assert.match(componentSource, /class="localized-primary"/)
assert.match(componentSource, /class="localized-secondary"/)
assert.match(componentSource, /:lang="content\.primary\.locale/)
assert.doesNotMatch(componentSource, /split\(['"]\\n/)

for (const [label, url] of targets) {
  const source = await readFile(url, 'utf8')
  assert.match(source, /LocalizedTextBlock/, `${label} must render structured localized blocks`)
}

const advSource = await readFile(targets[0][1], 'utf8')
const choiceSource = await readFile(targets[1][1], 'utf8')
const backlogSource = await readFile(targets[2][1], 'utf8')
assert.doesNotMatch(advSource, /\{\{\s*display\.text\s*\}\}/)
assert.doesNotMatch(choiceSource, /\{\{\s*optionText\(/)
assert.doesNotMatch(backlogSource, /displayDialogue\(node\.dialogue\)\.text/)

console.log('Structured bilingual UI verification passed')
console.log('  ADV, Choice, and Backlog render primary/secondary as independent DOM blocks')
console.log('  compatibility text remains one block and is never split to infer language identity')

