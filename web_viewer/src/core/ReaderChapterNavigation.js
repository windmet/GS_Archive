// Only formal membership in the current collection can unlock cross-chapter navigation.
export function readerChapterNavigation(collection, entries, documentId, chapterFile = '') {
  const focused = entries.filter(entry => entry.document_id === documentId)
  if (focused.length !== 1) return null
  const formal = (collection?.chapters || []).filter(chapter => !chapter.canonicalRelation)
  const owners = formal.filter(chapter => chapter.episodes?.some(episode => episode.file === focused[0].source_file))
  if (owners.length !== 1) return null
  const fileOf = chapter => chapter.story?.file || chapter.file || ''
  if (chapterFile && fileOf(owners[0]) !== chapterFile) return null
  return { chapterId: owners[0].id, chapters: formal.map(chapter => {
    const first = (chapter.episodes || []).map(episode => {
      const matches = entries.filter(entry => entry.source_file === episode.file)
      return matches.length === 1 && matches[0].status === 'ready' ? matches[0] : null
    }).find(Boolean)
    return { id: chapter.id, label: chapter.label, title: chapter.title,
      storyFile: fileOf(chapter), documentId: first?.document_id || '' }
  }) }
}
