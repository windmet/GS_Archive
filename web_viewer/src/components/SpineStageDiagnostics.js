export function pickBoundsTargetId({ step, manager }) {
  const charaId = step?.chara_id
  if (charaId && manager?.spineInstances?.[charaId]) return charaId
  const desired = step?.state?.spines?.find(s => s?.id && manager?.spineInstances?.[s.id] && s.model)
  if (desired?.id) return desired.id
  return Object.keys(manager?.spineInstances || {})[0] || null
}

export function buildBoundsSnapshot({
  step,
  manager,
  boundsDebug,
  yDebugStore,
  getDialogueBoxTop,
}) {
  if (!boundsDebug || !manager) return null
  const id = pickBoundsTargetId({ step, manager })
  if (!id) return null
  const snap = manager.getSpineRuntimeSnapshot(id)
  if (!snap) return null

  const diag = yDebugStore[id] || {}
  const rootY = snap.root?.y ?? null
  const visibleTop = snap.bounds?.top ?? null
  const visibleBottom = snap.bounds?.bottom ?? null
  const prefabMappedY = diag.computedBaseY ?? null
  const dialogueBoxTop = getDialogueBoxTop()

  return {
    idolId: id,
    modelId: snap.modelId || '',
    rootY,
    visibleTop,
    visibleBottom,
    prefabMappedY,
    dialogueBoxTop,
    lines: [
      { key: 'root', label: 'rootY', y: Number.isFinite(rootY) ? rootY : 0 },
      { key: 'top', label: 'visibleTop', y: Number.isFinite(visibleTop) ? visibleTop : 0 },
      { key: 'bottom', label: 'visibleBottom', y: Number.isFinite(visibleBottom) ? visibleBottom : 0 },
      { key: 'prefab', label: 'prefabMapped', y: Number.isFinite(prefabMappedY) ? prefabMappedY : 0 },
      { key: 'dialogue', label: 'dialogueBoxTop', y: Number.isFinite(dialogueBoxTop) ? dialogueBoxTop : 0 },
    ],
  }
}

export function buildYDiagnosticRow({
  charaId,
  modelId,
  reference,
  manager,
  resolveBaseY,
  config,
}) {
  const resolved = resolveBaseY({
    charaId,
    modelId,
    usePrefabMeta: config.usePrefabMeta,
    costumePrefabMeta: config.costumePrefabMeta,
    otherSettingCache: config.otherSettingCache,
    modelYOffsetMap: config.modelYOffsetMap,
    baseAnchor: config.baseAnchor,
    subBaseAnchor: config.subBaseAnchor,
    anchorUnityY: config.anchorUnityY,
    subAnchorUnityY: config.subAnchorUnityY,
    pixelScale: config.pixelScale,
    subPixelScale: config.subPixelScale,
    subModelRe: config.subModelRe,
  })
  const snap = manager?.getSpineRuntimeSnapshot?.(charaId) || null
  const rootY = snap?.root?.y
  const bounds = snap?.bounds && Number.isFinite(rootY) ? {
    top: snap.bounds.top,
    bottom: snap.bounds.bottom,
    height: snap.bounds.height,
    rootToTop: snap.bounds.top - rootY,
    rootToBottom: snap.bounds.bottom - rootY,
  } : null
  const localBounds = snap?.localBounds ? {
    top: snap.localBounds.top,
    bottom: snap.localBounds.bottom,
    height: snap.localBounds.height,
  } : null
  const baselineBounds = snap?.baselineSkeletonLocalBounds ? {
    top: snap.baselineSkeletonLocalBounds.top,
    bottom: snap.baselineSkeletonLocalBounds.bottom,
    height: snap.baselineSkeletonLocalBounds.height,
  } : null

  return {
    charaId,
    modelId,
    prefabY: reference.prefabY,
    otherY: reference.otherY,
    referenceY: reference.y,
    referenceSource: reference.source,
    prefabMeta: config.costumePrefabMeta?.[modelId] || null,
    costumeInfo: config.costumeDictionary?.[modelId] || null,
    computedBaseY: resolved.computedBaseY,
    finalBaseY: resolved.finalBaseY,
    baseline: snap?.baseline || null,
    bounds,
    localBounds,
    baselineBounds,
  }
}

export function buildSpineDebugState({
  id,
  state,
  manager,
  resolveBaseY,
  config,
}) {
  const modelId = state.modelId || manager?.spineInstances?.[id]?.modelId || ''
  const reference = resolveBaseY({
    charaId: id,
    modelId,
    usePrefabMeta: config.usePrefabMeta,
    costumePrefabMeta: config.costumePrefabMeta,
    otherSettingCache: config.otherSettingCache,
    modelYOffsetMap: config.modelYOffsetMap,
    baseAnchor: config.baseAnchor,
    subBaseAnchor: config.subBaseAnchor,
    anchorUnityY: config.anchorUnityY,
    subAnchorUnityY: config.subAnchorUnityY,
    pixelScale: config.pixelScale,
    subPixelScale: config.subPixelScale,
    subModelRe: config.subModelRe,
  }).reference
  const yResolved = resolveBaseY({
    charaId: id,
    modelId,
    usePrefabMeta: config.usePrefabMeta,
    costumePrefabMeta: config.costumePrefabMeta,
    otherSettingCache: config.otherSettingCache,
    modelYOffsetMap: config.modelYOffsetMap,
    baseAnchor: config.baseAnchor,
    subBaseAnchor: config.subBaseAnchor,
    anchorUnityY: config.anchorUnityY,
    subAnchorUnityY: config.subAnchorUnityY,
    pixelScale: config.pixelScale,
    subPixelScale: config.subPixelScale,
    subModelRe: config.subModelRe,
  })
  const snap = manager?.getSpineRuntimeSnapshot?.(id) || null
  const rootY = snap?.root?.y
  const bounds = snap?.bounds && Number.isFinite(rootY) ? {
    top: snap.bounds.top,
    bottom: snap.bounds.bottom,
    height: snap.bounds.height,
    rootToTop: snap.bounds.top - rootY,
    rootToBottom: snap.bounds.bottom - rootY,
  } : null
  const localBounds = snap?.localBounds ? {
    top: snap.localBounds.top,
    bottom: snap.localBounds.bottom,
    height: snap.localBounds.height,
  } : null
  const baselineBounds = snap?.baselineSkeletonLocalBounds ? {
    top: snap.baselineSkeletonLocalBounds.top,
    bottom: snap.baselineSkeletonLocalBounds.bottom,
    height: snap.baselineSkeletonLocalBounds.height,
  } : null

  return {
    ...state,
    modelId,
    referenceY: reference.y,
    referenceSource: reference.source,
    prefabMeta: config.costumePrefabMeta?.[modelId] || null,
    costumeInfo: config.costumeDictionary?.[modelId] || null,
    computedBaseY: yResolved.computedBaseY,
    finalBaseY: yResolved.finalBaseY,
    baseline: snap?.baseline || null,
    bounds,
    localBounds,
    baselineBounds,
  }
}

export function logYDiagnostics({
  row,
  enabled,
  debugMode,
  store,
}) {
  if (!enabled && !debugMode) return
  store[row.charaId] = {
    ...row,
    time: new Date().toISOString(),
  }
  console.table([row])
}
