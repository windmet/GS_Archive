import { IDOL_ID_TO_NAME } from '../../utils/IdolNameMap.js'

// Display lookup only. A public, explicitly written name is sufficient to
// translate its label, but must never create actor identity or reveal ???.
const compact = value => String(value || '').normalize('NFKC').replace(/\s+/gu, '')
const labels = new Map()
for (const [entityId, sourceName] of Object.entries(IDOL_ID_TO_NAME)) {
  const entityType = /^0\d{2}[a-z]{3}$/u.test(entityId) ? 'idol'
    : ['101ken', '102sha', '241sub'].includes(entityId) ? 'npc' : null
  if (entityType) labels.set(compact(sourceName), Object.freeze({ entityType, entityId, sourceName }))
}
// Published masterdata spells out the same explicitly visible Aslan name.
labels.set(compact('アスラン＝ベルゼビュートⅡ世'), labels.get(compact(IDOL_ID_TO_NAME['029ass'])))

export function speakerDisplayLookup(speaker) {
  if (!['named', 'idol', 'npc'].includes(speaker?.kind)) return null
  const source = speaker.sourceName ?? speaker.source_name ?? speaker.source
  const target = labels.get(compact(source))
  if (!target) return null
  const id = speaker.entityId ?? speaker.entity_id
  const type = speaker.entityType ?? speaker.entity_type
  if (id && id !== target.entityId) return null
  // Some legacy NPC labels were typed idol. Only the three explicit public
  // NPC codes above may use this display exception, with no identity mutation.
  if (type && type !== target.entityType && !(type === 'idol' && target.entityType === 'npc')) return null
  return target
}
