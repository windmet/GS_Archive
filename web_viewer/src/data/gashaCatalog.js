const CATEGORY_LABELS = {
  standard_pickup: '通常',
  growing_fes: 'GROWING FES',
  stage_step_up: 'STAGE',
  full_roster_series: '全员系列',
  ticket_named: '票券招募',
}

export function gashaCategoryLabel(category) {
  return CATEGORY_LABELS[category] || ''
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

// GashaData.MovieAnnounceId is not in client masterdata. A MovieAnnounce record is attached only
// when two independent keys agree exactly — its ResourceId is the announcement's gasha code and
// its term opens at the announcement's start — and it stays a derived relation. A start time
// alone (the GROWING FES records) is never enough.
export function gashaAnnounceMovie(gasha, movieIndex) {
  const matches = (movieIndex?.movie_announces || []).filter(movie =>
    String(movie.resource_id) === String(gasha?.code) && Number.isFinite(gasha?.start_at) &&
    movie.term?.start_at === gasha.start_at)
  if (matches.length !== 1) return null
  const [movie] = matches
  return { movie_id: movie.id, resource_id: movie.resource_id, raw_file: `movie_home_announce_${movie.resource_id}.usm`,
    evidence_level: 'derived', keys: ['ResourceId = 公告卡池编号', 'Term.start = 公告开始时间'], playable: false }
}

export function withGashaAnnounceMovie(gasha, movieIndex) {
  const movie = gashaAnnounceMovie(gasha, movieIndex)
  return movie ? { ...gasha, announce_movie: movie } : gasha
}
