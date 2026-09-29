// Publish the already-audited Work strict-v2 candidates as one bounded backfill.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseId = '2026-09-28-story-work-text-backfill-001'
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const read = async relative => fs.readFile(path.join(root, relative))
const json = async relative => JSON.parse(await read(relative))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const artifact = (relative, bytes) => ({
  path: `web_viewer/${relative}`,
  url: `/${relative.replace(/^public\//, '')}`,
  bytes: bytes.length,
  sha256: sha(bytes),
})
const serialize = data => Buffer.from(`${JSON.stringify(data, null, 2)}\n`)
const work = (await json('public/data/reading/manifest.json')).entries.filter(entry => entry.domain === 'work')
const ledger = await json('.analysis/local-story-strict-v2-r2/ledger.json')
const candidates = new Map()
for (const entry of ledger.entries.filter(entry => entry.status === 'strict-v2-candidate')) {
  if (!candidates.has(entry.candidate_scenario_id)) candidates.set(entry.candidate_scenario_id, [])
  candidates.get(entry.candidate_scenario_id).push(entry)
}
const registry = await json('public/data/authoritative_story_publications.json')
const releasePath = `public/data/publication/releases/${releaseId}.json`
const backupPath = 'docs/GS_WORK_TEXT_BACKFILL_BACKUP_20260928.json'
if (work.length !== 637) throw Error(`Work scope drifted: ${work.length}`)
if (registry.entries.some(entry => work.some(item => item.logical_id === entry.logical_id))) {
  throw Error('Work is already present in authoritative registry')
}
try { await read(releasePath); throw Error('Release already exists') } catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const releaseEntries = [], registryEntries = [], backups = [], oldCompiledBytes = []
let textRows = 0
for (const entry of work) {
  const logicalId = `story:${entry.scenario_id}`
  const matches = candidates.get(entry.scenario_id) || []
  if (matches.length !== 1) throw Error(`${entry.scenario_id}: expected one candidate, got ${matches.length}`)
  const candidate = matches[0]
  const candidateBytes = await read(`.analysis/local-story-strict-v2-r2/candidates/${candidate.candidate}`)
  if (`sha256:${sha(candidateBytes)}` !== candidate.candidate_sha256) throw Error(`${entry.scenario_id}: candidate hash drift`)
  const payload = JSON.parse(candidateBytes)
  if (payload.schema_version !== 2 || payload.runtime_contract !== 'story-runtime-v2' ||
      payload.scenario_id !== entry.scenario_id) throw Error(`${entry.scenario_id}: candidate identity drift`)
  const compiledPath = `public/data/compiled/${entry.source_file}`
  const readingPath = `public/data/reading/${entry.file}`
  const oldCompiled = await read(compiledPath)
  const oldReading = await read(readingPath)
  if (`sha256:${sha(oldCompiled)}` !== entry.source_sha256 ||
      `sha256:${sha(oldReading)}` !== entry.sha256) throw Error(`${entry.scenario_id}: mounted baseline drift`)
  const currentDoc = JSON.parse(oldReading)
  textRows += currentDoc.rows.filter(row => row.source_text).length
  backups.push({ scenario_id: entry.scenario_id, compiled: artifact(compiledPath, oldCompiled),
    reading: artifact(readingPath, oldReading) })
  oldCompiledBytes.push([compiledPath, oldCompiled])
  const source = {
    archive_relative_path: `asset/${candidate.bundle}`,
    sha256: candidate.bundle_sha256.replace(/^sha256:/, ''),
    objects: [{ type: 'TextAsset', name: `scenario_${candidate.part}`,
      container_path: candidate.container_path, path_id: null }],
  }
  releaseEntries.push({
    logical_id: logicalId, domain: 'story', source,
    semantic_evidence: [{ product: 'story_catalog', key: entry.scenario_id,
      evidence: 'Mounted Work catalog and Reader source; strict-v2 candidate row and non-text parity verified' }],
    transform: { tool: 'local-story-strict-v2-r2 + publish-work-text-backfill.mjs', contract_version: 2 },
    published: [artifact(compiledPath, candidateBytes)],
    consumers: ['Story Runtime', 'ReadingDocument', 'translation preflight'],
    comparison: { state: 'parity-verified', evidence: [
      'check-work-text-backfill-pilot.mjs: Work row parity and non-text projection parity',
      'candidate SHA-256 and mounted Reader/compiled SHA-256 checked before publication',
    ] },
    browser_acceptance: { state: 'not-tested', tested_url: null, tested_at: null,
      tested_commit: null, environment: null, evidence: [] },
    previous_state: { kind: 'unmanaged-existing', release_id: null,
      artifacts: [artifact(compiledPath, oldCompiled)],
      evidence: [`Git baseline ${sourceCommit}`, backupPath] },
    rollback_evidence: { performed: false, backup_manifest: null,
      restored_artifacts: [], final_republish_verified: false },
  })
  registryEntries.push({ logical_id: logicalId, kind: 'standalone',
    scenario_id: entry.scenario_id,
    ownership: { state: 'ledger-governed', release_id: releaseId },
    artifacts: [{ path: compiledPath, role: 'standalone' }],
    evidence: [`publication release ${releaseId}`, 'Work catalog source and strict-v2 row/non-text parity'] })
}
if (textRows !== 4103) throw Error(`Work text scope drifted: ${textRows}`)
const release = { schema_version: 2, release_id: releaseId,
  created_at: new Date().toISOString(), prepared_from_commit: sourceCommit,
  transaction_kind: 'backfill', scope: { kind: 'batch', ids: work.map(entry => entry.scenario_id) },
  entries: releaseEntries }
const backup = { schema_version: 1, release_id: releaseId, source_commit: sourceCommit,
  recovery: 'Restore old compiled bytes from the prepublication backup, and Reading/registry from source_commit; regenerate derived manifests and record a rollback release.',
  files: backups,
  registry: artifact('public/data/authoritative_story_publications.json', await read('public/data/authoritative_story_publications.json')),
  reading_manifest: artifact('public/data/reading/manifest.json', await read('public/data/reading/manifest.json')),
  reading_coverage: artifact('public/data/reading/coverage.json', await read('public/data/reading/coverage.json')) }
const writes = releaseEntries.map((item, index) => [
  item.published[0].path.replace(/^web_viewer\//, ''),
  `.analysis/local-story-strict-v2-r2/candidates/${candidates.get(work[index].scenario_id)[0].candidate}`,
])
// All preflight checks above finish before the first mounted write.
const backupRoot = path.join(root, '.analysis/work-text-backfill/prepublish')
for (const [target, bytes] of oldCompiledBytes) {
  const destination = path.join(backupRoot, target)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.writeFile(destination, bytes, { flag: 'wx' })
}
for (const [target, source] of writes) await fs.copyFile(path.join(root, source), path.join(root, target))
registry.entries.push(...registryEntries)
await fs.writeFile(path.join(root, 'public/data/authoritative_story_publications.json'), serialize(registry))
await fs.writeFile(path.join(root, releasePath), serialize(release))
await fs.writeFile(path.join(root, backupPath), serialize(backup))
console.log(`Published ${work.length} Work compiled sources, ${textRows} text rows; release ${releaseId}; baseline ${sourceCommit}`)
