const CLOSE_SLOT_RE = /(?:eyeclosed|eye[_-]?close|eyelid[_-]?close)/i
const OPEN_SLOT_RE = /_smile|^(?:eyelash|eyewhite|eyelight|eyeline|eye_pupil|eyeball)|eyeball.*skin/i

function slotSide(name) {
  const match = String(name).match(/(?:^|_)([LR])(?:_|$)/i)
  return match?.[1]?.toUpperCase() || ''
}

export function detectBlinkSlots(spine) {
  const hide = []
  const show = []
  const skeleton = spine?.skeleton
  const data = skeleton?.data
  const skin = data?.defaultSkin
  const slotNames = data?.slots?.map(slot => slot.name) || []
  const skinAttachments = skin?.getAttachments?.() || []

  for (const name of slotNames) {
    const low = String(name).toLowerCase()
    const index = data?.findSlotIndex?.(name) ?? -1
    if (index < 0) continue

    if (CLOSE_SLOT_RE.test(low)) {
      const names = skinAttachments
        .filter(item => item.slotIndex === index)
        .map(item => item.name)
      const attachmentName = names.find(item => item === name) ||
        names.find(item => CLOSE_SLOT_RE.test(item)) ||
        names[0] || ''
      if (!attachmentName) continue
      try {
        const attachment = skin?.getAttachment?.(index, attachmentName) || skeleton.getAttachment(index, attachmentName)
        if (attachment) show.push({ slot: name, att: attachmentName })
      } catch (_) {}
    } else if (OPEN_SLOT_RE.test(low)) {
      hide.push(name)
    }
  }

  const sides = new Set(show.map(item => slotSide(item.slot)).filter(Boolean))
  if (!sides.has('L') || !sides.has('R')) return null
  return { hide, show }
}
