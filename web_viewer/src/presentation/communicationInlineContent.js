export function projectCommunicationInlineContent(value) {
  const text = typeof value === 'string' ? value : ''
  const parts = []
  const pattern = /<emoji>([A-Za-z0-9._-]+)<\/emoji>/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ type: 'text', text: text.slice(cursor, match.index) })
    parts.push({ type: 'emoji', id: match[1], alt: '表情' })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length || !parts.length) parts.push({ type: 'text', text: text.slice(cursor) })
  return parts
}
