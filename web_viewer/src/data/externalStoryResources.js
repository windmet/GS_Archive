const EXACT_MAPPING_STATES = new Set([
  'exact-story',
  'exact-collection',
  'exact-event',
  'exact-unit-story',
  'exact-idol-story',
])

function exactEntries(registry) {
  return (registry?.entries || []).filter(entry =>
    EXACT_MAPPING_STATES.has(entry?.internal_mapping?.state),
  )
}

export function externalResourcesForEvent(registry, eventCode) {
  const normalizedCode = String(eventCode || '')
  if (!normalizedCode) return []
  return exactEntries(registry).filter(entry =>
    entry.internal_mapping.event_id === normalizedCode,
  )
}

export function externalResourcesForStory(registry, story) {
  if (!story) return []
  const resourceIds = new Set([
    story.resourceId,
    ...(story.resourceIds || []),
    String(story.file || '').replace(/\.json$/i, ''),
  ].filter(Boolean))

  return exactEntries(registry).filter(entry => {
    const mapping = entry.internal_mapping
    return [...(mapping.story_resource_ids || []), ...(mapping.collection_ids || [])]
      .some(resourceId => resourceIds.has(resourceId))
  })
}

export function externalResourcesForCollection(registry, collection) {
  return (collection?.chapters || []).flatMap(chapter =>
    externalResourcesForStory(registry, chapter.story).map(resource => ({
      chapterId: chapter.id,
      resource,
    })),
  )
}

function storyFileId(story) {
  return String(story?.file || '').replace(/\.json$/i, '')
}

export function buildExternalStoryNavigationEntries(
  registry,
  { events = [], collections = [], stories = [] } = {},
) {
  const eventsByCode = new Map(events.map(event => [String(event.event_code || ''), event]))
  const collectionTargets = new Map()
  const storyTargets = new Map()

  for (const story of stories) {
    for (const identity of [
      story.resourceId,
      ...(story.resourceIds || []),
      storyFileId(story),
    ].filter(Boolean)) {
      storyTargets.set(identity, story)
    }
  }

  for (const collection of collections) {
    for (const chapter of collection?.chapters || []) {
      const scenarioId = storyFileId(chapter.story)
      if (!scenarioId) continue
      collectionTargets.set(scenarioId, { collection, chapter })
    }
  }

  return exactEntries(registry).flatMap(resource => {
    const mapping = resource.internal_mapping
    if (mapping.event_id) {
      const event = eventsByCode.get(String(mapping.event_id))
      if (!event) return []
      return [{
        id: `${resource.external_id}:event:${event.event_code}`,
        kind: 'event',
        categoryLabel: '活动剧情',
        title: event.title || event.event_code,
        contextLabel: `Event ${event.event_code}`,
        visualUrl: `/assets/events/banners/image_home_announce_event_${event.event_code}_01.png`,
        resource,
        target: { kind: 'event', event },
      }]
    }

    const collectionEntries = (mapping.collection_ids || []).flatMap(collectionId => {
      const target = collectionTargets.get(collectionId)
      if (!target) return []
      return [{
        id: `${resource.external_id}:collection:${collectionId}`,
        kind: 'unit-story',
        categoryLabel: '组合前传',
        title: target.chapter.title || collectionId,
        contextLabel: `${target.collection.title} · ${target.chapter.label}`,
        visualUrl: target.collection.visualUrl || '',
        resource,
        target: {
          kind: 'collection',
          domain: target.collection.domain,
          section: target.collection.sectionId,
          chapterId: target.chapter.id,
          storyFile: target.chapter.story?.file || '',
        },
      }]
    })

    const storyEntries = (mapping.story_resource_ids || []).flatMap(resourceId => {
      const story = storyTargets.get(resourceId)
      if (!story) return []
      return [{
        id: `${resource.external_id}:story:${resourceId}`,
        kind: 'story',
        categoryLabel: story.domainLabel || '剧情',
        title: story.title || resourceId,
        contextLabel: [story.sectionLabel, story.episodeLabel].filter(Boolean).join(' · ') || resourceId,
        visualUrl: story.visualUrl || '',
        resource,
        target: { kind: 'story', story },
      }]
    })

    return [...collectionEntries, ...storyEntries]
  })
}
