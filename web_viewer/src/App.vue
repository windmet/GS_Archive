<template>
  <div id="story-viewer">

    <ArchiveShell
      v-if="archiveShellVisible"
      v-model="filterQuery"
      :active-section="archiveSection"
      :title="archiveTitle"
      :searchable="archiveSearchable"
      :search-placeholder="archiveSearchPlaceholder"
      :show-back="archiveShowBack"
      :breadcrumbs="archiveBreadcrumbs"
      @navigate="navigateArchiveSection"
      @back="goArchiveBack"
    >
      <ArchiveImmersiveHome
        v-if="view === 'home'"
        v-model:selected-id="homeSelectedId"
        v-model:selected-cue="homeSelectedCue"
        v-model:selected-costume="homeSelectedCostume"
        :no-audio="NO_AUDIO"
        :idols="archiveHomeIdols"
        :highlights="archiveHomeHighlights"
        :stats="archiveStats"
        @open-story="navigateArchiveSection('stories')"
        @open-cards="openHomeCards"
        @open-idol="openHomeIdol"
        @open-chat="openHomeChat"
        @open-event="openHomeEvent"
      />

      <ArchiveIdolGrid
        v-if="view === 'idols'"
        embedded
        v-model="filterQuery"
        :title="categoryHeaderText"
        :filter-placeholder="categoryFilterPlaceholder"
        :idols="filteredIdols"
        :unit-options="idolUnitOptions"
        :current-unit="currentIdolUnitFilter"
        :idols-before-unit-filter="searchMatchedIdols.length"
        @back="goHome"
        @select="openIdol"
        @select-unit="currentIdolUnitFilter = $event"
        @open-units="openUnitCatalog"
      />

      <ArchiveCardList
        v-if="view === 'cards'"
        embedded
        v-model="filterQuery"
        :title="currentCardCharacterName"
        :cards="filteredCards"
        :rarity-tabs="cardRarityTabs"
        :current-rarity="currentCardRarity"
        :current-asset-state="currentCardAssetState"
        :current-relation-state="currentCardRelationState"
        :idols="idolUnitData?.idols || []"
        :selected-idol="currentCharacterId"
        v-model:layout="cardLayout"
        @back="goBackFromCards"
        @select-card="openCard"
        @select-rarity="currentCardRarity = $event"
        @select-asset-state="currentCardAssetState = $event"
        @select-relation-state="currentCardRelationState = $event"
        @select-idol="selectPrimaryIdol"
      />

      <ArchiveIdolDetail
        v-if="view === 'idol_detail'"
        :idol="currentIdolProfile"
        :stats="currentIdolStats"
        :events="currentIdolEvents"
        :idols="idolUnitData?.idols || []"
        :selected-idol="currentCharacterId"
        @open-domain="openIdolDomain"
        @open-unit="openUnitFromIdol"
        @open-event="openIdolEvent"
        @select-idol="selectPrimaryIdol"
      />

      <ArchiveCardDetail
        v-if="view === 'card_detail'"
        embedded
        :card="currentCard"
        :asset-status="currentCardAssetStatus"
        :art-mode="cardArtMode"
        :previous-card="previousCard"
        :next-card="nextCard"
        :series-cards="currentSeriesCards"
        :event-relation="currentCardEventRelation"
        :gasha-relation="currentCardGashaRelation"
        @back="goBackToCards"
        @preview-voice="previewCardVoice"
        @open-scenario="openCardScenario"
        @navigate-card="openCard"
        @navigate-related-card="openRelatedCard"
        @open-event="openCardEvent"
        @open-gasha="openCardGasha"
        @update:art-mode="cardArtMode = $event"
      />

      <ArchiveGashaCatalog
        v-if="view === 'gashas'"
        :gashas="filteredGashas"
        :category-options="gashaCategoryOptions"
        :category="currentGashaCategory"
        :total-gashas="gashaCatalog.length"
        :announcement-count="gashaIndexData?.meta?.gasha_count || 0"
        :pickup-count="gashaIndexData?.meta?.derived_pickup_count || 0"
        @select="openGasha"
        @update:category="currentGashaCategory = $event"
      />

      <ArchiveGashaDetail
        v-if="view === 'gasha_detail'"
        :gasha="currentGasha"
        :idol-name="idolDisplayName"
        @open-card="openGashaCard"
      />

      <ArchiveEventDetail
        v-if="view === 'event_detail'"
        :event="currentEvent"
        :master-event="currentMasterEvent"
        :story="currentEventStory"
        :episodes="currentEventEpisodes"
        :cards="currentEventCards"
        :idols="currentEventIdols"
        :units="currentEventUnits"
        :idol-visual-url="eventStoryIdolVisualUrl"
        :external-resources="currentEventExternalResources"
        @play="playCurrentEvent"
        @play-episode="playCurrentEventEpisode"
        @open-card="openEventCard"
        @open-idol="openEventIdol"
        @open-unit="openEventUnit"
      />

      <ArchiveGroupList
        v-if="view === 'groups'"
        embedded
        v-model="filterQuery"
        :title="groupTitle"
        :groups="filteredGroups"
        @back="goBackFromGroups"
        @select="openGroup"
      />

      <ArchiveUnitGrid
        v-if="view === 'episode_zero_units'"
        embedded
        :units="episodeZeroUnits"
        @back="goHome"
        @select="openUnit"
      />

      <ArchiveEpisodeList
        v-if="view === 'episodes'"
        embedded
        :unit="currentUnit"
        @back="goBackToUnits"
        @select="openEpisodeFiles"
      />

      <ArchiveFileList
        v-if="view === 'files'"
        embedded
        v-model="filterQuery"
        :title="currentGroup?.title || 'Scenarios'"
        :entries="filteredFileEntries"
        @back="goBackToFiles"
        @select="openScenarioEntry"
      />

      <ArchiveStatus
        v-if="view === 'archive_status'"
        :manifest="archiveManifestData"
        :verification="archiveVerificationData"
        :ui-assets="uiAssetCatalogData"
        @open-spine-lab="openSpineLab"
      />

      <ArchiveStoryCatalog
        v-if="view === 'story_catalog'"
        :entries="visibleStoryCatalogEntries"
        :all-entries="storyCatalog"
        :domain-options="storyDomainOptions"
        :domain="currentStoryDomain"
        :section="currentStorySection"
        :mode="currentStoryMode"
        :event-scope-options="storyEventScopeOptions"
        :event-scope="currentEventScope"
        :availability="currentStoryAvailability"
        :sort="currentStorySort"
        :catalog-total="storyCatalog.length"
        :filtered-total="filteredStoryCatalog.length"
        :seasonal-campaigns="seasonalCampaignData?.campaigns || []"
        :work-idols="workStoryData?.idols || []"
        :idol-story-count="idolEpisodeData?.meta?.section_count || 0"
        :external-resource-count="externalStoryNavigationEntries.length"
        :main-domain="mainStoryDomain"
        :extra-domain="extraStoryDomain"
        :birthday-domain="birthdayStoryDomain"
        @select="openCatalogStory"
        @browse="browseStoryCollection"
        @open-external-resources="openExternalStoryResources"
        @open-seasonal="openSeasonalCampaign()"
        @open-work="openWorkArchive()"
        @open-idol-story="openIdolStoryArchive()"
        @load-more="storyVisibleLimit += 80"
        @clear-section="currentStorySection = ''"
        @update:mode="setStoryMode"
        @update:domain="setStoryDomain"
        @update:event-scope="currentEventScope = $event"
        @update:availability="currentStoryAvailability = $event"
        @update:sort="currentStorySort = $event"
      />

      <ArchiveExternalStoryResources
        v-if="view === 'external_story_resources'"
        :entries="externalStoryNavigationEntries"
        @open-internal="openExternalStoryInternal"
      />

      <ArchiveStoryDetail
        v-if="view === 'story_detail'"
        :story="currentStory"
        :related="currentStoryRelated"
        :visual-url="currentStoryVisualUrl"
        :idol-name="idolDisplayName"
        :external-resources="currentStoryExternalResources"
        @play="playStoryDetail"
        @select="openStoryDetail"
        @open-idol="openStoryIdol"
      />

      <ArchiveStoryCollection
        v-if="view === 'story_collection'"
        :collection="currentStoryCollection"
        :external-resources="currentStoryCollectionExternalResources"
        :initial-chapter-id="currentStoryCollectionChapter?.id || ''"
        @play-chapter="playStoryCollectionChapter"
        @play-episode="playStoryCollectionEpisode"
      />

      <ArchiveSeasonalCampaign
        v-if="view === 'seasonal_campaign'"
        :campaign="currentSeasonalCampaign"
        :campaigns="seasonalCampaignData?.campaigns || []"
        @select="selectSeasonalCampaign"
        @play="playSeasonalCampaignStory"
      />

      <ArchiveWorkStory
        v-if="view === 'work_archive'"
        :idol="currentWorkIdol"
        :idols="workStoryData?.idols || []"
        @select-idol="selectWorkIdol"
        @play="playWorkStory"
      />

      <ArchiveIdolStory
        v-if="view === 'idol_story_archive'"
        :story="currentIdolStoryPage"
        :idols="idolStoryOptions"
        :external-resources="currentIdolStoryExternalResources"
        @select-idol="selectIdolStory"
        @play-section="playIdolStorySection"
        @play-episode="playIdolStoryEpisode"
        @open-communication="openStoryCommunication"
      />

      <ArchiveMobileArchive
        v-if="view === 'mobile_archive'"
        :archive="mobileArchiveData"
        :compiled-index="indexData"
        :idols="idolUnitData?.idols || []"
        :units="idolUnitData?.units || []"
        :selected-idol="currentCharacterId"
        :selected-unit="currentArchiveUnitCode"
        :mode="currentMobileMode"
        :focused-scenario-id="currentMobileScenarioId"
        @select-idol="selectMobileIdol"
        @select-unit="selectMobileUnit"
        @update:mode="setMobileMode"
        @play="playMobileScenario"
        @open-card="openMobileCard"
      />

      <ArchiveUnitCatalog
        v-if="view === 'unit_catalog'"
        :entries="unitCatalogEntries"
        @select="openArchiveUnit"
      />

      <ArchiveUnitDetail
        v-if="view === 'unit_detail'"
        :unit="currentArchiveUnit"
        :members="currentArchiveUnitMembers"
        :stories="currentArchiveUnitStories"
        :card-stats="currentArchiveUnitEntry?.cardStats"
        :event-relations="currentArchiveUnitEntry?.eventRelations"
        @open-idol="openUnitMember"
        @open-story="openUnitStory"
        @open-event="openUnitEvent"
        @open-cards="openUnitCards"
      />
    </ArchiveShell>

    <!-- ====== STORY PLAYER ====== -->
    <StoryViewer
      v-if="view === 'player' && currentScenario"
      :key="currentScenarioInstance"
      :scenario-json="currentScenario"
      :start-step="currentScenarioStartStep"
      :end-step="currentScenarioEndStep"
      :has-next-episode="hasNextPlaybackEpisode"
      :continuous-playback="continuousPlayback"
      @back="closePlayer"
      @ready="onPlayerReady"
      @next-episode="playNextEpisode"
      @update:continuous-playback="continuousPlayback = $event"
    />

    <!-- ====== SPINE LAB ====== -->
    <SpineViewer v-if="view === 'spine_lab'" @back="goHome" @open-stage="openChibiStage" />
    <ChibiStageViewer v-if="view === 'chibi_stage'" @back="goHome" @open-lab="openSpineLab" />

    <!-- ====== PRELOADER LOADING SCREEN ====== -->
    <LoadingScreen :visible="loading" :progress="preloadProgress" />

  </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, onMounted, onBeforeUnmount, watch } from 'vue'
