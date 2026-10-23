/**
 * Portal card-art thumbnails: one logical URL contract shared by the browser
 * resolver, the dev server and the deployment exporter.
 *
 * The Portal draws card art at thumbnail sizes but the card detail page keeps
 * the original PNG, so a thumbnail is its own URL family rather than a
 * deployment transform of the original request key:
 *
 *   /assets/card-art/portrait/image_card_portrait_hide_003hok_ssr02p.png   (detail, lossless PNG)
 *   /assets/card-art/thumb/portrait/image_card_portrait_hide_003hok_ssr02p.webp
 *
 * The `.webp` extension is deliberate. `PreviewAssetTransform` only renames
 * `.png` request keys, so a `.webp` request key resolves to itself and the
 * deployment copies the already-encoded thumbnail bytes instead of re-encoding
 * them losslessly. An alpha plane keeps the lossy encoder's `exact` behaviour,
 * so the transparent surround stays clean at these sizes.
 *
 * Sizes follow the Portal bento's actual painted area, measured in the browser
 * at 1024/1366/1920 CSS px and doubled for a retina desktop: the lead landscape
 * is at most ~535 CSS px wide, the portrait tiles at most ~260. Batch C (one
 * landscape plus three portraits in a single equal-height row) draws both
 * smaller, so these are an upper bound, not a target to grow into.
 */

export const CARD_ART_THUMB_PREFIX = 'assets/card-art/thumb/'

export const CARD_ART_THUMB_QUALITY = 80

export const CARD_ART_THUMB_SIZES = Object.freeze({
  landscape: Object.freeze({ width: 960, height: 512 }), // 15:8
  portrait: Object.freeze({ width: 480, height: 600 }), // 4:5
})

// Only the unframed portrait is drawn by the Portal (`getCardPortraitUrl`'s
// default); the framed `show` variant belongs to the card detail page and keeps
// the original PNG. Landscape art is only ever drawn by the Portal.
const PORTRAIT_SOURCE = /^assets\/card-art\/portrait\/image_card_portrait_hide_([A-Za-z0-9_]+)\.png$/
const LANDSCAPE_SOURCE = /^assets\/card-art\/landscape\/image_card_landscape_([A-Za-z0-9_]+)\.png$/
const THUMB_KEY = /^assets\/card-art\/thumb\/(portrait|landscape)\/(image_card_(?:portrait|landscape)_[A-Za-z0-9_]+)\.webp$/

/** Original card-art request key -> its thumbnail request key; null when not thumbnailed. */
export function cardArtThumbKey(requestKey) {
  if (typeof requestKey !== 'string') return null
  const portrait = PORTRAIT_SOURCE.exec(requestKey)
  if (portrait) return `${CARD_ART_THUMB_PREFIX}portrait/image_card_portrait_hide_${portrait[1]}.webp`
  const landscape = LANDSCAPE_SOURCE.exec(requestKey)
  if (landscape) return `${CARD_ART_THUMB_PREFIX}landscape/image_card_landscape_${landscape[1]}.webp`
  return null
}

/** Original card-art request key -> thumbnail URL (leading slash); '' when not thumbnailed. */
export function cardArtThumbUrl(requestKey) {
  const key = cardArtThumbKey(typeof requestKey === 'string' ? requestKey.replace(/^\/+/, '') : '')
  return key ? `/${key}` : ''
}

export function isCardArtThumbKey(key) {
  return typeof key === 'string' && THUMB_KEY.test(key)
}

/** Thumbnail request key -> the original card-art request key it was derived from. */
export function cardArtThumbSourceKey(thumbKey) {
  const match = isCardArtThumbKey(thumbKey) ? THUMB_KEY.exec(thumbKey) : null
  if (!match) return null
  return match[1] === 'portrait'
    ? `assets/card-art/portrait/${match[2]}.png`
    : `assets/card-art/landscape/${match[2]}.png`
}

/** Thumbnail request key -> its fixed encoded size. */
export function cardArtThumbSpec(thumbKey) {
  const match = isCardArtThumbKey(thumbKey) ? THUMB_KEY.exec(thumbKey) : null
  return match ? CARD_ART_THUMB_SIZES[match[1]] : null
}
