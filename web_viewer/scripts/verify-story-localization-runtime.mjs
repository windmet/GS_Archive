import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { effectScope, nextTick, ref } from 'vue'

import {
  createChoiceSelectionRecord,
  normalizeLegacyDialogue,
  normalizeChoiceSelection,
  preferencesFromLegacyLanguageMode,
} from '../src/localization/story/LegacyDialogueAdapter.js'
import { createStoryLocalization } from '../src/localization/story/StoryLocalizationContext.js'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import {
  TranslationRepository,
  validateStoryTranslationOverlay,
} from '../src/localization/story/TranslationRepository.js'
import { resolveText } from '../src/utils/TextHelper.js'

const overlayPath = new URL('../fixtures/localization/scenario-overlay-zh-CN.json', import.meta.url)
const overlay = JSON.parse(await readFile(overlayPath, 'utf8'))
const [unitId, fixtureEntry] = Object.entries(overlay.entries)[0]
const textRef = { unit_id: unitId, source_hash: fixtureEntry.source_hash }
const source = '今の鼻歌、君が歌っていたのかい？'
const speaker = {
  kind: 'idol',
  entityId: '007kei',
  sourceName: '都築 圭',
}

function response(status, body = '') {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() { return body },
  }
}

function resolve(overrides = {}) {
  return resolveStoryText({
    source,
    textRef,
    speaker,
    overlayEntry: fixtureEntry,
    preferences: {
      story_content_mode: 'original',
      story_translation_locale: 'zh-CN',
      bilingual_primary: 'original',
    },
    ...overrides,
  })
}

// Strict runtime schema validation.
assert.deepEqual(validateStoryTranslationOverlay(overlay, {
  scenarioId: overlay.scenario_id,
  locale: overlay.locale,
}), { valid: true, errors: [] })

const forbiddenOverlay = structuredClone(overlay)
forbiddenOverlay.entries[unitId].voice = 'must-not-enter-overlay'
const forbiddenResult = validateStoryTranslationOverlay(forbiddenOverlay, {
  scenarioId: overlay.scenario_id,
  locale: overlay.locale,
})
assert.equal(forbiddenResult.valid, false)
assert.ok(forbiddenResult.errors.some(error => error.includes('unexpected property')))

// Repository: deterministic URL, request coalescing, cache, lookup and diagnostics.
let fetchCount = 0
let fetchedUrl = ''
const repository = new TranslationRepository({
  baseUrl: '/translations/',
  assetRevision: 'fixture-1',
  fetchImpl: async url => {
    fetchCount += 1
    fetchedUrl = url
    return response(200, JSON.stringify(overlay))
  },
})
const [loadedA, loadedB] = await Promise.all([
  repository.loadScenario({ scenarioId: overlay.scenario_id, locale: overlay.locale }),
  repository.loadScenario({ scenarioId: overlay.scenario_id, locale: overlay.locale }),
])
assert.strictEqual(loadedA, loadedB)
assert.equal(fetchCount, 1)
assert.equal(fetchedUrl, '/translations/zh-CN/scenarios/1_4_001_01.json?rev=fixture-1')
assert.deepEqual(repository.getEntry({
  scenarioId: overlay.scenario_id,
  locale: overlay.locale,
  unitId,
}), fixtureEntry)
assert.equal(repository.getDiagnostics({
  scenarioId: overlay.scenario_id,
  locale: overlay.locale,
}).code, 'translation_ready')

repository.invalidate({ scenarioId: overlay.scenario_id, locale: overlay.locale })
await repository.loadScenario({ scenarioId: overlay.scenario_id, locale: overlay.locale })
assert.equal(fetchCount, 2)
repository.clear()
assert.equal(repository.getDiagnostics({ scenarioId: overlay.scenario_id, locale: overlay.locale }), null)

const missingRepository = new TranslationRepository({ fetchImpl: async () => response(404) })
const missing = await missingRepository.loadScenario({
  scenarioId: overlay.scenario_id,
  locale: overlay.locale,
})
assert.deepEqual(missing.entries, {})
assert.equal(missingRepository.getDiagnostics({
  scenarioId: overlay.scenario_id,
  locale: overlay.locale,
}).code, 'translation_missing')

