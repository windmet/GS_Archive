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
  ['Choice', new URL('../src/components/choices/StageChoiceUI.vue', import.meta.url)],
  ['Backlog', new URL('../src/components/StoryBacklog.vue', import.meta.url)],
  ['Title', new URL('../src/components/TitleUI.vue', import.meta.url)],
  ['Synopsis', new URL('../src/components/SynopsisUI.vue', import.meta.url)],
  ['Mobile', new URL('../src/components/mobile/MobileMessageBubble.vue', import.meta.url)],
  ['Call', new URL('../src/components/mobile/MobileCallScene.vue', import.meta.url)],
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
const titleSource = await readFile(targets[3][1], 'utf8')
const synopsisSource = await readFile(targets[4][1], 'utf8')
const mobileSource = await readFile(targets[5][1], 'utf8')
const callSource = await readFile(targets[6][1], 'utf8')
const storyViewerSource = await readFile(new URL('../src/core/StoryViewer.vue', import.meta.url), 'utf8')
assert.doesNotMatch(advSource, /\{\{\s*display\.text\s*\}\}/)
assert.doesNotMatch(choiceSource, /\{\{\s*optionText\(/)
assert.doesNotMatch(backlogSource, /displayDialogue\(node\.dialogue\)\.text/)
assert.doesNotMatch(titleSource, /\{\{\s*(?:mainText|badgeText)\s*\}\}/)
assert.doesNotMatch(synopsisSource, /\{\{\s*(?:titleText|bodyText)\s*\}\}/)
assert.doesNotMatch(mobileSource, /messageParts\(msg\.text\)/)
assert.doesNotMatch(callSource, /\{\{\s*(?:dialogueText|optionText\()/)
assert.match(storyViewerSource, /<SynopsisUI\s+v-if="currentStep\.type === 'synopsis'"/,
  'StoryViewer must render authored synopsis steps')

console.log('Structured bilingual UI verification passed')
console.log('  ADV, Choice, Backlog, Title, Synopsis, Mobile, and Call render primary/secondary as independent DOM blocks')
console.log('  compatibility text remains one block and is never split to infer language identity')