import { IDOL_ID_TO_NAME } from './utils/IdolNameMap.js'
import { groupFileList } from './utils/IndexNormalizer.js'
import { countScenarioFiles, getCategoryCountText } from './utils/IndexStats.js'
import { Preloader } from './utils/Preloader.js'
import LoadingScreen from './components/LoadingScreen.vue'
import ArchiveImmersiveHome from './components/archive/ArchiveImmersiveHome.vue'
import ArchiveShell from './components/archive/ArchiveShell.vue'
import ArchiveCardList from './components/archive/ArchiveCardList.vue'
import ArchiveCardDetail from './components/archive/ArchiveCardDetail.vue'
import ArchiveGashaCatalog from './components/archive/ArchiveGashaCatalog.vue'
import ArchiveGashaDetail from './components/archive/ArchiveGashaDetail.vue'
import ArchiveEventDetail from './components/archive/ArchiveEventDetail.vue'
import ArchiveIdolGrid from './components/archive/ArchiveIdolGrid.vue'
import ArchiveIdolDetail from './components/archive/ArchiveIdolDetail.vue'
import ArchiveGroupList from './components/archive/ArchiveGroupList.vue'
import ArchiveFileList from './components/archive/ArchiveFileList.vue'
import ArchiveUnitGrid from './components/archive/ArchiveUnitGrid.vue'
import ArchiveEpisodeList from './components/archive/ArchiveEpisodeList.vue'
import ArchiveStatus from './components/archive/ArchiveStatus.vue'
import ArchiveStoryCatalog from './components/archive/ArchiveStoryCatalog.vue'
import ArchiveExternalStoryResources from './components/archive/ArchiveExternalStoryResources.vue'
import ArchiveStoryDetail from './components/archive/ArchiveStoryDetail.vue'
import ArchiveStoryCollection from './components/archive/ArchiveStoryCollection.vue'
import ArchiveSeasonalCampaign from './components/archive/ArchiveSeasonalCampaign.vue'
import ArchiveWorkStory from './components/archive/ArchiveWorkStory.vue'
import ArchiveIdolStory from './components/archive/ArchiveIdolStory.vue'
import ArchiveMobileArchive from './components/archive/ArchiveMobileArchive.vue'
import ArchiveUnitCatalog from './components/archive/ArchiveUnitCatalog.vue'
import ArchiveUnitDetail from './components/archive/ArchiveUnitDetail.vue'
import { loadArchiveData, loadCardDetailData, loadIdolCommunicationData } from './data/ArchiveDataRepository.js'
import {
  buildCardMap,
  buildCardRarityTabs,
  buildUnitCardSummary,
  buildScenarioMetaByFile,
  buildStoryCatalog,
  cardsForCharacter,
  mergeCardDetail,
} from './data/archiveSelectors.js'
import { buildArchiveHomeHighlights, buildArchiveHomeState } from './data/archiveHomeState.js'
import { buildEventStoryEpisodes } from './data/eventStoryEpisodes.js'
import { buildStoryCollections } from './data/storyCollections.js'
import {
  buildBirthdayStoryDomainIdentity,
  buildExtraStoryDomainIdentity,
  buildMainStoryDomainIdentity,
} from './data/storyDomainIdentityIndex.js'
import { buildIdolStoryOptions, buildIdolStoryPage } from './data/idolCommunicationSelectors.js'
import {
  archiveSectionForRoute,
  buildArchiveBreadcrumbs,
  onArchivePopState,
  readArchiveRoute,
  writeArchiveRoute,
} from './core/archiveRoute.js'
import { installSpineAnimationDebug } from './debug/installSpineAnimationDebug.js'
import { EntityTranslationRepository } from './localization/story/EntityTranslationRepository.js'
import { PlayerPreferencesRepository } from './core/story-runtime/PlayerPreferencesRepository.js'
import {
  setStoryLanguagePreferences,
  storyTranslationLocale,
  uiLocale,
} from './utils/LanguageStore.js'
import {
  birthdayStoryIdolCode,
  getPromotedCharacterImageUrl,
  getRawCharacterImageCandidateUrl,
} from './utils/CharacterImageResolver.js'
import {
  buildExternalStoryNavigationEntries,
  externalResourcesForCollection,
  externalResourcesForEvent,
  externalResourcesForIdolStory,
  externalResourcesForStory,
} from './data/externalStoryResources.js'

setStoryLanguagePreferences(new PlayerPreferencesRepository().load())
const entityTranslationRepository = new EntityTranslationRepository()
const URL_FLAGS = new URLSearchParams(window.location.search)
const NO_AUDIO = URL_FLAGS.get('noAudio') === '1'

const storyViewerLoader = () => import('./core/StoryViewer.vue')
const spineViewerLoader = () => import('./components/SpineViewer.vue')
const chibiStageViewerLoader = () => import('./components/ChibiStageViewer.vue')
const StoryViewer = defineAsyncComponent(storyViewerLoader)
const SpineViewer = defineAsyncComponent(spineViewerLoader)
const ChibiStageViewer = defineAsyncComponent(chibiStageViewerLoader)

function resolveChatName(ch) {
  // index may store raw chara_id such as "031sak"; resolve to display name.
  if (ch && /^\d{3}[a-z0-9]{3}$/.test(ch.name || '')) {
    return { ...ch, name: IDOL_ID_TO_NAME[ch.name] || ch.name }
  }
  return ch
}

const view = ref('__boot__')
const indexData = ref(null)
const cardIndexData = ref(null)
const gashaIndexData = ref(null)
const eventIndexData = ref(null)
const cardDetailData = ref(null)
const cardDetailLoadPromise = ref(null)
const storyMasterData = ref(null)
const storyPresentationData = ref(null)
const seasonalCampaignData = ref(null)
const workStoryData = ref(null)
const idolEpisodeData = ref(null)
const mobileArchiveData = ref(null)
const idolCommunicationLoadPromise = ref(null)
const idolUnitData = ref(null)
const speakerDictionaryData = ref(null)
const costumeDictionaryData = ref(null)
const archiveManifestData = ref(null)
const archiveVerificationData = ref(null)
const uiAssetCatalogData = ref(null)
const rawCharacterImagePromotionsData = ref(null)
const externalStoryResourcesData = ref(null)
const idolEntityTranslationRevision = ref(0)
const currentScenario = ref(null)
const currentScenarioFile = ref('')
const currentScenarioStartStep = ref(null)
const currentScenarioEndStep = ref(null)
const currentScenarioInstance = ref(0)
const playbackQueue = ref([])
const playbackQueueIndex = ref(-1)
const continuousPlayback = ref(window.localStorage.getItem('sidem:continuous-playback') === '1')
const currentPreviewCue = ref('')
const filterQuery = ref('')
const loading = ref(true)
const preloadProgress = ref(0)

// Navigation context
const currentCategoryId = ref('')
const currentCharacterId = ref('')
const currentGroup = ref(null)
const currentUnit = ref(null)
const currentArchiveUnitCode = ref('')
const currentEpisodeId = ref('')
const currentCardId = ref('')
const currentGashaId = ref('')
const currentEventId = ref('')
const eventParentView = ref('')
const storyDetailParentView = ref('')
const storyCollectionParentView = ref('')
const currentGashaCategory = ref('all')
const currentCardRarity = ref('all')
const currentCardAssetState = ref('all')
const currentCardRelationState = ref('all')
const cardLayout = ref('compact')
const cardArtMode = ref('clean')
const currentIdolUnitFilter = ref('')
const currentStoryDomain = ref('')
const currentStoryMode = ref('portal')
const currentStorySection = ref('')
const currentStoryFile = ref('')
const currentEventScope = ref('all')
const currentStoryAvailability = ref('all')
const currentStorySort = ref('domain')
const currentMobileMode = ref('personal')
const currentMobileScenarioId = ref('')
const storyVisibleLimit = ref(80)
const homeSelectedId = ref('001tom')
const homeSelectedCue = ref('')
const homeSelectedCostume = ref('')
const returnViewAfterPlayer = ref('files')
let archiveRouteReady = false
let applyingArchiveRoute = false
let removeArchivePopState = null
let removeSpineAnimationDebug = null

const CATEGORIES = [
  { id: 'main_story', name: '主线剧情' },
  { id: 'event', name: '活动剧情' },
  { id: 'idol', name: '偶像个人' },
  { id: 'idol_chat', name: '短信聊天' },
  { id: 'idol_phone', name: '电话聊天' },
  { id: 'cards', name: '卡片档案' },
  { id: 'episode_zero', name: '第零话' },
  { id: 'extra', name: '额外剧情' },
]

const totalFiles = computed(() => countScenarioFiles(indexData.value?.categories || []))
const archiveStats = computed(() => [
  { label: '剧情文件', value: archiveVerificationData.value?.scenarios?.parsed_files ?? archiveManifestData.value?.counts?.indexed_scenarios ?? totalFiles.value },
  { label: '偶像', value: archiveManifestData.value?.counts?.idols ?? Object.keys(idolUnitData.value?.by_idol_code || {}).length },
  { label: '卡片', value: archiveManifestData.value?.counts?.cards ?? cardIndexData.value?.meta?.card_count ?? cardIndexData.value?.cards?.length ?? 0 },
  { label: '卡池', value: gashaIndexData.value?.meta?.logical_gasha_count ?? archiveManifestData.value?.counts?.gashas ?? 0 },
  { label: '首页语音', value: archiveManifestData.value?.counts?.home_voice_cues ?? cardIndexData.value?.meta?.home_voice_cue_count ?? 0 },
])
const archiveHomeIdols = computed(() => buildArchiveHomeState(
  idolUnitData.value,
  cardIndexData.value,
  archiveManifestData.value,
  costumeDictionaryData.value,
))
const archiveHomeHighlights = computed(() => buildArchiveHomeHighlights(
  archiveManifestData.value,
  uiAssetCatalogData.value,
))

function categoryById(id) {
  if (!indexData.value) return null
  return indexData.value.categories.find(c => c.id === id) || null
}

function groupChatByUnitCode(categoryId, unitCode) {
  if (categoryId !== 'idol_chat' || !unitCode) return null
  return categoryById('idol_chat')?.groups?.find(group => group.unit_code === unitCode) || null
}

const currentCategory = computed(() => categoryById(currentCategoryId.value))

function catCountText(id) {
  if (id === 'cards') {
    const cards = cardIndexData.value?.meta?.card_count || cardIndexData.value?.cards?.length || 0
    const chars = Object.keys(cardIndexData.value?.by_character || {}).length
    return cards ? `${cards} cards · ${chars} idols` : ''
  }
  return getCategoryCountText(categoryById(id))
}

// Idol / chat grid.
function withUnitEvidence(entry) {
  if (entry._isGroup) return entry
  const unit = archiveManifestData.value?.unit_membership_by_idol?.[entry.id]
  return unit ? { ...entry, unitId: String(unit.unit_id), unitCode: unit.unit_code, unitName: unit.unit_name } : entry
}

const idolList = computed(() => {
  const catId = currentCategoryId.value
  if (catId === 'cards') {
    const byCharacter = cardIndexData.value?.by_character || {}
    return Object.entries(byCharacter).map(([id, cards]) => withUnitEvidence({
      id,
      name: idolDisplayName(id),
      cardCount: cards.length,
      _isGroup: false,
    }))
  }
  if (catId === 'idol_phone') {
    const cat = categoryById('idol_phone')
    const source = cat?.individual
    if (!source) return []
    return Object.entries(source).map(([id, data]) => withUnitEvidence({ id, ...resolveChatName(data), _isGroup: false }))
  }
  const cat = categoryById(catId === 'idol_chat' ? 'idol_chat' : 'idol')
  const source = catId === 'idol_chat' ? cat?.individual : cat?.characters
  if (!source) return []
  // For chat category, also include group chat entries
  if (catId === 'idol_chat' && cat?.groups) {
    const chars = Object.entries(source).map(([id, data]) => withUnitEvidence({ id, ...resolveChatName(data), _isGroup: false }))
    const groups = cat.groups.map(g => ({ id: g.unit_code, name: g.unit_name, _isGroup: true, _groupData: g }))
    return [...groups, ...chars]
  }
  return Object.entries(source).map(([id, data]) => withUnitEvidence({ id, ...data }))
})

const searchMatchedIdols = computed(() => {
  const q = filterQuery.value.toLowerCase()
  if (!q) return idolList.value
  return idolList.value.filter(ch =>
    idolEntitySearchText(ch.id, ch.name).includes(q) ||
    String(ch.unitName || '').toLowerCase().includes(q),
  )
})

const filteredIdols = computed(() => {
  if (!currentIdolUnitFilter.value) return searchMatchedIdols.value
  return searchMatchedIdols.value.filter(entry => entry.unitId === currentIdolUnitFilter.value)
})

const idolUnitOptions = computed(() => {
  if (!['idol', 'cards'].includes(currentCategoryId.value)) return []
  const counts = new Map()
  for (const entry of idolList.value) {
    if (entry.unitId) counts.set(entry.unitId, (counts.get(entry.unitId) || 0) + 1)
  }
  return (idolUnitData.value?.units || []).map(unit => ({
    id: String(unit.unit_id),
    code: unit.unit_code,
    name: unit.unit_name,
    count: counts.get(String(unit.unit_id)) || 0,
  })).filter(unit => unit.count)
})

// Group list.
const filteredGroups = computed(() => {
  if (!currentCharacterId.value && !currentCategoryId.value) return []
  let groups = []

  if (currentCharacterId.value) {
    if (currentCategoryId.value === 'idol_chat') {
      const cat = categoryById('idol_chat')
      const ch = cat?.individual?.[currentCharacterId.value]
      groups = ch?.groups || groupChatByUnitCode('idol_chat', currentCharacterId.value)?.groups || []
    } else if (currentCategoryId.value === 'idol_phone') {
      const cat = categoryById('idol_phone')
      const ch = cat?.individual?.[currentCharacterId.value]
      groups = ch?.groups || []
    } else {
      const cat = categoryById('idol')
      const ch = cat?.characters?.[currentCharacterId.value]
      groups = ch?.groups || []
    }
  } else if (currentCategoryId.value) {
    const cat = categoryById(currentCategoryId.value)
    groups = cat?.groups || []
  }

  const q = filterQuery.value.toLowerCase()
  if (!q) return groups
  return groups.filter(g =>
    g.title.toLowerCase().includes(q) ||
    g.id.toLowerCase().includes(q)
  )
})

