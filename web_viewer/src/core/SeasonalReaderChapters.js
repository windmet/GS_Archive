// Reader chapter navigation for the seasonal ledger: one chapter per participant, after the shared
// openings, in the ledger's order. It only feeds previous / next chapter; the chapter's own
// segments still come from the reading directory, so these entries are never loaded as documents.
export const SEASONAL_COMMON_CHAPTER = 'common'

export function seasonalReaderChapters(ledger, participantName = participant => participant.display_name) {
  if (!ledger?.campaigns?.length) return null
  const rows = [{ id: SEASONAL_COMMON_CHAPTER, name: '共通导入',
    episodes: ledger.campaigns.flatMap(campaign => campaign.introduction) },
  ...ledger.participants.map(participant => ({ id: participant.participant_code, name: participantName(participant),
    episodes: ledger.campaigns.flatMap(campaign => participant.episodes[campaign.id] || []) }))]
  const entries = []
  const chapters = rows.map(row => {
    const readable = row.episodes.filter(episode => episode.reading?.source_file)
    for (const episode of readable) entries.push({ document_id: episode.reading.document_id, source_file: episode.reading.source_file,
      sha256: episode.reading.sha256, status: 'ready' })
    // The name is the chapter label; its first episode's title is the chapter title, as in a 话 list.
    return { id: row.id, label: row.name, title: readable[0]?.title || row.name, file: readable[0]?.compiled_file || '',
      episodes: readable.map(episode => ({ id: episode.reading.document_id, file: episode.reading.source_file })) }
  }).filter(chapter => chapter.episodes.length)
  return { collection: { chapters }, entries }
}
