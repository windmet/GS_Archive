import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  appendOnlyLedgerFailures,
  annotationIndexPath,
  annotationSchemaPaths,
  buildAnnotationIndex,
  buildPublicationManifest,
  currentStateBefore,
  findAbsolutePathStrings,
  manifestPath,
  projectRoot,
  readAnnotationRecords,
  readReleaseFiles,
  releaseSchemaPaths,
  repositoryRoot,
  stableJson,
  verifyPublishedArtifact,
  versionPolicyPath,
  versionPolicySchemaPath,
} from './lib/publication-ledger.mjs'

const failures = []
const readJson = filename => readFile(filename, 'utf8').then(JSON.parse)
const [
  committedManifest,
  committedAnnotationIndex,
  versionPolicy,
  versionPolicySchema,
] = await Promise.all([
  manifestPath,
  annotationIndexPath,
  versionPolicyPath,
  versionPolicySchemaPath,
].map(readJson))
const releaseSchemas = Object.fromEntries(await Promise.all(
  Object.entries(releaseSchemaPaths).map(async ([version, filename]) =>
    [version, await readJson(filename)]),
))
const annotationSchemas = Object.fromEntries(await Promise.all(
  Object.entries(annotationSchemaPaths).map(async ([version, filename]) =>
    [version, await readJson(filename)]),
))
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const releaseValidators = Object.fromEntries(
  Object.entries(releaseSchemas).map(([version, schema]) => [version, ajv.compile(schema)]),
)
const annotationValidators = Object.fromEntries(
  Object.entries(annotationSchemas).map(([version, schema]) => [version, ajv.compile(schema)]),
)
const validateVersionPolicy = ajv.compile(versionPolicySchema)
if (!validateVersionPolicy(versionPolicy)) {
  failures.push(
    ...validateVersionPolicy.errors.map(error =>
      `version policy schema ${error.instancePath || '/'} ${error.message}`,
    ),
  )
}
const releases = readReleaseFiles()
const releaseIds = new Set()