const groupTitle = computed(() => {
  if (currentCharacterId.value) {
    if (currentCategoryId.value === 'idol_chat') {
      const cat = categoryById('idol_chat')
      const ch = resolveChatName(cat?.individual?.[currentCharacterId.value])
      return ch?.name || groupChatByUnitCode('idol_chat', currentCharacterId.value)?.unit_name || currentCharacterId.value
    }
    if (currentCategoryId.value === 'idol_phone') {
      const cat = categoryById('idol_phone')
      const ch = resolveChatName(cat?.individual?.[currentCharacterId.value])
      return ch?.name || currentCharacterId.value
    }
    const cat = categoryById('idol')
    const ch = cat?.characters?.[currentCharacterId.value]
    return ch?.name || currentCharacterId.value
  }
  return currentCategory.value?.name || ''
})

const categoryHeaderText = computed(() => {
  if (currentCategoryId.value === 'cards') return '卡片档案'
  if (currentCategoryId.value === 'idol_chat') return '短信聊天'
  if (currentCategoryId.value === 'idol_phone') return '电话聊天'
  return '偶像个人'
})

const categoryFilterPlaceholder = computed(() => {
  if (currentCategoryId.value === 'cards') return 'Search card idol...'
  if (currentCategoryId.value === 'idol_chat') return 'Search chat...'
  if (currentCategoryId.value === 'idol_phone') return 'Search phone...'
  return 'Search idol...'
})

// Episode Zero units.
const episodeZeroUnits = computed(() => {
  const cat = categoryById('episode_zero')
  return cat?.units || []
})

const scenarioMetaByFile = computed(() => buildScenarioMetaByFile(storyMasterData.value))

const eventRelationByFile = computed(() => new Map(
  (archiveManifestData.value?.unit_event_relations || []).map(relation => [relation.file, relation]),
))

const storyCatalog = computed(() => buildStoryCatalog(storyMasterData.value, storyPresentationData.value).map(entry => {
  if (entry.domain !== 'event') return entry
  const relation = eventRelationByFile.value.get(entry.file)
  if (!relation) return { ...entry, eventScope: 'unclassified', eventScopeLabel: '活动' }
  const masterEvent = eventIndexData.value?.by_code?.[String(relation.event_code)] || null
  const eventScopeLabel = relation.event_scope === 'fixed_unit_event'
    ? '固定团活'
    : (relation.event_scope === 'attribute_event' ? `属性·${relation.attribute}` : '跨组合团活')
  return {
    ...entry,
    title: relation.title,
    subtitle: [entry.title, entry.subtitle].filter(Boolean).join(' / '),
    searchText: `${entry.searchText} ${relation.title} ${relation.attribute || ''}`.toLowerCase(),
    eventScope: relation.event_scope,
    eventScopeLabel,
    eventRelation: relation,
    masterEvent,
    rewardCardIds: masterEvent?.reward_card_ids || [],
  }
}))

const mainStoryDomain = computed(() => (
  storyMasterData.value ? buildMainStoryDomainIdentity(storyMasterData.value) : null
))

const currentSeasonalCampaign = computed(() => {
  const campaigns = seasonalCampaignData.value?.campaigns || []
  return seasonalCampaignData.value?.by_id?.[currentStorySection.value] ||
    campaigns.find(item => item.id === 'valentine_2023') ||
    campaigns[0] || null
})

const currentWorkIdol = computed(() => {
  const idols = workStoryData.value?.idols || []
  return workStoryData.value?.by_idol_code?.[currentCharacterId.value] ||
    workStoryData.value?.by_idol_code?.['001tom'] ||
    idols[0] || null
})

const idolStoryOptions = computed(() => buildIdolStoryOptions(idolEpisodeData.value, idolUnitData.value))

const currentIdolStoryPage = computed(() => {
  const fallback = idolStoryOptions.value[0]?.idolCode || ''
  const idolCode = idolEpisodeData.value?.by_idol_code?.[currentCharacterId.value]
    ? currentCharacterId.value
    : fallback
  const page = buildIdolStoryPage(
    idolEpisodeData.value,
    mobileArchiveData.value,
    storyCatalog.value,
    idolUnitData.value,
    idolCode,
  )
  if (!page) return null
  const membership = archiveManifestData.value?.unit_membership_by_idol?.[idolCode]
  return { ...page, unitName: membership?.unit_name || page.unitName }
})

const currentIdolStoryExternalResources = computed(() =>
  externalResourcesForIdolStory(
    externalStoryResourcesData.value,
    currentIdolStoryPage.value,
  ),
)

const storyDomainOptions = computed(() => {
  const counts = new Map()
  const labels = new Map()
  for (const entry of storyCatalog.value) {
    counts.set(entry.domain, (counts.get(entry.domain) || 0) + 1)
    labels.set(entry.domain, entry.domainLabel)
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count, label: labels.get(id) || id }))
})

const storyEventScopeOptions = computed(() => {
  const labels = {
    fixed_unit_event: '固定组合团活',
    attribute_event: '属性团曲',
    mixed_unit_event: '跨组合团活',
  }
  return Object.entries(labels).map(([id, label]) => ({
    id,
    label,
    count: storyCatalog.value.filter(entry => entry.domain === 'event' && entry.eventScope === id).length,
  }))
})

const filteredStoryCatalog = computed(() => {
  const query = filterQuery.value.trim().toLowerCase()
  const availability = currentStoryAvailability.value
  const entries = storyCatalog.value.filter(entry =>
    (!currentStoryDomain.value || entry.domain === currentStoryDomain.value) &&
    (!currentStorySection.value || entry.sectionId === currentStorySection.value) &&
    (currentStoryDomain.value !== 'event' || currentEventScope.value === 'all' || entry.eventScope === currentEventScope.value) &&
    (availability === 'all' || (availability === 'playable' ? entry.exists : !entry.exists)) &&
    (!query || entry.searchText.includes(query) || entry.characters.some(characterId => (
      idolEntitySearchText(characterId).includes(query)
    ))),
  )
  const sorted = [...entries]
  if (currentStorySort.value === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
  else if (currentStorySort.value === 'resource') sorted.sort((a, b) => a.resourceId.localeCompare(b.resourceId))
  else if (currentStorySort.value === 'steps_desc') sorted.sort((a, b) => (b.summary?.step_count || 0) - (a.summary?.step_count || 0))
  else sorted.sort((a, b) => a.domainOrder - b.domainOrder || a.resourceId.localeCompare(b.resourceId))
  return sorted
})

const visibleStoryCatalogEntries = computed(() => filteredStoryCatalog.value.slice(0, storyVisibleLimit.value))

const currentStory = computed(() => storyCatalog.value.find(entry => entry.file === currentStoryFile.value) || null)
const currentStoryExternalResources = computed(() =>
  externalResourcesForStory(externalStoryResourcesData.value, currentStory.value),
)

const extraStoryDomain = computed(() => buildExtraStoryDomainIdentity(storyMasterData.value))
const birthdayStoryDomain = computed(() => buildBirthdayStoryDomainIdentity(
  storyMasterData.value,
  idolUnitData.value,
  speakerDictionaryData.value,
))

const storyCollections = computed(() => buildStoryCollections(
  storyMasterData.value,
  storyCatalog.value,
  { birthdayDomain: birthdayStoryDomain.value },
))

const currentStoryCollection = computed(() => storyCollections.value.find(collection =>
  collection.domain === currentStoryDomain.value && collection.sectionId === currentStorySection.value,
) || null)

const currentStoryCollectionExternalResources = computed(() =>
  externalResourcesForCollection(externalStoryResourcesData.value, currentStoryCollection.value),
)

const currentStoryCollectionChapter = computed(() =>
  currentStoryCollection.value?.chapters?.find(chapter =>
    chapter.story?.file === currentStoryFile.value,
  ) || null,
)

const externalStoryNavigationEntries = computed(() =>
  buildExternalStoryNavigationEntries(externalStoryResourcesData.value, {
    events: archiveManifestData.value?.unit_event_relations || [],
    collections: storyCollections.value,
    stories: storyCatalog.value,
    idolEpisodes: idolEpisodeData.value,
  }),
)

const currentStoryRelated = computed(() => {
  if (!currentStory.value) return []
  const sameCollection = storyCatalog.value.filter(entry =>
    entry.domain === currentStory.value.domain &&
    (currentStory.value.sectionId ? entry.sectionId === currentStory.value.sectionId : true),
  )
  return sameCollection.sort((a, b) => a.releaseAt - b.releaseAt || a.resourceId.localeCompare(b.resourceId))
})

const currentEventStory = computed(() => storyCatalog.value.find(entry => entry.file === currentEvent.value?.file) || null)

const currentEventEpisodes = computed(() => {
  return buildEventStoryEpisodes(currentEvent.value, currentEventStory.value, storyMasterData.value)
})

const hasNextPlaybackEpisode = computed(() =>
  playbackQueueIndex.value >= 0 && playbackQueueIndex.value < playbackQueue.value.length - 1,
)

watch(continuousPlayback, enabled => {
  window.localStorage.setItem('sidem:continuous-playback', enabled ? '1' : '0')
})

const currentStoryVisualUrl = computed(() => {
  const story = currentStory.value
  if (!story) return ''
  if (story.domain === 'main') {
    const chapter = Number(story.sectionId) - 100
    if (chapter >= 1 && chapter <= 2) return `/assets/stories/main/image_story_main_button_${String(chapter).padStart(2, '0')}.png`
  }
  if (story.domain === 'unit_story') {
    const codes = ['01jup', '02dra', '03alt', '04bei', '05w00', '06fra', '07sai', '08hig', '09shi', '10caf', '11mof', '12sem', '13the', '14fla', '15leg', '16cfi']
    const code = codes[Number(story.sectionId) - 1]
    if (code) return `/assets/stories/units/image_unit_story_button_${code}.png`
  }
  if (story.domain === 'idol_story' && story.sectionId) return `/assets/idols/icons/image_chara_icon_${story.sectionId}.png`
  if (story.domain === 'birthday') {
    const idolCode = birthdayStoryIdolCode(story)
    return getRawCharacterImageCandidateUrl('birthday_visual', idolCode) ||
      getPromotedCharacterImageUrl(
        'birthday_visual',
        idolCode,
        rawCharacterImagePromotionsData.value,
      )
  }
  return ''
})

function eventStoryIdolVisualUrl(idolCode) {
  return getRawCharacterImageCandidateUrl('event_story_visual', idolCode) ||
    getPromotedCharacterImageUrl(
      'event_story_visual',
      idolCode,
      rawCharacterImagePromotionsData.value,
    )
}

const unitCatalogEntries = computed(() => (idolUnitData.value?.units || []).map(unit => {
  const unitId = String(unit.unit_id)
  const members = Object.entries(archiveManifestData.value?.unit_membership_by_idol || {})
    .filter(([, evidence]) => String(evidence.unit_id) === unitId)
    .map(([idolCode]) => ({ idol_code: idolCode, ...idolUnitData.value?.by_idol_code?.[idolCode] }))
    .sort((a, b) => Number(a.idol_id || 0) - Number(b.idol_id || 0))
  const cardStats = buildUnitCardSummary(cardMap.value, members.map(member => member.idol_code))
  const eventRelations = archiveManifestData.value?.unit_event_relations_by_unit?.[unitId] || {
    team_events: [],
    attribute_event_appearances: [],
    mixed_unit_appearances: [],
  }
  return {
    unit,
    members,
    storyCount: storyCatalog.value.filter(entry => entry.domain === 'unit_story' && entry.unitId === unitId).length,
    cardStats,
    eventRelations,
  }
}))

const currentArchiveUnit = computed(() => (idolUnitData.value?.units || []).find(unit =>
  String(unit.unit_code) === currentArchiveUnitCode.value || String(unit.unit_id) === currentArchiveUnitCode.value,
) || null)

const currentArchiveUnitMembers = computed(() => {
  const id = String(currentArchiveUnit.value?.unit_id || '')
  return unitCatalogEntries.value.find(entry => String(entry.unit.unit_id) === id)?.members || []
})

const currentArchiveUnitEntry = computed(() => {
  const id = String(currentArchiveUnit.value?.unit_id || '')
  return unitCatalogEntries.value.find(entry => String(entry.unit.unit_id) === id) || null
})

const currentArchiveUnitStories = computed(() => {
  const id = String(currentArchiveUnit.value?.unit_id || '')
  return storyCatalog.value
    .filter(entry => entry.domain === 'unit_story' && entry.unitId === id)
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId))
})

