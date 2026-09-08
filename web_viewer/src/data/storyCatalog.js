import { validateStoryFileMetadata } from './storyFileMetadata.js'

export const STORY_DOMAIN_LABELS = {
  main: '主线剧情', event: '活动剧情', unit_story: '组合前传', idol_story: '个人剧情',
  card_scenarios: '卡片剧情', work: '工作剧情', birthday: '生日剧情', extra: '额外剧情',
}
const DOMAIN_ORDER = new Map(Object.keys(STORY_DOMAIN_LABELS).map((domain, index) => [domain, index]))

export function validateStoryCatalog(data) {
  if (data?.schema_version !== 1 || !Array.isArray(data.entries) || !/^[a-f0-9]{64}$/.test(data.source_digest || '')) {
    throw new Error('storyCatalog requires the named v1 entries and source digest')
  }
  const ids = new Set()
  for (const entry of data.entries) {
    if (!entry || !entry.id || ids.has(entry.id) || !DOMAIN_ORDER.has(entry.domain)
      || typeof entry.exists !== 'boolean' || !Number.isInteger(entry.rowCount) || entry.rowCount < 1
      || (entry.releaseAt !== null && !Number.isFinite(entry.releaseAt))
      || !['id', 'file', 'unitId', 'unitName', 'officialTitle', 'episodeLabel', 'sectionId', 'sectionLabel'].every(key => typeof entry[key] === 'string')
      || !['resourceIds', 'titles', 'characters'].every(key => Array.isArray(entry[key]) && entry[key].every(value => typeof value === 'string'))
      || (entry.summary !== null && (typeof entry.summary !== 'object' || Array.isArray(entry.summary)))
      || (entry.exists && !entry.file)) {
      throw new Error(`storyCatalog has an invalid or duplicate entry: ${entry?.id || '(missing id)'}`)
    }
    ids.add(entry.id)
  }
  validateStoryFileMetadata(data.fileMetadata)
  return data
}

/** Add consumer presentation to pipeline-owned names and relationships. */
export function buildStoryCatalog(data, presentationData = null) {
  if (!data) return []
  validateStoryCatalog(data)
  return data.entries.map(source => {
    const presentation = presentationData?.by_file?.[source.file]
    const entry = {
      ...source,
      domainOrder: DOMAIN_ORDER.get(source.domain),
      domainLabel: STORY_DOMAIN_LABELS[source.domain],
      sectionLabel: source.domain === 'event' ? STORY_DOMAIN_LABELS.event : source.sectionLabel,
      // Preserve the existing in-memory unknown-date behavior; JSON uses null.
      releaseAt: source.releaseAt === null ? Number.NaN : source.releaseAt,
      resourceIds: [...source.resourceIds], titles: [...source.titles], characters: [...source.characters],
      preplaySynopsis: presentation?.preplay_synopsis || null,
      playableStartIndex: presentation?.playable_start_index || 0,
      playableStepCount: presentation?.playable_step_count ?? source.summary?.step_count ?? 0,
      titleCards: presentation?.title_cards || [], episodes: presentation?.episodes || [],
    }
    const title = entry.officialTitle || entry.preplaySynopsis?.title || entry.titles[0] || entry.resourceIds[0] || entry.file
    const secondary = entry.titles.filter(candidate => candidate && candidate !== title && candidate !== entry.episodeLabel)
    return {
      ...entry, title, subtitle: secondary.slice(0, 2).join(' / '), resourceId: entry.resourceIds[0] || entry.file,
      searchText: [title, ...entry.titles, ...entry.resourceIds, ...entry.characters, entry.file,
        entry.domainLabel, entry.episodeLabel, entry.sectionLabel, entry.preplaySynopsis?.title,
        entry.preplaySynopsis?.text].filter(Boolean).join(' ').toLowerCase(),
    }
  })
}
