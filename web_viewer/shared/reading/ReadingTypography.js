/** Reader-only layout. Canonical text, matching and anchors keep original bytes. */
export function reflowReadingText(value, locale = 'ja') {
  const separator = /^(ja|zh)(-|$)/i.test(locale) ? '' : ' '
  return String(value ?? '').replace(/\r\n?/g, '\n')
    .split(/\n[\t ]*\n(?:[\t ]*\n)*/)
    .map(paragraph => paragraph.replace(/[\t ]*\n[\t ]*/g, separator))
    .join('\n\n')
}
