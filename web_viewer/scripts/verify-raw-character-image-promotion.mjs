import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'

import {
  hashBytes,
  publishRawCharacterImage,
  publishRawCharacterImageBatch,
  publishRawCharacterImageGroup,
  rollbackRawCharacterImage,
  rollbackRawCharacterImageBatch,
} from './lib/raw-character-image-promotion.mjs'
import {
  getPromotedCharacterImageUrl,
  getRawCharacterImageCandidateUrl,
} from '../src/utils/CharacterImageResolver.js'

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'sidem-character-promotion-'))
const workspaceRoot = path.join(temporaryRoot, 'web_viewer')
const candidateDirectory = path.join(
  workspaceRoot,
  '.analysis',
  'raw-migration',
  'character-image-candidate',
  'birthday_visual',
  '001tom',
)
const registryFile = path.join(
  workspaceRoot,
  'public',
  'data',
  'assets',
  'raw_character_image_promotions.json',
)
const assetsRoot = path.join(workspaceRoot, 'public', 'assets')
const rawFile = path.join(
  temporaryRoot,
  'RAW',
  'asset',
  'image_chara_birthday_visual_001tom.unity3d',
)
const candidateAsset = path.join(candidateDirectory, 'resolved', '001tom.png')
const stableAsset = path.join(
  assetsRoot,
  'stories',
  'birthday',
  'image_chara_birthday_visual_001tom.png',
)
const baselineAsset = path.join(
  assetsRoot,
  'stories',
  'birthday',
  'image_chara_birthday_visual_999abc.png',
)
const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const rawBytes = Buffer.from('fixture RAW Unity Sprite bundle')
const sharedRawBytes = Buffer.from('fixture shared RAW Unity Sprite bundle')
const sharedCodes = ['012yus', '013kys']
const sharedCandidateDirectories = sharedCodes.map(code => path.join(
  workspaceRoot,
  '.analysis',
  'raw-migration',
  'character-image-candidate',
  'birthday_visual',
  code,
))
const sharedRawFile = path.join(
  temporaryRoot,
  'RAW',
  'asset',
  'image_chara_birthday_visual_012yus-013kys.unity3d',
)
const sharedStableAsset = path.join(
  assetsRoot,
  'stories',
  'birthday',
  'image_chara_birthday_visual_012yus-013kys.png',
)
const batchCodes = ['003hok', '004ter', '005kao']
const batchCandidateDirectories = batchCodes.map(code => path.join(
  workspaceRoot,
  '.analysis',
  'raw-migration',
  'character-image-candidate',
  'birthday_visual',
  code,
))
const batchStableAssets = batchCodes.map(code => path.join(
  assetsRoot,
  'stories',
  'birthday',
  `image_chara_birthday_visual_${code}.png`,
))
const baselineRegistry = {
  schema_version: 1,
  entries: [{
    kind: 'birthday_visual',
    idol_code: '999abc',
    asset_url: '/assets/stories/birthday/image_chara_birthday_visual_999abc.png',
    unity_object: { path_id: '999' },
    output: {
      bytes: pngBytes.length,
      width: 1,
      height: 1,
      sha256: hashBytes(pngBytes),
    },
  }],
}

