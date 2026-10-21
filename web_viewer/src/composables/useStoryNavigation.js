import { watch } from 'vue'
import { storyEventResources } from '../data/eventResourceGraph.js'
import { withStoryText } from '../localization/story/StoryTextReadiness.js'
import { landingCollectionSections, storyOwner, storyOwnerNeedsLanding } from '../core/StoryOwner.js'
// Story domains with their own landing page in the catalog; their collections and stories return there.
const DOMAIN_LANDINGS = Object.freeze(['main', 'extra', 'birthday', 'unit_story', 'event'])
// Landings read from their own projections instead of the whole story directory.
const PROJECTED_LANDINGS = Object.freeze(['main', 'extra', 'birthday'])

export function useStoryNavigation({ view, loading, detailSourceRoute, filterQuery,
  currentStoryDomain, currentCharacterId, currentStoryMode, currentStorySection, currentStoryFile,
  storyCollectionParentView, currentEventScope, currentStoryAvailability, currentStorySort,
  currentMobileMode, currentMobileScenarioId, storyVisibleLimit, currentCategoryId, currentSongId,
  collectionReadModelCatalog, collectionReadModelDetail, collectionReadModelStatus,
  storyReadModelCatalog, storyReadModelStatus, storyCatalogIndex, storyCatalogLanding,
  navigation, archiveBootstrap, readModelClient, prepareArchivePage, captureDetailSource, commitView, commitArchiveSelection,
  goHome, openEventDetail, openIdolStoryArchive, openStoryPhone, openStoryReader, loadScenario, startEpisodeQueue,
  openIdolStoryChapter, openWorkArchive }) {
  let pendingCollectionNavigation = 0
  let pendingStoryDetailNavigation = 0
  async function loadCollectionCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (collectionReadModelCatalog.value) return collectionReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.collections, options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        if (rows.length !== index.count || new Set(rows.map(row => row.id)).size !== rows.length ||
          rows.some(row => row.id !== `${row.domain}:${row.sectionId}` || !row.title || !row.detail))
          throw new Error('Collection catalog identity or shape mismatch')
        options.signal?.throwIfAborted()
        collectionReadModelCatalog.value = rows
        return rows
    })()
  }

  async function loadCollectionDetail(domain, section, options = navigation.getLoadOptions?.() || {}) {
    const row = (await loadCollectionCatalog(options)).find(entry => entry.domain === domain &&
      (entry.sectionId === String(section) || entry.legacySectionIds?.includes(String(section))))
    if (!row) throw new Error(`Unavailable story collection: ${domain}:${section}`)
    return withStoryText('collection', await readModelClient.load({...row.detail,expectedId: row.id}, { ...options, expectedId: row.id, validate: data => {
      const collection = data.view?.collection
      if (collection?.domain !== row.domain || collection.sectionId !== row.sectionId ||
        !Array.isArray(collection.chapters) || !Array.isArray(data.view?.readingEntries))
        throw new Error('Collection detail identity or shape mismatch')
    } }), options)
  }

  async function loadStoryReadModelCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (storyReadModelCatalog.value) return storyReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.stories, options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        if (rows.length !== index.count || rows.length !== archiveBootstrap.counts.catalog_story_entries ||
          new Set(rows.map(row => row.file)).size !== rows.length ||
          rows.some(row => row.id !== row.file || !row.title || !row.detail))
          throw new Error('Story directory identity or count mismatch')
        options.signal?.throwIfAborted()
        storyCatalogIndex.value = index
        options.signal?.throwIfAborted()
        storyReadModelCatalog.value = rows
        return rows
    })()
  }

  async function loadStoryReadModelLanding(options = navigation.getLoadOptions?.() || {}) {
    if (storyCatalogLanding.value) return storyCatalogLanding.value
    const index = await readModelClient.load(archiveBootstrap.domains.stories, options)
    return (async () => {
        const descriptors = index.landing
        if (!descriptors?.main || !descriptors?.extra || !descriptors?.birthday)
          throw new Error('Story catalog landing descriptors missing')
        const [main, extra, birthday] = await Promise.all(['main', 'extra', 'birthday'].map(key =>
          readModelClient.load(descriptors[key], options)))
        if (!main?.value?.collections || !extra?.value?.collections || !birthday?.value?.collections)
          throw new Error('Story catalog landing shape mismatch')
        options.signal?.throwIfAborted()
        storyCatalogLanding.value = { main: main.value, extra: extra.value, birthday: birthday.value }
        return storyCatalogLanding.value
    })()
  }

  async function loadStoryReadModelDetail(file, options = navigation.getLoadOptions?.() || {}) {
    let row = storyReadModelCatalog.value?.find(entry => entry.file === file)
    if (!row) {
      const index = await readModelClient.load(archiveBootstrap.domains.stories, options)
      const locatorKey = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(file)))]
        .map(byte => byte.toString(16).padStart(2,'0')).join('')
      const shardKey = (parseInt(locatorKey.slice(0,2),16)%32).toString(16).padStart(2,'0')
      const descriptor = index.detailLocatorShards?.[shardKey]
      if (!descriptor?.sha256) throw new Error('Story locator missing')
      const locator = await readModelClient.load(descriptor, options)
      row = locator.rows?.find(entry => entry.file === file)
      if (row) row = {...row,id:file}
    }
    if (!row) throw new Error(`Unavailable story: ${file}`)
    return withStoryText('story', await readModelClient.load({...row.detail,expectedId: row.id}, { ...options, expectedId: row.id, validate: data => {
      if (data.story?.file !== file || !Array.isArray(data.view?.related) ||
        !Array.isArray(data.view?.castReferences) || typeof data.view.promotedVisualUrl !== 'string' ||
        !Array.isArray(data.view?.readingEntries))
        throw new Error('Story detail identity or shape mismatch')
    } }), options)
  }

  async function openStoryCatalog(options = {}) {
    const domain = typeof options?.domain === 'string' ? options.domain : ''
    if (view.value !== 'portal') detailSourceRoute.value = ''
    loading.value = true
    return navigation.run(async intent => {
      await prepareArchivePage('story_catalog', loadStoryReadModelLanding())
      if (!intent.isCurrent()) return
      filterQuery.value = ''
      currentStoryDomain.value = domain
      currentCharacterId.value = options.idolCode || ''
      currentStoryMode.value = options.mode || 'portal'
      currentStorySection.value = ''
      currentStoryFile.value = ''
      storyCollectionParentView.value = ''
      currentEventScope.value = 'all'
      currentStoryAvailability.value = options.idolCode ? 'playable' : 'all'
      currentStorySort.value = 'domain'
      currentMobileMode.value = 'personal'
      currentMobileScenarioId.value = ''
      storyVisibleLimit.value = 80
      commitView('story_catalog')
    }).catch(error => {
      loading.value = false
      console.error('[StoryReadModel] Failed to load catalog:', error)
      storyReadModelStatus.value = '剧情暂时无法读取，请重试。'
    })
  }

  function setStoryDomain(domain) {
    currentStoryDomain.value = domain
    currentStorySection.value = ''
    currentStoryMode.value = 'search'
    currentEventScope.value = 'all'
    storyVisibleLimit.value = 80
  }

  function setStoryMode(mode) {
    currentStoryMode.value = mode === 'search' ? 'search' : 'portal'
    if (currentStoryMode.value === 'portal') {
      filterQuery.value = ''
      currentStoryDomain.value = ''
      currentStorySection.value = ''
    }
  }

  function browseStoryCollection({ domain, section = '', mode = '' }) {
    if (section && ['main', 'unit_story', 'extra', 'birthday'].includes(domain)) {
      return openProjectedCollection({ domain, section })
    }
    const opensFormalDomain = (mode === 'portal' && ['main', 'unit_story', 'event'].includes(domain)) ||
      ['extra', 'birthday'].includes(domain)
    if (opensFormalDomain) {
      currentStoryDomain.value = domain
      currentStorySection.value = ''
      currentStoryMode.value = 'portal'
      currentStoryFile.value = ''
      storyCollectionParentView.value = ''
      currentEventScope.value = 'all'
      storyVisibleLimit.value = 80
      commitView('story_catalog')
      return
    }
    filterQuery.value = ''
    currentStoryDomain.value = domain || ''
    currentStorySection.value = section || ''
    currentEventScope.value = 'all'
    currentStoryMode.value = 'search'
    storyVisibleLimit.value = 80
  }

  function openExternalStoryResources() {
    detailSourceRoute.value = ''
    filterQuery.value = ''
    currentStoryDomain.value = ''
    currentStorySection.value = ''
    currentStoryFile.value = ''
    storyCollectionParentView.value = ''
    commitView('external_story_resources')
  }

  function openExternalStoryInternal(entry) {
    const target = entry?.target
    if (target?.kind === 'event') {
      openEventDetail(target.event, 'external_story_resources')
      return
    }
    if (target?.kind === 'story') return openStoryDetail(target.story, 'external_story_resources')
    if (target?.kind === 'idol-story') {
      openIdolStoryArchive(target.idolCode)
      return
    }
    if (target?.kind !== 'collection') return
    return openProjectedCollection({ domain: target.domain, section: target.section,
      storyFile: target.storyFile, parent: 'external_story_resources' })
  }

  function openProjectedCollection({ domain, section, storyFile = '', parent = '' }) {
    const request = ++pendingCollectionNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    collectionReadModelStatus.value = '正在读取故事章节…'
    loading.value = true
    return prepareArchivePage('story_collection', loadCollectionDetail(domain, section)).then(detail => {
      if (request !== pendingCollectionNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      collectionReadModelDetail.value = detail
      collectionReadModelStatus.value = ''
      captureDetailSource()
      currentStoryDomain.value = domain
      currentStorySection.value = String(section)
      currentStoryMode.value = 'portal'
      currentStoryFile.value = storyFile || ''
      storyCollectionParentView.value = parent
      commitView('story_collection')
    }).catch(error => {
      if (request !== pendingCollectionNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[CollectionReadModel] Failed to open collection:', error)
      collectionReadModelStatus.value = '故事章节暂时无法读取，请重试。'
    })
  }

  // A catalog or search row opens the page that owns its story (core/StoryOwner.js).
  function openCatalogStory(entry) {
    return openStoryDetail(entry)
  }

  // The newest event's "开始阅读" goes straight to its text; every other event entry opens the event page.
  function readEventStory(entry) {
    const resource = storyEventResources(entry)
    if (resource?.firstReadingId && resource.storyFile === entry.file)
      return openStoryReader(resource.firstReadingId, { event: resource.id, parentView: 'story_catalog', storyType: 'event', story: entry.file })
    return openStoryDetail(entry, 'story_catalog')
  }

  let ownerSections = { landing: null, sections: new Map() }
  function ownerFacts() {
    if (ownerSections.landing !== storyCatalogLanding.value)
      ownerSections = { landing: storyCatalogLanding.value, sections: landingCollectionSections(storyCatalogLanding.value) }
    return { idolIds: new Set(archiveBootstrap.idols.map(idol => idol.id)), sections: ownerSections.sections }
  }

  /** The owner of a loaded story; loads the landings when only they know the story's collection. */
  async function resolveStoryOwner(story, options = navigation.getLoadOptions?.() || {}) {
    const owner = storyOwner(story, ownerFacts())
    if (owner || !storyOwnerNeedsLanding(story)) return owner
    await loadStoryReadModelLanding(options)
    return storyOwner(story, ownerFacts())
  }

  function openStoryOwner(owner, story, parentView = '') {
    if (owner.view === 'mobile_archive') return openStoryPhone(story)
    if (owner.view === 'idol_story_archive') return openIdolStoryChapter(story)
    if (owner.view === 'work_archive') return openWorkArchive(owner.idol, owner.file)
    if (owner.view === 'event_detail') return openEventDetail({ event_id: owner.event }, parentView || 'story_catalog')
    return openProjectedCollection({ domain: owner.domain, section: owner.section, storyFile: owner.file, parent: parentView })
  }

  // Opens a story on the page that owns it. A story no page owns (none in the current read model) leaves the
  // visitor where they are, with a notice.
  function openStoryDetail(entry, parentView = '') {
    if (!entry?.file) return
    const known = storyOwner(entry, ownerFacts())
    if (known) return openStoryOwner(known, entry, parentView)
    const request = ++pendingStoryDetailNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    const stale = () => request !== pendingStoryDetailNavigation || revision !== navigation.getRevision() || navigation.isDisposed()
    storyReadModelStatus.value = '正在读取故事…'
    loading.value = true
    return loadStoryReadModelDetail(entry.file).then(async detail => {
      if (stale()) return
      const owner = await resolveStoryOwner(detail.story)
      if (stale()) return
      storyReadModelStatus.value = ''
      if (owner) return openStoryOwner(owner, detail.story, parentView)
      loading.value = false
      storyReadModelStatus.value = '这篇故事没有所属页面。'
    }).catch(error => {
      if (request !== pendingStoryDetailNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[StoryReadModel] Failed to open story:', error)
      storyReadModelStatus.value = '故事暂时无法读取，请重试。'
    })
  }

  function selectStoryCollectionChapter(chapter, { sync = true } = {}) {
    const file = chapter?.story?.file || chapter?.file || ''
    if (!file || currentStoryFile.value === file) return
    currentStoryFile.value = file
    if (sync) commitArchiveSelection()
  }

  function openStoryIdol(idolCode) {
    if (!/^\d{3}[a-z0-9]{3}$/i.test(idolCode)) return
    captureDetailSource()
    currentCategoryId.value = 'idol'
    currentCharacterId.value = idolCode
    commitView('idol_detail')
  }

  function playStoryCollectionChapter(chapter) {
    selectStoryCollectionChapter(chapter, { sync: false })
    const queue = chapter?.episodes || []
    if (queue.length && queue[0].exists && queue[0].file) startEpisodeQueue(queue, 0, 'story_collection', { entryIntent:'chapter' })
    else if (!queue.length && chapter?.file && chapter.exists) loadScenario(chapter.file, 'story_collection', { entryIntent:'chapter' })
  }

  function playStoryCollectionEpisode({ chapter, episode }) {
    selectStoryCollectionChapter(chapter, { sync: false })
    const queue = chapter?.episodes || []
    const index = queue.findIndex(candidate => candidate.id === episode?.id)
    if (index >= 0) startEpisodeQueue(queue, index, 'story_collection', { entryIntent:'segment' })
  }

  function goBackFromStoryCatalog() {
    if (
      currentStoryMode.value === 'portal' &&
      DOMAIN_LANDINGS.includes(currentStoryDomain.value)
    ) {
      currentStoryDomain.value = ''
      currentStorySection.value = ''
      commitView('story_catalog')
      return
    }
    goHome()
  }

  function goBackFromStoryCollection() {
    const parent = storyCollectionParentView.value
    if (parent === 'idol_story_archive' && currentCharacterId.value) {
      currentStoryDomain.value = 'idol_story'
      currentStorySection.value = ''
      currentStoryFile.value = ''
      storyCollectionParentView.value = ''
      commitView('idol_story_archive')
      return
    }
    if (parent === 'song_detail' && currentSongId.value) {
      currentStoryDomain.value = ''
      currentStorySection.value = ''
      currentStoryFile.value = ''
      storyCollectionParentView.value = ''
      commitView('song_detail')
      return
    }
    const domain = currentStoryDomain.value
    const returnsToDomainLanding = DOMAIN_LANDINGS.includes(domain) && parent !== 'external_story_resources'
    storyCollectionParentView.value = ''
    if (parent === 'external_story_resources') {
      currentStoryDomain.value = ''
      currentStorySection.value = ''
      currentStoryFile.value = ''
      commitView('external_story_resources')
      return
    }
    return openStoryCatalog({ domain: returnsToDomainLanding ? domain : '' })
  }

  function invalidateStoryNavigation() {
    ++pendingCollectionNavigation
    ++pendingStoryDetailNavigation
  }

  function normalizeStoryRoute(route) {
    if (route.view === 'story_collection' && (!route.storyType || !route.storySection)) return { view: 'story_catalog' }
    return route
  }

  async function prepareStoryRoute(route, { isCurrent }) {
    if ((route.view === 'story_collection' || (route.view === 'player' && route.returnView === 'story_collection')) && route.storyType && route.storySection) {
      try {
        const detail = await loadCollectionDetail(route.storyType, route.storySection)
        if (!isCurrent()) return null
        collectionReadModelDetail.value = detail
        collectionReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[CollectionReadModel] Failed to restore collection:', error)
        collectionReadModelStatus.value = '故事章节暂时无法读取，请稍后重试。'
        route = { view: 'story_catalog' }
      }
    }
    return isCurrent() ? route : null
  }

  // Domain landings use their own projections; other story views load the directory. The unit and event
  // landings group the directory, as the portal's unit strip and event section do.
  watch([view, currentStoryMode, currentStoryDomain, currentCharacterId], () => {
    const landingOnly = currentStoryMode.value === 'portal' && !currentCharacterId.value &&
      PROJECTED_LANDINGS.includes(currentStoryDomain.value)
    if (view.value !== 'story_catalog' || landingOnly) return
    const options = navigation.getLoadOptions()
    void loadStoryReadModelCatalog(options).catch(error => {
      if (!options.signal?.aborted) storyReadModelStatus.value = '剧情暂时无法读取，请重试。'
    })
  })

  watch([filterQuery, currentStoryDomain, currentStorySection, currentEventScope, currentStoryAvailability, currentStorySort], () => {
    storyVisibleLimit.value = 80
  })
  return {
    openStoryCatalog, setStoryDomain, setStoryMode, browseStoryCollection, openExternalStoryResources, openExternalStoryInternal,
    openProjectedCollection, openCatalogStory, readEventStory, openStoryDetail, resolveStoryOwner, openStoryOwner, selectStoryCollectionChapter, openStoryIdol,
    playStoryCollectionChapter, playStoryCollectionEpisode,
    loadCollectionCatalog, loadCollectionDetail, loadStoryReadModelCatalog, loadStoryReadModelLanding, loadStoryReadModelDetail,
    goBackFromStoryCatalog, goBackFromStoryCollection,
    invalidateStoryNavigation, normalizeStoryRoute, prepareStoryRoute,
  }
}
