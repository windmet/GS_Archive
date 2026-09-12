/**
 * Communication (talk / call) presentation assets.
 *
 * The archive ships no phone chrome as an image: the device frame, bubbles and
 * rails are drawn in CSS. The only image files a phone scene loads are the
 * surfaces below are the currently mapped requirements. Sharing URL helpers
 * prevents URL-format drift; it does not prove that discovery covers every
 * runtime history, message or translated marker.
 */
export const ASSET_BASE = '/assets'

export const COMMUNICATION_TYPES = new Set(['talk', 'talk_stamp', 'call'])

export function mobileIconUrl(charaId) {
  return `${ASSET_BASE}/idols/mobile_icons/image_chara_mobile_icon_${charaId}.png`
}

/** Call scenes use the character-surface background. */
export function characterMobileBackgroundUrl(charaId) {
  return `${ASSET_BASE}/idols/mobile_bg/image_chara_mobile_background_${charaId}.png`
}

/** Chat scenes use the unit-surface background. */
export function unitMobileBgUrl(unitCode) {
  return `${ASSET_BASE}/units/mobile_bg/image_unit_mobile_background_${unitCode}.png`
}

export function stampUrl(stampId) {
  return `${ASSET_BASE}/stamps/${stampId}.png`
}

export function emojiUrl(emojiId) {
  return `${ASSET_BASE}/emojis/${emojiId}.png`
}

/**
 * Source message markers, following MobileChatScene / MobileMessageBubble:
 * only a whole-message stamp goes through the stamp URL. Inside mixed text,
 * every valid marker goes through the emoji URL, even a stamp-shaped id.
 */
export function messageMarkers(text) {
  const stamps = new Set()
  const emojis = new Set()
  if (typeof text !== 'string' || !text) return { stamps: [...stamps], emojis: [...emojis] }
  const wholeStamp = text.match(/^<emoji>(image_mobile_stamp_.+?)<\/emoji>$/)
  if (wholeStamp) return { stamps: [wholeStamp[1]], emojis: [] }
  const pattern = /<emoji>(.+?)<\/emoji>/g
  let match
  while ((match = pattern.exec(text))) {
    const id = match[1]
    if (!/^[A-Za-z0-9._-]+$/.test(id)) continue
    emojis.add(id)
  }
  return { stamps: [...stamps], emojis: [...emojis] }
}

// Note: there is deliberately no mode helper here. Deciding which scene a step
// shows — including what it inherits from earlier steps — belongs to
// resolveCommunicationContext alone; a second, step-local rule would be free to
// disagree with the scenes about which surface is on screen.

/**
 * The assets one resolved communication scene loads.
 *
 * `mode`, `charaId` and `unitCode` are the resolved presentation context, so a
 * choice step inside a conversation is described by the scene it continues
 * rather than by what it carries itself. Unresolved context yields an explicit
 * reason instead of a guessed id, which keeps the gap visible.
 *
 * @returns {({kind: string, id: string} | {reason: string})[]}
 */
export function communicationUiAssets({ mode, unitCode = null, charaId = '', texts = [] }) {
  if (!mode) return []
  const assets = []
  // A requirement is either an id or a stated reason, never both: a surface
  // that resolved must not also carry the note explaining when it would not.
  const surface = mode === 'call'
    ? { kind: 'idol-mobile-background', id: charaId, missing: 'communication-without-character' }
    : { kind: 'unit-mobile-background', id: unitCode, missing: 'communication-without-unit' }
  assets.push(surface.id ? { kind: surface.kind, id: surface.id } : { reason: surface.missing })

  if (charaId) assets.push({ kind: 'mobile-icon', id: charaId })
  // Call scenes render plain text, so only chat scenes pull emoji and stamp images.
  if (mode !== 'call') {
    for (const text of texts) {
      const { stamps, emojis } = messageMarkers(text)
      for (const id of stamps) assets.push({ kind: 'stamp', id })
      for (const id of emojis) assets.push({ kind: 'emoji', id })
    }
  }
  return assets
}
