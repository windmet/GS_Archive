import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)
const [master, presentation] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
])

assert.equal(presentation.schema_version, 2)
assert.equal(presentation.meta.story_file_count, Object.keys(presentation.by_file).length)
assert.equal(presentation.meta.story_file_count, 1394)
assert.equal(presentation.meta.synopsis_count, 900)

const mainPresentation = presentation.by_file['1_4_001_01.json']
assert.equal(mainPresentation.preplay_synopsis.title, '新たなる三つの輝きと共に！')
assert.match(mainPresentation.preplay_synopsis.text, /315プロダクション/)
assert.equal(mainPresentation.playable_start_index, 1)
assert.equal(mainPresentation.playable_step_count, 431)
assert.equal(mainPresentation.title_cards[0].label, '第1話')

const eventPresentation = presentation.by_file['1_3_10001_01.json']
assert.equal(eventPresentation.episodes.length, 11)
assert.deepEqual(eventPresentation.episodes.map(episode => episode.episode_part), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'])
assert.equal(eventPresentation.episodes[0].episode_index, 0)
assert.equal(eventPresentation.episodes[10].episode_index, 10)
assert.equal(eventPresentation.episodes[0].start_step_index, 0)
assert.equal(eventPresentation.episodes[0].end_step_index < eventPresentation.episodes[1].start_step_index, true)

const toumaSmallTalk = presentation.by_file['1_x_001tom_2_1_2_001_12.json']
assert.deepEqual(toumaSmallTalk.episodes.map(episode => episode.episode_part), ['a', 'b', 'c'])
assert.deepEqual(toumaSmallTalk.episodes.map(episode => [episode.start_step_index, episode.end_step_index]), [[2, 7], [8, 13], [14, 19]])

// Birthday small talks must load the authored scene, not inherit a previous
// segment's cast/background from a legacy merged snapshot.
const takeruFile = '1_x_038tak_2_1_2_038_12.json'
const takeru = presentation.by_file[takeruFile]
assert.equal(takeru.preplay_synopsis.title, '誰がための誕生日パーティ')
assert.deepEqual(takeru.episodes.map(e => e.source_scenario_id), ['1_2_038_12_a', '1_2_038_12_b', '1_2_038_12_c'])
const expectedCast = [ ['039mcr', '040ren'], ['038tak', '039mcr'], ['038tak', '040ren'] ]
for (const [index, episode] of takeru.episodes.entries()) {
  const data = await readJson(`public/data/compiled/${episode.episode_file}`)
  const first = data.steps.find(step => step.type === 'adv')
  assert.equal(first.state.bg, 'bg001_315pro_in_51')
  const visible = first.state.spines.filter(spine => spine.visible !== false)
  assert.deepEqual(visible.map(s => s.id).sort(), expectedCast[index])
  assert.deepEqual(visible.map(s => s.pos_x).sort((a, b) => a - b), [-200, 200])
  assert.equal(data.steps.filter(s => s.dialogue?.voice).length, 5)
}
const birthdayCases = await readJson('scripts/fixtures/birthday-entry-scenes.json')
for (const sample of birthdayCases.cases) {
  const entry = presentation.by_file[sample.aggregate].episodes.find(e => e.source_scenario_id === sample.source)
  assert.ok(entry?.episode_file, `${sample.source}: explicit episode required`)
  const data = await readJson(`public/data/compiled/${entry.episode_file}`)
  const state = data.steps.find(s => s.type === 'adv').state
  const cast = state.spines.filter(s => s.visible !== false).map(s => [s.id, s.pos_x || 0, s.pos_y || 0])
    .sort((a, b) => a[0].localeCompare(b[0]))
  assert.deepEqual({ bg: state.bg, cast }, sample.expected, `${sample.source}: RAW entrance differs`)
}

for (const [file, metadata] of Object.entries(presentation.by_file)) {
  assert.ok(metadata.playable_start_index >= 0, `${file} has an invalid playable start`)
  assert.ok(metadata.playable_step_count >= 0, `${file} has an invalid playable count`)
  for (const episode of metadata.episodes || []) {
    assert.ok(episode.start_step_index >= 0, `${file} has an invalid episode start`)
    assert.ok(episode.end_step_index >= episode.start_step_index, `${file} has an invalid episode end`)
    assert.equal(episode.step_count, episode.end_step_index - episode.start_step_index + 1, `${file} has a non-contiguous episode`)
  }
  if (metadata.preplay_synopsis) assert.ok(metadata.playable_start_index > 0, `${file} does not skip its synopsis`)
}

const catalog = buildStoryCatalog(await readJson('public/data/masterdata/story_catalog.json'), presentation)
assert.equal(catalog.length, 1394)
const mainStory = catalog.find(entry => entry.file === '1_4_001_01.json')
assert.equal(mainStory.title, '新たなる三つの輝きと共に！')
assert.equal(mainStory.sectionLabel, '第1章')
assert.equal(mainStory.episodeLabel, '第1話')
assert.equal(mainStory.preplaySynopsis.title, mainStory.title)

console.log(`Story presentation index: 1394 files, 900 pre-play synopses, ${presentation.meta.episode_boundary_count} episode boundaries verified`)
