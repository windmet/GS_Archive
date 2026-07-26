const CHARACTER_CANDIDATE_BASE = '/assets/character-candidate'

export const RAW_CHARACTER_IMAGE_CANDIDATE_KINDS = Object.freeze([
  'birthday_visual',
  'event_story_visual',
  'mobile_bustup',
  'name_plate',
  'sign',
  'story_visual',
])

const CANDIDATE_KINDS = new Set(RAW_CHARACTER_IMAGE_CANDIDATE_KINDS)
const IDOL_CODE = /^\d{3}[a-z0-9]{3}$/i

function requestedCandidates(search) {
  const source = search ?? (
    typeof window === 'undefined' ? '' : window.location.search
  )
  return new URLSearchParams(source)
    .getAll('raw_character_candidate')
    .flatMap(value => value.split(','))
}

export function hasRawCharacterImageCandidate(kind, idolCode, search) {
  if (!CANDIDATE_KINDS.has(kind) || !IDOL_CODE.test(idolCode || '')) return false
  return requestedCandidates(search).includes(`${kind}:${idolCode}`)
}

export function getRawCharacterImageCandidateUrl(kind, idolCode, search) {
  return hasRawCharacterImageCandidate(kind, idolCode, search)
    ? `${CHARACTER_CANDIDATE_BASE}/${kind}/${idolCode}.png`
    : ''
}

export function birthdayStoryIdolCode(story) {
  const file = String(story?.file || story?.id || '')
  const fileMatch = file.match(/^1_x_(\d{3}[a-z0-9]{3})_/i)
  if (fileMatch) return fileMatch[1]
  const characters = (story?.characters || []).filter(
    character => IDOL_CODE.test(character),
  )
  return characters.length === 1 ? characters[0] : ''
}
