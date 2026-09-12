import { getBgUrl, getMobileBgUrl, getUnitMobileBgUrl,
  getMobileIconUrl, getStampUrl, getEmojiUrl, getSpineSkelUrl,
  isSilhouetteOnlyModel, getSpineAtlasUrl, getSilhouetteUrl,
  getMouthSettingUrl, getOtherSettingUrl, getBodyTypeUrl, getCostumePrefabMetaUrl,
  getCostumeDictionaryUrl, getIdolMotionSettingUrl } from './AssetResolver.js'
import { effectTextureUrl } from '../../shared/story/EffectTextures.js'

const imageUrls = {
  background: getBgUrl,
  'idol-mobile-background': getMobileBgUrl,
  'unit-mobile-background': getUnitMobileBgUrl,
  'mobile-icon': getMobileIconUrl,
  stamp: getStampUrl,
  emoji: getEmojiUrl,
  'effect-texture': effectTextureUrl,
  silhouette: getSilhouetteUrl,
}
const configUrls = {
  'idol-placement': getOtherSettingUrl, 'idol-body-types': getBodyTypeUrl,
  'idol-motion': getIdolMotionSettingUrl, 'costume-prefab-metadata': getCostumePrefabMetaUrl,
  'costume-dictionary': getCostumeDictionaryUrl,
}

/** Map logical requirements to native warming operations, never to renderer
 * readiness. Missing adapters and runtime-disabled uses remain explicit. */
export function storyAssetAdapter(asset) {
  if (asset.required === false) return { state: 'excluded', reason: asset.runtimeDisabled }
  if (Object.hasOwn(configUrls, asset.kind)) return { state: 'discovered', operation: 'json',
    urls: [configUrls[asset.kind](asset.id)], cache: ['idol-motion', 'costume-prefab-metadata'].includes(asset.kind) ? 'no-store' : 'default' }
  if (asset.kind === 'model-mouth') {
    if (isSilhouetteOnlyModel(asset.modelId)) return { state: 'excluded', reason: 'silhouette-has-no-mouth-rig' }
    return { state: 'discovered', operation: 'json', urls: asset.candidateIds.map(getMouthSettingUrl), cache: 'default' }
  }
  if (Object.hasOwn(imageUrls, asset.kind)) return { state: 'discovered', operation: 'image', url: imageUrls[asset.kind](asset.id) }
  if (asset.kind === 'spine-skeleton' && !isSilhouetteOnlyModel(asset.id)) {
    return { state: 'discovered', operation: 'binary', url: getSpineSkelUrl(asset.id) }
  }
  if (asset.kind === 'spine-atlas' && !isSilhouetteOnlyModel(asset.id)) {
    return { state: 'discovered', operation: 'atlas', url: getSpineAtlasUrl(asset.id) }
  }
  if (asset.kind === 'spine-texture') return { state: 'discovered', operation: 'spine-page' }
  if (asset.kind === 'idol-mouth') return { state: 'deferred', reason: 'logical-dependency-group' }
  // In particular, fetching skel cannot satisfy a bundle, and voice warming
  // must not bypass the runtime's current IDM/candidate handling.
  return { state: 'deferred', reason: asset.pending || `adapter-pending:${asset.kind}` }
}

/** Resolve only the runtime's audited static PNG models. Dynamic fallback on
 * failed Spine parsing is not evidence that another model is PNG-only. */
export function resolveStaticSpineModels(input) {
  const plan = structuredClone(input)
  for (const bundle of plan.assets.filter(asset => asset.kind === 'spine-bundle' && asset.dependencyState === 'pending' && isSilhouetteOnlyModel(asset.id))) {
    for (const key of bundle.dependencies) {
      const asset = plan.assets.find(asset => asset.key === key)
      asset.required = false
      asset.runtimeDisabled = 'silhouette-only-model'
      asset.dependencyState = 'complete'
      asset.pending = null
    }
    const key = `silhouette:${bundle.id}`
    plan.assets.push({ key, kind: 'silhouette', id: bundle.id, required: true,
      dependencies: [], dependencyState: 'complete', pending: null, uses: structuredClone(bundle.uses) })
    bundle.dependencies = [key]
    bundle.dependencyState = 'complete'
    bundle.pending = null
    bundle.modelKind = 'silhouette'
  }
  plan.dependenciesComplete = !plan.unresolved.length && plan.assets.every(asset => asset.dependencyState === 'complete')
  return plan
}
