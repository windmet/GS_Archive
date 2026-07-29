import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

import { validateStoryTranslationOverlay } from '../../src/localization/story/TranslationRepository.js'
import { compareAuthoritativeRuntimeProjection } from './authoritative-scenario-compiler.mjs'
import { atomicWriteFrom } from './authoritative-collection-publisher.mjs'
import { jsonBytes, resolveInside } from './authoritative-collection-candidate.mjs'
import { buildCompiledScenarioMigrationReport } from './compiled-scenario-migration.mjs'

const hashBytes = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const ALLOWED_EPISODE_DELTA = /^\/steps\/\d+\/episode_(?:index|part)$/u

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function isInside(root, target) {
  const relation = path.relative(path.resolve(root), path.resolve(target))
  return relation === '' || (!relation.startsWith('..') && !path.isAbsolute(relation))
}

function assertCandidateIsolation(workspaceRoot, outputDirectory) {
  const workspace = path.resolve(workspaceRoot)
  const publicRoot = path.join(workspace, 'public')
  if (isInside(publicRoot, outputDirectory)) {
    throw new Error('RAW story promotion candidates must remain outside public/')
  }
  if (isInside(workspace, outputDirectory) && !isInside(path.join(workspace, '.analysis'), outputDirectory)) {
    throw new Error('Workspace-local RAW story promotion candidates must remain under .analysis/')
  }
}

