import { buildPortalReturnQuery, readPortalReturnRoute } from '../core/archiveRoute.js'

export function usePortalNavigation({ view, homeSelectedId, homeVisits, currentArchiveRoute, archiveShellVisible,
  legacyEntryStatus, archiveBootstrap, portalScope, portalFrom, commitView, navigation, applyArchiveRoute, syncArchiveRoute,
  loadHomeIdol, loadIdolDetail, idolReadModelDetail, loadUnitCatalog, loadUnitDetail, unitReadModelDetail,
  loadGashaCatalog, loadGashaDetail, gashaReadModelDetail, loadCardCatalog, loadCardDetail, cardReadModelDetail,
  loadEventDetail, eventReadModelDetail, loadSeasonalDetail, seasonalReadModelDetail, loadWorkDetail, workReadModelDetail,
  loadIdolStoryDetail, idolStoryReadModelDetail, loadCollectionDetail, collectionReadModelDetail, loadStoryReadModelDetail, storyReadModelDetail,
  ensureSongCatalog, loadSongDetail, songReadModelDetail }) {
  function openArchivePortal(idolCode = '') {
    if (view.value === 'home' && homeSelectedId.value) homeVisits.set(homeSelectedId.value, currentArchiveRoute())
    if (!archiveShellVisible.value || view.value === 'portal') return
    legacyEntryStatus.value = ''
    const source = currentArchiveRoute()
    if (typeof idolCode === 'string' && archiveBootstrap.idols.some(row => row.id === idolCode)) portalScope.value = idolCode
    portalFrom.value = ['welcome', 'idol_picker'].includes(source.view) ||
      (source.view === 'home' && !source.homeIdol)
      ? ''
      : buildPortalReturnQuery(source)
    commitView('portal')
  }

  async function closeArchivePortal() {
    if (!portalFrom.value) return
    let route = readPortalReturnRoute(portalFrom.value)
    const beforeLoad = navigation.getRevision()
    if (route.view === 'home' && route.homeIdol) await loadHomeIdol(route.homeIdol)
    if (route.view === 'idol_detail' && route.idol) idolReadModelDetail.value = await loadIdolDetail(route.idol)
    if (route.view === 'unit_catalog') await loadUnitCatalog()
    if (route.view === 'unit_detail' && route.unit) unitReadModelDetail.value = await loadUnitDetail(route.unit)
    if (route.view === 'gashas') await loadGashaCatalog()
    if (route.view === 'gasha_detail' && route.gasha) gashaReadModelDetail.value = await loadGashaDetail(route.gasha)
    if (route.view === 'cards') await loadCardCatalog()
    if (route.view === 'card_detail' && route.card) cardReadModelDetail.value = await loadCardDetail(route.card)
    if (route.view === 'event_detail' && route.event) eventReadModelDetail.value = await loadEventDetail(String(route.event))
    if (route.view === 'seasonal_campaign') {
      seasonalReadModelDetail.value = await loadSeasonalDetail(route.storySection)
      route = { ...route, storySection: seasonalReadModelDetail.value.id }
    }
    if (route.view === 'work_archive' && route.idol) workReadModelDetail.value = await loadWorkDetail(route.idol)
    if (route.view === 'idol_story_archive' && route.idol) idolStoryReadModelDetail.value = await loadIdolStoryDetail(route.idol)
    if (['story_collection', 'reader'].includes(route.view) && route.storyType && route.storySection) collectionReadModelDetail.value = await loadCollectionDetail(route.storyType, route.storySection)
    if (route.view === 'story_detail' && route.story) storyReadModelDetail.value = await loadStoryReadModelDetail(route.story)
    if (route.view === 'song_catalog') await ensureSongCatalog()
    if (route.view === 'song_detail' && route.song) songReadModelDetail.value = await loadSongDetail(route.song)
    if (navigation.isDisposed() || beforeLoad !== navigation.getRevision()) return
    const pending = applyArchiveRoute(route)
    const expected = navigation.getRevision()
    await pending
    if (navigation.isDisposed() || expected !== navigation.getRevision()) return
    syncArchiveRoute()
  }
  return { openArchivePortal, closeArchivePortal }
}
