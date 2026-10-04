// Date-seeded source selection stays stable across rerenders and a same-day reload.
export function portalDailyCard(cards, date, draw=0) {
  const pool=cards.filter(card=>card.image?.url).slice().sort((a,b)=>a.id.localeCompare(b.id))
  if (!pool.length) return null
  let hash=0
  for (const char of String(date)) hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0
  return pool[(hash+draw*37)%pool.length]
}
export function portalTimeline(events) {
  const sorted=events.filter(row=>row.image?.url && row.subtitle).slice().sort((a,b)=>a.releaseAt-b.releaseAt)
  if (!sorted.length) return []
  const choices=[sorted[0]]
  const years=[...new Set(sorted.map(row=>new Date(row.releaseAt*1000).getUTCFullYear()))]
  for (const year of years) {
    const rows=sorted.filter(row=>new Date(row.releaseAt*1000).getUTCFullYear()===year)
    choices.push(rows.find(row=>row.id==='410008' && row.title.includes('K.now O.nly')) || rows[Math.floor(rows.length/2)])
  }
  choices.push(sorted.at(-1))
  return [...new Map(choices.map(row=>[row.id,row])).values()].sort((a,b)=>a.releaseAt-b.releaseAt)
}