function displayTitleForMeta(meta, fallbackFile) {
  const titles = meta?.titles?.filter(Boolean) || []
  if (!titles.length) return formatFileName(fallbackFile || meta?.resourceIds?.[0] || '')
  if (titles.length === 1) return titles[0]
  if (titles.every(title => /^エピソード\d+$/.test(String(title)))) {
    return `${titles[0]} - ${titles[titles.length - 1]}`
  }
  return titles.slice(0, 2).join(' / ') + (titles.length > 2 ? ` +${titles.length - 2}` : '')
}

function fileEntryFor(fn) {
  const meta = scenarioMetaByFile.value.get(fn)
  if (!meta) {
    return {
      file: fn,
      title: formatFileName(fn),
      subtitle: '',
      resourceId: fn,
      missing: false,
      searchText: fn,
    }
  }
  const resourceText = meta.resourceIds.length ? meta.resourceIds.join(', ') : fn
  const summaryText = summaryTextForMeta(meta)
  const title = displayTitleForMeta(meta, fn)
  return {
    file: fn,
    title,
    subtitle: summaryText ? `${resourceText} · ${summaryText}` : resourceText,
    resourceId: meta.resourceIds[0] || fn,
    missing: meta.exists === false,
    searchText: `${fn} ${title} ${resourceText}`,
  }
}

function summaryTextForMeta(meta) {
  const summary = meta?.summary
  if (!summary) return ''
  const parts = []
  if (summary.voice_count) parts.push(`${summary.voice_count} voices`)
  if (summary.lip_count) parts.push(`${summary.lip_count} lips`)
  if (!parts.length && summary.step_count) parts.push(`${summary.step_count} steps`)
  return parts.join(' · ')
}

const filteredFileEntries = computed(() => {
  if (!currentGroup.value) return []
  const files = groupFileList(currentGroup.value)
  let entries = files.map(fileEntryFor)

  if (currentCategoryId.value === 'extra') {
    const existingFiles = new Set(files)
    const missingExtra = (storyMasterData.value?.extra?.episodes || [])
      .filter(row => row.compiled_exists === false)
      .map(row => {
        const resourceId = row.resource_id || row['5']
        const title = row['3'] || resourceId
        return {
          file: null,
          title,
          subtitle: `${resourceId} · missing compiled`,
          resourceId,
          missing: true,
          searchText: `${title} ${resourceId}`,
        }
      })
      .filter(entry => !existingFiles.has(entry.file))
    entries = [...entries, ...missingExtra]
  }

  const q = filterQuery.value.toLowerCase()
  if (!q) return entries
  return entries.filter(entry => entry.searchText.toLowerCase().includes(q))
})

const cardMap = computed(() => buildCardMap(cardIndexData.value))

const currentCards = computed(() => cardsForCharacter(
  cardIndexData.value,
  cardMap.value,
  currentCharacterId.value,
))

const cardRarityTabs = computed(() => buildCardRarityTabs(currentCards.value))

const filteredCards = computed(() => {
  const q = filterQuery.value.toLowerCase()
  const rarity = currentCardRarity.value
  const assetState = currentCardAssetState.value
  const relationState = currentCardRelationState.value
  return currentCards.value.filter(card =>
    (rarity === 'all' || card.rarity === rarity) &&
    matchesCardAssetState(archiveManifestData.value?.card_assets_by_id?.[card.resource_id], assetState) &&
    matchesCardRelationState(card, relationState) &&
    (!q ||
    String(card.title || '').toLowerCase().includes(q) ||
    String(card.resource_id || '').toLowerCase().includes(q) ||
    String(card.rarity || '').toLowerCase().includes(q))
  )
})

const currentCardBase = computed(() => cardMap.value.get(currentCardId.value) || null)
const currentCard = computed(() => mergeCardDetail(currentCardBase.value, cardDetailData.value))
const currentCardAssetStatus = computed(() => archiveManifestData.value?.card_assets_by_id?.[currentCardId.value] || null)
const currentCardEventRelation = computed(() => archiveManifestData.value?.event_card_relations_by_card?.[currentCardId.value] || null)
const currentCardGashaRelation = computed(() => gashaIndexData.value?.relations_by_card?.[currentCardId.value] || null)
const GASHA_CATEGORY_LABELS = {
  standard_pickup: '通常',
  growing_fes: 'GROWING FES',
  stage_step_up: 'STAGE',
  full_roster_series: '全员系列',
}
function resolveGashaRelatedCards(gasha) {
  if (!gasha || !gasha.related_pickup_count) return gasha
  const sourceCode = gasha.related_pickup_source === 'reprint'
    ? gasha.reprint_of
    : gasha.primary_code
  const sourceCards = gashaIndexData.value?.by_code?.[sourceCode]?.derived_pickup_cards || []
  const relatedIds = new Set(gasha.related_pickup_card_ids || [])
  return {
    ...gasha,
    related_pickup_cards: sourceCards.filter(card => relatedIds.has(card.card_resource_id)),
  }
}
const gashaCatalog = computed(() => [...(gashaIndexData.value?.gashas || [])]
  .filter(gasha => gasha.phase === 'primary')
  .map(resolveGashaRelatedCards)
  .reverse())
const gashaCategoryOptions = computed(() => {
  const counts = gashaIndexData.value?.meta?.category_counts || {}
  return [
    { value: 'all', label: '全部', count: gashaCatalog.value.length },
    ...Object.entries(GASHA_CATEGORY_LABELS).map(([value, label]) => ({
      value,
      label,
      count: counts[value] || 0,
    })),
  ]
})
const filteredGashas = computed(() => {
  const query = filterQuery.value.trim().toLowerCase()
  return gashaCatalog.value.filter(gasha => {
    if (currentGashaCategory.value !== 'all' && gasha.category !== currentGashaCategory.value) return false
    if (!query) return true
    return String(gasha.display_name || '').toLowerCase().includes(query) ||
      String(gasha.code || '').toLowerCase().includes(query) ||
      [...(gasha.derived_pickup_cards || []), ...(gasha.related_pickup_cards || [])].some(card =>
        String(card.card_title || '').toLowerCase().includes(query) ||
        String(card.card_resource_id || '').toLowerCase().includes(query) ||
        idolEntitySearchText(card.character_id).includes(query)
      )
  })
})
const currentGasha = computed(() => resolveGashaRelatedCards(
  gashaIndexData.value?.by_id?.[currentGashaId.value] || null,
))
const eventMap = computed(() => new Map((archiveManifestData.value?.unit_event_relations || [])
  .map(event => [String(event.event_id), event])))
const currentEvent = computed(() => eventMap.value.get(currentEventId.value) || null)
const currentMasterEvent = computed(() => {
  const code = String(currentEvent.value?.event_code || '')
  return eventIndexData.value?.by_code?.[code] || null
})
const currentEventExternalResources = computed(() =>
  externalResourcesForEvent(externalStoryResourcesData.value, currentEvent.value?.event_code),
)
const currentEventCards = computed(() => (archiveManifestData.value?.event_card_relations_by_event?.[currentEventId.value] || [])
  .map(relation => {
    const card = cardMap.value.get(relation.card_resource_id)
    return {
      ...relation,
      card_title: card?.title || relation.card_resource_id,
      character_name: idolDisplayName(relation.character_id),
    }
  }))
const currentEventIdols = computed(() => (currentEvent.value?.characters || []).map(idolCode => ({
  idol_code: idolCode,
  ...(idolUnitData.value?.by_idol_code?.[idolCode] || {}),
})))
const currentEventUnits = computed(() => {
  const unitIds = new Set((currentEvent.value?.participating_unit_ids || []).map(String))
  return (idolUnitData.value?.units || []).filter(unit => unitIds.has(String(unit.unit_id)))
})
const currentCardIndex = computed(() => currentCards.value.findIndex(card => card.resource_id === currentCardId.value))
const previousCard = computed(() => currentCardIndex.value > 0
  ? currentCards.value[currentCardIndex.value - 1]
  : null)
const nextCard = computed(() => currentCardIndex.value >= 0 && currentCardIndex.value < currentCards.value.length - 1
  ? currentCards.value[currentCardIndex.value + 1]
  : null)
const currentSeriesCards = computed(() => {
  const seriesId = currentCard.value?.release_series?.series_id
  if (!seriesId) return []
  return [...cardMap.value.values()]
    .filter(card => card.release_series?.series_id === seriesId)
    .map(card => ({ ...card, character_name: idolDisplayName(card.character_id) }))
})

const currentCardCharacterName = computed(() => {
  const id = currentCharacterId.value
  return idolDisplayName(id) || 'Cards'
})

function matchesCardAssetState(status, state) {
  if (state === 'all') return true
  if (!status) return false
  if (state === 'visible_icon') return status.awakened_icon || status.normal_icon
  if (state === 'complete_icons') return status.awakened_icon && status.normal_icon
  if (state === 'single_state') return status.single_state
  if (state === 'has_large') {
    return status.awakened_portrait || status.normal_portrait ||
      status.awakened_landscape || status.normal_landscape ||
      status.awakened_large || status.normal_large
  }
  if (state === 'missing_normal') return !status.normal_icon && !status.single_state
  return true
}

function matchesCardRelationState(card, state) {
  if (state === 'all') return true
  if (state === 'card_story') return Boolean(card?.scenario_entries?.length)
  if (state === 'event_card') return Boolean(archiveManifestData.value?.event_card_relations_by_card?.[card?.resource_id])
  if (state === 'gasha_card') return Boolean(gashaIndexData.value?.relations_by_card?.[card?.resource_id])
  if (state === 'release_series') return Boolean(card?.release_series)
  if (state === 'unrelated') {
    return !card?.scenario_entries?.length &&
      !card?.release_series &&
      !archiveManifestData.value?.event_card_relations_by_card?.[card?.resource_id] &&
      !gashaIndexData.value?.relations_by_card?.[card?.resource_id]
  }
  return true
}

const currentIdolProfile = computed(() => {
  const profile = idolUnitData.value?.by_idol_code?.[currentCharacterId.value]
  if (!profile) return null
  const unit = archiveManifestData.value?.unit_membership_by_idol?.[currentCharacterId.value]
  return {
    ...profile,
    idol_code: currentCharacterId.value,
    unit_id: unit?.unit_id || profile.unit_id,
    unit_code: unit?.unit_code || profile.unit_code,
    unit_name: unit?.unit_name || profile.unit_name,
  }
})

const currentIdolStats = computed(() => {
  const id = currentCharacterId.value
  const chapter = idolEpisodeData.value?.by_idol_code?.[id]?.[0]
  const mobileById = new Map((mobileArchiveData.value?.scenarios || []).map(scenario => [scenario.id, scenario]))
  const mobileScenarios = (mobileArchiveData.value?.by_idol_code?.[id] || [])
    .map(scenarioId => mobileById.get(scenarioId))
    .filter(Boolean)
  return {
    cards: cardsForCharacter(cardIndexData.value, cardMap.value, id).length,
    stories: (chapter?.sections || []).reduce((sum, section) => sum + (section.episodes?.length || 0), 0),
    chats: mobileScenarios.filter(scenario => scenario.kind === 'idol_talk').length,
    phones: mobileScenarios.filter(scenario => scenario.kind === 'idol_phone').length,
  }
})
const currentIdolEvents = computed(() => (archiveManifestData.value?.unit_event_relations || [])
  .filter(event => (event.characters || []).includes(currentCharacterId.value))
  .sort((left, right) => Number(left.release_at || 0) - Number(right.release_at || 0)))

const archiveShellVisible = computed(() => !['__boot__', 'player', 'spine_lab', 'chibi_stage'].includes(view.value))

const archiveSection = computed(() => archiveSectionForRoute({
  view: view.value,
  category: currentCategoryId.value,
  idol: currentCharacterId.value,
  card: currentCardId.value,
  gasha: currentGashaId.value,
  unit: currentArchiveUnitCode.value || currentUnit.value?.unit_code || currentUnit.value?.id || '',
  group: currentGroup.value?.id || '',
  scenario: view.value === 'player' ? currentScenarioFile.value : '',
  voice: view.value === 'player' ? currentPreviewCue.value : '',
}))

