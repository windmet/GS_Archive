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

// Exact Japanese source names that identify an audited icon even when the row carries no code
// and no stage actor (voice messages, off-stage lines, a character riding on someone).
// Names are speaker_dictionary display_name values (checked by verify-reading-speaker-avatars),
// plus two aliases seen in real rows. Shared or generic names stay code-only: SP (201-203sub)
// and 店主 (211sub) name different people in different stories.
export const READING_NPC_SOURCE_NAMES = Object.freeze({
  '山村 賢': '101ken', '315 STARS（齋藤孝司）': '102sha', '齋藤社長': '102sha', '黒井社長': '103kur',
  'アイドル業界の大物': '104omn', 'あまね': '204sub', '市川 白鶴': '205sub', '鷹城 恭一': '206sub',
  '直央の母': '207sub', '圭の友人': '208sub', '麗の姉': '209sub', '想楽の兄': '210sub',
  '九郎の祖父': '212sub', '秀の親友': '213sub', '旬の父': '214sub', '翔太の姉（三女）': '215sub',
  '隼人の兄': '216sub', '雨彦の父': '236sub', '薫の姉': '238sub', 'かのんの父': '240sub',
  'にゃん喜威': '241sub', '漣の父': '246sub',
})
const compactName = value => String(value || '').normalize('NFKC').replace(/\s+/g, '')
const codeBySourceName = new Map([
  // IDOL_ID_TO_NAME also holds NPC, unit and crowd labels; only the 49 idol codes match by name here.
  ...Object.entries(IDOL_ID_TO_NAME).filter(([code]) => /^0[0-4]\d[a-z]{3}$/.test(code)).map(([code, name]) => [compactName(name), code]),
  ...Object.entries(READING_NPC_SOURCE_NAMES).map(([name, code]) => [compactName(name), code]),
])

export function readingSpeakerAvatarEntity(row) {
  const idol = readingAvatarEntity(row)
  if (idol) return idol
  const speaker = row?.speaker
  // Call/Chat portraits identify the named speaker, not an on-stage model.
  // Legacy snapshots can also retain phone_mode after an authored ADV boundary.
  // Require the source actor AND public name to agree; unknown/concealed stage
  // rows and conflicting actor evidence retain the existing exclusion policy.
  const actor = row?.performance?.entityId
  if (row?.kind === 'dialogue' && ['named', 'idol'].includes(speaker?.kind)
    && row.performance?.entityType === 'idol' && row.visual?.reason === 'medium-policy-unavailable'
    && row.visual?.stepId === row.anchor?.step_id
    && (!speaker.entityId || speaker.entityId === actor)
    && (!speaker.entityType || speaker.entityType === 'idol')
    && IDOL_ID_TO_NAME[actor] && compactName(speaker.sourceName) === compactName(IDOL_ID_TO_NAME[actor])) return actor
  // Legacy compiled NPCs may be typed as "idol". Use their explicit canonical
  // code, never parse a localized name or infer identity from a model.
  if (row?.kind !== 'dialogue' || !['named', 'idol', 'npc'].includes(speaker?.kind) ||
    ![null, undefined, 'idol', 'npc'].includes(speaker?.entityType) || !speaker?.sourceName?.trim() ||
    /^[?？]+$/.test(speaker.sourceName.trim())) return null
  if (npcIcons.has(speaker.entityId)) return speaker.entityId
  // No code and no usable stage actor: the printed source name itself identifies the speaker.
  // A row whose explicit code disagrees with its name keeps no avatar.
  const named = codeBySourceName.get(compactName(speaker.sourceName))
  return named && (!speaker.entityId || speaker.entityId === named) ? named : null
}
