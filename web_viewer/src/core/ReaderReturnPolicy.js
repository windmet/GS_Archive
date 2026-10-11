import { readArchiveSourceRoute } from './archiveRoute.js'

// Pure decision for "leave the Reader". The caller executes it (restoreDetailSource, applyArchiveRoute,
// history); branch order is user-visible and must stay as is.
//   { action: 'restore-source' } | { action: 'catalog' } | { action: 'route', route }
export function readerReturnDecision({
  detailSourceRoute, storyDomain, characterId, storyFile, workMode, storySection, eventId, eventParentView, categoryId, unitCode,
}) {
  // Legacy event Reader URLs stored the event's parent; newer URLs store the event itself.
  if (detailSourceRoute && (!eventId || ['event_detail', 'story_catalog'].includes(readArchiveSourceRoute(detailSourceRoute).view))) {
    return { action: 'restore-source' }
  }
  if (storyDomain === 'work' && characterId) {
    return { action: 'route', route: { view: 'work_archive', storyType: 'work', idol: characterId, story: storyFile, workMode } }
  }
  if (storyDomain === 'seasonal_campaign') {
    return { action: 'route', route: { view: 'seasonal_campaign', storyType: 'seasonal_campaign', storySection, idol: characterId } }
  }
  if (eventId) {
    return { action: 'route', route: { view: 'event_detail', event: eventId, parentView: eventParentView, category: categoryId,
      unit: unitCode, sourceRoute: detailSourceRoute } }
  }
  if (!storySection && !storyFile) return { action: 'catalog' }
  return { action: 'route', route: { view: storySection ? 'story_collection' : 'story_detail', storyType: storyDomain, storySection, story: storyFile } }
}
