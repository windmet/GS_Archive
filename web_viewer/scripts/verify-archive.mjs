import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(projectRoot, 'public')
const compiledRoot = path.join(publicRoot, 'data', 'compiled')
const voiceRoot = path.join(publicRoot, 'assets', 'voice')
const SAMPLE_LIMIT = 60

async function listFiles(directory, predicate = () => true) {
  const files = []
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true })
    await Promise.all(entries.map(async entry => {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile() && predicate(entry.name)) files.push(target)
    }))
  }
  await visit(directory)
  return files.sort()
}

function ratio(available, total) {
  return total ? Number((available / total).toFixed(4)) : 0
}

function voiceFilenameCandidates(voiceFile, scenarioId) {
  if (!voiceFile) return []
  if (voiceFile.includes('_') || !scenarioId) return [voiceFile]

  let parts = scenarioId.replace(/^scenario_/, '').split('_')
  if (/^\d{3}[a-z]{3}$/.test(parts[0])) parts = parts.slice(1)
  const prefixes = [parts, parts.slice(-4)]
  if (/^[a-z]$/i.test(parts.at(-1)) && voiceFile.startsWith(parts.at(-1))) {
    prefixes.push(parts.slice(0, -1), parts.slice(-5, -1))
  }
  return [...new Set(prefixes.filter(value => value.length).map(value => `${value.join('_')}_${voiceFile}`))]
}

function relationRecords(cardIndex, field) {
  return (cardIndex.cards || []).flatMap(card =>
    (card[field] || []).map(record => ({ card: card.resource_id, ...record })),
  )
}

const [compiledFiles, voiceEntries, gashaBannerFiles, cardIndex, cardDetailIndex, storyMaster, gashaAnnouncementIndex, gashaIndex, archiveManifest] = await Promise.all([
  listFiles(compiledRoot, name => name.endsWith('.json') && !['index.json', 'manifest.json', 'voice_index.json'].includes(name)),
  readdir(voiceRoot, { withFileTypes: true }),
  listFiles(path.join(publicRoot, 'assets', 'gasha'), name => name.endsWith('.png')),
  readFile(path.join(publicRoot, 'data', 'masterdata', 'card_index.json'), 'utf8').then(JSON.parse),
  readFile(path.join(publicRoot, 'data', 'masterdata', 'card_detail_index.json'), 'utf8').then(JSON.parse),
  readFile(path.join(publicRoot, 'data', 'masterdata', 'story_master_index.json'), 'utf8').then(JSON.parse),
  readFile(path.join(publicRoot, 'data', 'masterdata', 'gasha_announcement_index.json'), 'utf8').then(JSON.parse),
  readFile(path.join(publicRoot, 'data', 'masterdata', 'gasha_index.json'), 'utf8').then(JSON.parse),
  readFile(path.join(publicRoot, 'data', 'archive_manifest.json'), 'utf8').then(JSON.parse),
])

const voiceNames = new Set(voiceEntries.filter(entry => entry.isFile()).map(entry => entry.name))
const compiledRelativeNames = new Set(compiledFiles.map(file => path.relative(compiledRoot, file).replaceAll('\\', '/')))
const compiledBasenames = new Set(compiledFiles.map(file => path.basename(file)))
const parseFailures = []
const schemaFailures = []
const createVoiceStats = () => ({
  references: 0,
  available: 0,
  scenariosWithVoice: 0,
  uniqueResolved: new Set(),
  missingSamples: [],
})
const canonicalVoiceStats = createVoiceStats()
const auxiliaryVoiceStats = createVoiceStats()
let parsedFiles = 0
let validScenarioFiles = 0
let totalSteps = 0

