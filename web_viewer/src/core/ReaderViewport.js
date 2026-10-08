// Match the Reader's CSS breakpoint. Media routes retain their explicit proof.
export function readerScopeForViewport(route, compact = globalThis.matchMedia?.('(max-width: 760px)')?.matches) {
  if (route.view !== 'reader' || compact === undefined) return route.readingScope || ''
  if (compact) return ''
  if (route.storySection && ['main','unit_story','extra','birthday'].includes(route.storyType)) return 'chapter'
  // An event's episodes (序章, EP 01…) are one Reader directory with no story collection; on desktop
  // they read as one continuous chapter like the main story.
  if (route.event && !route.storyType) return 'chapter'
  return route.readingScope || ''
}
