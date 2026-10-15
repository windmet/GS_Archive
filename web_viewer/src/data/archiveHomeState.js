import { storyCostumeLabel } from '../presentation/costumeSeries.js'
const RARITY_ORDER = new Map(['N', 'R', 'SR', 'SSR'].map((rarity, index) => [rarity, index]))

function resolveCharacterCards(cardsByCharacter, idolCode) {
  return (cardsByCharacter.get(idolCode) || [])
    .sort((left, right) => {
      const rarity = (RARITY_ORDER.get(left.rarity) ?? 99) - (RARITY_ORDER.get(right.rarity) ?? 99)
      if (rarity) return rarity
      return Number(left.ordinal || 0) - Number(right.ordinal || 0)
    })
}

// SystemScenarioData as the native decider reads it; Param1 is the draw weight, Param2 marks awakening.
function homeCondition(row) {
  if (!row) return null
  return {
    id: row.id,
    openMonth: row.open_month,
    closeMonth: row.close_month,
    openTime: row.open_time,
    closeTime: row.close_time,
    weight: row.param1,
    awakenedOnly: Boolean(row.param2),
    overrideId: row.override_idol_system_scenario_id || 0,
  }
}

function normalizeHomeCue(card, cue, conditions) {
  const preview = cue?.preview
  const previewStep = preview?.preview_step
  if (!preview || !previewStep?.state || !preview.voice) return null
  return {
    id: `${card.resource_id}:${cue.cue}`,
    source: 'card',
    condition: homeCondition(conditions?.get(`${card.card_id}:${cue.cue}`)),
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

// An idol's general HomeStand voice: no card, played from its script's jump point.
function normalizeIdolCue(row) {
  const previewStep = row?.preview_step
  if (!previewStep?.state || !row.voice) return null
  return {
    id: `idol:${row.script_label}`,
    source: 'idol',
    condition: homeCondition(row),
    cue: row.script_label,
    voice: row.voice,
    scenarioId: row.scenario_id || row.script_name || '',
    speaker: row.speaker || previewStep.dialogue?.speaker || '',
    text: row.text || previewStep.dialogue?.text || '',
    background: previewStep.state.bg || '',
    modelId: previewStep.state.spines?.[0]?.model || '',
    cardId: '',
    cardTitle: '',
    rarity: '',
    compiledFile: row.compiled_file || '',
    previewStep,
  }
}

function homeVoiceSources(systemVoiceData) {
  const idolCues = new Map((systemVoiceData?.idols || []).map(idol => [idol.idol_code,
    (idol.scenarios || []).map(normalizeIdolCue).filter(Boolean)]))
  const cardConditions = new Map(Object.values(systemVoiceData?.card_home_stand || {}).flat()
    .map(row => [`${row.card_id}:${row.script_label}`, row]))
  return { idolCues, cardConditions }
}

function buildCostumesByIdol(costumeDictionaryData) {
  const result = new Map()
  for (const costume of Object.values(costumeDictionaryData?.by_model_resource_id || {})) {
    // Unnamed story costumes join the home picker only under a verified series label.
    const name = String(costume?.costume_name || '').trim() || storyCostumeName(costume?.model_resource_id)
    if (!costume?.idol_code || costume.spine_exists !== true || !name) continue
    // A model draws the idol its id names; the twins' unnamed sportswear rows point at each other's model.
    const owner = String(costume.costume_name || '').trim() ? costume.idol_code : costume.model_resource_id.slice(0, 6)
    if (!result.has(owner)) result.set(owner, [])
    result.get(owner).push({
      id: costume.model_resource_id,
      modelId: costume.model_resource_id,
      name,
      description: String(costume.description || '').trim(),
      costumeId: costume.costume_id,
      releaseAt: costume.release_at,
      sourceTables: costume.source_tables || [],
      isSceneDefault: false,
      ...(String(costume.costume_name || '').trim() ? {} : { siteLabel: true }),
    })
  }
  for (const costumes of result.values()) costumes.sort((left, right) => left.modelId.localeCompare(right.modelId))
  return result
}

function storyCostumeName(modelId) {
  const series = storyCostumeLabel(modelId)
  return series ? `${series}（剧情）` : ''
}

// Home profiles prebuilt by an older read model lack the unnamed story costumes; merge src/data/storyCostumes.json.
export function withStoryCostumes(idol, storyCostumes = []) {
  if (!idol?.costumes) return idol
  const known = new Set(idol.costumes.map(costume => costume.modelId))
  const extra = storyCostumes.filter(costume => costume.idolCode === idol.id && !known.has(costume.modelId) && storyCostumeName(costume.modelId))
  if (!extra.length) return idol
  const added = extra.map(costume => ({
    id: costume.modelId, modelId: costume.modelId, name: storyCostumeName(costume.modelId), description: '',
    costumeId: costume.costumeId, releaseAt: costume.releaseAt, sourceTables: costume.sourceTables || [], isSceneDefault: false, siteLabel: true,
  }))
  const defaults = idol.costumes.filter(costume => costume.isSceneDefault)
  const rest = [...idol.costumes.filter(costume => !costume.isSceneDefault), ...added].sort((left, right) => left.modelId.localeCompare(right.modelId))
  return { ...idol, costumes: [...defaults, ...rest] }
}

export function buildArchiveHomeState(idolUnitData, cardIndexData, archiveManifestData, costumeDictionaryData = null, systemVoiceData = null) {
  if (!idolUnitData?.by_idol_code || !cardIndexData?.by_character) return []
  const cardsByCharacter = new Map()
  for (const card of cardIndexData.cards || []) {
    if (!cardsByCharacter.has(card.character_id)) cardsByCharacter.set(card.character_id, [])
    cardsByCharacter.get(card.character_id).push(card)
  }
  const memberships = archiveManifestData?.unit_membership_by_idol || {}
  const costumesByIdol = buildCostumesByIdol(costumeDictionaryData)
  const costumeModels = costumeDictionaryData?.by_model_resource_id
  const { idolCues, cardConditions } = homeVoiceSources(systemVoiceData)

  return Object.keys(cardIndexData.by_character)
    .map(idolCode => {
      const profile = idolUnitData.by_idol_code[idolCode]
      if (!profile) return null
      const membership = memberships[idolCode] || {}
      const cards = resolveCharacterCards(cardsByCharacter, idolCode)
      // 源表里不同记录 ID 可指向同一 cue，按 card+cue 身份去重（不按文本）。
      const seenCueIds = new Set()
      // The idol's general pool leads; each card's touch voices follow in card order.
      const cues = [...(idolCues.get(idolCode) || []), ...cards.flatMap(card => (card.home_voice_cues || [])
        .map(cue => normalizeHomeCue(card, cue, cardConditions))
        .filter(Boolean))]
        .filter(cue => !seenCueIds.has(cue.id) && seenCueIds.add(cue.id))
      if (!cues.length) return null
      const costumes = [...(costumesByIdol.get(idolCode) || [])]
      const knownModels = new Set(costumes.map(costume => costume.modelId))
      for (const modelId of new Set(cues.map(cue => cue.modelId).filter(Boolean))) {
        if (knownModels.has(modelId)) {
          // A labelled unnamed model the scene uses (047shu_002_00) keeps its label and still leads as the default.
          const index = costumes.findIndex(costume => costume.modelId === modelId && costume.siteLabel)
          if (index >= 0) costumes.unshift({ ...costumes.splice(index, 1)[0], isSceneDefault: true })
          continue
        }
        if (costumeModels && costumeModels[modelId]?.spine_exists !== true) continue
        costumes.unshift({
          id: modelId,
          modelId,
          name: '场景默认',
          description: '该模型由首页场景直接引用，原始服装表未提供名称。',
          costumeId: null,
          releaseAt: null,
          sourceTables: [],
          isSceneDefault: true,
        })
        knownModels.add(modelId)
      }
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
        costumes,
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
    cardCues: cues.filter(cue => cue.source === 'card').length,
    idolCues: cues.filter(cue => cue.source === 'idol').length,
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
