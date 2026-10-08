import { watch } from 'vue'
import { storyEventResources } from '../data/eventResourceGraph.js'

export function useStoryNavigation({ view, loading, detailSourceRoute, filterQuery,
  currentStoryDomain, currentCharacterId, currentStoryMode, currentStorySection, currentStoryFile,
  storyDetailParentView, storyCollectionParentView, currentEventScope, currentStoryAvailability, currentStorySort,
  currentMobileMode, currentMobileScenarioId, storyVisibleLimit, currentCategoryId, currentSongId, currentStory,
  collectionReadModelCatalog, collectionReadModelDetail, collectionReadModelStatus,
  storyReadModelCatalog, storyReadModelDetail, storyReadModelStatus, storyCatalogIndex, storyCatalogLanding,
  navigation, archiveBootstrap, readModelClient, prepareArchivePage, captureDetailSource, commitView, commitArchiveSelection,
  goHome, openEventDetail, openIdolStoryArchive, openStoryPhone, openStoryReader, loadScenario, startEpisodeQueue,
  idolStoryChapterOwner, openIdolStoryChapter }) {
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
    return readModelClient.load({...row.detail,expectedId: row.id}, { ...options, expectedId: row.id, validate: data => {
      const collection = data.view?.collection
      if (collection?.domain !== row.domain || collection.sectionId !== row.sectionId ||
        !Array.isArray(collection.chapters) || !Array.isArray(data.view?.readingEntries))
        throw new Error('Collection detail identity or shape mismatch')
    } })
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
    return readModelClient.load({...row.detail,expectedId: row.id}, { ...options, expectedId: row.id, validate: data => {
      if (data.story?.file !== file || !Array.isArray(data.view?.related) ||
        !Array.isArray(data.view?.castReferences) || typeof data.view.promotedVisualUrl !== 'string' ||
        !Array.isArray(data.view?.readingEntries))
        throw new Error('Story detail identity or shape mismatch')
    } })
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
      storyDetailParentView.value = ''
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
      storyReadModelStatus.value = '故事目录暂时无法读取，请重试。'
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
    const opensFormalDomain = (mode === 'portal' && domain === 'main') ||
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
    storyDetailParentView.value = ''
    storyCollectionParentView.value = ''
    commitView('external_story_resources')
  }

  function openExternalStoryInternal(entry) {
    const target = entry?.target
    if (target?.kind === 'event') {
      openEventDetail(target.event, 'external_story_resources')
      return
    }
    if (target?.kind === 'story') {
      openStoryDetail(target.story, 'external_story_resources')
      return
    }
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

  function openCatalogStory(entry) {
    if (entry?.domain === 'card_scenarios') return openStoryPhone(entry)
    if (entry?.eventRelation) {
      const resource=storyEventResources(entry)
      if(resource?.firstReadingId&&resource.storyFile===entry.file)return openStoryReader(resource.firstReadingId,{event:resource.id,parentView:'story_catalog',storyType:'event',story:entry.file})
      return openStoryDetail(entry)
    }
    else openStoryDetail(entry)
  }

  function openStoryDetail(entry, parentView = '') {
    if (!entry?.file) return
    if (entry.domain === 'card_scenarios') return openStoryPhone(entry)
    if (idolStoryChapterOwner(entry)) return openIdolStoryChapter(entry)
    const file = entry.file
    const request = ++pendingStoryDetailNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    storyReadModelStatus.value = '正在读取故事详情…'
    loading.value = true
    return prepareArchivePage('story_detail', loadStoryReadModelDetail(file)).then(detail => {
      if (request !== pendingStoryDetailNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      storyReadModelDetail.value = detail
      storyReadModelStatus.value = ''
      captureDetailSource()
      currentStoryFile.value = file
      currentStoryDomain.value = detail.story.domain
      currentStorySection.value = detail.story.sectionId || ''
      storyDetailParentView.value = parentView
      commitView('story_detail')
    }).catch(error => {
      if (request !== pendingStoryDetailNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[StoryReadModel] Failed to open detail:', error)
      storyReadModelStatus.value = '故事详情暂时无法读取，请重试。'
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

  function playStoryDetail(entry = currentStory.value) {
    if (entry?.file && entry.exists) loadScenario(entry.file, 'story_detail')
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
      ['main', 'extra', 'birthday'].includes(currentStoryDomain.value)
    ) {
      currentStoryDomain.value = ''
      currentStorySection.value = ''
      commitView('story_catalog')
      return
    }
    goHome()
  }

  function goBackFromStoryDetail() {
    const parent = storyDetailParentView.value
    currentStoryFile.value = ''
    storyDetailParentView.value = ''
    if (parent === 'external_story_resources') {
      commitView('external_story_resources')
      return
    }
    return openStoryCatalog()
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
    const returnsToDomainLanding = ['main', 'extra', 'birthday'].includes(domain) && parent !== 'external_story_resources'
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
    if (route.view === 'story_collection' && (!route.storyType || !route.storySection) ||
      route.view === 'story_detail' && !route.story) return { view: 'story_catalog' }
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
    if ((route.view === 'story_detail' || (route.view === 'player' && route.returnView === 'story_detail')) && route.story) {
      try {
        const detail = await loadStoryReadModelDetail(route.story)
        if (!isCurrent()) return null
        storyReadModelDetail.value = detail
        storyReadModelStatus.value = ''
        route = { ...route, storyType: detail.story.domain, storySection: detail.story.sectionId || '' }
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[StoryReadModel] Failed to restore detail:', error)
        storyReadModelStatus.value = '故事详情暂时无法读取，请稍后重试。'
        route = { view: 'story_catalog' }
      }
    }
    return isCurrent() ? route : null
  }

  // Domain landings use their own projections; other story views load the directory.
  watch([view, currentStoryMode, currentStoryDomain, currentCharacterId], () => {
    const landingOnly = currentStoryMode.value === 'portal' && !currentCharacterId.value && currentStoryDomain.value
    if (view.value !== 'story_catalog' || landingOnly) return
    const options = navigation.getLoadOptions()
    void loadStoryReadModelCatalog(options).catch(error => {
      if (!options.signal?.aborted) storyReadModelStatus.value = '故事目录暂时无法读取，请重试。'
    })
  })

  watch([filterQuery, currentStoryDomain, currentStorySection, currentEventScope, currentStoryAvailability, currentStorySort], () => {
    storyVisibleLimit.value = 80
  })
  return {
    openStoryCatalog, setStoryDomain, setStoryMode, browseStoryCollection, openExternalStoryResources, openExternalStoryInternal,
    openProjectedCollection, openCatalogStory, openStoryDetail, selectStoryCollectionChapter, openStoryIdol,
    playStoryDetail, playStoryCollectionChapter, playStoryCollectionEpisode,
    loadCollectionCatalog, loadCollectionDetail, loadStoryReadModelCatalog, loadStoryReadModelLanding, loadStoryReadModelDetail,
    goBackFromStoryCatalog, goBackFromStoryDetail, goBackFromStoryCollection,
    invalidateStoryNavigation, normalizeStoryRoute, prepareStoryRoute,
  }
}
