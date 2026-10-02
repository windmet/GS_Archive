// Match the Reader's CSS breakpoint. Media routes retain their explicit proof.
export function readerScopeForViewport(route, compact = globalThis.matchMedia?.('(max-width: 760px)')?.matches) {
  if (route.view !== 'reader' || compact === undefined) return route.readingScope || ''
  if (compact) return ''
  return route.storySection && ['main','unit_story','extra','birthday'].includes(route.storyType) ? 'chapter' : route.readingScope || ''
}
