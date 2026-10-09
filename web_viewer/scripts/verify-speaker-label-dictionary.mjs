import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { effectScope, ref } from 'vue'
import { speakerLabelCandidates, speakerLabelKey } from '../src/localization/story/SpeakerDisplayNames.js'
import { hashEntitySourceText, validateEntityTranslationOverlay } from '../src/localization/story/EntityTranslationRepository.js'
import { collectScenarioEntitySourceNames, createStoryLocalization } from '../src/localization/story/StoryLocalizationContext.js'

// Nameplates without an entity are translated from one label dictionary. Check it against every
// Reader document, so a new story cannot add an untranslated plate unnoticed.
const read = async path => JSON.parse(await fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'))
const dictionary = await read('public/translations/zh-CN/entities/speakers.json')
const validation = validateEntityTranslationOverlay(dictionary, { entityType: 'speaker', locale: 'zh-CN' })
assert.ok(validation.valid, validation.errors.join('\n'))
const baseKey = id => id.split('@')[0]
for (const [id, entry] of Object.entries(dictionary.entries))
  assert.equal(entry.source_hash, await hashEntitySourceText(baseKey(id)), `source hash binds the label: ${id}`)

// Source data placeholders name nobody; showing a guess would invent an identity.
const UNTRANSLATED = new Set(['#N/A'])
const labels = new Map()
for (const entry of (await read('public/data/reading/manifest.json')).entries) {
  const document = await read(`public/data/reading/${entry.file}`)
  for (const row of document.rows) {
    const key = speakerLabelKey(row.speaker)
    if (key) labels.set(key, (labels.get(key) || 0) + 1)
  }
}
const missing = [...labels.keys()].filter(key => !UNTRANSLATED.has(key) && !dictionary.entries[key])
assert.deepEqual(missing, [], 'every entity-less nameplate in the Reader corpus has a translation')
const unused = Object.keys(dictionary.entries).filter(id => !labels.has(baseKey(id)))
assert.deepEqual(unused, [], 'no dictionary entry outlives its label')
assert.ok(labels.size >= 340, 'the corpus scan reached the Reader documents')

// Lookup: the most specific story scope wins; identities and masked plates are never touched.
assert.deepEqual(speakerLabelCandidates('監督', '1_1_005_01'), ['監督@1_1_005_01', '監督@1_1_005', '監督@1_1', '監督@1', '監督'])
assert.equal(speakerLabelKey({ kind: 'unknown', sourceName: '？？？' }), '')
assert.equal(speakerLabelKey({ kind: 'producer', sourceName: 'プロデューサー' }), '')
assert.equal(speakerLabelKey({ kind: 'named', sourceName: '渡辺 みのり' }), '', 'entity names stay with the entity catalogue')
assert.equal(speakerLabelKey({ kind: 'named', sourceName: '圭（テレビの音声）' }), '圭(テレビの音声)')

const fixture = catalogId => {
  const compiledData = ref({ text_catalog_id: catalogId, steps: [{ dialogue: { speaker_identity: { kind: 'named', source_name: '監督' } } }] })
  const preferences = ref({ story_content_mode: 'translation' })
  const scope = effectScope()
  const localization = scope.run(() => createStoryLocalization({ compiledData, storyPreferences: preferences,
    repository: { async loadScenario() { return { entries: {} } }, getDiagnostics() { return null } },
    entityRepository: { async loadEntity() { return dictionary }, getDiagnostics() { return null },
      getEntry({ entityType, entityId }) { return entityType === 'speaker' ? dictionary.entries[entityId] || null : null } },
  }))
  return { localization, preferences, compiledData, stop: () => scope.stop() }
}
assert.ok(Object.keys(collectScenarioEntitySourceNames({ text_catalog_id: '1_1_005_01',
  steps: [{ dialogue: { speaker_identity: { kind: 'named', source_name: '監督' } } }] }).get('speaker')).includes('監督@1_1_005'),
'a story registers its scoped candidates so the repository can serve them')
const coach = fixture('1_1_005_01')
await new Promise(resolve => setTimeout(resolve, 0))
const director = { kind: 'named', sourceName: '監督' }
assert.equal(coach.localization.resolveUnit({ source: '来てくれたか。', speaker: director }).speaker.display, '教练')
assert.equal(coach.localization.resolveDialogue({ text: '来てくれたか。', speaker: '監督', speaker_identity: director, speaker_source_text: '監督',
  speaker_text_ref: { unit_id: 'untranslated-label', source_hash: 'missing' } }).speaker, '教练', 'an untranslated label unit keeps the dictionary name')
coach.preferences.value.story_content_mode = 'original'
assert.equal(coach.localization.resolveUnit({ speaker: director }).speaker.display, '監督', 'the original keeps the source plate')
coach.stop()
const film = fixture('1_3_10003_01')
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(film.localization.resolveUnit({ speaker: director }).speaker.display, '导演')
assert.equal(film.localization.resolveUnit({ speaker: { kind: 'unknown', sourceName: '？？？' } }).speaker.display, '？？？')
film.stop()
console.log(`Speaker label dictionary: ${Object.keys(dictionary.entries).length} entries cover ${labels.size - UNTRANSLATED.size} entity-less nameplates; scoped and masked plates verified`)