for (const file of compiledFiles) {
  const relativeFile = path.relative(compiledRoot, file).replaceAll('\\', '/')
  let scenario
  try {
    scenario = JSON.parse(await readFile(file, 'utf8'))
    parsedFiles += 1
  } catch (error) {
    if (parseFailures.length < SAMPLE_LIMIT) parseFailures.push({ file: relativeFile, reason: error.message })
    continue
  }

  if (!scenario || typeof scenario.scenario_id !== 'string' || !Array.isArray(scenario.steps)) {
    if (schemaFailures.length < SAMPLE_LIMIT) {
      schemaFailures.push({
        file: relativeFile,
        reason: !scenario?.scenario_id ? 'missing scenario_id' : 'steps is not an array',
      })
    }
    continue
  }

  validScenarioFiles += 1
  totalSteps += scenario.steps.length
  const voiceStats = relativeFile.includes('/') ? auxiliaryVoiceStats : canonicalVoiceStats
  let hasVoice = false
  for (const step of scenario.steps) {
    const rawVoice = step?.dialogue?.voice
    if (!rawVoice) continue
    hasVoice = true
    voiceStats.references += 1
    const candidates = voiceFilenameCandidates(String(rawVoice), scenario.scenario_id)
    const resolved = candidates.find(name => voiceNames.has(name)) || candidates[0] || String(rawVoice)
    voiceStats.uniqueResolved.add(resolved)
    if (voiceNames.has(resolved)) voiceStats.available += 1
    else if (voiceStats.missingSamples.length < SAMPLE_LIMIT) {
      voiceStats.missingSamples.push({ file: relativeFile, step: step.step_id, raw: rawVoice, candidates })
    }
  }
  if (hasVoice) voiceStats.scenariosWithVoice += 1
}

function serializeVoiceStats(stats) {
  return {
    references: stats.references,
    available: stats.available,
    missing: stats.references - stats.available,
    ratio: ratio(stats.available, stats.references),
    scenarios_with_voice: stats.scenariosWithVoice,
    unique_resolved_files: stats.uniqueResolved.size,
    unique_available_files: [...stats.uniqueResolved].filter(name => voiceNames.has(name)).length,
    missing_samples: stats.missingSamples,
  }
}

const homeVoiceRecords = relationRecords(cardIndex, 'home_voice_cues')
const missingHomeVoices = []
let availableHomeVoices = 0
for (const record of homeVoiceRecords) {
  const filename = record.cue ? `${record.cue}.m4a` : ''
  if (filename && voiceNames.has(filename)) availableHomeVoices += 1
  else if (missingHomeVoices.length < SAMPLE_LIMIT) missingHomeVoices.push({ card: record.card, cue: record.cue || '' })
}

