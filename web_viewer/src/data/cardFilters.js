function matchesCardAssetState(status, state) {
  if (state === 'all') return true
  if (!status) return false
  if (state === 'visible_icon') return status.awakened_icon || status.normal_icon
  if (state === 'complete_icons') return status.awakened_icon && status.normal_icon
  if (state === 'single_state') return status.single_state
  if (state === 'has_large') {
    return status.awakened_portrait || status.normal_portrait ||
      status.awakened_landscape || status.normal_landscape ||
      status.awakened_large || status.normal_large
  }
  if (state === 'missing_normal') return !status.normal_icon && !status.single_state
  return true
}

function matchesCardRelationState(card, state, { eventRelations, gashaRelations } = {}) {
  if (state === 'all') return true
  if (state === 'card_story') return Boolean(card?.has_story ?? card?.scenario_entries?.length)
  if (state === 'event_card') return Boolean(card?.has_event_relation ?? eventRelations?.[card?.resource_id])
  if (state === 'gasha_card') return Boolean(card?.has_gasha_relation ?? gashaRelations?.[card?.resource_id])
  if (state === 'release_series') return Boolean(card?.has_release_series ?? card?.release_series)
  if (state === 'unrelated') {
    return !matchesCardRelationState(card, 'card_story', { eventRelations, gashaRelations }) &&
      !matchesCardRelationState(card, 'release_series', { eventRelations, gashaRelations }) &&
      !matchesCardRelationState(card, 'event_card', { eventRelations, gashaRelations }) &&
      !matchesCardRelationState(card, 'gasha_card', { eventRelations, gashaRelations })
  }
  return true
}

export function filterArchiveCards(cards, { query = '', rarity = 'all', assetState = 'all', relationState = 'all', assets, eventRelations, gashaRelations } = {}) {
  const q = query.toLowerCase()
  return cards.filter(card =>
    (rarity === 'all' || card.rarity === rarity) &&
    matchesCardAssetState(card.asset_status || assets?.[card.resource_id], assetState) &&
    matchesCardRelationState(card, relationState, { eventRelations, gashaRelations }) &&
    (!q ||
    String(card.title || '').toLowerCase().includes(q) ||
    String(card.resource_id || '').toLowerCase().includes(q) ||
    String(card.rarity || '').toLowerCase().includes(q))
  )
}
