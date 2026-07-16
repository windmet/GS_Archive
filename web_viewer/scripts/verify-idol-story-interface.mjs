import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { buildIdolStoryOptions, buildIdolStoryPage, groupMobileScenarios } from '../src/data/idolCommunicationSelectors.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)
const [episodes, mobile, master, presentation, idols] = await Promise.all([
  readJson('public/data/masterdata/idol_episode_index.json'),
  readJson('public/data/masterdata/mobile_archive_index.json'),
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
  readJson('public/data/masterdata/idol_unit_dictionary.json'),
])

const catalog = buildStoryCatalog(master, presentation)
const options = buildIdolStoryOptions(episodes, idols)
assert.equal(options.length, 49, 'the personal-story selector must expose all 49 idols')

let episodeCount = 0
let playableCount = 0
let communicationCount = 0
for (const option of options) {
  const page = buildIdolStoryPage(episodes, mobile, catalog, idols, option.idolCode)
  assert.ok(page, `${option.idolCode} has no personal-story page`)
  for (const section of page.sections) {
    assert.ok(section.episodes.length > 0, `${option.idolCode} section ${section.id} is empty`)
    for (const episode of section.episodes) {
      episodeCount += 1
      if (episode.exists) playableCount += 1
      assert.ok(episode.exists, `${episode.resource_id} has no playback boundary`)
      assert.ok(episode.file, `${episode.resource_id} has no playback file`)
      assert.ok(episode.startStep > 0, `${episode.resource_id} has an invalid start step`)
      assert.ok(episode.endStep >= episode.startStep, `${episode.resource_id} has an invalid playback range`)
    }
    communicationCount += section.communications.length
  }
}

assert.equal(episodeCount, episodes.meta.episode_count)
assert.equal(playableCount, episodes.meta.compiled_episode_count)

const scenarioById = new Map(mobile.scenarios.map(scenario => [scenario.id, scenario]))
for (const [idolCode, ids] of Object.entries(mobile.by_idol_code)) {
  const scenarios = ids.map(id => scenarioById.get(id)).filter(Boolean)
  for (const kind of ['idol_talk', 'idol_phone']) {
    const source = scenarios.filter(scenario => scenario.kind === kind)
    const groups = groupMobileScenarios(source)
    assert.ok(groups.every(group => group.scenarios.length > 0), `${idolCode} ${kind} produced an empty group`)
    assert.equal(groups.reduce((sum, group) => sum + group.scenarios.length, 0), source.length)
  }
}

console.log(`Idol story interface: ${options.length} idols, ${playableCount}/${episodeCount} playable segments, ${communicationCount} after-story links verified`)
