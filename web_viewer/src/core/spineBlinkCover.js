export function cancelBlinkCover(spine) {
  const blinkCfg = spine?._blinkCfg
  const saved = spine?._savedEyeAtts
  if (!spine || (!saved && !spine._blinkCoverEndTime)) return false

  if (saved) {
    for (const [slotName, attachmentName] of Object.entries(saved)) {
      try { spine.skeleton.setAttachment(slotName, attachmentName || null) } catch (_) {}
    }
    for (const item of blinkCfg?.show || []) {
      try { spine.skeleton.setAttachment(item.slot, null) } catch (_) {}
    }
  }
  spine._savedEyeAtts = null
  spine._blinkCoverEndTime = undefined
  return true
}
