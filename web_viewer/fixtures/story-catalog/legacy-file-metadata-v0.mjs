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

// Frozen file metadata oracle from 14af6e4; test-only.

export function rowDisplayTitle(row) {
  const rawTitle = row?.['3'] || row?.['9']
  if (rawTitle && typeof rawTitle === 'string' && !/^\d+$/.test(rawTitle.trim())) return rawTitle
  const compiledTitle = row?.compiled_summary?.title
  if (compiledTitle) return compiledTitle
  if (rawTitle !== undefined && rawTitle !== null) return String(rawTitle)
  return ''
}

export function buildScenarioMetaByFile(storyMasterData) {
  const map = new Map()
  for (const row of collectStoryRows(storyMasterData)) {
    const file = row.compiled_file
    const resourceId = row.resource_id
    if (!file && !resourceId) continue
    const key = file || `missing:${resourceId}`
    const entry = map.get(key) || {
      file,
      resourceIds: [],
      titles: [],
      exists: row.compiled_exists !== false,
      rows: [],
    }
    if (resourceId && !entry.resourceIds.includes(resourceId)) entry.resourceIds.push(resourceId)
    const title = rowDisplayTitle(row)
    if (title && !entry.titles.includes(title)) entry.titles.push(title)
    if (!entry.summary && row.compiled_summary) entry.summary = row.compiled_summary
    if (row.compiled_exists === false) entry.exists = false
    entry.rows.push(row)
    map.set(key, entry)
  }
  return map
}
