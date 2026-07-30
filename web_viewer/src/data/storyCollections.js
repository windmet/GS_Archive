import { buildExtraStoryDomainIdentity } from './storyDomainIdentityIndex.js'

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
    const episodeFile = boundary?.episode_file || ''
    const rawStart = Number(boundary?.start_step_index || 0)
    const playableStart = episodeFile
      ? Number(boundary?.local_playable_start_index || 0)
      : (index === 0 ? Math.max(rawStart, Number(story?.playableStartIndex || 0)) : rawStart)

    return {
      id: String(row['1'] || `${story?.file || 'missing'}-${index}`),
      label: row['3'] || `エピソード${index + 1}`,
      resourceId,
      part,
      exists: Boolean(story?.exists && boundary),
      file: episodeFile || story?.file || '',
      startStep: boundary ? playableStart + 1 : 0,
      endStep: boundary ? (episodeFile ? Number(boundary.step_count) : Number(boundary.end_step_index) + 1) : 0,
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

function buildExtraCollection(series, extraDomain, catalog) {
  const entryById = new Map((extraDomain?.logicalEntries || []).map(entry => [entry.id, entry]))
  const entries = (series.logicalEntryIds || [])
    .map(id => entryById.get(id))
    .filter(Boolean)
    .sort((left, right) => left.releaseAt - right.releaseAt || left.masterId.localeCompare(right.masterId))
  const chapters = entries.map(entry => {
    const file = entry.compiledFile || ''
    const story = file
      ? catalog.find(item => item.domain === 'extra' && item.file === file) || null
      : null
    const resourceId = entry.resourceId
    const part = resourceId.match(/_([a-z])$/i)?.[1] || ''
    const boundary = story?.episodes?.find(item => item.episode_part === part) || null
    const episodeFile = boundary?.episode_file || story?.file || ''
    const startStep = boundary
      ? Number(boundary.local_playable_start_index || 0) + 1
      : Number(story?.playableStartIndex || 0) + 1
    const endStep = boundary
      ? Number(boundary.step_count || 0)
      : Number(story?.playableStepCount || story?.summary?.step_count || 0)
    const exists = Boolean(story?.exists && episodeFile)
    const episode = {
      id: entry.masterId,
      label: entry.title || entry.masterGroupTitle || '额外剧情',
      resourceId,
      part,
      exists,
      file: episodeFile,
      startStep: exists ? startStep : 0,
      endStep: exists ? endStep : 0,
      stepCount: boundary?.step_count || story?.playableStepCount || story?.summary?.step_count || 0,
      dialogueCount: boundary?.dialogue_count || 0,
      voiceCount: boundary?.voice_count ?? story?.summary?.voice_count ?? 0,
    }
    return {
      id: entry.masterId,
      label: entry.masterGroupTitle || `ID ${entry.parentId}`,
      title: entry.title || entry.masterGroupTitle || story?.title || '额外剧情',
      releaseAt: entry.releaseAt,
      backgroundId: '',
      file,
      exists,
      story,
      synopsis: story?.preplaySynopsis || null,
      episodes: [episode],
      episodeCount: 1,
      playableEpisodeCount: exists ? 1 : 0,
      dialogueCount: episode.dialogueCount,
      voiceCount: episode.voiceCount,
    }
  })

  return {
    id: series.id,
    domain: 'extra',
    domainLabel: '额外剧情',
    sectionId: series.masterId,
    legacySectionIds: series.legacySectionIds || [],
    title: series.title,
    eyebrow: 'EXTRA STORY',
    description: series.description,
    releaseAt: Number(series.releaseAt || chapters[0]?.releaseAt || 0),
    visualUrl: '',
    official: series.official,
    sourceUrl: series.sourceUrl,
    gasha: series.gasha,
    chapters,
    chapterCount: chapters.length,
    playableChapterCount: chapters.filter(chapter => chapter.exists).length,
    episodeCount: chapters.reduce((sum, chapter) => sum + chapter.episodeCount, 0),
    playableEpisodeCount: chapters.reduce((sum, chapter) => sum + chapter.playableEpisodeCount, 0),
  }
}

function birthdaySeriesLabel(resourceId) {
  if (String(resourceId).startsWith('1_8_')) return '制作人生日问候'
  if (String(resourceId).startsWith('1_7_')) return '偶像生日祝福'
  if (String(resourceId).startsWith('1_2_')) return '生日短篇'
  return '生日剧情'
}

function buildBirthdayCollections(birthdayDomain, catalog) {
  const entries = new Map((birthdayDomain?.logicalEntries || []).map(entry => [entry.id, entry]))
  return (birthdayDomain?.collections || []).map(subjectCollection => {
    const logicalEntries = subjectCollection.logicalEntryIds
      .map(id => entries.get(id))
      .filter(Boolean)
      .sort((left, right) => left.releaseAt - right.releaseAt || left.masterId.localeCompare(right.masterId))
    const chapters = logicalEntries.map(entry => {
      const story = catalog.find(item => item.file === entry.compiledFile) || null
      const startStep = Number(story?.playableStartIndex || 0) + 1
      const endStep = Number(story?.playableStepCount || story?.summary?.step_count || 0)
      const exists = Boolean(entry.compiledExists && story?.exists && entry.compiledFile)
      const episode = {
        id: entry.masterId,
        label: entry.title || birthdaySeriesLabel(entry.resourceId),
        resourceId: entry.resourceId,
        part: '',
        exists,
        file: entry.compiledFile,
        startStep: exists ? startStep : 0,
        endStep: exists ? endStep : 0,
        stepCount: story?.playableStepCount || story?.summary?.step_count || 0,
        dialogueCount: 0,
        voiceCount: story?.summary?.voice_count || 0,
      }
      return {
        id: entry.masterId,
        label: birthdaySeriesLabel(entry.resourceId),
        title: story?.preplaySynopsis?.title || story?.title || entry.title || '生日剧情',
        releaseAt: entry.releaseAt,
        backgroundId: '',
        file: entry.compiledFile,
        exists,
        story,
        synopsis: story?.preplaySynopsis || null,
        episodes: [episode],
        episodeCount: 1,
        playableEpisodeCount: exists ? 1 : 0,
        dialogueCount: 0,
        voiceCount: episode.voiceCount,
        domainMemberships: entry.domainMemberships,
      }
    })
    const subject = subjectCollection.subject
    return {
      id: subjectCollection.id,
      domain: 'birthday',
      domainLabel: '生日剧情',
      sectionId: subject.code,
      title: `${subject.displayName || subject.code} 生日剧情`,
      eyebrow: subject.kind === 'npc' ? 'STAFF BIRTHDAY STORY' : 'IDOL BIRTHDAY STORY',
      description: '按角色主体与 masterdata 系列整理，保留制作人生日问候、偶像生日祝福和生日短篇的独立逻辑身份。',
      releaseAt: Math.max(0, ...chapters.map(chapter => chapter.releaseAt)),
      visualUrl: '',
      subject,
      chapters,
      chapterCount: chapters.length,
      playableChapterCount: chapters.filter(chapter => chapter.exists).length,
      episodeCount: chapters.length,
      playableEpisodeCount: chapters.filter(chapter => chapter.exists).length,
    }
  })
}

export function buildStoryCollections(data, catalog, {
  birthdayDomain = null,
  extraDomain = null,
} = {}) {
  if (!data) return []
  const collections = []
  const resolvedExtraDomain = extraDomain || buildExtraStoryDomainIdentity(data)
  for (const group of data.main?.groups || []) {
    collections.push(buildCollection('main', group, data.main?.chapters || [], data.main?.episodes || [], catalog || []))
  }
  for (const group of data.unit_story?.groups || []) {
    collections.push(buildCollection('unit_story', group, data.unit_story?.chapters || [], data.unit_story?.episodes || [], catalog || []))
  }
  for (const series of resolvedExtraDomain?.collections || []) {
    collections.push(buildExtraCollection(series, resolvedExtraDomain, catalog || []))
  }
  collections.push(...buildBirthdayCollections(birthdayDomain, catalog || []))
  return collections
}
