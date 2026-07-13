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

const [compiledFiles, voiceEntries, cardIndex, storyMaster] = await Promise.all([
  listFiles(compiledRoot, name => name.endsWith('.json') && !['index.json', 'manifest.json', 'voice_index.json'].includes(name)),
  readdir(voiceRoot, { withFileTypes: true }),
  readFile(path.join(publicRoot, 'data', 'masterdata', 'card_index.json'), 'utf8').then(JSON.parse),
  readFile(path.join(publicRoot, 'data', 'masterdata', 'story_master_index.json'), 'utf8').then(JSON.parse),
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
    release_series: releaseSeriesGroups.size,
    valid_release_series: validReleaseSeries,
    release_series_failures: releaseSeriesFailures.length,
    release_series_failure_samples: releaseSeriesFailures,
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
}))
