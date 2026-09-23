export { buildStoryCatalog, STORY_DOMAIN_LABELS } from './storyCatalog.js'
export { buildScenarioMetaByFile } from './storyFileMetadata.js'

export function buildCardMap(cardIndexData) {
  const map = new Map()
  for (const card of cardIndexData?.cards || []) {
    if (!card?.resource_id) continue
    const current = map.get(card.resource_id)
    if (!current || cardPreferenceScore(card) > cardPreferenceScore(current)) {
      map.set(card.resource_id, normalizeCard(card))
    }
  }
  return map
}

function cardPreferenceScore(card) {
  const tutorial = /^チュートリアル/.test(String(card?.title || '')) || Number(card?.card_id || 0) >= 90000000
  return (tutorial ? 0 : 100) +
    (card?.home_voice_cues?.length || 0) +
    (card?.scenario_entries?.length || 0)
}

function uniqueBy(items, keyFor) {
  const seen = new Set()
  return (items || []).filter(item => {
    const key = keyFor(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizeCard(card) {
  const unmappedVoices = uniqueBy(
    card.voice_candidates?.unmapped_card_only,
    item => typeof item === 'string' ? item : item?.cue,
  )
  const allVoices = new Set(card.voice_candidates?.all || [])
  const normalTextVoice = card.voice_base ? `${card.voice_base}_01_01` : ''
  const awakenedTextVoice = card.voice_base ? `${card.voice_base}_01_09` : ''
  const cardTextVoices = {
    normal: allVoices.has(normalTextVoice) ? normalTextVoice : '',
    awakened: allVoices.has(awakenedTextVoice) ? awakenedTextVoice : '',
  }
  const singleState = !cardTextVoices.normal && Boolean(cardTextVoices.awakened)
  const mappedTextVoices = new Set(Object.values(cardTextVoices).filter(Boolean))
  return {
    ...card,
    card_text_voices: cardTextVoices,
    single_state: singleState,
    home_voice_cues: uniqueBy(card.home_voice_cues, item => item?.cue),
    scenario_entries: uniqueBy(card.scenario_entries, item => item?.resource_id || item?.compiled_file),
    voice_candidates: card.voice_candidates
      ? {
          ...card.voice_candidates,
          unmapped_card_only: unmappedVoices.filter(item => !mappedTextVoices.has(item)),
        }
      : card.voice_candidates,
  }
}

export function mergeCardDetail(card, cardDetailIndex) {
  if (!card?.resource_id || !cardDetailIndex) return card
  const detail = cardDetailIndex.cards_by_resource_id?.[card.resource_id]
  if (!detail) return card
  const gameplay = detail.gameplay
    ? {
        ...detail.gameplay,
        skill: cardDetailIndex.skills_by_id?.[detail.gameplay.skill_id] || null,
        center_skill: cardDetailIndex.center_skills_by_id?.[detail.gameplay.center_skill_id] || null,
      }
    : null
  const costumeRelations = (detail.costume_relations || []).map(relation => ({
    ...cardDetailIndex.costumes_by_key?.[relation.costume_key],
    ...relation,
  }))
  return {
    ...card,
    limitbreak_item: cardDetailIndex.items_by_id?.[card.limitbreak_item_id] || null,
    gameplay,
    costume_relations: costumeRelations,
    operational_voice_cues: detail.operational_voice_cues || [],
  }
}

export function cardsForCharacter(cardIndexData, cardMap, characterId) {
  const ids = [...new Set(cardIndexData?.by_character?.[characterId] || [])]
  return ids.map(id => cardMap.get(id)).filter(Boolean)
}

export function buildUnitCardSummary(cardMap, memberCodes) {
  const members = new Set(memberCodes || [])
  const cards = [...(cardMap?.values?.() || [])]
    .filter(card => members.has(card.character_id))
    .sort((a, b) => Number(a.card_id || 0) - Number(b.card_id || 0))
  const rarityCounts = {}
  for (const card of cards) {
    const rarity = card.rarity || 'CARD'
    rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1
  }
  return {
    cards,
    total: cards.length,
    rarity_counts: rarityCounts,
    cards_with_story: cards.filter(card => card.scenario_entries?.length).length,
    single_state: cards.filter(card => card.single_state).length,
  }
}

export function buildCardRarityTabs(cards) {
  const order = ['SSR', 'SR', 'R', 'N']
  const counts = new Map()
  for (const card of cards) {
    const rarity = card.rarity || 'CARD'
    counts.set(rarity, (counts.get(rarity) || 0) + 1)
  }
  const tabs = [{ id: 'all', label: 'All', count: cards.length }]
  for (const rarity of order) {
    if (counts.has(rarity)) tabs.push({ id: rarity, label: rarity, count: counts.get(rarity) })
  }
  for (const [rarity, count] of [...counts.entries()].sort()) {
    if (!order.includes(rarity)) tabs.push({ id: rarity, label: rarity, count })
  }
  return tabs
}
