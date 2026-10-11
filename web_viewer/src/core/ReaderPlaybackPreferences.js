// Reader mode becomes a Player preference only at the playback handoff.
export function playbackPreferencesForReadingMode(mode) {
  return {
    story_content_mode: ['translation', 'bilingual'].includes(mode) ? mode : 'original',
    bilingual_primary: mode === 'translation' ? 'translation' : 'original',
  }
}
