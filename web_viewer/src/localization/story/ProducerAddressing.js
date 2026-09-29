// Display-only Producer macros. Source text and translation identities stay unchanged.
export const PRODUCER_NAME_TOKEN = '●'.repeat(10)
export const PRODUCER_NAME_WITH_P_TOKEN = '●'.repeat(4) + 'プロデューサー'

export function tokenizeProducerAddressing(source) {
  if (typeof source !== 'string') throw new TypeError('source must be a string')
  const parts = []
  let cursor = 0
  for (const match of source.matchAll(/●+/gu)) {
    const start = match.index
    const runEnd = start + match[0].length
    const kind = match[0].length === 10 ? 'producer_name'
      : match[0].length === 4 && source.startsWith('プロデューサー', runEnd)
        ? 'producer_name_with_p' : null
    if (!kind) continue // Never split an unknown maximal run into valid tokens.
    const end = kind === 'producer_name_with_p' ? runEnd + 'プロデューサー'.length : runEnd
    if (start > cursor) parts.push({ kind: 'literal', text: source.slice(cursor, start), start: cursor, end: start })
    parts.push({ kind, text: source.slice(start, end), start, end })
    cursor = end
  }
  if (cursor < source.length) parts.push({ kind: 'literal', text: source.slice(cursor), start: cursor, end: source.length })
  return parts
}

/** Return plain text for Vue interpolation/textContent, never for an HTML sink. */
export function renderProducerAddressing(source, producerName = '') {
  if (typeof source !== 'string') throw new TypeError('source must be a string')
  if (typeof producerName !== 'string') throw new TypeError('producerName must be a string')
  if (!producerName) return source
  return tokenizeProducerAddressing(source).map(part => {
    if (part.kind === 'producer_name') return producerName
    if (part.kind === 'producer_name_with_p') return `${producerName}P`
    return part.text
  }).join('')
}

// Translation input is a separate projection. Each occurrence has its own marker;
// restored overlay text retains the original macro and never a local user's name.
const MARKER = /\{\{GS_ADDRESS:[^{}]*\}\}/gu
export function protectProducerAddressingForTranslation(source) {
  if (typeof source !== 'string') throw new TypeError('source must be a string')
  if (source.includes('{{GS_ADDRESS:')) throw new Error('Reserved translation marker collision')
  const slots = []
  const text = tokenizeProducerAddressing(source).map(part => {
    if (part.kind === 'literal') return part.text
    const marker = `{{GS_ADDRESS:${slots.length}:${part.kind}}}`
    slots.push({ id: slots.length, marker, kind: part.kind, raw: part.text, start: part.start, end: part.end })
    return marker
  }).join('')
  return { sourceText: source, text, slots }
}

export function restoreProducerAddressingAfterTranslation(translated, bundle) {
  if (typeof translated !== 'string' || !bundle || typeof bundle.sourceText !== 'string') {
    throw new TypeError('Invalid Producer translation input')
  }
  const expected = protectProducerAddressingForTranslation(bundle.sourceText)
  if (JSON.stringify(bundle) !== JSON.stringify(expected)) throw new Error('Producer translation bundle changed')
  const seen = [...translated.matchAll(MARKER)].map(match => match[0])
  const allowed = new Set(expected.slots.map(slot => slot.marker))
  if (seen.length !== expected.slots.length || seen.some(marker => !allowed.has(marker))
      || new Set(seen).size !== seen.length || translated.replace(MARKER, '').includes('{{GS_ADDRESS:')) {
    throw new Error('Producer translation slots changed')
  }
  const raw = new Map(expected.slots.map(slot => [slot.marker, slot.raw]))
  return translated.replace(MARKER, marker => raw.get(marker))
}
