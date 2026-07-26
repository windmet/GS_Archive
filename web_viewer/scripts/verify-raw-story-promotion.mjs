import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { compileAuthoritativeScenario } from './lib/authoritative-scenario-compiler.mjs'
import {
  assessRawStoryPromotion,
  buildRawStoryPromotionCandidate,
  hashBytes,
  publishRawStoryPromotion,
} from './lib/raw-story-promotion.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'sidem-raw-story-promotion-'))
const fixture = JSON.parse(await readFile(
  path.join(workspaceRoot, 'fixtures', 'story-runtime', 'compatibility-v1-authoritative-source.json'),
  'utf8',
))
const clone = value => JSON.parse(JSON.stringify(value))
const scenarioId = fixture.scenario_id

function enrichedCompatibility() {
  const value = clone(fixture)
  value.steps.forEach(step => {
    step.episode_index = 0
    step.episode_part = 'a'
  })
  value.episodes = [{
    episode_index: 0,
    episode_part: 'a',
    source_scenario_id: 'part_a',
    start_step_id: 1,
    end_step_id: value.steps.length,
  }]
  return value
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const currentFile = path.join(temporaryRoot, 'compiled', `${scenarioId}.json`)
const compatibilityFile = path.join(temporaryRoot, 'inputs', 'compatibility.json')
const authoritativeFile = path.join(temporaryRoot, 'inputs', 'authoritative.json')
const translationsRoot = path.join(temporaryRoot, 'translations')
const compatibility = enrichedCompatibility()
const authoritative = compileAuthoritativeScenario(compatibility, {
  compilerVersion: 'raw-promotion-test-1',
})
await writeJson(currentFile, fixture)
await writeJson(compatibilityFile, compatibility)
await writeJson(authoritativeFile, authoritative)

const overlay = {
  schema_version: 1,
  locale: 'zh-CN',
  scenario_id: scenarioId,
  source_raw_hash: authoritative.source.raw_hash,
  entries: Object.fromEntries(
    [...new Map([
      [compatibility.steps[0].dialogue.text_ref.unit_id, compatibility.steps[0].dialogue.text_ref.source_hash],
      [compatibility.steps[1].options[0].text_ref.unit_id, compatibility.steps[1].options[0].text_ref.source_hash],
    ])].map(([unitId, sourceHash]) => [unitId, {
      source_hash: sourceHash,
      text: `translated:${unitId}`,
      status: 'reviewed',
    }]),
  ),
}
const overlayFile = path.join(translationsRoot, 'zh-CN', 'scenarios', `${scenarioId}.json`)
await writeJson(overlayFile, overlay)

try {
  const candidateDirectory = path.join(temporaryRoot, 'candidate')
  const manifest = await buildRawStoryPromotionCandidate({
    workspaceRoot,
    currentFile,
    compatibilityFile,
    authoritativeFile,
    translationsRoot,
    outputDirectory: candidateDirectory,
    scenarioId,
  })
  assert.equal(manifest.assessment.accepted, true)
  assert.equal(manifest.assessment.migration_gate.only_episode_metadata_added, true)
  assert.equal(manifest.assessment.localization_gate.inline_localized_values, 0)
  assert.equal(manifest.assessment.localization_gate.overlays.length, 1)
  assert.equal(manifest.assessment.localization_gate.overlay_entries, 2)

  const wrongConfirmationBackup = path.join(temporaryRoot, 'wrong-confirm-backup')
  await assert.rejects(
    publishRawStoryPromotion({
      workspaceRoot,
      candidateDirectory,
      compiledDirectory: path.dirname(currentFile),
      translationsRoot,
      backupDirectory: wrongConfirmationBackup,
      confirmScenario: 'wrong-scenario',
    }),
    /Explicit scenario confirmation/u,
  )

  const oldBytes = await readFile(currentFile)
  const backupDirectory = path.join(temporaryRoot, 'backup')
  const report = await publishRawStoryPromotion({
    workspaceRoot,
    candidateDirectory,
    compiledDirectory: path.dirname(currentFile),
    translationsRoot,
    backupDirectory,
    confirmScenario: scenarioId,
  })
  assert.equal(report.old_hash, hashBytes(oldBytes))
  assert.equal(report.new_hash, hashBytes(await readFile(authoritativeFile)))
  assert.equal(report.backup_hash, hashBytes(oldBytes))
  assert.equal(hashBytes(await readFile(currentFile)), report.new_hash)
  assert.equal(hashBytes(await readFile(path.join(backupDirectory, `${scenarioId}.json`))), report.old_hash)

  const inlineLocalized = clone(fixture)
  inlineLocalized.steps[0].dialogue.text_cn = '不可丢失的本地化文本'
  const inlineFile = path.join(temporaryRoot, 'negative', 'inline-localized.json')
  await writeJson(inlineFile, inlineLocalized)
  await assert.rejects(
    assessRawStoryPromotion({
      workspaceRoot,
      currentFile: inlineFile,
      compatibilityFile,
      authoritativeFile,
      translationsRoot,
      expectedScenarioId: scenarioId,
    }),
    /Inline localized text would be removed/u,
  )

  const changedCompatibility = enrichedCompatibility()
  changedCompatibility.steps[0].state.bg = 'bg999_drift'
  const changedCompatibilityFile = path.join(temporaryRoot, 'negative', 'scene-drift.json')
  await writeJson(changedCompatibilityFile, changedCompatibility)
  await assert.rejects(
    assessRawStoryPromotion({
      workspaceRoot,
      currentFile: path.join(backupDirectory, `${scenarioId}.json`),
      compatibilityFile: changedCompatibilityFile,
      authoritativeFile,
      translationsRoot,
      expectedScenarioId: scenarioId,
    }),
    /projection drift/u,
  )

  const staleOverlay = clone(overlay)
  staleOverlay.source_raw_hash = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
  await writeJson(overlayFile, staleOverlay)
  await assert.rejects(
    assessRawStoryPromotion({
      workspaceRoot,
      currentFile: path.join(backupDirectory, `${scenarioId}.json`),
      compatibilityFile,
      authoritativeFile,
      translationsRoot,
      expectedScenarioId: scenarioId,
    }),
    /Translation overlay RAW hash drift/u,
  )
  await writeJson(overlayFile, overlay)

  const rollbackCompiled = path.join(temporaryRoot, 'rollback-compiled')
  const rollbackTarget = path.join(rollbackCompiled, `${scenarioId}.json`)
  await mkdir(rollbackCompiled, { recursive: true })
  await writeFile(rollbackTarget, oldBytes)
  const rollbackCandidate = path.join(temporaryRoot, 'rollback-candidate')
  await buildRawStoryPromotionCandidate({
    workspaceRoot,
    currentFile: rollbackTarget,
    compatibilityFile,
    authoritativeFile,
    translationsRoot,
    outputDirectory: rollbackCandidate,
    scenarioId,
  })
  await assert.rejects(
    publishRawStoryPromotion({
      workspaceRoot,
      candidateDirectory: rollbackCandidate,
      compiledDirectory: rollbackCompiled,
      translationsRoot,
      backupDirectory: path.join(temporaryRoot, 'rollback-backup'),
      confirmScenario: scenarioId,
      publishWrite: async (source, target) => {
        await writeFile(target, await readFile(source))
        throw new Error('injected publish failure')
      },
    }),
    /injected publish failure/u,
  )
  assert.equal(hashBytes(await readFile(rollbackTarget)), hashBytes(oldBytes))

  const reportFailureCompiled = path.join(temporaryRoot, 'report-failure-compiled')
  const reportFailureTarget = path.join(reportFailureCompiled, `${scenarioId}.json`)
  await mkdir(reportFailureCompiled, { recursive: true })
  await writeFile(reportFailureTarget, oldBytes)
  const reportFailureCandidate = path.join(temporaryRoot, 'report-failure-candidate')
  await buildRawStoryPromotionCandidate({
    workspaceRoot,
    currentFile: reportFailureTarget,
    compatibilityFile,
    authoritativeFile,
    translationsRoot,
    outputDirectory: reportFailureCandidate,
    scenarioId,
  })
  await assert.rejects(
    publishRawStoryPromotion({
      workspaceRoot,
      candidateDirectory: reportFailureCandidate,
      compiledDirectory: reportFailureCompiled,
      translationsRoot,
      backupDirectory: path.join(temporaryRoot, 'report-failure-backup'),
      confirmScenario: scenarioId,
      reportWrite: async () => {
        throw new Error('injected backup manifest failure')
      },
    }),
    /injected backup manifest failure/u,
  )
  assert.equal(hashBytes(await readFile(reportFailureTarget)), hashBytes(oldBytes))

  await assert.rejects(
    buildRawStoryPromotionCandidate({
      workspaceRoot,
      currentFile: rollbackTarget,
      compatibilityFile,
      authoritativeFile,
      translationsRoot,
      outputDirectory: path.join(workspaceRoot, 'public', 'forbidden-raw-promotion-candidate'),
      scenarioId,
    }),
    /outside public/u,
  )
  await assert.rejects(
    buildRawStoryPromotionCandidate({
      workspaceRoot,
      currentFile: rollbackTarget,
      compatibilityFile,
      authoritativeFile,
      translationsRoot,
      outputDirectory: path.join(workspaceRoot, 'fixtures', 'forbidden-raw-promotion-candidate'),
      scenarioId,
    }),
    /under \.analysis/u,
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

console.log('RAW story single-promotion verification passed')
console.log('  episode-only enrichment, strict schema/projection, inline and overlay localization gates covered')
console.log('  explicit confirmation, exact backup, atomic publish, rollback and public candidate isolation covered')
