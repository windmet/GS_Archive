import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countScenarioFiles } from '../src/utils/IndexStats.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(projectRoot, 'public')
const cardArtRoot = path.resolve(process.env.SIDEM_CARD_ART_ROOT || 'E:/BaiduNetdiskDownload/SideM/GS_Res/ALL_PHOTOS/assets/resources/image/image_card')

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(publicRoot, relativePath), 'utf8'))
}

async function countFiles(relativePath, predicate = () => true) {
  const root = path.join(publicRoot, relativePath)
  let count = 0

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    await Promise.all(entries.map(async entry => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(entryPath)
      else if (entry.isFile() && predicate(entry.name)) count += 1
    }))
  }

  await visit(root)
  return count
}

async function countDirectories(relativePath) {
  const entries = await readdir(path.join(publicRoot, relativePath), { withFileTypes: true })
  return entries.filter(entry => entry.isDirectory()).length
}

const [compiledIndex, cardIndex, cardDetailIndex, idolUnit, storyMaster, gashaIndex, eventIndex, uiAssetCatalog] = await Promise.all([
  readJson('data/compiled/index.json'),
  readJson('data/masterdata/card_index.json'),
  readJson('data/masterdata/card_detail_index.json'),
  readJson('data/masterdata/idol_unit_dictionary.json'),
  readJson('data/masterdata/story_master_index.json'),
  readJson('data/masterdata/gasha_index.json'),
  readJson('data/masterdata/event_index.json'),
  readJson('data/assets/ui_asset_catalog.json'),
])

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
const archiveCards = [...canonicalCardsById.values()]

const sourcePaths = [
  'data/compiled/index.json',
  'data/masterdata/card_index.json',
  'data/masterdata/card_detail_index.json',
  'data/masterdata/idol_unit_dictionary.json',
  'data/masterdata/story_master_index.json',
  'data/masterdata/story_presentation_index.json',
  'data/masterdata/gasha_announcement_index.json',
  'data/masterdata/gasha_index.json',
  'data/masterdata/event_index.json',
  'data/assets/ui_asset_catalog.json',
]
const sourceStats = await Promise.all(sourcePaths.map(relativePath => stat(path.join(publicRoot, relativePath))))
const dataUpdatedAt = new Date(Math.max(...sourceStats.map(item => item.mtimeMs))).toISOString()

const [compiledJsonFiles, backgroundFiles, spineModels, voiceFiles] = await Promise.all([
  countFiles('data/compiled', name => name.endsWith('.json') && name !== 'index.json'),
  countFiles('assets/bg'),
  countDirectories('assets/spines'),
  countFiles('assets/voice'),
])

function ratio(available, total) {
  return total ? Number((available / total).toFixed(4)) : 0
}

function collectCompiledCoverage(root) {
  const records = []
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (typeof value.compiled_exists === 'boolean') records.push(value)
    for (const child of Object.values(value)) visit(child)
  }
  visit(root)
  const available = records.filter(record => record.compiled_exists).length
  return {
    total: records.length,
    available,
    missing: records.length - available,
    ratio: ratio(available, records.length),
    unique_compiled_files: new Set(records.map(record => record.compiled_file).filter(Boolean)).size,
  }
}

function cardRelationCoverage(field) {
  const records = (cardIndex.cards || []).flatMap(card => card[field] || [])
  const available = records.filter(record => record.compiled_exists).length
  return {
    total: records.length,
    available,
    missing: records.length - available,
    ratio: ratio(available, records.length),
  }
}

function deriveUnitMembership() {
  const groups = new Map((storyMaster.unit_story?.groups || []).map(group => [String(group['1']), group]))
  const chapterToGroup = new Map((storyMaster.unit_story?.chapters || []).map(chapter => [String(chapter['1']), String(chapter['2'])]))
  const frequencies = new Map()
  const seenFiles = new Set()

  for (const episode of storyMaster.unit_story?.episodes || []) {
    const groupId = chapterToGroup.get(String(episode['2']))
    const file = episode.compiled_file
    if (!groupId || !file || seenFiles.has(`${groupId}:${file}`)) continue
    seenFiles.add(`${groupId}:${file}`)
    for (const idolCode of episode.compiled_summary?.characters || []) {
      if (!/^\d{3}[a-z]{3}$/.test(idolCode) || Number(idolCode.slice(0, 3)) > 49) continue
      if (!frequencies.has(idolCode)) frequencies.set(idolCode, new Map())
      const byGroup = frequencies.get(idolCode)
      byGroup.set(groupId, (byGroup.get(groupId) || 0) + 1)
    }
  }

  const membership = {}
  const ambiguous = []
  for (const idolCode of Object.keys(idolUnit.by_idol_code || {})) {
    const ranked = [...(frequencies.get(idolCode) || new Map()).entries()]
      .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    if (!ranked.length) continue
    const [groupId, appearances] = ranked[0]
    if (ranked[1]?.[1] === appearances) ambiguous.push(idolCode)
    const group = groups.get(groupId)
    const unit = idolUnit.by_unit_id?.[String(group?.['2'])]
    if (!group || !unit) continue
    membership[idolCode] = {
      unit_id: unit.unit_id,
      unit_code: unit.unit_code,
      unit_name: unit.unit_name,
      appearances,
      competing_unit_appearances: ranked[1]?.[1] || 0,
      method: 'unit_story_character_frequency',
    }
  }

  return { membership, ambiguous }
}

