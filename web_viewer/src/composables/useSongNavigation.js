import { computed, shallowRef, watch } from 'vue'
import { entityDescriptor } from '../../readmodels/runtime/ReadModelClient.mjs'
import { SONG_PERFORMER_SCOPES } from '../presentation/SongPresentation.js'

export function useSongNavigation({ view, currentSongId, currentSongScope, songParentView,
  currentCharacterId, currentCategoryId, filterQuery, detailSourceRoute,
  songReadModelCatalog, songReadModelDetail, songReadModelStatus, currentArchiveUnit,
  archiveBootstrap, readModelClient, navigation, captureDetailSource, commitView,
  restoreDetailSource, goHome, openArchiveUnit, openPrimaryIdol, openProjectedCollection }) {
  const chartManifest = shallowRef(null)
  let pendingSongNavigation = 0

  const currentSong = computed(() => songReadModelDetail.value?.id === currentSongId.value
    ? songReadModelDetail.value.song : null)
  const currentSongPresentation = computed(() => songReadModelDetail.value?.id === currentSongId.value
    ? songReadModelDetail.value.view : null)
  // The chart manifest identifies variants; the catalogue supplies their display data.
  const chartSongs = computed(() => {
    const charts = chartManifest.value?.songs
    if (!charts) return []
    const rows = Object.values(songReadModelCatalog.value?.songs || {})
    const variants = new Map(rows.flatMap(row => (row.variants || []).map(variant => [variant.song_code, { row, variant }])))
    return Object.entries(charts).map(([code, difficulties]) => {
      const row = songReadModelCatalog.value?.songs?.[code], base = row || variants.get(code)?.row
      if (!base) return null
      return { code, title: row ? row.title : variants.get(code).variant.title || base.title, kana: base.kana || '',
        jacketUrl: base.jacket_url || '', unitName: base.performance?.unitName || SONG_PERFORMER_SCOPES[base.performance?.scope]?.[0] || '', difficultyCount: Object.keys(difficulties).length, order: base.song_id || 0 }
    }).filter(Boolean).sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
  })

  async function loadSongCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (songReadModelCatalog.value) return songReadModelCatalog.value
    return (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.songs, options)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor, options)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || new Set(rows.map(row => row.song_code)).size !== rows.length)
        throw new Error('Song catalog page count or identity mismatch')
      const catalog = { songs: Object.fromEntries(rows.map(row => [row.song_code, row])), summary: index.summary }
      options.signal?.throwIfAborted()
      songReadModelCatalog.value = catalog
      return catalog
    })()
  }

  async function ensureSongCatalog(options = navigation.getLoadOptions?.() || {}) {
    if (songReadModelCatalog.value) return true
    options.signal?.throwIfAborted()
    songReadModelStatus.value = '正在读取歌曲目录…'
    try {
      await loadSongCatalog(options)
      options.signal?.throwIfAborted()
      songReadModelStatus.value = ''
      return true
    } catch (error) {
      console.error('[SongReadModel] Failed to load catalog:', error)
      options.signal?.throwIfAborted()
      songReadModelStatus.value = '歌曲目录暂时无法读取，请重试。'
      return false
    }
  }

  async function loadSongDetail(songCode, options = navigation.getLoadOptions?.() || {}) {
    const row = songReadModelCatalog.value?.songs?.[songCode]
    const descriptor = row?.detail || await entityDescriptor(archiveBootstrap, 'songs', songCode, 'songs.detail')
    return readModelClient.load(descriptor, { ...options, validate: data => {
      if (data.song?.song_code !== songCode || data.view?.id !== songCode)
        throw new Error('Song detail identity mismatch')
    } })
  }

  function openSongCatalog({ idolCode = '' } = {}) {
    if (view.value !== 'portal') detailSourceRoute.value = ''
    currentCharacterId.value = idolCode
    currentSongId.value = ''
    currentSongScope.value = 'all'
    songParentView.value = ''
    filterQuery.value = ''
    currentCategoryId.value = ''
    commitView('song_catalog')
    ensureSongCatalog()
  }

  async function openSong(songCode) {
    if (!songCode) return
    const request = ++pendingSongNavigation
    const revision = navigation.getRevision()
    songReadModelStatus.value = '正在读取歌曲详情…'
    try {
      const detail = await loadSongDetail(songCode)
      if (request !== pendingSongNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      songReadModelDetail.value = detail
      songReadModelStatus.value = ''
    } catch (error) {
      if (request !== pendingSongNavigation || revision !== navigation.getRevision()) return
      console.error('[SongReadModel] Failed to load song detail:', error)
      songReadModelStatus.value = '歌曲详情暂时无法读取，请重新选择。'
      return
    }
    captureDetailSource()
    if (view.value === 'idol_detail') songParentView.value = 'idol_detail'
    else if (view.value === 'unit_detail') songParentView.value = 'unit_detail'
    else if (view.value !== 'song_detail') songParentView.value = ''
    currentSongId.value = songCode
    commitView('song_detail')
  }

  function openSongUnit(unitCode) {
    return openArchiveUnit({ unit_code: unitCode })
  }

  function openSongIdol(idolCode) {
    captureDetailSource()
    filterQuery.value = ''
    openPrimaryIdol(idolCode)
  }

  function openSongRelatedStory(relation) {
    if (relation?.entity_type !== 'story_collection') return
    return openProjectedCollection({ domain: relation.story_type || 'extra',
      section: relation.story_section || '', parent: 'song_detail' })
  }

  function goBackFromSong() {
    const parent = songParentView.value
    currentSongId.value = ''
    songParentView.value = ''
    if (parent === 'idol_detail' && archiveBootstrap.idols.some(idol => idol.id === currentCharacterId.value)) commitView('idol_detail')
    else if (parent === 'unit_detail' && currentArchiveUnit.value) commitView('unit_detail')
    else {
      commitView('song_catalog')
      ensureSongCatalog()
    }
  }

  function openChartLab() { captureDetailSource(); filterQuery.value = ''; commitView('chart_lab') }
  // The tools entry opens the chart picker without carrying a previously selected song.
  function openChartTool() {
    captureDetailSource(); filterQuery.value = ''; currentSongId.value = ''
    commitView('chart_lab')
  }
  async function prepareChartTool() {
    await Promise.all([ensureSongCatalog(), ensureChartManifest()])
  }
  async function ensureChartManifest() {
    if (chartManifest.value) return true
    try {
      const response = await fetch('/data/song_charts/manifest.json')
      if (!response.ok) throw new Error(`chart manifest ${response.status}`)
      chartManifest.value = await response.json()
      return true
    } catch (error) {
      console.error('[ChartTool] Failed to load chart manifest:', error)
      songReadModelStatus.value = '谱面目录暂时无法读取，请重试。'
      return false
    }
  }
  // Replacing the history entry makes Back leave the tool after any number of selections.
  async function selectChartSong(songCode) {
    if (!songCode || view.value !== 'chart_lab') return
    const request = ++pendingSongNavigation
    const revision = navigation.getRevision()
    songReadModelStatus.value = '正在读取谱面…'
    try {
      const detail = await loadSongDetail(songCode)
      if (request !== pendingSongNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      songReadModelDetail.value = detail
      songReadModelStatus.value = ''
    } catch (error) {
      if (request !== pendingSongNavigation || revision !== navigation.getRevision()) return
      console.error('[ChartTool] Failed to load song detail:', error)
      songReadModelStatus.value = '这首歌的谱面暂时无法读取，请重新选择。'
      return
    }
    currentSongId.value = songCode
    commitView('chart_lab', { replace: true })
  }

  function closeChartTool() {
    if (detailSourceRoute.value) return restoreDetailSource(goHome)
    return commitView(currentSongId.value ? 'song_detail' : 'experiments')
  }

  function invalidateSongNavigation() {
    ++pendingSongNavigation
  }

  async function prepareSongRoute(route, { isCurrent }) {
    if (route.view === 'song_catalog') await ensureSongCatalog()
    if (!isCurrent()) return false
    if (['song_detail', 'chart_lab', 'chibi_stage'].includes(route.view) && (route.song || route.view === 'chibi_stage')) {
      try {
        const detail = await loadSongDetail(route.song || 'drvalv')
        if (!isCurrent()) return false
        songReadModelDetail.value = detail
        songReadModelStatus.value = ''
      } catch (error) {
        if (!isCurrent()) return false
        console.error('[SongReadModel] Failed to restore song detail:', error)
        if (['song_detail', 'chart_lab'].includes(route.view)) {
          await ensureSongCatalog()
          if (!isCurrent()) return false
          songReadModelStatus.value = '歌曲详情暂时无法读取，请重新选择。'
        }
      }
    }
    return true
  }

  watch(view, next => { if (next === 'chart_lab') void prepareChartTool() }, { immediate: true })
  watch([view, currentSongId], ([nextView, songCode]) => {
    if (nextView !== 'song_detail' || !songCode || songReadModelDetail.value?.id === songCode) return
    const request = ++pendingSongNavigation
    const revision = navigation.getRevision()
    songReadModelStatus.value = '正在读取歌曲详情…'
    loadSongDetail(songCode).then(detail => {
      if (request !== pendingSongNavigation || revision !== navigation.getRevision() ||
        navigation.isDisposed() || view.value !== 'song_detail' || currentSongId.value !== songCode) return
      songReadModelDetail.value = detail
      songReadModelStatus.value = ''
    }).catch(error => {
      if (request !== pendingSongNavigation || revision !== navigation.getRevision() ||
        view.value !== 'song_detail' || currentSongId.value !== songCode) return
      console.error('[SongReadModel] Failed to restore song detail:', error)
      songReadModelStatus.value = '歌曲详情暂时无法读取，请返回后重试。'
    })
  })

  return {
    currentSong, currentSongPresentation, chartSongs,
    loadSongCatalog, ensureSongCatalog, loadSongDetail,
    openSongCatalog, openSong, openSongUnit, openSongIdol, openSongRelatedStory,
    openChartLab, openChartTool, selectChartSong, closeChartTool, goBackFromSong,
    invalidateSongNavigation, prepareSongRoute,
  }
}
