import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  compareAuthoritativeRuntimeProjection,
  compileAuthoritativeScenario,
} from './authoritative-scenario-compiler.mjs'

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
}) {
  const workspace = path.resolve(workspaceRoot)
  const compiled = path.resolve(compiledDirectory)
  const output = path.resolve(outputDirectory)
  assertOutsideWorkspace(workspace, output)
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
  const aggregate = await readJson(aggregatePath)
  if (aggregate.scenario_id !== groupId) throw new Error('Aggregate scenario identity mismatch')
  const episodeIds = (aggregate.episodes || []).map(episode => String(episode.source_scenario_id || ''))
  if (!episodeIds.length || new Set(episodeIds).size !== episodeIds.length || episodeIds.some(id => !id.startsWith(`${groupId}_`))) {
    throw new Error('Aggregate episode identities are incomplete or invalid')
  }

  const inputs = [
    { role: 'aggregate', relative: aggregateRelative, value: aggregate },
    ...await Promise.all(episodeIds.map(async episodeId => ({
      role: 'episode',
      relative: `episodes/${episodeId}.json`,
      value: await readJson(resolveInside(compiled, `episodes/${episodeId}.json`)),
    }))),
  ]
  const artifacts = []
  for (const input of inputs) {
    const expectedId = input.role === 'aggregate' ? groupId : path.basename(input.relative, '.json')
    if (input.value.scenario_id !== expectedId) throw new Error(`Scenario identity mismatch: ${input.relative}`)
    const candidate = compileAuthoritativeScenario(input.value, { compilerVersion })
    if (!validate(candidate)) throw new Error(`${input.relative}: ${ajv.errorsText(validate.errors)}`)
    const equivalence = compareAuthoritativeRuntimeProjection(input.value, candidate)
    if (!equivalence.passed) throw new Error(`${input.relative}: projection drift: ${equivalence.differences.join(', ')}`)
    const oldBytes = await readFile(resolveInside(compiled, input.relative))
    const candidateBytes = jsonBytes(candidate)
    artifacts.push({
      ...input,
      candidate,
      candidateBytes,
      record: {
        role: input.role,
        file: input.relative.replaceAll('\\', '/'),
        scenario_id: candidate.scenario_id,
        steps: candidate.steps.length,
        voice_references: candidate.steps.filter(step => Boolean(step.dialogue?.voice)).length,
        old_hash: hashBytes(oldBytes),
        candidate_hash: hashBytes(candidateBytes),
        schema_valid: true,
        runtime_text_equivalent: true,
      },
    })
  }

  await mkdir(output, { recursive: true })
  for (const artifact of artifacts) {
    const target = resolveInside(output, artifact.relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, artifact.candidateBytes)
  }
  const manifest = {
    schema_version: 1,
    candidate_kind: 'authoritative-story-v2-collection',
    group_id: groupId,
    compiler_version: compilerVersion,
    runtime_contract: 'story-runtime-v2',
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