async function exists(file) {
  try {
    await stat(file)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function candidateManifest() {
  return {
    schema_version: 1,
    kind: 'birthday_visual',
    idol_code: '001tom',
    raw_source: {
      relative_path: 'RAW/asset/image_chara_birthday_visual_001tom.unity3d',
      bytes: rawBytes.length,
      sha256: hashBytes(rawBytes),
      source_manifest_equal: true,
    },
    unity_object: {
      container_path: 'assets/resources/image/image_chara/image_chara_birthday/image_chara_birthday_visual_001tom.png',
      path_id: '101',
      object_type: 'Sprite',
      asset_name: 'image_chara_birthday_visual_001tom',
      identity_ids: ['001tom'],
      sprite_rect: { x: 0, y: 0, width: 1, height: 1 },
    },
    identity_evidence: {
      master_idol: { idol_id: 1, idol_code: '001tom' },
      story_master: {
        domain: 'birthday',
        reference_count: 1,
        references: [{
          compiled_file: '1_x_001tom_fixture.json',
          compiled_exists: true,
        }],
      },
    },
    resolved_asset: {
      width: 1,
      height: 1,
      bytes: pngBytes.length,
      sha256: hashBytes(pngBytes),
    },
  }
}

function sharedCandidateManifest(idolCode, assetBytes = pngBytes) {
  return {
    schema_version: 1,
    kind: 'birthday_visual',
    idol_code: idolCode,
    raw_source: {
      relative_path: 'RAW/asset/image_chara_birthday_visual_012yus-013kys.unity3d',
      bytes: sharedRawBytes.length,
      sha256: hashBytes(sharedRawBytes),
      source_manifest_equal: true,
    },
    unity_object: {
      container_path: 'assets/resources/image/image_chara/image_chara_birthday/image_chara_birthday_visual_012yus-013kys.png',
      path_id: '-12013',
      object_type: 'Sprite',
      asset_name: 'image_chara_birthday_visual_012yus-013kys',
      identity_ids: sharedCodes,
      sprite_rect: { x: 0, y: 0, width: 1, height: 1 },
    },
    identity_evidence: {
      master_idol: { idol_id: Number(idolCode.slice(0, 3)), idol_code: idolCode },
      story_master: {
        domain: 'birthday',
        reference_count: 1,
        references: [{
          compiled_file: `1_x_${idolCode}_fixture.json`,
          compiled_exists: true,
        }],
      },
    },
    resolved_asset: {
      width: 1,
      height: 1,
      bytes: assetBytes.length,
      sha256: hashBytes(assetBytes),
    },
  }
}

function batchCandidateManifest(idolCode, rawAssetBytes) {
  return {
    schema_version: 1,
    kind: 'birthday_visual',
    idol_code: idolCode,
    raw_source: {
      relative_path: `RAW/asset/image_chara_birthday_visual_${idolCode}.unity3d`,
      bytes: rawAssetBytes.length,
      sha256: hashBytes(rawAssetBytes),
      source_manifest_equal: true,
    },
    unity_object: {
      container_path: `assets/resources/image/image_chara/image_chara_birthday/image_chara_birthday_visual_${idolCode}.png`,
      path_id: `${Number(idolCode.slice(0, 3)) * 1000 + 13}`,
      object_type: 'Sprite',
      asset_name: `image_chara_birthday_visual_${idolCode}`,
      identity_ids: [idolCode],
      sprite_rect: { x: 0, y: 0, width: 1, height: 1 },
    },
    identity_evidence: {
      master_idol: { idol_id: Number(idolCode.slice(0, 3)), idol_code: idolCode },
      story_master: {
        domain: 'birthday',
        reference_count: 1,
        references: [{
          compiled_file: `1_x_${idolCode}_fixture.json`,
          compiled_exists: true,
        }],
      },
    },
    resolved_asset: {
      width: 1,
      height: 1,
      bytes: pngBytes.length,
      sha256: hashBytes(pngBytes),
    },
  }
}

try {
  await mkdir(path.dirname(rawFile), { recursive: true })
  await mkdir(path.dirname(candidateAsset), { recursive: true })
  await writeFile(rawFile, rawBytes)
  await writeFile(candidateAsset, pngBytes)
  await writeJson(path.join(candidateDirectory, 'candidate.json'), candidateManifest())
  await writeJson(registryFile, baselineRegistry)
  await mkdir(path.dirname(baselineAsset), { recursive: true })
  await writeFile(baselineAsset, pngBytes)

  await assert.rejects(
    publishRawCharacterImage({
      workspaceRoot,
      candidateDirectory,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'wrong-confirm'),
      confirmKey: 'birthday_visual:002sht',
    }),
    /Explicit promotion confirmation/u,
  )

  const backupDirectory = path.join(workspaceRoot, '.analysis', 'published')
  const report = await publishRawCharacterImage({
    workspaceRoot,
    candidateDirectory,
    registryFile,
    assetsRoot,
    backupDirectory,
    confirmKey: 'birthday_visual:001tom',
  })
  assert.equal(report.old_asset_state, 'absent')
  assert.equal(report.new_asset_sha256, hashBytes(pngBytes))
  assert.equal(hashBytes(await readFile(stableAsset)), hashBytes(pngBytes))
  const promotedRegistry = JSON.parse(await readFile(registryFile, 'utf8'))
  assert.equal(promotedRegistry.entries.length, 2)
  assert.ok(promotedRegistry.entries.some(entry => entry.idol_code === '999abc'))
  assert.equal(
    getPromotedCharacterImageUrl(
      'birthday_visual',
      '001tom',
      promotedRegistry,
    ),
    '/assets/stories/birthday/image_chara_birthday_visual_001tom.png',
  )
  assert.equal(
    getRawCharacterImageCandidateUrl(
      'birthday_visual',
      '001tom',
      '?raw_character_candidate=birthday_visual%3A001tom',
    ),
    '/assets/character-candidate/birthday_visual/001tom.png',
  )

  await writeFile(stableAsset, Buffer.from('injected stable asset drift'))
  await assert.rejects(
    rollbackRawCharacterImage({
      workspaceRoot,
      registryFile,
      assetsRoot,
      backupDirectory,
      confirmKey: 'birthday_visual:001tom',
    }),
    /Current promotion state drifted/u,
  )
  await writeFile(stableAsset, pngBytes)

  await assert.rejects(
    rollbackRawCharacterImage({
      workspaceRoot,
      registryFile,
      assetsRoot,
      backupDirectory,
      confirmKey: 'birthday_visual:002sht',
    }),
    /Explicit rollback confirmation/u,
  )
  const rollback = await rollbackRawCharacterImage({
    workspaceRoot,
    registryFile,
    assetsRoot,
    backupDirectory,
    confirmKey: 'birthday_visual:001tom',
  })
  assert.equal(rollback.asset_state, 'removed')
  assert.equal(await exists(stableAsset), false)
  assert.deepEqual(
    JSON.parse(await readFile(registryFile, 'utf8')),
    baselineRegistry,
  )

  const failureBackup = path.join(workspaceRoot, '.analysis', 'failure')
  await assert.rejects(
    publishRawCharacterImage({
      workspaceRoot,
      candidateDirectory,
      registryFile,
      assetsRoot,
      backupDirectory: failureBackup,
      confirmKey: 'birthday_visual:001tom',
      publishRegistry: async () => {
        throw new Error('injected registry failure')
      },
    }),
    /injected registry failure/u,
  )
  assert.equal(await exists(stableAsset), false)
  assert.deepEqual(
    JSON.parse(await readFile(registryFile, 'utf8')),
    baselineRegistry,
  )

  await writeFile(baselineAsset, Buffer.from('injected baseline drift'))
  await assert.rejects(
    publishRawCharacterImage({
      workspaceRoot,
      candidateDirectory,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'baseline-drift'),
      confirmKey: 'birthday_visual:001tom',
    }),
    /Existing promotion birthday_visual:999abc asset drifted/u,
  )
  await writeFile(baselineAsset, pngBytes)

  const numericPathIdManifest = candidateManifest()
  numericPathIdManifest.unity_object.path_id = 101
  await writeJson(
    path.join(candidateDirectory, 'candidate.json'),
    numericPathIdManifest,
  )
  await assert.rejects(
    publishRawCharacterImage({
      workspaceRoot,
      candidateDirectory,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'numeric-path-id'),
      confirmKey: 'birthday_visual:001tom',
    }),
    /PathID must be an exact decimal string/u,
  )

  const sharedManifest = candidateManifest()
  sharedManifest.unity_object.identity_ids = ['001tom', '002sht']
  await writeJson(path.join(candidateDirectory, 'candidate.json'), sharedManifest)
  await assert.rejects(
    publishRawCharacterImage({
      workspaceRoot,
      candidateDirectory,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'shared-rejected'),
      confirmKey: 'birthday_visual:001tom',
    }),
    /one exact idol identity/u,
  )

  await writeFile(sharedRawFile, sharedRawBytes)
  for (const [index, directory] of sharedCandidateDirectories.entries()) {
    const code = sharedCodes[index]
    await mkdir(path.join(directory, 'resolved'), { recursive: true })
    await writeFile(path.join(directory, 'resolved', `${code}.png`), pngBytes)
    await writeJson(
      path.join(directory, 'candidate.json'),
      sharedCandidateManifest(code),
    )
  }

  const missingIdentity = sharedCandidateManifest('013kys')
  missingIdentity.unity_object.identity_ids = ['013kys']
  await writeJson(
    path.join(sharedCandidateDirectories[1], 'candidate.json'),
    missingIdentity,
  )
  await assert.rejects(
    publishRawCharacterImageGroup({
      workspaceRoot,
      candidateDirectories: sharedCandidateDirectories,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'shared-missing-identity'),
      confirmKey: 'birthday_visual:012yus+013kys',
    }),
    /exact group identity set/u,
  )

  const alternatePngBytes = Buffer.from(pngBytes)
  alternatePngBytes[alternatePngBytes.length - 1] ^= 1
  await writeFile(
    path.join(sharedCandidateDirectories[1], 'resolved', '013kys.png'),
    alternatePngBytes,
  )
  await writeJson(
    path.join(sharedCandidateDirectories[1], 'candidate.json'),
    sharedCandidateManifest('013kys', alternatePngBytes),
  )
  await assert.rejects(
    publishRawCharacterImageGroup({
      workspaceRoot,
      candidateDirectories: sharedCandidateDirectories,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'shared-output-drift'),
      confirmKey: 'birthday_visual:012yus+013kys',
    }),
    /Shared candidate RAW, Unity object, or PNG evidence differs/u,
  )

  await writeFile(
    path.join(sharedCandidateDirectories[1], 'resolved', '013kys.png'),
    pngBytes,
  )
  await writeJson(
    path.join(sharedCandidateDirectories[1], 'candidate.json'),
    sharedCandidateManifest('013kys'),
  )
  await assert.rejects(
    publishRawCharacterImageGroup({
      workspaceRoot,
      candidateDirectories: sharedCandidateDirectories,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'shared-wrong-confirm'),
      confirmKey: 'birthday_visual:012yus',
    }),
    /Explicit shared promotion confirmation/u,
  )

  await assert.rejects(
    publishRawCharacterImageGroup({
      workspaceRoot,
      candidateDirectories: sharedCandidateDirectories,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'shared-failure'),
      confirmKey: 'birthday_visual:012yus+013kys',
      publishRegistry: async () => {
        throw new Error('injected shared registry failure')
      },
    }),
    /injected shared registry failure/u,
  )
  assert.equal(await exists(sharedStableAsset), false)
  assert.deepEqual(
    JSON.parse(await readFile(registryFile, 'utf8')),
    baselineRegistry,
  )

  const sharedBackup = path.join(workspaceRoot, '.analysis', 'shared-published')
  const sharedReport = await publishRawCharacterImageGroup({
    workspaceRoot,
    candidateDirectories: sharedCandidateDirectories,
    registryFile,
    assetsRoot,
    backupDirectory: sharedBackup,
    confirmKey: 'birthday_visual:012yus+013kys',
  })
  assert.deepEqual(sharedReport.identity_ids, sharedCodes)
  assert.equal(hashBytes(await readFile(sharedStableAsset)), hashBytes(pngBytes))
  const sharedRegistry = JSON.parse(await readFile(registryFile, 'utf8'))
  assert.equal(sharedRegistry.entries.length, 3)
  const sharedEntries = sharedRegistry.entries.filter(entry =>
    sharedCodes.includes(entry.idol_code),
  )
  assert.equal(sharedEntries.length, 2)
  assert.equal(new Set(sharedEntries.map(entry => entry.asset_url)).size, 1)
  assert.deepEqual(sharedEntries[0].shared_identity_ids, sharedCodes)

  const partialSharedRegistry = {
    ...sharedRegistry,
    entries: sharedRegistry.entries.filter(entry => entry.idol_code !== '013kys'),
  }
  await writeJson(registryFile, partialSharedRegistry)
  await assert.rejects(
    publishRawCharacterImageGroup({
      workspaceRoot,
      candidateDirectories: sharedCandidateDirectories,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'shared-partial-registry'),
      confirmKey: 'birthday_visual:012yus+013kys',
    }),
    /Shared promotion birthday_visual:012yus\+013kys is incomplete/u,
  )
  await writeJson(registryFile, sharedRegistry)

  await assert.rejects(
    rollbackRawCharacterImage({
      workspaceRoot,
      registryFile,
      assetsRoot,
      backupDirectory: sharedBackup,
      confirmKey: 'birthday_visual:012yus',
    }),
    /Explicit rollback confirmation/u,
  )
  const sharedRollback = await rollbackRawCharacterImage({
    workspaceRoot,
    registryFile,
    assetsRoot,
    backupDirectory: sharedBackup,
    confirmKey: 'birthday_visual:012yus+013kys',
  })
  assert.equal(sharedRollback.asset_state, 'removed')
  assert.equal(await exists(sharedStableAsset), false)
  assert.deepEqual(
    JSON.parse(await readFile(registryFile, 'utf8')),
    baselineRegistry,
  )

  for (const [index, directory] of batchCandidateDirectories.entries()) {
    const code = batchCodes[index]
    const rawAssetBytes = Buffer.from(`fixture batch RAW bundle ${code}`)
    const rawAssetFile = path.join(
      temporaryRoot,
      'RAW',
      'asset',
      `image_chara_birthday_visual_${code}.unity3d`,
    )
    await writeFile(rawAssetFile, rawAssetBytes)
    await mkdir(path.join(directory, 'resolved'), { recursive: true })
    await writeFile(path.join(directory, 'resolved', `${code}.png`), pngBytes)
    await writeJson(
      path.join(directory, 'candidate.json'),
      batchCandidateManifest(code, rawAssetBytes),
    )
  }

  const batchConfirm = 'birthday_visual:003hok+004ter+005kao'
  await assert.rejects(
    publishRawCharacterImageBatch({
      workspaceRoot,
      candidateDirectories: Array(6).fill(batchCandidateDirectories[0]),
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'batch-too-large'),
      confirmKey: 'birthday_visual:too-large',
    }),
    /requires 2-5 candidate directories/u,
  )
  await assert.rejects(
    publishRawCharacterImageBatch({
      workspaceRoot,
      candidateDirectories: batchCandidateDirectories,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'batch-wrong-confirm'),
      confirmKey: 'birthday_visual:003hok+004ter',
    }),
    /Explicit batch promotion confirmation/u,
  )
  await assert.rejects(
    publishRawCharacterImageBatch({
      workspaceRoot,
      candidateDirectories: [
        batchCandidateDirectories[0],
        batchCandidateDirectories[0],
      ],
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'batch-duplicate'),
      confirmKey: 'birthday_visual:003hok+003hok',
    }),
    /unique identities and stable targets/u,
  )

  let batchAssetWrites = 0
  await assert.rejects(
    publishRawCharacterImageBatch({
      workspaceRoot,
      candidateDirectories: batchCandidateDirectories,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'batch-asset-failure'),
      confirmKey: batchConfirm,
      publishAsset: async (source, target) => {
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, await readFile(source))
        batchAssetWrites += 1
        if (batchAssetWrites === 2) {
          throw new Error('injected second batch asset failure')
        }
      },
    }),
    /injected second batch asset failure/u,
  )
  assert.deepEqual(
    JSON.parse(await readFile(registryFile, 'utf8')),
    baselineRegistry,
  )
  assert.deepEqual(
    await Promise.all(batchStableAssets.map(asset => exists(asset))),
    [false, false, false],
  )

  await assert.rejects(
    publishRawCharacterImageBatch({
      workspaceRoot,
      candidateDirectories: batchCandidateDirectories,
      registryFile,
      assetsRoot,
      backupDirectory: path.join(workspaceRoot, '.analysis', 'batch-registry-failure'),
      confirmKey: batchConfirm,
      publishRegistry: async () => {
        throw new Error('injected batch registry failure')
      },
    }),
    /injected batch registry failure/u,
  )
  assert.deepEqual(
    JSON.parse(await readFile(registryFile, 'utf8')),
    baselineRegistry,
  )
  assert.deepEqual(
    await Promise.all(batchStableAssets.map(asset => exists(asset))),
    [false, false, false],
  )

  const batchBackup = path.join(workspaceRoot, '.analysis', 'batch-published')
  const batchReport = await publishRawCharacterImageBatch({
    workspaceRoot,
    candidateDirectories: batchCandidateDirectories,
    registryFile,
    assetsRoot,
    backupDirectory: batchBackup,
    confirmKey: batchConfirm,
  })
  assert.deepEqual(batchReport.identity_ids, batchCodes)
  assert.deepEqual(
    await Promise.all(batchStableAssets.map(asset => exists(asset))),
    [true, true, true],
  )
  const batchRegistry = JSON.parse(await readFile(registryFile, 'utf8'))
  assert.equal(batchRegistry.entries.length, 4)
  assert.ok(batchCodes.every(code =>
    batchRegistry.entries.some(entry => entry.idol_code === code)
  ))

  await assert.rejects(
    rollbackRawCharacterImageBatch({
      workspaceRoot,
      registryFile,
      assetsRoot,
      backupDirectory: batchBackup,
      confirmKey: 'birthday_visual:003hok+004ter',
    }),
    /Explicit batch rollback confirmation/u,
  )
  await writeFile(batchStableAssets[1], Buffer.from('injected batch drift'))
  await assert.rejects(
    rollbackRawCharacterImageBatch({
      workspaceRoot,
      registryFile,
      assetsRoot,
      backupDirectory: batchBackup,
      confirmKey: batchConfirm,
    }),
    /Current batch promotion state drifted/u,
  )
  await writeFile(batchStableAssets[1], pngBytes)

  const batchRollback = await rollbackRawCharacterImageBatch({
    workspaceRoot,
    registryFile,
    assetsRoot,
    backupDirectory: batchBackup,
    confirmKey: batchConfirm,
  })
  assert.deepEqual(batchRollback.identity_ids, batchCodes)
  assert.deepEqual(
    await Promise.all(batchStableAssets.map(asset => exists(asset))),
    [false, false, false],
  )
  assert.deepEqual(
    JSON.parse(await readFile(registryFile, 'utf8')),
    baselineRegistry,
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

const sourceRegistry = JSON.parse(await readFile(
  new URL('../public/data/assets/raw_character_image_promotions.json', import.meta.url),
  'utf8',
))
assert.equal(sourceRegistry.schema_version, 1)
assert.ok(sourceRegistry.entries.length >= 1)
const sourceKeys = new Set()
for (const entry of sourceRegistry.entries) {
  const key = `${entry.kind}:${entry.idol_code}`
  assert.equal(sourceKeys.has(key), false, `duplicate stable promotion ${key}`)
  sourceKeys.add(key)
  assert.match(entry.asset_url, /^\/assets\/[a-z0-9_./-]+\.png$/i)
  assert.equal(typeof entry.unity_object?.path_id, 'string')
  assert.match(entry.unity_object.path_id, /^-?\d+$/)
  const sourceAsset = new URL(`../public${entry.asset_url}`, import.meta.url)
  const sourceBytes = await readFile(sourceAsset)
  assert.equal(hashBytes(sourceBytes), entry.output.sha256)
  assert.equal(sourceBytes.length, entry.output.bytes)
  assert.equal(sourceBytes.readUInt32BE(16), entry.output.width)
  assert.equal(sourceBytes.readUInt32BE(20), entry.output.height)
}
const firstStable = sourceRegistry.entries.find(entry =>
  entry.kind === 'birthday_visual' && entry.idol_code === '001tom',
)
assert.ok(firstStable)
assert.equal(
  firstStable.unity_object.path_id,
  '1704761937170686496',
)
assert.equal(
  firstStable.output.sha256,
  'a572186d263b52c2d70f9f2598304b2c89530f491595cc6561094ad4cf20ef2a',
)
const secondStable = sourceRegistry.entries.find(entry =>
  entry.kind === 'birthday_visual' && entry.idol_code === '002sht',
)
assert.ok(secondStable)
assert.equal(
  secondStable.unity_object.path_id,
  '-5810813441337302374',
)
assert.equal(
  secondStable.output.sha256,
  'edf893abdb34971e847da9c78032593618ddb932ad75a117334987c27500db67',
)
const committedShared = sourceRegistry.entries.filter(entry =>
  ['012yus', '013kys'].includes(entry.idol_code),
)
assert.equal(committedShared.length, 2)
assert.equal(new Set(committedShared.map(entry => entry.asset_url)).size, 1)
assert.deepEqual(committedShared[0].shared_identity_ids, ['012yus', '013kys'])
assert.deepEqual(committedShared[1].shared_identity_ids, ['012yus', '013kys'])
assert.equal(
  committedShared[0].unity_object.path_id,
  '-2746721419655100402',
)
assert.equal(
  committedShared[1].unity_object.path_id,
  '-2746721419655100402',
)
assert.equal(
  committedShared[0].output.sha256,
  '7be1b676459a964c054b0fc5658ba69442513486b9e0d495ad3d9eab0449f99e',
)
assert.equal(
  committedShared[1].output.sha256,
  '7be1b676459a964c054b0fc5658ba69442513486b9e0d495ad3d9eab0449f99e',
)
const committedBatchEvidence = {
  '003hok': {
    pathId: '8982863484449506530',
    sha256: 'a66c0fdc5bb37939a9933ddc623178ab2103a9d9e264cb447e1afabb9af63cb8',
  },
  '004ter': {
    pathId: '3602356276066031871',
    sha256: '21b644f589631f82d7e47202e1f10e04cee51b9c5e1d41ad9f3038e596f95e30',
  },
  '005kao': {
    pathId: '1892783551249285074',
    sha256: '552546a3ad317294fadbb2d73e136e3634493165089cb2b40124051134691d0b',
  },
}
for (const [idolCode, expected] of Object.entries(committedBatchEvidence)) {
  const entry = sourceRegistry.entries.find(candidate =>
    candidate.kind === 'birthday_visual' && candidate.idol_code === idolCode,
  )
  assert.ok(entry)
  assert.equal(entry.unity_object.path_id, expected.pathId)
  assert.equal(entry.output.sha256, expected.sha256)
}
const committedFiveItemEvidence = {
  '006tsu': {
    pathId: '-8280902255413043889',
    sha256: '7983ae264144a90811eba916d30073fa098bf5e213decc43ccfd9b984b3a48e7',
  },
  '007kei': {
    pathId: '-126247317626979540',
    sha256: '090dd824aabb6ec94a59c16dba272553ba205787927cf7f96f1a950cff4aafb2',
  },
  '008rei': {
    pathId: '-5985898852289501109',
    sha256: '6cdfe6fd2a4ffe6a61a6af4a0c4dbc187bc23f3130334b509685cab5847e9cfb',
  },
  '009kyj': {
    pathId: '-768001593005162926',
    sha256: 'aefd35e8fb33739dfb0b6f704254c3d6b44d4b9f4db7695fa5db56b60d2123c3',
  },
  '010pie': {
    pathId: '-6635513665076385639',
    sha256: '8a32d2c784f706acfb04d30cd1888e994a8fad6538ef259890f1537742363dac',
  },
}
for (const [idolCode, expected] of Object.entries(committedFiveItemEvidence)) {
  const entry = sourceRegistry.entries.find(candidate =>
    candidate.kind === 'birthday_visual' && candidate.idol_code === idolCode,
  )
  assert.ok(entry)
  assert.equal(entry.unity_object.path_id, expected.pathId)
  assert.equal(entry.output.sha256, expected.sha256)
}
const committedSecondFiveItemEvidence = {
  '011min': {
    pathId: '6347870598022394189',
    sha256: '08675f2afa7294b74e0d0e54f260629f16ac70c142eac589e412dce06e5cc035',
  },
  '014hid': {
    pathId: '-1827195483708291138',
    sha256: 'bec903356f54d601538a8447de8ad1fd63e4594704879b27e72336b088a28099',
  },
  '015ryu': {
    pathId: '-7974334565183057656',
    sha256: 'fd74f1543f7134ee064c300e8c643afe45fa3df907169b99d6d3b6bdce5174df',
  },
  '016sei': {
    pathId: '2109130252596898194',
    sha256: '0a76da1eb25a13aa600cfdd2bf775385368260366adb71f977e003c0f6fd77bb',
  },
  '017kir': {
    pathId: '8646653807885103205',
    sha256: 'f3789384dcda3e88eb6d5afd41f15b85cd7b4872c6761afcd24be38d23150632',
  },
}
for (const [idolCode, expected] of Object.entries(committedSecondFiveItemEvidence)) {
  const entry = sourceRegistry.entries.find(candidate =>
    candidate.kind === 'birthday_visual' && candidate.idol_code === idolCode,
  )
  assert.ok(entry)
  assert.equal(entry.unity_object.path_id, expected.pathId)
  assert.equal(entry.output.sha256, expected.sha256)
}
const committedThirdFiveItemEvidence = {
  '018shm': {
    pathId: '4083446340310980541',
    sha256: '5f7d1817c2f0773e7dffc4f19f9bb43980ad2b5e74e4263e84c54f72366562fc',
  },
  '019kur': {
    pathId: '-7541408428981436444',
    sha256: '0f1ac21c5568dbbb736958038b378edc138654b583c0c199531ab8d79c71a71a',
  },
  '020hay': {
    pathId: '8995473977128221475',
    sha256: '89a73a04f2184ea20f1d01fa9f24761fb9e133ef2c19902ac95712d3efd3b86e',
  },
  '021jun': {
    pathId: '-1079152942904299386',
    sha256: 'ecbc005484f0373aeae6ffd0399301ba5b0c254398625d03b843e6277ad6d66c',
  },
  '022nat': {
    pathId: '-5858754875459902066',
    sha256: '9d215b3c4fcf5ebc8a8079a68d5664a1cd33daf823582fc109ff2084f74b67c5',
  },
}
for (const [idolCode, expected] of Object.entries(committedThirdFiveItemEvidence)) {
  const entry = sourceRegistry.entries.find(candidate =>
    candidate.kind === 'birthday_visual' && candidate.idol_code === idolCode,
  )
  assert.ok(entry)
  assert.equal(entry.unity_object.path_id, expected.pathId)
  assert.equal(entry.output.sha256, expected.sha256)
}
const committedFourthFiveItemEvidence = {
  '023har': {
    pathId: '6274914879522109866',
    sha256: 'f2a056e1f269e11561067379ece592ca68fe6f3d42847ff9a5f84bb32c7aafb3',
  },
  '024shk': {
    pathId: '-2665266097907987525',
    sha256: '74b593a01a4cdcb7827a900ce3786f0ea061d1083b326287925e20b57250e3d4',
  },
  '025suz': {
    pathId: '1264523719426961948',
    sha256: 'f48dc2256355f95c1d8e01b41ad8fabd9e7022530f29c7480293e2f1fefab1c0',
  },
  '026gen': {
    pathId: '-1047053079907757995',
    sha256: 'fdb18f9597cf14fe8f1628d7190fe0c8a188f40eef840350521c4c18a62ba7d5',
  },
  '027yuk': {
    pathId: '-261943468093583930',
    sha256: 'd45bc2fa1a7b3cc0f3a40f789c5598d3caef9b70db5f680a705e2ec948355a07',
  },
}
for (const [idolCode, expected] of Object.entries(committedFourthFiveItemEvidence)) {
  const entry = sourceRegistry.entries.find(candidate =>
    candidate.kind === 'birthday_visual' && candidate.idol_code === idolCode,
  )
  assert.ok(entry)
  assert.equal(entry.unity_object.path_id, expected.pathId)
  assert.equal(entry.output.sha256, expected.sha256)
}
const committedFifthFiveItemEvidence = {
  '028soi': {
    pathId: '7689127519335195737',
    sha256: '75b6466cf7a89cd3fa447246a5cd4928d7aa354d8fc93feb2932e2dc87eee594',
  },
  '029ass': {
    pathId: '9001415395409568943',
    sha256: 'bf5c38a248d4241d8cce01071d2ca0d5675cff5c09be9f75bb49fd6ad2ec8bc1',
  },
  '030mak': {
    pathId: '1019936051257360751',
    sha256: '904b026b8882af6fd1e0ee802ba556d0ef2a675cb8b769e18d6c04dc61095cfc',
  },
  '031sak': {
    pathId: '-2128585307808258559',
    sha256: '96b680a6225f9cecf89b35a6617272028b79e722ed009127d58a7586ab28c43c',
  },
  '032nao': {
    pathId: '7734075291173605705',
    sha256: '65ce92e9838b54199c7a66f3647ebee2b3661280cfa404d257d42c0c879e0d23',
  },
}
for (const [idolCode, expected] of Object.entries(committedFifthFiveItemEvidence)) {
  const entry = sourceRegistry.entries.find(candidate =>
    candidate.kind === 'birthday_visual' && candidate.idol_code === idolCode,
  )
  assert.ok(entry)
  assert.equal(entry.unity_object.path_id, expected.pathId)
  assert.equal(entry.output.sha256, expected.sha256)
}
const committedSixthFiveItemEvidence = {
  '033shr': {
    pathId: '1393926239256617402',
    sha256: '5460930fb74617eff2186d2b53067180c8e0575af91c4a595708a96a04a269b9',
  },
  '034kan': {
    pathId: '2794286035226723385',
    sha256: 'e2e5e8ebad8124b01245705922eace060eb36e730b6c98d04ea7f335471d25ba',
  },
  '035mco': {
    pathId: '-2091414793709629411',
    sha256: '8f8b878300458efad403339a103b276e9baaaef64704d564cec799a81d8b4189',
  },
  '036rui': {
    pathId: '2576356709593939599',
    sha256: '900ea42d76ca98c71270f2b9660232f6d8f5c77de6b58c1e61a6574a097b235a',
  },
  '037jir': {
    pathId: '494254807622901840',
    sha256: 'bc5648cd08277512703087b28db1655eafccf89d3152ce285789dd3960f881b2',
  },
}
for (const [idolCode, expected] of Object.entries(committedSixthFiveItemEvidence)) {
  const entry = sourceRegistry.entries.find(candidate =>
    candidate.kind === 'birthday_visual' && candidate.idol_code === idolCode,
  )
  assert.ok(entry)
  assert.equal(entry.unity_object.path_id, expected.pathId)
  assert.equal(entry.output.sha256, expected.sha256)
}

console.log('RAW character-image promotion verification passed')
console.log('  exact RAW and PNG evidence, stable registry, explicit confirmation and path bounds covered')
console.log('  additive rollback, injected-failure restoration and shared-identity rejection covered')
console.log(`  ${sourceRegistry.entries.length} committed stable registry entr${sourceRegistry.entries.length === 1 ? 'y' : 'ies'} verified`)
