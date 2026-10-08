import { computed } from 'vue'

export function useStoryArchiveNavigation({
  loading, filterQuery, currentStoryDomain, currentStoryMode, currentStorySection, currentStoryFile,
  currentCharacterId, currentWorkMode, currentEpisodeId, currentMobileScenarioId, storyCollectionParentView,
  currentMobileMode, mobileUnitReadModelDetail, mobileIdolReadModelDetail,
  seasonalReadModelCatalog, seasonalReadModelDetail, seasonalReadModelStatus,
  workReadModelCatalog, workReadModelDetail, workReadModelStatus,
  idolStoryReadModelCatalog, idolStoryReadModelDetail, idolStoryReadModelStatus,
  navigation, archiveBootstrap, readModelClient, prepareArchivePage, captureDetailSource, commitView, commitArchiveSelection,
  openIdolPicker, openStoryCatalog, openProjectedCollection, loadScenario, startEpisodeQueue }) {
  let pendingSeasonalNavigation = 0
  let pendingWorkNavigation = 0
  let pendingIdolStoryNavigation = 0

  const currentSeasonalCampaign = computed(() => seasonalReadModelDetail.value?.id === currentStorySection.value
    ? seasonalReadModelDetail.value.view.campaign : null)

  const currentWorkIdol = computed(() => workReadModelDetail.value?.id === currentCharacterId.value
    ? workReadModelDetail.value.view.idol : null)

  const idolStoryOptions = computed(() => idolStoryReadModelCatalog.value || [])

  const currentIdolStoryPage = computed(() => idolStoryReadModelDetail.value?.id === currentCharacterId.value
    ? idolStoryReadModelDetail.value.view.page : null)

  async function loadSeasonalCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (seasonalReadModelCatalog.value) return seasonalReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.seasonal, options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        if (rows.length !== index.count || new Set(rows.map(row => row.id)).size !== rows.length ||
          rows.some(row => !row.detail || !row.name || !Number.isInteger(row.year) ||
            !['valentine', 'white_day'].includes(row.season)))
          throw new Error('Seasonal catalog count or switch fields mismatch')
        options.signal?.throwIfAborted()
        seasonalReadModelCatalog.value = rows
        return rows
    })()
  }

  async function loadSeasonalDetail(requestedId = 'valentine_2023', options = navigation.getLoadOptions?.() || {}) {
    const rows = await loadSeasonalCatalog(options)
    const row = rows.find(entry => entry.id === requestedId) ||
      rows.find(entry => entry.id === 'valentine_2023') || rows[0]
    if (!row) throw new Error('No seasonal campaigns available')
    return readModelClient.load({...row.detail,expectedId: row.id}, { ...options, expectedId: row.id, validate: data => {
      if (data.view?.campaign?.id !== row.id || data.view.campaign.year !== row.year ||
        data.view.campaign.season !== row.season || !Array.isArray(data.view.campaign.participants))
        throw new Error('Seasonal campaign identity or shape mismatch')
    } })
  }

  async function loadWorkCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (workReadModelCatalog.value) return workReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.work, options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        const expected = archiveBootstrap.idols.map(idol => idol.id)
        if (rows.length !== index.count || rows.length !== expected.length ||
          rows.some((row, position) => row.id !== expected[position] || row.idol_code !== row.id ||
            !row.display_name || !row.work_type_name || !row.detail))
          throw new Error('Work catalog identity or switch fields mismatch')
        options.signal?.throwIfAborted()
        workReadModelCatalog.value = rows
        return rows
    })()
  }

  async function loadWorkDetail(id, options = navigation.getLoadOptions?.() || {}) {
    const row = (await loadWorkCatalog(options)).find(entry => entry.id === id)
    if (!row) throw new Error(`Unavailable work idol: ${id}`)
    return readModelClient.load({...row.detail,expectedId: id}, { ...options, expectedId: id, validate: data => {
      if (data.view?.idol?.idol_code !== id || !Array.isArray(data.view.idol.short_stories) ||
        !Array.isArray(data.view.idol.scene_lines) || !Array.isArray(data.view?.sourceEvidence?.entries) ||
        !Array.isArray(data.view?.readingEntries))
        throw new Error('Work detail identity or shape mismatch')
    } })
  }

  async function loadIdolStoryCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (idolStoryReadModelCatalog.value) return idolStoryReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains['idol-stories'], options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        const expected = archiveBootstrap.idols.map(idol => idol.id)
        if (rows.length !== index.count || rows.length !== expected.length ||
          rows.some((row, position) => row.id !== expected[position] || row.idolCode !== row.id ||
            !row.idolName || !Number.isInteger(row.sectionCount) || !Number.isInteger(row.episodeCount) || !row.detail))
          throw new Error('Idol story catalog identity or switch fields mismatch')
        options.signal?.throwIfAborted()
        idolStoryReadModelCatalog.value = rows
        return rows
    })()
  }

  async function loadIdolStoryDetail(id, options = navigation.getLoadOptions?.() || {}) {
    const row = (await loadIdolStoryCatalog(options)).find(entry => entry.id === id)
    if (!row) throw new Error(`Unavailable idol story: ${id}`)
    return readModelClient.load({...row.detail,expectedId: id}, { ...options, expectedId: id, validate: data => {
      if (data.view?.page?.idol_code !== id || !Array.isArray(data.view.page.sections) ||
        !Array.isArray(data.view?.readingEntries))
        throw new Error('Idol story detail identity or shape mismatch')
    } })
  }

  function openSeasonalCampaign(campaignId = 'valentine_2023') {
    const request = ++pendingSeasonalNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    seasonalReadModelStatus.value = '正在读取季节企划…'
    loading.value = true
    return prepareArchivePage('seasonal_campaign', loadSeasonalDetail(campaignId)).then(detail => {
      if (request !== pendingSeasonalNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      seasonalReadModelDetail.value = detail
      seasonalReadModelStatus.value = ''
      captureDetailSource()
      currentStoryDomain.value = 'seasonal_campaign'
      currentStoryMode.value = 'portal'
      currentStorySection.value = detail.id
      commitView('seasonal_campaign')
    }).catch(error => {
      if (request !== pendingSeasonalNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[SeasonalReadModel] Failed to load campaign:', error)
      seasonalReadModelStatus.value = '季节企划暂时无法读取，请重试。'
    })
  }

  function selectSeasonalCampaign(campaignId) {
    const request = ++pendingSeasonalNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    seasonalReadModelStatus.value = '正在切换季节企划…'
    loading.value = true
    return prepareArchivePage('seasonal_campaign', loadSeasonalDetail(campaignId)).then(detail => {
      if (request !== pendingSeasonalNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      seasonalReadModelDetail.value = detail
      seasonalReadModelStatus.value = ''
      currentStorySection.value = detail.id
      commitArchiveSelection()
    }).catch(error => {
      if (request !== pendingSeasonalNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[SeasonalReadModel] Failed to switch campaign:', error)
      seasonalReadModelStatus.value = '企划切换失败，请重试。'
    })
  }

  function playSeasonalCampaignStory(file) {
    if (file) loadScenario(file, 'seasonal_campaign')
  }

  function openWorkArchive(idolCode = '') {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return openIdolPicker('work')
    const request = ++pendingWorkNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    workReadModelStatus.value = '正在读取工作档案…'
    loading.value = true
    return prepareArchivePage('work_archive', loadWorkDetail(idolCode)).then(detail => {
      if (request !== pendingWorkNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      workReadModelDetail.value = detail
      workReadModelStatus.value = ''
      captureDetailSource()
      currentStoryDomain.value = 'work'
      currentStoryFile.value = ''
      currentWorkMode.value = 'stories'
      currentStoryMode.value = 'portal'
      currentStorySection.value = ''
      currentCharacterId.value = idolCode
      commitView('work_archive')
    }).catch(error => {
      if (request !== pendingWorkNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[WorkReadModel] Failed to open idol:', error)
      workReadModelStatus.value = '工作档案暂时无法读取，请重试。'
    })
  }

  function selectWorkIdol(idolCode) {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
    const request = ++pendingWorkNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    workReadModelStatus.value = '正在切换工作档案…'
    loading.value = true
    return prepareArchivePage('work_archive', loadWorkDetail(idolCode)).then(detail => {
      if (request !== pendingWorkNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      workReadModelDetail.value = detail
      workReadModelStatus.value = ''
      currentCharacterId.value = idolCode
      currentStoryFile.value = ''
      commitArchiveSelection()
    }).catch(error => {
      if (request !== pendingWorkNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[WorkReadModel] Failed to switch idol:', error)
      workReadModelStatus.value = '工作档案切换失败，请重试。'
    })
  }

  function setWorkMode(mode) {
    if (!['stories', 'lines'].includes(mode) || currentWorkMode.value === mode) return
    currentWorkMode.value = mode
    currentStoryFile.value = ''
    commitArchiveSelection()
  }

  function playWorkStory(file) {
    if (file) loadScenario(file, 'work_archive')
  }

  function openIdolStoryArchive(idolCode = '') {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return openIdolPicker('story')
    const request = ++pendingIdolStoryNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    idolStoryReadModelStatus.value = '正在读取个人故事…'
    loading.value = true
    return prepareArchivePage('idol_story_archive', loadIdolStoryDetail(idolCode)).then(detail => {
      if (request !== pendingIdolStoryNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      idolStoryReadModelDetail.value = detail
      idolStoryReadModelStatus.value = ''
      captureDetailSource()
      filterQuery.value = ''
      currentStoryDomain.value = 'idol_story'
      currentStoryMode.value = 'portal'
      currentStorySection.value = ''
      currentEpisodeId.value = ''
      currentCharacterId.value = idolCode
      currentMobileScenarioId.value = ''
      commitView('idol_story_archive')
    }).catch(error => {
      if (request !== pendingIdolStoryNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[IdolStoryReadModel] Failed to open idol:', error)
      idolStoryReadModelStatus.value = '个人故事暂时无法读取，请重试。'
    })
  }

  function selectIdolStory(idolCode) {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
    const request = ++pendingIdolStoryNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    idolStoryReadModelStatus.value = '正在切换个人故事…'
    loading.value = true
    return prepareArchivePage('idol_story_archive', loadIdolStoryDetail(idolCode)).then(detail => {
      if (request !== pendingIdolStoryNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      idolStoryReadModelDetail.value = detail
      idolStoryReadModelStatus.value = ''
      currentCharacterId.value = idolCode
      currentStorySection.value = ''
      currentEpisodeId.value = ''
      currentMobileScenarioId.value = ''
      commitArchiveSelection()
    }).catch(error => {
      if (request !== pendingIdolStoryNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[IdolStoryReadModel] Failed to switch idol:', error)
      idolStoryReadModelStatus.value = '个人故事切换失败，请重试。'
    })
  }

  async function openBirthdayIdolStory(relation) {
    if (!relation?.idolCode || !archiveBootstrap.idols.some(idol => idol.id === relation.idolCode)) return
    return navigation.run(async intent => {
      const detail = await loadIdolStoryDetail(relation.idolCode)
      if (!intent.isCurrent()) return
      if (!detail.view.page) return
      idolStoryReadModelDetail.value = detail
      captureDetailSource()
      currentStoryDomain.value = 'idol_story'
      currentStoryMode.value = 'portal'
      currentCharacterId.value = relation.idolCode
      currentStorySection.value = String(relation.sectionId || '')
      currentEpisodeId.value = String(relation.episodeId || '')
      currentStoryFile.value = ''
      storyCollectionParentView.value = ''
      commitView('idol_story_archive')
    })
  }

  function openIdolBirthdayArchive() {
    if (!currentCharacterId.value) return
    return openProjectedCollection({ domain: 'birthday', section: currentCharacterId.value,
      parent: 'idol_story_archive' })
  }

  function playIdolStorySection(section) {
    const queue = (section?.episodes || []).filter(episode => episode.exists && episode.file)
    if (queue.length) startEpisodeQueue(queue, 0, 'idol_story_archive')
  }

  function playIdolStoryEpisode({ section, episode }) {
    const queue = (section?.episodes || []).filter(candidate => candidate.exists && candidate.file)
    const index = queue.findIndex(candidate => candidate.id === episode?.id)
    if (index >= 0) startEpisodeQueue(queue, index, 'idol_story_archive')
  }

  async function openMobileIdolStory(episodeId) {
    const refs = currentMobileMode.value === 'unit' ? mobileUnitReadModelDetail.value?.view?.episodeRefs : mobileIdolReadModelDetail.value?.view?.episodeRefs
    const relation = (refs || []).find(entry => Number(entry.id) === Number(episodeId))
    if (!relation) return
    if (!relation.idolCode) return
    const revision = navigation.getRevision()
    let detail
    try { detail = await loadIdolStoryDetail(relation.idolCode) }
    catch (error) {
      if (revision !== navigation.getRevision()) return
      console.error('[IdolStoryReadModel] Failed to open mobile relation:', error)
      idolStoryReadModelStatus.value = '个人故事暂时无法读取，请重试。'
      return
    }
    if (revision !== navigation.getRevision() || navigation.isDisposed()) return
    idolStoryReadModelDetail.value = detail
    captureDetailSource()
    currentStoryDomain.value = 'idol_story'
    currentStoryMode.value = 'portal'
    currentCharacterId.value = relation.idolCode
    currentStorySection.value = String(relation.sectionId)
    currentEpisodeId.value = String(episodeId)
    currentMobileScenarioId.value = ''
    commitView('idol_story_archive')
  }

  function goBackFromSeasonalCampaign() {
    currentStoryDomain.value = ''
    currentStorySection.value = ''
    return openStoryCatalog()
  }

  function goBackFromWorkArchive() {
    currentStoryDomain.value = ''
    currentCharacterId.value = ''
    return openStoryCatalog()
  }

  function goBackFromIdolStoryArchive() {
    currentCharacterId.value = ''
    return openStoryCatalog()
  }

  function invalidateStoryArchiveNavigation() {
    ++pendingSeasonalNavigation
    ++pendingWorkNavigation
    ++pendingIdolStoryNavigation
  }

  async function prepareStoryArchiveRoute(route, { isCurrent }) {
    if (route.view === 'seasonal_campaign' || (route.view === 'player' && route.returnView === 'seasonal_campaign')) {
      try {
        const detail = await loadSeasonalDetail(route.storySection)
        if (!isCurrent()) return null
        seasonalReadModelDetail.value = detail
        route = { ...route, storySection: detail.id }
        seasonalReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[SeasonalReadModel] Failed to restore campaign:', error)
        seasonalReadModelStatus.value = '季节企划暂时无法读取，请稍后重试。'
        route = { view: 'portal' }
      }
    }
    if ((route.view === 'work_archive' || (route.view === 'player' && route.returnView === 'work_archive')) && route.idol) {
      try {
        const detail = await loadWorkDetail(route.idol)
        if (!isCurrent()) return null
        workReadModelDetail.value = detail
        workReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[WorkReadModel] Failed to restore idol:', error)
        workReadModelStatus.value = '工作档案暂时无法读取，请稍后重试。'
        route = { view: 'idol_picker', pickTarget: 'work' }
      }
    }
    if ((route.view === 'idol_story_archive' || (route.view === 'player' && route.returnView === 'idol_story_archive')) && route.idol) {
      try {
        const detail = await loadIdolStoryDetail(route.idol)
        if (!isCurrent()) return null
        idolStoryReadModelDetail.value = detail
        idolStoryReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[IdolStoryReadModel] Failed to restore idol:', error)
        idolStoryReadModelStatus.value = '个人故事暂时无法读取，请稍后重试。'
        route = { view: 'idol_picker', pickTarget: 'story' }
      }
    }
    return isCurrent() ? route : null
  }

  return {
    currentSeasonalCampaign, currentWorkIdol, idolStoryOptions, currentIdolStoryPage,
    openSeasonalCampaign, selectSeasonalCampaign, playSeasonalCampaignStory,
    openWorkArchive, selectWorkIdol, setWorkMode, playWorkStory,
    openIdolStoryArchive, selectIdolStory, openBirthdayIdolStory, openIdolBirthdayArchive,
    playIdolStorySection, playIdolStoryEpisode, openMobileIdolStory,
    loadSeasonalCatalog, loadSeasonalDetail, loadWorkCatalog, loadWorkDetail, loadIdolStoryCatalog, loadIdolStoryDetail,
    goBackFromSeasonalCampaign, goBackFromWorkArchive, goBackFromIdolStoryArchive,
    invalidateStoryArchiveNavigation, prepareStoryArchiveRoute,
  }
}
