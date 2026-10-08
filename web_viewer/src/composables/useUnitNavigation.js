import { computed } from 'vue'

export function useUnitNavigation({
  unitReadModelCatalog, unitReadModelDetail, unitReadModelStatus, currentArchiveUnitCode,
  currentEventId, eventParentView, currentCategoryId, currentCharacterId,
  loading, navigation, archiveBootstrap, readModelClient,
  prepareArchivePage, captureDetailSource, commitView, openIdolReadModel,
  loadScenario, openEventDetail,
}) {
  let pendingUnitNavigation = 0

  const unitCatalogEntries = computed(() => (unitReadModelCatalog.value || []).map(row => row.catalog))

  const currentArchiveUnit = computed(() => {
    const projected = unitReadModelDetail.value?.view.entry.unit
    if (projected && [String(projected.unit_id), projected.unit_code].includes(currentArchiveUnitCode.value)) return projected
    return unitCatalogEntries.value.find(entry =>
      [String(entry.unit.unit_id), entry.unit.unit_code].includes(currentArchiveUnitCode.value))?.unit || null
  })

  const currentArchiveUnitEntry = computed(() => unitReadModelDetail.value?.view.entry.unit === currentArchiveUnit.value
    ? unitReadModelDetail.value.view.entry
    : unitCatalogEntries.value.find(entry =>
    String(entry.unit.unit_id) === String(currentArchiveUnit.value?.unit_id || ''),
  ) || null)

  const currentArchiveUnitMembers = computed(() => currentArchiveUnitEntry.value?.members || [])

  const currentArchiveUnitStories = computed(() => unitReadModelDetail.value?.view.entry.unit === currentArchiveUnit.value
    ? unitReadModelDetail.value.view.stories : [])

  const currentArchiveUnitSongs = computed(() => unitReadModelDetail.value?.view.entry.unit === currentArchiveUnit.value
    ? unitReadModelDetail.value.view.songs : [])

  function openArchiveUnit(unit, { clearEventContext = false } = {}) {
    if (!unit) return
    const code = String(unit.unit_code || unit.unit_id || '')
    const request = ++pendingUnitNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    unitReadModelStatus.value = '正在读取组合详情…'
    loading.value = true
    return prepareArchivePage('unit_detail', loadUnitDetail(code)).then(detail => {
      if (request !== pendingUnitNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      unitReadModelDetail.value = detail
      unitReadModelStatus.value = ''
      captureDetailSource()
      if (clearEventContext) { currentEventId.value = ''; eventParentView.value = '' }
      currentCategoryId.value = 'idol'
      currentCharacterId.value = ''
      currentArchiveUnitCode.value = detail.view.entry.unit.unit_code
      commitView('unit_detail')
    }).catch(error => {
      if (request !== pendingUnitNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[UnitReadModel] Failed to load unit detail:', error)
      unitReadModelStatus.value = '组合详情暂时无法读取，请重试。'
    })
  }

  function openUnitFromIdol(idol) {
    if (idol?.unit_code) return openArchiveUnit({ unit_code: idol.unit_code })
  }

  function openUnitMember(member) {
    return openIdolReadModel(member.idol_code, { captureSource: true, resetContext: true, clearUnit: true })
  }

  function openUnitStory(story) {
    if (story?.file && story.exists) return loadScenario(story.file, 'unit_detail')
  }

  function openUnitEvent(event) {
    return openEventDetail(event, 'unit_detail')
  }

  async function loadUnitCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (unitReadModelCatalog.value) return unitReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.units, options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        const expected = [...new Set(archiveBootstrap.idols.map(idol => idol.unitId))]
        if (rows.length !== index.count || rows.length !== expected.length ||
          rows.some((row, position) => row.id !== expected[position] ||
            String(row.catalog?.unit?.unit_id) !== row.id || !row.catalog?.members ||
            !row.catalog?.cardStats || !row.detail))
          throw new Error('Unit catalog does not match inline bootstrap')
        options.signal?.throwIfAborted()
        unitReadModelCatalog.value = rows
        return rows
    })()
  }

  async function loadUnitDetail(unitCode, options = navigation.getLoadOptions?.() || {}) {
    const rows = await loadUnitCatalog(options)
    const row = rows.find(entry => entry.id === unitCode || entry.catalog.unit.unit_code === unitCode)
    if (!row) throw new Error(`Unavailable unit: ${unitCode}`)
    return readModelClient.load({...row.detail,expectedId: row.id}, { ...options, expectedId: row.id, validate: data => {
      if (String(data.view?.entry?.unit?.unit_id) !== row.id ||
        !Array.isArray(data.view?.entry?.members) || !data.view?.entry?.cardStats ||
        !Array.isArray(data.view?.stories) || !Array.isArray(data.view?.songs))
        throw new Error('Unit detail identity or shape mismatch')
    } })
  }

  async function prepareUnitRoute(route, { isCurrent }) {
    if (route.view === 'unit_catalog' || route.view === 'unit_detail' ||
        (route.view === 'player' && route.returnView === 'unit_detail')) {
      try {
        if (route.view === 'unit_catalog') {
          await loadUnitCatalog()
          if (!isCurrent()) return null
        } else {
          const detail = await loadUnitDetail(route.unit)
          if (!isCurrent()) return null
          unitReadModelDetail.value = detail
        }
        unitReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[UnitReadModel] Failed to restore unit route:', error)
        unitReadModelStatus.value = '组合资料暂时无法读取，请稍后重试。'
        route = { view: 'idols', category: 'idol' }
      }
    }
    return route
  }

  function invalidateUnitNavigation() { ++pendingUnitNavigation }

  return {
    openArchiveUnit, openUnitFromIdol, openUnitMember, openUnitStory,
    openUnitEvent, loadUnitCatalog, loadUnitDetail, unitCatalogEntries,
    currentArchiveUnit, currentArchiveUnitEntry, currentArchiveUnitMembers, currentArchiveUnitStories,
    currentArchiveUnitSongs, prepareUnitRoute, invalidateUnitNavigation,
  }
}