const archiveTitle = computed(() => {
  if (view.value === 'home') return 'SideM Archive'
  if (view.value === 'archive_status') return '数据状态'
  if (view.value === 'story_catalog') {
    if (currentStoryMode.value === 'portal' && currentStoryDomain.value === 'main') return '主线剧情'
    if (currentStoryMode.value === 'portal' && currentStoryDomain.value === 'extra') return '额外剧情'
    if (currentStoryMode.value === 'portal' && currentStoryDomain.value === 'birthday') return '生日剧情'
    return '故事目录'
  }
  if (view.value === 'external_story_resources') return '社区中文剧情'
  if (view.value === 'story_detail') return currentStory.value?.title || '故事详情'
  if (view.value === 'story_collection') return currentStoryCollection.value?.title || '故事章节'
  if (view.value === 'seasonal_campaign') return currentSeasonalCampaign.value?.name || '季节企划'
  if (view.value === 'work_archive') return `${currentWorkIdol.value?.display_name || ''} 工作档案`.trim()
  if (view.value === 'idol_story_archive') return `${currentIdolStoryPage.value?.idol_name || ''} 个人故事`.trim()
  if (view.value === 'mobile_archive') return 'Mobile 通信'
  if (view.value === 'gashas') return '卡池档案'
  if (view.value === 'gasha_detail') return currentGasha.value?.display_name || '卡池详情'
  if (view.value === 'event_detail') return currentEvent.value?.title || '活动详情'
  if (view.value === 'unit_catalog') return '组合资料'
  if (view.value === 'unit_detail') return currentArchiveUnit.value?.unit_name || '组合详情'
  if (view.value === 'idols') return categoryHeaderText.value
  if (view.value === 'idol_detail') return currentIdolProfile.value?.display_name || '偶像详情'
  if (view.value === 'groups') return groupTitle.value
  if (view.value === 'cards') return currentCardCharacterName.value
  if (view.value === 'card_detail') return currentCard.value?.title || currentCard.value?.resource_id || '卡片详情'
  if (view.value === 'episode_zero_units') return '第零话'
  if (view.value === 'episodes') return currentUnit.value?.unit_name || '章节'
  if (view.value === 'files') return currentGroup.value?.title || '剧情文件'
  return 'SideM Archive'
})

const archiveSearchable = computed(() => ['idols', 'groups', 'cards', 'gashas', 'files'].includes(view.value) || (view.value === 'story_catalog' && currentStoryMode.value === 'search'))

const archiveSearchPlaceholder = computed(() => {
  if (view.value === 'idols') return categoryFilterPlaceholder.value
  if (view.value === 'cards') return '搜索卡片标题、稀有度或资源 ID'
  if (view.value === 'gashas') return '搜索卡池编号、名称、卡片或偶像'
  if (view.value === 'groups') return '搜索章节标题或资源 ID'
  if (view.value === 'files') return '搜索剧情标题或资源 ID'
  if (view.value === 'story_catalog') return '搜索标题、资源 ID 或角色代码'
  return '搜索资料'
})

const archiveShowBack = computed(() => view.value !== 'home')

const archiveBreadcrumbs = computed(() => {
  const route = currentArchiveRoute()
  const entityByView = {
    idol_detail: {
      title: currentIdolProfile.value?.display_name,
      id: currentCharacterId.value,
    },
    unit_detail: {
      title: currentArchiveUnit.value?.unit_name,
      id: currentArchiveUnitCode.value,
    },
    card_detail: {
      title: currentCard.value?.title,
      id: currentCardId.value,
    },
    gasha_detail: {
      title: currentGasha.value?.display_name,
      id: currentGashaId.value,
    },
    event_detail: {
      title: currentEvent.value?.title,
      id: currentEventId.value,
    },
    story_collection: {
      title: currentStoryCollection.value?.title,
      id: currentStorySection.value,
      domainLabel: currentStoryCollection.value?.domainLabel,
    },
    story_detail: {
      title: currentStory.value?.title,
      id: currentStoryFile.value,
      domainLabel: currentStory.value?.domainLabel,
    },
    seasonal_campaign: {
      title: currentSeasonalCampaign.value?.name,
      id: currentStorySection.value,
    },
    work_archive: {
      title: archiveTitle.value,
      id: currentCharacterId.value,
    },
    idol_story_archive: {
      title: archiveTitle.value,
      id: currentCharacterId.value,
    },
    mobile_archive: {
      title: archiveTitle.value,
      id: currentCharacterId.value,
    },
  }
  return buildArchiveBreadcrumbs(route, entityByView[view.value] || {
    title: archiveTitle.value,
  })
})

function idolSourceName(id, fallback = '') {
  if (!id) return ''
  return idolUnitData.value?.by_idol_code?.[id]?.display_name ||
    IDOL_ID_TO_NAME[id] ||
    indexData.value?.characters?.[id] ||
    fallback ||
    id
}

function idolTranslatedName(id) {
  idolEntityTranslationRevision.value
  return entityTranslationRepository.getEntry({
    entityType: 'idol',
    entityId: id,
    locale: storyTranslationLocale.value,
  })?.name || ''
}

function idolDisplayName(id) {
  const sourceName = idolSourceName(id)
  return uiLocale.value === 'ja-JP' ? sourceName : idolTranslatedName(id) || sourceName
}

function idolEntitySearchText(id, fallbackSourceName = '') {
  idolEntityTranslationRevision.value
  const sourceName = idolSourceName(id, fallbackSourceName)
  return entityTranslationRepository.getSearchText({
    entityType: 'idol',
    entityId: id,
    sourceName,
    locale: storyTranslationLocale.value,
  })
}

async function loadIdolEntityTranslations(locale = storyTranslationLocale.value) {
  await entityTranslationRepository.loadEntity({
    entityType: 'idol',
    locale,
    sourceNames: IDOL_ID_TO_NAME,
  })
  idolEntityTranslationRevision.value += 1
}

function currentArchiveRoute() {
  const returnsToEvent = view.value === 'player' && returnViewAfterPlayer.value === 'event_detail'
  const returnsToStory = view.value === 'player' && returnViewAfterPlayer.value === 'story_detail'
  const returnsToStoryCollection = view.value === 'player' && returnViewAfterPlayer.value === 'story_collection'
  const preservesEventContext = view.value === 'event_detail' || returnsToEvent
  const preservesStoryDetailContext = view.value === 'story_detail' || returnsToStory
  const preservesStoryCollectionContext = view.value === 'story_collection' || returnsToStoryCollection
  const preservesArchiveUnit = view.value === 'unit_detail' ||
    view.value === 'mobile_archive' ||
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
          : (preservesStoryCollectionContext ? storyCollectionParentView.value : '')),
  }
}

function syncArchiveRoute({ replace = false } = {}) {
  if (!archiveRouteReady || applyingArchiveRoute) return
  writeArchiveRoute(currentArchiveRoute(), { replace })
}

function commitView(nextView, options = {}) {
  view.value = nextView
  syncArchiveRoute(options)
}

function groupsForRoute(categoryId, idolId) {
  if (!categoryId) return []
  if (!idolId) return categoryById(categoryId)?.groups || []
  if (categoryId === 'idol_chat') {
    return categoryById('idol_chat')?.individual?.[idolId]?.groups ||
      groupChatByUnitCode('idol_chat', idolId)?.groups || []
  }
  if (categoryId === 'idol_phone') {
    return categoryById('idol_phone')?.individual?.[idolId]?.groups || []
  }
  return categoryById('idol')?.characters?.[idolId]?.groups || []
}

function resolveRouteGroup(route) {
  if (!route.group) return null
  return groupsForRoute(route.category, route.idol)
    .find(group => String(group.id) === route.group) || null
}

function resolveRouteUnit(route) {
  if (!route.unit) return null
  return episodeZeroUnits.value.find(unit =>
    String(unit.unit_code || unit.id) === route.unit,
  ) || null
}

function resolveRouteEpisode(unit, route) {
  if (!unit || !route.episode) return null
  return (unit.episodes || []).find(episode => String(episode.id) === route.episode) || null
}

async function ensureCardDetailData() {
  if (cardDetailData.value) return cardDetailData.value
  if (!cardDetailLoadPromise.value) {
    cardDetailLoadPromise.value = loadCardDetailData().then(data => {
      cardDetailData.value = data
      return data
    }).catch(error => {
      console.error('[ArchiveData] Failed to load cardDetailIndex:', error)
      cardDetailLoadPromise.value = null
      return null
    })
  }
  return cardDetailLoadPromise.value
}

async function ensureIdolCommunicationData() {
  if (idolEpisodeData.value && mobileArchiveData.value) {
    return { idolEpisode: idolEpisodeData.value, mobileArchive: mobileArchiveData.value }
  }
  if (!idolCommunicationLoadPromise.value) {
    idolCommunicationLoadPromise.value = loadIdolCommunicationData().then(data => {
      idolEpisodeData.value = data.idolEpisode
      mobileArchiveData.value = data.mobileArchive
      return data
    }).catch(error => {
      console.error('[ArchiveData] Failed to load idol communication indexes:', error)
      idolCommunicationLoadPromise.value = null
      return null
    })
  }
  return idolCommunicationLoadPromise.value
}

function restoreVoicePreview(route) {
  const card = cardMap.value.get(route.card)
  if (!card || !route.voice) return false
  const cue = (card.home_voice_cues || []).find(item => item?.cue === route.voice) ||
    (mergeCardDetail(card, cardDetailData.value)?.operational_voice_cues || []).find(item => item?.cue === route.voice) ||
    Object.values(card.card_text_voices || {}).find(item => item === route.voice) ||
    (card.voice_candidates?.unmapped_card_only || []).find(item => item === route.voice)
  if (!cue) return false
  currentScenario.value = buildCardVoicePreviewScenario(card, cue)
  currentScenarioFile.value = ''
  currentScenarioStartStep.value = null
  currentScenarioEndStep.value = null
  currentPreviewCue.value = route.voice
  returnViewAfterPlayer.value = route.returnView || 'card_detail'
  view.value = 'player'
  return true
}

async function applyArchiveRoute(route) {
  applyingArchiveRoute = true
  try {
    if (route.card && route.voice) await ensureCardDetailData()
    if ([
      'story_catalog',
      'external_story_resources',
      'idol_story_archive',
      'mobile_archive',
      'idol_detail',
    ].includes(route.view)) {
      await ensureIdolCommunicationData()
    }
    filterQuery.value = route.query || ''
    currentCategoryId.value = route.category || ''
    currentCharacterId.value = route.idol || ''
    currentCardId.value = route.card || ''
    currentEventId.value = route.event || ''
    eventParentView.value = route.parentView || ''
    storyDetailParentView.value = (
      route.view === 'story_detail' ||
      (route.view === 'player' && route.returnView === 'story_detail')
    ) ? (route.parentView || '') : ''
    storyCollectionParentView.value = (
      route.view === 'story_collection' ||
      (route.view === 'player' && route.returnView === 'story_collection')
    ) ? (route.parentView || '') : ''
    currentGashaId.value = route.gasha || ''
    currentGashaCategory.value = route.gashaType || 'all'
    currentCardRarity.value = route.rarity || 'all'
    currentCardAssetState.value = route.assetState || 'all'
    currentCardRelationState.value = route.relationState || 'all'
    currentIdolUnitFilter.value = route.unitFilter || ''
    currentStoryDomain.value = route.storyType || ''
    currentStoryMode.value = route.storyMode || 'portal'
    currentStorySection.value = route.storySection || ''
    currentStoryFile.value = route.story || ''
    currentEventScope.value = route.eventScope || 'all'
    currentStoryAvailability.value = route.availability || 'all'
    currentStorySort.value = route.sort || 'domain'
    currentMobileMode.value = route.mobileMode || 'personal'
    currentMobileScenarioId.value = route.mobileScenario || ''
    if (['idol_story_archive', 'mobile_archive'].includes(route.view) && !idolEpisodeData.value?.by_idol_code?.[currentCharacterId.value]) {
      currentCharacterId.value = idolEpisodeData.value?.chapters?.[0]?.idol_code || '001tom'
    }
    if (route.view === 'mobile_archive' && !mobileArchiveData.value?.by_unit_code?.[currentArchiveUnitCode.value]) {
      currentArchiveUnitCode.value = idolUnitData.value?.units?.[0]?.unit_code || '01jup'
    }
    currentEpisodeId.value = route.episode || ''
    const requestedHomeIdol = archiveHomeIdols.value.find(idol => idol.id === route.homeIdol) || archiveHomeIdols.value[0]
    homeSelectedId.value = requestedHomeIdol?.id || '001tom'
    homeSelectedCue.value = requestedHomeIdol?.cues?.find(cue => cue.cue === route.homeCue)?.cue || requestedHomeIdol?.cues?.[0]?.cue || ''
    const defaultHomeModel = requestedHomeIdol?.cues?.find(cue => cue.cue === homeSelectedCue.value)?.modelId
    homeSelectedCostume.value = requestedHomeIdol?.costumes?.find(costume => costume.modelId === route.homeCostume)?.modelId ||
      requestedHomeIdol?.costumes?.find(costume => costume.modelId === defaultHomeModel)?.modelId ||
      requestedHomeIdol?.costumes?.[0]?.modelId || ''
    const restoresEventContext = route.view === 'event_detail' ||
      (route.view === 'player' && route.returnView === 'event_detail')
    currentArchiveUnitCode.value = (
      ['unit_catalog', 'unit_detail', 'mobile_archive'].includes(route.view) ||
      (route.view === 'player' && route.returnView === 'unit_detail') ||
      (restoresEventContext && route.parentView === 'unit_detail')
    ) ? (route.unit || (route.view === 'mobile_archive' ? (idolUnitData.value?.units?.[0]?.unit_code || '01jup') : '')) : ''
    currentGroup.value = resolveRouteGroup(route)
    currentUnit.value = resolveRouteUnit(route)
    currentScenario.value = null
    currentScenarioFile.value = ''
    currentScenarioStartStep.value = route.startStep || null
    currentScenarioEndStep.value = route.endStep || null
    currentPreviewCue.value = ''
    returnViewAfterPlayer.value = route.returnView || 'files'

    const episode = resolveRouteEpisode(currentUnit.value, route)
    if (route.view === 'files' && episode) {
      currentGroup.value = {
        id: episode.id,
        title: episode.title,
        files: groupFileList(episode),
      }
    }

    if (route.view === 'player' && route.scenario) {
      const restoredQueue = restoreEpisodeQueue(route.scenario, route.returnView)
      await loadScenario(route.scenario, route.returnView || 'home', {
        syncRoute: false,
        startStep: route.startStep,
        endStep: route.endStep,
        preserveQueue: restoredQueue,
      })
      return
    }
    if (route.view === 'player' && route.voice) {
      await storyViewerLoader()
      if (restoreVoicePreview(route)) return
    }
    if (route.view === 'spine_lab') await spineViewerLoader()
    if (route.view === 'chibi_stage') await chibiStageViewerLoader()

    if (route.view === 'unit_detail' && !currentArchiveUnit.value) view.value = 'unit_catalog'
    else if (route.view === 'idol_detail' && !currentIdolProfile.value) view.value = 'idols'
    else if (route.view === 'card_detail' && !currentCard.value) view.value = 'cards'
    else if (route.view === 'gasha_detail' && !currentGasha.value) view.value = 'gashas'
    else if (route.view === 'event_detail' && !currentEvent.value) view.value = 'story_catalog'
    else if (route.view === 'story_detail' && !currentStory.value) view.value = 'story_catalog'
    else if (route.view === 'story_collection' && !currentStoryCollection.value) view.value = 'story_catalog'
    else if (route.view === 'seasonal_campaign' && !currentSeasonalCampaign.value) view.value = 'story_catalog'
    else if (route.view === 'work_archive' && !currentWorkIdol.value) view.value = 'story_catalog'
    else if (route.view === 'idol_story_archive' && !currentIdolStoryPage.value) view.value = 'story_catalog'
    else if (route.view === 'mobile_archive' && !mobileArchiveData.value) view.value = 'story_catalog'
    else if (route.view === 'cards' && !currentCharacterId.value) view.value = 'idols'
    else if (route.view === 'files' && !currentGroup.value) view.value = currentCharacterId.value ? 'groups' : 'home'
    else if (route.view === 'episodes' && !currentUnit.value) view.value = 'episode_zero_units'
    else view.value = route.view || 'home'
  } finally {
    applyingArchiveRoute = false
  }
}

