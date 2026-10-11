import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { presentMissionText } from '../src/presentation/missionText.js'

// Every 通信 unlock mission title in the masterdata renders in Chinese; idol subjects take their
// Chinese names, songs and units keep their source text, and the Japanese UI shows the source.
const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
const index = read('public/data/masterdata/mobile_archive_index.json')
const idols = read('public/data/masterdata/idol_unit_dictionary.json').idols
const chinese = read('public/translations/zh-CN/entities/idols.json').entries
const byName = new Map(idols.map(idol => [idol.display_name.replace(/\s+/g, ''), chinese[idol.idol_code]?.name]))
const name = source => byName.get(source.replace(/\s+/g, '')) || source

const missions = new Set()
const walk = value => {
  if (Array.isArray(value)) value.forEach(walk)
  else if (value && typeof value === 'object') {
    if (value.kind === 'scenario_title_mission' && typeof value.text === 'string') missions.add(value.text)
    if (typeof value.title === 'string' && /^『.+』.+しよう$/u.test(value.title)) missions.add(value.title)
    Object.values(value).forEach(walk)
  }
}
walk(index)
assert.ok(missions.size >= 390, `expected the ~393 mission titles, found ${missions.size}`)

let idolSubjects = 0
for (const text of missions) {
  const shown = presentMissionText(text, { name })
  // The subject may itself be a Japanese song title; the rest of the sentence must be Chinese.
  assert.doesNotMatch(shown.replace(/「.*」/u, ''), /[぀-ゟ]|しよう|累計/u, `untranslated mission: ${text} -> ${shown}`)
  const subject = text.match(/^『(.+)』/u)[1]
  if (byName.has(subject.replace(/\s+/g, ''))) {
    idolSubjects++
    assert.ok(shown.includes(`「${name(subject)}」`), `idol subject in Chinese: ${shown}`)
  } else assert.ok(shown.includes(`「${subject}」`), `song or unit subject kept: ${shown}`)
  assert.equal(presentMissionText(text, { locale: 'ja-JP', name }), text, 'the Japanese UI shows the source')
}
assert.ok(idolSubjects > 300, 'most missions name an idol')
assert.equal(presentMissionText('『天ヶ瀬 冬馬』と累計3回お仕事しよう', { name }), `与「${name('天ヶ瀬 冬馬')}」累计完成 3 次工作`)
assert.equal(presentMissionText('『BRAND NEW FIELD』で累計スコア500万を達成しよう', { name }), '在「BRAND NEW FIELD」中累计得分达到 500万')
assert.equal(presentMissionText('『Jupiter』に所属するアイドルの合計ファン数を3万人にしよう', { name }), '「Jupiter」所属偶像的粉丝总数达到 3万 人')
assert.equal(presentMissionText('ど、どうしよう～！？', { name }), 'ど、どうしよう～！？', 'non-template text is left alone')
console.log(`Mission text: ${missions.size} unlock missions render in Chinese (${idolSubjects} with idol names), songs and units kept, Japanese UI unchanged`)
