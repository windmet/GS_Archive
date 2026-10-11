import { hydrateHomeProfile } from '../../readmodels/runtime/hydrateHomeProfile.mjs'
import { buildArchiveUrl, readHomeReturnRoute, readPortalReturnRoute } from '../core/archiveRoute.js'

export function useHomeNavigation({
  homeReadModelIndex, homeReadModelProfiles, homeEntryStatus, view,
  loading, userPreferenceNotice, userPreferences, validArchiveHomeIdols,
  homeSelectedId, homeSelectedCue, homeSelectedCostume, homeFrom,
  portalFrom, detailSourceRoute, navigation, archiveBootstrap,
  readModelClient, currentArchiveRoute, openIdolPicker, commitView,
  captureActiveArchiveView, restoreRoute, syncArchiveRoute, window,
}) {
  const recentHomeProfiles = []

  let pendingHomeNavigation = 0

  const homeVisits = new Map()

  async function loadHomeIndex(options = navigation.getLoadOptions?.() || {}) {
    if (homeReadModelIndex.value) return homeReadModelIndex.value
    const index = await readModelClient.load(archiveBootstrap.domains.home, { ...options, validate: data => {
        const expected = archiveBootstrap.idols.filter(idol => idol.home_available).map(idol => idol.id)
        if (!Array.isArray(data.idols) || data.idols.length !== expected.length ||
          data.idols.some((idol, index) => idol.id !== expected[index]) ||
          !Array.isArray(data.stats) || !Array.isArray(data.highlights))
          throw new Error('Home index does not match inline bootstrap')
    } })
    options.signal?.throwIfAborted()
    homeReadModelIndex.value = index
    return index
  }

  async function loadHomeIdol(idolId, options = navigation.getLoadOptions?.() || {}) {
    if (homeReadModelProfiles.value[idolId]) {
      const previous = recentHomeProfiles.indexOf(idolId)
      if (previous >= 0) recentHomeProfiles.splice(previous, 1)
      recentHomeProfiles.push(idolId)
      return homeReadModelProfiles.value[idolId]
    }
    return (async () => {
      const index = await loadHomeIndex(options)
      const row = index.idols.find(idol => idol.id === idolId)
      if (!row) throw new Error(`Unavailable Home idol: ${idolId}`)
      const detail = await readModelClient.load(row.detail, { ...options, validate: data => {
        if (data.id !== idolId || data.profile?.id !== idolId || !Array.isArray(data.cueIndex))
          throw new Error('Home detail identity mismatch')
      } })
      const pageDescriptors = [...new Map(detail.cueIndex.map(cue => [cue.page.url, cue.page])).values()]
      const pages = await Promise.all(pageDescriptors.map(descriptor => readModelClient.load(descriptor, options)))
      const profile = hydrateHomeProfile(detail, pageDescriptors, pages)
      options.signal?.throwIfAborted()
      recentHomeProfiles.push(idolId)
      const profiles = { ...homeReadModelProfiles.value, [idolId]: profile }
      while (recentHomeProfiles.length > 3) delete profiles[recentHomeProfiles.shift()]
      homeReadModelProfiles.value = profiles
      return profile
    })()
  }

  async function openGameHome(idolCode = '') {
    if (view.value === 'home' && homeSelectedId.value) homeVisits.set(homeSelectedId.value, currentArchiveRoute())
    const candidate = [idolCode, userPreferences.value.startupIdol, userPreferences.value.preferredIdol]
      .find(code => validArchiveHomeIdols.value.includes(code)) || ''
    if (!candidate) return openIdolPicker('home')
    const source = view.value === 'portal' ? buildArchiveUrl(window.location.href, currentArchiveRoute()).search : ''
    const portalHome = portalFrom.value ? readPortalReturnRoute(portalFrom.value) : null
    const previous = homeVisits.get(candidate) || (portalHome?.view === 'home' && portalHome.homeIdol === candidate ? portalHome : null)
    navigation.invalidate()
    const request = ++pendingHomeNavigation
    const revision = navigation.getRevision()
    homeEntryStatus.value = '正在准备首页…'
    try {
      await loadHomeIdol(candidate)
    } catch (error) {
      if (request !== pendingHomeNavigation || revision !== navigation.getRevision()) return
      console.error('[HomeReadModel] Failed to open Home:', error)
      homeEntryStatus.value = '首页暂时无法打开，请重试。'
      userPreferenceNotice.value = homeEntryStatus.value
      return
    }
    if (request !== pendingHomeNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    homeEntryStatus.value = ''
    detailSourceRoute.value = ''
    portalFrom.value = ''
    homeSelectedId.value = candidate
    homeSelectedCue.value = previous?.homeCue || ''
    homeSelectedCostume.value = previous?.homeCostume || ''
    homeFrom.value = source
    commitView('home')
  }

  async function closeHomeVisit() {
    const destination = readHomeReturnRoute(homeFrom.value)
    if (!destination) return
    homeVisits.set(homeSelectedId.value, currentArchiveRoute())
    captureActiveArchiveView()
    await restoreRoute(destination)
    if (view.value === 'portal') syncArchiveRoute()
  }

  async function handleHomeIdolChange(idolId, previousId) {
    if (view.value !== 'home' || !idolId || homeReadModelProfiles.value[idolId]) return
    const request = ++pendingHomeNavigation
    homeEntryStatus.value = '正在准备首页偶像…'
    loading.value = true
    try {
      await loadHomeIdol(idolId)
      if (request !== pendingHomeNavigation || navigation.isDisposed()) return
      homeEntryStatus.value = ''
    } catch (error) {
      if (request !== pendingHomeNavigation || navigation.isDisposed()) return
      console.error('[HomeReadModel] Failed to switch idol:', error)
      homeEntryStatus.value = '首页偶像暂时无法读取，请重试。'
      if (previousId && homeReadModelProfiles.value[previousId]) homeSelectedId.value = previousId
    } finally {
      if (request === pendingHomeNavigation) loading.value = false
    }
  }

  function invalidateHomeNavigation() { ++pendingHomeNavigation }

  async function prepareHomeRoute(route, { isCurrent }) {
    if (route.view === 'home' && route.homeIdol) {
      try {
        await loadHomeIdol(route.homeIdol)
        if (!isCurrent()) return null
      } catch (error) {
        if (!isCurrent()) return null
        console.error('[HomeReadModel] Failed to restore Home:', error)
        userPreferenceNotice.value = '首页暂时无法读取，请重新选择偶像。'
        route = { view: 'welcome' }
      }
    }
    return route
  }

  return {
    loadHomeIndex, loadHomeIdol, openGameHome, closeHomeVisit,
    homeVisits, handleHomeIdolChange, prepareHomeRoute, invalidateHomeNavigation,
  }
}
