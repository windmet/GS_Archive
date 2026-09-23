import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog as legacy } from '../fixtures/story-catalog/legacy-catalog-v0.mjs'
import { buildStoryCatalog, validateStoryCatalog } from '../src/data/storyCatalog.js'
import { buildScenarioMetaByFile as legacyMetadata } from '../fixtures/story-catalog/legacy-file-metadata-v0.mjs'
import { buildScenarioMetaByFile, missingExtraFileEntries } from '../src/data/storyFileMetadata.js'
import { buildStoryCollections as legacyCollections } from '../fixtures/story-catalog/legacy-collections-v0.mjs'
import { buildStoryCollections } from '../src/data/storyCollections.js'
import { buildExtraStoryDomainIdentity } from '../src/data/storyDomainIdentityIndex.js'
import { buildEventStoryEpisodes } from '../src/data/eventStoryEpisodes.js'
import { buildEventStoryEpisodes as legacyEventEpisodes } from '../fixtures/story-catalog/legacy-event-episodes-v0.mjs'
import { buildMainStoryDomainIdentity as legacyMainIdentity } from '../fixtures/story-catalog/legacy-main-identity-v0.mjs'
import { buildMainStoryDomainIdentity } from '../src/data/storyDomainIdentityIndex.js'
import { reactive } from 'vue'
import { buildExtraStoryDomainIdentity as legacyExtraIdentity } from '../fixtures/story-catalog/legacy-domain-identity-v0.mjs'
import { buildBirthdayStoryDomainIdentity as legacyBirthdayIdentity } from '../fixtures/story-catalog/legacy-domain-identity-v0.mjs'
import { buildBirthdayStoryDomainIdentity } from '../src/data/storyDomainIdentityIndex.js'

function verifyCollections(master, artifact, catalog) {
  const options = { extraDomain: buildExtraStoryDomainIdentity(artifact) }
  assert.deepEqual(options.extraDomain, legacyExtraIdentity(master))
  assert.deepEqual(buildExtraStoryDomainIdentity(reactive(artifact)), legacyExtraIdentity(master))
  assert.throws(() => buildStoryCollections(master, catalog, options), /named catalog structure/)
  assert.deepEqual(buildStoryCollections(artifact, catalog, options), legacyCollections(master, catalog, options),
    'collection order, relationships, presentation fallback, episode boundaries and counts must remain identical')
}

function verifyFileMetadata(master, catalog) {
  const expected = [...legacyMetadata(master)].map(([key, { rows, ...entry }]) => {
    if (entry.summary) entry.summary = Object.fromEntries(['voice_count', 'lip_count', 'step_count']
      .filter(name => name in entry.summary).map(name => [name, entry.summary[name]]))
    return [key, entry]
  })
  // An absent file is serialized by omission, while the legacy object has undefined.
  const actual = [...buildScenarioMetaByFile(catalog)].map(([key, entry]) => [key, { file: undefined, ...entry }])
  assert.deepEqual(actual, expected, 'file metadata titles, summaries, order and missing identity parity')
  const missing = (master.extra?.episodes || []).filter(row => row.compiled_exists === false).map(row => {
    const resourceId = row.resource_id || row['5']
    const title = row['3'] || resourceId
    return { file: null, title, subtitle: `${resourceId} · missing compiled`, resourceId, missing: true, searchText: `${title} ${resourceId}` }
  })
  assert.deepEqual(missingExtraFileEntries(catalog), missing)
}

