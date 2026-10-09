// Match the Reader's CSS breakpoint. Media routes retain their explicit proof.
// One rule for every kind of story: phones read one EP at a time; desktop reads the whole chapter
// continuously, whichever page it was opened from (main, unit, birthday, extra, event, idol story,
// work, story detail, catalog). The Reader forms the chapter from the story collection or, failing
// that, from the Reader directory, and reads the single document only when neither exists.
export function readerScopeForViewport(route, compact = globalThis.matchMedia?.('(max-width: 760px)')?.matches) {
  if (route.view !== 'reader' || compact === undefined) return route.readingScope || ''
  return compact ? '' : 'chapter'
}
