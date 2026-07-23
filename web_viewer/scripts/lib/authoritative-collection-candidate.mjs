import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  compareAuthoritativeRuntimeProjection,
  compileAuthoritativeScenario,
} from './authoritative-scenario-compiler.mjs'
import { buildCompiledScenarioMigrationReport } from './compiled-scenario-migration.mjs'

const hashBytes = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8')

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function resolveInside(root, relative) {
  const target = path.resolve(root, relative)
  const relation = path.relative(root, target)
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) {
    throw new Error(`Path escapes collection root: ${relative}`)
  }
  return target
}

function assertOutsideWorkspace(workspaceRoot, outputDirectory) {
  const relation = path.relative(workspaceRoot, outputDirectory)
  if (!relation || (!relation.startsWith('..') && !path.isAbsolute(relation))) {
    throw new Error('Authoritative collection candidate must remain outside the web_viewer workspace')
  }
}

export async function buildAuthoritativeCollectionCandidate({
  workspaceRoot,
  compiledDirectory,
  outputDirectory,
  groupId,
  compilerVersion,
  authoritativeDirectory = null,
  compatibilityDirectory = null,
}) {
  const workspace = path.resolve(workspaceRoot)
  const compiled = path.resolve(compiledDirectory)
  const output = path.resolve(outputDirectory)
  const authoritative = authoritativeDirectory ? path.resolve(authoritativeDirectory) : null
  const compatibility = compatibilityDirectory ? path.resolve(compatibilityDirectory) : null
  assertOutsideWorkspace(workspace, output)
  if (authoritative) assertOutsideWorkspace(workspace, authoritative)
  if (compatibility) assertOutsideWorkspace(workspace, compatibility)
  try {
    if ((await readdir(output)).length) throw new Error(`Candidate output directory must be empty: ${output}`)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const schema = await readJson(path.join(workspace, 'schemas', 'compiled-scenario-v2-authoritative.schema.json'))
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  const aggregateRelative = `${groupId}.json`
  const aggregatePath = resolveInside(compiled, aggregateRelative)
  const formalAggregate = await readJson(aggregatePath)
  if (formalAggregate.scenario_id !== groupId) throw new Error('Aggregate scenario identity mismatch')
  const episodeIds = (formalAggregate.episodes || []).map(episode => String(episode.source_scenario_id || ''))
  if (!episodeIds.length || new Set(episodeIds).size !== episodeIds.length || episodeIds.some(id => !id.startsWith(`${groupId}_`))) {
    throw new Error('Aggregate episode identities are incomplete or invalid')
  }

  const inputs = [
    { role: 'aggregate', relative: aggregateRelative, formalValue: formalAggregate },
    ...await Promise.all(episodeIds.map(async episodeId => ({
      role: 'episode',
      relative: `episodes/${episodeId}.json`,
      formalValue: await readJson(resolveInside(compiled, `episodes/${episodeId}.json`)),
    }))),
  ]
  const artifacts = []
  for (const input of inputs) {
    const expectedId = input.role === 'aggregate' ? groupId : path.basename(input.relative, '.json')
    if (input.formalValue.scenario_id !== expectedId) throw new Error(`Scenario identity mismatch: ${input.relative}`)
    const value = compatibility
      ? await readJson(resolveInside(compatibility, input.relative))
      : input.formalValue
    if (value.scenario_id !== expectedId) throw new Error(`Compatibility scenario identity mismatch: ${input.relative}`)
    const migrationAudit = compatibility
      ? buildCompiledScenarioMigrationReport(input.formalValue, value)
      : null
    if (migrationAudit && !migrationAudit.acceptance.passed) {
      throw new Error(`${input.relative}: compatibility migration audit rejected intermediate input`)
    }
    const authoritativePath = authoritative ? resolveInside(authoritative, input.relative) : null
    const candidateBytes = authoritativePath
      ? await readFile(authoritativePath)
      : null
    const candidate = candidateBytes
      ? JSON.parse(candidateBytes)
      : compileAuthoritativeScenario(value, { compilerVersion })
    if (candidate.scenario_id !== expectedId) {
      throw new Error(`Authoritative scenario identity mismatch: ${input.relative}`)
    }
    if (candidate.compiler_version !== compilerVersion) {
      throw new Error(`Authoritative compiler version mismatch: ${input.relative}`)
    }
    if (input.role === 'aggregate') {
      const candidateEpisodeIds = (candidate.episodes || []).map(episode => String(episode.source_scenario_id || ''))
      if (JSON.stringify(candidateEpisodeIds) !== JSON.stringify(episodeIds)) {
        throw new Error('Authoritative aggregate episode identities do not match the formal collection')
      }
    }
    if (!validate(candidate)) throw new Error(`${input.relative}: ${ajv.errorsText(validate.errors)}`)
    const equivalence = compareAuthoritativeRuntimeProjection(value, candidate)
    if (!equivalence.passed) {
      throw new Error(`${input.relative}: projection drift: ${equivalence.differences.join(', ') || 'migration audit rejected candidate'}`)
    }
    const oldBytes = await readFile(resolveInside(compiled, input.relative))
    const acceptedCandidateBytes = candidateBytes || jsonBytes(candidate)
    const compatibilityBytes = compatibility ? await readFile(resolveInside(compatibility, input.relative)) : null
    const compatibilityEvidence = compatibility
      ? `_evidence/compatibility/${input.relative.replaceAll('\\', '/')}`
      : null
    artifacts.push({
      ...input,
      value,
      candidate,
      candidateBytes: acceptedCandidateBytes,
      compatibilityBytes,
      record: {
        role: input.role,
        file: input.relative.replaceAll('\\', '/'),
        scenario_id: candidate.scenario_id,
        steps: candidate.steps.length,
        voice_references: candidate.steps.filter(step => Boolean(step.dialogue?.voice)).length,
        old_hash: hashBytes(oldBytes),
        candidate_hash: hashBytes(acceptedCandidateBytes),
        schema_valid: true,
        runtime_text_equivalent: true,
        compatibility_evidence: compatibilityEvidence
          ? {
              file: compatibilityEvidence,
              hash: hashBytes(compatibilityBytes),
            }
          : null,
        migration_audit: migrationAudit
          ? {
              added_text_units: migrationAudit.text_identity.added_unit_ids.length,
              non_text_differences: migrationAudit.non_text_differences.count,
              dialogue_audio_unchanged: migrationAudit.dialogue_audio.unchanged,
              choice_targets_unchanged: migrationAudit.choice_targets.unchanged,
              episode_boundaries_unchanged: migrationAudit.episode_boundaries.unchanged,
            }
          : null,
      },
    })
  }

  await mkdir(output, { recursive: true })
  for (const artifact of artifacts) {
    const target = resolveInside(output, artifact.relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, artifact.candidateBytes)
    if (artifact.compatibilityBytes) {
      const evidenceTarget = resolveInside(output, artifact.record.compatibility_evidence.file)
      await mkdir(path.dirname(evidenceTarget), { recursive: true })
      await writeFile(evidenceTarget, artifact.compatibilityBytes)
    }
  }
  const manifest = {
    schema_version: 1,
    candidate_kind: 'authoritative-story-v2-collection',
    group_id: groupId,
    compiler_version: compilerVersion,
    runtime_contract: 'story-runtime-v2',
    candidate_source: authoritative ? 'precompiled-authoritative' : 'compatibility-projection',
    compatibility_source: compatibility ? 'audited-external-recompile' : 'formal-corpus',
    files: artifacts.map(artifact => artifact.record),
    totals: {
      files: artifacts.length,
      episodes: artifacts.filter(artifact => artifact.role === 'episode').length,
      steps: artifacts.reduce((sum, artifact) => sum + artifact.record.steps, 0),
      voice_references: artifacts.reduce((sum, artifact) => sum + artifact.record.voice_references, 0),
    },
  }
  await writeFile(path.join(output, 'authoritative_candidate_manifest.json'), jsonBytes(manifest))
  return manifest
}

export { hashBytes, jsonBytes, resolveInside }
