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

function buildMainDomain(storyMaster) {
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

function speakerByNumericId(speakerDictionary) {
  const entries = Object.values(speakerDictionary?.speakers || {})
  return new Map(entries
    .filter(speaker => Number.isInteger(Number(speaker?.npc_id)))
    .map(speaker => [String(Number(speaker.npc_id)), speaker]))
}

function birthdaySubject(row, idolUnit, speakersByNumericId) {
  const resourceId = String(row?.resource_id || '')
  const match = resourceId.match(/^1_(?:2|7|8)_(\d{3})_/)
  const numericId = match ? String(Number(match[1])) : ''
  const idol = numericId ? idolUnit?.by_numeric_id?.[numericId] : null
  if (idol) {
    return {
      kind: 'idol',
      numericId,
      code: String(idol.idol_code || ''),
      displayName: String(idol.display_name || idol.idol_code || ''),
      source: sourceEvidence(idol),
      resolution: 'master_resource_id+idol_dictionary',
    }
  }

  const speaker = numericId ? speakersByNumericId.get(numericId) : null
  if (speaker) {
    return {
      kind: 'npc',
      numericId,
      code: String(speaker.npc_code || speaker.speaker_id || ''),
      displayName: String(speaker.display_name || speaker.npc_code || ''),
      source: sourceEvidence(speaker),
      resolution: 'master_resource_id+speaker_dictionary',
    }
  }

  return {
    kind: 'unresolved',
    numericId,
    code: '',
    displayName: '',
    source: { table: 0, offset: 0 },
    resolution: 'unresolved',
  }
}

function birthdaySeries(row) {
  const parentId = String(row?.['2'] || '')
  const resourceId = String(row?.resource_id || '')
  return {
    id: `birthday-series:${parentId.slice(0, 3)}:${resourceId.split('_').slice(0, 2).join('_')}`,
    masterParentFamily: parentId.slice(0, 3),
    resourceFamily: resourceId.split('_').slice(0, 2).join('_'),
  }
}

function buildBirthdayDomain(storyMaster, idolUnit, speakerDictionary, memberships) {
  const speakersByNumericId = speakerByNumericId(speakerDictionary)
  const logicalEntries = sortedRows(storyMaster.birthday).map(row => {
    const entry = logicalEntry('birthday', row, '4')
    return {
      ...entry,
      subject: birthdaySubject(row, idolUnit, speakersByNumericId),
      series: birthdaySeries(row),
      domainMemberships: [...(memberships.get(entry.compiledFile) || [])].sort(),
    }
  })

  const bySubject = new Map()
  for (const entry of logicalEntries) {
    const key = entry.subject.code || `unresolved:${entry.masterId}`
    if (!bySubject.has(key)) bySubject.set(key, [])
    bySubject.get(key).push(entry)
  }
  const collections = [...bySubject.entries()]
    .map(([subjectCode, entries]) => ({
      id: `birthday:${subjectCode}`,
      subject: entries[0].subject,
      logicalEntryIds: entries.map(entry => entry.id),
      logicalEntryCount: entries.length,
      seriesIds: [...new Set(entries.map(entry => entry.series.id))].sort(),
      compiledFileCount: new Set(entries.map(entry => entry.compiledFile).filter(Boolean)).size,
    }))
    .sort((left, right) =>
      numeric(left.subject.numericId) - numeric(right.subject.numericId) ||
      left.subject.code.localeCompare(right.subject.code),
    )

  return {
    collections,
    logicalEntries,
    meta: {
      collectionCount: collections.length,
      logicalEntryCount: logicalEntries.length,
      resolvedIdolEntryCount: logicalEntries.filter(entry => entry.subject.kind === 'idol').length,
      resolvedNpcEntryCount: logicalEntries.filter(entry => entry.subject.kind === 'npc').length,
      unresolvedEntryCount: logicalEntries.filter(entry => entry.subject.kind === 'unresolved').length,
      seriesCount: new Set(logicalEntries.map(entry => entry.series.id)).size,
      resourceIdCount: new Set(logicalEntries.map(entry => entry.resourceId).filter(Boolean)).size,
      compiledFileCount: new Set(logicalEntries.map(entry => entry.compiledFile).filter(Boolean)).size,
      crossDomainSharedFileCount: new Set(logicalEntries
        .filter(entry => entry.domainMemberships.length > 1)
        .map(entry => entry.compiledFile)).size,
    },
  }
}

function buildExtraDomain(storyMaster) {
  const groups = sortedRows(storyMaster.extra?.groups)
  const logicalEntries = sortedRows(storyMaster.extra?.episodes)
    .map(row => logicalEntry('extra', row, '4'))

  const collections = groups.map(group => {
    const groupId = String(group['1'])
    const entries = logicalEntries.filter(entry => entry.parentId === groupId)
    return {
      id: `extra:${groupId}`,
      masterId: groupId,
      parentSeriesId: String(group['2'] || ''),
      title: String(group['3'] || ''),
      logicalEntryIds: entries.map(entry => entry.id),
      logicalEntryCount: entries.length,
      resourceIdCount: new Set(entries.map(entry => entry.resourceId).filter(Boolean)).size,
      compiledFileCount: new Set(entries.map(entry => entry.compiledFile).filter(Boolean)).size,
      source: sourceEvidence(group),
    }
  })

  const playbackUsage = new Map()
  for (const entry of logicalEntries) {
    if (!entry.compiledFile) continue
    if (!playbackUsage.has(entry.compiledFile)) playbackUsage.set(entry.compiledFile, [])
    playbackUsage.get(entry.compiledFile).push(entry.id)
  }

  return {
    collections,
    logicalEntries,
    meta: {
      collectionCount: collections.length,
      logicalEntryCount: logicalEntries.length,
      resourceIdCount: new Set(logicalEntries.map(entry => entry.resourceId).filter(Boolean)).size,
      compiledFileCount: playbackUsage.size,
      sharedPlaybackFileCount: [...playbackUsage.values()].filter(ids => ids.length > 1).length,
      maxLogicalEntriesPerPlaybackFile: Math.max(0, ...[...playbackUsage.values()].map(ids => ids.length)),
    },
  }
}

export function buildExtraStoryDomainIdentity(storyMaster) {
  if (!storyMaster) return null
  return buildExtraDomain(storyMaster)
}

function buildPlaybackIndex(domains) {
  const byCompiledFile = {}
  for (const domain of Object.values(domains)) {
    for (const entry of domain.logicalEntries) {
      if (!entry.compiledFile) continue
      if (!byCompiledFile[entry.compiledFile]) {
        byCompiledFile[entry.compiledFile] = {
          compiledFile: entry.compiledFile,
          logicalEntryIds: [],
          domains: [],
        }
      }
      const target = byCompiledFile[entry.compiledFile]
      target.logicalEntryIds.push(entry.id)
      if (!target.domains.includes(entry.domain)) target.domains.push(entry.domain)
    }
  }
  for (const target of Object.values(byCompiledFile)) {
    target.logicalEntryIds.sort()
    target.domains.sort()
  }
  return byCompiledFile
}

export function buildStoryDomainIdentityIndex({
  storyMaster,
  idolUnit,
  speakerDictionary,
} = {}) {
  if (!storyMaster) return null
  const memberships = allDomainMemberships(storyMaster)
  const domains = {
    main: buildMainDomain(storyMaster),
    birthday: buildBirthdayDomain(storyMaster, idolUnit, speakerDictionary, memberships),
    extra: buildExtraDomain(storyMaster),
  }
  return {
    schemaVersion: 1,
    authority: {
      semanticIdentity: 'story_master_index',
      idolIdentity: 'idol_unit_dictionary',
      npcIdentity: 'speaker_dictionary',
      playbackTarget: 'compiled_file',
    },
    domains,
    byCompiledFile: buildPlaybackIndex(domains),
  }
}
