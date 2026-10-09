import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { effectScope, ref } from 'vue'

import {
  tokenizeProducerAddressing, renderProducerAddressing,
  protectProducerAddressingForTranslation, restoreProducerAddressingAfterTranslation,
} from '../src/localization/story/ProducerAddressing.js'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { createStoryTranslationDraft, importStoryTranslationDraft } from '../src/localization/story/StoryTranslationDraft.js'
import { diagnoseStoryTranslations, hasBlockingTranslationDiagnostics } from '../src/localization/story/TranslationDiagnostics.js'
import { createStoryLocalization } from '../src/localization/story/StoryLocalizationContext.js'
import { PlayerPreferencesRepository } from '../src/core/story-runtime/PlayerPreferencesRepository.js'
import { resolveText } from '../src/utils/TextHelper.js'
import { producerName, setStoryLanguagePreferences } from '../src/utils/LanguageStore.js'
import { presentProducerAddressingText } from '../src/presentation/ProducerAddressingText.js'
import { projectReadingFrontMatter } from '../src/presentation/ReadingFrontMatter.js'

const name = '叶絵理奈'
const ten = '●'.repeat(10)
const fourP = '●'.repeat(4) + 'プロデューサー'
const render = source => renderProducerAddressing(source, name)

assert.equal(render(`我が主${ten}`), `我が主${name}`)
assert.equal(render(`${ten}さん`), `${name}さん`)
assert.equal(render(`${ten}師匠`), `${name}師匠`)
assert.equal(render(`${fourP}ちゃん`), `${name}Pちゃん`)
assert.equal(render('監督、師匠、下僕、プロデューサー'), '監督、師匠、下僕、プロデューサー')
assert.equal(render(`●●●● ${'プロデューサー'}`), `●●●● ${'プロデューサー'}`)
// No name set: the idol's own form of address stands alone, otherwise the plain word for
// Producer in the text's language; the raw dots never reach readers.
for (const [source, locale, expected] of [
  [`${ten}監督、お願い！`, 'ja', '監督、お願い！'], [`${ten}监督，拜托！`, 'zh-CN', '监督，拜托！'],
  [`${ten}師匠`, 'ja', '師匠'], [`${ten}师父`, 'zh-CN', '师父'], [`${ten}ぴぃちゃん`, 'ja', 'ぴぃちゃん'], [`${ten}P酱`, 'zh-CN', 'P酱'],
  [`我が主${ten}。`, 'ja', '我が主プロデューサー。'], [`吾主${ten}。`, 'zh-CN', '吾主制作人。'],
  [`${ten}さん`, 'ja', 'プロデューサーさん'], [`${fourP}、ありがとな`, 'ja', 'プロデューサー、ありがとな'],
  [`${fourP}，谢谢`, 'zh-CN', '制作人，谢谢'], [`${fourP}酱！`, 'zh-CN', 'P酱！'],
]) {
  assert.equal(renderProducerAddressing(source, '', { locale }), expected, source)
  assert.equal(renderProducerAddressing(source), expected, `${source} (language from the text)`)
}
assert.equal(renderProducerAddressing('監督、師匠'), '監督、師匠', 'text without macros is untouched')
for (const length of [1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 20]) {
  const source = '●'.repeat(length) + 'プロデューサー'
  assert.equal(render(source), source)
}
assert.equal(renderProducerAddressing(fourP, '$&$1$$'), '$&$1$$P')
assert.equal(renderProducerAddressing(fourP, ten), `${ten}P`)
assert.equal(renderProducerAddressing(fourP, '社長P'), '社長PP')
assert.equal(renderProducerAddressing(fourP, '<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>P')
assert.throws(() => renderProducerAddressing(null, name), TypeError)

const raw = `😀我が主${ten}。${fourP}ちゃん`
const parts = tokenizeProducerAddressing(raw)
assert.equal(parts.map(part => part.text).join(''), raw)
for (const part of parts) assert.equal(raw.slice(part.start, part.end), part.text)

for (const [documentId, fragment, expected] of [
  ['1_2_029_01_e', `我が主${ten}`, `我が主${name}`],
  ['1_1_002_02_j', `${ten}さん`, `${name}さん`],
  ['1_2_012_01_a', '監督、お願い！', '監督、お願い！'],
]) {
  const document = JSON.parse(await readFile(new URL(`../public/data/reading/${documentId}.json`, import.meta.url), 'utf8'))
  const row = document.rows.find(item => item.source_text.includes(fragment))
  assert.ok(row, documentId)
  const before = JSON.stringify(row)
  const view = resolveStoryText({ source: row.source_text, textRef: row.text_ref, preferences: { producer_name: name } })
  assert.ok(view.primary.text.includes(expected), documentId)
  assert.equal(JSON.stringify(row), before)
  assert.equal(view.unitId, row.text_ref?.unit_id || null)
}

const source = `${ten}さん、${fourP}ちゃん`
const bundle = protectProducerAddressingForTranslation(source)
assert.equal(bundle.slots.length, 2)
assert.equal(bundle.text.includes(name), false)
assert.equal(restoreProducerAddressingAfterTranslation(`${bundle.slots[1].marker}，${bundle.slots[0].marker}`, bundle),
  `${fourP}，${ten}`)
for (const bad of [bundle.slots[0].marker, bundle.text + bundle.slots[0].marker,
  bundle.text + '{{GS_ADDRESS:9:producer_name}}', bundle.text + '{{GS_ADDRESS:bad']) {
  assert.throws(() => restoreProducerAddressingAfterTranslation(bad, bundle))
}

const overlayText = `${ten}さん` // overlays retain macros, not local display names
const textRef = { unit_id: 'test-unit', source_hash: 'sha256:test' }
const translated = resolveStoryText({ source: `${ten}さん`, textRef,
  overlayEntry: { text: overlayText, source_hash: textRef.source_hash, status: 'reviewed' },
  preferences: { producer_name: name, story_content_mode: 'translation' } })
assert.equal(translated.primary.text, `${name}さん`)
assert.equal(translated.translation.available, true)
const broken = resolveStoryText({ source: `${ten}さん`, textRef,
  overlayEntry: { text: `${name}さん`, source_hash: textRef.source_hash, status: 'reviewed' },
  preferences: { producer_name: name, story_content_mode: 'translation' } })
assert.equal(broken.primary.text, `${name}さん`)
assert.equal(broken.translation.available, false)
assert.equal(broken.translation.fallbackUsed, true)
assert.equal(broken.translation.slotsValid, false)

const unitId = 'story-text:v1:test-scenario:test-part:cmd-000001:dialogue:000'
const stableHash = `sha256:${'a'.repeat(64)}`
const draftEvidence = { scenario_id: 'test-scenario', source_raw_hash: stableHash, text_units: [
  { unit_id: unitId, source_hash: stableHash, source_text: source },
] }
const draft = createStoryTranslationDraft(draftEvidence)
assert.equal(draft.entries[unitId].source.includes(name), false)
const markers = protectProducerAddressingForTranslation(source).slots.map(slot => slot.marker)
draft.entries[unitId].translation = `${markers[1]}酱，${markers[0]}先生`
const imported = importStoryTranslationDraft(draftEvidence, draft)
assert.equal(imported.entries[unitId].text, `${fourP}酱，${ten}先生`)
assert.equal(hasBlockingTranslationDiagnostics(diagnoseStoryTranslations({ evidence: draftEvidence, overlay: imported })), false)
for (const invalidTranslation of [markers[0], `${markers[0]}${markers[0]}${markers[1]}`,
  `${markers[0]}{{GS_ADDRESS:1:producer_name}}`, `${markers[0]}{{GS_ADDRESS:9:producer_name_with_p}}`]) {
  assert.throws(() => importStoryTranslationDraft(draftEvidence, {
    ...draft, entries: { [unitId]: { ...draft.entries[unitId], translation: invalidTranslation } },
  }))
}
const invalidOverlay = { ...imported, entries: { [unitId]: { ...imported.entries[unitId], text: `${ten}先生` } } }
const invalidReport = diagnoseStoryTranslations({ evidence: draftEvidence, overlay: invalidOverlay })
assert.equal(hasBlockingTranslationDiagnostics(invalidReport), true)
assert.equal(invalidReport.counts.invalid, 1)

const storage = new Map()
const preferences = new PlayerPreferencesRepository({ storage: {
  getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
} })
assert.equal(preferences.load().producer_name, '')
preferences.update({ producer_name: '甲' })
assert.equal(new PlayerPreferencesRepository({ storage: preferences.storage }).load().producer_name, '甲')
preferences.update({ producer_name: '乙' })
assert.equal(preferences.load().producer_name, '乙')

const scope = effectScope()
const storyPreferences = ref({ story_content_mode: 'original', producer_name: '甲' })
const context = scope.run(() => createStoryLocalization({ compiledData: ref(null), storyPreferences }))
assert.equal(context.resolveDialogue({ source_text: `${fourP}さん` }).text, '甲Pさん')
storyPreferences.value = { ...storyPreferences.value, producer_name: '乙' }
assert.equal(context.resolveDialogue({ source_text: `${fourP}さん` }).text, '乙Pさん')
assert.equal(context.resolveChoiceOption({ source_text: `${ten}さん` }).text, '乙さん')
assert.equal(context.resolveChoiceSelection({ source_text: `${ten}さん` }).text, '乙さん')
assert.equal(context.resolveTimeCaption({ source_text: `${ten}さん` }).text, '乙さん')
scope.stop()

const originalName = producerName.value
setStoryLanguagePreferences({ producer_name: '甲' })
assert.equal(resolveText({ text_jp: `${fourP}さん` }, 'JP').text, '甲Pさん')
const readingManifest = JSON.parse(await readFile(new URL('../public/data/reading/manifest.json', import.meta.url), 'utf8'))
const sourceTitle = readingManifest.entries.find(entry => entry.title.includes(fourP))?.title
assert.ok(sourceTitle)
assert.equal(presentProducerAddressingText(sourceTitle), renderProducerAddressing(sourceTitle, '甲'))
const titleRow = { kind: 'title', source_text: sourceTitle, anchor: { row_id: 'title-row' } }
assert.equal(projectReadingFrontMatter([titleRow], sourceTitle).mergedTitleIds.has('title-row'), true)
setStoryLanguagePreferences({ producer_name: '乙' })
assert.equal(resolveText({ text_jp: `${fourP}さん` }, 'JP').text, '乙Pさん')
assert.equal(presentProducerAddressingText(sourceTitle), renderProducerAddressing(sourceTitle, '乙'))
setStoryLanguagePreferences({ producer_name: originalName })

console.log('Producer addressing shared runtime verified: Reader source, dialogue, choice, caption, fallback, preferences and translation slots')
{
  // The Producer nameplate: the reader's name when set, else 制作人 wherever the line is shown translated.
  const producer = { kind: 'producer', source_name: '<P>' }
  const plate = preferences => resolveStoryText({ source: 'はい。', speaker: producer, preferences }).speaker.display
  assert.equal(plate({ story_content_mode: 'translation', producer_name: '' }), '制作人')
  assert.equal(plate({ story_content_mode: 'original', producer_name: '' }), 'プロデューサー')
  assert.equal(plate({ story_content_mode: 'translation', producer_name: name }), `${name}P`)
}
