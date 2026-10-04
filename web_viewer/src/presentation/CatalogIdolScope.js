// Keep directory filters and portal footprints on the same source relationships.
export function songMatchesIdol(row, idol) {
  return !idol || Boolean((idol.unitName && row.performance?.unitName === idol.unitName) ||
    row.performance?.performers?.some(member => member.id === idol.id))
}

export function storyMatchesIdol(row, idol) {
  return !idol || Boolean(row.characters?.includes(idol.id))
}

export function idolEventIds(detail) {
  return new Set((detail?.view?.events || []).map(row => String(row.event_id)))
}

export function eventMatchesIdol(row, idol, eventIds = new Set()) {
  return !idol || eventIds.has(String(row.id)) || Boolean(row.resources?.storyCast?.includes(idol.id))
}

export function cardAttribute(row, facets, release) {
  const facet = facets?.release === release ? facets.cards?.[row.resource_id] : null
  return facet?.detailSha256 === row.detail?.sha256 && ['Physical','Intelligence','Mental'].includes(facet.attribute) ? facet.attribute : ''
}
