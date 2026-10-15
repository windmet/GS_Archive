import geometry from './chibiNativeCharacterGeometry.json' with { type: 'json' }

// Runtime skeleton child is identified by LiveIdolFactory (0x1bb88e0).
// The bound LiveObjectIdol root retains its serialized scale. SkeletonBinary
// uses scale=1 in Pixi, so apply the source asset's scale here once.
export function nativeCharacterScale(bodyType, width, height) {
  const skeletonScale = geometry.skeletonScales[bodyType]
  if (!Number.isFinite(skeletonScale)) throw new Error(`Unbound native chibi body type: ${bodyType}`)
  return skeletonScale * geometry.idolRootScale * geometry.pixelsPerUnityUnit
    * Math.min(width / 1280, height / 720)
}

export const nativeCharacterGeometry = geometry
