import { getBgUrl, getCharaIconUrl, getMobileBgUrl, getUnitMobileBgUrl,
  getMobileIconUrl, getStampUrl, getEmojiUrl, getSpineSkelUrl,
  isSilhouetteOnlyModel } from './AssetResolver.js'
import { effectTextureUrl } from '../../shared/story/EffectTextures.js'

const imageUrls = {
  background: getBgUrl,
  'image-icon': getCharaIconUrl,
  'idol-mobile-background': getMobileBgUrl,
  'unit-mobile-background': getUnitMobileBgUrl,
  'mobile-icon': getMobileIconUrl,
  stamp: getStampUrl,
  emoji: getEmojiUrl,
  'effect-texture': effectTextureUrl,
}

/** Map logical requirements to native warming operations, never to renderer
 * readiness. Missing adapters and runtime-disabled uses remain explicit. */
export function storyAssetAdapter(asset) {
  if (asset.required === false) return { state: 'excluded', reason: asset.runtimeDisabled }
  if (Object.hasOwn(imageUrls, asset.kind)) return { state: 'discovered', operation: 'image', url: imageUrls[asset.kind](asset.id) }
  if (asset.kind === 'spine-skeleton' && !isSilhouetteOnlyModel(asset.id)) {
    return { state: 'discovered', operation: 'binary', url: getSpineSkelUrl(asset.id) }
  }
  // In particular, fetching skel cannot satisfy a bundle, and voice warming
  // must not bypass the runtime's current IDM/candidate handling.
  return { state: 'deferred', reason: asset.pending || `adapter-pending:${asset.kind}` }
}
