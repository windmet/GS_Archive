import { computed } from 'vue'
import { entityDescriptor } from '../../readmodels/runtime/ReadModelClient.mjs'

export function useLegacyAliasNavigation({
  legacyGroupReadModelDetail, legacyFileReadModelDetail, legacyEpisodeReadModelDetail, legacyZeroReadModelDetail,
  legacyAliasStatus, currentCharacterId, currentCategoryId, currentPickTarget,
  currentGroup, currentUnit, currentEpisodeId, currentCardId,
  filterQuery, detailSourceRoute, navigation, archiveBootstrap,
  readModelClient, captureDetailSource, commitView, goHome,
  loadScenario, openIdolReadModel,
}) {
  const filteredGroups = computed(() => {
    const aliasId = currentCharacterId.value ? `${currentCategoryId.value}:${currentCharacterId.value}` : currentCategoryId.value
    if (legacyGroupReadModelDetail.value?.id !== aliasId) return []
    const groups = legacyGroupReadModelDetail.value.view.groups
    const q = filterQuery.value.toLowerCase()
    return q ? groups.filter(group => group.title.toLowerCase().includes(q) || group.id.toLowerCase().includes(q)) : groups
  })

  const groupTitle = computed(() => {
    const aliasId = currentCharacterId.value ? `${currentCategoryId.value}:${currentCharacterId.value}` : currentCategoryId.value
    return legacyGroupReadModelDetail.value?.id === aliasId ? legacyGroupReadModelDetail.value.view.title : ''
  })

  const episodeZeroUnits = computed(() => {
    return legacyZeroReadModelDetail.value?.id === 'episode_zero' ? legacyZeroReadModelDetail.value.view.units : []
  })

  const filteredFileEntries = computed(() => {
    if (!currentGroup.value) return []
    if (legacyFileReadModelDetail.value?.id !== String(currentGroup.value.id)) return []
    const entries = legacyFileReadModelDetail.value.view.entries
    const q = filterQuery.value.toLowerCase()
    return q ? entries.filter(entry => entry.searchText.toLowerCase().includes(q)) : entries
  })

  let pendingLegacyAliasNavigation = 0

  async function openGroup(group) {
    const request = ++pendingLegacyAliasNavigation
    const revision = navigation.getRevision()
    let detail
    try { detail = await loadLegacyAliasDetail('legacy-files', String(group.id)) }
    catch (error) {
      if (request === pendingLegacyAliasNavigation && revision === navigation.getRevision()) {
        console.error('[LegacyAliasReadModel] Failed to open files:', error)
        legacyAliasStatus.value = '剧情文件暂时无法读取，请重试。'
      }
      return
    }
    if (request !== pendingLegacyAliasNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    captureDetailSource()
    legacyFileReadModelDetail.value = detail
    legacyAliasStatus.value = ''
    currentGroup.value = detail.view.group
    currentEpisodeId.value = ''
    filterQuery.value = ''
    commitView('files')
  }

  function openScenarioEntry(entry) {
    if (entry?.file && !entry.missing) loadScenario(entry.file)
  }

  async function openUnit(unit) {
    const request = ++pendingLegacyAliasNavigation
    const revision = navigation.getRevision()
    let detail
    try { detail = await loadLegacyAliasDetail('legacy-episodes', unit.unit_code) }
    catch (error) {
      if (request === pendingLegacyAliasNavigation && revision === navigation.getRevision()) {
        console.error('[LegacyAliasReadModel] Failed to open episodes:', error)
        legacyAliasStatus.value = '组合前传目录暂时无法读取，请重试。'
      }
      return
    }
    if (request !== pendingLegacyAliasNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    captureDetailSource()
    legacyEpisodeReadModelDetail.value = detail
    legacyAliasStatus.value = ''
    currentUnit.value = detail.view.unit
    currentEpisodeId.value = ''
    filterQuery.value = ''
    commitView('episodes')
  }

  async function openEpisodeFiles(ep) {
    const request = ++pendingLegacyAliasNavigation
    const revision = navigation.getRevision()
    let detail
    try { detail = await loadLegacyAliasDetail('legacy-files', String(ep.id)) }
    catch (error) {
      if (request === pendingLegacyAliasNavigation && revision === navigation.getRevision()) {
        console.error('[LegacyAliasReadModel] Failed to open episode files:', error)
        legacyAliasStatus.value = '章节文件暂时无法读取，请重试。'
      }
      return
    }
    if (request !== pendingLegacyAliasNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    captureDetailSource()
    legacyFileReadModelDetail.value = detail
    legacyAliasStatus.value = ''
    currentGroup.value = detail.view.group
    currentEpisodeId.value = String(ep.id)
    filterQuery.value = ''
    commitView('files')
  }

  function goBackToUnits() {
    currentUnit.value = null
    currentEpisodeId.value = ''
    currentGroup.value = null
    commitView('episode_zero_units')
  }

  function goBackFromGroups() {
    if (currentCharacterId.value) {
      if (currentCategoryId.value === 'idol') openIdolReadModel(currentCharacterId.value)
      else if (['idol_chat', 'idol_phone'].includes(currentCategoryId.value)) returnToMobilePicker()
      else {
        currentCharacterId.value = ''
        commitView('idols')
      }
    } else {
      goHome()
    }
  }

  function returnToMobilePicker() {
    detailSourceRoute.value = ''
    currentCharacterId.value = ''
    currentCategoryId.value = ''
    currentGroup.value = null
    currentPickTarget.value = 'mobile'
    commitView('idol_picker')
  }

  function goBackToFiles() {
    if (currentUnit.value) {
      currentGroup.value = null
      currentEpisodeId.value = ''
      commitView('episodes')
    } else if (currentCategoryId.value === 'cards' && currentCardId.value) {
      commitView('card_detail')
    } else if (currentCategoryId.value === 'cards') {
      commitView('cards')
    } else if (currentCharacterId.value) {
      currentGroup.value = null
      commitView('groups')
    } else {
      currentGroup.value = null
      commitView('groups')
    }
  }

  async function loadLegacyAliasDetail(domain, id, options = navigation.getLoadOptions?.() || {}) {
    const descriptor = await entityDescriptor(archiveBootstrap, domain, id, `${domain}.detail`)
    return readModelClient.load({...descriptor,expectedId:id}, { ...options, expectedId: id, validate: data => {
      const view = data.view
      if (domain === 'legacy-groups' && (!view?.title || !Array.isArray(view.groups)) ||
        domain === 'legacy-files' && (!view?.group || !Array.isArray(view.entries) || !view.sourceRoute) ||
        domain === 'legacy-episodes' && (!view?.unit || !Array.isArray(view.unit.episodes)) ||
        domain === 'legacy-zero' && !Array.isArray(view?.units))
        throw new Error(`${domain} alias shape mismatch`)
    } })
  }

  async function loadLegacyAliasRoute(route, options = navigation.getLoadOptions?.() || {}) {
    const owner = route.view === 'player' ? route.returnView : route.view
    if (owner === 'episode_zero_units') return { zero: await loadLegacyAliasDetail('legacy-zero', 'episode_zero', options) }
    if (owner === 'episodes') return { episode: await loadLegacyAliasDetail('legacy-episodes', route.unit, options) }
    if (owner === 'groups') {
      const id = route.idol ? `${route.category}:${route.idol}` : route.category
      return { groups: await loadLegacyAliasDetail('legacy-groups', id, options) }
    }
    if (owner !== 'files' || !route.group) return null
    const id = route.idol ? `${route.category}:${route.idol}` : route.category
    const [files, parent] = await Promise.all([
      loadLegacyAliasDetail('legacy-files', route.group, options),
      loadLegacyAliasDetail(route.category === 'episode_zero' ? 'legacy-episodes' : 'legacy-groups',
        route.category === 'episode_zero' ? route.unit : id, options),
    ])
    if (files.view.sourceRoute.categoryId !== route.category ||
      files.view.sourceRoute.ownerId !== (route.category === 'episode_zero' ? route.unit : route.idol || ''))
      throw new Error('Legacy file alias route context mismatch')
    return route.category === 'episode_zero' ? { files, episode: parent } : { files, groups: parent }
  }

  function publishLegacyAliasRoute(result) {
    if (!result) return
    if (result.groups) legacyGroupReadModelDetail.value = result.groups
    if (result.files) legacyFileReadModelDetail.value = result.files
    if (result.episode) legacyEpisodeReadModelDetail.value = result.episode
    if (result.zero) legacyZeroReadModelDetail.value = result.zero
  }

  function invalidateLegacyAliasNavigation() { ++pendingLegacyAliasNavigation }

  async function prepareLegacyAliasRoute(route, { isCurrent }) {
    if (['groups', 'files', 'episode_zero_units', 'episodes'].includes(route.view) ||
      (route.view === 'player' && ['groups', 'files', 'episode_zero_units', 'episodes'].includes(route.returnView))) {
      try {
        const alias = await loadLegacyAliasRoute(route)
        if (!isCurrent()) return null
        if (isCurrent()) {
          publishLegacyAliasRoute(alias)
          legacyAliasStatus.value = ''
        }
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[LegacyAliasReadModel] Failed to restore route:', error)
        legacyAliasStatus.value = '旧剧情目录暂时无法读取，请重试。'
        route = { view: route.category === 'episode_zero' ? 'episode_zero_units' : 'home' }
      }
    }
    return route
  }

  return {
    openGroup, openScenarioEntry, openUnit, openEpisodeFiles,
    goBackToUnits, goBackFromGroups, returnToMobilePicker, goBackToFiles,
    loadLegacyAliasDetail, loadLegacyAliasRoute, publishLegacyAliasRoute, filteredGroups,
    groupTitle, episodeZeroUnits, filteredFileEntries, prepareLegacyAliasRoute,
    invalidateLegacyAliasNavigation,
  }
}
