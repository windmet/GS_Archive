import { computed } from 'vue'
import { storyMatchesIdol } from '../presentation/CatalogIdolScope.js'

export function useStoryCatalogProjection({ storyCatalogEntries, catalogScopeIdol, filterQuery,
  currentStoryAvailability, currentStoryDomain, currentStorySection, currentEventScope, currentStorySort, storyVisibleLimit }) {
  const storyDomainOptions = computed(() => {
    const counts = new Map()
    const labels = new Map()
    for (const entry of catalogStoryEntries.value) {
      counts.set(entry.domain, (counts.get(entry.domain) || 0) + 1)
      labels.set(entry.domain, entry.domainLabel)
    }
    return [...counts.entries()].map(([id, count]) => ({ id, count, label: labels.get(id) || id }))
  })

  const storyEventScopeOptions = computed(() => {
    const labels = {
      fixed_unit_event: '固定组合团活',
      attribute_event: '属性团曲',
      mixed_unit_event: '跨组合团活',
    }
    return Object.entries(labels).map(([id, label]) => ({
      id,
      label,
      count: catalogStoryEntries.value.filter(entry => entry.domain === 'event' && entry.eventScope === id).length,
    }))
  })

  const catalogStoryEntries = computed(() => storyCatalogEntries.value.filter(entry => storyMatchesIdol(entry, catalogScopeIdol.value)))
  const filteredStoryCatalog = computed(() => {
    const query = filterQuery.value.trim().toLowerCase()
    const availability = currentStoryAvailability.value
    const entries = catalogStoryEntries.value.filter(entry =>
      (!currentStoryDomain.value || entry.domain === currentStoryDomain.value) &&
      (!currentStorySection.value || entry.sectionId === currentStorySection.value) &&
      (currentStoryDomain.value !== 'event' || currentEventScope.value === 'all' || entry.eventScope === currentEventScope.value) &&
      (availability === 'all' || (availability === 'playable' ? entry.exists : !entry.exists)),
    )
    const sorted = [...entries]
    if (currentStorySort.value === 'latest') sorted.sort((a,b)=>b.releaseAt-a.releaseAt)
    else if (currentStorySort.value === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
    else if (currentStorySort.value === 'resource') sorted.sort((a, b) => a.resourceId.localeCompare(b.resourceId))
    else if (currentStorySort.value === 'steps_desc') sorted.sort((a, b) => (b.summary?.step_count || 0) - (a.summary?.step_count || 0))
    else sorted.sort((a, b) => a.domainOrder - b.domainOrder || a.resourceId.localeCompare(b.resourceId))
    return sorted
  })
  const visibleStoryCatalogEntries = computed(() => filteredStoryCatalog.value.slice(0, storyVisibleLimit.value))
  return { storyDomainOptions, storyEventScopeOptions, catalogStoryEntries, filteredStoryCatalog, visibleStoryCatalogEntries }
}
