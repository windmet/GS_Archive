import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { buildStoryCollections } from '../src/data/storyCollections.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)
const [master, presentation] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
])

const catalog = buildStoryCatalog(master, presentation)
const collections = buildStoryCollections(master, catalog)
const mainCollections = collections.filter(collection => collection.domain === 'main')
const unitCollections = collections.filter(collection => collection.domain === 'unit_story')

assert.equal(mainCollections.length, 3)
assert.equal(unitCollections.length, 16)
assert.equal(mainCollections.reduce((sum, collection) => sum + collection.chapterCount, 0), 22)
assert.equal(unitCollections.reduce((sum, collection) => sum + collection.chapterCount, 0), 64)
assert.equal(mainCollections.reduce((sum, collection) => sum + collection.episodeCount, 0), 204)
assert.equal(unitCollections.reduce((sum, collection) => sum + collection.episodeCount, 0), 540)

for (const collection of collections) {
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

console.log(`Story collections: ${collections.length} collections, 86 chapters, 744 episode entries verified`)
