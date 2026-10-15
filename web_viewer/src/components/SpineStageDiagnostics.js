export function pickBoundsTargetId({ step, manager }) {
  const charaId = step?.chara_id
  if (charaId && manager?.spineInstances?.[charaId]) return charaId
  const desired = step?.state?.spines?.find(s => s?.id && manager?.spineInstances?.[s.id] && s.model)
  if (desired?.id) return desired.id
  return Object.keys(manager?.spineInstances || {})[0] || null
}

export function buildBoundsSnapshot({ step, manager, boundsDebug, getDialogueBoxTop }) {
  if (!boundsDebug || !manager) return null
  const id = pickBoundsTargetId({ step, manager })
  if (!id) return null
  const snap = manager.getSpineRuntimeSnapshot(id)
  if (!snap) return null

  const rootY = snap.root?.y ?? null
  const visibleTop = snap.bounds?.top ?? null
  const visibleBottom = snap.bounds?.bottom ?? null
  const dialogueBoxTop = getDialogueBoxTop()
  const line = (key, label, y) => ({ key, label, y: Number.isFinite(y) ? y : 0 })

  return {
    idolId: id,
    modelId: snap.modelId || '',
    rootY,
    visibleTop,
    visibleBottom,
    prefabY: snap.placement?.figure?.prefabY ?? null,
    dialogueBoxTop,
    lines: [
      line('root', 'rootY', rootY),
      line('top', 'visibleTop', visibleTop),
      line('bottom', 'visibleBottom', visibleBottom),
      line('dialogue', 'dialogueBoxTop', dialogueBoxTop),
    ],
  }
}

// Debug panel row: screen transform plus the native placement it came from.
export function buildSpineDebugState({ id, state, manager, costumeDictionary }) {
  const modelId = state.modelId || manager?.spineInstances?.[id]?.modelId || ''
  const snap = manager?.getSpineRuntimeSnapshot?.(id) || null
  const rootY = snap?.root?.y
  const bounds = snap?.bounds && Number.isFinite(rootY) ? {
    top: snap.bounds.top,
    bottom: snap.bounds.bottom,
    height: snap.bounds.height,
    rootToTop: snap.bounds.top - rootY,
    rootToBottom: snap.bounds.bottom - rootY,
  } : null
  return {
    ...state,
    modelId,
    figure: snap?.placement?.figure || null,
    adv: snap?.placement?.adv || null,
    costumeInfo: costumeDictionary?.[modelId] || null,
    bounds,
  }
}