function goHome() {
  filterQuery.value = ''
  currentCategoryId.value = ''
  currentCharacterId.value = ''
  currentGroup.value = null
  currentUnit.value = null
  currentArchiveUnitCode.value = ''
  currentEpisodeId.value = ''
  currentCardId.value = ''
  currentEventId.value = ''
  eventParentView.value = ''
  storyDetailParentView.value = ''
  storyCollectionParentView.value = ''
  currentGashaId.value = ''
  currentCardRarity.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  currentIdolUnitFilter.value = ''
  currentStoryDomain.value = ''
  currentStoryMode.value = 'portal'
  currentStorySection.value = ''
  currentStoryFile.value = ''
  currentEventScope.value = 'all'
  currentStoryAvailability.value = 'all'
  currentStorySort.value = 'domain'
  currentMobileMode.value = 'personal'
  currentMobileScenarioId.value = ''
  commitView('home')
}

function navigateArchiveSection(section) {
  if (section === 'home') goHome()
  else if (section === 'stories') openStoryCatalog()
  else if (section === 'idols') openPrimaryIdol(currentCharacterId.value)
  else if (section === 'cards') openPrimaryCards(currentCharacterId.value)
  else if (section === 'interactions') openMobileArchive({ idolCode: currentCharacterId.value || '001tom', mode: 'personal' })
  else if (section === 'gashas') openGashaCatalog()
  else if (section === 'resources') openArchiveStatus()
}

function openHomeIdol(idolId) {
  currentCategoryId.value = 'idol'
  openIdol({ id: idolId })
}

function openHomeCards(idolId) {
  currentCategoryId.value = 'cards'
  openIdol({ id: idolId })
}

function openHomeChat(idolId) {
  openMobileArchive({ idolCode: idolId, mode: 'personal' })
}

function goArchiveBack() {
  const backByView = {
    idols: goHome,
    idol_detail: goHome,
    groups: goBackFromGroups,
    episode_zero_units: goHome,
    episodes: goBackToUnits,
    files: goBackToFiles,
    cards: goBackFromCards,
    card_detail: goBackToCards,
    gashas: goHome,
    gasha_detail: () => {
      currentGashaId.value = ''
      commitView('gashas')
    },
    event_detail: goBackFromEvent,
    archive_status: goHome,
    story_catalog: () => {
      if (currentStoryMode.value === 'portal' && currentStoryDomain.value === 'main') {
        currentStoryDomain.value = ''
        currentStorySection.value = ''
        commitView('story_catalog')
        return
      }
      goHome()
    },
    external_story_resources: () => commitView('story_catalog'),
    story_detail: () => {
      const parent = storyDetailParentView.value
      currentStoryFile.value = ''
      storyDetailParentView.value = ''
      commitView(parent === 'external_story_resources' ? 'external_story_resources' : 'story_catalog')
    },
    story_collection: () => {
      const parent = storyCollectionParentView.value
      const domain = currentStoryDomain.value
      const returnsToDomainLanding = ['main', 'extra', 'birthday'].includes(domain) && parent !== 'external_story_resources'
      currentStoryDomain.value = returnsToDomainLanding ? domain : ''
      currentStorySection.value = ''
      currentStoryFile.value = ''
      storyCollectionParentView.value = ''
      currentStoryMode.value = 'portal'
      commitView(parent === 'external_story_resources' ? 'external_story_resources' : 'story_catalog')
    },
    seasonal_campaign: () => {
      currentStoryDomain.value = ''
      currentStorySection.value = ''
      commitView('story_catalog')
    },
    work_archive: () => {
      currentStoryDomain.value = ''
      currentCharacterId.value = ''
      commitView('story_catalog')
    },
    idol_story_archive: () => {
      currentCharacterId.value = ''
      commitView('story_catalog')
    },
    mobile_archive: () => {
      currentCharacterId.value = ''
      currentArchiveUnitCode.value = ''
      currentMobileScenarioId.value = ''
      goHome()
    },
    unit_catalog: () => commitView('idols'),
    unit_detail: () => {
      currentArchiveUnitCode.value = ''
      commitView('unit_catalog')
    },
  }
  const handler = backByView[view.value] || goHome
  handler()
}

async function openSpineLab() {
  loading.value = true
  preloadProgress.value = 100
  try {
    await spineViewerLoader()
    commitView('spine_lab')
  } finally {
    loading.value = false
  }
}

async function openChibiStage() {
  loading.value = true
  preloadProgress.value = 100
  try {
    await chibiStageViewerLoader()
    commitView('chibi_stage')
  } finally {
    loading.value = false
  }
}

function openArchiveStatus() {
  filterQuery.value = ''
  currentStoryDomain.value = ''
  currentEventScope.value = 'all'
  currentStoryAvailability.value = 'all'
  currentStorySort.value = 'domain'
  commitView('archive_status')
}

function openGashaCatalog() {
  filterQuery.value = ''
  currentCategoryId.value = ''
  currentCharacterId.value = ''
  currentCardId.value = ''
  currentGashaId.value = ''
  currentGashaCategory.value = 'all'
  commitView('gashas')
}

async function openStoryCatalog() {
  await ensureIdolCommunicationData()
  filterQuery.value = ''
  currentStoryDomain.value = ''
  currentStoryMode.value = 'portal'
  currentStorySection.value = ''
  currentStoryFile.value = ''
  storyDetailParentView.value = ''
  storyCollectionParentView.value = ''
  currentEventScope.value = 'all'
  currentStoryAvailability.value = 'all'
  currentStorySort.value = 'domain'
  currentMobileMode.value = 'personal'
  currentMobileScenarioId.value = ''
  storyVisibleLimit.value = 80
  commitView('story_catalog')
}

function openExternalStoryResources() {
  filterQuery.value = ''
  currentStoryDomain.value = ''
  currentStorySection.value = ''
  currentStoryFile.value = ''
  storyDetailParentView.value = ''
  storyCollectionParentView.value = ''
  commitView('external_story_resources')
}

function openExternalStoryInternal(entry) {
  const target = entry?.target
  if (target?.kind === 'event') {
    openEventDetail(target.event, 'external_story_resources')
    return
  }
  if (target?.kind === 'story') {
    openStoryDetail(target.story, 'external_story_resources')
    return
  }
  if (target?.kind === 'idol-story') {
    openIdolStoryArchive(target.idolCode)
    return
  }
  if (target?.kind !== 'collection') return
  currentStoryDomain.value = target.domain
  currentStorySection.value = target.section
  currentStoryMode.value = 'portal'
  currentStoryFile.value = target.storyFile
  storyCollectionParentView.value = 'external_story_resources'
  commitView('story_collection')
}

function setStoryDomain(domain) {
  currentStoryDomain.value = domain
  currentStorySection.value = ''
  currentStoryMode.value = 'search'
  currentEventScope.value = 'all'
  storyVisibleLimit.value = 80
}

function setStoryMode(mode) {
  currentStoryMode.value = mode === 'search' ? 'search' : 'portal'
  if (currentStoryMode.value === 'portal') {
    filterQuery.value = ''
    currentStoryDomain.value = ''
    currentStorySection.value = ''
  }
}

function browseStoryCollection({ domain, section = '', mode = '' }) {
  if (section && ['main', 'unit_story', 'extra', 'birthday'].includes(domain)) {
    currentStoryDomain.value = domain
    currentStorySection.value = section
    currentStoryMode.value = 'portal'
    currentStoryFile.value = ''
    storyCollectionParentView.value = ''
    commitView('story_collection')
    return
  }
  const opensFormalDomain = (mode === 'portal' && domain === 'main') ||
    ['extra', 'birthday'].includes(domain)
  if (opensFormalDomain) {
    currentStoryDomain.value = domain
    currentStorySection.value = ''
    currentStoryMode.value = 'portal'
    currentStoryFile.value = ''
    storyCollectionParentView.value = ''
    currentEventScope.value = 'all'
    storyVisibleLimit.value = 80
    commitView('story_catalog')
    return
  }
  filterQuery.value = ''
  currentStoryDomain.value = domain || ''
  currentStorySection.value = section || ''
  currentEventScope.value = 'all'
  currentStoryMode.value = 'search'
  storyVisibleLimit.value = 80
}

function openSeasonalCampaign(campaignId = 'valentine_2023') {
  const fallback = seasonalCampaignData.value?.campaigns?.[0]?.id || ''
  currentStoryDomain.value = 'seasonal_campaign'
  currentStoryMode.value = 'portal'
  currentStorySection.value = seasonalCampaignData.value?.by_id?.[campaignId] ? campaignId : fallback
  commitView('seasonal_campaign')
}

function selectSeasonalCampaign(campaignId) {
  if (!seasonalCampaignData.value?.by_id?.[campaignId]) return
  currentStorySection.value = campaignId
  syncArchiveRoute()
}

function playSeasonalCampaignStory(file) {
  if (file) loadScenario(file, 'seasonal_campaign')
}

function openWorkArchive(idolCode = '001tom') {
  const fallback = workStoryData.value?.idols?.[0]?.idol_code || ''
  const selected = workStoryData.value?.by_idol_code?.[idolCode] ? idolCode : fallback
  if (!selected) return
  currentStoryDomain.value = 'work'
  currentStoryMode.value = 'portal'
  currentStorySection.value = ''
  currentCharacterId.value = selected
  commitView('work_archive')
}

function selectWorkIdol(idolCode) {
  if (!workStoryData.value?.by_idol_code?.[idolCode]) return
  currentCharacterId.value = idolCode
  syncArchiveRoute()
}

function playWorkStory(file) {
  if (file) loadScenario(file, 'work_archive')
}

async function openIdolStoryArchive(idolCode = '001tom') {
  await ensureIdolCommunicationData()
  const fallback = idolEpisodeData.value?.chapters?.[0]?.idol_code || ''
  const selected = idolEpisodeData.value?.by_idol_code?.[idolCode] ? idolCode : fallback
  if (!selected) return
  filterQuery.value = ''
  currentStoryDomain.value = 'idol_story'
  currentStoryMode.value = 'portal'
  currentStorySection.value = ''
  currentCharacterId.value = selected
  currentMobileScenarioId.value = ''
  commitView('idol_story_archive')
}

