export function getRawCardCandidateId() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('raw_card_candidate') || ''
}

export function isRawCardCandidate(resourceId) {
  return Boolean(resourceId) && getRawCardCandidateId() === resourceId
}

function candidateUrl(resourceId, fileName) {
  return `/assets/card-candidate/${resourceId}/${fileName}`
}

export function getCardIconUrl(resourceId, awakened = true) {
  if (!resourceId) return ''
  const fileName = `image_card_icon_${resourceId}${awakened ? 'p' : ''}.png`
  return isRawCardCandidate(resourceId)
    ? candidateUrl(resourceId, fileName)
    : `/assets/cards/icons/${fileName}`
}

export function getCardLargeImageUrl(resourceId, awakened = true) {
  if (!resourceId) return ''
  const fileName = `image_card_portrait_show_${resourceId}${awakened ? 'p' : ''}.png`
  return isRawCardCandidate(resourceId)
    ? candidateUrl(resourceId, fileName)
    : `/assets/cards/large/${fileName}`
}

export function getCardPortraitUrl(resourceId, awakened = true, framed = false) {
  if (!resourceId) return ''
  const variant = framed ? 'show' : 'hide'
  const fileName = `image_card_portrait_${variant}_${resourceId}${awakened ? 'p' : ''}.png`
  return isRawCardCandidate(resourceId)
    ? candidateUrl(resourceId, fileName)
    : `/assets/card-art/portrait/${fileName}`
}

export function getCardLandscapeUrl(resourceId, awakened = true) {
  if (!resourceId) return ''
  const fileName = `image_card_landscape_${resourceId}${awakened ? 'p' : ''}.png`
  return isRawCardCandidate(resourceId)
    ? candidateUrl(resourceId, fileName)
    : `/assets/card-art/landscape/${fileName}`
}
