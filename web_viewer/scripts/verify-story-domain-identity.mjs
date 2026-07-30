import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryDomainIdentityIndex } from '../src/data/storyDomainIdentityIndex.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)
const [storyMaster, idolUnit, speakerDictionary] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/idol_unit_dictionary.json'),
  readJson('public/data/masterdata/speaker_dictionary.json'),
])

const index = buildStoryDomainIdentityIndex({
  storyMaster,
  idolUnit,
  speakerDictionary,
})

assert.equal(index.schemaVersion, 1)
assert.deepEqual(index.authority, {
  semanticIdentity: 'story_master_index',
  idolIdentity: 'idol_unit_dictionary',
  npcIdentity: 'speaker_dictionary',
  playbackTarget: 'compiled_file',
})

const main = index.domains.main
assert.equal(main.meta.collectionCount, 3)
assert.equal(main.meta.placeholderCollectionCount, 1)
assert.equal(main.meta.chapterCount, 22)
assert.equal(main.meta.logicalEntryCount, 204)
assert.equal(main.meta.resourceIdCount, 204)
assert.equal(main.meta.compiledFileCount, 22)
assert.ok(main.logicalEntries.every(entry => entry.source.table === 6))
assert.ok(main.logicalEntries.every(entry => entry.compiledExists))
assert.ok(main.collections.every(collection => collection.source.table === 4))
assert.ok(main.collections.flatMap(collection => collection.chapters)
  .every(chapter => chapter.source.table === 5))
assert.equal(main.collections.find(collection => collection.masterId === '101').chapterCount, 11)
assert.equal(main.collections.find(collection => collection.masterId === '102').chapterCount, 11)
assert.equal(main.collections.find(collection => collection.masterId === '103').isPlaceholder, true)

const birthday = index.domains.birthday
assert.equal(birthday.meta.collectionCount, 50)
assert.equal(birthday.meta.logicalEntryCount, 181)
assert.equal(birthday.meta.resolvedIdolEntryCount, 176)
assert.equal(birthday.meta.resolvedNpcEntryCount, 5)
assert.equal(birthday.meta.unresolvedEntryCount, 0)
assert.equal(birthday.meta.seriesCount, 4)
assert.equal(birthday.meta.resourceIdCount, 181)
assert.equal(birthday.meta.compiledFileCount, 181)
assert.equal(birthday.meta.crossDomainSharedFileCount, 29)
assert.ok(birthday.logicalEntries.every(entry => entry.source.table === 78))
assert.ok(birthday.logicalEntries.every(entry => entry.compiledExists))
assert.deepEqual(
  [...new Set(birthday.logicalEntries.map(entry => entry.series.id))].sort(),
  [
    'birthday-series:511:1_8',
    'birthday-series:512:1_7',
    'birthday-series:521:1_8',
    'birthday-series:522:1_2',
  ],
)

const toumaBirthday = birthday.collections.find(collection => collection.subject.code === '001tom')
assert.equal(toumaBirthday.subject.displayName, '天ヶ瀬 冬馬')
assert.equal(toumaBirthday.subject.resolution, 'master_resource_id+idol_dictionary')
assert.equal(toumaBirthday.logicalEntryCount, 4)
const kenBirthday = birthday.collections.find(collection => collection.subject.code === '101ken')
assert.equal(kenBirthday.subject.kind, 'npc')
assert.equal(kenBirthday.subject.displayName, '山村 賢')
assert.equal(kenBirthday.subject.resolution, 'master_resource_id+speaker_dictionary')
assert.equal(kenBirthday.logicalEntryCount, 5)

const sharedBirthdayFiles = birthday.logicalEntries
  .filter(entry => entry.domainMemberships.includes('idol_story'))
assert.equal(sharedBirthdayFiles.length, 29)
assert.ok(sharedBirthdayFiles.every(entry => entry.domainMemberships.includes('birthday')))

const extra = index.domains.extra
assert.equal(extra.meta.collectionCount, 47)
assert.equal(extra.meta.logicalEntryCount, 47)
assert.equal(extra.meta.resourceIdCount, 45)
assert.equal(extra.meta.compiledFileCount, 44)
assert.equal(extra.meta.sharedPlaybackFileCount, 1)
assert.equal(extra.meta.maxLogicalEntriesPerPlaybackFile, 4)
assert.ok(extra.collections.every(collection => collection.source.table === 144))
assert.ok(extra.logicalEntries.every(entry => entry.source.table === 145))
assert.ok(extra.logicalEntries.every(entry => entry.compiledExists))
assert.ok(extra.collections.every(collection => collection.logicalEntryCount === 1))
assert.ok(extra.logicalEntries.every(entry =>
  extra.collections.some(collection => collection.logicalEntryIds.includes(entry.id))))

const sharedExtraTarget = index.byCompiledFile['5_03_000_22.json']
assert.deepEqual(sharedExtraTarget.domains, ['extra'])
assert.equal(sharedExtraTarget.logicalEntryIds.length, 4)

console.log(
  'Story domain identity: '
  + 'main 3/22/204, birthday 50 collections/181 entries/29 cross-domain files, '
  + 'extra 47 entries/44 playback files verified',
)
