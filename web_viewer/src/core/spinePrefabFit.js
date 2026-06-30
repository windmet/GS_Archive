function safeGetLocalBounds(spine) {
  try {
    return spine?.getLocalBounds?.() || null
  } catch (_) {
    return null
  }
}

export function getPrefabRectMetrics(spine, prefabMeta) {
  const rect = prefabMeta?.rect
  if (!spine || !rect) return null

  const local = safeGetLocalBounds(spine)
  if (!local || !Number.isFinite(local.height) || local.height <= 0) return null

  const pivot = {
    x: prefabMeta?.derived?.pivotX ?? rect.pivot?.x ?? 0,
    y: prefabMeta?.derived?.pivotY ?? rect.pivot?.y ?? 0,
  }
  const size = rect.sizeDelta || {}
  const anchored = rect.anchoredPosition || rect.localPosition || {}
  const localTop = local.y
  const localBottom = local.y + local.height
  const localCenterY = local.y + local.height / 2
  const rawRectToLocal = Number.isFinite(size.y) && size.y > 0 ? size.y / local.height : null

  return {
    prefabY: prefabMeta?.derived?.prefabPositionY ?? anchored.y ?? null,
    pivotY: pivot.y,
    sizeDeltaY: size.y ?? null,
    rectTopY: null,
    rectBottomY: null,
    rectHeight: size.y ?? null,
    rectCenterY: null,
    localTop,
    localBottom,
    localCenterY,
    localHeight: local.height,
    rawRectToLocal,
  }
}

export function fitSpineToPrefabRect(spine, prefabMeta, stageHeight, options = {}) {
  const rect = prefabMeta?.rect
  if (!spine || !rect) return null

  const hasPivot = !!rect.pivot || prefabMeta?.derived?.pivotY != null
  const pivot = hasPivot
    ? { x: prefabMeta?.derived?.pivotX ?? rect.pivot?.x ?? 0, y: prefabMeta?.derived?.pivotY ?? rect.pivot?.y ?? 0 }
    : null
  const size = rect.sizeDelta || null
  const anchored = rect.anchoredPosition || rect.localPosition || null
  if (!pivot || !size || !anchored) return null

  const local = safeGetLocalBounds(spine)
  if (!local || !Number.isFinite(local.height) || local.height <= 0) return null

  const uiScale = stageHeight / 720
  const centerY = stageHeight * 0.5
  const rectTopY = centerY - (anchored.y + (1 - pivot.y) * size.y) * uiScale
  const rectBottomY = centerY - (anchored.y - pivot.y * size.y) * uiScale
  const rectCenterY = (rectTopY + rectBottomY) / 2
  const targetHeight = rectBottomY - rectTopY
  if (!Number.isFinite(targetHeight) || targetHeight <= 0) return null

  const targetScale = targetHeight / local.height
  const localTop = local.y
  const localBottom = local.y + local.height
  const localCenterY = local.y + local.height / 2
  const anchorMode = (options.anchorMode || 'bottom').toLowerCase()
  let rootY = rectBottomY - localBottom * targetScale
  if (anchorMode === 'top') {
    rootY = rectTopY - localTop * targetScale
  } else if (anchorMode === 'center') {
    rootY = rectCenterY - localCenterY * targetScale
  } else if (anchorMode === 'bottom') {
    rootY = rectBottomY - localBottom * targetScale
  }

  spine.scale.set(targetScale)
  spine.y = rootY
  spine._baseScale = targetScale
  spine._prefabRectFit = {
    rectTopY,
    rectBottomY,
    rectCenterY,
    targetHeight,
    localHeight: local.height,
    localTop,
    localBottom,
    localCenterY,
    rootY,
    scale: targetScale,
    anchorMode,
  }
  return spine._prefabRectFit
}
