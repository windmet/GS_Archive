export function parseJsonStrict(text, sourceName = '<json>') {
  let index = 0

  function fail(message) {
    throw new SyntaxError(`${sourceName}:${index}: ${message}`)
  }

  function whitespace() {
    while (/\s/u.test(text[index] || '')) index += 1
  }

  function string() {
    if (text[index] !== '"') fail('expected string')
    const start = index
    index += 1
    let escaped = false
    while (index < text.length) {
      const char = text[index]
      index += 1
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        try { return JSON.parse(text.slice(start, index)) } catch (error) { fail(error.message) }
      }
    }
    fail('unterminated string')
  }

  function array() {
    index += 1
    whitespace()
    const value = []
    if (text[index] === ']') { index += 1; return value }
    while (index < text.length) {
      value.push(parseValue())
      whitespace()
      if (text[index] === ']') { index += 1; return value }
      if (text[index] !== ',') fail('expected comma or closing bracket')
      index += 1
      whitespace()
    }
    fail('unterminated array')
  }

  function object() {
    index += 1
    whitespace()
    const value = {}
    const keys = new Set()
    if (text[index] === '}') { index += 1; return value }
    while (index < text.length) {
      const key = string()
      if (keys.has(key)) fail(`duplicate object key ${JSON.stringify(key)}`)
      keys.add(key)
      whitespace()
      if (text[index] !== ':') fail('expected colon')
      index += 1
      value[key] = parseValue()
      whitespace()
      if (text[index] === '}') { index += 1; return value }
      if (text[index] !== ',') fail('expected comma or closing brace')
      index += 1
      whitespace()
    }
    fail('unterminated object')
  }

  function parseValue() {
    whitespace()
    const char = text[index]
    if (char === '"') return string()
    if (char === '{') return object()
    if (char === '[') return array()
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(literal, index)) { index += literal.length; return value }
    }
    const number = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0]
    if (number) { index += number.length; return Number(number) }
    fail('invalid JSON value')
  }

  const value = parseValue()
  whitespace()
  if (index !== text.length) fail('unexpected trailing content')
  return value
}
