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
  [
    '102sha_001_00',
    '103kur_001_00',
    '104omn_001_00',
    '231sub_001_00',
    '242sub_001_00',
  ],
  'only audited silhouette-only models may bypass Spine loading',
)
for (const modelId of SILHOUETTE_ONLY_MODEL_IDS) {
  assert.equal(isSilhouetteOnlyModel(modelId), true)
  assert.equal(
    getSilhouetteUrl(modelId),
    `/assets/silhouette/${modelId}.png`,
  )
  await access(sourceUrl(`../public/assets/silhouette/${modelId}.png`))
  await assert.rejects(
    access(sourceUrl(`../public/assets/spines/${modelId}/comu.skel`)),
    { code: 'ENOENT' },
    `remove the ${modelId} silhouette-only exception when a real Spine rig is added`,
  )
}
assert.equal(isSilhouetteOnlyModel('101ken_001_00'), false)
assert.equal(isSilhouetteOnlyModel(null), false)

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

const { resolveStaticSpineModels } = await import('../src/utils/StoryAssetAdapters.js')
const use = { stepIndex: 3, stepId: 4, path: 'entry_snapshot.spines[0]' }
const sourcePlan = { unresolved: [], assets: [
  { key: 'spine-bundle:103kur_001_00', kind: 'spine-bundle', id: '103kur_001_00', required: true,
    dependencies: ['spine-skeleton:103kur_001_00', 'spine-atlas:103kur_001_00'], dependencyState: 'pending', pending: 'atlas-pages-and-model-adapter', uses: [use] },
  ...['spine-skeleton', 'spine-atlas'].map(kind => ({ key: `${kind}:103kur_001_00`, kind, id: '103kur_001_00', required: true,
    dependencies: [], dependencyState: 'complete', pending: null, uses: [use] })),
  { key: 'idol-placement:103kur', kind: 'idol-placement', id: '103kur', required: true,
    dependencies: [], dependencyState: 'complete', pending: null, uses: [use] },
  { key: 'idol-mouth:103kur', kind: 'idol-mouth', id: '103kur', required: true,
    dependencies: ['model-mouth:103kur/103kur_001_00'], dependencyState: 'complete', pending: null, uses: [use] },
] }
const resolvedPlan = resolveStaticSpineModels(sourcePlan)
assert.equal(sourcePlan.assets[0].dependencyState, 'pending', 'silhouette resolution does not mutate the source plan')
assert.deepEqual(resolvedPlan.assets.find(asset => asset.kind === 'spine-bundle').dependencies,
  ['silhouette:103kur_001_00'])
for (const kind of ['idol-placement', 'idol-mouth']) {
  const asset = resolvedPlan.assets.find(candidate => candidate.kind === kind)
  assert.equal(asset.required, false)
  assert.match(asset.runtimeDisabled, /^silhouette-has-no-/)
}

console.log('Silhouette fallback: audited model bypasses known-missing Spine requests')
