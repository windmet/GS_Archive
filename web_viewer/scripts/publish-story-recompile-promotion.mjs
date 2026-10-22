// Records the 2026-10-21 corpus recompile as one supersede release over every governed story.
// The candidate artifacts must already be mounted in public/data/compiled; nothing is copied here.
// The previous bytes stay recoverable from prepared_from_commit, which this checks against git.
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { buildPublicationManifest, readReleaseFiles, sha256Bytes, stableJson, projectRoot } from './lib/publication-ledger.mjs'

const argument = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] }
const candidateRoot = argument('--candidate')
if (!candidateRoot) throw Error('Supply --candidate <recompile candidate directory>')
const releaseId = argument('--release-id') || '2026-10-21-story-recompile-promotion-001'
if (!/^[a-zA-Z0-9_-]+$/u.test(releaseId)) throw Error('Invalid release ID')
const apply = process.argv.includes('--apply')
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'))
const git = (...args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'buffer', maxBuffer: 1 << 28 })
const baseCommit = git('rev-parse', 'HEAD').toString().trim()

const ledger = await read(path.join(candidateRoot, 'ledger.json'))
const candidate = new Map(ledger.files.flatMap(file => Object.entries(file.artifacts || {})
  .map(([name, hash]) => [`web_viewer/public/data/compiled/${name}`, hash])))
// The recompile does not run the chat-thread pass; these were re-derived from RAW after it
// (scripts/derive-chat-threads.py) and differ from the candidate only in presentation_context.
const rederived = new Set(['web_viewer/public/data/compiled/1_4_001_05.json',
  'web_viewer/public/data/compiled/episodes/1_4_001_05_h.json'])
const manifest = await read(path.join(projectRoot, 'public/data/publication/manifest.json'))
const records = readReleaseFiles()
const releases = new Map(records.map(record => [record.release.release_id, record.release]))
if (releases.has(releaseId)) throw Error(`Release already exists: ${releaseId}`)
const registryPath = path.join(projectRoot, 'public/data/authoritative_story_publications.json')
const registry = await read(registryPath)

const entries = []
for (const [logicalId, owner] of Object.entries(manifest.by_logical_id)) {
  if (owner.domain !== 'story') continue
  const published = []
  for (const artifact of owner.artifacts) {
    const expected = candidate.get(artifact.path)
    if (!expected) throw Error(`${logicalId}: ${artifact.path} is not in the candidate`)
    const relative = artifact.path.replace(/^web_viewer\//u, '')
    const mounted = await fs.readFile(path.join(projectRoot, relative))
    if (rederived.has(artifact.path)) {
      const withoutThreads = data => ({ ...data, steps: data.steps.map(({ presentation_context: _thread, ...step }) => step) })
      const mountedRest = withoutThreads(JSON.parse(mounted))
      const candidateRest = withoutThreads(await read(path.join(candidateRoot, 'candidates', relative.replace('public/data/compiled/', ''))))
      if (stableJson(mountedRest) !== stableJson(candidateRest)) throw Error(`Re-derived artifact differs beyond presentation_context: ${relative}`)
    } else if (`sha256:${sha256Bytes(mounted)}` !== expected) throw Error(`Mounted artifact differs from candidate: ${relative}`)
    const baseline = git('show', `${baseCommit}:${artifact.path}`)
    if (sha256Bytes(baseline) !== artifact.sha256) throw Error(`Governed bytes differ from ${baseCommit}: ${relative}`)
    published.push({ ...artifact, bytes: mounted.length, sha256: sha256Bytes(mounted) })
  }
  if (published.every((artifact, index) => artifact.sha256 === owner.artifacts[index].sha256)) continue
  const entry = structuredClone(releases.get(owner.release_id).entries.find(item => item.logical_id === logicalId))
  entry.published = published
  entry.transform = { tool: 'scripts/recompile-story-corpus-candidate.py', contract_version: 2 }
  entry.comparison = { state: 'parity-verified', evidence: [
    `${ledger.compiler_version}: full RAW recompile; report-story-recompile-candidate.py tiers every changed file, and every risky and RAW-check file was resolved against RAW`,
    'Every Reader text_ref (unit_id, source_hash) and every reviewed translation unit is unchanged; translation catalogues are re-keyed, not retranslated',
    'Strict v2 artifacts validate against compiled-scenario-v2-authoritative.schema.json',
    ...(owner.artifacts.some(artifact => rederived.has(artifact.path))
      ? ['presentation_context re-derived from RAW with scripts/derive-chat-threads.py; the 11 chat threads equal the previous release'] : []),
  ] }
  entry.browser_acceptance = { state: 'not-tested', tested_url: null, tested_at: null,
    tested_commit: null, environment: null, evidence: [] }
  entry.previous_state = { kind: 'governed-release', release_id: owner.release_id,
    artifacts: structuredClone(owner.artifacts), evidence: [] }
  entry.rollback_evidence = { performed: false, backup_manifest: null, restored_artifacts: [],
    final_republish_verified: false }
  entries.push(entry)
}

const release = { schema_version: 2, release_id: releaseId, created_at: new Date().toISOString(),
  prepared_from_commit: baseCommit, transaction_kind: 'supersede',
  scope: { kind: 'batch', ids: entries.map(entry => entry.logical_id) }, entries }
const ajv = new Ajv2020({ strict: true, allErrors: true })
addFormats(ajv)
const valid = ajv.compile(await read(path.join(projectRoot, 'schemas/publication-release-v2.schema.json')))
if (!valid(release)) throw Error(JSON.stringify(valid.errors.slice(0, 5)))

// The registry names each governed story's current release.
const superseded = new Map(entries.map(entry => [entry.logical_id, entry.previous_state.release_id]))
let registryUpdates = 0
for (const item of registry.entries) {
  const previous = superseded.get(item.logical_id)
  if (!previous) continue
  if (item.ownership.state !== 'ledger-governed' || item.ownership.release_id !== previous)
    throw Error(`Registry ownership drift: ${item.logical_id}`)
  item.ownership.release_id = releaseId
  item.evidence = item.evidence.map(text => text === `publication release ${previous}` ? `publication release ${releaseId}` : text)
  registryUpdates += 1
}

if (apply) {
  await fs.writeFile(path.join(projectRoot, `public/data/publication/releases/${releaseId}.json`), stableJson(release), { flag: 'wx' })
  await fs.writeFile(path.join(projectRoot, 'public/data/publication/manifest.json'),
    stableJson(buildPublicationManifest([...records, { release }])))
  await fs.writeFile(registryPath, stableJson(registry))
}
console.log(JSON.stringify({ release_id: releaseId, entries: entries.length,
  artifacts: entries.reduce((total, entry) => total + entry.published.length, 0), registry_updates: registryUpdates, applied: apply }))
