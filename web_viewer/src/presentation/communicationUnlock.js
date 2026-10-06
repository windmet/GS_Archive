/** What a card has to reach before its phone call opens, as the communication archive words it. */
export function communicationUnlockAction(condition = {}) {
  if (condition?.kind === 'card_acquired') return '获得'
  if (condition?.kind === 'card_awakened') return '特训完成'
  if (condition?.kind === 'card_limit_break') return `突破 ${condition.param_b || 4} 次`
  return '开放条件待确认'
}