const masterPath = fileURLToPath(new URL('../public/data/masterdata/story_master_index.json', import.meta.url))
const pipeline = fileURLToPath(new URL('../../data_pipeline/story_catalog.py', import.meta.url))
const read = name => JSON.parse(readFileSync(new URL(`../public/data/masterdata/${name}.json`, import.meta.url), 'utf8'))
const master = read('story_master_index'), presentation = read('story_presentation_index')
const generated = JSON.parse(execFileSync('python', [pipeline, '--input', masterPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }))
const artifact = read('story_catalog')
assert.deepEqual(artifact, generated, 'committed catalog must match the production pipeline')
verifyFileMetadata(master, generated)
assert.deepEqual(buildMainStoryDomainIdentity(generated), legacyMainIdentity(master))
assert.deepEqual(buildMainStoryDomainIdentity(reactive(generated)), legacyMainIdentity(master))
assert.deepEqual(buildBirthdayStoryDomainIdentity(reactive(generated)), legacyBirthdayIdentity(master))
for (const overlay of [null, presentation]) {
  const expected = legacy(master, overlay)
  const actual = buildStoryCatalog(generated, overlay)
  verifyCollections(master, generated, actual)
  assert.equal(actual.length, expected.length)
  for (const [index, entry] of expected.entries()) {
    assert.deepEqual(actual[index], entry, `catalog property/order parity: ${entry.id}`)
  }
}
assert.throws(() => validateStoryCatalog(master), /named v1/)
for (const mutate of [
  value => { value.schema_version = 2 },
  value => { value.entries.push(value.entries[0]) },
  value => { value.entries[0].file = null },
  value => { value.entries[0].resourceIds = 'invalid' },
  value => { delete value.fileMetadata },
  value => { value.fileMetadata.entries.push(value.fileMetadata.entries[0]) },
  value => { value.fileMetadata.entries[0].titles = 1 },
  value => { value.fileMetadata.entries[0].key = 'wrong-file.json' },
  value => { value.fileMetadata.entries[0].summary = { step_count: -1 } },
  value => { value.fileMetadata.missingExtra = [{ resourceId: null, title: 'bad' }] },
  value => { delete value.collectionStructure },
  value => { value.collectionStructure[0].chapters[0].episodes[0].part = 'bad-part' },
  value => { value.collectionStructure[0].chapters[0].releaseAt = 'bad-date' },
  value => { delete value.eventEpisodeStructure },
  value => { value.eventEpisodeStructure.push(value.eventEpisodeStructure[0]) },
  value => { value.eventEpisodeStructure[0].episodes[0].resourceId = null },
  value => { delete value.mainIdentity },
  value => { value.mainIdentity.meta.logicalEntryCount++ },
  value => { value.mainIdentity.logicalEntries[0].source = null },
  value => { value.mainIdentity.collections[0].isPlaceholder = true },
  value => { value.mainIdentity.collections[0].chapterIds[0] = 'unknown-chapter' },
  value => { value.mainIdentity.collections[0].chapters[0].logicalEntryIds[0] = 'unknown-entry' },
  value => { delete value.extraIdentity },
  value => { value.extraIdentity.groups[0].source = null },
  value => { value.extraIdentity.logicalEntries[0].seriesId = 1 },
  value => { delete value.birthdayIdentity },
  value => { value.birthdayIdentity.logicalEntries[0].domainMemberships = ['unknown'] },
  value => { value.birthdayIdentity.logicalEntries[0].birthdaySemantics = [] },
]) {
  const bad = structuredClone(generated); mutate(bad)
  assert.throws(() => validateStoryCatalog(bad))
}
console.log(`Story catalog: ${artifact.entries.length} entries, all-property parity with and without presentation; source digest and invalid contracts verified`)

