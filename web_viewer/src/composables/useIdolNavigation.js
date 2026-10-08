import { computed } from 'vue'

export function useIdolNavigation({
  idolReadModelCatalog, idolReadModelDetail, idolReadModelStatus, currentCharacterId,
  currentEventId, eventParentView, currentCategoryId, currentGroup,
  currentArchiveUnitCode, currentCardId, filterQuery, view,
  loading, currentIdolUnitFilter, navigation, archiveBootstrap,
  readModelClient, openIdolPicker, captureDetailSource, commitArchiveSelection,
  commitView, idolDisplayName,
}) {
  let pendingIdolNavigation = 0

  const currentIdolDetail = computed(() => idolReadModelDetail.value?.id === currentCharacterId.value
    ? idolReadModelDetail.value.view : null)

  const currentIdolProfile = computed(() => currentIdolDetail.value?.profile || null)

  const currentIdolDisplayName = computed(() => currentIdolProfile.value
    ? idolDisplayName(currentIdolProfile.value.idol_code, currentIdolProfile.value.display_name)
    : '')

  const currentIdolStats = computed(() => currentIdolDetail.value?.stats || {})

  const currentIdolEvents = computed(() => currentIdolDetail.value?.events || [])

  const currentIdolSongs = computed(() => currentIdolDetail.value?.songs || [])

  function openPrimaryIdol(idolCode = '') {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return openIdolPicker('profile')
    return openIdolReadModel(idolCode, { resetContext: true })
  }

  async function openIdolReadModel(idolCode, { captureSource = false, resetContext = false, selection = false, clearUnit = false, clearEventContext = false } = {}) {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
    const request = ++pendingIdolNavigation
    const revision = navigation.getRevision()
    idolReadModelStatus.value = '正在读取偶像档案…'
    loading.value = true
    let detail
    try {
      detail = await loadIdolDetail(idolCode)
    } catch (error) {
      if (request !== pendingIdolNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[IdolReadModel] Failed to load idol detail:', error)
      idolReadModelStatus.value = '偶像档案暂时无法读取，请重试。'
      return
    }
    if (request !== pendingIdolNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    idolReadModelDetail.value = detail
    idolReadModelStatus.value = ''
    if (captureSource) captureDetailSource()
    if (clearEventContext) { currentEventId.value = ''; eventParentView.value = '' }
    if (resetContext) {
      currentCategoryId.value = 'idol'
      currentGroup.value = null
    }
    if (clearUnit) currentArchiveUnitCode.value = ''
    currentCharacterId.value = idolCode
    currentCardId.value = ''
    filterQuery.value = ''
    if (selection && view.value === 'idol_detail') commitArchiveSelection()
    else commitView('idol_detail')
  }

  function openIdolDirectory() {
    filterQuery.value = ''
    currentCategoryId.value = 'idol'
    currentCharacterId.value = ''
    currentIdolUnitFilter.value = ''
    currentGroup.value = null
    currentCardId.value = ''
    commitView('idols')
  }

  function selectPrimaryIdol(idolCode) {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
    return openIdolReadModel(idolCode, { selection: true })
  }

  async function loadIdolCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (idolReadModelCatalog.value) return idolReadModelCatalog.value
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.idols, options)
        const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
        const rows = pages.flatMap(page => page.rows || [])
        if (rows.length !== index.count || rows.length !== archiveBootstrap.idols.length ||
          rows.some((row, position) => row.id !== archiveBootstrap.idols[position].id ||
            row.name !== archiveBootstrap.idols[position].name || !row.detail))
          throw new Error('Idol catalog does not match inline bootstrap')
        options.signal?.throwIfAborted()
        idolReadModelCatalog.value = Object.fromEntries(rows.map(row => [row.id, row]))
        return idolReadModelCatalog.value
    })()
  }

  async function loadIdolDetail(idolCode, options = navigation.getLoadOptions?.() || {}) {
    const row = (await loadIdolCatalog(options))[idolCode]
    if (!row) throw new Error(`Unavailable idol: ${idolCode}`)
    return readModelClient.load({...row.detail,expectedId: idolCode}, { ...options, expectedId: idolCode, validate: data => {
      if (data.view?.profile?.idol_code !== idolCode || !data.view?.stats ||
        !Array.isArray(data.view?.events) || !Array.isArray(data.view?.songs))
        throw new Error('Idol detail identity or shape mismatch')
    } })
  }

  function handleIdolDetailChange([nextView, idolCode]) {
    if (nextView !== 'idol_detail' || !idolCode || idolReadModelDetail.value?.id === idolCode) return
    const request = ++pendingIdolNavigation
    const revision = navigation.getRevision()
    idolReadModelStatus.value = '正在读取偶像档案…'
    loadIdolDetail(idolCode).then(detail => {
      if (request !== pendingIdolNavigation || revision !== navigation.getRevision() ||
        navigation.isDisposed() || view.value !== 'idol_detail' || currentCharacterId.value !== idolCode) return
      idolReadModelDetail.value = detail
      idolReadModelStatus.value = ''
    }).catch(error => {
      if (request !== pendingIdolNavigation || revision !== navigation.getRevision() ||
        view.value !== 'idol_detail' || currentCharacterId.value !== idolCode) return
      console.error('[IdolReadModel] Failed to restore idol detail:', error)
      idolReadModelStatus.value = '偶像档案暂时无法读取，请返回后重试。'
    })
  }

  async function prepareIdolRoute(route, { isCurrent }) {
    if (route.view === 'idol_detail' && route.idol) {
      if (!archiveBootstrap.idols.some(idol => idol.id === route.idol)) {
        route = { view: 'idol_picker', pickTarget: 'profile' }
      } else {
        try {
          const detail = await loadIdolDetail(route.idol)
          if (!isCurrent()) return null
          idolReadModelDetail.value = detail
          idolReadModelStatus.value = ''
        } catch (error) {
          if (!isCurrent()) return null
          console.error('[IdolReadModel] Failed to restore idol detail:', error)
          idolReadModelStatus.value = '偶像档案暂时无法读取，请重新选择。'
          route = { view: 'idols', category: 'idol' }
        }
      }
    }
    return route
  }

  function invalidateIdolNavigation() { ++pendingIdolNavigation }

  return {
    openPrimaryIdol, openIdolReadModel, openIdolDirectory, selectPrimaryIdol,
    loadIdolCatalog, loadIdolDetail, currentIdolDetail, currentIdolProfile,
    currentIdolDisplayName, currentIdolStats, currentIdolEvents, currentIdolSongs,
    handleIdolDetailChange, prepareIdolRoute, invalidateIdolNavigation,
  }
}
