import { readingAvatarEntity } from '../../shared/reading/ReadingDocument.js'

// Audited against RAW image_chara_icons.unity3d and published character PNGs.
// These are speaker reference icons, not proof of a character being on stage.
// Producer, crowd and generic mob icons are deliberately not person identities.
export const READING_NPC_ICON_CODES = Object.freeze([
  '101ken', '102sha', '103kur', '104omn',
  '201sub', '202sub', '203sub', '204sub', '205sub', '206sub', '207sub',
  '208sub', '209sub', '210sub', '211sub', '212sub', '213sub', '214sub',
  '215sub', '216sub', '236sub', '238sub', '240sub', '241sub', '246sub',
])
const npcIcons = new Set(READING_NPC_ICON_CODES)

export function readingSpeakerAvatarEntity(row) {
  const idol = readingAvatarEntity(row)
  if (idol) return idol
  const speaker = row?.speaker
  // Legacy compiled NPCs may be typed as "idol". Use their explicit canonical
  // code, never parse a localized name or infer identity from a model.
  return row?.kind === 'dialogue' && ['named', 'idol', 'npc'].includes(speaker?.kind) &&
    [null, undefined, 'idol', 'npc'].includes(speaker?.entityType) &&
    npcIcons.has(speaker?.entityId) && speaker?.sourceName?.trim() &&
    !/^[?？]+$/.test(speaker.sourceName.trim())
    ? speaker.entityId : null
}
