import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { effectScope, ref } from 'vue'
import { IDOL_ID_TO_NAME } from '../src/utils/IdolNameMap.js'
import { speakerDisplayLookup } from '../src/localization/story/SpeakerDisplayNames.js'
import { hashEntitySourceText } from '../src/localization/story/EntityTranslationRepository.js'
import { collectScenarioEntitySourceNames, createStoryLocalization } from '../src/localization/story/StoryLocalizationContext.js'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'

const policy = JSON.parse(await fs.readFile(new URL('../translation/studio/policy/idol-names.v1.json', import.meta.url)))
const idols = JSON.parse(await fs.readFile(new URL('../public/translations/zh-CN/entities/idols.json', import.meta.url)))
const npcs = JSON.parse(await fs.readFile(new URL('../public/translations/zh-CN/entities/npcs.json', import.meta.url)))
assert.equal(Object.keys(idols.entries).length, 49)
for (const entry of policy.entries) {
  assert.equal(entry.source_name, IDOL_ID_TO_NAME[entry.entity_id])
  assert.equal(idols.entries[entry.entity_id].name, entry.name)
  assert.equal(idols.entries[entry.entity_id].source_hash, await hashEntitySourceText(entry.source_name))
  assert.equal(idols.entries[entry.entity_id].status, 'draft')
}
assert.equal(idols.entries['011min'].name, '渡边实')
for (const id of ['101ken', '102sha', '241sub'])
  assert.equal(npcs.entries[id].source_hash, await hashEntitySourceText(IDOL_ID_TO_NAME[id]))
const minori = { kind: 'named', entityId: null, entityType: null, sourceName: '渡辺 みのり' }
const cat = { kind: 'named', sourceName: 'にゃん喜威' }
assert.equal(speakerDisplayLookup(minori).entityId, '011min')
assert.equal(speakerDisplayLookup(cat).entityType, 'npc')
assert.equal(speakerDisplayLookup({ ...cat, kind: 'unknown' }), null)
assert.equal(speakerDisplayLookup({ ...minori, entityId: '009kyj' }), null)
assert.equal(speakerDisplayLookup({ kind: 'named', sourceName: 'みのり' }), null) // No alias inference.
const original = structuredClone(minori)
const compiledData = ref({ scenario_id: 'names-fixture', steps: [minori, cat].map(speaker => ({ dialogue: { speaker_identity: speaker } })) })
const collected = collectScenarioEntitySourceNames(compiledData.value)
assert.deepEqual(collected.get('idol'), { '011min': IDOL_ID_TO_NAME['011min'] })
assert.deepEqual(collected.get('npc'), { '241sub': 'にゃん喜威' })
assert.deepEqual(collectScenarioEntitySourceNames({ steps: [{ dialogue: { speaker: 'にゃん喜威' } }] }).get('npc'),
  { '241sub': 'にゃん喜威' }, 'legacy Player labels must load their entity display catalogue')
const preferences = ref({ story_content_mode: 'translation' })
const scope = effectScope()
const localization = scope.run(() => createStoryLocalization({ compiledData, storyPreferences: preferences,
  repository: { async loadScenario() { return { entries: {} } }, getDiagnostics() { return null } },
  entityRepository: {
    async loadEntity() {}, getDiagnostics() { return null },
    getEntry({ entityType, entityId }) { return (entityType === 'idol' ? idols : npcs).entries[entityId] },
  },
}))
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(localization.resolveUnit({ source: '台詞', speaker: minori }).speaker.display, '渡边实')
assert.equal(localization.resolveUnit({ source: 'にゃー！', speaker: cat }).speaker.display, '喵喜威')
const catDialogue = { text: 'にゃー！', speaker: 'にゃん喜威', speaker_identity: cat,
  speaker_source_text: 'にゃん喜威', speaker_text_ref: { unit_id: 'missing-label', source_hash: 'missing' } }
assert.equal(localization.resolveDialogue(catDialogue).speaker, '喵喜威', 'missing label unit must retain entity display translation')
assert.equal(localization.resolveDialogue({ ...catDialogue, speaker_source_text: '？？？' }).speaker, '？？？', 'explicit masked label must not disclose entity')
const hidden = { ...minori, kind: 'unknown', sourceName: '？？？' }
assert.equal(localization.resolveUnit({ speaker: hidden }).speaker.display, '？？？')
preferences.value.story_content_mode = 'original'
assert.equal(localization.resolveUnit({ speaker: cat }).speaker.display, 'にゃん喜威')
assert.equal(localization.resolveDialogue(catDialogue).speaker, 'にゃん喜威')
assert.deepEqual(minori, original)
assert.equal(localization.resolveUnit({ speaker: minori }).speaker.entityId, null)
scope.stop()
assert.equal(resolveStoryText({ speaker: hidden, speakerLabelNames: () => 'must not reveal',
  preferences: { story_content_mode: 'translation' } }).speaker.display, '？？？')
console.log('49 project name hashes and Reader/Player display labels verified; null/hidden/conflicting identities preserved')
