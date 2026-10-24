import assert from 'node:assert/strict'
import {
  extractProgressiveMissionTemplate,
  consolidateProgressiveUnlocks,
} from '../src/data/idolCommunicationSelectors.js'
import { presentMissionText } from '../src/presentation/missionText.js'

// 1. Template extraction tests
assert.equal(
  extractProgressiveMissionTemplate('『天ヶ瀬 冬馬』と累計3回お仕事しよう')?.template,
  '『天ヶ瀬 冬馬』と累計{n}回お仕事しよう',
)
assert.equal(
  extractProgressiveMissionTemplate('『天ヶ瀬 冬馬』と累計3回お仕事しよう')?.value,
  '3',
)
assert.equal(
  extractProgressiveMissionTemplate('与「天ヶ瀬 冬馬」累计完成 5 次工作')?.template,
  '与「天ヶ瀬 冬馬」累计完成 {n} 次工作',
)
assert.equal(
  extractProgressiveMissionTemplate('与「天ヶ瀬 冬馬」累计完成 5 次工作')?.value,
  '5',
)
assert.equal(extractProgressiveMissionTemplate('任务达成'), null)

// Entity protection: numbers inside 『』 or 「」 are not extracted
assert.equal(
  extractProgressiveMissionTemplate('『315プロダクション』と累計7回お仕事しよう')?.template,
  '『315プロダクション』と累計{n}回お仕事しよう',
)
assert.equal(
  extractProgressiveMissionTemplate('『315プロダクション』と累計7回お仕事しよう')?.value,
  '7',
)

// 2. 覆盖「3 个模板 × 多阶段」
const multiTemplateUnlocks = [
  { id: 1, kind: 'scenario_title_mission', text: '与「冬马」累计完成 1 次工作' },
  { id: 2, kind: 'scenario_title_mission', text: '与「冬马」累计完成 2 次工作' },
  { id: 3, kind: 'scenario_title_mission', text: '与「冬马」累计完成 3 次工作' },
  { id: 4, kind: 'scenario_title_mission', text: '将「冬马」的信赖度提升到 10' },
  { id: 5, kind: 'scenario_title_mission', text: '将「冬马」的信赖度提升到 20' },
  { id: 6, kind: 'scenario_title_mission', text: '编入「冬马」累计进行 5 次 Live' },
  { id: 7, kind: 'scenario_title_mission', text: '编入「冬马」累计进行 15 次 Live' },
]
const multiMerged = consolidateProgressiveUnlocks(multiTemplateUnlocks)
assert.equal(multiMerged.length, 1)
assert.equal(multiMerged[0].isProgressive, true)
assert.equal(multiMerged[0].stageCount, 7)
assert.equal(
  multiMerged[0].text,
  '与「冬马」累计完成 1 / 2 / 3 次工作 · 将「冬马」的信赖度提升到 10 / 20 · 编入「冬马」累计进行 5 / 15 次 Live（共 7 阶段）',
)

// 3. 覆盖「单阶段」——不合并，原样输出
const singleStageUnlocks = [
  { id: 10, kind: 'scenario_title_mission', text: '与「冬马」累计完成 3 次工作' },
]
const singleResult = consolidateProgressiveUnlocks(singleStageUnlocks)
assert.equal(singleResult.length, 1)
assert.equal(singleResult[0].isProgressive, undefined)
assert.equal(singleResult[0].text, '与「冬马」累计完成 3 次工作')

// 4. 覆盖「无数字文本」——原样输出
const noDigitUnlocks = [
  { id: 20, kind: 'scenario_title_mission', text: '日常任务达成' },
]
const noDigitResult = consolidateProgressiveUnlocks(noDigitUnlocks)
assert.equal(noDigitResult.length, 1)
assert.equal(noDigitResult[0].isProgressive, undefined)
assert.equal(noDigitResult[0].text, '日常任务达成')

// 5. 覆盖「中文 locale 的 presentMissionText 输出」
const rawJapaneseUnlocks = [
  { id: 31, kind: 'scenario_title_mission', text: '『天ヶ瀬 冬馬』と累計3回お仕事しよう' },
  { id: 32, kind: 'scenario_title_mission', text: '『天ヶ瀬 冬馬』と累計5回お仕事しよう' },
]
const localizedMerged = consolidateProgressiveUnlocks(rawJapaneseUnlocks, {
  formatText: text => presentMissionText(text, { locale: 'zh-CN' }),
})
assert.equal(localizedMerged.length, 1)
assert.equal(localizedMerged[0].isProgressive, true)
assert.equal(localizedMerged[0].stageCount, 2)
assert.equal(
  localizedMerged[0].text,
  '与「天ヶ瀬 冬馬」累计完成 3 / 5 次工作（共 2 阶段）',
)

// 6. 覆盖卡片与剧情条件不参与合并
const mixedWithCardUnlocks = [
  { id: 41, kind: 'card_acquired', text: '获得卡片 10101', condition: { kind: 'card_acquired', param_a: 10101 } },
  { id: 42, kind: 'idol_story_episode_finished', text: '个人故事 1 完成', condition: { kind: 'idol_story_episode_finished', param_a: 1 } },
  { id: 43, kind: 'scenario_title_mission', text: '与「冬马」累计完成 1 次工作' },
  { id: 44, kind: 'scenario_title_mission', text: '与「冬马」累计完成 2 次工作' },
]
const mixedResult = consolidateProgressiveUnlocks(mixedWithCardUnlocks)
assert.equal(mixedResult.length, 3)
assert.equal(mixedResult[0].kind, 'card_acquired')
assert.equal(mixedResult[1].kind, 'idol_story_episode_finished')
assert.equal(mixedResult[2].kind, 'progressive_mission')
assert.equal(mixedResult[2].text, '与「冬马」累计完成 1 / 2 次工作（共 2 阶段）')

// 7. 单阶段 + 多阶段混合：单阶段保持独立，多阶段合并
const mixedSingleAndMulti = [
  { id: 51, kind: 'scenario_title_mission', text: '在「315」中累计得分达到 10,000' },
  { id: 52, kind: 'scenario_title_mission', text: '与「冬马」累计完成 1 次工作' },
  { id: 53, kind: 'scenario_title_mission', text: '与「冬马」累计完成 2 次工作' },
]
const mixedSingleMultiResult = consolidateProgressiveUnlocks(mixedSingleAndMulti)
assert.equal(mixedSingleMultiResult.length, 2)
assert.equal(mixedSingleMultiResult[0].text, '在「315」中累计得分达到 10,000')
assert.equal(mixedSingleMultiResult[1].text, '与「冬马」累计完成 1 / 2 次工作（共 2 阶段）')

console.log('Progressive mission consolidation: multi-template, single-stage, no-digit, Chinese presentMissionText and card/story immunity passed')
