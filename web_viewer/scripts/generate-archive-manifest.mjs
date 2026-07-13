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

const [compiledIndex, cardIndex, idolUnit, storyMaster] = await Promise.all([
  readJson('data/compiled/index.json'),
  readJson('data/masterdata/card_index.json'),
  readJson('data/masterdata/idol_unit_dictionary.json'),
  readJson('data/masterdata/story_master_index.json'),
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
  'data/masterdata/idol_unit_dictionary.json',
  'data/masterdata/story_master_index.json',
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
    home_voice_cues: cardIndex.meta?.home_voice_cue_count || 0,
    backgrounds: backgroundFiles,
    spine_models: spineModels,
    voice_files: voiceFiles,
    release_series: releaseSeriesById.size,
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
      cards_with_release_series: releaseSeriesCards.length,
      release_series_count: releaseSeriesById.size,
      direct_story_rule: 'card scenario row id // 100 equals card id',
      release_series_rule: 'cards share card table fields 18 (release_at) and 40 (title)',
    },
    unit_membership: {
      resolved: Object.keys(unitEvidence.membership).length,
      unresolved: Object.keys(idolUnit.by_idol_code || {}).length - Object.keys(unitEvidence.membership).length,
      ambiguous: unitEvidence.ambiguous,
      method: 'unit_story_character_frequency',
    },
  },
  unit_membership_by_idol: unitEvidence.membership,
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