const fixturePath = fileURLToPath(new URL('../fixtures/story-catalog/edge-cases.json', import.meta.url))
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const edge = JSON.parse(execFileSync('python', [pipeline, '--input', fixturePath], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }))
const overlay = { by_file: { 'shared.json': { preplay_synopsis: { title: 'Overlay', text: 'Search overlay' }, playable_step_count: 0, playable_start_index: 3 } } }
const edgeActual = buildStoryCatalog(edge, overlay)
verifyFileMetadata(fixture, edge)
assert.deepEqual(buildMainStoryDomainIdentity(edge), legacyMainIdentity(fixture))
assert.deepEqual(buildBirthdayStoryDomainIdentity(edge), legacyBirthdayIdentity(fixture))
const birthdayIdols = { by_numeric_id: { '1': { idol_code: '001tom', display_name: 'Fixture idol' } } }
const birthdayOverride = { by_episode_id: { '77': { subject_numeric_id: null, announcement_ids: [9] } }, announcements: [{ id: 9, text: 'Fixture announcement' }] }
for (const semantic of [null, birthdayOverride]) {
  assert.deepEqual(buildBirthdayStoryDomainIdentity(reactive(edge), birthdayIdols, null, semantic),
    legacyBirthdayIdentity(fixture, birthdayIdols, null, semantic))
}
assert.equal(buildBirthdayStoryDomainIdentity(edge, birthdayIdols).logicalEntries[0].subject.kind, 'idol')
assert.deepEqual(buildBirthdayStoryDomainIdentity(edge, birthdayIdols).logicalEntries[0].announcements, [])
const birthdayOverridden = buildBirthdayStoryDomainIdentity(edge, birthdayIdols, null, birthdayOverride)
assert.equal(birthdayOverridden.logicalEntries[0].subject.kind, 'shared')
assert.equal(birthdayOverridden.logicalEntries[0].announcements.length, 1)
assert.throws(() => buildBirthdayStoryDomainIdentity(fixture), /named catalog/)
const mainCopy = buildMainStoryDomainIdentity(edge)
mainCopy.collections[0].chapters.length = 0
assert.deepEqual(buildMainStoryDomainIdentity(edge), legacyMainIdentity(fixture), 'consumer mutation must not change the cached catalog')
verifyCollections(fixture, edge, edgeActual)
assert.deepEqual(edgeActual, legacy(fixture, overlay))
assert.equal(edgeActual.find(entry => entry.file === 'shared.json').exists, false)
assert.ok(edgeActual.some(entry => entry.id === 'missing:main:missing'))
console.log('Story catalog edge cases: duplicates, cross-domain aliases, missing parents/files, late summaries, numeric titles and resource-like dates passed')
console.log(`File metadata: ${generated.fileMetadata.entries.length} files and ${generated.fileMetadata.missingExtra.length} missing-extra rows match the legacy consumer`)
console.log(`Collection structure: ${generated.collectionStructure.length} main/unit collections match legacy with and without presentation`)
console.log('Main identity: full corpus and edge parity, source evidence, placeholders, reactive input and copy isolation passed')
const extraCopy = buildExtraStoryDomainIdentity(edge)
extraCopy.logicalEntries[0].source.table = -1
assert.deepEqual(buildExtraStoryDomainIdentity(edge), legacyExtraIdentity(fixture))
assert.throws(() => buildExtraStoryDomainIdentity(fixture), /named catalog/)
console.log('Extra identity: corpus, shared files, orphan rows, sources, reactive input and copy isolation passed')

const eventFixture = { event_group_id: '8', event_id: 'fixture-event' }
const eventStory = {
  file: 'shared-event.json', playableStartIndex: 3,
  episodes: [
    { episode_part: 'B', start_step_index: 0, end_step_index: 5, step_count: 6, voice_count: 2 },
    { episode_part: 'a', episode_file: 'episodes/event_a.json', local_playable_start_index: 2, step_count: 9 },
  ],
}
for (const story of [eventStory, { ...eventStory, episodes: [] }]) {
  assert.deepEqual(buildEventStoryEpisodes(eventFixture, story, edge), legacyEventEpisodes(eventFixture, story, fixture))
}
const fixtureEpisodes = buildEventStoryEpisodes(eventFixture, eventStory, edge)
assert.equal(fixtureEpisodes[0].id, 'fixture-event-0')
assert.equal(fixtureEpisodes[0].label, 'プロローグ')
assert.equal(fixtureEpisodes[0].startStep, 4)
assert.equal(fixtureEpisodes[0].endStep, 6)
assert.equal(fixtureEpisodes[1].file, 'episodes/event_a.json')
assert.equal(fixtureEpisodes[1].startStep, 3)
assert.equal(fixtureEpisodes[1].endStep, 9)
assert.equal(fixtureEpisodes[2].endStep, 0)
assert.deepEqual(buildEventStoryEpisodes({ event_group_id: 'absent' }, eventStory, edge), [])
assert.deepEqual(buildEventStoryEpisodes(null, eventStory, null), [])
assert.throws(() => buildEventStoryEpisodes(eventFixture, eventStory, fixture), /named catalog structure/)
console.log('Event projection: local/shared boundaries, absent boundary/group, default labels and IDs preserve legacy behavior')