const SPECIAL_EVENT_CLASSIFICATIONS = new Map([
  ['430006', { event_scope: 'attribute_event', attribute: 'INTELLIGENCE' }],
  ['430007', { event_scope: 'attribute_event', attribute: 'PHYSICAL' }],
  ['430008', { event_scope: 'attribute_event', attribute: 'MENTAL' }],
  ['410017', { event_scope: 'mixed_unit_event', attribute: '' }],
  ['410018', { event_scope: 'mixed_unit_event', attribute: '' }],
])

function deriveUnitEventRelations(membership) {
  const membersByUnit = new Map()
  for (const [idolCode, evidence] of Object.entries(membership)) {
    const unitId = String(evidence.unit_id)
    if (!membersByUnit.has(unitId)) membersByUnit.set(unitId, new Set())
    membersByUnit.get(unitId).add(idolCode)
  }

  const groups = new Map((storyMaster.event?.groups || []).map(group => [String(group['1']), group]))
  const episodesByGroup = new Map()
  for (const episode of storyMaster.event?.episodes || []) {
    const groupId = String(episode['2'])
    if (!episodesByGroup.has(groupId)) episodesByGroup.set(groupId, [])
    episodesByGroup.get(groupId).push(episode)
  }

  const byUnit = Object.fromEntries([...membersByUnit.keys()].map(unitId => [unitId, {
    team_events: [],
    attribute_event_appearances: [],
    mixed_unit_appearances: [],
  }]))
  const events = []

  for (const [groupId, episodes] of episodesByGroup) {
    const group = groups.get(groupId)
    if (!group) continue
    const characters = [...new Set(episodes.flatMap(episode => episode.compiled_summary?.characters || []))]
      .filter(idolCode => membership[idolCode])
      .sort()
    const characterSet = new Set(characters)
    const participatingUnitIds = [...new Set(characters.map(idolCode => String(membership[idolCode].unit_id)))].sort()
    const exactUnitId = [...membersByUnit.entries()].find(([, members]) =>
      members.size === characterSet.size && [...members].every(idolCode => characterSet.has(idolCode)),
    )?.[0] || ''
    const specialClassification = SPECIAL_EVENT_CLASSIFICATIONS.get(String(group['2']))
    const eventScope = exactUnitId ? 'fixed_unit_event' : (specialClassification?.event_scope || 'unclassified_cross_unit')
    const title = group['9'] || ''
    const relation = {
      event_group_id: group['1'],
      event_id: group['2'],
      event_code: group['4'],
      title,
      release_at: group['10'],
      series: title.startsWith('GROWING SIGN@L')
        ? 'GROWING SIGN@L'
        : (title.startsWith('GROWING SELECTION') ? 'GROWING SELECTION' : 'OTHER'),
      file: [...new Set(episodes.map(episode => episode.compiled_file).filter(Boolean))][0] || '',
      exists: episodes.some(episode => episode.compiled_exists !== false && episode.compiled_file),
      characters,
      participating_unit_ids: participatingUnitIds,
      unit_id: exactUnitId,
      event_scope: eventScope,
      attribute: specialClassification?.attribute || '',
      relation_type: exactUnitId ? 'exact_compiled_character_roster' : 'confirmed_cross_unit_event_classification',
      classification_source: exactUnitId
        ? 'compiled roster equals fixed-unit membership'
        : 'user-confirmed event classification 2026-07-14',
    }
    events.push(relation)

    if (exactUnitId) {
      byUnit[exactUnitId].team_events.push(relation)
      continue
    }
    for (const unitId of participatingUnitIds) {
      if (!byUnit[unitId]) continue
      const target = eventScope === 'attribute_event'
        ? byUnit[unitId].attribute_event_appearances
        : byUnit[unitId].mixed_unit_appearances
      target.push({
        ...relation,
        matching_character_ids: characters.filter(idolCode => String(membership[idolCode].unit_id) === unitId),
      })
    }
  }

  const sortRelations = (a, b) => Number(a.release_at || 0) - Number(b.release_at || 0)
  events.sort(sortRelations)
  for (const relations of Object.values(byUnit)) {
    relations.team_events.sort(sortRelations)
    relations.attribute_event_appearances.sort(sortRelations)
    relations.mixed_unit_appearances.sort(sortRelations)
  }
  return { events, byUnit }
}

