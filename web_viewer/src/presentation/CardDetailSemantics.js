// These slots come from the card's own Live/Story costume fields. Home slots
// describe a reusable homepage selection and are not a card-specific relation.
const CARD_COSTUME_SLOTS = new Set([
  'live_initial', 'live_limitbreak',
  'story_initial', 'story_awakened', 'story_limitbreak',
])

export function presentCardCostumeRelations(relations = []) {
  const byModel = new Map()
  for (const relation of relations) {
    if (!CARD_COSTUME_SLOTS.has(relation.slot)) continue
    const key = relation.model_resource_id || relation.costume_key
    if (!key) continue
    const current = byModel.get(key) || { ...relation, key, labels: [] }
    if (relation.label && !current.labels.includes(relation.label)) current.labels.push(relation.label)
    byModel.set(key, current)
  }
  return [...byModel.values()]
}

export function presentCardAssetRows(card, status) {
  if (card?.single_state) return [
    { label: '单卡面缩略图', available: status?.awakened_icon },
    { label: '单卡面无框图', available: status?.awakened_portrait },
  ]
  const common = [
    { label: '普通缩略图', available: status?.normal_icon },
    { label: '觉醒缩略图', available: status?.awakened_icon },
    { label: '普通无框卡面', available: status?.normal_portrait },
    { label: '觉醒无框卡面', available: status?.awakened_portrait },
  ]
  return card?.rarity === 'SSR' ? common.concat([
    { label: '普通 SSR 横图', available: status?.normal_landscape },
    { label: '觉醒 SSR 横图', available: status?.awakened_landscape },
  ]) : common
}
