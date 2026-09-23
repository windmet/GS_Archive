import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { presentCardSkillDescription } from '../src/presentation/CardSkillDescriptionPresenter.js'
import { projectCommunicationInlineContent } from '../src/presentation/communicationInlineContent.js'
import { buildCompiledGroupTitleMap, groupMobileScenarios } from '../src/data/idolCommunicationSelectors.js'

const read = path => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8'))
const details = read('masterdata/card_detail_index.json')
let templated = 0
for (const skill of Object.values(details.skills_by_id)) {
  for (const level of skill.levels || []) {
    const output = presentCardSkillDescription(level.description)
    if (/<[^>]+>/.test(level.description)) {
      templated += 1
      assert.ok(output.includes('〔数值尚未解析〕'))
      assert.doesNotMatch(output, /<[^>]+>/)
      assert.ok(output.includes('秒'), 'known trigger context should remain visible')
    } else assert.equal(output, level.description)
  }
}
assert.ok(templated > 0)
assert.equal(presentCardSkillDescription(''), '技能数值说明暂未收录。')
assert.equal(presentCardSkillDescription('7秒ごとに<d00>%アップし、<d11>回復'),
  '7秒ごとに〔数值尚未解析〕アップし、〔数值尚未解析〕回復')

const groups = groupMobileScenarios(read('masterdata/mobile_archive_index.json').scenarios,
  buildCompiledGroupTitleMap(read('compiled/index.json')))
const sample = groups.find(group => /<emoji>/.test(group.title))
assert.ok(sample, 'real group title emoji fixture is missing')
const parts = projectCommunicationInlineContent(sample.title)
assert.ok(parts.some(part => part.type === 'emoji' && part.alt === '表情'))
assert.doesNotMatch(parts.filter(part => part.type === 'text').map(part => part.text).join(''), /<emoji>/)
assert.deepEqual(projectCommunicationInlineContent(''), [{ type: 'text', text: '' }])
assert.deepEqual(projectCommunicationInlineContent('A<emoji>image_talk_emoji_05</emoji>B'), [
  { type: 'text', text: 'A' }, { type: 'emoji', id: 'image_talk_emoji_05', alt: '表情' }, { type: 'text', text: 'B' },
])
const cardComponent = readFileSync(new URL('../src/components/archive/ArchiveCardDetail.vue', import.meta.url), 'utf8')
const mobileComponent = readFileSync(new URL('../src/components/archive/ArchiveMobileArchive.vue', import.meta.url), 'utf8')
assert.match(cardComponent, /presentCardSkillDescription\(selectedSkill\?\.description\)/)
assert.match(mobileComponent, /projectCommunicationInlineContent\(bundle\.title\)/)
assert.match(mobileComponent, /原游戏开放条件/)
assert.match(mobileComponent, /不影响资料馆内已收录内容的浏览与播放/)
console.log(`Archive inline presentation: ${templated} skill levels, real communication title and shared emoji parts passed`)
