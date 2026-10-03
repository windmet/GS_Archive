import { reflowArchiveText } from './ArchiveText.js'

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

const COSTUME_VARIANT_SLOTS = [
  [['live_initial', 45], ['live_limitbreak', 47]],
  [['story_awakened', 49], ['story_limitbreak', 50]],
]
const CARD_COSTUME_SOURCE_FIELDS = {
  live_initial: 45, live_limitbreak: 47,
  story_initial: 48, story_awakened: 49, story_limitbreak: 50,
}

function isCardCostumeVariantPair(first, second, relations) {
  const a = /^([0-9]{3}[a-z]{3}_[0-9]{3})_(00|01)$/.exec(first.model_resource_id || '')
  const b = /^([0-9]{3}[a-z]{3}_[0-9]{3})_(00|01)$/.exec(second.model_resource_id || '')
  if (!a || !b || a[1] !== b[1] || a[2] === b[2]) return false
  const [base, variant] = a[2] === '00' ? [first, second] : [second, first]
  if (!base.name || variant.name !== `${base.name}+`) return false
  // Published cards.detail retains explicit CardData slots but stripEvidence
  // omits _source. Accept that complete public pair; never treat a partially
  // sourced/malformed canonical relation as the public projection.
  const related = relations.filter(relation => CARD_COSTUME_SLOTS.has(relation.slot) &&
    [base.model_resource_id, variant.model_resource_id].includes(relation.model_resource_id))
  const hasSource = related.some(relation => Object.hasOwn(relation, '_source'))
  if (hasSource && (related.some(relation => relation._source?.table !== 1 ||
      relation._source.fields?.costume_id !== CARD_COSTUME_SOURCE_FIELDS[relation.slot] ||
      !Number.isInteger(relation._source.offset)) ||
      new Set(related.map(relation => relation._source.offset)).size !== 1)) return false
  // Suffixes/names alone are insufficient in either projection. Require the
  // card's explicit ordinary/breakthrough pair; legacy relation_id is sort order.
  return COSTUME_VARIANT_SLOTS.some(([initial, limitbreak]) => {
    const sourceFor = (costume, [slot, field]) => relations.filter(relation =>
      relation.model_resource_id === costume.model_resource_id && relation.slot === slot &&
      (!hasSource || relation._source?.fields?.costume_id === field))
    return sourceFor(base, initial).some(ordinary => sourceFor(variant, limitbreak)
      .some(enhanced => !hasSource || ordinary._source.offset === enhanced._source.offset))
  })
}

/** Share flavor text only; retain each costume model, name and slot labels. */
export function presentCardCostumeGroups(relations = [], descriptionFor = costume => costume.description || '') {
  const groups = []
  for (const costume of presentCardCostumeRelations(relations)) {
    const description = descriptionFor(costume)
    const group = typeof costume.description === 'string' && costume.description.trim() &&
      typeof description === 'string' && description.trim() && groups.find(candidate =>
        candidate.description === description && candidate.sourceDescription === costume.description &&
        candidate.costumes.every(other => isCardCostumeVariantPair(other, costume, relations)))
    if (group) {
      group.costumes.push(costume)
      group.name = group.costumes.find(item => item.model_resource_id.endsWith('_00')).name
    } else groups.push({ key: costume.key, name: costume.name, description, sourceDescription: costume.description,
      costumes: [costume] })
  }
  return groups
}

// These are the setting headers present in the source costume flavors and
// their Chinese overlay. A short line or missing full stop is not a heading.
const COSTUME_SETTING_HEADING = /^(?:[^\s:：]+座[:：](?:火|地|水|風|土|风)(?:のエレメント|元素)|(?:クラス|职业)[:：][^\r\n]+)$/u
const COSTUME_QUOTED_PARAGRAPH = /^(?:「[^」]+」|『[^』]+』|“[^”]+”|‘[^’]+’|"[^"]+")(?=\n|$)/u

/** Mobile presentation only; callers retain the unmodified desktop flavor. */
export function reflowCardCostumeFlavor(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split(/\n[\t ]*\n/).map(paragraph => {
    const lines = paragraph.split('\n')
    const heading = COSTUME_SETTING_HEADING.test(lines[0]) ? lines.shift() : ''
    const body = [], prose = []
    const finishProse = () => {
      if (prose.length) body.push(reflowArchiveText(prose.splice(0).join('\n')))
    }
    for (let index = 0; index < lines.length; index++) {
      // A quoted paragraph may itself contain game-width wrapping. A closing
      // quote followed by prose (e.g. 『敗北』の文字…) is not a paragraph edge.
      const quoted = COSTUME_QUOTED_PARAGRAPH.exec(lines.slice(index).map(line => line.trim()).join('\n'))?.[0]
      if (quoted) {
        finishProse()
        body.push(reflowArchiveText(quoted))
        index += quoted.split('\n').length - 1
      } else prose.push(lines[index])
    }
    finishProse()
    return `${heading ? `${heading}\n` : ''}${body.join('\n\n')}`
  }).join('\n\n')
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
