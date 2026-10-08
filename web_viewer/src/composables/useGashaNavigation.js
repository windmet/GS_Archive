import { computed } from 'vue'

export function useGashaNavigation({
  gashaReadModelCatalog, gashaReadModelDetail, gashaReadModelStatus, gashaCatalogFunctions,
  currentGashaId, currentGashaCategory, gashaParentView, currentStoryDomain,
  currentStoryCollection, cardReadModelCatalog, currentCategoryId, currentCharacterId,
  currentCardId, filterQuery, detailSourceRoute, view,
  loading, navigation, archiveBootstrap, readModelClient,
  prepareArchivePage, captureDetailSource, commitView, loadCardCatalog,
  openCard, idolEntitySearchText,
}) {
  let pendingGashaNavigation = 0

  const gashaCatalog = computed(() => gashaReadModelCatalog.value?.rows || [])

  const gashaCategoryOptions = computed(() => gashaCatalogFunctions.value?.buildGashaCategoryOptions(
    { meta: gashaReadModelCatalog.value?.summary }, gashaCatalog.value) || [])

  const filteredGashas = computed(() => gashaCatalogFunctions.value?.filterGashaCatalog(gashaCatalog.value, {
    query: filterQuery.value,
    category: currentGashaCategory.value,
    idolSearchText: idolEntitySearchText,
    nameSearchText: source => `${source} ${gashaCatalogFunctions.value?.translatedGashaName(source) || ''}`,
  }) || [])

  const currentGasha = computed(() => gashaReadModelDetail.value?.id === currentGashaId.value
    ? gashaReadModelDetail.value.gasha
    : null)

  function openGashaCatalog({preserveBrowse=false} = {}) {
    const request = ++pendingGashaNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    loading.value = true
    const pending = prepareArchivePage('gashas', loadGashaCatalog())
    gashaReadModelStatus.value = '正在读取卡池目录…'
    return pending.then(() => {
      if (request !== pendingGashaNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      gashaReadModelStatus.value = ''
      if (!preserveBrowse && view.value !== 'portal') detailSourceRoute.value = ''
      gashaParentView.value = ''
      if (!preserveBrowse) filterQuery.value = ''
      currentCategoryId.value = ''
      currentCharacterId.value = ''
      currentCardId.value = ''
      currentGashaId.value = ''
      if (!preserveBrowse) currentGashaCategory.value = 'all'
      commitView('gashas')
    }).catch(error => {
      if (request !== pendingGashaNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[GashaReadModel] Failed to load catalog:', error)
      gashaReadModelStatus.value = '卡池目录暂时无法读取，请重试。'
    })
  }

  function openGasha(gasha) {
    if (!gasha?.id) return
    const id = String(gasha.id)
    const request = ++pendingGashaNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    gashaReadModelStatus.value = '正在读取卡池详情…'
    loading.value = true
    return prepareArchivePage('gasha_detail', loadGashaDetail(id)).then(detail => {
      if (request !== pendingGashaNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      gashaReadModelDetail.value = detail
      gashaReadModelStatus.value = ''
      captureDetailSource()
      gashaParentView.value = view.value === 'story_collection' && currentStoryDomain.value === 'extra'
        ? 'story_collection' : ''
      const preserveCatalogQuery = view.value === 'gashas'
      currentCategoryId.value = ''
      currentCharacterId.value = ''
      currentCardId.value = ''
      currentGashaId.value = id
      if (!preserveCatalogQuery) filterQuery.value = ''
      commitView('gasha_detail')
    }).catch(error => {
      if (request !== pendingGashaNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[GashaReadModel] Failed to load detail:', error)
      gashaReadModelStatus.value = '卡池详情暂时无法读取，请重试。'
    })
  }

  function goBackFromGasha() {
    const returnsToCollection = gashaParentView.value === 'story_collection' && currentStoryCollection.value
    currentGashaId.value = ''
    gashaParentView.value = ''
    commitView(returnsToCollection ? 'story_collection' : 'gashas')
  }

  async function openGashaCard(relation) {
    if (!cardReadModelCatalog.value) await loadCardCatalog()
    const card = cardReadModelCatalog.value?.find(row => row.resource_id === relation?.card_resource_id)
    if (!card) return
    return openCard(card, { resetContext: true })
  }

  async function loadGashaCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (gashaReadModelCatalog.value) return gashaReadModelCatalog.value
    return (async () => {
        const [functions, tickets, index] = await Promise.all([
          import('../data/gashaCatalog.js'),
          import('../data/gashaTicketCatalog.js'),
          readModelClient.load(archiveBootstrap.domains.gashas, options),
        ])
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        if (rows.length !== index.count || rows.length !== archiveBootstrap.counts.primary_gashas ||
          new Set(rows.map(row => String(row.id))).size !== rows.length ||
          rows.some(row => row.phase !== 'primary' || !row.detail))
          throw new Error('Gasha catalog count or identity mismatch')
        const catalog = tickets.supplementGashaCatalog(rows,index.summary || {})
        options.signal?.throwIfAborted()
        gashaCatalogFunctions.value = {...functions,...tickets}
        options.signal?.throwIfAborted()
        gashaReadModelCatalog.value = catalog
        return catalog
    })()
  }

  async function loadGashaDetail(id, options = navigation.getLoadOptions?.() || {}) {
    const row = (await loadGashaCatalog(options)).rows.find(entry => String(entry.id) === id)
    if (!row) throw new Error(`Unavailable gasha: ${id}`)
    if(row.source_type==='item-masterdata')return {id,gasha:row}
    const detail = await readModelClient.load({...row.detail,expectedId: id}, { ...options, expectedId: id, validate: data => {
      if (String(data.gasha?.id) !== id || !Array.isArray(data.gasha?.derived_pickup_cards))
        throw new Error('Gasha detail identity or shape mismatch')
    } })
    return {...detail,gasha:gashaCatalogFunctions.value.attachGashaTickets(detail.gasha)}
  }

  async function prepareGashaRoute(route, { isCurrent }) {
    if (route.view === 'gashas' || route.view === 'gasha_detail') {
      try {
        if (route.view === 'gashas') {
          await loadGashaCatalog()
          if (!isCurrent()) return null
        } else {
          const detail = await loadGashaDetail(route.gasha)
          if (!isCurrent()) return null
          gashaReadModelDetail.value = detail
        }
        gashaReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[GashaReadModel] Failed to restore gasha route:', error)
        gashaReadModelStatus.value = '卡池资料暂时无法读取，请稍后重试。'
        route = { ...route, view: 'gashas', gasha: '' }
      }
    }
    return route
  }

  function invalidateGashaNavigation() { ++pendingGashaNavigation }

  return {
    openGashaCatalog, openGasha, goBackFromGasha, openGashaCard,
    loadGashaCatalog, loadGashaDetail, gashaCatalog, gashaCategoryOptions,
    filteredGashas, currentGasha, prepareGashaRoute, invalidateGashaNavigation,
  }
}
