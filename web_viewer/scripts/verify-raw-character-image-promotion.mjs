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
  rollbackRawCharacterImage,
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
const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const rawBytes = Buffer.from('fixture RAW Unity Sprite bundle')

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

try {
  await mkdir(path.dirname(rawFile), { recursive: true })
  await mkdir(path.dirname(candidateAsset), { recursive: true })
  await writeFile(rawFile, rawBytes)
  await writeFile(candidateAsset, pngBytes)
  await writeJson(path.join(candidateDirectory, 'candidate.json'), candidateManifest())
  await writeJson(registryFile, { schema_version: 1, entries: [] })
  await mkdir(assetsRoot, { recursive: true })

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
  assert.equal(promotedRegistry.entries.length, 1)
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
    { schema_version: 1, entries: [] },
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
    { schema_version: 1, entries: [] },
  )

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

console.log('RAW character-image promotion verification passed')
console.log('  exact RAW and PNG evidence, stable registry, explicit confirmation and path bounds covered')
console.log('  additive rollback, injected-failure restoration and shared-identity rejection covered')
console.log(`  ${sourceRegistry.entries.length} committed stable registry entr${sourceRegistry.entries.length === 1 ? 'y' : 'ies'} verified`)
