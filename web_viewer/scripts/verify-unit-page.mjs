import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCardMap, buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { buildUnitCatalog, resolveArchiveUnit, storiesForUnit, songsForUnit } from '../src/data/unitPage.js'
import { legacyUnitPage } from '../fixtures/unit-page/legacy-unit-page-v0.mjs'

const read = path => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8'))
const data = {
  dictionary: read('masterdata/idol_unit_dictionary.json'),
  manifest: read('archive_manifest.json'),
  cardMap: buildCardMap(read('masterdata/card_index.json')),
  stories: buildStoryCatalog(read('masterdata/story_catalog.json')),
  songs: read('song_catalog.json'),
}
const before = JSON.stringify([data, [...data.cardMap]])
const entries = buildUnitCatalog(data.dictionary, data)
const ids = [...data.dictionary.units.flatMap(unit => [String(unit.unit_id), unit.unit_code]), '', 'missing']
for (const id of ids) {
  const unit = resolveArchiveUnit(data.dictionary, id)
  const entry = entries.find(entry => String(entry.unit.unit_id) === String(unit?.unit_id || '')) || null
  assert.deepEqual({ entries, unit, entry, members: entry?.members || [],
    stories: storiesForUnit(unit, data.stories), songs: songsForUnit(unit, data.songs),
  }, legacyUnitPage(id, data), id)
}
assert.equal(JSON.stringify([data, [...data.cardMap]]), before)
assert.deepEqual(buildUnitCatalog(null), [])
assert.equal(resolveArchiveUnit(null, '1'), null)
assert.deepEqual(storiesForUnit(null), [])
assert.deepEqual(songsForUnit(null), [])

const unit = { unit_id: 7, unit_code: 'fixture' }
const dictionary = { units: [unit], by_idol_code: { b: { idol_id: 2 }, a: { idol_id: 1 }, absent: { idol_id: 3, unit_id: 7 } } }
const manifest = { unit_membership_by_idol: { b: { unit_id: '7' }, a: { unit_id: 7 }, other: { unit_id: 8 } } }
const stories = [
  { domain: 'unit_story', unitId: '7', resourceId: 'z' },
  { domain: 'unit_story', unitId: '7', resourceId: 'a' },
  { domain: 'main', unitId: '7', resourceId: 'm' },
]
const fixture = buildUnitCatalog(dictionary, { manifest, stories })[0]
assert.deepEqual(fixture.members.map(member => member.idol_code), ['a', 'b'])
assert.equal(fixture.storyCount, 2)
assert.deepEqual(fixture.eventRelations, { team_events: [], attribute_event_appearances: [], mixed_unit_appearances: [] })
assert.deepEqual(storiesForUnit(unit, stories).map(entry => entry.resourceId), ['a', 'z'])
assert.equal(stories[0].resourceId, 'z')
const songs = { songs: {
  b: { song_id: 20, performance_mapping: { confirmed_unit: { unit_id: 7 } } },
  a: { song_id: 2, performance_mapping: { confirmed_unit: { unit_id: 7 } } },
  unconfirmed: { song_id: 1, unit_id: 7 },
  wrongType: { song_id: 3, performance_mapping: { confirmed_unit: { unit_id: '7' } } },
} }
assert.deepEqual(songsForUnit(unit, songs).map(song => song.song_id), [2, 20])
assert.equal(resolveArchiveUnit(dictionary, '7'), unit)
assert.equal(resolveArchiveUnit(dictionary, 'fixture'), unit)
console.log(`Unit page: ${entries.length} units / ${ids.length} identity cases match frozen App; membership, evidence, order and input isolation passed`)
