import { ref } from 'vue'

// Own URL-facing state; consumers receive the original refs, never copies.
// Resource payloads, playback queues and async loading are feature-owned.
export function useArchiveNavigationState() {
  const view = ref('__boot__')
  const portalFrom = ref('')
  const detailSourceRoute = ref('')
  const readingDocumentId = ref('')
  const readingRowId = ref('')
  const readingMode = ref('original')
  const readingRevision = ref('')
  const currentScenarioInitialStep = ref(null)
  const returnViewAfterPlayer = ref('files')
  const storyCollectionParentView = ref('')
  const songParentView = ref('')
  const eventParentView = ref('')
  const gashaParentView = ref('')
  const homeSelectedId = ref('001tom')
  const homeSelectedCue = ref('')
  const homeSelectedCostume = ref('')
  const currentCategoryId = ref('')
  const currentCharacterId = ref('')
  const currentGroup = ref(null)
  const currentArchiveUnitCode = ref('')
  const currentUnit = ref(null)
  const currentIdolUnitFilter = ref('')
  const currentStoryDomain = ref('')
  const currentStoryMode = ref('portal')
  const currentStorySection = ref('')
  const currentStoryFile = ref('')
  const currentMobileMode = ref('personal')
  const currentMobileScenarioId = ref('')
  const currentEventScope = ref('all')
  const currentStoryAvailability = ref('all')
  const currentStorySort = ref('domain')
  const currentEpisodeId = ref('')
  const currentCardId = ref('')
  const currentSongId = ref('')
  const currentSongScope = ref('all')
  const currentEventId = ref('')
  const currentGashaId = ref('')
  const currentGashaCategory = ref('all')
  const currentCardRarity = ref('all')
  const currentCardAssetState = ref('all')
  const currentCardRelationState = ref('all')
  const filterQuery = ref('')
  const currentScenarioFile = ref('')
  const currentScenarioStartStep = ref(null)
  const currentScenarioEndStep = ref(null)
  const currentPreviewCue = ref('')
  const storyDetailParentView = ref('')

  function currentArchiveRoute() {
    if (view.value === 'reader' || (view.value === 'player' && returnViewAfterPlayer.value === 'reader')) {
      return {
        view: view.value, reading: readingDocumentId.value, readingRow: readingRowId.value,
        readingMode: readingMode.value, readingRev: readingRevision.value,
        storyType: currentStoryDomain.value, storySection: currentStorySection.value, story: currentStoryFile.value,
        event: currentEventId.value, parentView: currentEventId.value ? eventParentView.value : '',
        idol: currentStoryDomain.value === 'work' ? currentCharacterId.value : '',
        ...(view.value === 'player' ? { scenario: currentScenarioFile.value,
          startStep: currentScenarioStartStep.value, endStep: currentScenarioEndStep.value,
          initialStep: currentScenarioInitialStep.value, returnView: 'reader' } : {}),
      }
    }
    if (view.value === 'portal') return { view: 'portal', portalFrom: portalFrom.value }
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
      ...((['card_detail', 'event_detail'].includes(view.value) ||
          ['spine_lab', 'chibi_stage'].includes(view.value) ||
          (view.value === 'player' && ['card_detail', 'event_detail'].includes(returnViewAfterPlayer.value))) &&
          detailSourceRoute.value.startsWith('?')
        ? { sourceRoute: detailSourceRoute.value } : {}),
      ...(view.value === 'player' && currentScenarioInitialStep.value ? { initialStep: currentScenarioInitialStep.value } : {}),
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
      story: (view.value === 'story_detail' || returnsToStory || preservesStoryCollectionContext || view.value === 'work_archive'
        || (view.value === 'player' && returnViewAfterPlayer.value === 'work_archive'))
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
                : (view.value === 'song_detail' ? songParentView.value
                    : (view.value === 'gasha_detail' && gashaParentView.value === 'story_collection'
                        ? gashaParentView.value : '')))),
    }
  }
  
  return {
    view,
    portalFrom,
    detailSourceRoute,
    readingDocumentId,
    readingRowId,
    readingMode,
    readingRevision,
    currentScenarioInitialStep,
    returnViewAfterPlayer,
    storyCollectionParentView,
    songParentView,
    eventParentView,
    gashaParentView,
    homeSelectedId,
    homeSelectedCue,
    homeSelectedCostume,
    currentCategoryId,
    currentCharacterId,
    currentGroup,
    currentArchiveUnitCode,
    currentUnit,
    currentIdolUnitFilter,
    currentStoryDomain,
    currentStoryMode,
    currentStorySection,
    currentStoryFile,
    currentMobileMode,
    currentMobileScenarioId,
    currentEventScope,
    currentStoryAvailability,
    currentStorySort,
    currentEpisodeId,
    currentCardId,
    currentSongId,
    currentSongScope,
    currentEventId,
    currentGashaId,
    currentGashaCategory,
    currentCardRarity,
    currentCardAssetState,
    currentCardRelationState,
    filterQuery,
    currentScenarioFile,
    currentScenarioStartStep,
    currentScenarioEndStep,
    currentPreviewCue,
    storyDetailParentView,
    currentArchiveRoute,
  }
}
