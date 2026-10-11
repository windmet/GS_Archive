// Only source-bound front matter from a verified Reader document can use overlays.
export function readingSynopsisRow(document) {
  for (const row of document?.rows || []) {
    if (!['title','synopsis'].includes(row.kind)) break
    if (row.kind === 'synopsis' && row.text_ref?.unit_id && row.text_ref?.source_hash) return row
  }
  return null
}
