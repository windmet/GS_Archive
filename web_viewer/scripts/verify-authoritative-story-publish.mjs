import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAuthoritativeCollectionCandidate, resolveInside } from './lib/authoritative-collection-candidate.mjs'
import { atomicWriteFrom, publishAuthoritativeCollection } from './lib/authoritative-collection-publisher.mjs'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'sidem-authoritative-publish-'))
const compiled = path.join(temporaryRoot, 'compiled')
const candidate = path.join(temporaryRoot, 'candidate')
const backup = path.join(temporaryRoot, 'backup')
const fixture = JSON.parse(await readFile(path.join(workspaceRoot, 'fixtures', 'story-runtime', 'authoritative-v2-minimal.json'), 'utf8'))
const compatibilityFixture = {
  ...fixture,
  compiler_version: 'compatibility-fixture-1',
  runtime_contract: 'story-runtime-v2-compat',
  steps: fixture.steps.map(step => ({
    ...step,
    state: { bg: step.entry_snapshot.bg },
    dialogue: step.dialogue ? { ...step.dialogue, text_jp: step.dialogue.source_text } : undefined,
  })),
}
const aggregate = {
  ...compatibilityFixture,
  scenario_id: 'fixture',
  text_catalog_id: 'fixture',
  episodes: [{
    source_scenario_id: 'fixture_a',
    episode_index: 0,
    start_step_id: 1,
    end_step_id: 1,
  }],
}
const episode = { ...compatibilityFixture, scenario_id: 'fixture_a', text_catalog_id: 'fixture' }
await mkdir(path.join(compiled, 'episodes'), { recursive: true })
await writeFile(path.join(compiled, 'fixture.json'), `${JSON.stringify(aggregate, null, 2)}\n`)
await writeFile(path.join(compiled, 'episodes', 'fixture_a.json'), `${JSON.stringify(episode, null, 2)}\n`)

const manifest = await buildAuthoritativeCollectionCandidate({
  workspaceRoot,
  compiledDirectory: compiled,
  outputDirectory: candidate,
  groupId: 'fixture',
  compilerVersion: 'publish-verifier-1',
})
assert.equal(manifest.files.length, 2)
assert.equal(manifest.totals.episodes, 1)
assert.equal(manifest.totals.steps, 2)
assert.ok(manifest.files.every(record => record.schema_valid && record.runtime_text_equivalent))

await assert.rejects(
  publishAuthoritativeCollection({
    workspaceRoot,
    candidateDirectory: candidate,
    compiledDirectory: compiled,
    backupDirectory: path.join(temporaryRoot, 'wrong-confirm-backup'),
    confirmGroup: 'wrong',
  }),
  /Explicit group confirmation/,
)

const report = await publishAuthoritativeCollection({
  workspaceRoot,
  candidateDirectory: candidate,
  compiledDirectory: compiled,
  backupDirectory: backup,
  confirmGroup: 'fixture',
})
assert.equal(report.files.length, 2)
assert.ok(report.files.every(record => record.old_hash === record.backup_hash))
assert.equal(JSON.parse(await readFile(path.join(compiled, 'fixture.json'), 'utf8')).runtime_contract, 'story-runtime-v2')
assert.equal(JSON.parse(await readFile(path.join(backup, 'fixture.json'), 'utf8')).runtime_contract, 'story-runtime-v2-compat')
assert.ok((await readFile(path.join(backup, 'authoritative_publish_backup_manifest.json'))).length > 0)

await assert.rejects(
  publishAuthoritativeCollection({
    workspaceRoot,
    candidateDirectory: candidate,
    compiledDirectory: compiled,
    backupDirectory: backup,
    confirmGroup: 'fixture',
  }),
  /must be empty/,
)

await assert.rejects(
  publishAuthoritativeCollection({
    workspaceRoot,
    candidateDirectory: candidate,
    compiledDirectory: compiled,
    backupDirectory: path.join(temporaryRoot, 'drift-backup'),
    confirmGroup: 'fixture',
  }),
  /Formal corpus drift/,
)

const rollbackCompiled = path.join(temporaryRoot, 'rollback-compiled')
const rollbackCandidate = path.join(temporaryRoot, 'rollback-candidate')
const rollbackBackup = path.join(temporaryRoot, 'rollback-backup')
await mkdir(path.join(rollbackCompiled, 'episodes'), { recursive: true })
await writeFile(path.join(rollbackCompiled, 'fixture.json'), await readFile(path.join(backup, 'fixture.json')))
await writeFile(
  path.join(rollbackCompiled, 'episodes', 'fixture_a.json'),
  await readFile(path.join(backup, 'episodes', 'fixture_a.json')),
)
await buildAuthoritativeCollectionCandidate({
  workspaceRoot,
  compiledDirectory: rollbackCompiled,
  outputDirectory: rollbackCandidate,
  groupId: 'fixture',
  compilerVersion: 'rollback-verifier-1',
})
let publishWrites = 0
await assert.rejects(
  publishAuthoritativeCollection({
    workspaceRoot,
    candidateDirectory: rollbackCandidate,
    compiledDirectory: rollbackCompiled,
    backupDirectory: rollbackBackup,
    confirmGroup: 'fixture',
    publishWrite: async (source, target) => {
      publishWrites++
      if (publishWrites === 2) throw new Error('injected second-file publish failure')
      return atomicWriteFrom(source, target)
    },
  }),
  /injected second-file publish failure/,
)
assert.equal(JSON.parse(await readFile(path.join(rollbackCompiled, 'fixture.json'), 'utf8')).runtime_contract, 'story-runtime-v2-compat')
assert.equal(
  JSON.parse(await readFile(path.join(rollbackCompiled, 'episodes', 'fixture_a.json'), 'utf8')).runtime_contract,
  'story-runtime-v2-compat',
)

assert.throws(() => resolveInside(compiled, '../escape.json'), /escapes collection root/)

console.log('Authoritative collection publish verification passed.')
console.log('  strict manifest, confirmation, hash preflight, atomic files, exact backups, rollback, drift and traversal rejection covered')
