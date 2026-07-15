import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { buildEventStoryEpisodes } from '../src/data/eventStoryEpisodes.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)
const [master, presentation, manifest] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
  readJson('public/data/archive_manifest.json'),
])

const catalogByFile = new Map(buildStoryCatalog(master, presentation).map(story => [story.file, story]))
const events = manifest.unit_event_relations || []
let episodeCount = 0

assert.equal(events.length, 36)
for (const event of events) {
  const story = catalogByFile.get(event.file)
  assert.ok(story, `${event.event_id} is missing its compiled story`)
  const episodes = buildEventStoryEpisodes(event, story, master)
  assert.ok(episodes.length > 0, `${event.event_id} has no episode navigation`)
  assert.equal(episodes.length, story.episodes.length, `${event.event_id} has mismatched episode boundaries`)
  assert.ok(episodes.every(episode => episode.startStep > 0), `${event.event_id} has an invalid start step`)
  assert.ok(episodes.every(episode => episode.endStep >= episode.startStep), `${event.event_id} has an invalid end step`)
  episodeCount += episodes.length
}

const notAloneEvent = events.find(event => String(event.event_id) === '410001')
const notAloneStory = catalogByFile.get(notAloneEvent.file)
const notAloneEpisodes = buildEventStoryEpisodes(notAloneEvent, notAloneStory, master)
assert.equal(notAloneEpisodes.length, 11)
assert.deepEqual(notAloneEpisodes.map(episode => episode.part), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'])
assert.equal(notAloneEpisodes[0].startStep, 2)
assert.equal(notAloneEpisodes[5].startStep, 125)

console.log(`Event story navigation: ${events.length} events, ${episodeCount} episodes verified`)
