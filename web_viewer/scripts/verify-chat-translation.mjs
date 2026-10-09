import assert from 'node:assert/strict'
import fs from 'node:fs'
import { effectScope, ref } from 'vue'
import { sourceUnits, CHAT_KINDS, shards, rootOverlayEntries } from './lib/general-translation-batches.mjs'
import { planCompactBatches, renderCompactInput } from './lib/general-translation-markdown.mjs'
import { chatTranslation, isLegacyChat } from '../src/localization/story/ChatTranslations.js'
import { createStoryLocalization } from '../src/localization/story/StoryLocalizationContext.js'

// Chats (personal and unit talks, random topics) translate by source text through the general
// workflow, conversation by conversation, and reach the Player through the shared chats overlay.
const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const index = JSON.parse(fs.readFileSync(new URL('../translation/studio/source/chat-text-index.json', import.meta.url), 'utf8')).files
assert.equal(Object.keys(index).length, 649, 'every chat file referenced by the mobile and random talk indexes')
const units = sourceUnits(root)
const chats = units.filter(unit => CHAT_KINDS.includes(unit.kind))
const indexRows = Object.values(index).flatMap(file => file.rows)
assert.equal(chats.length, new Set(indexRows.map(row => `${row.kind === 'line' ? 'chat-line:text' : row.kind === 'detail' ? 'chat-choice:detail' : 'chat-choice:text'}:${row.source}`)).size, 'one unit per kind, field and source')
assert.equal(chats.reduce((n, unit) => n + unit.references.length, 0), indexRows.length, 'every chat row is referenced')
assert.ok(chats.every(unit => unit.references.every(ref => ref.speaker && ref.owner)), 'every reference keeps its speaker and conversation owner')
assert.ok(Object.entries(shards).every(([name, select]) => name === 'chats' ? CHAT_KINDS.every(select) : !CHAT_KINDS.some(select)))
assert.deepEqual(Object.keys(rootOverlayEntries({ card: {}, 'chat-line': {}, 'chat-choice': {} })), ['card'], 'chats stay out of the bundled root overlay')

// Batches: whole conversations in order, chat instructions, speaker lines that are not translated.
const { batches, contexts } = planCompactBatches(units)
const chatBatches = batches.filter(batch => batch.batch_id.startsWith('G-chats-'))
const rows = chatBatches.flatMap(batch => batch.rows)
assert.equal(rows.length, chats.length)
const conversations = rows.map(row => row.references[0].id.split(':')[0])
const seen = new Set()
conversations.forEach((conversation, at) => { if (at && conversations[at - 1] !== conversation) { assert.ok(!seen.has(conversation), `${conversation} is contiguous`); seen.add(conversations[at - 1]) } })
const input = renderCompactInput(chatBatches[0], contexts)
assert.match(input, /聊天翻译/)
assert.match(input, /### 对话：.+ · /)
assert.match(input, /【说话人：/)
assert.doesNotMatch(input, /本批只含通用资料/)

// Runtime: a legacy chat reads its lines from the chats overlay; story text units are untouched.
const name = '●'.repeat(4) + 'プロデューサー'
const overlay = { schemaVersion: 1, status: 'draft', entries: {
  'chat-line': { text: { [`お疲れ、\n${name}`]: `辛苦了，\n${name}`, 'おう、任せとけ！': '嗯，交给我吧！', [`スロット${name}消失`]: '（没有占位符）' } },
  'chat-choice': { text: { '流石です！': '真厉害！' }, detail: { '流石です！\n頑張ってください。': '真厉害！\n加油哦。' } } } }
assert.equal(chatTranslation(overlay.entries, '流石です！'), '真厉害！')
const chat = { scenario_id: '8_1_x_fixture', steps: [
  { step_id: 1, type: 'talk', dialogue: { speaker: '天ヶ瀬 冬馬', text: `お疲れ、\n${name}`, text_jp: `お疲れ、\n${name}`, text_cn: '' } },
  { step_id: 2, type: 'talk', dialogue: { speaker: '天ヶ瀬 冬馬', text: 'おう、任せとけ！', text_jp: 'おう、任せとけ！', text_cn: '' } }] }
assert.equal(isLegacyChat(chat), true)
assert.equal(isLegacyChat({ steps: [{ type: 'talk', dialogue: { text: 'x', text_ref: { unit_id: 'u' } } }] }), false, 'stories with text units are not chats')
const originalFetch = globalThis.fetch
globalThis.fetch = async url => String(url).includes('/archive-general/chats.json')
  ? new Response(JSON.stringify(overlay), { status: 200, headers: { 'content-type': 'application/json' } })
  : new Response('missing', { status: 404 })
try {
  const preferences = ref({ story_content_mode: 'translation', story_translation_locale: 'zh-CN' })
  const scope = effectScope()
  const localization = scope.run(() => createStoryLocalization({ compiledData: ref(chat), storyPreferences: preferences,
    repository: { async loadScenario() { return null }, getDiagnostics() { return null } },
    entityRepository: { async loadEntity() {}, getDiagnostics() { return null }, getEntry() { return null } } }))
  for (let tries = 0; localization.loading.value && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(localization.loading.value, false)
  assert.equal(localization.resolveDialogue(chat.steps[1].dialogue).text, '嗯，交给我吧！')
  assert.equal(localization.resolveDialogue(chat.steps[0].dialogue).view.primary.text, '辛苦了，\n制作人', 'the name slot survives the translation and reads 制作人 without a name')
  assert.equal(localization.resolveChoiceOption({ text: '流石です！', detail: '流石です！\n頑張ってください。' }).text, '真厉害！')
  assert.equal(localization.resolveChoiceOption({ text: '流石です！', detail: '流石です！\n頑張ってください。' }, { detail: true }).text, '真厉害！\n加油哦。')
  assert.equal(localization.resolveUnit({ source: `スロット${name}消失` }).primary.text, 'スロットプロデューサー消失', 'a translation that drops a name slot is not shown')
  assert.equal(localization.resolveUnit({ source: 'おう、任せとけ！', textRef: { unit_id: 'story-text:v1:x:y:cmd-000001:dialogue:000', source_hash: 'sha256:x' } }).primary.text, 'おう、任せとけ！', 'text units never borrow chat translations')
  preferences.value = { ...preferences.value, story_content_mode: 'original' }
  for (let tries = 0; localization.loading.value && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(localization.resolveDialogue(chat.steps[1].dialogue).text, 'おう、任せとけ！', 'the original stays Japanese')
  scope.stop()
} finally { globalThis.fetch = originalFetch }
console.log(`Chat translation: ${chats.length} units (${indexRows.length} rows, 649 chats) in ${chatBatches.length} batches; Player lookup verified`)
