export const PRODUCER_DOT_RUN = /●+/gu
export const OTHER_PLACEHOLDER = /○{2,}|[□■]{2,}|＜P＞|<P>|\{\{[^}]+\}\}/gu

export function scanProducerPlaceholders(text) {
  if (typeof text !== 'string') return []
  const matches = []
  for (const match of text.matchAll(PRODUCER_DOT_RUN)) {
    const following = text.slice(match.index + match[0].length)
    matches.push({ form: match[0], index: match.index,
      class: match[0].length === 4 && following.startsWith('プロデューサー')
        ? 'four-dot-producer-prefix'
        : match[0].length === 10 ? 'ten-dot-name-candidate' : 'unclassified-dot-run' })
  }
  for (const match of text.matchAll(OTHER_PLACEHOLDER)) {
    matches.push({ form: match[0], index: match.index, class: 'other-candidate' })
  }
  return matches.sort((a, b) => a.index - b.index)
}

export function producerContext(text, match, width = 20) {
  const before = Array.from(text.slice(0, match.index)).slice(-width).join('')
  const after = Array.from(text.slice(match.index + match.form.length)).slice(0, width).join('')
  return { before, after }
}
