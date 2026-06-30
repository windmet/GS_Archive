export function getSelectedReferenceY({
  charaId,
  modelId = '',
  usePrefabMeta = true,
  costumePrefabMeta = {},
  otherSettingCache = {},
}) {
  const prefab = usePrefabMeta ? costumePrefabMeta?.[modelId] : null
  const prefabY = prefab?.derived?.prefabPositionY
    ?? prefab?.rect?.localPosition?.y
    ?? prefab?.rect?.anchoredPosition?.y
  const other = otherSettingCache?.[charaId]
  const otherY = typeof other?.positionY === 'number' ? other.positionY : null

  const y = typeof prefabY === 'number' ? prefabY : typeof otherY === 'number' ? otherY : null
  const source = typeof prefabY === 'number' ? 'prefab_direct' : typeof otherY === 'number' ? 'idolothersetting' : 'default'

  return {
    y,
    source,
    prefabHit: !!prefab,
    prefabY: typeof prefabY === 'number' ? prefabY : null,
    otherY,
  }
}

export function resolveBaseY({
  charaId,
  modelId = '',
  usePrefabMeta = true,
  costumePrefabMeta = {},
  otherSettingCache = {},
  modelYOffsetMap = {},
  baseAnchor = 780,
  subBaseAnchor = 750,
  anchorUnityY = -575,
  subAnchorUnityY = -510,
  pixelScale = 0.75,
  subPixelScale = 0.75,
  subModelRe = /_1\d{2}$/,
}) {
  const reference = getSelectedReferenceY({
    charaId,
    modelId,
    usePrefabMeta,
    costumePrefabMeta,
    otherSettingCache,
  })
  const modelYOffset = modelYOffsetMap?.[modelId] || 0
  const isSubModel = subModelRe.test(modelId)
  const baseY = isSubModel ? subBaseAnchor : baseAnchor
  const referenceY = typeof reference.y === 'number' ? reference.y : null

  let computedBaseY = baseY
  if (Number.isFinite(referenceY)) {
    computedBaseY = isSubModel
      ? subBaseAnchor - (referenceY - subAnchorUnityY) * subPixelScale
      : baseAnchor - (referenceY - anchorUnityY) * pixelScale
  }

  return {
    reference,
    computedBaseY,
    finalBaseY: computedBaseY + modelYOffset,
  }
}

export function computeVisualRootY(baseY, posY = 0, managerWidth = 1280) {
  return baseY - posY * (managerWidth / 1280)
}
