import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse)

const [semantic, storyMaster] = await Promise.all([
  readJson('public/data/masterdata/birthday_story_semantic_index.json'),
  readJson('public/data/masterdata/story_master_index.json'),
])

assert.equal(semantic.schema_version, 1)
assert.deepEqual(semantic.meta, {
  chapter_count: 4,
  section_count: 181,
  episode_count: 181,
  announcement_count: 78,
  missing_section_ids: [],
  missing_chapter_ids: [],
  missing_character_ids: [],
  unassigned_episode_ids: [51110001, 52110002],
})
assert.deepEqual(
  semantic.chapters.map(chapter => [chapter.id, chapter.series_number, chapter.target]),
  [
    [511, 1, 'producer'],
    [512, 1, 'idol'],
    [521, 2, 'producer'],
    [522, 2, 'idol'],
  ],
)

const episodes = Object.values(semantic.by_episode_id)
const announcementsById = new Map(semantic.announcements.map(item => [item.id, item]))
const announcementDates = episode => episode.announcement_ids
  .map(id => announcementsById.get(id))
  .map(item => [item.month, item.day].join('-'))
assert.equal(episodes.length, 181)
assert.ok(episodes.every(episode => episode.sources.chapter.table === 76))
assert.ok(episodes.every(episode => episode.sources.section.table === 77))
assert.ok(episodes.every(episode => episode.sources.episode.table === 78))
assert.ok(episodes.every(episode => episode.sources.character.table === 80))
assert.equal(episodes.filter(episode => Number.isInteger(episode.subject_numeric_id)).length, 179)
assert.deepEqual(
  episodes.filter(episode => !Number.isInteger(episode.subject_numeric_id)).map(episode => episode.episode_id),
  [51110001, 52110002],
)

const touma = semantic.by_episode_id['5110101']
assert.equal(touma.subject_numeric_id, 1)
assert.equal(touma.chapter_title, 'プロデューサーバースデー1年目')
assert.equal(touma.section_title, 'プロデューサー誕生日 1年目 天ヶ瀬冬馬')
assert.deepEqual([...new Set(announcementDates(touma))], ['3-3'])

const kirio = semantic.by_episode_id['5221702']
assert.equal(kirio.subject_numeric_id, 17)
assert.equal(kirio.target, 'idol')
assert.equal(kirio.series_number, 2)
assert.deepEqual([...new Set(announcementDates(kirio))], ['11-12'])

const commonEntries = [
  semantic.by_episode_id['51110001'],
  semantic.by_episode_id['52110002'],
]
assert.ok(commonEntries.every(entry => entry.subject_numeric_id == null))
assert.deepEqual(commonEntries.map(entry => entry.section_id), [511100, 521100])
assert.deepEqual(
  storyMaster.birthday.filter(row => [51110001, 52110002].includes(row['1'])).map(row => row.resource_id),
  ['1_8_101_00_a', '1_8_101_00_b'],
)

assert.equal(semantic.announcements.length, 78)
assert.ok(semantic.announcements.every(item => item._source.table === 86))
assert.ok(semantic.announcements.every(item => item.month >= 1 && item.month <= 12))
assert.ok(semantic.announcements.every(item => item.day >= 1 && item.day <= 31))

console.log('Birthday story semantics: 4 chapters / 181 episodes / 179 assigned subjects / 2 explicit common entries / 78 announcements verified')
