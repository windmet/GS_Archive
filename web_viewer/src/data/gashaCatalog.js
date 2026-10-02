const CATEGORY_LABELS = {
  standard_pickup: '通常',
  growing_fes: 'GROWING FES',
  stage_step_up: 'STAGE',
  full_roster_series: '全员系列',
  ticket_named: '道具补录',
}

export function resolveGashaRelatedCards(gasha, index) {
  if (!gasha || !gasha.related_pickup_count) return gasha
  const sourceCode = gasha.related_pickup_source === 'reprint' ? gasha.reprint_of : gasha.primary_code
  const sourceCards = index?.by_code?.[sourceCode]?.derived_pickup_cards || []
  const relatedIds = new Set(gasha.related_pickup_card_ids || [])
  return { ...gasha, related_pickup_cards: sourceCards.filter(card => relatedIds.has(card.card_resource_id)) }
}

export function buildGashaCatalog(index) {
  return [...(index?.gashas || [])]
    .filter(gasha => gasha.phase === 'primary')
    .map(gasha => resolveGashaRelatedCards(gasha, index))
    .reverse()
}

export function buildGashaCategoryOptions(index, catalog) {
  const counts = index?.meta?.category_counts || {}
  return [
    { value: 'all', label: '全部', count: catalog.length },
    ...Object.entries(CATEGORY_LABELS).filter(([value])=>value!=='ticket_named'||counts[value]>0).map(([value, label]) => ({ value, label, count: counts[value] || 0 })),
  ]
}

export function filterGashaCatalog(catalog, { query = '', category = 'all', idolSearchText = () => '', nameSearchText = source => source } = {}) {
  const q = query.trim().toLowerCase()
  return catalog.filter(gasha => {
    if (category !== 'all' && gasha.category !== category) return false
    if (!q) return true
    return String(nameSearchText(gasha.display_name) || '').toLowerCase().includes(q) ||
      String(gasha.code || '').toLowerCase().includes(q) ||
      [...(gasha.derived_pickup_cards || []), ...(gasha.related_pickup_cards || [])].some(card =>
        String(card.card_title || '').toLowerCase().includes(q) ||
        String(card.card_resource_id || '').toLowerCase().includes(q) ||
        idolSearchText(card.character_id).includes(q)
      )
  })
}
