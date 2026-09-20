/** Exact source identity only. A playable episode does not imply readable text. */
export function readyEpisodeReading(entries, episode) {
  if (!episode?.file) return null
  return entries.find(entry => entry.source_file === episode.file && entry.status === 'ready') || null
}
