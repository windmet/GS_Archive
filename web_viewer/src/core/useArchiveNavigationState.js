import { ref } from 'vue'
import { storyContentMode } from '../utils/LanguageStore.js'
import { ownsArchiveSource } from './archiveRoute.js'
import { normalizeEventBrowseState } from './EventCatalogRouteState.js'

// Own URL-facing state; consumers receive the original refs, never copies.
// Resource payloads, playback queues and async loading are feature-owned.
// portalScopeShown names the lens an empty portalScope (follow the favorite) currently shows, so the address
// always carries a lens and a shared portal link opens the same view for anyone.
export function useArchiveNavigationState({ portalScopeShown = () => '' } = {}) {
  const view = ref('__boot__')
  const playerEntryRoute = ref(null)
  const currentPickTarget = ref('')
  const portalFrom = ref('')
  const portalScope = ref(''), portalQuery = ref(''), homeFrom = ref('')
  const detailSourceRoute = ref('')
  const readingDocumentId = ref('')
  const readingRowId = ref('')
  const readingMode = ref(storyContentMode.value)
  const readingRevision = ref('')
  // A Reader link names the latest text by default; only a link that arrived with reading_rev pins that version.
  const readingRevisionPinned = ref(false)
  const readingScope = ref(''), playMode = ref('')
  const currentScenarioInitialStep = ref(null)
  const returnViewAfterPlayer = ref('')
  const storyCollectionParentView = ref('')
  const songParentView = ref('')
  const eventParentView = ref('')
  const gashaParentView = ref('')
  const homeSelectedId = ref('')
  const homeSelectedCue = ref('')
  const homeSelectedCostume = ref('')
  const currentCategoryId = ref('')
  const currentCharacterId = ref('')
  const currentArchiveUnitCode = ref('')
  const currentIdolUnitFilter = ref('')
  const currentStoryDomain = ref('')
  const currentStoryMode = ref('portal')
  const currentStorySection = ref('')
  const currentStoryFile = ref('')
  const currentWorkMode = ref('stories')
  const currentMobileMode = ref('personal')
  const currentMobileScenarioId = ref('')
  const currentEventScope = ref('all')
  const currentStoryAvailability = ref('all')
  const currentStorySort = ref('domain')
  const currentEpisodeId = ref('')
  const currentCardId = ref('')
  const currentSongId = ref('')
  const stageTargetId = ref('')
  const currentSongScope = ref('all')
  const currentEventId = ref('')
  const currentEventBrowseState = ref(normalizeEventBrowseState())
  const currentEntityKey = ref('')
  const currentCollectionState = ref({kind:'items',category:'',idol:'',unit:'',attribute:'',page:0})
  const currentPhotoIdol = ref('')
  const currentPhotoEntity = ref('')
  // 其他语音's shelf (login, live-appeal, …); the page falls back to its first shelf for an unknown id.
  const currentVoiceShelf = ref('')
  // 配乐's shelf (score, songs, ambient, se); the page falls back to its first shelf for an unknown id.
  const currentSoundShelf = ref('')
  const currentGashaId = ref('')
  const currentGashaCategory = ref('all')
  const currentCardAttribute = ref('all')
  const currentCardRarity = ref('all')
  const currentCardAssetState = ref('all')
  const currentCardRelationState = ref('all')
  const filterQuery = ref('')
  const currentScenarioFile = ref('')
  const currentScenarioStartStep = ref(null)
  const currentScenarioEndStep = ref(null)
  const currentPreviewCue = ref('')

  function currentArchiveRoute() {
    if (view.value === 'player' && playerEntryRoute.value) return {
      ...playerEntryRoute.value, view: 'player', scenario: currentScenarioFile.value,
      startStep: currentScenarioStartStep.value, endStep: currentScenarioEndStep.value,
      initialStep: currentScenarioInitialStep.value, voice: currentPreviewCue.value,
      returnView: returnViewAfterPlayer.value, ...(playMode.value ? { playMode:playMode.value } : {}),
    }
    if (view.value === 'reader' || (view.value === 'player' && returnViewAfterPlayer.value === 'reader')) {
      return {
        view: view.value, reading: readingDocumentId.value, readingRow: readingRowId.value,
        readingMode: readingMode.value === storyContentMode.value ? '' : readingMode.value, readingRev: readingRevisionPinned.value ? readingRevision.value : '', ...(readingScope.value === 'chapter' ? { readingScope:'chapter' } : {}),
        category: currentEventId.value ? currentCategoryId.value : '',
        unit: currentEventId.value && eventParentView.value === 'unit_detail' ? currentArchiveUnitCode.value : '',
        storyType: currentStoryDomain.value, storySection: currentStorySection.value, story: currentStoryFile.value,
        ...(currentStoryDomain.value === 'work' ? { workMode: currentWorkMode.value } : {}),
        event: currentEventId.value, parentView: currentEventId.value ? eventParentView.value : '',
        ...(detailSourceRoute.value.startsWith('?') ? { sourceRoute: detailSourceRoute.value } : {}),
        idol: ['work', 'idol_story', 'seasonal_campaign'].includes(currentStoryDomain.value) ? currentCharacterId.value : '',
        ...(currentStoryDomain.value === 'idol_story' ? { episode: currentEpisodeId.value } : {}),
        ...(view.value === 'player' ? { scenario: currentScenarioFile.value,
          startStep: currentScenarioStartStep.value, endStep: currentScenarioEndStep.value,
          initialStep: currentScenarioInitialStep.value, returnView: 'reader' } : {}),
      }
    }
    if (view.value === 'portal') return { view: 'portal', portalFrom: portalFrom.value,
      ...(portalScope.value || portalScopeShown() ? { portalScope: portalScope.value || portalScopeShown() } : {}),
      ...(portalQuery.value ? { portalQuery: portalQuery.value } : {}) }
    if (view.value === 'welcome' || view.value === 'idol_picker') return {
      view: view.value,
      ...(view.value === 'idol_picker' ? { pickTarget: currentPickTarget.value } : {}),
      ...(detailSourceRoute.value.startsWith('?') ? { sourceRoute: detailSourceRoute.value } : {}),
    }
    const returnsToEvent = view.value === 'player' && returnViewAfterPlayer.value === 'event_detail'
    const returnsToStoryCollection = view.value === 'player' && returnViewAfterPlayer.value === 'story_collection'
    const preservesEventContext = view.value === 'event_detail' || returnsToEvent
    const preservesStoryCollectionContext = view.value === 'story_collection' || returnsToStoryCollection
    const preservesSongContext = ['song_detail', 'chart_lab'].includes(view.value) ||
      (view.value === 'chibi_stage' && Boolean(currentSongId.value)) ||
      (preservesStoryCollectionContext && storyCollectionParentView.value === 'song_detail')
    const preservesArchiveUnit = view.value === 'unit_detail' ||
      view.value === 'mobile_archive' ||
      (view.value === 'song_detail' && songParentView.value === 'unit_detail') ||
      (view.value === 'player' && returnViewAfterPlayer.value === 'unit_detail') ||
      (view.value === 'player' && returnViewAfterPlayer.value === 'mobile_archive') ||
      (preservesEventContext && eventParentView.value === 'unit_detail')
    return {
      view: view.value,
      ...(view.value === 'idol_picker' ? { pickTarget: currentPickTarget.value } : {}),
      ...(view.value === 'collection_catalog' ? {entity:currentEntityKey.value,collection:currentCollectionState.value} : {}),
      ...(view.value === 'event_catalog' ? {eventBrowse:currentEventBrowseState.value} : {}),
      ...(['photo_catalog','picture_studio'].includes(view.value) ? {photoIdol:currentPhotoIdol.value,photoEntity:currentPhotoEntity.value} : {}),
      ...((view.value === 'unused_archive' || (view.value === 'player' && returnViewAfterPlayer.value === 'unused_archive')) && currentVoiceShelf.value
        ? { voiceShelf: currentVoiceShelf.value } : {}),
      ...((view.value === 'score_archive' || (view.value === 'player' && returnViewAfterPlayer.value === 'score_archive')) && currentSoundShelf.value
        ? { soundShelf: currentSoundShelf.value } : {}),
      ...(ownsArchiveSource(view.value, returnViewAfterPlayer.value) && detailSourceRoute.value.startsWith('?')
        ? { sourceRoute: detailSourceRoute.value } : {}),
      ...(view.value === 'player' && currentScenarioInitialStep.value ? { initialStep: currentScenarioInitialStep.value } : {}),
      homeIdol: view.value === 'home' ? homeSelectedId.value : '',
      homeCue: view.value === 'home' ? homeSelectedCue.value : '',
      homeCostume: view.value === 'home' ? homeSelectedCostume.value : '',
      ...(view.value === 'home' && homeFrom.value ? { homeFrom: homeFrom.value } : {}),
      category: currentCategoryId.value,
      idol: currentCharacterId.value,
      unit: preservesArchiveUnit ? currentArchiveUnitCode.value : '',
      unitFilter: currentIdolUnitFilter.value,
      storyType: currentStoryDomain.value,
      storyMode: currentStoryMode.value,
      storySection: currentStorySection.value,
      story: (preservesStoryCollectionContext || view.value === 'work_archive'
        || (view.value === 'player' && returnViewAfterPlayer.value === 'work_archive'))
        ? currentStoryFile.value
        : '',
      ...((view.value === 'work_archive' || (view.value === 'player' && returnViewAfterPlayer.value === 'work_archive'))
        ? { workMode: currentWorkMode.value } : {}),
      mobileMode: currentMobileMode.value,
      mobileScenario: currentMobileScenarioId.value,
      eventScope: currentEventScope.value,
      availability: currentStoryAvailability.value,
      sort: currentStorySort.value,
      episode: currentEpisodeId.value,
      card: currentCardId.value,
      song: preservesSongContext ? currentSongId.value : '',
      ...(view.value === 'chibi_stage' ? { stageId: stageTargetId.value } : {}),
      songScope: (view.value === 'song_catalog' || preservesSongContext) ? currentSongScope.value : 'all',
      event: currentEventId.value,
      gasha: view.value === 'gasha_detail' ? currentGashaId.value : '',
      gashaType: ['gashas', 'gasha_detail'].includes(view.value) ? currentGashaCategory.value : 'all',
      rarity: currentCardRarity.value,
      cardAttribute: currentCardAttribute.value,
      assetState: currentCardAssetState.value,
      relationState: currentCardRelationState.value,
      query: filterQuery.value,
      scenario: view.value === 'player' ? currentScenarioFile.value : '',
      startStep: view.value === 'player' ? currentScenarioStartStep.value : 0,
      endStep: view.value === 'player' ? currentScenarioEndStep.value : 0,
      voice: view.value === 'player' ? currentPreviewCue.value : '',
      returnView: view.value === 'player' ? returnViewAfterPlayer.value : '', // a stale player return never reaches another page's URL
      parentView: preservesEventContext
        ? eventParentView.value
        : (preservesStoryCollectionContext
            ? storyCollectionParentView.value
            : (view.value === 'song_detail' ? songParentView.value
                : (view.value === 'gasha_detail' && gashaParentView.value === 'story_collection'
                    ? gashaParentView.value : ''))),
    }
  }

  return {
    currentEntityKey,
    currentCollectionState,
    currentPhotoIdol,
    currentPhotoEntity,
    currentVoiceShelf,
    currentSoundShelf,
    view,
    playerEntryRoute,
    currentPickTarget,
    portalFrom,
    portalScope, portalQuery, homeFrom,
    detailSourceRoute,
    readingDocumentId,
    readingRowId,
    readingMode,
    readingRevision, readingRevisionPinned, readingScope, playMode,
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
    currentArchiveUnitCode,
    currentIdolUnitFilter,
    currentStoryDomain,
    currentStoryMode,
    currentStorySection,
    currentStoryFile,
    currentWorkMode,
    currentMobileMode,
    currentMobileScenarioId,
    currentEventScope,
    currentStoryAvailability,
    currentStorySort,
    currentEpisodeId,
    currentCardId,
    currentSongId,
    stageTargetId,
    currentSongScope,
    currentEventId,
    currentEventBrowseState,
    currentGashaId,
    currentGashaCategory,
    currentCardRarity,
    currentCardAttribute,
    currentCardAssetState,
    currentCardRelationState,
    filterQuery,
    currentScenarioFile,
    currentScenarioStartStep,
    currentScenarioEndStep,
    currentPreviewCue,
    currentArchiveRoute,
  }
}
