// Neighbours are formal adjacent members, never guessed file suffixes or skipped gaps.
export function readerChapterNeighbour(navigation, direction) {
  const chapters = navigation?.chapters || []
  const index = chapters.findIndex(chapter => chapter.id === navigation?.chapterId)
  const target = index < 0 ? null : chapters[index + direction]
  return target?.documentId && target.storyFile ? target : null
}

export function readerSegmentNeighbour(segments, documentId, direction, allowUnlinked = false) {
  const index = segments.findIndex(segment => (segment.documentId || segment.episodeKey) === documentId)
  const target = index < 0 ? null : segments[index + direction]
  return target && (target.documentId || allowUnlinked) ? target : null
}

// Track the segment actually being read without changing the route/selected branch.
export function visibleReaderDocument(rectangles, viewportTop, fallback) {
  const threshold = viewportTop + 32
  const visible = rectangles.filter(item => item.bottom > threshold)
  return visible.find(item => item.top <= threshold)?.documentId || visible[0]?.documentId || fallback
}