const cardScenarioRecords = relationRecords(cardIndex, 'scenario_entries')
const missingCardScenarios = []
let availableCardScenarios = 0
for (const record of cardScenarioRecords) {
  const filename = String(record.compiled_file || '').replace(/^\/?data\/compiled\//, '')
  const exists = filename && (compiledRelativeNames.has(filename) || compiledBasenames.has(path.basename(filename)))
  if (exists) availableCardScenarios += 1
  else if (missingCardScenarios.length < SAMPLE_LIMIT) {
    missingCardScenarios.push({ card: record.card, compiled_file: filename })
  }
}

function cardPreferenceScore(card) {
  const tutorial = /^チュートリアル/.test(String(card?.title || '')) || Number(card?.card_id || 0) >= 90000000
  return (tutorial ? 0 : 100) +
    (card?.home_voice_cues?.length || 0) +
    (card?.scenario_entries?.length || 0)
}

const canonicalCardsById = new Map()
for (const card of cardIndex.cards || []) {
  const current = canonicalCardsById.get(card.resource_id)
  if (!current || cardPreferenceScore(card) > cardPreferenceScore(current)) {
    canonicalCardsById.set(card.resource_id, card)
  }
}
const canonicalCards = [...canonicalCardsById.values()]
const releaseSeriesGroups = new Map()
for (const card of canonicalCards.filter(card => card.release_series)) {
  const seriesId = card.release_series.series_id
  if (!releaseSeriesGroups.has(seriesId)) releaseSeriesGroups.set(seriesId, [])
  releaseSeriesGroups.get(seriesId).push(card)
}
const releaseSeriesFailures = []
let validReleaseSeries = 0
for (const [seriesId, cards] of releaseSeriesGroups) {
  const relation = cards[0].release_series
  const resourceIds = new Set(cards.map(card => card.resource_id))
  const characterIds = new Set(cards.map(card => card.character_id))
  const valid = cards.every(card =>
    card.release_at === relation.release_at &&
    card.title === relation.title &&
    card.release_series.series_id === seriesId
  ) && relation.card_count === resourceIds.size && relation.character_count === characterIds.size
  if (valid) validReleaseSeries += 1
  else if (releaseSeriesFailures.length < SAMPLE_LIMIT) {
    releaseSeriesFailures.push({
      series_id: seriesId,
      declared_cards: relation.card_count,
      actual_cards: resourceIds.size,
      declared_characters: relation.character_count,
      actual_characters: characterIds.size,
    })
  }
}

function sameValues(left, right) {
  const a = [...new Set(left)].sort()
  const b = [...new Set(right)].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

const SPECIAL_EVENT_CLASSIFICATIONS = new Map([
  ['430006', { event_scope: 'attribute_event', attribute: 'INTELLIGENCE' }],
  ['430007', { event_scope: 'attribute_event', attribute: 'PHYSICAL' }],
  ['430008', { event_scope: 'attribute_event', attribute: 'MENTAL' }],
  ['410017', { event_scope: 'mixed_unit_event', attribute: '' }],
  ['410018', { event_scope: 'mixed_unit_event', attribute: '' }],
])

const membership = archiveManifest.unit_membership_by_idol || {}
const membersByUnit = new Map()
for (const [idolCode, evidence] of Object.entries(membership)) {
  const unitId = String(evidence.unit_id)
  if (!membersByUnit.has(unitId)) membersByUnit.set(unitId, [])
  membersByUnit.get(unitId).push(idolCode)
}
const eventGroups = new Map((storyMaster.event?.groups || []).map(group => [String(group['1']), group]))
const eventEpisodes = new Map()
for (const episode of storyMaster.event?.episodes || []) {
  const groupId = String(episode['2'])
  if (!eventEpisodes.has(groupId)) eventEpisodes.set(groupId, [])
  eventEpisodes.get(groupId).push(episode)
}
const unitEventFailures = []
let validUnitEvents = 0
for (const relation of archiveManifest.unit_event_relations || []) {
  const groupId = String(relation.event_group_id)
  const group = eventGroups.get(groupId)
  const episodes = eventEpisodes.get(groupId) || []
  const actualCharacters = [...new Set(episodes.flatMap(episode => episode.compiled_summary?.characters || []))]
    .filter(idolCode => membership[idolCode])
  const actualUnitIds = [...new Set(actualCharacters.map(idolCode => String(membership[idolCode].unit_id)))]
  const actualFiles = [...new Set(episodes.map(episode => episode.compiled_file).filter(Boolean))]
  const exactUnitId = [...membersByUnit.entries()].find(([, members]) => sameValues(members, actualCharacters))?.[0] || ''
  const specialClassification = SPECIAL_EVENT_CLASSIFICATIONS.get(String(relation.event_id))
  const expectedScope = exactUnitId ? 'fixed_unit_event' : (specialClassification?.event_scope || 'unclassified_cross_unit')
  const valid = group &&
    String(group['2']) === String(relation.event_id) &&
    group['9'] === relation.title &&
    group['10'] === relation.release_at &&
    sameValues(actualCharacters, relation.characters || []) &&
    sameValues(actualUnitIds, relation.participating_unit_ids || []) &&
    exactUnitId === String(relation.unit_id || '') &&
    (actualFiles[0] || '') === (relation.file || '') &&
    relation.event_scope === expectedScope &&
    relation.attribute === (specialClassification?.attribute || '') &&
    relation.relation_type === (exactUnitId ? 'exact_compiled_character_roster' : 'confirmed_cross_unit_event_classification')
  if (valid) validUnitEvents += 1
  else if (unitEventFailures.length < SAMPLE_LIMIT) {
    unitEventFailures.push({ relation, actualCharacters, actualUnitIds, actualFiles, exactUnitId })
  }
}

const canonicalCardByResource = new Map(canonicalCards.map(card => [card.resource_id, card]))
const manifestEventById = new Map((archiveManifest.unit_event_relations || []).map(event => [String(event.event_id), event]))
const gashaAnnouncementById = new Map((gashaAnnouncementIndex.announcements || []).map(item => [String(item.announcement_id), item]))
const confirmedGashaTitles = new Map(Object.entries(gashaIndex.by_code || {}).map(([code, gasha]) => [code, gasha.title || '']))
const gashaCardFailures = []
let validGashaCardRelations = 0
for (const [resourceId, relation] of Object.entries(archiveManifest.gasha_card_relations_by_card || {})) {
  const card = canonicalCardByResource.get(resourceId)
  const announcement = gashaAnnouncementById.get(String(relation.announcement_id))
  const valid = card && announcement &&
    card.resource_id === relation.card_resource_id &&
    card.card_id === relation.card_id &&
    card.character_id === relation.character_id &&
    card.rarity === relation.rarity &&
    card.limitbreak_item_id === relation.limitbreak_item_id &&
    card.release_at === relation.start_at &&
    announcement.start_at === relation.start_at &&
    announcement.end_at === relation.end_at &&
    announcement.gasha_code === relation.gasha_code &&
    relation.title === (confirmedGashaTitles.get(String(relation.gasha_code)) || '') &&
    relation.title_source === (relation.title ? 'curated' : '') &&
    announcement.asset_prefix === relation.asset_prefix &&
    relation.relation_type === 'limitbreak_item_and_exact_gasha_start_timestamp' &&
    relation.evidence_level === 'derived'
  if (valid) validGashaCardRelations += 1
  else if (gashaCardFailures.length < SAMPLE_LIMIT) gashaCardFailures.push({ resourceId, relation, card, announcement })
}
const gashaStarts = new Map()
for (const announcement of gashaAnnouncementIndex.announcements || []) {
  if (!gashaStarts.has(announcement.start_at)) gashaStarts.set(announcement.start_at, [])
  gashaStarts.get(announcement.start_at).push(announcement)
}
const expectedGashaCardIds = canonicalCards
  .filter(card => Number.isFinite(card.limitbreak_item_id) && (gashaStarts.get(card.release_at) || []).length === 1)
  .map(card => card.resource_id)
  .sort()
const actualGashaCardIds = Object.keys(archiveManifest.gasha_card_relations_by_card || {}).sort()
if (!sameValues(expectedGashaCardIds, actualGashaCardIds) && gashaCardFailures.length < SAMPLE_LIMIT) {
  gashaCardFailures.push({
    reason: 'derived gasha-card id set differs from manifest',
    expected_count: expectedGashaCardIds.length,
    actual_count: actualGashaCardIds.length,
    missing: expectedGashaCardIds.filter(id => !actualGashaCardIds.includes(id)).slice(0, SAMPLE_LIMIT),
    unexpected: actualGashaCardIds.filter(id => !expectedGashaCardIds.includes(id)).slice(0, SAMPLE_LIMIT),
  })
}
const gashaBannerNames = new Set(gashaBannerFiles.map(file => path.basename(file)))
const gashaEntityFailures = []
let validGashaEntities = 0
for (const gasha of gashaIndex.gashas || []) {
  const announcement = gashaAnnouncementById.get(String(gasha.announcement_id))
  const relationCards = gashaIndex.relations_by_gasha?.[String(gasha.id)] || []
  const valid = announcement &&
    String(gasha.id) === String(gasha.announcement_id) &&
    String(gasha.code) === String(announcement.gasha_code) &&
    gasha.start_at === announcement.start_at &&
    gasha.end_at === announcement.end_at &&
    gasha.asset_prefix === announcement.asset_prefix &&
    gasha.banner_file === `${announcement.asset_prefix}01.png` &&
    gashaBannerNames.has(gasha.banner_file) &&
    gasha.name_known === true &&
    Boolean(gasha.title) &&
    Boolean(gasha.category) &&
    Boolean(gasha.logical_id) &&
    ['primary', 'final_day'].includes(gasha.phase) &&
    sameValues(
      relationCards.map(item => item.card_resource_id).sort(),
      (gasha.derived_pickup_cards || []).map(item => item.card_resource_id).sort(),
    )
  if (valid) validGashaEntities += 1
  else if (gashaEntityFailures.length < SAMPLE_LIMIT) gashaEntityFailures.push({ gasha, announcement, relationCards })
}
const gashaCodes = (gashaIndex.gashas || []).map(item => item.code)
const gashaIds = (gashaIndex.gashas || []).map(item => item.id)
if (new Set(gashaCodes).size !== gashaCodes.length || new Set(gashaIds).size !== gashaIds.length) {
  gashaEntityFailures.push({ reason: 'duplicate gasha code or id' })
}
const logicalGashaIds = new Set((gashaIndex.gashas || []).map(item => item.logical_id))
const primaryGashas = (gashaIndex.gashas || []).filter(item => item.phase === 'primary')
const finalDayGashas = (gashaIndex.gashas || []).filter(item => item.phase === 'final_day')
const expectedCategoryCounts = {
  standard_pickup: 49,
  growing_fes: 4,
  stage_step_up: 2,
  full_roster_series: 2,
}
const finalDayGroupsValid = finalDayGashas.every(item =>
  item.category === 'growing_fes' &&
  item.primary_code &&
  item.logical_member_codes?.includes(item.primary_code) &&
  item.derived_pickup_cards?.length === 0 &&
  item.related_pickup_count === 3 &&
  item.related_pickup_card_ids?.length === 3
)
const categoryCountsValid = Object.entries(expectedCategoryCounts).every(
  ([category, count]) => gashaIndex.meta?.category_counts?.[category] === count,
)
const stageReprint = gashaIndex.by_code?.['1000051']
const stageReprintValid = stageReprint?.is_reprint === true &&
  stageReprint.reprint_of === '1000011' &&
  stageReprint.derived_pickup_cards?.length === 0 &&
  stageReprint.related_pickup_source === 'reprint' &&
  stageReprint.related_pickup_count === 49 &&
  stageReprint.related_pickup_card_ids?.length === 49
if (
  gashaIndex.schema_version !== 2 ||
  gashaIndex.meta?.named_count !== 61 ||
  gashaIndex.meta?.logical_gasha_count !== 57 ||
  logicalGashaIds.size !== 57 ||
  primaryGashas.length !== 57 ||
  finalDayGashas.length !== 4 ||
  !finalDayGroupsValid ||
  !stageReprintValid ||
  !categoryCountsValid
) {
  gashaEntityFailures.push({
    reason: 'gasha normalization summary differs from expected archive evidence',
    named: gashaIndex.meta?.named_count,
    logical: logicalGashaIds.size,
    primary: primaryGashas.length,
    final_day: finalDayGashas.length,
    final_day_groups_valid: finalDayGroupsValid,
    stage_reprint_valid: stageReprintValid,
    category_counts: gashaIndex.meta?.category_counts,
  })
}
const eventCardFailures = []
let validEventCardRelations = 0
for (const [resourceId, relation] of Object.entries(archiveManifest.event_card_relations_by_card || {})) {
  const card = canonicalCardByResource.get(resourceId)
  const event = manifestEventById.get(String(relation.event_id))
  const valid = card && event &&
    card.resource_id === relation.card_resource_id &&
    card.card_id === relation.card_id &&
    card.character_id === relation.character_id &&
    card.rarity === relation.rarity &&
    card.release_at === relation.release_at &&
    event.release_at === relation.release_at &&
    event.characters.includes(card.character_id) &&
    event.title === relation.title &&
    event.file === relation.file &&
    relation.relation_type === 'exact_release_timestamp_and_event_character_roster'
  if (valid) validEventCardRelations += 1
  else if (eventCardFailures.length < SAMPLE_LIMIT) eventCardFailures.push({ resourceId, relation, card, event })
}
const expectedEventCardIds = canonicalCards
  .filter(card => !actualGashaCardIds.includes(card.resource_id) && (archiveManifest.unit_event_relations || []).some(event =>
    event.release_at === card.release_at && event.characters.includes(card.character_id),
  ))
  .map(card => card.resource_id)
  .sort()
const actualEventCardIds = Object.keys(archiveManifest.event_card_relations_by_card || {}).sort()
if (!sameValues(expectedEventCardIds, actualEventCardIds) && eventCardFailures.length < SAMPLE_LIMIT) {
  eventCardFailures.push({
    reason: 'derived event-card id set differs from manifest',
    expected_count: expectedEventCardIds.length,
    actual_count: actualEventCardIds.length,
    missing: expectedEventCardIds.filter(id => !actualEventCardIds.includes(id)).slice(0, SAMPLE_LIMIT),
    unexpected: actualEventCardIds.filter(id => !expectedEventCardIds.includes(id)).slice(0, SAMPLE_LIMIT),
  })
}

const cardDetailFailures = []
let validCardDetails = 0
for (const card of canonicalCards) {
  const detail = cardDetailIndex.cards_by_resource_id?.[card.resource_id]
  if (!detail) {
    if (cardDetailFailures.length < SAMPLE_LIMIT) cardDetailFailures.push({ card: card.resource_id, reason: 'missing detail' })
    continue
  }
  const skillId = detail.gameplay?.skill_id
  const centerSkillId = detail.gameplay?.center_skill_id
  const missingCostumes = (detail.costume_relations || [])
    .filter(relation => !cardDetailIndex.costumes_by_key?.[relation.costume_key])
    .map(relation => relation.costume_key)
  const missingVoices = (detail.operational_voice_cues || [])
    .filter(cue => !voiceNames.has(`${cue.cue}.m4a`))
    .map(cue => cue.cue)
  const valid = detail.gameplay?.attribute?.name &&
    (!skillId || cardDetailIndex.skills_by_id?.[skillId]) &&
    (!centerSkillId || cardDetailIndex.center_skills_by_id?.[centerSkillId]) &&
    missingCostumes.length === 0 && missingVoices.length === 0
  if (valid) validCardDetails += 1
  else if (cardDetailFailures.length < SAMPLE_LIMIT) {
    cardDetailFailures.push({ card: card.resource_id, skillId, centerSkillId, missingCostumes, missingVoices })
  }
}

const renCard = canonicalCardByResource.get('040ren_ssr02')
const renDetail = cardDetailIndex.cards_by_resource_id?.['040ren_ssr02']
const renSkill = cardDetailIndex.skills_by_id?.[renDetail?.gameplay?.skill_id]
const renCostumeModels = new Set((renDetail?.costume_relations || []).map(relation =>
  cardDetailIndex.costumes_by_key?.[relation.costume_key]?.model_resource_id,
))
const renSampleValid = renCard && renDetail &&
  renDetail.gameplay?.attribute?.name === 'Physical' && renDetail.gameplay?.life === 40 &&
  renDetail.gameplay?.appeal?.initial === 6801 && renDetail.gameplay?.appeal?.max_unlimit === 7140 &&
  renDetail.gameplay?.appeal?.max_limitbreak === 8496 &&
  renSkill?.levels?.[0]?.description === '13秒ごとに30％の確率で7秒間、PERFECT/GREATのスコアが29％アップし、GREATをPERFECTにする' &&
  renCard.scenario_entries?.some(entry => entry.resource_id === '2_4_040_02_09_c') &&
  renDetail.operational_voice_cues?.length === 8 &&
  renDetail.operational_voice_cues?.filter(cue => cue.text_source === 'curated').length === 7 &&
  renCostumeModels.has('040ren_104_00') && renCostumeModels.has('040ren_104_01')
if (!renSampleValid && cardDetailFailures.length < SAMPLE_LIMIT) {
  cardDetailFailures.push({ card: '040ren_ssr02', reason: 'reference sample differs from verified wiki/masterdata values' })
}

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  scope: {
    compiled: 'all scenario JSON files under public/data/compiled; metadata indexes excluded',
    voices: 'dialogue.voice references plus card home voice cues',
    sample_limit: SAMPLE_LIMIT,
  },
  scenarios: {
    total_files: compiledFiles.length,
    parsed_files: parsedFiles,
    parse_failures: compiledFiles.length - parsedFiles,
    valid_schema: validScenarioFiles,
    schema_failures: parsedFiles - validScenarioFiles,
    total_steps: totalSteps,
    canonical_files: compiledFiles.filter(file => path.dirname(file) === compiledRoot).length,
    auxiliary_files: compiledFiles.filter(file => path.dirname(file) !== compiledRoot).length,
    parse_failure_samples: parseFailures,
    schema_failure_samples: schemaFailures,
  },
  dialogue_voices: serializeVoiceStats(canonicalVoiceStats),
  auxiliary_dialogue_voices: serializeVoiceStats(auxiliaryVoiceStats),
  card_home_voices: {
    references: homeVoiceRecords.length,
    available: availableHomeVoices,
    missing: homeVoiceRecords.length - availableHomeVoices,
    ratio: ratio(availableHomeVoices, homeVoiceRecords.length),
    missing_samples: missingHomeVoices,
  },
  card_scenarios: {
    references: cardScenarioRecords.length,
    available: availableCardScenarios,
    missing: cardScenarioRecords.length - availableCardScenarios,
    ratio: ratio(availableCardScenarios, cardScenarioRecords.length),
    missing_samples: missingCardScenarios,
  },
  card_relations: {
    direct_story_cards: canonicalCards.filter(card => card.scenario_entries?.length).length,
    valid_direct_story_entries: availableCardScenarios,
    event_card_relations: actualEventCardIds.length,
    valid_event_card_relations: validEventCardRelations,
    event_card_relation_failures: eventCardFailures.length,
    event_card_relation_failure_samples: eventCardFailures,
    gasha_card_relations: actualGashaCardIds.length,
    valid_gasha_card_relations: validGashaCardRelations,
    gasha_card_relation_failures: gashaCardFailures.length,
    gasha_card_relation_failure_samples: gashaCardFailures,
    release_series: releaseSeriesGroups.size,
    valid_release_series: validReleaseSeries,
    release_series_failures: releaseSeriesFailures.length,
    release_series_failure_samples: releaseSeriesFailures,
  },
  card_details: {
    total: canonicalCards.length,
    valid: validCardDetails,
    failures: cardDetailFailures.length,
    failure_samples: cardDetailFailures,
    reference_sample: '040ren_ssr02',
    reference_sample_valid: Boolean(renSampleValid),
    operational_voices: cardDetailIndex.meta?.operational_voice_count || 0,
    costume_relations: cardDetailIndex.meta?.costume_relation_count || 0,
  },
  gashas: {
    total: gashaIndex.gashas?.length || 0,
    logical_total: gashaIndex.meta?.logical_gasha_count || 0,
    valid: validGashaEntities,
    failures: gashaEntityFailures.length,
    failure_samples: gashaEntityFailures,
    named: gashaIndex.meta?.named_count || 0,
    banners: gashaBannerNames.size,
    derived_pickup_cards: actualGashaCardIds.length,
    reference_sample: '10028',
    reference_sample_valid: gashaIndex.by_code?.['10028']?.title === '夏の夜を彩るキャンドルナイトガシャ' &&
      (gashaIndex.by_code?.['10028']?.derived_pickup_cards || []).some(item => item.card_resource_id === '040ren_ssr02'),
  },
  unit_event_relations: {
    total: archiveManifest.unit_event_relations?.length || 0,
    valid: validUnitEvents,
    failures: unitEventFailures.length,
    failure_samples: unitEventFailures,
    fixed_unit_events: (archiveManifest.unit_event_relations || []).filter(event => event.event_scope === 'fixed_unit_event').length,
    attribute_events: (archiveManifest.unit_event_relations || []).filter(event => event.event_scope === 'attribute_event').length,
    mixed_unit_events: (archiveManifest.unit_event_relations || []).filter(event => event.event_scope === 'mixed_unit_event').length,
  },
}

const outputPath = path.join(publicRoot, 'data', 'archive_verification.json')
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`Wrote ${path.relative(projectRoot, outputPath)}`)
console.log(JSON.stringify({
  scenarios: `${validScenarioFiles}/${compiledFiles.length}`,
  dialogueVoices: `${canonicalVoiceStats.available}/${canonicalVoiceStats.references}`,
  auxiliaryVoices: `${auxiliaryVoiceStats.available}/${auxiliaryVoiceStats.references}`,
  cardHomeVoices: `${availableHomeVoices}/${homeVoiceRecords.length}`,
  cardScenarios: `${availableCardScenarios}/${cardScenarioRecords.length}`,
  releaseSeries: `${validReleaseSeries}/${releaseSeriesGroups.size}`,
  unitEvents: `${validUnitEvents}/${archiveManifest.unit_event_relations?.length || 0}`,
  eventCards: `${validEventCardRelations}/${actualEventCardIds.length}`,
  gashaCards: `${validGashaCardRelations}/${actualGashaCardIds.length}`,
  gashas: `${validGashaEntities}/${gashaIndex.gashas?.length || 0}`,
  cardDetails: `${validCardDetails}/${canonicalCards.length}`,
  renSample: renSampleValid ? 'valid' : 'invalid',
}))
