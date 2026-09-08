import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateArchivePayload } from '../src/data/archiveDataContracts.js'
import { ARCHIVE_SOURCES, CARD_DETAIL_SOURCE, IDOL_COMMUNICATION_SOURCES } from '../src/data/ArchiveDataRepository.js'

const sources = { ...ARCHIVE_SOURCES, cardDetailIndex: CARD_DETAIL_SOURCE, ...IDOL_COMMUNICATION_SOURCES }
const fixtures = Object.fromEntries(Object.entries(sources).map(([key, url]) => [key,
  key === 'compiledIndex' ? { categories: [] } : JSON.parse(readFileSync(new URL(`../public${url}`, import.meta.url), 'utf8')),
]))
for (const [key, fixture] of Object.entries(fixtures)) assert.equal(validateArchivePayload(key, fixture), fixture)

// Smaller coherent archives are valid runtime inputs. Frozen archive coverage
// belongs to the birthday/extra/song domain verifiers, not fetch/cache policy.
const birthday = structuredClone(fixtures.birthdayStorySemantic)
const episode = Object.values(birthday.by_episode_id)[0]
birthday.by_episode_id = { [episode.episode_id]: episode }
birthday.sections = birthday.sections.filter(section => section.id === episode.section_id)
birthday.chapters = birthday.chapters.filter(chapter => chapter.id === episode.chapter_id)
birthday.announcements = birthday.announcements.filter(item => episode.announcement_ids.includes(item.id))
birthday.meta = { ...birthday.meta, chapter_count: 1, section_count: 1, episode_count: 1, announcement_count: birthday.announcements.length }
birthday.meta.unassigned_episode_ids = birthday.meta.unassigned_episode_ids.filter(id => id === episode.episode_id)
assert.equal(validateArchivePayload('birthdayStorySemantic', birthday), birthday)

const extra = structuredClone(fixtures.extraStoryVisualIndex)
extra.entries = extra.entries.slice(0, 1)
extra.by_chapter_id = { [extra.entries[0].chapter_id]: extra.entries[0].extra_story_entry_id }
extra.meta.entry_count = 1
extra.meta.banner_count = extra.meta.key_visual_count = 1
extra.meta.published_bytes = Object.values(extra.entries[0].assets).reduce((sum, asset) => sum + asset.bytes, 0)
assert.equal(validateArchivePayload('extraStoryVisualIndex', extra), extra)

const song = structuredClone(fixtures.songPlaybackAudio)
const [code, track] = Object.entries(song.songs)[0]
song.songs = { [code]: track }
song.summary = { catalog_songs: 1, full_mix_tracks: 1 }
assert.equal(validateArchivePayload('songPlaybackAudio', song), song)

for (const [key, fixture, mutate] of [
  ['birthdayStorySemantic', birthday, data => { data.meta.episode_count++ }],
  ['birthdayStorySemantic', birthday, data => { data.sections = [] }],
  ['birthdayStorySemantic', birthday, data => { Object.values(data.by_episode_id)[0].announcement_ids.push(-1) }],
  ['extraStoryVisualIndex', extra, data => { data.by_chapter_id[extra.entries[0].chapter_id] = 'missing' }],
  ['extraStoryVisualIndex', extra, data => { data.entries.push(data.entries[0]) }],
  ['songPlaybackAudio', song, data => { data.summary.full_mix_tracks++ }],
  ['songPlaybackAudio', song, data => { data.songs[code].song_code = 'other' }],
  ['songPlaybackAudio', song, data => { data.songs[code].url = '' }],
  ['songPlaybackAudio', song, data => { data.status = 'experimental' }],
]) {
  const invalid = structuredClone(fixture); mutate(invalid)
  assert.throws(() => validateArchivePayload(key, invalid), undefined, `${key} must reject inconsistent shape/relations`)
}
for (const value of [null, [], false, 'object']) assert.throws(() => validateArchivePayload('compiledIndex', value))
for (const key of ['gashaIndex', 'eventIndex', 'storyPresentation', 'seasonalCampaign', 'workStory', 'idolEpisode', 'mobileArchive', 'archiveManifest']) {
  for (const version of [undefined, '1', 0.5]) {
    assert.throws(() => validateArchivePayload(key, { ...fixtures[key], schema_version: version }), undefined, `${key} must require a numeric schema version`)
  }
}
console.log(`Archive data contracts: ${Object.keys(fixtures).length} current products, coherent smaller archives and broken counts/relations checked`)
