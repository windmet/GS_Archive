// Frozen parity oracle from 3f48731; test-only, never imported by src.
export function collectStoryRows(data) {
  if (!data) return []
  return [
    ...(data.main?.episodes || []),
    ...(data.event?.episodes || []),
    ...(data.unit_story?.episodes || []),
    ...(data.idol_story?.episodes || []),
    ...(data.card_scenarios || []),
    ...(data.work || []),
    ...(data.birthday || []),
    ...(data.extra?.episodes || []),
  ]
}

const STORY_DOMAIN_ROWS = [
  ['main', data => data.main?.episodes],
  ['event', data => data.event?.episodes],
  ['unit_story', data => data.unit_story?.episodes],
  ['idol_story', data => data.idol_story?.episodes],
  ['card_scenarios', data => data.card_scenarios],
  ['work', data => data.work],
  ['birthday', data => data.birthday],
  ['extra', data => data.extra?.episodes],
]
const STORY_DOMAIN_ORDER = new Map(STORY_DOMAIN_ROWS.map(([id], index) => [id, index]))

export const STORY_DOMAIN_LABELS = {
  main: '主线剧情',
  event: '活动剧情',
  unit_story: '组合前传',
  idol_story: '个人剧情',
  card_scenarios: '卡片剧情',
  work: '工作剧情',
  birthday: '生日剧情',
  extra: '额外剧情',
}

