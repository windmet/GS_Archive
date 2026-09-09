import { buildUnitCardSummary } from './archiveSelectors.js'

// Membership evidence owns the roster; dictionaries supply display metadata.
export function buildUnitCatalog(dictionary, { manifest, cardMap = new Map(), stories = [] } = {}) {
  return (dictionary?.units || []).map(unit => {
    const unitId = String(unit.unit_id)
    const members = Object.entries(manifest?.unit_membership_by_idol || {})
      .filter(([, evidence]) => String(evidence.unit_id) === unitId)
      .map(([idolCode]) => ({ idol_code: idolCode, ...dictionary?.by_idol_code?.[idolCode] }))
      .sort((a, b) => Number(a.idol_id || 0) - Number(b.idol_id || 0))
    return {
      unit,
      members,
      storyCount: stories.filter(entry => entry.domain === 'unit_story' && entry.unitId === unitId).length,
      cardStats: buildUnitCardSummary(cardMap, members.map(member => member.idol_code)),
      eventRelations: manifest?.unit_event_relations_by_unit?.[unitId] || {
        team_events: [], attribute_event_appearances: [], mixed_unit_appearances: [],
      },
    }
  })
}

export function resolveArchiveUnit(dictionary, id) {
  return (dictionary?.units || []).find(unit =>
    String(unit.unit_code) === id || String(unit.unit_id) === id,
  ) || null
}

export function storiesForUnit(unit, stories = []) {
  const id = String(unit?.unit_id || '')
  return stories.filter(entry => entry.domain === 'unit_story' && entry.unitId === id)
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId))
}

export function songsForUnit(unit, catalog) {
  const id = Number(unit?.unit_id || 0)
  return Object.values(catalog?.songs || {})
    .filter(song => song.performance_mapping?.confirmed_unit?.unit_id === id)
    .sort((a, b) => Number(a.song_id || 0) - Number(b.song_id || 0))
}