const invalidRepository = new TranslationRepository({ fetchImpl: async () => response(200, '{') })
await invalidRepository.loadScenario({ scenarioId: overlay.scenario_id, locale: overlay.locale })
assert.equal(invalidRepository.getDiagnostics({
  scenarioId: overlay.scenario_id,
  locale: overlay.locale,
}).code, 'translation_invalid')

const mismatch = structuredClone(overlay)
mismatch.scenario_id = 'wrong_scenario'
const mismatchRepository = new TranslationRepository({
  fetchImpl: async () => response(200, JSON.stringify(mismatch)),
})
await mismatchRepository.loadScenario({ scenarioId: overlay.scenario_id, locale: overlay.locale })
assert.ok(mismatchRepository.getDiagnostics({
  scenarioId: overlay.scenario_id,
  locale: overlay.locale,
}).errors.some(error => error.includes('expected 1_4_001_01')))

await assert.rejects(
  () => repository.loadScenario({ scenarioId: '../escape', locale: 'zh-CN' }),
  { name: 'TypeError' },
)
const abortError = new Error('aborted')
abortError.name = 'AbortError'
const abortRepository = new TranslationRepository({ fetchImpl: async () => { throw abortError } })
await assert.rejects(
  () => abortRepository.loadScenario({ scenarioId: overlay.scenario_id, locale: overlay.locale }),
  { name: 'AbortError' },
)

// Resolver modes and fallback behavior.
const original = resolve()
assert.equal(original.primary.text, source)
assert.equal(original.primary.source, 'original')
assert.equal(original.secondary, null)
assert.equal(original.translation.available, true)

const translated = resolve({
  preferences: {
    story_content_mode: 'translation',
    story_translation_locale: 'zh-CN',
  },
})
assert.equal(translated.primary.text, fixtureEntry.text)
assert.equal(translated.primary.source, 'translation')
assert.equal(translated.translation.fallbackUsed, false)

const translationMissing = resolve({
  overlayEntry: null,
  preferences: {
    story_content_mode: 'translation',
    story_translation_locale: 'zh-CN',
  },
})
assert.equal(translationMissing.primary.text, source)
assert.equal(translationMissing.translation.status, 'missing')
assert.equal(translationMissing.translation.fallbackUsed, true)

const bilingualOriginal = resolve({
  preferences: {
    story_content_mode: 'bilingual',
    story_translation_locale: 'zh-CN',
    bilingual_primary: 'original',
  },
})
assert.equal(bilingualOriginal.primary.text, source)
assert.equal(bilingualOriginal.secondary.text, fixtureEntry.text)

const bilingualTranslation = resolve({
  preferences: {
    story_content_mode: 'bilingual',
    story_translation_locale: 'zh-CN',
    bilingual_primary: 'translation',
  },
  entityNames: { 'zh-CN': { '007kei': '都筑圭' } },
})
assert.equal(bilingualTranslation.primary.text, fixtureEntry.text)
assert.equal(bilingualTranslation.secondary.text, source)
assert.equal(bilingualTranslation.speaker.display, '都筑圭')

const bilingualMissing = resolve({
  overlayEntry: null,
  preferences: {
    story_content_mode: 'bilingual',
    story_translation_locale: 'zh-CN',
    bilingual_primary: 'translation',
  },
})
assert.equal(bilingualMissing.primary.text, source)
assert.equal(bilingualMissing.secondary, null)

const staleEntry = { ...fixtureEntry, source_hash: `sha256:${'0'.repeat(64)}` }
const stale = resolve({
  overlayEntry: staleEntry,
  preferences: {
    story_content_mode: 'translation',
    story_translation_locale: 'zh-CN',
  },
})
assert.equal(stale.primary.text, source)
assert.equal(stale.translation.available, false)
assert.equal(stale.translation.stale, true)
assert.equal(stale.translation.fallbackUsed, true)

const staleDebug = resolve({
  overlayEntry: staleEntry,
  allowStale: true,
  preferences: {
    story_content_mode: 'translation',
    story_translation_locale: 'zh-CN',
  },
})
assert.equal(staleDebug.primary.text, fixtureEntry.text)
assert.equal(staleDebug.translation.available, true)
assert.equal(staleDebug.translation.stale, true)

const unknownSpeaker = resolve({
  speaker: { kind: 'unknown', sourceName: '？？？' },
  preferences: { story_content_mode: 'translation', story_translation_locale: 'zh-CN' },
})
assert.equal(unknownSpeaker.speaker.display, '？？？')

