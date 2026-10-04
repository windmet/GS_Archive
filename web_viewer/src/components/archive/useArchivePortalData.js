import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { buildPortalDesktopOverview, buildPortalSearchResults, PORTAL_SEARCH_DOMAINS, portalSearchPageDescriptors, validatePortalSearchRows } from '../../presentation/ArchivePortalPresentation.js'

// Portal data is independent of catalogue filters and never owns a player detail.
export function useArchivePortalData({ view, bootstrap, client, preferredIdol, scope = ref(''), searchQuery = ref(''),
  loadCards, loadSongs, loadIdol, loadStories, loadEvents, loadCollections, loadStageManifest, loadPortraits, loadEventDetail, loadUnits, loadCardFacets, loadGatewayCounts,
  idolName, idolSearch, cardTitle, cardSearch, songTitle }) {
  const desktop = ref(false), cards = shallowRef([]), songs = shallowRef([])
  const preferredDetail = shallowRef(null), loading = ref(false), error = ref('')
  const stories = shallowRef([]), events = shallowRef([]), stageManifest = shallowRef(null)
  const query = searchQuery, searchLoading = ref(false), searchError = ref('')
  const rowsByDomain = shallowRef({})
  let media, mediaListener, disposed = false, revision = 0, searchRevision = 0, timer, searchController
  // An empty scope follows the favorite; 'all' explicitly selects the whole archive.
  const eventDetails = shallowRef([])
  const portraits = shallowRef(null), available = shallowRef({}), storyCollections = shallowRef([])
  const units = shallowRef([]), cardFacets = shallowRef(null), gatewayCounts = shallowRef({})
  const scopeIdol = computed(() => scope.value === '' ? preferredIdol.value : bootstrap.idols.find(row => row.id === scope.value) || null)
  const preferredCode = computed(() => scopeIdol.value?.id || '')
  function selectScope(code) {
    if (code !== '' && !bootstrap.idols.some(row => row.id === code)) return
    scope.value = code || 'all'
  }
  const overview = computed(() => buildPortalDesktopOverview({ bootstrap, cards: cards.value,
    songs: songs.value, stories: stories.value, events: events.value, stageManifest: stageManifest.value,
    preferredIdol: scopeIdol.value,
    preferredDetail: preferredDetail.value?.id === preferredCode.value && preferredDetail.value?.view?.profile?.idol_code === preferredCode.value ? preferredDetail.value : null,
    idolName, cardTitle, songTitle, storyCollections: storyCollections.value, portraits: portraits.value, eventDetails: eventDetails.value, available: available.value, loading: loading.value, error: error.value, units:units.value,cardFacets:cardFacets.value,gatewayCounts:gatewayCounts.value }))
  const search = computed(() => ({ query: query.value, loading: searchLoading.value,
    error: searchError.value, results: buildPortalSearchResults({ query: query.value,
      rowsByDomain: rowsByDomain.value, bootstrap, idolName, idolSearch, cardTitle, cardSearch, songTitle }) }))
  async function refresh() {
    if (view.value !== 'portal' || !desktop.value || disposed) return
    const ticket = ++revision, code = preferredCode.value
    loading.value = true; error.value = ''; preferredDetail.value = null; eventDetails.value = []
    const results = await Promise.allSettled([
      loadCards(), loadSongs(), code ? loadIdol(code).then(detail => {
        if (detail?.id !== code || detail.view?.profile?.idol_code !== code) throw Error('Portal preferred owner mismatch')
        return detail
      }) : Promise.resolve(null),
      loadStories ? loadStories() : Promise.resolve([]),
      loadEvents ? loadEvents() : Promise.resolve([]),
      loadStageManifest ? loadStageManifest() : Promise.resolve(null),
      loadPortraits ? loadPortraits() : Promise.resolve(null),
      loadCollections ? loadCollections() : Promise.resolve([]),
      loadUnits ? loadUnits() : Promise.resolve([]),
      loadCardFacets ? loadCardFacets() : Promise.resolve(null),
      loadGatewayCounts ? loadGatewayCounts() : Promise.resolve({}),
    ])
    if (disposed || ticket !== revision || view.value !== 'portal' || !desktop.value) return
    if (results[0].status === 'fulfilled') cards.value = results[0].value
    if (results[1].status === 'fulfilled') songs.value = Object.values(results[1].value?.songs || {})
    if (results[2].status === 'fulfilled' && preferredCode.value === code) preferredDetail.value = results[2].value
    if (results[3].status === 'fulfilled') stories.value = results[3].value
    if (results[4].status === 'fulfilled') events.value = results[4].value
    if (results[5].status === 'fulfilled') stageManifest.value = results[5].value
    if (results[6].status === 'fulfilled') portraits.value = results[6].value
    if (results[7].status === 'fulfilled') storyCollections.value = results[7].value
    if (results[8].status === 'fulfilled') units.value = results[8].value
    if (results[9].status === 'fulfilled') cardFacets.value = results[9].value
    if (results[10].status === 'fulfilled') gatewayCounts.value = results[10].value
    available.value = Object.fromEntries([['cards',0],['songs',1],['stories',3],['events',4]].map(([key,index]) => [key, results[index].status === 'fulfilled']))
    error.value = results.every(result => result.status === 'fulfilled') ? '' : '部分资料暂时无法读取，已保留可用内容。'
    loading.value = false
    // Optional preview enrichment stays bound to the current lens and never blocks core counts.
    if (code && loadEventDetail) {
      const ids = overview.value.events.map(row => row.id)
      const details = await Promise.allSettled(ids.map(id => loadEventDetail(id)))
      if (disposed || ticket !== revision || view.value !== 'portal' || preferredCode.value !== code) return
      eventDetails.value = details.filter(row => row.status === 'fulfilled').map(row => row.value)
    }
  }
  async function loadSearch(ticket) {
    searchController?.abort(); searchController = new AbortController()
    const signal = searchController.signal
    searchLoading.value = true; searchError.value = ''
    try {
      const entries = await Promise.all(PORTAL_SEARCH_DOMAINS.map(async domain => {
        const index = await client.load(bootstrap.domains[domain], { signal, priority: 'background' })
        const descriptors = portalSearchPageDescriptors(bootstrap, domain, index)
        const pages = await Promise.all(descriptors.map(descriptor => client.load(descriptor, { signal, priority: 'background' })))
        const rows = pages.flatMap(page => page.rows || [])
        validatePortalSearchRows(domain, rows, bootstrap, { expectedCount: index.searchCount })
        return [domain, rows]
      }))
      if (disposed || ticket !== searchRevision) return
      rowsByDomain.value = Object.fromEntries(entries)
    } catch (cause) {
      if (disposed || signal.aborted || ticket !== searchRevision) return
      searchError.value = '搜索资料暂时无法读取，请重试。'
    } finally { if (!disposed && ticket === searchRevision) searchLoading.value = false }
  }
  function updateSearch(value) {
    const next = String(value || '').slice(0, 120)
    if (next === query.value && searchError.value && next.trim()) { void loadSearch(++searchRevision); return }
    query.value = next
  }
  watch(query, value => {
    const ticket = ++searchRevision
    clearTimeout(timer); searchController?.abort()
    searchLoading.value = false; searchError.value = ''
    if (!value.trim() || Object.keys(rowsByDomain.value).length === PORTAL_SEARCH_DOMAINS.length) return
    if (view.value !== 'portal' || !desktop.value) return
    searchLoading.value = true
    timer = setTimeout(() => { void loadSearch(ticket) }, 220)
  })
  watch([view, desktop, preferredCode], () => {
    ++revision
    if (view.value === 'portal' && desktop.value) {
      void refresh()
      if (query.value.trim() && Object.keys(rowsByDomain.value).length !== PORTAL_SEARCH_DOMAINS.length) {
        clearTimeout(timer)
        searchLoading.value = true
        timer = setTimeout(() => { void loadSearch(++searchRevision) }, 220)
      }
    }
    else { loading.value = false; clearTimeout(timer); ++searchRevision; searchController?.abort(); searchLoading.value = false }
  })
  onMounted(() => {
    media = window.matchMedia('(min-width: 761px)')
    mediaListener = () => { desktop.value = media.matches }
    mediaListener(); media.addEventListener('change', mediaListener)
  })
  onBeforeUnmount(() => {
    disposed = true; ++revision; ++searchRevision; clearTimeout(timer); searchController?.abort()
    media?.removeEventListener('change', mediaListener)
  })
  return { scopeIdol, selectScope, overview, search, updateSearch, refresh }
}
