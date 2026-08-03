import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { buildStoryCollections } from '../src/data/storyCollections.js'
import { buildBirthdayStoryDomainIdentity, buildExtraStoryDomainIdentity } from '../src/data/storyDomainIdentityIndex.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)
const [master, birthdaySemantic, presentation, idolEpisodes, idols, speakers] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/birthday_story_semantic_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
  readJson('public/data/masterdata/idol_episode_index.json'),
  readJson('public/data/masterdata/idol_unit_dictionary.json'),
  readJson('public/data/masterdata/speaker_dictionary.json'),
])

const catalog = buildStoryCatalog(master, presentation)
const extraDomain = buildExtraStoryDomainIdentity(master)
const birthdayDomain = buildBirthdayStoryDomainIdentity(master, idols, speakers, birthdaySemantic)
const collections = buildStoryCollections(master, catalog, { extraDomain, birthdayDomain, idolEpisodes })
const mainCollections = collections.filter(collection => collection.domain === 'main')
const unitCollections = collections.filter(collection => collection.domain === 'unit_story')
const extraCollections = collections.filter(collection => collection.domain === 'extra')

assert.equal(mainCollections.length, 3)
assert.equal(unitCollections.length, 16)
assert.equal(extraCollections.length, 10)
assert.equal(mainCollections.reduce((sum, collection) => sum + collection.chapterCount, 0), 22)
assert.equal(unitCollections.reduce((sum, collection) => sum + collection.chapterCount, 0), 64)
assert.equal(mainCollections.reduce((sum, collection) => sum + collection.episodeCount, 0), 204)
assert.equal(unitCollections.reduce((sum, collection) => sum + collection.episodeCount, 0), 540)

for (const collection of [...mainCollections, ...unitCollections]) {
  for (const chapter of collection.chapters) {
    if (!chapter.exists) {
      assert.equal(chapter.playableEpisodeCount, 0, `${chapter.id} exposes unavailable episode playback`)
      continue
    }
    assert.ok(chapter.file, `${chapter.id} is playable without a compiled file`)
    assert.equal(chapter.episodeCount, chapter.story.episodes.length, `${chapter.id} has mismatched episode boundaries`)
    assert.ok(chapter.episodes.every(episode => episode.startStep > 0), `${chapter.id} has an invalid start step`)
    assert.ok(chapter.episodes.every(episode => episode.endStep >= episode.startStep), `${chapter.id} has an invalid end step`)
    assert.ok(chapter.episodes.every(episode => episode.file), `${chapter.id} has an episode without a file`)
  }
}

assert.equal(extraCollections.reduce((sum, collection) => sum + collection.chapterCount, 0), 47)
assert.equal(extraCollections.reduce((sum, collection) => sum + collection.playableEpisodeCount, 0), 47)
assert.ok(extraCollections.every(collection => collection.chapters.every(chapter =>
  chapter.file && chapter.episodes.length === 1 && chapter.episodes[0].file)))

const aprilFools2022 = extraCollections.find(collection => collection.sectionId === '602')
assert.deepEqual(aprilFools2022.legacySectionIds, ['60201', '60202'])
assert.equal(aprilFools2022.chapters[0].episodes[0].resourceId, '5_03_000_22_a')
assert.equal(aprilFools2022.chapters[0].episodes[0].file, 'episodes/5_03_000_22_a.json')
assert.equal(aprilFools2022.chapters[1].episodes[0].resourceId, '5_03_000_22_b')
assert.equal(aprilFools2022.chapters[1].episodes[0].file, 'episodes/5_03_000_22_b.json')

const newYear2023 = extraCollections.find(collection => collection.sectionId === '608')
assert.equal(newYear2023.title, '謹賀新年2023')
assert.equal(newYear2023.chapterCount, 17)
assert.equal(newYear2023.chapters[0].title, '初日の出を拝んで')

const mainChapterOne = mainCollections.find(collection => collection.sectionId === '101')
const mainPrologue = mainChapterOne.chapters.find(chapter => chapter.id === '10100')
const mainEpisodeOne = mainChapterOne.chapters.find(chapter => chapter.id === '10101')
assert.equal(mainPrologue.file, '1_4_001_00.json')
assert.equal(mainPrologue.episodes.length, 2)
assert.equal(mainPrologue.episodes[0].startStep, 2)
assert.equal(mainPrologue.episodes[0].endStep, 27)
assert.equal(mainPrologue.episodes[0].file, 'episodes/1_4_001_00_a.json')
assert.equal(mainPrologue.episodes[1].startStep, 1)
assert.equal(mainPrologue.episodes[1].endStep, 33)
assert.equal(mainPrologue.episodes[1].file, 'episodes/1_4_001_00_b.json')
assert.equal(mainEpisodeOne.file, '1_4_001_01.json')
assert.equal(mainEpisodeOne.episodes.length, 10)
assert.equal(mainEpisodeOne.episodes[0].startStep, 2)
assert.equal(mainEpisodeOne.episodes[0].file, 'episodes/1_4_001_01_a.json')

const jupiter = unitCollections.find(collection => collection.sectionId === '1')
assert.equal(jupiter.title, 'Jupiter')
assert.equal(jupiter.chapters.length, 4)
assert.equal(jupiter.chapters[0].episodes.length, 10)

const kirioBirthday = collections.find(collection =>
  collection.domain === 'birthday' && collection.sectionId === '017kir')
assert.equal(kirioBirthday.chapterCount, 4)
assert.equal(kirioBirthday.independentChapterCount, 3)
assert.equal(kirioBirthday.sharedChapterCount, 1)
const kirioShared = kirioBirthday.chapters.find(chapter => chapter.canonicalRelation)
assert.equal(kirioShared.file, '1_x_017kir_2_1_2_017_12.json')
assert.equal(kirioShared.canonicalRelation.sectionId, 21702)
assert.deepEqual(kirioShared.canonicalRelation.episodeNames, ['スモールトーク1', 'スモールトーク2', 'スモールトーク3'])

console.log('Story collections: main 3, unit 16, extra 10 works/47 chapters; birthday canonical relations and shared playback boundaries verified')
