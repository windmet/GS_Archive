// Joins the wiki gasha pages and the RAW art links to archive gasha ids. Shared by the generator and its verifier,
// so the committed files can be rebuilt and compared exactly.
const BASIS_TEXT = {
  banner_text: '横幅上印的卡池名与此卡池一致，且没有其他横幅印同一名称。',
  banner_text_chronology: '多张横幅印同一名称；通常卡池编号按开放顺序排列（已由 49 个有公告编号的卡池确认），此编号位于对应开放记录前后的卡池之间。',
  banner_text_shared: '多张横幅印同一名称，卡池也开放过多次；这些横幅都列为同名横幅，未逐次对应。',
}

function fail(message) { throw new Error(message) }

export function buildGashaPoolDetails({pages, media, config, gashaIndex, tickets, cardIndex}) {
  const cards = new Map(cardIndex.cards.map(card => [card.resource_id, card]))
  const ticketIds = new Set(tickets.rows.filter(row => !row.matched_ids.length).map(row => row.id))
  const art = gashaId => {
    const entry = media.media[String(gashaId)] || fail(`No media for gasha ${gashaId}`)
    const pick = role => entry[role] ? {url: entry[role].url, width: entry[role].width, height: entry[role].height} : null
    return {gasha_id: gashaId, banner: pick('banner'), logo: pick('logo'), bg: pick('bg')}
  }
  // Announcements of one pool (primary and final-day) share its page.
  const byLogical = new Map()
  for (const row of gashaIndex.gashas) byLogical.set(row.logical_id, [...(byLogical.get(row.logical_id) || []), String(row.id)])
  const details = {}
  const entry = id => (details[id] ||= {schema_version: 1, id, art: null, pages: []})

  for (const page of pages.pages) {
    const ids = new Set()
    for (const pool of page.pools) {
      if (pool.announcement_id) {
        const row = gashaIndex.by_id[pool.announcement_id] || fail(`Unknown announcement ${pool.announcement_id}`)
        for (const id of byLogical.get(row.logical_id)) ids.add(id)
      }
      for (const id of pool.ticket_group_ids) ticketIds.has(id) ? ids.add(id) : fail(`Unknown ticket pool ${id}`)
    }
    if (!ids.size) fail(`${page.title}: no archive gasha`)
    const exchanges = page.exchanges.map(exchange => ({...exchange, rows: exchange.rows.map(row => {
      const card = cards.get(row.resource_id) || fail(`Unknown card ${row.resource_id}`)
      return {...row, card_title: card.title, character_id: card.character_id, rarity: card.rarity}
    })}))
    const summary = {title: page.title, url: page.url, checked_at: pages.checked_at, last_modified: page.last_modified,
      periods: page.periods, facts: page.facts, steps: page.steps, exchanges, sections: page.sections,
      pools: page.pools.map(pool => ({heading: pool.heading, start_at: pool.start_at}))}
    for (const id of ids) entry(id).pages.push(summary)
  }

  for (const pool of config.pools) {
    entry(pool.pool).art = {
      primary: {...art(pool.primary), banner_text: pool.banner_text, basis: pool.basis, basis_text: BASIS_TEXT[pool.basis] || fail(`Unknown basis ${pool.basis}`)},
      variants: (pool.variants || []).map(variant => ({...art(variant.gasha_id), banner_text: variant.banner_text, label: variant.label})),
      unresolved: null,
    }
  }
  for (const row of config.unresolved) for (const id of row.pools) {
    entry(id).art = {primary: null, variants: [], unresolved: {banner_text: row.banner_text, reason_zh: row.gasha_ids.length
      ? `游戏内有 ${row.gasha_ids.length} 张印着同一名称的横幅，横幅上没有标明第几弹，现有资料无法区分哪张对应此卡池。`
      : '游戏资源中没有印此卡池名称的横幅。', candidates: row.gasha_ids.map(art)}}
  }

  const index = {schema_version: 1, checked_at: pages.checked_at, ids: {}}
  for (const [id, detail] of Object.entries(details)) {
    index.ids[id] = {rules: detail.pages.length > 0, art: detail.art?.primary ? {logo: detail.art.primary.logo, bg: detail.art.primary.bg, banner: detail.art.primary.banner} : null}
  }
  index.summary = {
    gashas: Object.keys(details).length,
    with_rules: Object.values(details).filter(detail => detail.pages.length).length,
    ticket_pools_with_art: Object.values(details).filter(detail => detail.art?.primary).length,
    ticket_pools_unresolved_art: Object.values(details).filter(detail => detail.art?.unresolved).length,
  }
  return {details, index}
}
