// Date-seeded source selection stays stable across rerenders and a same-day reload.
export function portalDailyCard(cards, date, draw=0) {
  const pool=cards.filter(card=>card.image?.url).slice().sort((a,b)=>a.id.localeCompare(b.id))
  if (!pool.length) return null
  let hash=0
  for (const char of String(date)) hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0
  return pool[(hash+draw*37)%pool.length]
}

export function portalCardCaption(card, { global = false } = {}) {
  if (!card) return { eyebrow: null, title: '' }
  const rarity = card.rarity || ''
  if (global) {
    return {
      eyebrow: [rarity, card.idolName].filter(Boolean).join(' · '),
      title: card.title || '',
    }
  }
  return {
    eyebrow: null,
    title: [rarity, card.title].filter(Boolean).join(' · '),
  }
}
