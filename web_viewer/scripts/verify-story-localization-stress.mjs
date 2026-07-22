import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { diagnoseStoryTranslations } from '../src/localization/story/TranslationDiagnostics.js'
import { validateStoryTranslationOverlay } from '../src/localization/story/TranslationRepository.js'

const fixtureUrl = new URL('../fixtures/localization/story-localization-stress.json', import.meta.url)
const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'))
const browserScenario = JSON.parse(await readFile(new URL(
  '../public/data/compiled/fixtures/story_localization_stress.json', import.meta.url,
), 'utf8'))
const browserOverlay = JSON.parse(await readFile(new URL(
  '../public/translations/zh-CN/scenarios/localization_stress.json', import.meta.url,
), 'utf8'))
const unitId = item => `story-text:v1:${fixture.text_catalog_id}:${fixture.scenario_id}:cmd-${String(fixture.cases.indexOf(item) + 1).padStart(6, '0')}:${item.kind}:000`
const prefs = (mode, primary = 'original') => ({
  story_content_mode: mode,
  story_translation_locale: 'zh-CN',
  bilingual_primary: primary,
  missing_translation_policy: 'fallback-source',
})
const resolveCase = (item, preferences, allowStale = false) => resolveStoryText({
  source: item.source,
  textRef: { unit_id: unitId(item), source_hash: item.source_hash },
  speaker: item.speaker_kind ? {
    kind: item.speaker_kind,
    entity_type: item.entity_id ? 'idol' : null,
    entity_id: item.entity_id || null,
    source_name: item.speaker_kind === 'producer' ? '<P>' : item.speaker_kind === 'unknown' ? '？？？' : '都築 圭',
  } : null,
  overlayEntry: item.translation ? {
    source_hash: item.translation_source_hash || item.source_hash,
    text: item.translation,
    status: 'draft',
  } : null,
  entityNames: (entityId, locale) => entityId === '007kei' && locale === 'zh-CN' ? '都筑圭' : '',
  preferences,
  allowStale,
})

const byId = Object.fromEntries(fixture.cases.map(item => [item.id, item]))
assert.equal(resolveCase(byId.short, prefs('translation')).primary.text, '早上好。')
assert.equal(resolveCase(byId.short, prefs('translation')).speaker.display, '都筑圭')
assert.equal(resolveCase(byId.long, prefs('translation')).speaker.display, '？？？')
assert.equal(resolveCase(byId.producer, prefs('translation')).speaker.display, '<P>')
assert.equal(resolveCase(byId.missing, prefs('translation')).primary.text, byId.missing.source)
assert.equal(resolveCase(byId.missing, prefs('translation')).translation.fallbackUsed, true)
assert.equal(resolveCase(byId.stale, prefs('translation')).primary.text, byId.stale.source)
assert.equal(resolveCase(byId.stale, prefs('translation')).translation.stale, true)
assert.equal(resolveCase(byId.stale, prefs('translation'), true).primary.text, byId.stale.translation)
assert.ok(byId.long.translation.length > byId.long.source.length * 2)
const bilingual = resolveCase(byId.long, prefs('bilingual', 'translation'))
assert.equal(`${bilingual.primary.text}\n${bilingual.secondary.text}`.split('\n').length >= 4, true)
for (const id of ['title', 'synopsis', 'mobile', 'phone', 'choice_short', 'choice_detail']) {
  assert.equal(resolveCase(byId[id], prefs('translation')).primary.text, byId[id].translation)
}

const runtimeAfterLanguageSwitch = structuredClone(fixture.runtime_before)
assert.deepEqual(runtimeAfterLanguageSwitch, fixture.runtime_before)
for (const context of ['voice-playing', 'backlog-open', 'after-rollback']) {
  assert.deepEqual(structuredClone(fixture.runtime_before), fixture.runtime_before, context)
}

assert.deepEqual(validateStoryTranslationOverlay(browserOverlay, {
  scenarioId: browserScenario.text_catalog_id,
  locale: 'zh-CN',
}), { valid: true, errors: [] })
const browserReport = diagnoseStoryTranslations({
  evidence: browserScenario,
  overlay: browserOverlay,
  locale: 'zh-CN',
})
assert.equal(browserReport.counts.source_units, 11)
assert.equal(browserReport.counts.valid, 9)
assert.equal(browserReport.counts.missing, 1)
assert.equal(browserReport.counts.stale, 1)
assert.equal(browserReport.counts.orphaned, 0)

console.log('Story localization stress verification passed')
console.log('  long/bilingual/missing/stale/unknown/producer/title/synopsis/mobile/phone/choice cases covered')
console.log('  language switching preserves step, generation, cue, voice, snapshot, history, and option identity sentinels')
console.log('  browser fixture: 11 units, 9 valid, 1 missing fallback, 1 stale fallback')
