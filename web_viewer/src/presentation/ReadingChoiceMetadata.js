import { readingBranchRows } from '../../shared/reading/ReadingDocument.js'

/** RAW text_select's third slot can carry a presentation marker, not prose.
 * Keep published source units intact; project only the evidenced marker away.
 * Real long replies (and the same word in dialogue/choice text) remain readable.
 */
export function projectReadingChoiceRows(document) {
  const rows = document?.rows || []
  const aliases = new Map(), metadataIds = new Set()
  for (const row of rows) {
    if (row.kind !== 'choice_metadata' && !(row.kind === 'choice_detail' && row.source_text === 'appeal'
      && row.text_ref?.source?.field_kind === 'choice_detail')) continue
    const choiceId = row.anchor.row_id.replace(/-detail$/, '')
    const choice = rows.find(candidate => candidate.kind === 'choice'
      && candidate.anchor.row_id === choiceId
      && candidate.anchor.step_index === row.anchor.step_index)
    if (!choice) continue
    metadataIds.add(row.anchor.row_id)
    aliases.set(choiceId, [...(aliases.get(choiceId) || []), row.anchor.row_id])
  }
  // Filter before branch projection so metadata cannot become a branch heading,
  // a search result, a translation fallback, or an independent reading row.
  return readingBranchRows({ ...document, rows: rows.filter(row => !metadataIds.has(row.anchor.row_id)) })
    .map(item => ({ ...item, anchorAliases: aliases.get(item.row.anchor.row_id) || [] }))
}
