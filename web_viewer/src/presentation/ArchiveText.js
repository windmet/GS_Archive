/** Reflow game-width line breaks without changing canonical archive text. */
export function reflowArchiveText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split(/\n[\t ]*\n/)
    .map(paragraph => paragraph.split('\n').reduce((text, line) => {
      const left = text.trimEnd(), right = line.trimStart()
      // Latin words need a boundary; Japanese lines should not gain spaces.
      const space = /[\p{Script=Latin}\p{N}]$/u.test(left) && /^[\p{Script=Latin}\p{N}]/u.test(right)
      return left + (space ? ' ' : '') + right
    })).join('\n\n')
}
