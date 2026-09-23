export function buildEventStoryEpisodes(event, story, catalogData) {
  if (!event || !story) return []

  const groupId = String(event.event_group_id || '')
  if (!Array.isArray(catalogData?.eventEpisodeStructure)) throw new Error('Event episodes require the named catalog structure')
  const rows = catalogData.eventEpisodeStructure.find(group => group.groupId === groupId)?.episodes || []
  const boundaries = story.episodes || []

  return rows.map((row, index) => {
    const { resourceId, part } = row
    const boundary = boundaries.find(item => item.episode_part === part) || boundaries[index] || null
    const episodeFile = boundary?.episode_file || ''
    const rawStart = Number(boundary?.start_step_index || 0)
    const playableStart = episodeFile
      ? Number(boundary?.local_playable_start_index || 0)
      : (index === 0 ? Math.max(rawStart, Number(story.playableStartIndex || 0)) : rawStart)

    return {
      id: row.id || `${event.event_id}-${index}`,
      label: row.label || (index === 0 ? 'プロローグ' : `エピソード${index}`),
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
