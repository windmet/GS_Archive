import { createPortalRepository, portalDisplayOverview } from '../../data/PortalRepository.js'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { buildPortalDesktopOverview, buildPortalSearchResults, PORTAL_SEARCH_DOMAINS, portalSearchPageDescriptors, validatePortalSearchRows } from '../../presentation/ArchivePortalPresentation.js'

// Portal data is independent of catalogue filters and never owns a player detail.
export function useArchivePortalData({ view, bootstrap, client, preferredIdol, scope = ref(''), searchQuery = ref(''),
  loadCards,
  idolName, idolSearch, cardTitle, cardSearch, songTitle }) {
  const loading = ref(false), error = ref('')
  const query = searchQuery, searchLoading = ref(false), searchError = ref('')
  const rowsByDomain = shallowRef({})
  let disposed = false, revision = 0, searchRevision = 0, timer, searchController
  // An empty scope follows the favorite; 'all' explicitly selects the whole archive.
  const scopeIdol = computed(() => scope.value === '' ? preferredIdol.value : bootstrap.idols.find(row => row.id === scope.value) || null)
  const preferredCode = computed(() => scopeIdol.value?.id || '')
  function selectScope(code) {
    if (code !== '' && !bootstrap.idols.some(row => row.id === code)) return
    scope.value = code || 'all'
  }
  const repository = createPortalRepository({bootstrap,client})
  const projection = shallowRef(null)
  let overviewController
  const overview = computed(() => ({...portalDisplayOverview(projection.value, {idolName,cardTitle}),
    loading:loading.value,error:error.value}))
  const search = computed(() => ({ query: query.value, loading: searchLoading.value,
    error: searchError.value, results: buildPortalSearchResults({ query: query.value,
      rowsByDomain: rowsByDomain.value, bootstrap, idolName, idolSearch, cardTitle, cardSearch, songTitle }) }))
  function stopOverview() { ++revision; overviewController?.abort(); overviewController = null }
  async function refresh() {
    stopOverview()
    if (view.value !== 'portal' || disposed) return
    const ticket = revision, code = preferredCode.value
    const owner = overviewController = new AbortController()
    projection.value = null; loading.value = true; error.value = ''
    try {
      const data = await repository.loadScope(code || 'all', {signal:owner.signal,priority:'foreground'})
      if (disposed || owner.signal.aborted || ticket !== revision) return
      projection.value = data.overview
    } catch (cause) {
      if (disposed || owner.signal.aborted || ticket !== revision) return
      error.value = '门户资料暂时无法读取，可直接进入各目录或重试。'
    } finally { if (!disposed && ticket === revision) loading.value = false }
  }
  async function expandCardPool() {
    const ticket = revision, owner = overviewController
    if (!projection.value || !owner || owner.signal.aborted) return
    try {
      const rows = await loadCards({signal:owner.signal,priority:'background'})
      if (disposed || ticket !== revision || owner.signal.aborted) return
      const selected = preferredCode.value ? rows.filter(row => row.character_id === preferredCode.value) : rows
      const pool = buildPortalDesktopOverview({bootstrap,cards:selected,cardTitle,idolName}).collections.cards
        .map(row => ({...row,attribute:rows.find(source => source.resource_id === row.id)?.attribute || ''}))
      projection.value = {...projection.value,collections:{...projection.value.collections,cards:pool}}
    } catch (cause) { if (!owner.signal.aborted && ticket === revision) error.value = '卡面探索暂时无法读取，请重试。' }
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
    if (view.value !== 'portal') return
    searchLoading.value = true
    timer = setTimeout(() => { void loadSearch(ticket) }, 220)
  })
  // One portal at every width: phones load the same overview as desktops.
  watch([view, preferredCode], () => {
    stopOverview()
    if (view.value === 'portal') {
      void refresh()
      if (query.value.trim() && Object.keys(rowsByDomain.value).length !== PORTAL_SEARCH_DOMAINS.length) {
        clearTimeout(timer)
        searchLoading.value = true
        timer = setTimeout(() => { void loadSearch(++searchRevision) }, 220)
      }
    }
    else { projection.value = null; rowsByDomain.value = {}; loading.value = false; clearTimeout(timer); ++searchRevision; searchController?.abort(); searchLoading.value = false }
  })
  onMounted(() => { if (view.value === 'portal') void refresh() })
  onBeforeUnmount(() => {
    disposed = true; stopOverview(); ++searchRevision; clearTimeout(timer); searchController?.abort()
  })
  return { scopeIdol, selectScope, overview, search, updateSearch, refresh, expandCardPool }
}
