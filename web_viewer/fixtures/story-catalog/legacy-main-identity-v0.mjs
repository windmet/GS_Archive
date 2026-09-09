// Frozen from c32d867; test-only main identity oracle.
const DOMAIN_ROWS = Object.freeze([
  ['main', data => data.main?.episodes],
  ['event', data => data.event?.episodes],
  ['unit_story', data => data.unit_story?.episodes],
  ['idol_story', data => data.idol_story?.episodes],
  ['card_scenarios', data => data.card_scenarios],
  ['work', data => data.work],
  ['birthday', data => data.birthday],
  ['extra', data => data.extra?.episodes],
])

function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortedRows(rows) {
  return [...(rows || [])].sort((left, right) =>
    numeric(left?.['1']) - numeric(right?.['1']) ||
    String(left?.resource_id || '').localeCompare(String(right?.resource_id || '')),
  )
}

function sourceEvidence(row) {
  return {
    table: numeric(row?._source?.table || row?._top_field),
    offset: numeric(row?._source?.offset || row?._offset),
  }
}

function logicalEntry(domain, row, releaseField) {
  return {
    id: `${domain}:${row?.['1'] || row?.resource_id || 'missing'}`,
    domain,
    masterId: String(row?.['1'] || ''),
    parentId: String(row?.['2'] || ''),
    title: String(row?.['3'] || ''),
    releaseAt: numeric(row?.[releaseField]),
    resourceId: String(row?.resource_id || ''),
    compiledFile: String(row?.compiled_file || ''),
    compiledExists: row?.compiled_exists !== false && Boolean(row?.compiled_file),
    source: sourceEvidence(row),
  }
}

function allDomainMemberships(storyMaster) {
  const memberships = new Map()
  for (const [domain, rowsFor] of DOMAIN_ROWS) {
    for (const row of rowsFor(storyMaster) || []) {
      const file = String(row?.compiled_file || '')
      if (!file) continue
      if (!memberships.has(file)) memberships.set(file, new Set())
      memberships.get(file).add(domain)
    }
  }
  return memberships
}

export function buildMainStoryDomainIdentity(storyMaster) {
  const groups = sortedRows(storyMaster.main?.groups)
  const chapters = sortedRows(storyMaster.main?.chapters)
  const episodeRows = sortedRows(storyMaster.main?.episodes)
  const logicalEntries = episodeRows.map(row => logicalEntry('main', row, '5'))
  const entryById = new Map(logicalEntries.map(entry => [entry.id, entry]))

  const collections = groups.map(group => {
    const groupId = String(group['1'])
    const collectionChapters = chapters
      .filter(chapter => String(chapter['2']) === groupId)
      .map(chapter => {
        const chapterId = String(chapter['1'])
        const entries = logicalEntries.filter(entry => entry.parentId === chapterId)
        return {
          id: `main-chapter:${chapterId}`,
          masterId: chapterId,
          label: String(chapter['3'] || ''),
          title: String(chapter['9'] || '').trim(),
          releaseAt: numeric(chapter['5']),
          logicalEntryIds: entries.map(entry => entry.id),
          logicalEntryCount: entries.length,
          compiledFileCount: new Set(entries.map(entry => entry.compiledFile).filter(Boolean)).size,
          source: sourceEvidence(chapter),
        }
      })

    return {
      id: `main:${groupId}`,
      masterId: groupId,
      title: String(group['2'] || ''),
      releaseAt: numeric(group['4']),
      chapterIds: collectionChapters.map(chapter => chapter.id),
      chapterCount: collectionChapters.length,
      logicalEntryCount: collectionChapters.reduce((sum, chapter) => sum + chapter.logicalEntryCount, 0),
      compiledFileCount: new Set(collectionChapters.flatMap(chapter =>
        chapter.logicalEntryIds.map(id => entryById.get(id)?.compiledFile),
      ).filter(Boolean)).size,
      isPlaceholder: collectionChapters.length === 0,
      chapters: collectionChapters,
      source: sourceEvidence(group),
    }
  })

  return {
    collections,
    logicalEntries,
    meta: {
      collectionCount: collections.length,
      placeholderCollectionCount: collections.filter(collection => collection.isPlaceholder).length,
      chapterCount: chapters.length,
      logicalEntryCount: logicalEntries.length,
      resourceIdCount: new Set(logicalEntries.map(entry => entry.resourceId).filter(Boolean)).size,
      compiledFileCount: new Set(logicalEntries.map(entry => entry.compiledFile).filter(Boolean)).size,
    },
  }
}
