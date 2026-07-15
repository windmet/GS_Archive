import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const episodePath = path.join(root, 'public/data/masterdata/idol_episode_index.json')
const mobilePath = path.join(root, 'public/data/masterdata/mobile_archive_index.json')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const episodes = readJson(episodePath)
const mobile = readJson(mobilePath)
const scenariosById = new Map(mobile.scenarios.map(entry => [entry.id, entry]))

assert(episodes.schema_version === 1, 'unexpected idol episode schema version')
assert(episodes.meta.chapter_count === 49, 'expected 49 idol episode chapters')
assert(episodes.meta.section_count === 78, 'expected 78 idol episode sections')
assert(episodes.meta.episode_count === 491, 'expected 491 idol episode records')
assert(episodes.meta.compiled_episode_count === 491, 'all idol episode records should resolve to compiled files')

const toumaChapter = episodes.by_idol_code['001tom']?.[0]
assert(toumaChapter, 'Touma idol episode chapter is missing')
assert(toumaChapter.sections.length === 2, 'Touma should have two idol episode sections')
assert(toumaChapter.sections[0].scenario_title === '頼れる大人', 'Touma episode 1 title mismatch')
assert(toumaChapter.sections[0].episodes.length === 5, 'Touma episode 1 should contain five episodes')
assert(toumaChapter.sections[1].scenario_title === '世界にひとつだけのバースデーカレー', 'Touma episode 2 title mismatch')
assert(toumaChapter.sections[1].episodes.length === 8, 'Touma episode 2 should contain three small talks and five episodes')

assert(mobile.schema_version === 1, 'unexpected mobile archive schema version')
assert(mobile.meta.scenario_count === 1269, 'expected 1,269 normalized mobile scenarios')
assert(mobile.meta.kind_counts.idol_talk === 830, 'expected 830 idol talk scenarios')
assert(mobile.meta.kind_counts.unit_talk === 97, 'expected 97 unit talk scenarios')
assert(mobile.meta.kind_counts.idol_phone === 342, 'expected 342 idol phone scenarios')
assert(mobile.meta.personal_room_count === 49, 'expected 49 personal mobile rooms')
assert(mobile.meta.unit_room_count === 16, 'expected 16 unit mobile rooms')
assert(mobile.meta.random_topic_count === 245, 'expected 245 random talk topics')
assert(mobile.meta.random_intro_count === 343, 'expected 343 random talk intros')

const toumaScenarios = mobile.by_idol_code['001tom'].map(id => scenariosById.get(id))
const toumaMissionTitles = new Set(toumaScenarios.map(entry => entry.title))
for (const title of [
  '『天ヶ瀬 冬馬』と累計3回お仕事しよう',
  '『天ヶ瀬 冬馬』を編成して累計50回ライブしよう',
  '『天ヶ瀬 冬馬』の信頼度を25にしよう',
]) {
  assert(toumaMissionTitles.has(title), `missing Touma mission: ${title}`)
}

const incomingPhone = toumaScenarios.find(entry => entry.base_resource_id === '1_2_001_22_t01')
assert(incomingPhone?.kind === 'idol_phone', 'Touma idol-story incoming call is missing')
assert(incomingPhone.release_condition.kind === 'idol_story_episode_finished', 'incoming call condition type mismatch')
assert(incomingPhone.release_condition.param_a === 2010208, 'incoming call should unlock after Touma episode 2 final record')

const jupiterScenarios = mobile.by_unit_code['01jup'].map(id => scenariosById.get(id))
assert(jupiterScenarios.length === 6, 'Jupiter should have three mission talks and three 2022 birthday talks')
assert(jupiterScenarios.some(entry => entry.title.includes('累計スコア500万')), 'Jupiter score mission is missing')
assert(jupiterScenarios.some(entry => entry.title.includes('合計ファン数を3万人')), 'Jupiter fan mission is missing')

const missingCompiled = mobile.scenarios.filter(entry => !entry.compiled_exists)
assert(missingCompiled.length === 1, 'expected exactly one locally missing mobile scenario')
assert(missingCompiled[0].base_resource_id === '8_2_2_013', 'unexpected missing mobile scenario')

console.log(JSON.stringify({
  idol_episode: episodes.meta,
  mobile: mobile.meta,
  known_missing_compiled: missingCompiled.map(entry => entry.base_resource_id),
}, null, 2))
