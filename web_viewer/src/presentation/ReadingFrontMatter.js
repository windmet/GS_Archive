// Presentation-only grouping; the ReadingDocument rows, text refs and anchors stay intact.
const textIdentity = text => String(text || '').normalize('NFKC').replace(/\s+/g, '').trim()
const FRONT_MATTER_KINDS = new Set(['title', 'synopsis'])

export function projectReadingFrontMatter(rows, heading) {
  const frontMatterIds = new Set()
  const mergedTitleIds = new Set()
  for (const row of rows || []) {
    if (!FRONT_MATTER_KINDS.has(row.kind)) break
    frontMatterIds.add(row.anchor.row_id)
    if (row.kind === 'title' && textIdentity(row.source_text) === textIdentity(heading)) {
      mergedTitleIds.add(row.anchor.row_id)
    }
  }
  return { frontMatterIds, mergedTitleIds }
}
