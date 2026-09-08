import { cardsForCharacter } from './archiveSelectors.js'

export function buildIdolProfile(id, dictionary, manifest) {
  const profile = dictionary?.by_idol_code?.[id]
  if (!profile) return null
  const unit = manifest?.unit_membership_by_idol?.[id]
  return {
    ...profile,
    idol_code: id,
    unit_id: unit?.unit_id || profile.unit_id,
    unit_code: unit?.unit_code || profile.unit_code,
    unit_name: unit?.unit_name || profile.unit_name,
  }
}

export function buildIdolStats(id, { cardIndex, cardMap = new Map(), episodes, mobile } = {}) {
  const chapter = episodes?.by_idol_code?.[id]?.[0]
  const mobileById = new Map((mobile?.scenarios || []).map(scenario => [scenario.id, scenario]))
  const mobileScenarios = (mobile?.by_idol_code?.[id] || []).map(scenarioId => mobileById.get(scenarioId)).filter(Boolean)
  return {
    cards: cardsForCharacter(cardIndex, cardMap, id).length,
    stories: (chapter?.sections || []).reduce((sum, section) => sum + (section.episodes?.length || 0), 0),
    chats: mobileScenarios.filter(scenario => scenario.kind === 'idol_talk').length,
    phones: mobileScenarios.filter(scenario => scenario.kind === 'idol_phone').length,
  }
}

export function eventsForIdol(id, manifest) {
  return (manifest?.unit_event_relations || [])
    .filter(event => (event.characters || []).includes(id))
    .sort((left, right) => Number(left.release_at || 0) - Number(right.release_at || 0))
}

export function songsForIdol(id, catalog) {
  return Object.values(catalog?.songs || {})
    .filter(song => (song.performance_mapping?.performer_idol_codes || []).includes(id))
    .map(song => ({
      song,
      evidenceLabel: song.performance_mapping.performer_basis === 'table46_explicit'
        ? '表 46 明确演唱／参演'
        : '由正式组合归属补全',
    }))
    .sort((left, right) => Number(left.song.song_id || 0) - Number(right.song.song_id || 0))
}
