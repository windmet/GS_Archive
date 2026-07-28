import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  buildPublicationManifest,
  currentStateBefore,
  findAbsolutePathStrings,
  manifestPath,
  projectRoot,
  readReleaseFiles,
  repositoryRoot,
  schemaPath,
  stableJson,
  verifyPublishedArtifact,
} from './lib/publication-ledger.mjs'

const failures = []
const [schema, committedManifest] = await Promise.all(
  [schemaPath, manifestPath].map(filename => readFile(filename, 'utf8').then(JSON.parse)),
)
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validate = ajv.compile(schema)
const releases = readReleaseFiles()
const releaseIds = new Set()

for (const [releaseIndex, record] of releases.entries()) {
  const { filename, release } = record
  if (!validate(release)) {
    failures.push(
      ...validate.errors.map(error =>
        `${filename} schema ${error.instancePath || '/'} ${error.message}`,
      ),
    )
  }
  if (filename !== `${release.release_id}.json`) {
    failures.push(`${filename} does not match release_id ${release.release_id}`)
  }
  if (releaseIds.has(release.release_id)) failures.push(`duplicate release_id: ${release.release_id}`)
  releaseIds.add(release.release_id)
  if (findAbsolutePathStrings(release).length) {
    failures.push(`${filename} contains a machine absolute path`)
  }

  try {
    execFileSync(
      'git',
      ['merge-base', '--is-ancestor', release.prepared_from_commit, 'HEAD'],
      { cwd: projectRoot, stdio: 'ignore' },
    )
  } catch {
    failures.push(`${filename} prepared_from_commit is not an ancestor of HEAD`)
  }

  const logicalIds = new Set()
  for (const entry of release.entries || []) {
    if (logicalIds.has(entry.logical_id)) {
      failures.push(`${filename} repeats logical_id ${entry.logical_id}`)
    }
    logicalIds.add(entry.logical_id)

    const previous = currentStateBefore(releases, releaseIndex, entry.logical_id)
    const expectedPreviousRelease = previous?.release_id || null
    if (entry.previous_state.release_id !== expectedPreviousRelease) {
      failures.push(
        `${filename} previous release for ${entry.logical_id} must be ` +
        `${expectedPreviousRelease || 'null'}`,
      )
    }
    if (
      stableJson(entry.previous_state.artifacts) !==
      stableJson(previous?.artifacts || [])
    ) {
      failures.push(`${filename} previous artifacts drifted for ${entry.logical_id}`)
    }

    if (release.transaction_kind === 'rollback') {
      if (!entry.rollback_evidence.performed) {
        failures.push(`${filename} rollback must record performed=true`)
      }
      if (
        stableJson(entry.rollback_evidence.restored_artifacts) !==
        stableJson(entry.published)
      ) {
        failures.push(`${filename} rollback restored artifacts differ from published state`)
      }
    }
  }
}

const generated = buildPublicationManifest(releases)
if (stableJson(generated) !== stableJson(buildPublicationManifest(releases))) {
  failures.push('publication manifest generation is not deterministic')
}
if (stableJson(committedManifest) !== stableJson(generated)) {
  failures.push('committed publication manifest differs from release history')
}

for (const state of Object.values(generated.by_logical_id)) {
  for (const artifact of state.artifacts) {
    const failure = verifyPublishedArtifact(artifact)
    if (failure) failures.push(failure)
    try {
      execFileSync(
        'git',
        ['ls-files', '--error-unmatch', '--', artifact.path],
        { cwd: repositoryRoot, stdio: 'ignore' },
      )
    } catch {
      failures.push(`current stable artifact is not Git tracked: ${artifact.path}`)
    }
  }
}

if (releases.length === 0) {
  if (
    committedManifest.schema_version !== 1 ||
    committedManifest.generated_from.length !== 0 ||
    Object.keys(committedManifest.by_logical_id).length !== 0
  ) {
    failures.push('empty release history must generate an empty manifest')
  }
}

const schemaFixture = {
  schema_version: 1,
  release_id: '2099-01-01-story-fixture-001',
  created_at: '2099-01-01T00:00:00Z',
  prepared_from_commit: '0'.repeat(40),
  transaction_kind: 'publish',
  scope: { kind: 'collection', ids: ['fixture'] },
  entries: [{
    logical_id: 'story-collection:fixture',
    domain: 'story',
    source: {
      archive_relative_path: 'asset/scenario_fixture.unity3d',
      sha256: '0'.repeat(64),
      objects: [{
        type: 'TextAsset',
        name: 'scenario_fixture',
        container_path: 'assets/resources/scenariodata/fixture.json',
        path_id: 1,
      }],
    },
    semantic_evidence: [{
      product: 'story_master_index',
      key: 'fixture',
      evidence: 'schema fixture only',
    }],
    transform: { tool: 'fixture.mjs', contract_version: 1 },
    published: [{
      path: 'web_viewer/public/data/compiled/fixture.json',
      url: '/data/compiled/fixture.json',
      bytes: 1,
      sha256: '0'.repeat(64),
    }],
    consumers: ['StoryViewer'],
    comparison: { state: 'parity-verified', evidence: ['fixture'] },
    browser_acceptance: {
      state: 'not-tested',
      tested_url: null,
      tested_at: null,
      evidence: [],
    },
    previous_state: { release_id: null, artifacts: [] },
    rollback_evidence: {
      performed: false,
      backup_manifest: null,
      restored_artifacts: [],
      final_republish_verified: false,
    },
  }],
}
if (!validate(schemaFixture)) {
  failures.push(
    ...validate.errors.map(error =>
      `embedded schema fixture ${error.instancePath || '/'} ${error.message}`,
    ),
  )
}

if (failures.length) {
  console.error('Publication ledger verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(
    `Publication ledger verified: ${releases.length} releases / ` +
    `${Object.keys(generated.by_logical_id).length} stable logical IDs`,
  )
}
