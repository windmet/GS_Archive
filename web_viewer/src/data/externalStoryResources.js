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