// Legacy adapter: source priority, inline translation, speaker identity and mode migration.
const legacy = normalizeLegacyDialogue({
  speaker: '<P>',
  text: 'legacy source',
  text_jp: '日本語',
  text_cn: '中文',
})
assert.equal(legacy.source, '日本語')
assert.equal(legacy.speaker.kind, 'producer')
assert.equal(legacy.overlayEntry.text, '中文')
const legacyView = resolveStoryText({
  ...legacy,
  preferences: preferencesFromLegacyLanguageMode('BILINGUAL'),
})
assert.equal(legacyView.primary.text, '日本語')
assert.equal(legacyView.secondary.text, '中文')
assert.deepEqual(resolveText({ speaker: '<P>', text_jp: '日本語', text_cn: '中文' }, 'JP'), {
  speaker: '<P>',
  text: '日本語',
})
assert.deepEqual(resolveText({ speaker: '<P>', text_jp: '日本語', text_cn: '中文' }, 'CN'), {
  speaker: '<P>',
  text: '中文',
})
assert.deepEqual(resolveText({ speaker: '<P>', text_jp: '日本語', text_cn: '中文' }, 'BILINGUAL'), {
  speaker: '<P>',
  text: '日本語\n中文',
})

const currentShape = normalizeLegacyDialogue({
  speaker: 'legacy display name',
  speaker_identity: {
    kind: 'idol',
    entity_type: 'idol',
    entity_id: '007kei',
    source_name: '都築 圭',
  },
  source_text: 'line 1\r\nline 2',
  text_jp: 'must not win',
  text_ref: textRef,
})
assert.equal(currentShape.source, 'line 1\r\nline 2')
assert.equal(currentShape.speaker.sourceName, '都築 圭')
assert.equal(currentShape.speaker.entityId, '007kei')

const selection = createChoiceSelectionRecord({
  choice_id: 'ignored-option-choice',
  option_id: 'choice-option:fixture',
  source_text: 'source option',
  text_ref: textRef,
  detail: 'internal-detail-must-not-win',
  step_id: 999,
}, 'choice:fixture')
assert.deepEqual(selection, {
  choice_id: 'choice:fixture',
  option_id: 'choice-option:fixture',
  source_text: 'source option',
  text_ref: textRef,
})
assert.equal(Object.hasOwn(selection, 'step_id'), false)
assert.deepEqual(normalizeChoiceSelection('legacy selected text'), {
  source: 'legacy selected text',
  textRef: null,
  optionId: null,
  choiceId: null,
})

// Player-scoped context: overlay and language updates only recompute presentation.
const scope = effectScope()
const compiledData = ref(null)
const legacyLanguageMode = ref('JP')
const runtimeSentinel = {
  stepId: 12,
  generation: 7,
  voiceHandle: { id: 'voice-1', position: 1.25 },
  historyLength: 4,
}
const sentinelBefore = structuredClone(runtimeSentinel)
const context = scope.run(() => createStoryLocalization({
  compiledData,
  languageMode: legacyLanguageMode,
  repository: {
    async loadScenario({ scenarioId, locale }) {
      assert.equal(scenarioId, overlay.scenario_id)
      assert.equal(locale, overlay.locale)
      return overlay
    },
    getDiagnostics() { return { code: 'translation_ready' } },
  },
}))
compiledData.value = { scenario_id: 'episode-slice', text_catalog_id: overlay.scenario_id }
await nextTick()
await new Promise(resolve => setTimeout(resolve, 0))
const contextDialogue = {
  speaker: '都築 圭',
  speaker_identity: {
    kind: 'idol',
    entity_type: 'idol',
    entity_id: '007kei',
    source_name: '都築 圭',
  },
  source_text: source,
  text_ref: textRef,
}
assert.equal(context.resolveDialogue(contextDialogue).text, source)
legacyLanguageMode.value = 'CN'
assert.equal(context.resolveDialogue(contextDialogue).text, fixtureEntry.text)
assert.deepEqual(runtimeSentinel, sentinelBefore)
scope.stop()

const empty = resolveStoryText()
assert.equal(empty.primary.text, '')
assert.equal(empty.speaker.kind, 'none')

console.log('Story localization runtime verification passed')
console.log(`  fixture entries: ${Object.keys(overlay.entries).length}`)
console.log('  repository: ready/missing/invalid/abort/cache covered')
console.log('  resolver: original/translation/bilingual/stale/legacy covered')
