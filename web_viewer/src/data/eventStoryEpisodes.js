export function buildEventStoryEpisodes(event, story, storyMasterData) {
  if (!event || !story) return []

  const groupId = String(event.event_group_id || '')
  const rows = (storyMasterData?.event?.episodes || [])
    .filter(row => String(row['2']) === groupId)
    .sort((a, b) => Number(a['1'] || 0) - Number(b['1'] || 0))
  const boundaries = story.episodes || []

  return rows.map((row, index) => {
    const resourceId = row.resource_id || row['5'] || ''
    const part = resourceId.match(/_([a-z])$/i)?.[1] || ''
    const boundary = boundaries.find(item => item.episode_part === part) || boundaries[index] || null
    const episodeFile = boundary?.episode_file || ''
    const rawStart = Number(boundary?.start_step_index || 0)
    const playableStart = episodeFile
      ? Number(boundary?.local_playable_start_index || 0)
      : (index === 0 ? Math.max(rawStart, Number(story.playableStartIndex || 0)) : rawStart)

    return {
      id: String(row['1'] || `${event.event_id}-${index}`),
      label: row['3'] || (index === 0 ? 'プロローグ' : `エピソード${index}`),
      resourceId,
      part,
      file: episodeFile || story.file || '',
      startStep: playableStart + 1,
      endStep: boundary ? (episodeFile ? Number(boundary.step_count) : Number(boundary.end_step_index) + 1) : 0,
      stepCount: boundary?.step_count || 0,
      dialogueCount: boundary?.dialogue_count || 0,
      voiceCount: boundary?.voice_count || 0,
    }
  })
}
