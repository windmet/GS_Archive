import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const cardIndex = readJson('public/data/masterdata/card_index.json')
const detailIndex = readJson('public/data/masterdata/card_detail_index.json')

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

const expectedItems = new Map([
  [10501, '彩光の欠片 N'],
  [10502, '彩光の欠片 R'],
  [10503, '彩光の欠片 SR'],
  [10504, '彩光の欠片 SSR'],
  [10505, 'フェス限定彩光の欠片'],
])

for (const [id, name] of expectedItems) {
  const item = detailIndex.items_by_id?.[id]
  check(item?.name === name, `item ${id} must resolve to ${name}`)
  check(item?._source?.table === 16, `item ${id} must cite table 16`)
}

for (const card of cardIndex.cards || []) {
  if (Number.isInteger(card.limitbreak_item_id)) {
    check(Boolean(detailIndex.items_by_id?.[card.limitbreak_item_id]),
      `card ${card.resource_id} has unresolved item ${card.limitbreak_item_id}`)
  }
}

for (const skill of Object.values(detailIndex.skills_by_id || {})) {
  check(Number.isInteger(skill.category?.id), `skill ${skill.id} has no category id`)
  check(Boolean(skill.category?.name), `skill ${skill.id} has no category name`)
  check(skill.category?._source?.table === 75, `skill ${skill.id} must cite table 75`)
}

for (const skill of Object.values(detailIndex.center_skills_by_id || {})) {
  check(Number.isInteger(skill.category?.id), `center skill ${skill.id} has no category id`)
  check(Boolean(skill.category?.name), `center skill ${skill.id} has no category name`)
  check(skill.category?._source?.table === 130, `center skill ${skill.id} must cite table 130`)
}

const taker = (cardIndex.cards || []).find(card => card.card_id === 1338001)
const takerDetail = detailIndex.cards_by_resource_id?.[taker?.resource_id]
const takerSkill = detailIndex.skills_by_id?.[takerDetail?.gameplay?.skill_id]
const takerCenter = detailIndex.center_skills_by_id?.[takerDetail?.gameplay?.center_skill_id]
check(taker?.limitbreak_item_id === 10503, 'card 1338001 must use SR limitbreak item 10503')
check(takerSkill?.category?.name === 'コンボボーナス', 'card 1338001 skill category mismatch')
check(takerCenter?.category?.name === 'フィジカルグリッター', 'card 1338001 center category mismatch')

const component = fs.readFileSync(path.join(root, 'src/components/archive/ArchiveCardDetail.vue'), 'utf8')
const selector = fs.readFileSync(path.join(root, 'src/data/archiveSelectors.js'), 'utf8')
check(component.includes('card.limitbreak_item.name'), 'card detail must render the limitbreak item name')
check(component.includes('card.gameplay.skill.category'), 'card detail must render normal skill category semantics')
check(component.includes('card.gameplay.center_skill.category'), 'card detail must render center skill category semantics')
check(selector.includes('cardDetailIndex.items_by_id?.[card.limitbreak_item_id]'), 'selector must join item dictionary by id')

if (failures.length) {
  console.error(`card semantic dictionary verification failed (${failures.length})`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(JSON.stringify({
  cards: cardIndex.cards?.length || 0,
  items: Object.keys(detailIndex.items_by_id || {}).length,
  skills: Object.keys(detailIndex.skills_by_id || {}).length,
  center_skills: Object.keys(detailIndex.center_skills_by_id || {}).length,
  known_card: taker?.resource_id,
}, null, 2))
