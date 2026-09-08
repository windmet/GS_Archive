// Frozen from 59c906e for migration parity only; no product import.
export function legacyProjection(state) {
  const { view, returnViewAfterPlayer, storyCollectionParentView, songParentView, eventParentView, homeSelectedId, homeSelectedCue, homeSelectedCostume, currentCategoryId, currentCharacterId, currentGroup, currentArchiveUnitCode, currentUnit, currentIdolUnitFilter, currentStoryDomain, currentStoryMode, currentStorySection, currentStoryFile, currentMobileMode, currentMobileScenarioId, currentEventScope, currentStoryAvailability, currentStorySort, currentEpisodeId, currentCardId, currentSongId, currentSongScope, currentEventId, currentGashaId, currentGashaCategory, currentCardRarity, currentCardAssetState, currentCardRelationState, filterQuery, currentScenarioFile, currentScenarioStartStep, currentScenarioEndStep, currentPreviewCue, storyDetailParentView } = state
function currentArchiveRoute() {
  const returnsToEvent = view.value === 'player' && returnViewAfterPlayer.value === 'event_detail'
  const returnsToStory = view.value === 'player' && returnViewAfterPlayer.value === 'story_detail'
  const returnsToStoryCollection = view.value === 'player' && returnViewAfterPlayer.value === 'story_collection'
  const preservesEventContext = view.value === 'event_detail' || returnsToEvent
  const preservesStoryDetailContext = view.value === 'story_detail' || returnsToStory
  const preservesStoryCollectionContext = view.value === 'story_collection' || returnsToStoryCollection
  const preservesSongContext = view.value === 'song_detail' ||
    (preservesStoryCollectionContext && storyCollectionParentView.value === 'song_detail')
  const preservesArchiveUnit = view.value === 'unit_detail' ||
    view.value === 'mobile_archive' ||
    (view.value === 'song_detail' && songParentView.value === 'unit_detail') ||
    (view.value === 'player' && returnViewAfterPlayer.value === 'unit_detail') ||
    (view.value === 'player' && returnViewAfterPlayer.value === 'mobile_archive') ||
    (preservesEventContext && eventParentView.value === 'unit_detail')
  return {
    view: view.value,
    homeIdol: view.value === 'home' ? homeSelectedId.value : '',
    homeCue: view.value === 'home' ? homeSelectedCue.value : '',
    homeCostume: view.value === 'home' ? homeSelectedCostume.value : '',
    category: currentCategoryId.value,
    idol: currentCharacterId.value,
    group: currentGroup.value?.id || '',
    unit: (preservesArchiveUnit && currentArchiveUnitCode.value)
      ? currentArchiveUnitCode.value
      : (currentUnit.value?.unit_code || currentUnit.value?.id || ''),
    unitFilter: currentIdolUnitFilter.value,
    storyType: currentStoryDomain.value,
    storyMode: currentStoryMode.value,
    storySection: currentStorySection.value,
    story: (view.value === 'story_detail' || returnsToStory || preservesStoryCollectionContext)
      ? currentStoryFile.value
      : '',
    mobileMode: currentMobileMode.value,
    mobileScenario: currentMobileScenarioId.value,
    eventScope: currentEventScope.value,
    availability: currentStoryAvailability.value,
    sort: currentStorySort.value,
    episode: currentEpisodeId.value,
    card: currentCardId.value,
    song: preservesSongContext ? currentSongId.value : '',
    songScope: (view.value === 'song_catalog' || preservesSongContext) ? currentSongScope.value : 'all',
    event: currentEventId.value,
    gasha: view.value === 'gasha_detail' ? currentGashaId.value : '',
    gashaType: ['gashas', 'gasha_detail'].includes(view.value) ? currentGashaCategory.value : 'all',
    rarity: currentCardRarity.value,
    assetState: currentCardAssetState.value,
    relationState: currentCardRelationState.value,
    query: filterQuery.value,
    scenario: view.value === 'player' ? currentScenarioFile.value : '',
    startStep: view.value === 'player' ? currentScenarioStartStep.value : 0,
    endStep: view.value === 'player' ? currentScenarioEndStep.value : 0,
    voice: view.value === 'player' ? currentPreviewCue.value : '',
    returnView: returnViewAfterPlayer.value,
    parentView: preservesEventContext
      ? eventParentView.value
      : (preservesStoryDetailContext
          ? storyDetailParentView.value
          : (preservesStoryCollectionContext
              ? storyCollectionParentView.value
              : (view.value === 'song_detail' ? songParentView.value : ''))),
  }
}

  return currentArchiveRoute()
}
