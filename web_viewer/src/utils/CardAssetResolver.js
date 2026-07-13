export function getCardIconUrl(resourceId, awakened = true) {
  if (!resourceId) return ''
  return `/assets/cards/icons/image_card_icon_${resourceId}${awakened ? 'p' : ''}.png`
}

export function getCardLargeImageUrl(resourceId, awakened = true) {
  if (!resourceId) return ''
  return `/assets/cards/large/image_card_portrait_show_${resourceId}${awakened ? 'p' : ''}.png`
}

export function getCardPortraitUrl(resourceId, awakened = true, framed = false) {
  if (!resourceId) return ''
  const variant = framed ? 'show' : 'hide'
  return `/assets/card-art/portrait/image_card_portrait_${variant}_${resourceId}${awakened ? 'p' : ''}.png`
}

export function getCardLandscapeUrl(resourceId, awakened = true) {
  if (!resourceId) return ''
  return `/assets/card-art/landscape/image_card_landscape_${resourceId}${awakened ? 'p' : ''}.png`
}
