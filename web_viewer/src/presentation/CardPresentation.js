import { communicationUnlockAction } from './communicationUnlock.js'

// A card's scenario entries are 通信 content: calls opened by limit break, training or
// acquisition (the 12 acquisition calls carry no communication_type), and the chat after scouting.
const CARD_COMMUNICATION = {
  limitbreak_phone: ['电话', { kind: 'card_limit_break', param_b: 4 }],
  awakened_phone: ['电话', { kind: 'card_awakened' }],
  scout_talk: ['聊天', { kind: 'card_acquired' }],
}
export function cardCommunicationLabel(entry) {
  const known = CARD_COMMUNICATION[entry?.communication_type]
  const call = !known && entry?.compiled_summary?.step_types?.call
  const [kind, condition] = known || (call ? ['电话', { kind: 'card_acquired' }] : ['通信', {}])
  const action = condition.kind ? communicationUnlockAction(condition) : ''
  return action ? `${kind} · ${action}${kind === '聊天' ? '后' : ''}` : kind
}

/** Table 43 field 3 is the card scenario's title; table 32 field 3 is an internal label. */
export function cardScenarioTitle(entry) {
  const display = typeof entry?.display_title === 'string' ? entry.display_title.trim() : ''
  if (display) return display
  const table = entry?._source?.table ?? entry?._top_field
  const source = table === 43 && typeof entry?.['3'] === 'string' ? entry['3'].trim() : ''
  return source && source !== entry.resource_id ? source : '剧情标题待确认'
}
