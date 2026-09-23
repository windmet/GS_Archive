import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { buildEventStoryEpisodes } from '../src/data/eventStoryEpisodes.js'
import { buildEventStoryEpisodes as legacy } from '../fixtures/story-catalog/legacy-event-episodes-v0.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)
const [master, presentation, manifest] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
  readJson('public/data/archive_manifest.json'),
])

const catalogData = await readJson('public/data/masterdata/story_catalog.json')
const catalogByFile = new Map(buildStoryCatalog(catalogData, presentation).map(story => [story.file, story]))
const events = manifest.unit_event_relations || []
let episodeCount = 0
const reading = (await readJson('public/data/reading/manifest.json')).entries
const readingByFile = new Map(reading.map(entry => [entry.source_file, entry]))
const reachableReading = new Set()

assert.equal(events.length, 36)
for (const event of events) {
  const story = catalogByFile.get(event.file)
  assert.ok(story, `${event.event_id} is missing its compiled story`)
  const episodes = buildEventStoryEpisodes(event, story, catalogData)
  assert.deepEqual(episodes, legacy(event, story, master), `${event.event_id} event output parity`)
  assert.deepEqual(buildEventStoryEpisodes(event, { ...story, episodes: [] }, catalogData),
    legacy(event, { ...story, episodes: [] }, master), `${event.event_id} missing presentation parity`)
  assert.ok(episodes.length > 0, `${event.event_id} has no episode navigation`)
  assert.equal(episodes.length, story.episodes.length, `${event.event_id} has mismatched episode boundaries`)
  assert.ok(episodes.every(episode => episode.startStep > 0), `${event.event_id} has an invalid start step`)
  assert.ok(episodes.every(episode => episode.endStep >= episode.startStep), `${event.event_id} has an invalid end step`)
  assert.ok(episodes.every(episode => episode.file), `${event.event_id} has an episode without a file`)
  episodeCount += episodes.length
  for (const episode of episodes) {
    const entry = readingByFile.get(episode.file)
    assert.ok(entry, `event reading source ${episode.file}`)
    assert.equal(entry.parent_file, event.file, `event reading parent ${episode.file}`)
    if (entry.status === 'ready') reachableReading.add(entry.document_id)
  }
}
assert.deepEqual(reachableReading, new Set(reading.filter(entry => entry.domain === 'event' && entry.status === 'ready').map(entry => entry.document_id)))

const notAloneEvent = events.find(event => String(event.event_id) === '410001')
const notAloneStory = catalogByFile.get(notAloneEvent.file)
const notAloneEpisodes = buildEventStoryEpisodes(notAloneEvent, notAloneStory, catalogData)
assert.equal(notAloneEpisodes.length, 11)
assert.deepEqual(notAloneEpisodes.map(episode => episode.part), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'])
assert.equal(notAloneEpisodes[0].startStep, 2)
assert.equal(notAloneEpisodes[0].file, 'episodes/1_3_10001_01_a.json')
assert.equal(notAloneEpisodes[5].startStep, 1)
assert.equal(notAloneEpisodes[5].file, 'episodes/1_3_10001_01_f.json')

console.log(`Event story navigation: ${events.length} events, ${episodeCount} episodes verified`)