function deriveEventCardRelations(cards, events, gashaCardIds) {
  const byCard = {}
  const byEvent = {}
  for (const card of cards) {
    if (gashaCardIds.has(card.resource_id)) continue
    const event = events.find(candidate =>
      candidate.release_at === card.release_at && candidate.characters.includes(card.character_id),
    )
    if (!event) continue
    const relation = {
      card_id: card.card_id,
      card_resource_id: card.resource_id,
      character_id: card.character_id,
      rarity: card.rarity,
      event_group_id: event.event_group_id,
      event_id: event.event_id,
      event_code: event.event_code,
      title: event.title,
      release_at: event.release_at,
      file: event.file,
      exists: event.exists,
      event_scope: event.event_scope,
      attribute: event.attribute,
      relation_type: 'exact_release_timestamp_and_event_character_roster',
    }
    byCard[card.resource_id] = relation
    const eventId = String(event.event_id)
    if (!byEvent[eventId]) byEvent[eventId] = []
    byEvent[eventId].push(relation)
  }
  for (const relations of Object.values(byEvent)) {
    relations.sort((a, b) => a.character_id.localeCompare(b.character_id) || Number(a.card_id) - Number(b.card_id))
  }
  return { byCard, byEvent }
}

const iconNames = new Set(await readdir(path.join(publicRoot, 'assets/cards/icons')))
const largeNames = new Set(await readdir(path.join(publicRoot, 'assets/cards/large')))
const voiceNames = new Set(await readdir(path.join(publicRoot, 'assets/voice')))
async function optionalNames(directory) {
  try {
    return new Set(await readdir(directory))
  } catch {
    return new Set()
  }
}
const [portraitNames, landscapeNames] = await Promise.all([
  optionalNames(path.join(cardArtRoot, 'image_card_portrait')),
  optionalNames(path.join(cardArtRoot, 'image_card_landscape')),
])
const missingNormalIcons = []
const missingAwakenedIcons = []
const singleStateCardIds = []
const cardAssetsById = {}
for (const card of archiveCards) {
  const id = card.resource_id
  const normalIcon = iconNames.has(`image_card_icon_${id}.png`)
  const awakenedIcon = iconNames.has(`image_card_icon_${id}p.png`)
  const normalLarge = largeNames.has(`image_card_portrait_show_${id}.png`)
  const awakenedLarge = largeNames.has(`image_card_portrait_show_${id}p.png`)
  const normalPortrait = portraitNames.has(`image_card_portrait_hide_${id}.png`)
  const awakenedPortrait = portraitNames.has(`image_card_portrait_hide_${id}p.png`)
  const normalLandscape = landscapeNames.has(`image_card_landscape_${id}.png`)
  const awakenedLandscape = landscapeNames.has(`image_card_landscape_${id}p.png`)
  const normalTextVoice = voiceNames.has(`${card.voice_base}_01_01.m4a`)
  const awakenedTextVoice = voiceNames.has(`${card.voice_base}_01_09.m4a`)
  const singleState = !normalPortrait && awakenedPortrait && !normalTextVoice && awakenedTextVoice
  if (singleState) singleStateCardIds.push(id)
  if (!normalIcon) missingNormalIcons.push(id)
  if (!awakenedIcon) missingAwakenedIcons.push(id)
  cardAssetsById[id] = {
    normal_icon: normalIcon,
    awakened_icon: awakenedIcon,
    normal_large: normalLarge,
    awakened_large: awakenedLarge,
    normal_portrait: normalPortrait,
    awakened_portrait: awakenedPortrait,
    normal_landscape: normalLandscape,
    awakened_landscape: awakenedLandscape,
    single_state: singleState,
  }
}
const unitEvidence = deriveUnitMembership()
const unitEventEvidence = deriveUnitEventRelations(unitEvidence.membership)
const gashaCardEvidence = {
  byCard: gashaIndex.relations_by_card || {},
  byGasha: gashaIndex.relations_by_gasha || {},
}
const eventCardEvidence = deriveEventCardRelations(
  archiveCards,
  unitEventEvidence.events,
  new Set(Object.keys(gashaCardEvidence.byCard)),
)
const storyCoverage = collectCompiledCoverage(storyMaster)
const homeVoiceCoverage = cardRelationCoverage('home_voice_cues')
const cardScenarioCoverage = cardRelationCoverage('scenario_entries')
const normalCardTextVoiceIds = archiveCards.filter(card => voiceNames.has(`${card.voice_base}_01_01.m4a`)).map(card => card.resource_id)
const awakenedCardTextVoiceIds = archiveCards.filter(card => voiceNames.has(`${card.voice_base}_01_09.m4a`)).map(card => card.resource_id)
const dualStateCards = archiveCards.length - singleStateCardIds.length
const releaseSeriesCards = archiveCards.filter(card => card.release_series)
const releaseSeriesById = new Map(releaseSeriesCards.map(card => [card.release_series.series_id, card.release_series]))
const unexpectedMissingNormalIcons = missingNormalIcons.filter(id => !singleStateCardIds.includes(id))
const unexpectedMissingNormalPortraits = archiveCards
  .filter(card => !cardAssetsById[card.resource_id].normal_portrait && !cardAssetsById[card.resource_id].single_state)
  .map(card => card.resource_id)

