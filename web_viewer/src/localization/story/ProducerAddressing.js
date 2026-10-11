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

// With no name set, a name slot shows the idol's own form of address when one follows it
// (●●●●●●●●●●監督 → 監督, ●●●●●●●●●●P酱 → P酱) and otherwise the plain word for Producer in the
// text's language, so readers never see the raw dots.
const FOLLOWING_ADDRESS = /^(?:ぴぃちゃん|監督|番長|師匠|ボス|P酱|监督|番长|师父|Boss|BOSS|老大|老板)/u
const PRODUCER_WORD = Object.freeze({ ja: 'プロデューサー', zh: '制作人' })
const languageOf = locale => String(locale || '').toLowerCase().startsWith('ja') ? 'ja' : 'zh'

/** Text without a declared language: Japanese when kana remain once the macros are removed. */
export function producerAddressingLocale(source) {
  const rest = tokenizeProducerAddressing(String(source ?? '')).filter(part => part.kind === 'literal').map(part => part.text).join('')
  return /[\u3040-\u30ff]/u.test(rest) ? 'ja' : 'zh-CN'
}

function unnamedSlot(part, following, language) {
  if (part.kind === 'producer_name') return FOLLOWING_ADDRESS.test(following) ? '' : PRODUCER_WORD[language]
  // ●●●●プロデューサー酱 in Chinese text is "§P酱": keep the P rather than "制作人酱".
  return language === 'zh' && following.startsWith('酱') ? 'P' : PRODUCER_WORD[language]
}

/** Return plain text for Vue interpolation/textContent, never for an HTML sink. */
export function renderProducerAddressing(source, producerName = '', { locale } = {}) {
  if (typeof source !== 'string') throw new TypeError('source must be a string')
  if (typeof producerName !== 'string') throw new TypeError('producerName must be a string')
  const parts = tokenizeProducerAddressing(source)
  if (!parts.some(part => part.kind !== 'literal')) return source
  const language = languageOf(locale || producerAddressingLocale(source))
  return parts.map((part, index) => {
    if (part.kind === 'literal') return part.text
    if (producerName) return part.kind === 'producer_name' ? producerName : `${producerName}P`
    const next = parts[index + 1]
    return unnamedSlot(part, next?.kind === 'literal' ? next.text : '', language)
  }).join('')
}

/** Published overlays keep source macros, not a user's name or draft markers. */
export function validateProducerAddressingOverlay(source, translated) {
  if (typeof source !== 'string' || typeof translated !== 'string') {
    throw new TypeError('Producer overlay texts must be strings')
  }
  if (translated.includes('{{GS_ADDRESS:')) return false
  const counts = text => {
    const result = { producer_name: 0, producer_name_with_p: 0 }
    for (const part of tokenizeProducerAddressing(text)) {
      if (part.kind in result) result[part.kind] += 1
    }
    return result
  }
  const expected = counts(source)
  const actual = counts(translated)
  return expected.producer_name === actual.producer_name
    && expected.producer_name_with_p === actual.producer_name_with_p
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
