const RARITY_ORDER = new Map(['N', 'R', 'SR', 'SSR'].map((rarity, index) => [rarity, index]))

function resolveCharacterCards(cardsByCharacter, idolCode) {
  return (cardsByCharacter.get(idolCode) || [])
    .sort((left, right) => {
      const rarity = (RARITY_ORDER.get(left.rarity) ?? 99) - (RARITY_ORDER.get(right.rarity) ?? 99)
      if (rarity) return rarity
      return Number(left.ordinal || 0) - Number(right.ordinal || 0)
    })
}

function normalizeHomeCue(card, cue) {
  const preview = cue?.preview
  const previewStep = preview?.preview_step
  if (!preview || !previewStep?.state || !preview.voice) return null
  return {
    id: `${card.resource_id}:${cue.cue}`,
    cue: cue.cue,
    voice: preview.voice,
    scenarioId: preview.scenario_id || cue.scenario_base || '',
    speaker: preview.speaker || previewStep.dialogue?.speaker || '',
    text: preview.text || previewStep.dialogue?.text || '',
    background: previewStep.state.bg || '',
    modelId: previewStep.state.spines?.[0]?.model || '',
    cardId: card.resource_id,
    cardTitle: card.title || card.title_full || card.resource_id,
    rarity: card.rarity || '',
    compiledFile: preview.compiled_file || cue.compiled_file || '',
    previewStep,
  }
}

export function buildArchiveHomeState(idolUnitData, cardIndexData, archiveManifestData) {
  if (!idolUnitData?.by_idol_code || !cardIndexData?.by_character) return []
  const cardsByCharacter = new Map()
  for (const card of cardIndexData.cards || []) {
    if (!cardsByCharacter.has(card.character_id)) cardsByCharacter.set(card.character_id, [])
    cardsByCharacter.get(card.character_id).push(card)
  }
  const memberships = archiveManifestData?.unit_membership_by_idol || {}

  return Object.keys(cardIndexData.by_character)
    .map(idolCode => {
      const profile = idolUnitData.by_idol_code[idolCode]
      if (!profile) return null
      const membership = memberships[idolCode] || {}
      const cards = resolveCharacterCards(cardsByCharacter, idolCode)
      const cues = cards.flatMap(card => (card.home_voice_cues || [])
        .map(cue => normalizeHomeCue(card, cue))
        .filter(Boolean))
      if (!cues.length) return null
      return {
        id: idolCode,
        idolCode,
        idolId: profile.idol_id,
        name: profile.display_name,
        kana: profile.name_fields?.kana || '',
        color: profile.color || '#18a79d',
        unitId: membership.unit_id || profile.unit_id || '',
        unitCode: membership.unit_code || profile.unit_code || '',
        unitName: membership.unit_name || profile.unit_name || '',
        representativeBg: profile.representative_bg || cues[0].background,
        cues,
      }
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.idolId || 0) - Number(right.idolId || 0))
}

export function archiveHomeStateStats(idols) {
  const cues = idols.flatMap(idol => idol.cues || [])
  return {
    idols: idols.length,
    cues: cues.length,
    backgrounds: new Set(cues.map(cue => cue.background).filter(Boolean)).size,
    models: new Set(cues.map(cue => cue.modelId).filter(Boolean)).size,
    playable: cues.filter(cue => cue.voice && cue.compiledFile).length,
  }
}

const EVENT_SCOPE_LABELS = {
  fixed_unit_event: '固定组合团活',
  attribute_event: '属性团曲',
  mixed_unit_event: '跨组合团活',
}

export function buildArchiveHomeHighlights(archiveManifestData, uiAssetCatalogData) {
  const bannerUrls = uiAssetCatalogData?.featured_sets?.event_banner_urls || {}
  return (archiveManifestData?.unit_event_relations || [])
    .filter(event => event?.exists && event?.event_id && bannerUrls[event.event_code])
    .map(event => ({
      ...event,
      id: String(event.event_id),
      bannerUrl: bannerUrls[event.event_code],
      scopeLabel: EVENT_SCOPE_LABELS[event.event_scope] || '活动剧情',
    }))
    .sort((left, right) => Number(right.release_at || 0) - Number(left.release_at || 0))
}