function localizedInlineValues(value, location = '$', records = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => localizedInlineValues(item, `${location}[${index}]`, records))
    return records
  }
  if (!value || typeof value !== 'object') return records
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${location}.${key}`
    if (/_cn$/iu.test(key) && typeof child === 'string' && child.trim()) {
      records.push({ path: childPath, value: child })
    }
    localizedInlineValues(child, childPath, records)
  }
  return records
}

function collectTextRefs(value, refs = new Map()) {
  if (Array.isArray(value)) {
    value.forEach(item => collectTextRefs(item, refs))
    return refs
  }
  if (!value || typeof value !== 'object') return refs
  if (typeof value.unit_id === 'string' && typeof value.source_hash === 'string') {
    const previous = refs.get(value.unit_id)
    if (previous && previous !== value.source_hash) {
      throw new Error(`Conflicting source hashes for text unit: ${value.unit_id}`)
    }
    refs.set(value.unit_id, value.source_hash)
  }
  Object.values(value).forEach(child => collectTextRefs(child, refs))
  return refs
}

async function overlayEvidence(translationsRoot, scenarioId, candidate) {
  const root = path.resolve(translationsRoot)
  const refs = collectTextRefs(candidate)
  const records = []
  if (!await exists(root)) return records
  const locales = await readdir(root, { withFileTypes: true })
  for (const localeEntry of locales.filter(entry => entry.isDirectory())) {
    const overlayPath = path.join(root, localeEntry.name, 'scenarios', `${scenarioId}.json`)
    if (!await exists(overlayPath)) continue
    const bytes = await readFile(overlayPath)
    const overlay = JSON.parse(bytes)
    const validation = validateStoryTranslationOverlay(overlay, {
      scenarioId,
      locale: localeEntry.name,
    })
    if (!validation.valid) {
      throw new Error(`Translation overlay is invalid: ${validation.errors.join('; ')}`)
    }
    if (overlay.source_raw_hash !== candidate.source?.raw_hash) {
      throw new Error(`Translation overlay RAW hash drift: ${localeEntry.name}/${scenarioId}`)
    }
    for (const [unitId, entry] of Object.entries(overlay.entries)) {
      if (!refs.has(unitId)) throw new Error(`Translation unit is absent from candidate: ${unitId}`)
      if (refs.get(unitId) !== entry.source_hash) {
        throw new Error(`Translation source hash drift: ${unitId}`)
      }
    }
    records.push({
      locale: localeEntry.name,
      file: path.relative(root, overlayPath).replaceAll('\\', '/'),
      hash: hashBytes(bytes),
      entries: Object.keys(overlay.entries).length,
    })
  }
  return records.sort((left, right) => left.file.localeCompare(right.file))
}

function allowedEpisodeMetadataDelta(record) {
  if (record.kind !== 'added') return false
  if (record.path === '/episodes') return Array.isArray(record.new) && record.new.length > 0
  return ALLOWED_EPISODE_DELTA.test(record.path)
}

function summarizeMigration(migration) {
  const differences = migration.non_text_differences.records
  const onlyEpisodeMetadataAdded = !migration.non_text_differences.truncated
    && differences.every(allowedEpisodeMetadataDelta)
  const coreUnchanged = migration.identity.unchanged
    && migration.step_structure.count_unchanged
    && migration.step_structure.type_sequence_unchanged
    && migration.choice_targets.unchanged
    && migration.dialogue_audio.unchanged
    && migration.cue_profile.unchanged
    && migration.text_content.unchanged
  return {
    core_runtime_and_text_unchanged: coreUnchanged,
    only_episode_metadata_added: onlyEpisodeMetadataAdded,
    episode_metadata_difference_count: differences.length,
    disallowed_differences: differences.filter(record => !allowedEpisodeMetadataDelta(record)),
    accepted: coreUnchanged && onlyEpisodeMetadataAdded,
  }
}

async function authoritativeValidator(workspaceRoot) {
  const schema = await readJson(path.join(
    path.resolve(workspaceRoot),
    'schemas',
    'compiled-scenario-v2-authoritative.schema.json',
  ))
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  return { ajv, validate: ajv.compile(schema) }
}

export async function assessRawStoryPromotion({
  workspaceRoot,
  currentFile,
  compatibilityFile,
  authoritativeFile,
  translationsRoot,
  expectedScenarioId = null,
}) {
  const [currentBytes, compatibilityBytes, authoritativeBytes] = await Promise.all([
    readFile(currentFile),
    readFile(compatibilityFile),
    readFile(authoritativeFile),
  ])
  const current = JSON.parse(currentBytes)
  const compatibility = JSON.parse(compatibilityBytes)
  const authoritative = JSON.parse(authoritativeBytes)
  const scenarioId = expectedScenarioId || authoritative.scenario_id
  if (!scenarioId || [current, compatibility, authoritative].some(value => value.scenario_id !== scenarioId)) {
    throw new Error('RAW promotion scenario identity mismatch')
  }

  const { ajv, validate } = await authoritativeValidator(workspaceRoot)
  if (!validate(authoritative)) {
    throw new Error(`Authoritative RAW candidate schema rejected: ${ajv.errorsText(validate.errors)}`)
  }
  const projection = compareAuthoritativeRuntimeProjection(compatibility, authoritative)
  if (!projection.passed) {
    throw new Error(`Compatibility-to-authoritative projection drift: ${projection.differences.join(', ')}`)
  }
  const migration = buildCompiledScenarioMigrationReport(
    current,
    compatibility,
    { maxDifferences: 100000 },
  )
  const migrationGate = summarizeMigration(migration)
  if (!migrationGate.accepted) {
    throw new Error(`Current-to-RAW compatibility migration rejected: ${JSON.stringify(migrationGate.disallowed_differences.slice(0, 10))}`)
  }
  const inlineLocalized = localizedInlineValues(current)
  if (inlineLocalized.length) {
    throw new Error(`Inline localized text would be removed: ${inlineLocalized[0].path}`)
  }
  const overlays = await overlayEvidence(translationsRoot, scenarioId, authoritative)

  return {
    scenario_id: scenarioId,
    current_hash: hashBytes(currentBytes),
    compatibility_hash: hashBytes(compatibilityBytes),
    authoritative_hash: hashBytes(authoritativeBytes),
    compiler_version: authoritative.compiler_version,
    raw_source: authoritative.source,
    steps: authoritative.steps.length,
    voice_references: authoritative.steps.filter(step => Boolean(step.dialogue?.voice)).length,
    migration_gate: migrationGate,
    localization_gate: {
      inline_localized_values: inlineLocalized.length,
      overlays,
      overlay_entries: overlays.reduce((sum, record) => sum + record.entries, 0),
      preserved: true,
    },
    accepted: true,
  }
}

export async function buildRawStoryPromotionCandidate({
  workspaceRoot,
  currentFile,
  compatibilityFile,
  authoritativeFile,
  translationsRoot,
  outputDirectory,
  scenarioId = null,
}) {
  const output = path.resolve(outputDirectory)
  assertCandidateIsolation(workspaceRoot, output)
  try {
    if ((await readdir(output)).length) throw new Error(`Candidate output directory must be empty: ${output}`)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const assessment = await assessRawStoryPromotion({
    workspaceRoot,
    currentFile,
    compatibilityFile,
    authoritativeFile,
    translationsRoot,
    expectedScenarioId: scenarioId,
  })
  const candidateRelative = `candidate/${assessment.scenario_id}.json`
  const compatibilityRelative = `_evidence/compatibility/${assessment.scenario_id}.json`
  await mkdir(output, { recursive: true })
  for (const [source, relative] of [
    [authoritativeFile, candidateRelative],
    [compatibilityFile, compatibilityRelative],
  ]) {
    const target = resolveInside(output, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, await readFile(source))
  }
  const manifest = {
    schema_version: 1,
    candidate_kind: 'raw-story-single-promotion',
    scenario_id: assessment.scenario_id,
    target_file: `${assessment.scenario_id}.json`,
    candidate_file: candidateRelative,
    compatibility_evidence_file: compatibilityRelative,
    assessment,
  }
  await writeFile(path.join(output, 'raw_story_promotion_manifest.json'), jsonBytes(manifest))
  return manifest
}

export async function publishRawStoryPromotion({
  workspaceRoot,
  candidateDirectory,
  compiledDirectory,
  translationsRoot,
  backupDirectory,
  confirmScenario,
  publishWrite = atomicWriteFrom,
  reportWrite = writeFile,
}) {
  const candidateRoot = path.resolve(candidateDirectory)
  const compiledRoot = path.resolve(compiledDirectory)
  const backupRoot = path.resolve(backupDirectory)
  if (isInside(compiledRoot, backupRoot)) throw new Error('Backup directory must be outside the compiled corpus')
  try {
    if ((await readdir(backupRoot)).length) throw new Error(`Backup directory must be empty: ${backupRoot}`)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const manifest = await readJson(path.join(candidateRoot, 'raw_story_promotion_manifest.json'))
  if (manifest.candidate_kind !== 'raw-story-single-promotion' || !manifest.scenario_id) {
    throw new Error('Invalid RAW story promotion manifest')
  }
  if (manifest.target_file !== `${manifest.scenario_id}.json`) {
    throw new Error('RAW story promotion target filename does not match scenario identity')
  }
  if (confirmScenario !== manifest.scenario_id) {
    throw new Error(`Explicit scenario confirmation is required: ${manifest.scenario_id}`)
  }
  const target = resolveInside(compiledRoot, manifest.target_file)
  const authoritativeFile = resolveInside(candidateRoot, manifest.candidate_file)
  const compatibilityFile = resolveInside(candidateRoot, manifest.compatibility_evidence_file)
  const assessment = await assessRawStoryPromotion({
    workspaceRoot,
    currentFile: target,
    compatibilityFile,
    authoritativeFile,
    translationsRoot,
    expectedScenarioId: manifest.scenario_id,
  })
  if (JSON.stringify(assessment) !== JSON.stringify(manifest.assessment)) {
    throw new Error('RAW story promotion evidence drifted after candidate build')
  }

  const backupTarget = resolveInside(backupRoot, manifest.target_file)
  await mkdir(path.dirname(backupTarget), { recursive: true })
  await writeFile(backupTarget, await readFile(target))
  let report
  try {
    await publishWrite(authoritativeFile, target)
    if (hashBytes(await readFile(target)) !== assessment.authoritative_hash) {
      throw new Error('Published RAW story hash verification failed')
    }
    report = {
      schema_version: 1,
      scenario_id: manifest.scenario_id,
      published_at: new Date().toISOString(),
      old_hash: assessment.current_hash,
      new_hash: assessment.authoritative_hash,
      backup_hash: hashBytes(await readFile(backupTarget)),
      raw_source: assessment.raw_source,
      localization_gate: assessment.localization_gate,
    }
    await reportWrite(path.join(backupRoot, 'raw_story_publish_backup_manifest.json'), jsonBytes(report))
  } catch (error) {
    await atomicWriteFrom(backupTarget, target)
    throw error
  }
  return report
}

export { hashBytes }
