// The Reader's EP directory: the segments read together as one chapter. Most chapters are one
// compiled story (logical_id). A personal-story birthday chapter spans two files (small talks
// and episodes), so its manifest entries carry directory_id/directory_order from the idol
// episode index. Read-model projection, repository, session and Reader all group through here.

export const readingDirectoryKey = entry => entry?.directory_id || entry?.logical_id || ''

/** Entries in the same directory as `entry`, in in-game order when the manifest records one. */
export function readingDirectoryEntries(entries, entry) {
  const key = readingDirectoryKey(entry)
  if (!key) return []
  return entries.map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => readingDirectoryKey(candidate) === key)
    .sort((a, b) => (a.candidate.directory_order ?? a.index) - (b.candidate.directory_order ?? b.index) || a.index - b.index)
    .map(({ candidate }) => candidate)
}
