import { computed } from 'vue'
import { externalResourcesForEvent } from '../data/externalStoryResources.js'
import { withStoryText } from '../localization/story/StoryTextReadiness.js'

export function useEventNavigation({
  eventReadModelCatalog, eventReadModelDetail, eventReadModelStatus, view,
  loading, currentEventId, eventParentView, detailSourceRoute,
  currentCharacterId, cardReadModelCatalog, currentCard, currentArchiveUnit,
  externalStoryResourcesData, navigation, archiveBootstrap, readModelClient,
  prepareArchivePage, captureDetailSource, commitView, restoreDetailSource,
  openStoryCatalog, startEpisodeQueue, loadScenario, loadCardCatalog,
  openCard, openIdolReadModel, openArchiveUnit,
}) {
  const currentEventProjection = computed(() => eventReadModelDetail.value?.id === currentEventId.value
    ? eventReadModelDetail.value.view : null)

  const currentEvent = computed(() => currentEventProjection.value?.story.entry || null)

  const currentEventEpisodes = computed(() => currentEventProjection.value?.episodes || [])

  const currentEventExternalResources = computed(() =>
    externalResourcesForEvent(externalStoryResourcesData.value, currentEvent.value?.event_code),
  )

  let pendingEventNavigation = 0

  function openEventDetail(event, parentView = 'story_catalog') {
    if (!event?.event_id) return
    const id = String(event.event_id)
    const request = ++pendingEventNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    eventReadModelStatus.value = '正在读取活动详情…'
    loading.value = true
    return prepareArchivePage('event_detail', loadEventDetail(id)).then(detail => {
      if (request !== pendingEventNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      eventReadModelDetail.value = detail
      eventReadModelStatus.value = ''
      captureDetailSource()
      currentEventId.value = id
      eventParentView.value = parentView
      commitView('event_detail')
    }).catch(error => {
      if (request !== pendingEventNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[EventReadModel] Failed to load detail:', error)
      eventReadModelStatus.value = '活动详情暂时无法读取，请重试。'
    })
  }

  function goBackFromEvent() {
    const parent = eventParentView.value
    if (detailSourceRoute.value) {
      currentEventId.value = ''
      eventParentView.value = ''
      return restoreDetailSource(openStoryCatalog)
    }
    currentEventId.value = ''
    eventParentView.value = ''
    if (parent === 'home') commitView('home')
    else if (parent === 'external_story_resources') commitView('external_story_resources')
    else if (parent === 'card_detail' && currentCard.value) commitView('card_detail')
    else if (parent === 'unit_detail' && currentArchiveUnit.value) commitView('unit_detail')
    else if (parent === 'idol_detail' && archiveBootstrap.idols.some(idol => idol.id === currentCharacterId.value)) commitView('idol_detail')
    else return openStoryCatalog()
  }

  function playCurrentEvent() {
    const queue = currentEventEpisodes.value.filter(episode => episode.file)
    if (queue.length) startEpisodeQueue(queue, 0, 'event_detail')
    else if (currentEvent.value?.file && currentEvent.value.exists) loadScenario(currentEvent.value.file, 'event_detail')
  }

  function playCurrentEventEpisode(episode) {
    const queue = currentEventEpisodes.value.filter(candidate => candidate.file)
    const index = queue.findIndex(candidate => candidate.id === episode?.id)
    if (index >= 0) startEpisodeQueue(queue, index, 'event_detail')
  }

  async function openEventCard(relation) {
    const revision = navigation.getRevision()
    const eventId = currentEventId.value
    try {
      if (!cardReadModelCatalog.value) await loadCardCatalog()
    } catch (error) {
      if (revision === navigation.getRevision() && currentEventId.value === eventId) {
        console.error('[EventReadModel] Failed to load linked cards:', error)
        eventReadModelStatus.value = '关联卡片暂时无法读取，请重试。'
      }
      return
    }
    if (revision !== navigation.getRevision() || view.value !== 'event_detail' || currentEventId.value !== eventId) return
    const card = cardReadModelCatalog.value?.find(row => row.resource_id === relation?.card_resource_id)
    if (!card) return
    return openCard(card, { resetContext: true, captureSource: true, clearEventContext: true })
  }

  function openEventIdol(idol) {
    return openIdolReadModel(idol.idol_code, { captureSource: true, resetContext: true, clearUnit: true, clearEventContext: true })
  }

  function openEventUnit(unit) {
    return openArchiveUnit(unit, { clearEventContext: true })
  }

  async function loadEventCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (eventReadModelCatalog.value) return eventReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.events, options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        if (rows.length !== index.count || new Set(rows.map(row => String(row.id))).size !== rows.length ||
          rows.some(row => !row.detail || String(row.event_id) !== String(row.id)))
          throw new Error('Event catalog count or identity mismatch')
        options.signal?.throwIfAborted()
        eventReadModelCatalog.value = rows
        return rows
    })()
  }

  async function loadEventDetail(id, options = navigation.getLoadOptions?.() || {}) {
    const row = (await loadEventCatalog(options)).find(entry => String(entry.id) === id)
    if (!row) throw new Error(`Unavailable event: ${id}`)
    const detail=await readModelClient.load({...row.detail,expectedId: id}, { ...options, expectedId: id, validate: data => {
      if (data.view?.schemaVersion !== 2 || String(data.view?.identity?.id) !== id || !Array.isArray(data.view?.episodes) ||
        !Array.isArray(data.view?.cards) || !Array.isArray(data.view?.cast) ||
        !Array.isArray(data.view?.units) || !Array.isArray(data.view?.castReferences) ||
        !Array.isArray(data.view?.readingEntries) ||
        !Array.isArray(data.view?.rewards?.generalPages) || !Number.isSafeInteger(data.view?.rewards?.generalCount) || data.view.rewards.generalCount < 0 ||
        data.view.castReferences.length !== data.view.cast.length ||
        data.view.castReferences.some((entry, index) => entry.idol_code !== data.view.cast[index].idol_code ||
          entry.reference?.idolCode !== entry.idol_code))
        throw new Error('Event detail identity or shape mismatch')
    } })
    const pages=await Promise.all(detail.view.rewards.generalPages.map(page=>readModelClient.load(page,{...options,validate:data=>{
      if(!Array.isArray(data.rows) || data.rows.some(row=>row?.eventId!==detail.view.provenance.eventId))throw Error('Event reward page identity mismatch')
    }})))
    const general=pages.flatMap(page=>page.rows)
    if(general.length!==detail.view.rewards.generalCount || general.some(row=>row.eventId!==detail.view.provenance.eventId))throw Error('Event reward identity mismatch')
    return withStoryText('event', {...detail,view:{...detail.view,rewards:{...detail.view.rewards,general}}}, options)

  }

  function invalidateEventNavigation() { ++pendingEventNavigation }

  async function prepareEventRoute(route, { isCurrent }) {
    if ((route.view === 'event_detail' || (route.view === 'player' && route.returnView === 'event_detail')) && route.event) {
      try {
        const detail = await loadEventDetail(String(route.event))
        if (!isCurrent()) return null
        eventReadModelDetail.value = detail
        eventReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[EventReadModel] Failed to restore event route:', error)
        eventReadModelStatus.value = '活动详情暂时无法读取，请稍后重试。'
        route = { view: 'story_catalog' }
      }
    }
    return route
  }

  return {
    openEventDetail, goBackFromEvent, playCurrentEvent, playCurrentEventEpisode,
    openEventCard, openEventIdol, openEventUnit, loadEventCatalog,
    loadEventDetail, currentEventProjection, currentEvent, currentEventEpisodes,
    currentEventExternalResources, prepareEventRoute, invalidateEventNavigation,
  }
}
