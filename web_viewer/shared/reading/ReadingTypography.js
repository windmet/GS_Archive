/**
 * The one reading-flow rule. Game textboxes hard-wrap at their own width, which
 * for translated text leaves a long line followed by a one-word line. Display
 * layers join those wraps and let the container wrap (see .gs-flow in
 * GS_UI_TOKENS.css); blank lines stay as paragraph edges. Canonical text,
 * matching, search and anchors keep the original bytes.
 */
// Neighbouring CJK glyphs (and CJK/full-width punctuation) need no joining space.
const CJK_EDGE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯…—]/u

export function reflowText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n')
    .split(/\n[\t ]*\n(?:[\t ]*\n)*/)
    .map(paragraph => paragraph.split('\n').reduce((text, line) => {
      const left = text.trimEnd(), right = line.trimStart()
      if (!left || !right) return left + right
      const glue = CJK_EDGE.test(left.slice(-1)) || CJK_EDGE.test(right[0])
      return left + (glue ? '' : ' ') + right
    }))
    .join('\n\n')
}

/** Locale-tagged entry point kept for Reader callers; the join no longer depends on it. */
export function reflowReadingText(value, _locale) {
  return reflowText(value)
}

/** Translations never carry meaning in the source wrap; Japanese originals keep the authored text. */
export function flowForLocale(value, locale) {
  const text = String(value ?? '')
  return /^ja(-|$)/i.test(locale ?? 'ja') ? text : reflowText(text)
}
