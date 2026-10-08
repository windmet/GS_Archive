export function useStageNavigation({ view, currentSongId, detailSourceRoute, stageTargetId, stageHandoff,
  songReadModelDetail, loading, loadingPurpose, preloadProgress, navigation, captureDetailSource, commitView,
  restoreDetailSource, goHome, syncArchiveRoute, spineViewerLoader, chibiStageViewerLoader, loadSongDetail, ensureSongCatalog }) {
  function openSongStage(target) {
    if (view.value !== 'song_detail' || target?.songCode !== currentSongId.value || !target.choreographyId) return
    return openChibiStage(target)
  }

  async function openSpineLab() {
    return navigation.run(async intent => {
      if (!['spine_lab', 'chibi_stage'].includes(view.value)) captureDetailSource()
      loading.value = true
      loadingPurpose.value = 'stage'
      preloadProgress.value = 100
      await spineViewerLoader()
      if (!intent.isCurrent()) return
      commitView('spine_lab')
    })
  }

  async function openChibiStage(target = null) {
    return navigation.run(async intent => {
      if (!['spine_lab', 'chibi_stage'].includes(view.value)) captureDetailSource()
      loading.value = true
      loadingPurpose.value = 'stage'
      preloadProgress.value = 100
      await chibiStageViewerLoader()
      if (!intent.isCurrent()) return
      const songCode = target?.songCode || 'drvalv'
      if (songReadModelDetail.value?.id !== songCode) {
        try {
          const detail = await loadSongDetail(songCode)
          if (!intent.isCurrent()) return
          songReadModelDetail.value = detail
        } catch (error) {
          if (!intent.isCurrent()) return
          console.error('[StageReadModel] Failed to load song audio experiment:', error)
        }
      }
      stageTargetId.value = target?.choreographyId || ''
      currentSongId.value = stageTargetId.value ? target.songCode : ''
      stageHandoff.value = target?.stageHandoff || null
      commitView('chibi_stage')
      void ensureSongCatalog()
    })
  }

  function closeArchiveExperiment() {
    stageHandoff.value = null
    if (view.value === 'chibi_stage' && !detailSourceRoute.value &&
        stageTargetId.value && currentSongId.value) {
      stageTargetId.value = ''
      return commitView('song_detail')
    }
    return restoreDetailSource(goHome)
  }

  function updateStageTarget(target) {
    if (view.value !== 'chibi_stage' || !target?.songCode || !target?.choreographyId) return
    stageTargetId.value = target.choreographyId
    currentSongId.value = target.songCode
    stageHandoff.value = null
    syncArchiveRoute({ replace: true, restoreView: false })
    if (songReadModelDetail.value?.id === target.songCode) return
    const revision = navigation.getRevision()
    loadSongDetail(target.songCode).then(detail => {
      if (navigation.isDisposed() || revision !== navigation.getRevision() ||
          view.value !== 'chibi_stage' || currentSongId.value !== target.songCode) return
      songReadModelDetail.value = detail
    }).catch(error => {
      if (revision === navigation.getRevision() && view.value === 'chibi_stage')
        console.error('[StageReadModel] Failed to switch song audio experiment:', error)
    })
  }

  return { openSongStage, openSpineLab, openChibiStage, closeArchiveExperiment, updateStageTarget }
}
