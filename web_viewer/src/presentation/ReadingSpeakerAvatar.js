import { readingAvatarEntity } from '../../shared/reading/ReadingDocument.js'
import { IDOL_ID_TO_NAME } from '../utils/IdolNameMap.js'

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
  // Call/Chat portraits identify the named speaker, not an on-stage model.
  // Legacy snapshots can also retain phone_mode after an authored ADV boundary.
  // Require the source actor AND public name to agree; unknown/concealed stage
  // rows and conflicting actor evidence retain the existing exclusion policy.
  const actor = row?.performance?.entityId
  const compactName = value => String(value || '').normalize('NFKC').replace(/\s+/g, '')
  if (row?.kind === 'dialogue' && ['named', 'idol'].includes(speaker?.kind)
    && row.performance?.entityType === 'idol' && row.visual?.reason === 'medium-policy-unavailable'
    && row.visual?.stepId === row.anchor?.step_id
    && (!speaker.entityId || speaker.entityId === actor)
    && (!speaker.entityType || speaker.entityType === 'idol')
    && IDOL_ID_TO_NAME[actor] && compactName(speaker.sourceName) === compactName(IDOL_ID_TO_NAME[actor])) return actor
  // Legacy compiled NPCs may be typed as "idol". Use their explicit canonical
  // code, never parse a localized name or infer identity from a model.
  return row?.kind === 'dialogue' && ['named', 'idol', 'npc'].includes(speaker?.kind) &&
    [null, undefined, 'idol', 'npc'].includes(speaker?.entityType) &&
    npcIcons.has(speaker?.entityId) && speaker?.sourceName?.trim() &&
    !/^[?？]+$/.test(speaker.sourceName.trim())
    ? speaker.entityId : null
}