export function buildStoryCatalog(data, presentationData = null) {
  if (!data) return []
  const map = new Map()
  const byId = rows => new Map((rows || []).map(row => [String(row['1']), row]))
  const context = {
    mainGroups: byId(data.main?.groups),
    mainChapters: byId(data.main?.chapters),
    eventGroups: byId(data.event?.groups),
    unitChapters: byId(data.unit_story?.chapters),
    unitGroups: byId(data.unit_story?.groups),
    idolChapters: byId(data.idol_story?.chapters),
    extraGroups: byId(data.extra?.groups),
  }

  function hierarchyFor(domain, row, summary) {
    if (domain === 'main') {
      const chapter = context.mainChapters.get(String(row['2']))
      const group = context.mainGroups.get(String(chapter?.['2']))
      return {
        title: chapter?.['9'] || summary?.title || '',
        episodeLabel: chapter?.['3'] || '',
        sectionId: String(group?.['1'] || ''),
        sectionLabel: group?.['2'] || '',
        releaseAt: Number(chapter?.['5'] || 0),
      }
    }
    if (domain === 'event') {
      const group = context.eventGroups.get(String(row['2']))
      return {
        title: group?.['9'] || summary?.title || '',
        episodeLabel: summary?.title || '',
        sectionId: String(group?.['4'] || group?.['1'] || ''),
        sectionLabel: STORY_DOMAIN_LABELS.event,
        releaseAt: Number(group?.['10'] || 0),
      }
    }
    if (domain === 'unit_story') {
      const chapter = context.unitChapters.get(String(row['2']))
      const group = context.unitGroups.get(String(chapter?.['2']))
      return {
        title: chapter?.['9']?.trim() || summary?.title || '',
        episodeLabel: chapter?.['3'] || '',
        sectionId: String(group?.['2'] || ''),
        sectionLabel: group?.['3'] || '',
        releaseAt: Number(chapter?.['5'] || 0),
      }
    }
    if (domain === 'idol_story') {
      const chapter = context.idolChapters.get(String(row['2']))
      return {
        title: chapter?.['9'] || summary?.title || '',
        episodeLabel: chapter?.['3'] || '',
        sectionId: summary?.characters?.find(character => /^\d{3}[a-z0-9]{3}$/i.test(character)) || '',
        sectionLabel: '',
        releaseAt: Number(chapter?.['5'] || 0),
      }
    }
    return {
      title: summary?.title || rowDisplayTitle(row),
      episodeLabel: '',
      sectionId: '',
      sectionLabel: '',
      releaseAt: Number(row?.['5'] || 0),
    }
  }

  function contextTitles(domain, row) {
    if (domain === 'event') {
      const group = context.eventGroups.get(String(row['2']))
      return [group?.['9'], group?.['3']]
    }
    if (domain === 'unit_story') {
      const chapter = context.unitChapters.get(String(row['2']))
      const group = context.unitGroups.get(String(chapter?.['2']))
      return [group?.['3'], chapter?.['9'], chapter?.['3']]
    }
    if (domain === 'main') {
      const chapter = context.mainChapters.get(String(row['2']))
      return [chapter?.['9'], chapter?.['3']]
    }
    if (domain === 'idol_story') {
      const chapter = context.idolChapters.get(String(row['2']))
      return [chapter?.['9'], chapter?.['3']]
    }
    if (domain === 'extra') {
      const group = context.extraGroups.get(String(row['2']))
      return [group?.['3'], group?.['9']]
    }
    return []
  }

  for (const [domain, rowsFor] of STORY_DOMAIN_ROWS) {
    for (const row of rowsFor(data) || []) {
      const resourceId = row.resource_id || (typeof row['5'] === 'string' ? row['5'] : '')
      const file = row.compiled_file || ''
      if (!file && !resourceId) continue
      const key = file || `missing:${domain}:${resourceId}`
      const summary = row.compiled_summary || null
      const presentation = presentationData?.by_file?.[file] || null
      const hierarchy = hierarchyFor(domain, row, summary)
      const unitChapter = domain === 'unit_story' ? context.unitChapters.get(String(row['2'])) : null
      const unitGroup = unitChapter ? context.unitGroups.get(String(unitChapter['2'])) : null
      const entry = map.get(key) || {
        id: key,
        file,
        domain,
        domainOrder: STORY_DOMAIN_ORDER.get(domain) || 0,
        domainLabel: STORY_DOMAIN_LABELS[domain] || domain,
        exists: row.compiled_exists !== false && Boolean(file),
        resourceIds: [],
        titles: [],
        characters: [],
        summary,
        rowCount: 0,
        unitId: unitGroup ? String(unitGroup['2']) : '',
        unitName: unitGroup?.['3'] || '',
        officialTitle: hierarchy.title,
        episodeLabel: hierarchy.episodeLabel,
        sectionId: hierarchy.sectionId,
        sectionLabel: hierarchy.sectionLabel,
        releaseAt: hierarchy.releaseAt,
        preplaySynopsis: presentation?.preplay_synopsis || null,
        playableStartIndex: presentation?.playable_start_index || 0,
        playableStepCount: presentation?.playable_step_count ?? summary?.step_count ?? 0,
        titleCards: presentation?.title_cards || [],
        episodes: presentation?.episodes || [],
      }

      if (resourceId && !entry.resourceIds.includes(resourceId)) entry.resourceIds.push(resourceId)
      const rawTitle = rowDisplayTitle(row)
      if (rawTitle && !entry.titles.includes(rawTitle)) entry.titles.push(rawTitle)
      for (const parentTitle of contextTitles(domain, row)) {
        if (parentTitle && typeof parentTitle === 'string' && !entry.titles.includes(parentTitle)) entry.titles.push(parentTitle)
      }
      if (summary?.title && !entry.titles.includes(summary.title)) entry.titles.unshift(summary.title)
      for (const character of summary?.characters || []) {
        if (character && !entry.characters.includes(character)) entry.characters.push(character)
      }
      if (!entry.summary && summary) entry.summary = summary
      if (row.compiled_exists === false || !file) entry.exists = false
      entry.rowCount += 1
      map.set(key, entry)
    }
  }

  return [...map.values()].map(entry => {
    const title = entry.officialTitle || entry.preplaySynopsis?.title || entry.titles[0] || entry.resourceIds[0] || entry.file
    const secondaryTitles = entry.titles.filter(candidate => candidate && candidate !== title && candidate !== entry.episodeLabel)
    return {
      ...entry,
      title,
      subtitle: secondaryTitles.slice(0, 2).join(' / '),
      resourceId: entry.resourceIds[0] || entry.file,
      searchText: [
        title,
        ...entry.titles,
        ...entry.resourceIds,
        ...entry.characters,
        entry.file,
        entry.domainLabel,
        entry.episodeLabel,
        entry.sectionLabel,
        entry.preplaySynopsis?.title,
        entry.preplaySynopsis?.text,
      ].filter(Boolean).join(' ').toLowerCase(),
    }
  })
}

export function rowDisplayTitle(row) {
  const rawTitle = row?.['3'] || row?.['9']
  if (rawTitle && typeof rawTitle === 'string' && !/^\d+$/.test(rawTitle.trim())) return rawTitle
  const compiledTitle = row?.compiled_summary?.title
  if (compiledTitle) return compiledTitle
  if (rawTitle !== undefined && rawTitle !== null) return String(rawTitle)
  return ''
}