function selectIdolStory(idolCode) {
  if (!idolEpisodeData.value?.by_idol_code?.[idolCode]) return
  currentCharacterId.value = idolCode
  currentMobileScenarioId.value = ''
  syncArchiveRoute()
}

function playIdolStorySection(section) {
  const queue = (section?.episodes || []).filter(episode => episode.exists && episode.file)
  if (queue.length) startEpisodeQueue(queue, 0, 'idol_story_archive')
}

function playIdolStoryEpisode({ section, episode }) {
  const queue = (section?.episodes || []).filter(candidate => candidate.exists && candidate.file)
  const index = queue.findIndex(candidate => candidate.id === episode?.id)
  if (index >= 0) startEpisodeQueue(queue, index, 'idol_story_archive')
}

async function openMobileArchive({ idolCode = '001tom', mode = 'personal', scenarioId = '' } = {}) {
  await ensureIdolCommunicationData()
  const fallbackIdol = idolEpisodeData.value?.chapters?.[0]?.idol_code || '001tom'
  const fallbackUnit = idolUnitData.value?.units?.[0]?.unit_code || '01jup'
  currentCharacterId.value = idolEpisodeData.value?.by_idol_code?.[idolCode] ? idolCode : fallbackIdol
  currentArchiveUnitCode.value = mobileArchiveData.value?.by_unit_code?.[currentArchiveUnitCode.value]
    ? currentArchiveUnitCode.value
    : fallbackUnit
  currentMobileMode.value = ['personal', 'phone', 'unit', 'random'].includes(mode) ? mode : 'personal'
  currentMobileScenarioId.value = scenarioId ? String(scenarioId) : ''
  currentStoryDomain.value = 'mobile_archive'
  currentStoryMode.value = 'portal'
  commitView('mobile_archive')
}

function openStoryCommunication(scenario) {
  openMobileArchive({
    idolCode: scenario?.idol_code || currentCharacterId.value,
    mode: scenario?.kind === 'idol_phone' ? 'phone' : 'personal',
    scenarioId: scenario?.id || '',
  })
}

function selectMobileIdol(idolCode) {
  if (!idolEpisodeData.value?.by_idol_code?.[idolCode]) return
  currentCharacterId.value = idolCode
  currentMobileScenarioId.value = ''
  syncArchiveRoute()
}

function selectMobileUnit(unitCode) {
  if (!mobileArchiveData.value?.by_unit_code?.[unitCode]) return
  currentArchiveUnitCode.value = unitCode
  currentMobileScenarioId.value = ''
  syncArchiveRoute()
}

function setMobileMode(mode) {
  if (!['personal', 'phone', 'unit', 'random'].includes(mode)) return
  currentMobileMode.value = mode
  currentMobileScenarioId.value = ''
  syncArchiveRoute()
}

function playMobileScenario(file) {
  if (file) loadScenario(file, 'mobile_archive')
}

function openMobileCard(cardId) {
  const card = (cardIndexData.value?.cards || []).find(entry => Number(entry.card_id) === Number(cardId))
  if (!card) return
  currentCategoryId.value = 'cards'
  currentCharacterId.value = card.character_id
  currentCardId.value = card.resource_id
  commitView('card_detail')
}

function openUnitCatalog() {
  filterQuery.value = ''
  currentCategoryId.value = 'idol'
  currentCharacterId.value = ''
  currentArchiveUnitCode.value = ''
  commitView('unit_catalog')
}

function openArchiveUnit(unit) {
  if (!unit) return
  currentCategoryId.value = 'idol'
  currentCharacterId.value = ''
  currentArchiveUnitCode.value = String(unit.unit_code || unit.unit_id)
  commitView('unit_detail')
}

function openUnitFromIdol(idol) {
  const unit = (idolUnitData.value?.units || []).find(entry => String(entry.unit_code) === String(idol?.unit_code))
  if (unit) openArchiveUnit(unit)
}

function openUnitMember(member) {
  currentCategoryId.value = 'idol'
  currentCharacterId.value = member.idol_code
  currentArchiveUnitCode.value = ''
  commitView('idol_detail')
}

function openUnitStory(story) {
  if (story?.file && story.exists) loadScenario(story.file, 'unit_detail')
}

function openUnitEvent(event) {
  openEventDetail(event, 'unit_detail')
}

function openUnitCards() {
  const unitId = String(currentArchiveUnit.value?.unit_id || '')
  if (!unitId) return
  filterQuery.value = ''
  currentCategoryId.value = 'cards'
  currentCharacterId.value = ''
  currentArchiveUnitCode.value = ''
  currentIdolUnitFilter.value = unitId
  currentCardRarity.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  commitView('idols')
}

function openCatalogStory(entry) {
  if (entry?.eventRelation) openEventDetail(entry.eventRelation, 'story_catalog')
  else openStoryDetail(entry)
}

function openStoryDetail(entry, parentView = '') {
  if (!entry?.file) return
  currentStoryFile.value = entry.file
  storyDetailParentView.value = parentView
  commitView('story_detail')
}

function playStoryDetail(entry = currentStory.value) {
  if (entry?.file && entry.exists) loadScenario(entry.file, 'story_detail')
}

function playStoryCollectionChapter(chapter) {
  const queue = (chapter?.episodes || []).filter(episode => episode.exists && episode.file)
  if (queue.length) startEpisodeQueue(queue, 0, 'story_collection')
  else if (chapter?.file && chapter.exists) loadScenario(chapter.file, 'story_collection')
}

function playStoryCollectionEpisode({ chapter, episode }) {
  const queue = (chapter?.episodes || []).filter(candidate => candidate.exists && candidate.file)
  const index = queue.findIndex(candidate => candidate.id === episode?.id)
  if (index >= 0) startEpisodeQueue(queue, index, 'story_collection')
}

function openStoryIdol(idolCode) {
  if (!/^\d{3}[a-z0-9]{3}$/i.test(idolCode)) return
  currentCategoryId.value = 'idol'
  currentCharacterId.value = idolCode
  commitView('idol_detail')
}

function goBackToCards() {
  currentCardId.value = ''
  commitView('cards')
}

function goBackToUnits() {
  currentUnit.value = null
  currentEpisodeId.value = ''
  currentGroup.value = null
  commitView('episode_zero_units')
}

// Navigation.
function openCategoryById(categoryId) {
  const category = CATEGORIES.find(item => item.id === categoryId)
  if (category) openCategory(category)
}

function openCategory(cat) {
  filterQuery.value = ''
  currentStoryDomain.value = ''
  currentEventScope.value = 'all'
  currentStoryAvailability.value = 'all'
  currentStorySort.value = 'domain'
  currentUnit.value = null
  currentEpisodeId.value = ''
  currentCardId.value = ''
  currentIdolUnitFilter.value = ''
  if (cat.id === 'idol') {
    openPrimaryIdol(currentCharacterId.value)
  } else if (cat.id === 'cards') {
    openPrimaryCards(currentCharacterId.value)
  } else if (cat.id === 'idol_chat' || cat.id === 'idol_phone') {
    openMobileArchive({
      idolCode: currentCharacterId.value || '001tom',
      mode: cat.id === 'idol_phone' ? 'phone' : 'personal',
    })
  } else if (cat.id === 'episode_zero') {
    currentCategoryId.value = 'episode_zero'
    commitView('episode_zero_units')
  } else {
    currentCategoryId.value = cat.id
    currentCharacterId.value = ''
    currentGroup.value = null
    commitView('groups')
  }
}

function normalizedPrimaryIdol(idolCode = '') {
  return idolUnitData.value?.by_idol_code?.[idolCode] ? idolCode : '001tom'
}

function openPrimaryIdol(idolCode = '') {
  filterQuery.value = ''
  currentCategoryId.value = 'idol'
  currentCharacterId.value = normalizedPrimaryIdol(idolCode)
  currentGroup.value = null
  currentCardId.value = ''
  commitView('idol_detail')
}

function openPrimaryCards(idolCode = '') {
  filterQuery.value = ''
  currentCategoryId.value = 'cards'
  currentCharacterId.value = normalizedPrimaryIdol(idolCode)
  currentGroup.value = null
  currentCardId.value = ''
  currentCardRarity.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  commitView('cards')
}

function selectPrimaryIdol(idolCode) {
  if (!idolUnitData.value?.by_idol_code?.[idolCode]) return
  currentCharacterId.value = idolCode
  currentCardId.value = ''
  filterQuery.value = ''
  syncArchiveRoute()
}

function openIdol(entry) {
  filterQuery.value = ''
  // Group chat entry in idol_chat grid: go directly to file view.
  if (entry._isGroup && entry._groupData) {
    currentCharacterId.value = entry.id
    currentCategoryId.value = 'idol_chat'
    currentGroup.value = entry._groupData.groups[0]
    commitView('files')
    return
  }
  if (currentCategoryId.value === 'cards') {
    currentCharacterId.value = entry.id
    currentCardId.value = ''
    currentCardRarity.value = 'all'
    currentCardAssetState.value = 'all'
    currentCardRelationState.value = 'all'
    filterQuery.value = ''
    commitView('cards')
    return
  }
  if (currentCategoryId.value === 'idol') {
    currentCharacterId.value = entry.id
    currentGroup.value = null
    commitView('idol_detail')
    return
  }
  currentCharacterId.value = entry.id
  currentCategoryId.value = currentCategoryId.value || 'idol'
  currentGroup.value = null
  commitView('groups')
}

function openIdolDomain(domain) {
  if (domain === 'stories') {
    openIdolStoryArchive(currentCharacterId.value)
    return
  }
  if (domain === 'chat' || domain === 'phone') {
    openMobileArchive({
      idolCode: currentCharacterId.value,
      mode: domain === 'phone' ? 'phone' : 'personal',
    })
    return
  }
  const categoryByDomain = {
    cards: 'cards',
  }
  const category = categoryByDomain[domain]
  if (!category) return
  currentCategoryId.value = category
  currentGroup.value = null
  currentCardId.value = ''
  currentCardRarity.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  filterQuery.value = ''
  commitView(domain === 'cards' ? 'cards' : 'groups')
}

function openIdolEvent(event) {
  openEventDetail(event, 'idol_detail')
}

function openCard(card) {
  currentCardId.value = card.resource_id
  commitView('card_detail')
}

function openGasha(gasha) {
  if (!gasha?.id) return
  const preserveCatalogQuery = view.value === 'gashas'
  currentCategoryId.value = ''
  currentCharacterId.value = ''
  currentCardId.value = ''
  currentGashaId.value = String(gasha.id)
  if (!preserveCatalogQuery) filterQuery.value = ''
  commitView('gasha_detail')
}

function openCardGasha(relation) {
  if (!relation?.announcement_id) return
  const gasha = gashaIndexData.value?.by_id?.[String(relation.announcement_id)]
  if (gasha) openGasha(gasha)
}

function openGashaCard(relation) {
  const card = cardMap.value.get(relation?.card_resource_id)
  if (!card) return
  currentCategoryId.value = 'cards'
  currentCharacterId.value = card.character_id
  currentCardId.value = card.resource_id
  filterQuery.value = ''
  commitView('card_detail')
}

function openRelatedCard(card) {
  if (!card?.resource_id || !card?.character_id) return
  currentCategoryId.value = 'cards'
  currentCharacterId.value = card.character_id
  currentCardId.value = card.resource_id
  filterQuery.value = ''
  commitView('card_detail')
}

function goBackFromCards() {
  currentCardId.value = ''
  currentCardRarity.value = 'all'
  filterQuery.value = ''
  currentCategoryId.value = 'idol'
  commitView('idol_detail')
}

function openCardScenario(entry) {
  if (entry?.compiled_file) {
    loadScenario(entry.compiled_file, 'card_detail')
  }
}

async function previewCardVoice(cue) {
  const card = currentCard.value
  if (!card || !cue) return
  await openVoicePreview(card, cue, 'card_detail')
}

function openCardEvent(event) {
  openEventDetail(event, 'card_detail')
}

function openHomeEvent(event) {
  openEventDetail(event, 'home')
}

function openEventDetail(event, parentView = 'story_catalog') {
  if (!event?.event_id) return
  currentEventId.value = String(event.event_id)
  eventParentView.value = parentView
  commitView('event_detail')
}

function goBackFromEvent() {
  const parent = eventParentView.value
  currentEventId.value = ''
  eventParentView.value = ''
  if (parent === 'home') commitView('home')
  else if (parent === 'external_story_resources') commitView('external_story_resources')
  else if (parent === 'card_detail' && currentCard.value) commitView('card_detail')
  else if (parent === 'unit_detail' && currentArchiveUnit.value) commitView('unit_detail')
  else if (parent === 'idol_detail' && currentIdolProfile.value) commitView('idol_detail')
  else commitView('story_catalog')
}

