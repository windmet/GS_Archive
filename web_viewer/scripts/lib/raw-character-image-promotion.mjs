import path from 'node:path'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { createHash } from 'node:crypto'

const PROMOTABLE_KINDS = new Set(['birthday_visual'])
const IDOL_CODE = /^\d{3}[a-z0-9]{3}$/i
const MAX_BATCH_SIZE = 5

export function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function resolveInput(workspaceRoot, value) {
  return path.resolve(workspaceRoot, value)
}

function isInside(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function requireInside(parent, child, label) {
  if (!isInside(parent, child)) {
    throw new Error(`${label} must stay under ${parent}`)
  }
}

async function pathState(file) {
  try {
    const info = await stat(file)
    return { exists: true, bytes: info.size, sha256: hashBytes(await readFile(file)) }
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, bytes: 0, sha256: null }
    throw error
  }
}

async function readJson(file, label) {
  let payload
  try {
    payload = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    throw new Error(`Cannot read ${label} ${file}: ${error.message}`)
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${label} must be a JSON object`)
  }
  return payload
}

function validateRegistry(registry) {
  if (registry.schema_version !== 1 || !Array.isArray(registry.entries)) {
    throw new Error('Promotion registry must have schema_version 1 and entries')
  }
  const keys = new Set()
  for (const entry of registry.entries) {
    const key = `${entry?.kind}:${entry?.idol_code}`
    if (
      !PROMOTABLE_KINDS.has(entry?.kind) ||
      !IDOL_CODE.test(entry?.idol_code || '') ||
      !String(entry?.asset_url || '').startsWith('/assets/')
    ) {
      throw new Error(`Invalid promotion registry entry ${key}`)
    }
    if (keys.has(key)) throw new Error(`Duplicate promotion registry entry ${key}`)
    keys.add(key)
  }
  for (const entry of registry.entries) {
    if (entry.shared_identity_ids == null) continue
    const identities = [...entry.shared_identity_ids].sort()
    if (
      identities.length < 2 ||
      new Set(identities).size !== identities.length ||
      !identities.includes(entry.idol_code)
    ) {
      throw new Error(
        `Invalid shared identity declaration for ${entry.kind}:${entry.idol_code}`,
      )
    }
    const peers = registry.entries.filter(candidate =>
      candidate.kind === entry.kind &&
      identities.includes(candidate.idol_code)
    )
    if (peers.length !== identities.length) {
      throw new Error(
        `Shared promotion ${entry.kind}:${identities.join('+')} is incomplete`,
      )
    }
    const fingerprints = new Set(peers.map(peer => JSON.stringify({
      identities: [...(peer.shared_identity_ids || [])].sort(),
      asset_url: peer.asset_url,
      raw_path: peer.raw_source?.relative_path,
      raw_sha256: peer.raw_source?.sha256,
      container_path: peer.unity_object?.container_path,
      path_id: peer.unity_object?.path_id,
      asset_name: peer.unity_object?.asset_name,
      output_sha256: peer.output?.sha256,
      output_bytes: peer.output?.bytes,
      width: peer.output?.width,
      height: peer.output?.height,
    })))
    if (fingerprints.size !== 1) {
      throw new Error(
        `Shared promotion ${entry.kind}:${identities.join('+')} evidence differs`,
      )
    }
  }
  return registry
}

function pngDimensions(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error('Candidate asset is not a PNG')
  }
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Candidate PNG has no IHDR header')
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}

async function atomicWriteBytes(target, bytes) {
  await mkdir(path.dirname(target), { recursive: true })
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const temporary = `${target}.raw-promotion-new-${suffix}`
  const previous = `${target}.raw-promotion-old-${suffix}`
  let movedPrevious = false
  await writeFile(temporary, bytes)
  try {
    const state = await pathState(target)
    if (state.exists) {
      await rename(target, previous)
      movedPrevious = true
    }
    await rename(temporary, target)
    if (movedPrevious) await rm(previous, { force: true })
  } catch (error) {
    await rm(temporary, { force: true })
    if (movedPrevious) {
      await rm(target, { force: true })
      await rename(previous, target)
    }
    throw error
  }
}

async function defaultAssetWrite(source, target) {
  await atomicWriteBytes(target, await readFile(source))
}

async function defaultRegistryWrite(target, bytes) {
  await atomicWriteBytes(target, bytes)
}

async function defaultReportWrite(target, bytes) {
  await atomicWriteBytes(target, bytes)
}

async function restorePrePromotionState({
  registryFile,
  targetFile,
  backupRegistryFile,
  backupAssetFile,
  targetExisted,
}) {
  await atomicWriteBytes(registryFile, await readFile(backupRegistryFile))
  if (targetExisted) {
    await atomicWriteBytes(targetFile, await readFile(backupAssetFile))
  } else {
    await rm(targetFile, { force: true })
  }
}

function stableTargetFor(candidate) {
  const assetName = candidate?.unity_object?.asset_name
  const expectedName = `image_chara_birthday_visual_${candidate.idol_code}`
  if (assetName !== expectedName) {
    throw new Error(`Stable promotion requires exact single-idol asset ${expectedName}`)
  }
  return {
    relativePath: `stories/birthday/${assetName}.png`,
    assetUrl: `/assets/stories/birthday/${assetName}.png`,
  }
}

async function verifyExistingRegistryAssets(registry, assetsRoot) {
  for (const entry of registry.entries) {
    if (
      typeof entry.unity_object?.path_id !== 'string' ||
      !/^-?\d+$/.test(entry.unity_object.path_id)
    ) {
      throw new Error(
        `Existing promotion ${entry.kind}:${entry.idol_code} has an inexact PathID`,
      )
    }
    const relativeAsset = String(entry.asset_url).replace(/^\/assets\//, '')
    const assetFile = path.resolve(assetsRoot, relativeAsset)
    requireInside(assetsRoot, assetFile, 'Existing stable asset')
    try {
      const bytes = await readFile(assetFile)
      const dimensions = pngDimensions(bytes)
      if (
        hashBytes(bytes) !== entry.output?.sha256 ||
        bytes.length !== entry.output?.bytes ||
        dimensions.width !== entry.output?.width ||
        dimensions.height !== entry.output?.height
      ) {
        throw new Error('bytes, hash, or dimensions differ')
      }
    } catch (error) {
      throw new Error(
        `Existing promotion ${entry.kind}:${entry.idol_code} asset drifted: ${error.message}`,
      )
    }
  }
}

async function assessCandidate({
  workspaceRoot,
  candidateDirectory,
  registryFile,
  assetsRoot,
  confirmKey,
}) {
  const analysisRoot = path.join(workspaceRoot, '.analysis')
  const publicRoot = path.join(workspaceRoot, 'public')
  const expectedRegistryRoot = path.join(publicRoot, 'data', 'assets')
  const expectedAssetsRoot = path.join(publicRoot, 'assets')
  requireInside(analysisRoot, candidateDirectory, 'Candidate directory')
  requireInside(expectedRegistryRoot, registryFile, 'Promotion registry')
  requireInside(expectedAssetsRoot, assetsRoot, 'Stable asset root')

  const candidate = await readJson(path.join(candidateDirectory, 'candidate.json'), 'candidate manifest')
  const key = `${candidate.kind}:${candidate.idol_code}`
  if (confirmKey !== key) {
    throw new Error(`Explicit promotion confirmation must equal ${key}`)
  }
  if (!PROMOTABLE_KINDS.has(candidate.kind)) {
    throw new Error(`${candidate.kind} is not approved for stable promotion`)
  }
  if (!IDOL_CODE.test(candidate.idol_code || '')) {
    throw new Error(`Invalid candidate idol code ${candidate.idol_code}`)
  }
  if (candidate.schema_version !== 1) {
    throw new Error('Candidate manifest schema_version must be 1')
  }
  if (candidate.raw_source?.source_manifest_equal !== true) {
    throw new Error('Candidate RAW source is not verified against the source manifest')
  }
  if (candidate.unity_object?.object_type !== 'Sprite') {
    throw new Error('Candidate Unity object must be a Sprite')
  }
  if (
    typeof candidate.unity_object?.path_id !== 'string' ||
    !/^-?\d+$/.test(candidate.unity_object.path_id)
  ) {
    throw new Error('Candidate Unity PathID must be an exact decimal string')
  }
  const identities = candidate.unity_object?.identity_ids || []
  if (identities.length !== 1 || identities[0] !== candidate.idol_code) {
    throw new Error('Stable first-batch promotion requires one exact idol identity')
  }
  const masterEvidence = candidate.identity_evidence?.story_master
  if (
    masterEvidence?.domain !== 'birthday' ||
    !Number.isInteger(masterEvidence.reference_count) ||
    masterEvidence.reference_count < 1 ||
    !Array.isArray(masterEvidence.references) ||
    masterEvidence.references.length !== masterEvidence.reference_count ||
    masterEvidence.references.some(reference =>
      !String(reference?.compiled_file || '').startsWith(`1_x_${candidate.idol_code}_`)
    )
  ) {
    throw new Error('Birthday master-data ownership evidence is incomplete')
  }

  const candidateAsset = path.join(
    candidateDirectory,
    'resolved',
    `${candidate.idol_code}.png`,
  )
  requireInside(candidateDirectory, candidateAsset, 'Candidate asset')
  const candidateBytes = await readFile(candidateAsset)
  const candidateHash = hashBytes(candidateBytes)
  const dimensions = pngDimensions(candidateBytes)
  if (
    candidateHash !== candidate.resolved_asset?.sha256 ||
    candidateBytes.length !== candidate.resolved_asset?.bytes ||
    dimensions.width !== candidate.resolved_asset?.width ||
    dimensions.height !== candidate.resolved_asset?.height
  ) {
    throw new Error('Candidate PNG bytes, dimensions, or hash drifted from its manifest')
  }

  const repositoryRoot = path.dirname(workspaceRoot)
  const rawSource = path.resolve(repositoryRoot, candidate.raw_source?.relative_path || '')
  requireInside(path.join(repositoryRoot, 'RAW'), rawSource, 'RAW source')
  const rawState = await pathState(rawSource)
  if (
    !rawState.exists ||
    rawState.bytes !== candidate.raw_source?.bytes ||
    rawState.sha256 !== candidate.raw_source?.sha256
  ) {
    throw new Error('RAW source bytes or hash drifted from the candidate manifest')
  }

  const registry = validateRegistry(await readJson(registryFile, 'promotion registry'))
  await verifyExistingRegistryAssets(registry, assetsRoot)
  if (registry.entries.some(entry => `${entry.kind}:${entry.idol_code}` === key)) {
    throw new Error(`${key} is already present in the stable promotion registry`)
  }
  const stable = stableTargetFor(candidate)
  const targetFile = path.resolve(assetsRoot, stable.relativePath)
  requireInside(assetsRoot, targetFile, 'Stable asset target')
  const targetState = await pathState(targetFile)
  if (targetState.exists) {
    throw new Error(`Stable asset target already exists outside the registry: ${targetFile}`)
  }

  return {
    candidate,
    candidateAsset,
    candidateHash,
    dimensions,
    key,
    rawState,
    registry,
    stable,
    targetFile,
    targetState,
  }
}

async function assessSharedCandidates({
  workspaceRoot,
  candidateDirectories,
  registryFile,
  assetsRoot,
  confirmKey,
}) {
  if (!Array.isArray(candidateDirectories) || candidateDirectories.length < 2) {
    throw new Error('Shared promotion requires at least two candidate directories')
  }
  const analysisRoot = path.join(workspaceRoot, '.analysis')
  const publicRoot = path.join(workspaceRoot, 'public')
  requireInside(
    path.join(publicRoot, 'data', 'assets'),
    registryFile,
    'Promotion registry',
  )
  requireInside(path.join(publicRoot, 'assets'), assetsRoot, 'Stable asset root')

  const assessed = []
  for (const candidateDirectory of candidateDirectories) {
    requireInside(analysisRoot, candidateDirectory, 'Candidate directory')
    const candidate = await readJson(
      path.join(candidateDirectory, 'candidate.json'),
      'candidate manifest',
    )
    if (
      candidate.schema_version !== 1 ||
      !PROMOTABLE_KINDS.has(candidate.kind) ||
      !IDOL_CODE.test(candidate.idol_code || '') ||
      candidate.raw_source?.source_manifest_equal !== true ||
      candidate.unity_object?.object_type !== 'Sprite' ||
      typeof candidate.unity_object?.path_id !== 'string' ||
      !/^-?\d+$/.test(candidate.unity_object.path_id)
    ) {
      throw new Error(`Invalid shared candidate ${candidate.kind}:${candidate.idol_code}`)
    }
    const masterEvidence = candidate.identity_evidence?.story_master
    if (
      masterEvidence?.domain !== 'birthday' ||
      !Number.isInteger(masterEvidence.reference_count) ||
      masterEvidence.reference_count < 1 ||
      !Array.isArray(masterEvidence.references) ||
      masterEvidence.references.length !== masterEvidence.reference_count ||
      masterEvidence.references.some(reference =>
        !String(reference?.compiled_file || '').startsWith(`1_x_${candidate.idol_code}_`)
      )
    ) {
      throw new Error(
        `Shared candidate ${candidate.idol_code} has incomplete master ownership`,
      )
    }
    const candidateAsset = path.join(
      candidateDirectory,
      'resolved',
      `${candidate.idol_code}.png`,
    )
    requireInside(candidateDirectory, candidateAsset, 'Candidate asset')
    const candidateBytes = await readFile(candidateAsset)
    const candidateHash = hashBytes(candidateBytes)
    const dimensions = pngDimensions(candidateBytes)
    if (
      candidateHash !== candidate.resolved_asset?.sha256 ||
      candidateBytes.length !== candidate.resolved_asset?.bytes ||
      dimensions.width !== candidate.resolved_asset?.width ||
      dimensions.height !== candidate.resolved_asset?.height
    ) {
      throw new Error(
        `Shared candidate ${candidate.idol_code} PNG drifted from its manifest`,
      )
    }
    assessed.push({
      candidate,
      candidateAsset,
      candidateBytes,
      candidateHash,
      dimensions,
    })
  }

  const codes = assessed.map(item => item.candidate.idol_code).sort()
  if (new Set(codes).size !== codes.length) {
    throw new Error('Shared promotion candidate idol codes must be unique')
  }
  const kind = assessed[0].candidate.kind
  const key = `${kind}:${codes.join('+')}`
  if (confirmKey !== key) {
    throw new Error(`Explicit shared promotion confirmation must equal ${key}`)
  }
  const expectedIdentityIds = [...codes]
  const expectedAssetName = `image_chara_birthday_visual_${codes.join('-')}`
  const fingerprints = new Set()
  for (const item of assessed) {
    const candidate = item.candidate
    const identities = [...(candidate.unity_object?.identity_ids || [])].sort()
    if (
      candidate.kind !== kind ||
      JSON.stringify(identities) !== JSON.stringify(expectedIdentityIds)
    ) {
      throw new Error(
        `Shared candidate ${candidate.idol_code} does not contain the exact group identity set`,
      )
    }
    if (candidate.unity_object.asset_name !== expectedAssetName) {
      throw new Error(
        `Shared candidate ${candidate.idol_code} has unexpected asset name`,
      )
    }
    fingerprints.add(JSON.stringify({
      raw_path: candidate.raw_source.relative_path,
      raw_bytes: candidate.raw_source.bytes,
      raw_sha256: candidate.raw_source.sha256,
      container_path: candidate.unity_object.container_path,
      path_id: candidate.unity_object.path_id,
      asset_name: candidate.unity_object.asset_name,
      sprite_rect: candidate.unity_object.sprite_rect,
      output_bytes: item.candidateBytes.length,
      output_sha256: item.candidateHash,
      width: item.dimensions.width,
      height: item.dimensions.height,
    }))
  }
  if (fingerprints.size !== 1) {
    throw new Error('Shared candidate RAW, Unity object, or PNG evidence differs')
  }

  const primary = assessed[0]
  const repositoryRoot = path.dirname(workspaceRoot)
  const rawSource = path.resolve(
    repositoryRoot,
    primary.candidate.raw_source.relative_path,
  )
  requireInside(path.join(repositoryRoot, 'RAW'), rawSource, 'RAW source')
  const rawState = await pathState(rawSource)
  if (
    !rawState.exists ||
    rawState.bytes !== primary.candidate.raw_source.bytes ||
    rawState.sha256 !== primary.candidate.raw_source.sha256
  ) {
    throw new Error('Shared RAW source drifted from the candidate manifests')
  }

  const registry = validateRegistry(await readJson(registryFile, 'promotion registry'))
  await verifyExistingRegistryAssets(registry, assetsRoot)
  const existingKeys = new Set(
    registry.entries.map(entry => `${entry.kind}:${entry.idol_code}`),
  )
  if (codes.some(code => existingKeys.has(`${kind}:${code}`))) {
    throw new Error('One or more shared identities are already promoted')
  }
  const relativePath = `stories/birthday/${expectedAssetName}.png`
  const targetFile = path.resolve(assetsRoot, relativePath)
  requireInside(assetsRoot, targetFile, 'Stable shared asset target')
  const targetState = await pathState(targetFile)
  if (targetState.exists) {
    throw new Error(`Shared stable asset target already exists: ${targetFile}`)
  }

  return {
    assessed,
    codes,
    key,
    kind,
    primary,
    rawState,
    registry,
    stable: {
      relativePath,
      assetUrl: `/assets/${relativePath.replaceAll('\\', '/')}`,
    },
    targetFile,
    targetState,
  }
}

export async function publishRawCharacterImage({
  workspaceRoot,
  candidateDirectory,
  registryFile,
  assetsRoot,
  backupDirectory,
  confirmKey,
  publishAsset = defaultAssetWrite,
  publishRegistry = defaultRegistryWrite,
  reportWrite = defaultReportWrite,
}) {
  const resolvedWorkspace = path.resolve(workspaceRoot)
  const resolvedCandidate = resolveInput(resolvedWorkspace, candidateDirectory)
  const resolvedRegistry = resolveInput(resolvedWorkspace, registryFile)
  const resolvedAssets = resolveInput(resolvedWorkspace, assetsRoot)
  const resolvedBackup = resolveInput(resolvedWorkspace, backupDirectory)
  requireInside(
    path.join(resolvedWorkspace, '.analysis'),
    resolvedBackup,
    'Promotion backup directory',
  )
  try {
    if ((await readdir(resolvedBackup)).length >= 0) {
      throw new Error(`Promotion backup directory must not already exist: ${resolvedBackup}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const assessment = await assessCandidate({
    workspaceRoot: resolvedWorkspace,
    candidateDirectory: resolvedCandidate,
    registryFile: resolvedRegistry,
    assetsRoot: resolvedAssets,
    confirmKey,
  })
  await mkdir(resolvedBackup, { recursive: false })
  const backupRegistryFile = path.join(resolvedBackup, 'registry.before.json')
  const backupAssetFile = path.join(resolvedBackup, 'asset.before.png')
  const registryBeforeBytes = await readFile(resolvedRegistry)
  await copyFile(resolvedRegistry, backupRegistryFile)
  if (assessment.targetState.exists) {
    await copyFile(assessment.targetFile, backupAssetFile)
  }

  const promotedAt = new Date().toISOString()
  const entry = {
    kind: assessment.candidate.kind,
    idol_code: assessment.candidate.idol_code,
    asset_url: assessment.stable.assetUrl,
    promoted_at: promotedAt,
    raw_source: {
      relative_path: assessment.candidate.raw_source.relative_path,
      bytes: assessment.rawState.bytes,
      sha256: assessment.rawState.sha256,
    },
    unity_object: {
      container_path: assessment.candidate.unity_object.container_path,
      path_id: assessment.candidate.unity_object.path_id,
      object_type: assessment.candidate.unity_object.object_type,
      asset_name: assessment.candidate.unity_object.asset_name,
      sprite_rect: assessment.candidate.unity_object.sprite_rect,
    },
    output: {
      bytes: assessment.candidate.resolved_asset.bytes,
      width: assessment.dimensions.width,
      height: assessment.dimensions.height,
      sha256: assessment.candidateHash,
    },
    master_evidence: {
      idol_id: assessment.candidate.identity_evidence.master_idol?.idol_id,
      reference_count: assessment.candidate.identity_evidence.story_master.reference_count,
      compiled_files: assessment.candidate.identity_evidence.story_master.references
        .map(reference => reference.compiled_file)
        .sort(),
    },
  }
  const nextRegistry = {
    schema_version: 1,
    entries: [...assessment.registry.entries, entry]
      .sort((a, b) => `${a.kind}:${a.idol_code}`.localeCompare(`${b.kind}:${b.idol_code}`)),
  }
  const nextRegistryBytes = Buffer.from(`${JSON.stringify(nextRegistry, null, 2)}\n`)
  const backupManifest = {
    schema_version: 1,
    key: assessment.key,
    created_at: promotedAt,
    registry: {
      path: path.relative(resolvedWorkspace, resolvedRegistry).replaceAll('\\', '/'),
      before_sha256: hashBytes(registryBeforeBytes),
      promoted_sha256: hashBytes(nextRegistryBytes),
      backup_file: 'registry.before.json',
    },
    asset: {
      path: path.relative(resolvedAssets, assessment.targetFile).replaceAll('\\', '/'),
      existed_before: assessment.targetState.exists,
      before_sha256: assessment.targetState.sha256,
      promoted_sha256: assessment.candidateHash,
      backup_file: assessment.targetState.exists ? 'asset.before.png' : null,
    },
  }

  let mutationStarted = false
  try {
    mutationStarted = true
    await publishAsset(assessment.candidateAsset, assessment.targetFile)
    await publishRegistry(resolvedRegistry, nextRegistryBytes)
    const finalAsset = await pathState(assessment.targetFile)
    const finalRegistry = await pathState(resolvedRegistry)
    if (
      finalAsset.sha256 !== assessment.candidateHash ||
      finalRegistry.sha256 !== backupManifest.registry.promoted_sha256
    ) {
      throw new Error('Published character image or registry failed final hash verification')
    }
    await reportWrite(
      path.join(resolvedBackup, 'backup-manifest.json'),
      Buffer.from(`${JSON.stringify(backupManifest, null, 2)}\n`),
    )
    return {
      key: assessment.key,
      asset_url: assessment.stable.assetUrl,
      old_asset_state: assessment.targetState.exists ? 'present' : 'absent',
      new_asset_sha256: finalAsset.sha256,
      old_registry_sha256: backupManifest.registry.before_sha256,
      new_registry_sha256: finalRegistry.sha256,
      backup_directory: resolvedBackup,
    }
  } catch (error) {
    if (mutationStarted) {
      await restorePrePromotionState({
        registryFile: resolvedRegistry,
        targetFile: assessment.targetFile,
        backupRegistryFile,
        backupAssetFile,
        targetExisted: assessment.targetState.exists,
      })
    }
    throw error
  }
}

export async function publishRawCharacterImageGroup({
  workspaceRoot,
  candidateDirectories,
  registryFile,
  assetsRoot,
  backupDirectory,
  confirmKey,
  publishAsset = defaultAssetWrite,
  publishRegistry = defaultRegistryWrite,
  reportWrite = defaultReportWrite,
}) {
  const resolvedWorkspace = path.resolve(workspaceRoot)
  const resolvedCandidates = candidateDirectories.map(value =>
    resolveInput(resolvedWorkspace, value)
  )
  const resolvedRegistry = resolveInput(resolvedWorkspace, registryFile)
  const resolvedAssets = resolveInput(resolvedWorkspace, assetsRoot)
  const resolvedBackup = resolveInput(resolvedWorkspace, backupDirectory)
  requireInside(
    path.join(resolvedWorkspace, '.analysis'),
    resolvedBackup,
    'Promotion backup directory',
  )
  try {
    if ((await readdir(resolvedBackup)).length >= 0) {
      throw new Error(`Promotion backup directory must not already exist: ${resolvedBackup}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const assessment = await assessSharedCandidates({
    workspaceRoot: resolvedWorkspace,
    candidateDirectories: resolvedCandidates,
    registryFile: resolvedRegistry,
    assetsRoot: resolvedAssets,
    confirmKey,
  })
  await mkdir(resolvedBackup, { recursive: false })
  const backupRegistryFile = path.join(resolvedBackup, 'registry.before.json')
  const backupAssetFile = path.join(resolvedBackup, 'asset.before.png')
  const registryBeforeBytes = await readFile(resolvedRegistry)
  await copyFile(resolvedRegistry, backupRegistryFile)
  if (assessment.targetState.exists) {
    await copyFile(assessment.targetFile, backupAssetFile)
  }

  const promotedAt = new Date().toISOString()
  const entries = assessment.assessed.map(item => ({
    kind: item.candidate.kind,
    idol_code: item.candidate.idol_code,
    asset_url: assessment.stable.assetUrl,
    shared_identity_ids: assessment.codes,
    promoted_at: promotedAt,
    raw_source: {
      relative_path: item.candidate.raw_source.relative_path,
      bytes: assessment.rawState.bytes,
      sha256: assessment.rawState.sha256,
    },
    unity_object: {
      container_path: item.candidate.unity_object.container_path,
      path_id: item.candidate.unity_object.path_id,
      object_type: item.candidate.unity_object.object_type,
      asset_name: item.candidate.unity_object.asset_name,
      sprite_rect: item.candidate.unity_object.sprite_rect,
    },
    output: {
      bytes: item.candidateBytes.length,
      width: item.dimensions.width,
      height: item.dimensions.height,
      sha256: item.candidateHash,
    },
    master_evidence: {
      idol_id: item.candidate.identity_evidence.master_idol?.idol_id,
      reference_count: item.candidate.identity_evidence.story_master.reference_count,
      compiled_files: item.candidate.identity_evidence.story_master.references
        .map(reference => reference.compiled_file)
        .sort(),
    },
  }))
  const nextRegistry = {
    schema_version: 1,
    entries: [...assessment.registry.entries, ...entries]
      .sort((a, b) => `${a.kind}:${a.idol_code}`.localeCompare(`${b.kind}:${b.idol_code}`)),
  }
  const nextRegistryBytes = Buffer.from(`${JSON.stringify(nextRegistry, null, 2)}\n`)
  const backupManifest = {
    schema_version: 1,
    key: assessment.key,
    identity_ids: assessment.codes,
    created_at: promotedAt,
    registry: {
      path: path.relative(resolvedWorkspace, resolvedRegistry).replaceAll('\\', '/'),
      before_sha256: hashBytes(registryBeforeBytes),
      promoted_sha256: hashBytes(nextRegistryBytes),
      backup_file: 'registry.before.json',
    },
    asset: {
      path: path.relative(resolvedAssets, assessment.targetFile).replaceAll('\\', '/'),
      existed_before: assessment.targetState.exists,
      before_sha256: assessment.targetState.sha256,
      promoted_sha256: assessment.primary.candidateHash,
      backup_file: assessment.targetState.exists ? 'asset.before.png' : null,
    },
  }

  let mutationStarted = false
  try {
    mutationStarted = true
    await publishAsset(
      assessment.primary.candidateAsset,
      assessment.targetFile,
    )
    await publishRegistry(resolvedRegistry, nextRegistryBytes)
    const finalAsset = await pathState(assessment.targetFile)
    const finalRegistry = await pathState(resolvedRegistry)
    if (
      finalAsset.sha256 !== assessment.primary.candidateHash ||
      finalRegistry.sha256 !== backupManifest.registry.promoted_sha256
    ) {
      throw new Error('Published shared image or registry failed final hash verification')
    }
    await reportWrite(
      path.join(resolvedBackup, 'backup-manifest.json'),
      Buffer.from(`${JSON.stringify(backupManifest, null, 2)}\n`),
    )
    return {
      key: assessment.key,
      identity_ids: assessment.codes,
      asset_url: assessment.stable.assetUrl,
      old_asset_state: assessment.targetState.exists ? 'present' : 'absent',
      new_asset_sha256: finalAsset.sha256,
      old_registry_sha256: backupManifest.registry.before_sha256,
      new_registry_sha256: finalRegistry.sha256,
      backup_directory: resolvedBackup,
    }
  } catch (error) {
    if (mutationStarted) {
      await restorePrePromotionState({
        registryFile: resolvedRegistry,
        targetFile: assessment.targetFile,
        backupRegistryFile,
        backupAssetFile,
        targetExisted: assessment.targetState.exists,
      })
    }
    throw error
  }
}

export async function publishRawCharacterImageBatch({
  workspaceRoot,
  candidateDirectories,
  registryFile,
  assetsRoot,
  backupDirectory,
  confirmKey,
  publishAsset = defaultAssetWrite,
  publishRegistry = defaultRegistryWrite,
  reportWrite = defaultReportWrite,
}) {
  if (
    !Array.isArray(candidateDirectories) ||
    candidateDirectories.length < 2 ||
    candidateDirectories.length > MAX_BATCH_SIZE
  ) {
    throw new Error(
      `Batch promotion requires 2-${MAX_BATCH_SIZE} candidate directories`,
    )
  }
  const resolvedWorkspace = path.resolve(workspaceRoot)
  const resolvedCandidates = candidateDirectories.map(value =>
    resolveInput(resolvedWorkspace, value)
  )
  const resolvedRegistry = resolveInput(resolvedWorkspace, registryFile)
  const resolvedAssets = resolveInput(resolvedWorkspace, assetsRoot)
  const resolvedBackup = resolveInput(resolvedWorkspace, backupDirectory)
  requireInside(
    path.join(resolvedWorkspace, '.analysis'),
    resolvedBackup,
    'Promotion backup directory',
  )
  try {
    if ((await readdir(resolvedBackup)).length >= 0) {
      throw new Error(`Promotion backup directory must not already exist: ${resolvedBackup}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const assessments = []
  for (const candidateDirectory of resolvedCandidates) {
    const candidate = await readJson(
      path.join(candidateDirectory, 'candidate.json'),
      'candidate manifest',
    )
    assessments.push(await assessCandidate({
      workspaceRoot: resolvedWorkspace,
      candidateDirectory,
      registryFile: resolvedRegistry,
      assetsRoot: resolvedAssets,
      confirmKey: `${candidate.kind}:${candidate.idol_code}`,
    }))
  }
  assessments.sort((a, b) =>
    a.candidate.idol_code.localeCompare(b.candidate.idol_code)
  )
  const codes = assessments.map(item => item.candidate.idol_code)
  const kinds = new Set(assessments.map(item => item.candidate.kind))
  const targets = new Set(assessments.map(item => item.targetFile))
  if (
    new Set(codes).size !== codes.length ||
    kinds.size !== 1 ||
    targets.size !== assessments.length
  ) {
    throw new Error('Batch candidates must have unique identities and stable targets')
  }
  const kind = assessments[0].candidate.kind
  const key = `${kind}:${codes.join('+')}`
  if (confirmKey !== key) {
    throw new Error(`Explicit batch promotion confirmation must equal ${key}`)
  }
  const registryBefore = JSON.stringify(assessments[0].registry)
  if (assessments.some(item => JSON.stringify(item.registry) !== registryBefore)) {
    throw new Error('Batch candidates were not assessed against one registry state')
  }

  await mkdir(resolvedBackup, { recursive: false })
  const backupRegistryFile = path.join(resolvedBackup, 'registry.before.json')
  const backupAssetsRoot = path.join(resolvedBackup, 'assets-before')
  const registryBeforeBytes = await readFile(resolvedRegistry)
  await copyFile(resolvedRegistry, backupRegistryFile)
  const assetBackups = []
  for (const [index, assessment] of assessments.entries()) {
    const backupFile = assessment.targetState.exists
      ? path.join(backupAssetsRoot, `${index}-${path.basename(assessment.targetFile)}`)
      : null
    if (backupFile) {
      await mkdir(path.dirname(backupFile), { recursive: true })
      await copyFile(assessment.targetFile, backupFile)
    }
    assetBackups.push(backupFile)
  }

  const promotedAt = new Date().toISOString()
  const entries = assessments.map(assessment => ({
    kind: assessment.candidate.kind,
    idol_code: assessment.candidate.idol_code,
    asset_url: assessment.stable.assetUrl,
    promoted_at: promotedAt,
    raw_source: {
      relative_path: assessment.candidate.raw_source.relative_path,
      bytes: assessment.rawState.bytes,
      sha256: assessment.rawState.sha256,
    },
    unity_object: {
      container_path: assessment.candidate.unity_object.container_path,
      path_id: assessment.candidate.unity_object.path_id,
      object_type: assessment.candidate.unity_object.object_type,
      asset_name: assessment.candidate.unity_object.asset_name,
      sprite_rect: assessment.candidate.unity_object.sprite_rect,
    },
    output: {
      bytes: assessment.candidate.resolved_asset.bytes,
      width: assessment.dimensions.width,
      height: assessment.dimensions.height,
      sha256: assessment.candidateHash,
    },
    master_evidence: {
      idol_id: assessment.candidate.identity_evidence.master_idol?.idol_id,
      reference_count: assessment.candidate.identity_evidence.story_master.reference_count,
      compiled_files: assessment.candidate.identity_evidence.story_master.references
        .map(reference => reference.compiled_file)
        .sort(),
    },
  }))
  const nextRegistry = {
    schema_version: 1,
    entries: [...assessments[0].registry.entries, ...entries]
      .sort((a, b) => `${a.kind}:${a.idol_code}`.localeCompare(`${b.kind}:${b.idol_code}`)),
  }
  const nextRegistryBytes = Buffer.from(`${JSON.stringify(nextRegistry, null, 2)}\n`)
  const backupManifest = {
    schema_version: 2,
    mode: 'batch',
    key,
    identity_ids: codes,
    created_at: promotedAt,
    registry: {
      path: path.relative(resolvedWorkspace, resolvedRegistry).replaceAll('\\', '/'),
      before_sha256: hashBytes(registryBeforeBytes),
      promoted_sha256: hashBytes(nextRegistryBytes),
      backup_file: 'registry.before.json',
    },
    assets: assessments.map((assessment, index) => ({
      idol_code: assessment.candidate.idol_code,
      path: path.relative(resolvedAssets, assessment.targetFile).replaceAll('\\', '/'),
      existed_before: assessment.targetState.exists,
      before_sha256: assessment.targetState.sha256,
      promoted_sha256: assessment.candidateHash,
      backup_file: assetBackups[index]
        ? path.relative(resolvedBackup, assetBackups[index]).replaceAll('\\', '/')
        : null,
    })),
  }

  let mutationStarted = false
  try {
    mutationStarted = true
    for (const assessment of assessments) {
      await publishAsset(assessment.candidateAsset, assessment.targetFile)
    }
    await publishRegistry(resolvedRegistry, nextRegistryBytes)
    const finalAssets = await Promise.all(
      assessments.map(item => pathState(item.targetFile)),
    )
    const finalRegistry = await pathState(resolvedRegistry)
    if (
      finalRegistry.sha256 !== backupManifest.registry.promoted_sha256 ||
      finalAssets.some((state, index) =>
        state.sha256 !== assessments[index].candidateHash
      )
    ) {
      throw new Error('Published batch images or registry failed final hash verification')
    }
    await reportWrite(
      path.join(resolvedBackup, 'backup-manifest.json'),
      Buffer.from(`${JSON.stringify(backupManifest, null, 2)}\n`),
    )
    return {
      key,
      identity_ids: codes,
      asset_urls: assessments.map(item => item.stable.assetUrl),
      asset_sha256: finalAssets.map(item => item.sha256),
      old_registry_sha256: backupManifest.registry.before_sha256,
      new_registry_sha256: finalRegistry.sha256,
      backup_directory: resolvedBackup,
    }
  } catch (error) {
    if (mutationStarted) {
      await atomicWriteBytes(resolvedRegistry, registryBeforeBytes)
      for (const [index, assessment] of assessments.entries()) {
        if (assessment.targetState.exists) {
          await atomicWriteBytes(
            assessment.targetFile,
            await readFile(assetBackups[index]),
          )
        } else {
          await rm(assessment.targetFile, { force: true })
        }
      }
    }
    throw error
  }
}

export async function rollbackRawCharacterImageBatch({
  workspaceRoot,
  registryFile,
  assetsRoot,
  backupDirectory,
  confirmKey,
}) {
  const resolvedWorkspace = path.resolve(workspaceRoot)
  const resolvedRegistry = resolveInput(resolvedWorkspace, registryFile)
  const resolvedAssets = resolveInput(resolvedWorkspace, assetsRoot)
  const resolvedBackup = resolveInput(resolvedWorkspace, backupDirectory)
  requireInside(
    path.join(resolvedWorkspace, '.analysis'),
    resolvedBackup,
    'Promotion backup directory',
  )
  requireInside(
    path.join(resolvedWorkspace, 'public', 'data', 'assets'),
    resolvedRegistry,
    'Promotion registry',
  )
  requireInside(
    path.join(resolvedWorkspace, 'public', 'assets'),
    resolvedAssets,
    'Stable asset root',
  )
  const manifest = await readJson(
    path.join(resolvedBackup, 'backup-manifest.json'),
    'batch promotion backup manifest',
  )
  if (
    manifest.schema_version !== 2 ||
    manifest.mode !== 'batch' ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length < 2 ||
    confirmKey !== manifest.key
  ) {
    throw new Error(`Explicit batch rollback confirmation must equal ${manifest.key}`)
  }
  const expectedRegistry = path.resolve(resolvedWorkspace, manifest.registry?.path || '')
  if (expectedRegistry !== resolvedRegistry) {
    throw new Error('Batch rollback registry path differs from its backup')
  }
  const targets = manifest.assets.map(asset => {
    const targetFile = path.resolve(resolvedAssets, asset.path || '')
    requireInside(resolvedAssets, targetFile, 'Batch rollback asset target')
    return { asset, targetFile }
  })
  const currentRegistry = await pathState(resolvedRegistry)
  const currentAssets = await Promise.all(
    targets.map(item => pathState(item.targetFile)),
  )
  if (
    currentRegistry.sha256 !== manifest.registry.promoted_sha256 ||
    currentAssets.some((state, index) =>
      state.sha256 !== targets[index].asset.promoted_sha256
    )
  ) {
    throw new Error('Current batch promotion state drifted; refusing rollback')
  }

  const promotedRegistryBytes = await readFile(resolvedRegistry)
  const promotedAssetBytes = await Promise.all(
    targets.map(item => readFile(item.targetFile)),
  )
  try {
    await atomicWriteBytes(
      resolvedRegistry,
      await readFile(path.join(resolvedBackup, manifest.registry.backup_file)),
    )
    for (const { asset, targetFile } of targets) {
      if (asset.existed_before) {
        await atomicWriteBytes(
          targetFile,
          await readFile(path.join(resolvedBackup, asset.backup_file)),
        )
      } else {
        await rm(targetFile, { force: true })
      }
    }
    const restoredRegistry = await pathState(resolvedRegistry)
    const restoredAssets = await Promise.all(
      targets.map(item => pathState(item.targetFile)),
    )
    if (
      restoredRegistry.sha256 !== manifest.registry.before_sha256 ||
      restoredAssets.some((state, index) =>
        state.exists !== targets[index].asset.existed_before ||
        state.sha256 !== targets[index].asset.before_sha256
      )
    ) {
      throw new Error('Batch rollback final-state verification failed')
    }
    return {
      key: manifest.key,
      identity_ids: manifest.identity_ids,
      registry_sha256: restoredRegistry.sha256,
      asset_states: restoredAssets.map((state, index) => ({
        idol_code: targets[index].asset.idol_code,
        state: state.exists ? 'restored' : 'removed',
        sha256: state.sha256,
      })),
    }
  } catch (error) {
    await atomicWriteBytes(resolvedRegistry, promotedRegistryBytes)
    for (const [index, { targetFile }] of targets.entries()) {
      await atomicWriteBytes(targetFile, promotedAssetBytes[index])
    }
    throw error
  }
}

export async function rollbackRawCharacterImage({
  workspaceRoot,
  registryFile,
  assetsRoot,
  backupDirectory,
  confirmKey,
}) {
  const resolvedWorkspace = path.resolve(workspaceRoot)
  const resolvedRegistry = resolveInput(resolvedWorkspace, registryFile)
  const resolvedAssets = resolveInput(resolvedWorkspace, assetsRoot)
  const resolvedBackup = resolveInput(resolvedWorkspace, backupDirectory)
  requireInside(
    path.join(resolvedWorkspace, '.analysis'),
    resolvedBackup,
    'Promotion backup directory',
  )
  requireInside(
    path.join(resolvedWorkspace, 'public', 'data', 'assets'),
    resolvedRegistry,
    'Promotion registry',
  )
  requireInside(
    path.join(resolvedWorkspace, 'public', 'assets'),
    resolvedAssets,
    'Stable asset root',
  )
  const manifest = await readJson(
    path.join(resolvedBackup, 'backup-manifest.json'),
    'promotion backup manifest',
  )
  if (manifest.schema_version !== 1 || confirmKey !== manifest.key) {
    throw new Error(`Explicit rollback confirmation must equal ${manifest.key}`)
  }
  const expectedRegistry = path.resolve(resolvedWorkspace, manifest.registry?.path || '')
  if (expectedRegistry !== resolvedRegistry) {
    throw new Error('Rollback registry path differs from the promotion backup')
  }
  const targetFile = path.resolve(resolvedAssets, manifest.asset?.path || '')
  requireInside(resolvedAssets, targetFile, 'Rollback asset target')
  const currentRegistry = await pathState(resolvedRegistry)
  const currentAsset = await pathState(targetFile)
  if (
    currentRegistry.sha256 !== manifest.registry?.promoted_sha256 ||
    currentAsset.sha256 !== manifest.asset?.promoted_sha256
  ) {
    throw new Error('Current promotion state drifted; refusing destructive rollback')
  }
  const backupRegistryFile = path.join(
    resolvedBackup,
    manifest.registry.backup_file,
  )
  const backupAssetFile = manifest.asset.existed_before
    ? path.join(resolvedBackup, manifest.asset.backup_file)
    : null
  const promotedRegistryBytes = await readFile(resolvedRegistry)
  const promotedAssetBytes = await readFile(targetFile)
  let restoredRegistry
  let restoredAsset
  try {
    await restorePrePromotionState({
      registryFile: resolvedRegistry,
      targetFile,
      backupRegistryFile,
      backupAssetFile,
      targetExisted: manifest.asset.existed_before,
    })
    restoredRegistry = await pathState(resolvedRegistry)
    restoredAsset = await pathState(targetFile)
    if (
      restoredRegistry.sha256 !== manifest.registry.before_sha256 ||
      restoredAsset.exists !== manifest.asset.existed_before ||
      restoredAsset.sha256 !== manifest.asset.before_sha256
    ) {
      throw new Error('Rollback final-state verification failed')
    }
  } catch (error) {
    await atomicWriteBytes(resolvedRegistry, promotedRegistryBytes)
    await atomicWriteBytes(targetFile, promotedAssetBytes)
    throw error
  }
  return {
    key: manifest.key,
    registry_sha256: restoredRegistry.sha256,
    asset_state: restoredAsset.exists ? 'restored' : 'removed',
    asset_sha256: restoredAsset.sha256,
  }
}
