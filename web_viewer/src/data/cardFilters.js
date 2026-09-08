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
  if (state === 'card_story') return Boolean(card?.scenario_entries?.length)
  if (state === 'event_card') return Boolean(eventRelations?.[card?.resource_id])
  if (state === 'gasha_card') return Boolean(gashaRelations?.[card?.resource_id])
  if (state === 'release_series') return Boolean(card?.release_series)
  if (state === 'unrelated') {
    return !card?.scenario_entries?.length &&
      !card?.release_series &&
      !eventRelations?.[card?.resource_id] &&
      !gashaRelations?.[card?.resource_id]
  }
  return true
}

export function filterArchiveCards(cards, { query = '', rarity = 'all', assetState = 'all', relationState = 'all', assets, eventRelations, gashaRelations } = {}) {
  const q = query.toLowerCase()
  return cards.filter(card =>
    (rarity === 'all' || card.rarity === rarity) &&
    matchesCardAssetState(assets?.[card.resource_id], assetState) &&
    matchesCardRelationState(card, relationState, { eventRelations, gashaRelations }) &&
    (!q ||
    String(card.title || '').toLowerCase().includes(q) ||
    String(card.resource_id || '').toLowerCase().includes(q) ||
    String(card.rarity || '').toLowerCase().includes(q))
  )
}