const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  data_updated_at: dataUpdatedAt,
  counts: {
    indexed_scenarios: countScenarioFiles(compiledIndex.categories || []),
    compiled_json_files: compiledJsonFiles,
    idols: Object.keys(idolUnit.by_idol_code || {}).length,
    cards: archiveCards.length,
    gashas: gashaIndex.meta?.gasha_count || 0,
    home_voice_cues: cardIndex.meta?.home_voice_cue_count || 0,
    backgrounds: backgroundFiles,
    spine_models: spineModels,
    voice_files: voiceFiles,
    release_series: releaseSeriesById.size,
    ui_asset_entries: uiAssetCatalog.meta?.entry_count || 0,
    unit_logos: uiAssetCatalog.meta?.public_unit_logo_count || 0,
  },
  coverage: {
    story_master_records: storyCoverage,
    card_home_voices: homeVoiceCoverage,
    card_scenarios: cardScenarioCoverage,
    card_text_voices: {
      total_cards: archiveCards.length,
      normal_expected: dualStateCards,
      normal_available: normalCardTextVoiceIds.length,
      awakened_available: awakenedCardTextVoiceIds.length,
      normal_ratio: ratio(normalCardTextVoiceIds.length, dualStateCards),
      awakened_ratio: ratio(awakenedCardTextVoiceIds.length, archiveCards.length),
      missing_normal: archiveCards.filter(card => !normalCardTextVoiceIds.includes(card.resource_id) && !singleStateCardIds.includes(card.resource_id)).map(card => card.resource_id),
      missing_awakened: archiveCards.filter(card => !awakenedCardTextVoiceIds.includes(card.resource_id)).map(card => card.resource_id),
      rule: '{voice_base}_01_01 = normal, {voice_base}_01_09 = awakened',
    },
    card_icons: {
      total_cards: archiveCards.length,
      normal_expected: dualStateCards,
      normal_available: archiveCards.length - missingNormalIcons.length,
      awakened_available: archiveCards.length - missingAwakenedIcons.length,
      normal_ratio: ratio(archiveCards.length - missingNormalIcons.length, dualStateCards),
      awakened_ratio: ratio(archiveCards.length - missingAwakenedIcons.length, archiveCards.length),
      missing_normal: unexpectedMissingNormalIcons,
      missing_awakened: missingAwakenedIcons,
    },
    card_large_images: {
      total_cards: archiveCards.length,
      normal_available: Object.values(cardAssetsById).filter(item => item.normal_large).length,
      awakened_available: Object.values(cardAssetsById).filter(item => item.awakened_large).length,
    },
    card_portraits: {
      total_cards: archiveCards.length,
      normal_expected: dualStateCards,
      normal_available: Object.values(cardAssetsById).filter(item => item.normal_portrait).length,
      awakened_available: Object.values(cardAssetsById).filter(item => item.awakened_portrait).length,
      missing_normal: unexpectedMissingNormalPortraits,
    },
    card_modes: {
      dual_state: dualStateCards,
      single_state: singleStateCardIds.length,
      single_state_ids: singleStateCardIds,
      rule: 'no normal portrait/voice and available awakened portrait/voice',
    },
    card_landscapes: {
      total_ssr_cards: archiveCards.filter(card => card.rarity === 'SSR').length,
      normal_available: Object.values(cardAssetsById).filter(item => item.normal_landscape).length,
      awakened_available: Object.values(cardAssetsById).filter(item => item.awakened_landscape).length,
    },
    card_relations: {
      cards_with_direct_story: archiveCards.filter(card => card.scenario_entries?.length).length,
      cards_with_event_relation: Object.keys(eventCardEvidence.byCard).length,
      event_card_relation_count: Object.keys(eventCardEvidence.byCard).length,
      cards_with_gasha_relation: Object.keys(gashaCardEvidence.byCard).length,
      gasha_card_relation_count: Object.keys(gashaCardEvidence.byCard).length,
      cards_with_release_series: releaseSeriesCards.length,
      release_series_count: releaseSeriesById.size,
      direct_story_rule: 'card scenario row id // 100 equals card id',
      event_card_rule: 'card is not a gasha pickup, release_at equals event release_at, and character appears in compiled event roster',
      gasha_card_rule: 'card LimitbreakItemId (field 23) exists and card release_at equals exactly one gasha announcement start_at',
      release_series_rule: 'cards share card table fields 18 (release_at) and 40 (title)',
    },
    card_details: {
      cards: Object.keys(cardDetailIndex.cards_by_resource_id || {}).length,
      skills: Object.keys(cardDetailIndex.skills_by_id || {}).length,
      center_skills: Object.keys(cardDetailIndex.center_skills_by_id || {}).length,
      costumes: Object.keys(cardDetailIndex.costumes_by_key || {}).length,
      operational_voices: cardDetailIndex.meta?.operational_voice_count || 0,
      costume_relations: cardDetailIndex.meta?.costume_relation_count || 0,
    },
    gashas: {
      total: gashaIndex.meta?.gasha_count || 0,
      named: gashaIndex.meta?.named_count || 0,
      derived_pickup_cards: gashaIndex.meta?.derived_pickup_count || 0,
      banner_assets: (gashaIndex.gashas || []).filter(item => item.banner_url).length,
      instance_source: 'GashaListReply service response (not retained locally)',
    },
    ui_assets: {
      total: uiAssetCatalog.meta?.entry_count || 0,
      public_unit_logos: uiAssetCatalog.meta?.public_unit_logo_count || 0,
      domains: uiAssetCatalog.meta?.counts_by_domain || {},
      scope: uiAssetCatalog.source?.scope || '',
    },
    unit_membership: {
      resolved: Object.keys(unitEvidence.membership).length,
      unresolved: Object.keys(idolUnit.by_idol_code || {}).length - Object.keys(unitEvidence.membership).length,
      ambiguous: unitEvidence.ambiguous,
      method: 'unit_story_character_frequency',
    },
    unit_events: {
      total: unitEventEvidence.events.length,
      fixed_unit_events: unitEventEvidence.events.filter(event => event.event_scope === 'fixed_unit_event').length,
      attribute_events: unitEventEvidence.events.filter(event => event.event_scope === 'attribute_event').length,
      mixed_unit_events: unitEventEvidence.events.filter(event => event.event_scope === 'mixed_unit_event').length,
      signal_exact_unit_roster: unitEventEvidence.events.filter(event => event.unit_id && event.series === 'GROWING SIGN@L').length,
      selection_exact_unit_roster: unitEventEvidence.events.filter(event => event.unit_id && event.series === 'GROWING SELECTION').length,
      rule: 'fixed unit requires exact compiled roster; attribute and mixed-unit events use confirmed classification',
    },
  },
  unit_membership_by_idol: unitEvidence.membership,
  unit_event_relations: unitEventEvidence.events,
  unit_event_relations_by_unit: unitEventEvidence.byUnit,
  event_card_relations_by_card: eventCardEvidence.byCard,
  event_card_relations_by_event: eventCardEvidence.byEvent,
  gasha_card_relations_by_card: gashaCardEvidence.byCard,
  gasha_card_relations_by_gasha: gashaCardEvidence.byGasha,
  card_assets_by_id: cardAssetsById,
  sources: sourcePaths,
  external_sources: {
    card_art: {
      configured: portraitNames.size > 0 || landscapeNames.size > 0,
      portrait_files: portraitNames.size,
      landscape_files: landscapeNames.size,
      environment_variable: 'SIDEM_CARD_ART_ROOT',
    },
  },
}

const outputPath = path.join(publicRoot, 'data/archive_manifest.json')
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Wrote ${path.relative(projectRoot, outputPath)}`)
