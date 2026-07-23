import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import {
  SILHOUETTE_ONLY_MODEL_IDS,
  getSilhouetteUrl,
  isSilhouetteOnlyModel,
} from '../src/utils/AssetResolver.js'

const sourceUrl = relative => new URL(relative, import.meta.url)
const stageSource = await import('node:fs/promises')
  .then(({ readFile }) => readFile(sourceUrl('../src/components/SpineStage.vue'), 'utf8'))

assert.deepEqual(
  SILHOUETTE_ONLY_MODEL_IDS,
  ['102sha_001_00'],
  'only audited silhouette-only models may bypass Spine loading',
)
assert.equal(isSilhouetteOnlyModel('102sha_001_00'), true)
assert.equal(isSilhouetteOnlyModel('101ken_001_00'), false)
assert.equal(isSilhouetteOnlyModel(null), false)
assert.equal(
  getSilhouetteUrl('102sha_001_00'),
  '/assets/silhouette/102sha_001_00.png',
)

await access(sourceUrl('../public/assets/silhouette/102sha_001_00.png'))
await assert.rejects(
  access(sourceUrl('../public/assets/spines/102sha_001_00/comu.skel')),
  { code: 'ENOENT' },
  'remove the silhouette-only exception when a real Spine rig is added',
)

const directFallback = stageSource.indexOf('isSilhouetteOnlyModel(modelId)')
const spineProbe = stageSource.indexOf('await manager.spawnSpine(sid, modelId')
assert.ok(directFallback >= 0, 'SpineStage must recognize the explicit silhouette-only contract')
assert.ok(
  directFallback < spineProbe,
  'known silhouette-only models must bypass the Spine network probe',
)
assert.match(
  stageSource.slice(directFallback, spineProbe),
  /manager\.showSilhouette\(sid, modelId, posX, 0, rootY\)/,
)

console.log('Silhouette fallback: audited model bypasses known-missing Spine requests')