for (const [releaseIndex, record] of releases.entries()) {
  const { filename, release } = record
  const versionRule = versionPolicy.release_versions[String(release.schema_version)]
  if (!versionRule) {
    failures.push(`${filename} uses unsupported release schema v${release.schema_version}`)
  } else if (versionRule.status === 'reserved') {
    failures.push(`${filename} uses reserved release schema v${release.schema_version}`)
  } else if (
    versionRule.status === 'frozen' &&
    !versionRule.allowed_release_ids.includes(release.release_id)
  ) {
    failures.push(`${filename} is not allowed by frozen release schema v${release.schema_version}`)
  }
  const validateRelease = releaseValidators[String(release.schema_version)]
  if (!validateRelease) {
    failures.push(`${filename} has no installed release validator for v${release.schema_version}`)
  } else if (!validateRelease(release)) {
    failures.push(
      ...validateRelease.errors.map(error =>
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
    if (release.schema_version === 1) {
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
    } else if (release.schema_version === 2) {
      const previousState = entry.previous_state
      if (previous) {
        if (previousState.kind !== 'governed-release') {
          failures.push(`${filename} ${entry.logical_id} must declare governed-release previous state`)
        }
        if (previousState.release_id !== expectedPreviousRelease) {
          failures.push(
            `${filename} previous release for ${entry.logical_id} must be ${expectedPreviousRelease}`,
          )
        }
        if (stableJson(previousState.artifacts) !== stableJson(previous.artifacts)) {
          failures.push(`${filename} previous artifacts drifted for ${entry.logical_id}`)
        }
      } else if (previousState.kind === 'governed-release') {
        failures.push(`${filename} ${entry.logical_id} has no governed previous release`)
      } else if (
        release.transaction_kind === 'publish' &&
        previousState.kind !== 'absent'
      ) {
        failures.push(`${filename} new publish ${entry.logical_id} must declare absent previous state`)
      } else if (
        ['replace', 'backfill'].includes(release.transaction_kind) &&
        previousState.kind !== 'unmanaged-existing'
      ) {
        failures.push(
          `${filename} first ${release.transaction_kind} for ${entry.logical_id} ` +
          'must declare unmanaged-existing previous state',
        )
      } else if (['rollback', 'republish'].includes(release.transaction_kind)) {
        failures.push(
          `${filename} ${release.transaction_kind} for ${entry.logical_id} requires governed history`,
        )
      }

      const acceptance = entry.browser_acceptance
      if (['sample-accepted', 'browser-accepted'].includes(acceptance.state)) {
        try {
          execFileSync(
            'git',
            ['merge-base', '--is-ancestor', acceptance.tested_commit, 'HEAD'],
            { cwd: projectRoot, stdio: 'ignore' },
          )
        } catch {
          failures.push(`${filename} browser tested_commit is not an ancestor of HEAD`)
        }
      }
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

for (const [version, versionRule] of Object.entries(versionPolicy.release_versions)) {
  const actualReleaseIds = releases
    .filter(({ release }) => String(release.schema_version) === version)
    .map(({ release }) => release.release_id)
    .sort()
  const allowedReleaseIds = [...versionRule.allowed_release_ids].sort()

  if (
    versionRule.status === 'frozen' &&
    stableJson(allowedReleaseIds) !== stableJson(actualReleaseIds)
  ) {
    failures.push(
      `frozen release schema v${version} allowlist must exactly match actual release IDs: ` +
      `allowed=${stableJson(allowedReleaseIds)} actual=${stableJson(actualReleaseIds)}`,
    )
  } else if (versionRule.status !== 'frozen' && allowedReleaseIds.length) {
    failures.push(
      `${versionRule.status} release schema v${version} must not define allowed release IDs`,
    )
  }
}

const annotations = readAnnotationRecords()
const annotationIds = new Set()
const annotationsById = new Map()
for (const { filename, annotation } of annotations) {
  const versionRule = versionPolicy.annotation_versions[String(annotation.schema_version)]
  const validateAnnotation = annotationValidators[String(annotation.schema_version)]
  if (!versionRule) {
    failures.push(`${filename} uses unsupported annotation schema v${annotation.schema_version}`)
  } else if (versionRule.status === 'reserved') {
    failures.push(`${filename} uses reserved annotation schema v${annotation.schema_version}`)
  }
  if (!validateAnnotation) {
    failures.push(`${filename} has no installed annotation validator for v${annotation.schema_version}`)
  } else if (!validateAnnotation(annotation)) {
    failures.push(
      ...validateAnnotation.errors.map(error =>
        `${filename} schema ${error.instancePath || '/'} ${error.message}`,
      ),
    )
  }
  if (filename !== `${annotation.annotation_id}.json`) {
    failures.push(`${filename} does not match annotation_id ${annotation.annotation_id}`)
  }
  if (annotationIds.has(annotation.annotation_id)) {
    failures.push(`duplicate annotation_id: ${annotation.annotation_id}`)
  }
  annotationIds.add(annotation.annotation_id)
  if (findAbsolutePathStrings(annotation).length) {
    failures.push(`${filename} contains a machine absolute path`)
  }

  const target = releases.find(({ release }) =>
    release.release_id === annotation.target_release_id)
  if (!target) {
    failures.push(`${filename} references missing release ${annotation.target_release_id}`)
  } else {
    const targetLogicalIds = new Set(target.release.entries.map(entry => entry.logical_id))
    for (const logicalId of annotation.scope.logical_ids || []) {
      if (!targetLogicalIds.has(logicalId)) {
        failures.push(`${filename} references logical_id ${logicalId} outside its target release`)
      }
    }
  }

  if (annotation.supersedes_annotation_id) {
    const superseded = annotationsById.get(annotation.supersedes_annotation_id)
    if (!superseded) {
      failures.push(
        `${filename} supersedes missing or non-earlier annotation ` +
        annotation.supersedes_annotation_id,
      )
    } else if (superseded.target_release_id !== annotation.target_release_id) {
      failures.push(`${filename} cannot supersede an annotation for another release`)
    }
  }

  try {
    execFileSync(
      'git',
      ['merge-base', '--is-ancestor', annotation.prepared_from_commit, 'HEAD'],
      { cwd: projectRoot, stdio: 'ignore' },
    )
  } catch {
    failures.push(`${filename} prepared_from_commit is not an ancestor of HEAD`)
  }
  annotationsById.set(annotation.annotation_id, annotation)
}

const generatedAnnotationIndex = buildAnnotationIndex(annotations)
if (stableJson(generatedAnnotationIndex) !== stableJson(buildAnnotationIndex(annotations))) {
  failures.push('annotation index generation is not deterministic')
}
if (stableJson(committedAnnotationIndex) !== stableJson(generatedAnnotationIndex)) {
  failures.push('committed annotation index differs from annotation history')
}

const generated = buildPublicationManifest(releases)
if (stableJson(generated) !== stableJson(buildPublicationManifest(releases))) {
  failures.push('publication manifest generation is not deterministic')
}
if (stableJson(generated) !== stableJson(buildPublicationManifest(releases, annotations))) {
  failures.push('annotations must not affect stable-state replay')
}
if (stableJson(committedManifest) !== stableJson(generated)) {
  failures.push('committed publication manifest differs from release history')
}

const baseShaIndex = process.argv.indexOf('--base-sha')
const baseSha = baseShaIndex >= 0 ? process.argv[baseShaIndex + 1] : ''
if (baseSha && !/^[a-f0-9]{40}$/.test(baseSha)) {
  failures.push(`invalid --base-sha: ${baseSha || '<missing>'}`)
} else if (baseSha && baseSha !== '0'.repeat(40)) {
  try {
    const ledgerChanges = execFileSync(
      'git',
      [
        'diff',
        '--name-status',
        `${baseSha}...HEAD`,
        '--',
        'web_viewer/public/data/publication/releases',
        'web_viewer/public/data/publication/annotations',
      ],
      { cwd: repositoryRoot, encoding: 'utf8' },
    ).trim()
    failures.push(...appendOnlyLedgerFailures(ledgerChanges))
  } catch (error) {
    failures.push(`could not verify append-only ledger diff: ${error.message}`)
  }
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
const validateV1Fixture = releaseValidators['1']
if (!validateV1Fixture(schemaFixture)) {
  failures.push(
    ...validateV1Fixture.errors.map(error =>
      `embedded v1 schema fixture ${error.instancePath || '/'} ${error.message}`,
    ),
  )
}

const artifactFixture = {
  path: 'web_viewer/public/data/compiled/fixture.json',
  url: '/data/compiled/fixture.json',
  bytes: 1,
  sha256: '0'.repeat(64),
}
const v2Fixture = {
  schema_version: 2,
  release_id: '2099-01-01-story-fixture-v2-001',
  created_at: '2099-01-01T00:00:00Z',
  prepared_from_commit: '0'.repeat(40),
  transaction_kind: 'publish',
  scope: { kind: 'collection', ids: ['fixture'] },
  entries: [{
    logical_id: 'story-collection:fixture-v2',
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
    transform: { tool: 'fixture.mjs', contract_version: 2 },
    published: [artifactFixture],
    consumers: ['StoryViewer'],
    comparison: { state: 'parity-verified', evidence: ['fixture parity'] },
    browser_acceptance: {
      state: 'browser-accepted',
      tested_url: 'http://127.0.0.1:5174/?view=story_detail',
      tested_at: '2099-01-01T00:00:00Z',
      tested_commit: '0'.repeat(40),
      environment: {
        browser_name: 'Fixture Browser',
        browser_version: '1.0',
        operating_system: 'Fixture OS',
        viewer_mode: 'local-dev',
      },
      evidence: ['fixture browser acceptance'],
    },
    previous_state: {
      kind: 'absent',
      release_id: null,
      artifacts: [],
      evidence: [],
    },
    rollback_evidence: {
      performed: false,
      backup_manifest: null,
      restored_artifacts: [],
      final_republish_verified: false,
    },
  }],
}
const annotationFixture = {
  schema_version: 1,
  annotation_id: '2099-01-02-annotation-story-fixture-001',
  target_release_id: v2Fixture.release_id,
  created_at: '2099-01-02T00:00:00Z',
  prepared_from_commit: '0'.repeat(40),
  kind: 'semantic-clarification',
  supersedes_annotation_id: null,
  scope: { logical_ids: ['story-collection:fixture-v2'] },
  statements: [{
    subject: 'entry',
    pointer: '/entries/0/semantic_evidence',
    statement: 'Fixture clarification without release-field replacement.',
    evidence: ['fixture evidence'],
  }],
}

function verifyFixture(validateFixture, fixture, label, expectedValid) {
  const valid = validateFixture(fixture)
  if (valid !== expectedValid) {
    const detail = valid
      ? 'unexpectedly passed'
      : (validateFixture.errors || [])
          .map(error => `${error.instancePath || '/'} ${error.message}`)
          .join('; ')
    failures.push(`${label} ${detail}`)
  }
}

const validateV2Fixture = releaseValidators['2']
const validateAnnotationFixture = annotationValidators['1']
verifyFixture(validateV2Fixture, v2Fixture, 'embedded v2 schema fixture', true)
verifyFixture(
  validateAnnotationFixture,
  annotationFixture,
  'embedded annotation schema fixture',
  true,
)

const unmanagedBackfillFixture = structuredClone(v2Fixture)
unmanagedBackfillFixture.transaction_kind = 'backfill'
unmanagedBackfillFixture.entries[0].previous_state = {
  kind: 'unmanaged-existing',
  release_id: null,
  artifacts: [artifactFixture],
  evidence: ['stable artifact predates the publication ledger'],
}
verifyFixture(
  validateV2Fixture,
  unmanagedBackfillFixture,
  'v2 unmanaged-existing backfill fixture',
  true,
)

const rollbackFixture = structuredClone(v2Fixture)
rollbackFixture.transaction_kind = 'rollback'
rollbackFixture.entries[0].previous_state = {
  kind: 'governed-release',
  release_id: '2098-12-31-story-fixture-v2-001',
  artifacts: [artifactFixture],
  evidence: [],
}
rollbackFixture.entries[0].rollback_evidence = {
  performed: true,
  backup_manifest: {
    path: 'web_viewer/.analysis/publication/fixture/backup-manifest.json',
    sha256: '1'.repeat(64),
    format: 'gs-archive-publication-backup',
    version: 1,
  },
  restored_artifacts: [artifactFixture],
  final_republish_verified: false,
}
verifyFixture(
  validateV2Fixture,
  rollbackFixture,
  'v2 rollback with backup-manifest identity',
  true,
)

const emptyPublishedFixture = structuredClone(v2Fixture)
emptyPublishedFixture.entries[0].published = []
verifyFixture(
  validateV2Fixture,
  emptyPublishedFixture,
  'v2 publish with empty published artifacts',
  false,
)

if (appendOnlyLedgerFailures(
  'A\tweb_viewer/public/data/publication/annotations/new.json',
).length !== 0) {
  failures.push('append-only fixture must allow a new annotation')
}
for (const fixture of [
  'M\tweb_viewer/public/data/publication/releases/existing.json',
  'D\tweb_viewer/public/data/publication/annotations/existing.json',
  'R100\tweb_viewer/public/data/publication/annotations/old.json\t' +
    'web_viewer/public/data/publication/annotations/new.json',
]) {
  if (appendOnlyLedgerFailures(fixture).length !== 1) {
    failures.push(`append-only fixture must reject historical mutation: ${fixture}`)
  }
}

const emptySourceObjectsFixture = structuredClone(v2Fixture)
emptySourceObjectsFixture.entries[0].source.objects = []
verifyFixture(
  validateV2Fixture,
  emptySourceObjectsFixture,
  'v2 release with empty RAW object identity',
  false,
)

const incompleteBrowserFixture = structuredClone(v2Fixture)
incompleteBrowserFixture.entries[0].browser_acceptance.environment = null
verifyFixture(
  validateV2Fixture,
  incompleteBrowserFixture,
  'v2 accepted browser evidence without environment',
  false,
)

const unmanagedWithoutArtifactsFixture = structuredClone(v2Fixture)
unmanagedWithoutArtifactsFixture.transaction_kind = 'backfill'
unmanagedWithoutArtifactsFixture.entries[0].previous_state = {
  kind: 'unmanaged-existing',
  release_id: null,
  artifacts: [],
  evidence: ['fixture'],
}
verifyFixture(
  validateV2Fixture,
  unmanagedWithoutArtifactsFixture,
  'v2 unmanaged previous state without artifacts',
  false,
)

const rollbackWithoutBackupIdentityFixture = structuredClone(rollbackFixture)
rollbackWithoutBackupIdentityFixture.entries[0].rollback_evidence.backup_manifest = null
verifyFixture(
  validateV2Fixture,
  rollbackWithoutBackupIdentityFixture,
  'v2 performed rollback without backup-manifest identity',
  false,
)

const ungovernedAnnotationFixture = structuredClone(annotationFixture)
ungovernedAnnotationFixture.replacement_value = 'forbidden'
verifyFixture(
  validateAnnotationFixture,
  ungovernedAnnotationFixture,
  'annotation attempting an ungoverned replacement field',
  false,
)

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
