// Chinese statements for the rule facts scripts/extract-wikiwiki-gasha-pages.py reads from a gasha's wiki page.
// Each statement keeps its source line, so the page can show what it was read from.
const GROUPS = [
  ['draw', '抽取方式'],
  ['guarantee', '保底'],
  ['rate', '提供割合'],
  ['exchange', '记忆之星'],
  ['note', '其他说明'],
]

const KIND_GROUP = {
  currency_any: 'draw', price: 'draw', per_user_paid: 'draw', use_limit: 'draw', daily_discount_paid: 'draw', daily_discount_reset: 'draw',
  guarantee_ten: 'guarantee', ssr_guaranteed: 'guarantee', sr_ticket: 'guarantee', rarity_ticket: 'guarantee',
  rate_up: 'rate', rate_varies: 'rate',
  no_memory_star: 'exchange', memory_to_piece: 'exchange',
  ssr_costume: 'note', limited_leaves: 'note', limited_returns: 'note', no_changed_cards: 'note', duplicates: 'note', bonus_item: 'note',
}

const TARGETS = { 新登場アイドルフォト: '新登场卡片' }

/** Who a section's rule applies to: nobody named for the page's own gasha, else the SSR-guaranteed draw or a named
 *  sub-gasha such as a ticket's draw. */
export function ruleSubject(heading, pageTitle, gashaName) {
  const name = String(heading || '').replace(/(について|とは)$/u, '').trim()
  if (!name || name === '注意事項' || name === 'プラチナガシャ' || String(pageTitle || '').includes(name)) return ''
  if (name.startsWith('SSR確定')) return 'SSR 确定版'
  return `「${gashaName(name)}」`
}

/** The tag a sub-draw's statements carry: SSR 确定版, a bonus variant (「…付き！…ガシャ」) as 附赠版 with its full
 *  name kept for the tooltip, or the translated name. Null for the page's own draw. */
export function ruleSubjectTag(heading, pageTitle, gashaName) {
  const name = String(heading || '').replace(/(について|とは)$/u, '').trim()
  const subject = ruleSubject(heading, pageTitle, gashaName)
  if (!subject) return null
  if (subject === 'SSR 确定版') return { label: subject, title: '' }
  if (/付き！/u.test(name)) return { label: '附赠版', title: gashaName(name) }
  return { label: gashaName(name), title: '' }
}

// Kinds whose statement names a sub-draw. The rest describe the page as a whole or name their own ticket/gasha.
const SUBJECT_HEADING = {
  currency_any: fact => fact.section, price: fact => fact.section, per_user_paid: fact => fact.section,
  use_limit: fact => fact.section, ssr_guaranteed: fact => fact.section, bonus_item: fact => fact.section,
  no_memory_star: fact => fact.target,
}

// A short label for a statement inside its row, where the row alone does not say what it is about.
const TOPICS = {
  no_memory_star: '获得', memory_to_piece: '结束后',
  ssr_costume: '专用服装', limited_leaves: '期间限定', limited_returns: '期间限定', no_changed_cards: 'チェンジ！',
  duplicates: '重复获得', bonus_item: '附赠',
}

function body(fact, {gashaName, itemName}) {
  switch (fact.kind) {
    case 'currency_any': return '付费、免费星钻均可使用'
    case 'price': return `价格 ${fact.prices.map(price => `${price.paid_only ? '付费' : ''}星钻 ${price.jewels} 个（${price.draws} 次）`).join('，或')}`
    case 'per_user_paid': return `期间每人限 ${fact.count} 次，仅限付费星钻`
    case 'use_limit': return `最多使用 ${fact.count} 次`
    case 'daily_discount_paid': return '每日 1 次的折扣抽取仅限付费星钻'
    case 'daily_discount_reset': return `每日 1 次的折扣抽取每天 ${fact.time} 重置`
    case 'guarantee_ten': return `出现 R 以上卡片；10 连必出 ${fact.count} 张以上 SR 以上卡片`
    case 'ssr_guaranteed': return `必出 ${fact.count} 张以上 SSR`
    case 'sr_ticket': return `使用「${itemName(fact.ticket)}」时，从开放中的「${gashaName(fact.gasha)}」必出 SR 以上卡片`
    case 'rarity_ticket': return `使用「${itemName(fact.ticket)}」或「${itemName(fact.ticket2)}」时，从「${gashaName(fact.gasha)}」必出对应稀有度的卡片`
    case 'rate_up': return `开放期间，${TARGETS[fact.target] || `「${fact.target}」`}的提供割合高于同稀有度的其他卡片`
    case 'rate_varies': return '每张卡片的提供割合各不相同'
    case 'no_memory_star': return '不获得记忆之星'
    case 'memory_to_piece': return '期间内获得的记忆之星在期间结束后转换为记忆碎片'
    case 'ssr_costume': return '抽到 SSR 时同时获得可在 LIVE 中使用的专用服装'
    case 'limited_leaves': return '带「期間限定」标记的卡片在本卡池结束后不再出现'
    case 'limited_returns': return '带「期間限定」标记的卡片日后可能再次登场'
    case 'no_changed_cards': return '不会出现「チェンジ！」后的卡片'
    case 'duplicates': return `重复获得的卡片会转换为对应的「${itemName(fact.item)}」`
    case 'bonus_item': return `附赠「${itemName(fact.item)}」`
    default: return ''
  }
}

function statement(fact, pageTitle, names) {
  const text = body(fact, names)
  if (!text) return null
  const heading = SUBJECT_HEADING[fact.kind]?.(fact)
  const subject = heading === undefined ? null : ruleSubjectTag(heading, pageTitle, names.gashaName)
  const prefix = fact.kind === 'no_memory_star' ? ruleSubject(fact.target, pageTitle, names.gashaName) || '本卡池'
    : fact.kind === 'bonus_item' || !subject ? '' : `${ruleSubject(heading, pageTitle, names.gashaName)}：`
  // text is the standalone sentence (dedupe, search, tests); body + subject is how a tagged row shows it.
  return { text: `${prefix}${text}`, body: text, subject, topic: TOPICS[fact.kind] || '' }
}

/** Groups a page's facts into Chinese statements, dropping repeats (several sections restate the same rule). The
 *  two 期間限定 statements read as one sentence when both are present. */
export function gashaRuleGroups(facts, pageTitle, names) {
  const groups = new Map(GROUPS.map(([id, label]) => [id, {id, label, items: []}]))
  const seen = new Set()
  for (const fact of facts || []) {
    const item = statement(fact, pageTitle, names)
    const group = groups.get(KIND_GROUP[fact.kind])
    if (!item || !group || seen.has(item.text)) continue
    seen.add(item.text)
    group.items.push({...item, kind: fact.kind, source: fact.line})
  }
  const notes = groups.get('note')
  const leaves = notes.items.find(item => item.kind === 'limited_leaves')
  const returns = notes.items.find(item => item.kind === 'limited_returns')
  if (leaves && returns) {
    leaves.body = '带「期間限定」标记的卡片在本卡池结束后不再出现，日后可能再次登场'
    leaves.merged = [returns.text]
    notes.items.splice(notes.items.indexOf(returns), 1)
  }
  return [...groups.values()].filter(group => group.items.length)
}
