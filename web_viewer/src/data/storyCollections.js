const UNIT_VISUAL_CODES = [
  '01jup', '02dra', '03alt', '04bei', '05w00', '06fra', '07sai', '08hig',
  '09shi', '10caf', '11mof', '12sem', '13the', '14fla', '15leg', '16cfi',
]

function sortedRows(rows) {
  return [...rows].sort((a, b) => Number(a['1'] || 0) - Number(b['1'] || 0))
}

export function buildStoryChapterEpisodes(story, rows) {
  const boundaries = story?.episodes || []
  return sortedRows(rows).map((row, index) => {
    const resourceId = row.resource_id || row['5'] || ''
    const part = resourceId.match(/_([a-z])$/i)?.[1] || ''
    const boundary = boundaries.find(item => item.episode_part === part) || boundaries[index] || null
    const rawStart = Number(boundary?.start_step_index || 0)
    const playableStart = index === 0
      ? Math.max(rawStart, Number(story?.playableStartIndex || 0))
      : rawStart

    return {
      id: String(row['1'] || `${story?.file || 'missing'}-${index}`),
      label: row['3'] || `エピソード${index + 1}`,
      resourceId,
      part,
      exists: Boolean(story?.exists && boundary),
      startStep: boundary ? playableStart + 1 : 0,
      stepCount: boundary?.step_count || 0,
      dialogueCount: boundary?.dialogue_count || 0,
      voiceCount: boundary?.voice_count || 0,
    }
  })
}

function buildCollection(domain, group, chapters, episodeRows, catalog) {
  const groupId = String(group['1'])
  const sectionId = domain === 'main' ? groupId : String(group['2'])
  const chapterModels = chapters
    .filter(chapter => String(chapter['2']) === groupId)
    .sort((a, b) => Number(a['1'] || 0) - Number(b['1'] || 0))
    .map(chapter => {
      const chapterId = String(chapter['1'])
      const rows = episodeRows.filter(row => String(row['2']) === chapterId)
      const file = rows.find(row => row.compiled_file)?.compiled_file || ''
      const story = file
        ? catalog.find(entry => entry.domain === domain && entry.file === file) || null
        : null
      const episodes = buildStoryChapterEpisodes(story, rows)
      return {
        id: chapterId,
        label: chapter['3'] || '',
        title: chapter['9']?.trim() || story?.title || '未公开',
        releaseAt: Number(chapter['5'] || 0),
        backgroundId: chapter['6'] || '',
        file,
        exists: Boolean(story?.exists),
        story,
        synopsis: story?.preplaySynopsis || null,
        episodes,
        episodeCount: episodes.length,
        playableEpisodeCount: episodes.filter(episode => episode.exists).length,
        dialogueCount: episodes.reduce((sum, episode) => sum + episode.dialogueCount, 0),
        voiceCount: episodes.reduce((sum, episode) => sum + episode.voiceCount, 0),
      }
    })

  const assetCode = domain === 'main'
    ? String(group['5'] || '').padStart(2, '0')
    : UNIT_VISUAL_CODES[Number(group['2']) - 1]
  const visualUrl = domain === 'main'
    ? (['01', '02'].includes(assetCode) ? `/assets/stories/main/main_chapter_banner_${assetCode}.png` : '')
    : (assetCode ? `/assets/stories/units/image_unit_story_button_${assetCode}.png` : '')

  return {
    id: `${domain}:${sectionId}`,
    domain,
    domainLabel: domain === 'main' ? '主线剧情' : '组合前传',
    sectionId,
    title: domain === 'main' ? (group['2'] || `第${sectionId}章`) : (group['3'] || sectionId),
    eyebrow: domain === 'main' ? 'MAIN STORY' : 'UNIT EPISODE ZERO',
    description: domain === 'main'
      ? '从 315 Production 启程，按正式话目与分段浏览完整主线。'
      : '按组合整理的前传故事，记录成员相遇、磨合与共同启程。',
    releaseAt: Number(group['4'] || group['5'] || 0),
    visualUrl,
    chapters: chapterModels,
    chapterCount: chapterModels.length,
    playableChapterCount: chapterModels.filter(chapter => chapter.exists).length,
    episodeCount: chapterModels.reduce((sum, chapter) => sum + chapter.episodeCount, 0),
    playableEpisodeCount: chapterModels.reduce((sum, chapter) => sum + chapter.playableEpisodeCount, 0),
  }
}

export function buildStoryCollections(data, catalog) {
  if (!data) return []
  const collections = []
  for (const group of data.main?.groups || []) {
    collections.push(buildCollection('main', group, data.main?.chapters || [], data.main?.episodes || [], catalog || []))
  }
  for (const group of data.unit_story?.groups || []) {
    collections.push(buildCollection('unit_story', group, data.unit_story?.chapters || [], data.unit_story?.episodes || [], catalog || []))
  }
  return collections
}
