import {
  extraStorySeriesDefinition,
  resolveExtraStoryGasha,
} from './extraStoryTaxonomy.js'

function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sourceEvidence(row) {
  return {
    table: numeric(row?._source?.table || row?._top_field),
    offset: numeric(row?._source?.offset || row?._offset),
  }
}

export function buildMainStoryDomainIdentity(catalog) {
  if (!catalog) return null
  if (!catalog.mainIdentity) throw new Error('Main identity requires the named catalog')
  // Catalog values are JSON; this also accepts Vue's read proxies without
  // coupling the data module to Vue or returning mutable cache-owned objects.
  return JSON.parse(JSON.stringify(catalog.mainIdentity))
}

function speakerByNumericId(speakerDictionary) {
  const entries = Object.values(speakerDictionary?.speakers || {})
  return new Map(entries
    .filter(speaker => Number.isInteger(Number(speaker?.npc_id)))
    .map(speaker => [String(Number(speaker.npc_id)), speaker]))
}

function birthdaySubject(row, idolUnit, speakersByNumericId) {
  const semantics = row?.birthdaySemantics
  const hasAuthoritativeSubject = semantics && Object.hasOwn(semantics, 'subject_numeric_id')
  const resourceId = String(row?.resourceId || '')
  const match = resourceId.match(/^1_(?:2|7|8)_(\d{3})_/)
  const numericId = hasAuthoritativeSubject
    ? (Number.isInteger(semantics.subject_numeric_id) ? String(semantics.subject_numeric_id) : '')
    : (match ? String(Number(match[1])) : '')
  const idol = numericId ? idolUnit?.by_numeric_id?.[numericId] : null
  if (idol) {
    return {
      kind: 'idol',
      numericId,
      code: String(idol.idol_code || ''),
      displayName: String(idol.display_name || idol.idol_code || ''),
      source: sourceEvidence(idol),
      resolution: hasAuthoritativeSubject
        ? 'table_80_character_set+idol_dictionary'
        : 'master_resource_id+idol_dictionary',
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
      resolution: hasAuthoritativeSubject
        ? 'table_80_character_set+speaker_dictionary'
        : 'master_resource_id+speaker_dictionary',
    }
  }

  if (hasAuthoritativeSubject && !numericId) {
    return {
      kind: 'shared',
      numericId: '',
      code: 'producer_birthday_common',
      displayName: '制作人生日公共篇',
      source: {
        table: numeric(semantics?.sources?.character?.table),
        offset: numeric(semantics?.sources?.character?.offset),
      },
      resolution: 'table_80_character_set_unassigned',
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
  const semantics = row?.birthdaySemantics || {}
  const parentId = String(row?.parentId || '')
  const resourceId = String(row?.resourceId || '')
  const chapterId = String(semantics.chapter_id || parentId.slice(0, 3))
  return {
    id: `birthday-series:${chapterId}:${resourceId.split('_').slice(0, 2).join('_')}`,
    masterParentFamily: chapterId,
    resourceFamily: resourceId.split('_').slice(0, 2).join('_'),
    chapterId,
    chapterTitle: String(semantics.chapter_title || ''),
    sectionTitle: String(semantics.section_title || ''),
    seriesNumber: numeric(semantics.series_number),
    target: String(semantics.target || ''),
  }
}

function buildBirthdayDomain(catalog, idolUnit, speakerDictionary, semanticIndex = null) {
  if (!catalog?.birthdayIdentity) throw new Error('Birthday identity requires the named catalog')
  const speakersByNumericId = speakerByNumericId(speakerDictionary)
  const announcementsById = new Map((semanticIndex?.announcements || [])
    .map(announcement => [Number(announcement.id), announcement]))
  const logicalEntries = JSON.parse(JSON.stringify(catalog.birthdayIdentity.logicalEntries)).map(({ birthdaySemantics, ...entry }) => {
    const semantics = semanticIndex?.by_episode_id?.[entry.masterId] || null
    const semanticRow = { ...entry, birthdaySemantics: semantics || birthdaySemantics }
    return {
      ...entry,
      subject: birthdaySubject(semanticRow, idolUnit, speakersByNumericId),
      series: birthdaySeries(semanticRow),
      announcements: (semantics?.announcement_ids || [])
        .map(id => announcementsById.get(Number(id)))
        .filter(Boolean),
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
      sharedSubjectEntryCount: logicalEntries.filter(entry => entry.subject.kind === 'shared').length,
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

export function buildBirthdayStoryDomainIdentity(catalog, idolUnit, speakerDictionary, semanticIndex = null) {
  if (!catalog) return null
  return buildBirthdayDomain(
    catalog,
    idolUnit,
    speakerDictionary,
    semanticIndex,
  )
}

function buildExtraDomain(catalog, gashaIndex = null, visualIndex = null) {
  if (!catalog?.extraIdentity) throw new Error('Extra identity requires the named catalog')
  const { groups, logicalEntries } = JSON.parse(JSON.stringify(catalog.extraIdentity))
  const visualsByChapter = new Map((visualIndex?.entries || [])
    .map(entry => [String(entry.chapter_id || ''), entry]))
  const seriesIds = [...new Set(groups.map(group => group.seriesId).filter(Boolean))]
  const collections = seriesIds.map(seriesId => {
    const definition = extraStorySeriesDefinition(seriesId)
    const masterGroups = groups.filter(group => group.seriesId === seriesId)
    const masterGroupIds = masterGroups.map(group => group.masterId)
    const entries = logicalEntries.filter(entry => entry.seriesId === seriesId)
    const gasha = resolveExtraStoryGasha(gashaIndex, definition.gashaCode)
    const visual = visualsByChapter.get(seriesId) || null
    return {
      id: `extra:${seriesId}`,
      masterId: seriesId,
      parentSeriesId: seriesId,
      legacySectionIds: masterGroupIds,
      title: gasha?.display_name || definition.title,
      description: definition.description,
      official: definition.official,
      sourceUrl: definition.sourceUrl,
      gashaCode: definition.gashaCode,
      gasha,
      visual,
      bannerUrl: String(visual?.assets?.banner?.url || ''),
      keyVisualUrl: String(visual?.assets?.key_visual?.url || ''),
      logicalEntryIds: entries.map(entry => entry.id),
      logicalEntryCount: entries.length,
      resourceIdCount: new Set(entries.map(entry => entry.resourceId).filter(Boolean)).size,
      compiledFileCount: new Set(entries.map(entry => entry.compiledFile).filter(Boolean)).size,
      releaseAt: Math.min(...entries.map(entry => entry.releaseAt).filter(Boolean)),
      source: masterGroups[0].source,
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
      officialCollectionCount: collections.filter(collection => collection.official).length,
      supplementaryCollectionCount: collections.filter(collection => !collection.official).length,
      masterGroupCount: groups.length,
      logicalEntryCount: logicalEntries.length,
      resourceIdCount: new Set(logicalEntries.map(entry => entry.resourceId).filter(Boolean)).size,
      compiledFileCount: playbackUsage.size,
      sharedPlaybackFileCount: [...playbackUsage.values()].filter(ids => ids.length > 1).length,
      maxLogicalEntriesPerPlaybackFile: Math.max(0, ...[...playbackUsage.values()].map(ids => ids.length)),
    },
  }
}

export function buildExtraStoryDomainIdentity(catalog, gashaIndex = null, visualIndex = null) {
  if (!catalog) return null
  return buildExtraDomain(catalog, gashaIndex, visualIndex)
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
  storyCatalog,
  idolUnit,
  speakerDictionary,
  birthdayStorySemantic,
} = {}) {
  if (!storyCatalog) return null
  const domains = {
    main: buildMainStoryDomainIdentity(storyCatalog),
    birthday: buildBirthdayDomain(storyCatalog, idolUnit, speakerDictionary, birthdayStorySemantic),
    extra: buildExtraDomain(storyCatalog),
  }
  return {
    schemaVersion: 1,
    authority: {
      semanticIdentity: 'story_catalog',
      mainIdentity: 'story_catalog.mainIdentity',
      extraIdentity: 'story_catalog.extraIdentity',
      birthdaySemantic: 'birthday_story_semantic_index',
      idolIdentity: 'idol_unit_dictionary',
      npcIdentity: 'speaker_dictionary',
      playbackTarget: 'compiled_file',
    },
    domains,
    byCompiledFile: buildPlaybackIndex(domains),
  }
}