function playCurrentEvent() {
  const queue = currentEventEpisodes.value.filter(episode => episode.file)
  if (queue.length) startEpisodeQueue(queue, 0, 'event_detail')
  else if (currentEvent.value?.file && currentEvent.value.exists) loadScenario(currentEvent.value.file, 'event_detail')
}

function playCurrentEventEpisode(episode) {
  const queue = currentEventEpisodes.value.filter(candidate => candidate.file)
  const index = queue.findIndex(candidate => candidate.id === episode?.id)
  if (index >= 0) startEpisodeQueue(queue, index, 'event_detail')
}

function startEpisodeQueue(episodes, index, returnView) {
  playbackQueue.value = episodes.map(episode => ({
    file: episode.file,
    startStep: episode.startStep,
    endStep: episode.endStep,
    id: episode.id,
    label: episode.label,
  }))
  playbackQueueIndex.value = index
  loadPlaybackEpisode(playbackQueue.value[index], returnView)
}

function restoreEpisodeQueue(scenarioFile, returnView) {
  let episodes = []
  if (returnView === 'story_collection') {
    episodes = (currentStoryCollection.value?.chapters || []).flatMap(chapter => chapter.episodes || [])
  } else if (returnView === 'event_detail') {
    episodes = currentEventEpisodes.value
  } else if (returnView === 'idol_story_archive') {
    episodes = (currentIdolStoryPage.value?.sections || []).flatMap(section => section.episodes || [])
  }
  const queue = episodes.filter(episode => episode.exists !== false && episode.file)
  const index = queue.findIndex(episode => episode.file === scenarioFile)
  if (index < 0) return false
  playbackQueue.value = queue.map(episode => ({
    file: episode.file,
    startStep: episode.startStep,
    endStep: episode.endStep,
    id: episode.id,
    label: episode.label,
  }))
  playbackQueueIndex.value = index
  return true
}

function loadPlaybackEpisode(episode, returnView = returnViewAfterPlayer.value) {
  if (!episode?.file) return
  loadScenario(episode.file, returnView, {
    startStep: episode.startStep,
    endStep: episode.endStep,
    preserveQueue: true,
  })
}

function playNextEpisode() {
  if (!hasNextPlaybackEpisode.value) return
  playbackQueueIndex.value += 1
  loadPlaybackEpisode(playbackQueue.value[playbackQueueIndex.value])
}

function openEventCard(relation) {
  const card = cardMap.value.get(relation?.card_resource_id)
  if (!card) return
  currentCategoryId.value = 'cards'
  currentCharacterId.value = card.character_id
  currentCardId.value = card.resource_id
  currentEventId.value = ''
  eventParentView.value = ''
  filterQuery.value = ''
  commitView('card_detail')
}

function openEventIdol(idol) {
  currentCategoryId.value = 'idol'
  currentCharacterId.value = idol.idol_code
  currentCardId.value = ''
  currentArchiveUnitCode.value = ''
  currentEventId.value = ''
  eventParentView.value = ''
  commitView('idol_detail')
}

function openEventUnit(unit) {
  currentEventId.value = ''
  eventParentView.value = ''
  openArchiveUnit(unit)
}

async function openVoicePreview(card, cue, returnView) {
  loading.value = true
  preloadProgress.value = 100
  try {
    await storyViewerLoader()
    currentScenario.value = buildCardVoicePreviewScenario(card, cue)
    currentScenarioFile.value = ''
    currentScenarioStartStep.value = null
    currentScenarioEndStep.value = null
    currentPreviewCue.value = typeof cue === 'string' ? cue : cue.cue
    returnViewAfterPlayer.value = returnView
    commitView('player')
  } finally {
    loading.value = false
  }
}

function buildCardVoicePreviewScenario(card, cue) {
  const cueId = typeof cue === 'string' ? cue : cue.cue
  const preview = typeof cue === 'object' ? cue.preview : null
  const cueText = typeof cue === 'object' && cue.text ? cue.text : `${card.title || card.resource_id}\n${cueId}`
  if (preview?.preview_step) {
    const step = JSON.parse(JSON.stringify(preview.preview_step))
    step.step_id = 1
    return {
      scenario_id: `card_voice_preview_${card.resource_id}_${cueId}`,
      source_scenario_id: preview.scenario_id,
      source_compiled_file: preview.compiled_file,
      total_steps: 1,
      steps: [step],
    }
  }
  const charaId = card.character_id || card.resource_id?.slice(0, 6) || ''
  const voiceBase = card.voice_base || cueId.split('_').slice(0, 5).join('_')
  const model = `${charaId}_002_00`
  return {
    scenario_id: `card_voice_preview_${card.resource_id}_${cueId}`,
    total_steps: 1,
    steps: [
      {
        step_id: 1,
        type: 'adv',
        chara_id: charaId,
        state: {
          bg: 'bg001_315pro_in_01',
          bg_effect: null,
          bg_transition: null,
          bg_effects: [],
          bg_profile: null,
          bgm: null,
          bgm_volume: 100,
          se: null,
          se_events: [],
          environmental: null,
          spines: [
            {
              id: charaId,
              model,
              face: 'face_default',
              anim: 'wait_loop',
              position: 0,
              visible: true,
              pos_x: 0,
              pos_y: 0,
              fade: { type: 'in', delay: 0, duration: 0 },
            },
          ],
          talk_mode: false,
          phone_mode: false,
          camera_zoom: null,
          screen_fade: null,
          screen_slide: null,
          screen_effects: [],
          bgm_stop_fade: null,
          environmental_volume: null,
          environmental_duck_target: null,
          camera_filter: null,
          bg_color: null,
          bg_dof: null,
          bg_color_transition: null,
          bg_dof_transition: null,
          text_disabled: false,
          image_icon: null,
        },
        dialogue: {
          speaker: currentCardCharacterName.value,
          text: cueText,
          text_jp: cueText,
          text_cn: '',
          voice: `${cueId}.m4a`,
          lip: {
            source: 'adxlip',
            path: `adxlip/${charaId}/${voiceBase}/${cueId}.json`,
          },
        },
      },
    ],
  }
}

function openGroup(group) {
  currentGroup.value = group
  currentEpisodeId.value = ''
  filterQuery.value = ''
  commitView('files')
}

function openScenarioEntry(entry) {
  if (entry?.file && !entry.missing) loadScenario(entry.file)
}

function openUnit(unit) {
  currentUnit.value = unit
  currentEpisodeId.value = ''
  filterQuery.value = ''
  commitView('episodes')
}

function openEpisodeFiles(ep) {
  // Create a synthetic group object from episode data
  currentGroup.value = { id: ep.id, title: ep.title, files: groupFileList(ep) }
  currentEpisodeId.value = String(ep.id)
  filterQuery.value = ''
  commitView('files')
}

function goBackFromGroups() {
  if (currentCharacterId.value) {
    if (currentCategoryId.value === 'idol') commitView('idol_detail')
    else {
      currentCharacterId.value = ''
      commitView('idols')
    }
  } else {
    goHome()
  }
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
  } else if (groupChatByUnitCode(currentCategoryId.value, currentCharacterId.value)) {
    currentGroup.value = null
    currentCharacterId.value = ''
    commitView('idols')
  } else if (currentCharacterId.value) {
    currentGroup.value = null
    commitView('groups')
  } else {
    currentGroup.value = null
    commitView('groups')
  }
}

function closePlayer() {
  currentScenario.value = null
  currentScenarioFile.value = ''
  currentScenarioStartStep.value = null
  currentScenarioEndStep.value = null
  currentPreviewCue.value = ''
  playbackQueue.value = []
  playbackQueueIndex.value = -1
  const returnView = returnViewAfterPlayer.value || 'files'
  returnViewAfterPlayer.value = 'files'
  commitView(returnView)
}

function onPlayerReady() {
  loading.value = false
}

function formatFileName(fn) {
  return fn.replace(/\.json$/, '').replace(/^[^_]+_[^_]+_scenario_/, '')
}

async function loadScenario(name, returnView = 'files', options = {}) {
  loading.value = true
  preloadProgress.value = 0
  try {
    const r = await fetch(`/data/compiled/${name}?v=${Date.now()}`, { cache: 'no-store' })
    const scenario = await r.json()

    // Preload all scenario assets before switching to player
    await Promise.all([
      storyViewerLoader(),
      Preloader.preloadScenario(scenario.steps || [], (pct) => {
        preloadProgress.value = pct
      }),
    ])

    currentScenario.value = scenario
    currentScenarioFile.value = name
    currentScenarioStartStep.value = Number(options.startStep) > 0 ? Number(options.startStep) : null
    currentScenarioEndStep.value = Number(options.endStep) > 0 ? Number(options.endStep) : null
    if (!options.preserveQueue) {
      playbackQueue.value = []
      playbackQueueIndex.value = -1
    }
    currentScenarioInstance.value += 1
    currentPreviewCue.value = ''
    returnViewAfterPlayer.value = returnView
    view.value = 'player'
    loading.value = false
    if (options.syncRoute !== false) syncArchiveRoute()
  } catch (err) {
    console.error('Failed to load:', err)
    loading.value = false
  }
}

onMounted(async () => {
  cardLayout.value = localStorage.getItem('sidem-archive-card-layout') === 'grid' ? 'grid' : 'compact'
  cardArtMode.value = localStorage.getItem('sidem-archive-card-art-mode') === 'framed' ? 'framed' : 'clean'
  const initialRoute = readArchiveRoute()
  const entityTranslations = loadIdolEntityTranslations().catch(error => {
    console.error('[EntityTranslations] Failed to load idols:', error)
  })
  const { data, errors } = await loadArchiveData()
  indexData.value = data.compiledIndex
  cardIndexData.value = data.cardIndex
  gashaIndexData.value = data.gashaIndex
  eventIndexData.value = data.eventIndex
  storyMasterData.value = data.storyMaster
  storyPresentationData.value = data.storyPresentation
  seasonalCampaignData.value = data.seasonalCampaign
  workStoryData.value = data.workStory
  idolUnitData.value = data.idolUnit
  speakerDictionaryData.value = data.speakerDictionary
  costumeDictionaryData.value = data.costumeDictionary
  archiveManifestData.value = data.archiveManifest
  archiveVerificationData.value = data.archiveVerification
  uiAssetCatalogData.value = data.uiAssetCatalog
  rawCharacterImagePromotionsData.value = data.rawCharacterImagePromotions
  externalStoryResourcesData.value = data.externalStoryResources
  for (const { key, error } of errors) {
    console.error(`[ArchiveData] Failed to load ${key}:`, error)
  }
  await entityTranslations


  await applyArchiveRoute(initialRoute)
  loading.value = false
  archiveRouteReady = true
  writeArchiveRoute(currentArchiveRoute(), { replace: true })
  removeArchivePopState = onArchivePopState(route => {
    applyArchiveRoute(route).catch(error => {
      console.error('[ArchiveRoute] Failed to restore browser history:', error)
    })
  })
  removeSpineAnimationDebug = installSpineAnimationDebug()
})

watch([filterQuery, currentCardRarity, currentCardAssetState, currentCardRelationState, currentGashaCategory, currentIdolUnitFilter, currentStoryDomain, currentStoryMode, currentStorySection, currentEventScope, currentStoryAvailability, currentStorySort, currentMobileMode, currentMobileScenarioId], () => {
  syncArchiveRoute({ replace: true })
})

watch([homeSelectedId, homeSelectedCue, homeSelectedCostume], () => {
  if (view.value === 'home') syncArchiveRoute({ replace: true })
})

watch([filterQuery, currentStoryDomain, currentStorySection, currentEventScope, currentStoryAvailability, currentStorySort], () => {
  storyVisibleLimit.value = 80
})

watch([view, currentCardId], ([nextView, cardId]) => {
  if (nextView === 'card_detail' && cardId) ensureCardDetailData()
})

watch(cardLayout, layout => {
  localStorage.setItem('sidem-archive-card-layout', layout)
})

watch(cardArtMode, mode => {
  localStorage.setItem('sidem-archive-card-art-mode', mode)
})

watch(storyTranslationLocale, locale => {
  loadIdolEntityTranslations(locale).catch(error => {
    console.error('[EntityTranslations] Failed to reload idols:', error)
  })
})

onBeforeUnmount(() => {
  removeArchivePopState?.()
  removeSpineAnimationDebug?.()
})
</script>

<style scoped>
#story-viewer {
  width: 100%; height: 100vh; color: #222;
  background: #f8f9fa; overflow: hidden;
}
</style>

<style>
/* Global reset: no page-level scrollbar */
html, body { margin: 0; padding: 0; height: 100%; overflow-x: hidden; overflow-y: hidden; }
*, *::before, *::after { box-sizing: border-box; }
#app { overflow-x: hidden; }
</style>
