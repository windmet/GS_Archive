<template>
  <div id="story-viewer">

    <StoryReleaseSoakPanel v-if="RUNTIME_DEBUG" />

    <ArchiveShell
      v-if="archiveShellVisible"
      :model-value="filterQuery"
      @update:model-value="updateArchiveFilter('filterQuery', $event)"
      :active-section="archiveSection"
      :title="archiveTitle"
      :searchable="archiveSearchable"
      :search-placeholder="archiveSearchPlaceholder"
      :show-back="archiveShowBack"
      :breadcrumbs="archiveBreadcrumbs"
      @navigate="navigateArchiveSection"
      @back="goArchiveBack"
    >
      <ArchiveStoryReader v-if="view === 'reader'" :state="readingState" :document-id="readingDocumentId" :mode="readingMode" :anchor="readingRowId"
        :notice="readingPlaybackNotice" :busy="loading" @refresh="refreshStoryReader" @play-document="openReaderPlayback(readingRowId, { fullDocument: true })" @select="openStoryReader" @mode="updateReadingMode" @locate="locateReadingRow" @back="closeStoryReader" @retry="openStoryReader(readingDocumentId)" />
      <ArchivePortalLauncher
        v-if="view === 'portal'"
        :preferred-reference="preferredArchiveIdolReference"
        :idols="archivePickerIdols"
        :preference-notice="userPreferenceNotice"
        @save-preferred="savePreferredIdol"
        :loading-section="homeEntryStatus || legacyEntryStatus"
        :can-go-back="Boolean(portalFrom)"
        @navigate="navigateArchiveSection"
        @back="closeArchivePortal"
        @settings="openWelcomeSettings"
        @open-home="openGameHome"
        @open-preferred="openPreferredDestination"
      />
      <ArchiveWelcome
        v-if="view === 'welcome' || view === 'idol_picker' || (view === 'home' && !homeSelectedId)"
        :idols="view === 'idol_picker' && currentPickTarget !== 'home' ? archivePickerIdols : archiveHomeIdols"
        :preferences="userPreferences"
        :preferred-idols="archivePickerIdols"
        :notice="userPreferenceNotice"
        :data-ready="archiveBootstrap.idols.length > 0"
        :selection-only="view === 'home' || view === 'idol_picker'"
        :can-cancel="view === 'idol_picker' || (view === 'welcome' && Boolean(detailSourceRoute))"
        :target-label="idolPickerLabel"
        @cancel="cancelWelcomeOrPicker"
        @choose-light="chooseLightStartup"
        @choose-later="chooseStartupLater"
        @choose-idol="chooseImmersiveIdol"
        @save-preferred="savePreferredIdol"
        @clear-preferences="clearUserPreferences"
      />
      <p v-if="view === 'home' && homeEntryStatus" class="home-read-model-status" role="status">{{ homeEntryStatus }}</p>
      <ArchiveImmersiveHome
        v-if="view === 'home' && homeSelectedId"
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
        :model-value="filterQuery"
        @update:model-value="updateArchiveFilter('filterQuery', $event)"
        :title="categoryHeaderText"
        :filter-placeholder="categoryFilterPlaceholder"
        :idols="filteredIdols"
        :unit-options="idolUnitOptions"
        :current-unit="currentIdolUnitFilter"
        :idols-before-unit-filter="searchMatchedIdols.length"
        @back="goArchiveBack"
        @select="openIdol"
        @select-unit="updateArchiveFilter('currentIdolUnitFilter', $event)"
        @open-units="openUnitCatalog"
      />

      <ArchiveCardList
        v-if="view === 'cards'"
        embedded
        :model-value="filterQuery"
        @update:model-value="updateArchiveFilter('filterQuery', $event)"
        :title="currentCardCharacterName"
        :cards="filteredCardRows"
        :rarity-tabs="cardRarityTabs"
        :current-rarity="currentCardRarity"
        :current-asset-state="currentCardAssetState"
        :current-relation-state="currentCardRelationState"
        :idols="bootstrapIdolSwitcher"
        :selected-idol="currentCharacterId"
        v-model:layout="cardLayout"
        @back="goArchiveBack"
        @select-card="openCard"
        @select-rarity="updateArchiveFilter('currentCardRarity', $event)"
        @select-asset-state="updateArchiveFilter('currentCardAssetState', $event)"
        @select-relation-state="updateArchiveFilter('currentCardRelationState', $event)"
        @select-idol="selectCardIdol"
      />

      <ArchiveIdolDetail
        v-if="view === 'idol_detail'"
        :idol="currentIdolProfile"
        :stats="currentIdolStats"
        :events="currentIdolEvents"
        :songs="currentIdolSongs"
        :idols="bootstrapIdolSwitcher"
        :selected-idol="currentCharacterId"
        @open-domain="openIdolDomain"
        @open-unit="openUnitFromIdol"
        @open-event="openIdolEvent"
        @open-song="openSong"
        @select-idol="selectPrimaryIdol"
      />
      <p v-if="['idols', 'idol_detail'].includes(view) && idolReadModelStatus" class="idol-read-model-status" role="status">{{ idolReadModelStatus }}</p>

      <ArchiveCardDetail
        v-if="view === 'card_detail'"
        embedded
        :card="currentCard"
        :owner-reference="currentCardOwnerReference"
        :asset-status="currentCardAssetStatus"
        :art-mode="cardArtMode"
        :previous-card="previousCard"
        :next-card="nextCard"
        :series-cards="currentSeriesCards"
        :event-relation="currentCardEventRelation"
        :gasha-relation="currentCardGashaRelation"
        @back="goArchiveBack"
        @preview-voice="previewCardVoice"
        @open-scenario="openCardScenario"
        @navigate-card="openCard"
        @navigate-related-card="openRelatedCard"
        @open-event="openCardEvent"
        @open-gasha="openCardGasha"
        @open-idol="openCardIdol"
        @update:art-mode="cardArtMode = $event"
      />

      <ArchiveGashaCatalog
        v-if="view === 'gashas'"
        :gashas="filteredGashas"
        :category-options="gashaCategoryOptions"
        :category="currentGashaCategory"
        :total-gashas="gashaCatalog.length"
        :announcement-count="gashaReadModelCatalog?.summary?.gasha_count || 0"
        :pickup-count="gashaReadModelCatalog?.summary?.derived_pickup_count || 0"
        @select="openGasha"
        @update:category="updateArchiveFilter('currentGashaCategory', $event)"
      />

      <ArchiveGashaDetail
        v-if="view === 'gasha_detail'"
        :gasha="currentGasha"
        :idol-name="idolDisplayName"
        @open-card="openGashaCard"
      />

      <ArchiveSongCatalog
        v-if="view === 'song_catalog'"
        :catalog="songReadModelCatalog"
        :status="songReadModelStatus"
        :scope="currentSongScope"
        :query="filterQuery"
        @open="openSong"
        @retry="ensureSongCatalog"
        @update:scope="updateArchiveFilter('currentSongScope', $event)"
        @update:query="updateArchiveFilter('filterQuery', $event)"
      />

      <p v-if="view === 'song_detail' && (songReadModelStatus || legacyEntryStatus)" class="song-read-model-status" role="status">{{ songReadModelStatus || legacyEntryStatus }}</p>
      <ArchiveSongDetail
        v-if="view === 'song_detail' && currentSongPresentation"
        :song="currentSongPresentation"
        @open-song="openSong"
        @open-unit="openSongUnit"
        @open-idol="openSongIdol"
        @open-related-story="openSongRelatedStory"
        @open-stage="openSongStage"
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
        :projected-cast-references="currentEventProjection?.castReferences || null"
        :identity="bootstrapIdolDictionary"
        :manifest="bootstrapMembership"
        :raw-visual-url="eventStoryIdolRawCandidateUrl"
        :external-resources="EXTERNAL_STORY_RESOURCES_ENABLED ? currentEventExternalResources : []"
        :reading-entries="readingCatalogEntries"
        @read="openEventReader"
        @play="playCurrentEvent"
        @play-episode="playCurrentEventEpisode"
        @open-card="openEventCard"
        @open-idol="openEventIdol"
        @open-unit="openEventUnit"
      />

      <p v-if="['groups', 'files', 'episodes', 'episode_zero_units'].includes(view) && legacyAliasStatus" class="idol-read-model-status" role="status">{{ legacyAliasStatus }}</p>
      <ArchiveGroupList
        v-if="view === 'groups'"
        embedded
        :model-value="filterQuery"
        @update:model-value="updateArchiveFilter('filterQuery', $event)"
        :title="groupTitle"
        :groups="filteredGroups"
        @back="goArchiveBack"
        @select="openGroup"
      />

      <ArchiveUnitGrid
        v-if="view === 'episode_zero_units'"
        embedded
        :units="episodeZeroUnits"
        @back="goArchiveBack"
        @select="openUnit"
      />

      <ArchiveEpisodeList
        v-if="view === 'episodes'"
        embedded
        :unit="currentUnit"
        @back="goArchiveBack"
        @select="openEpisodeFiles"
      />

      <ArchiveFileList
        v-if="view === 'files'"
        embedded
        :model-value="filterQuery"
        @update:model-value="updateArchiveFilter('filterQuery', $event)"
        :title="currentGroup?.title || 'Scenarios'"
        :entries="filteredFileEntries"
        @back="goArchiveBack"
        @select="openScenarioEntry"
      />

      <ArchiveStatus
        v-if="view === 'archive_status'"
        :manifest="resourceReadModelDetail?.view?.manifest || null"
        :verification="resourceReadModelDetail?.view?.verification || null"
        :ui-assets="resourceReadModelDetail?.view?.uiAssets || null"
        @open-spine-lab="openSpineLab"
      />

      <ArchiveStoryCatalog
        v-if="view === 'story_catalog'"
        :entries="visibleStoryCatalogEntries"
        :all-entries="storyCatalogEntries"
        :domain-options="storyDomainOptions"
        :domain="currentStoryDomain"
        :section="currentStorySection"
        :mode="currentStoryMode"
        :event-scope-options="storyEventScopeOptions"
        :event-scope="currentEventScope"
        :availability="currentStoryAvailability"
        :sort="currentStorySort"
        :catalog-total="storyCatalogEntries.length"
        :filtered-total="filteredStoryCatalog.length"
        :seasonal-count="storyCatalogIndex?.seasonalCount ?? 0"
        :work-count="storyCatalogIndex?.workCount ?? 0"
        :idol-story-count="archiveBootstrap.idols.length"
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
        @clear-section="updateArchiveFilter('currentStorySection', '')"
        @update:mode="setStoryMode"
        @update:domain="setStoryDomain"
        @update:event-scope="updateArchiveFilter('currentEventScope', $event)"
        @update:availability="updateArchiveFilter('currentStoryAvailability', $event)"
        @update:sort="updateArchiveFilter('currentStorySort', $event)"
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
        :idol-name="idolSourceName"
        :identity="bootstrapIdolDictionary"
        :manifest="bootstrapMembership"
        :projected-cast-references="storyReadModelDetail?.view?.castReferences || null"
        :external-resources="EXTERNAL_STORY_RESOURCES_ENABLED ? currentStoryExternalResources : []"
        :reading-entries="readingCatalogEntries"
        @read="documentId => openStoryReader(documentId, { storyType: currentStoryDomain, story: currentStoryFile })"
        @play="playStoryDetail"
        @select="openStoryDetail"
        @open-idol="openStoryIdol"
      />

      <ArchiveStoryCollection
        v-if="view === 'story_collection'"
        :collection="currentStoryCollection"
        :external-resources="EXTERNAL_STORY_RESOURCES_ENABLED ? currentStoryCollectionExternalResources : []"
        :initial-chapter-id="currentStoryCollectionChapter?.id || ''"
        :reading-entries="readingCatalogEntries"
        @read-episode="openCollectionReader"
        @play-chapter="playStoryCollectionChapter"
        @play-episode="playStoryCollectionEpisode"
        @select-chapter="selectStoryCollectionChapter"
        @open-gasha="openGasha"
        @open-idol-story="openBirthdayIdolStory"
      />

      <ArchiveSeasonalCampaign
        v-if="view === 'seasonal_campaign'"
        :campaign="currentSeasonalCampaign"
        :campaigns="seasonalReadModelCatalog || []"
        :source-evidence="seasonalReadModelDetail?.view?.sourceEvidence || null"
        @select="selectSeasonalCampaign"
        @play="playSeasonalCampaignStory"
      />

      <ArchiveWorkStory
        v-if="view === 'work_archive'"
        :idol="currentWorkIdol"
        :idols="workReadModelCatalog || []"
        :source-evidence="workReadModelDetail?.view?.sourceEvidence || null"
        :reading-entries="readingCatalogEntries"
        :initial-file="currentStoryFile"
        :mode="currentWorkMode"
        @read="openWorkReader"
        @select-idol="selectWorkIdol"
        @update:mode="setWorkMode"
        @play="playWorkStory"
      />

      <ArchiveIdolStory
        v-if="view === 'idol_story_archive'"
        :story="currentIdolStoryPage"
        :reading-entries="readingCatalogEntries"
        @read-episode="openIdolStoryReader"
        :idols="idolStoryOptions"
        :external-resources="EXTERNAL_STORY_RESOURCES_ENABLED ? currentIdolStoryExternalResources : []"
        :focused-section-id="currentStorySection"
        :focused-episode-id="currentEpisodeId"
        @select-idol="selectIdolStory"
        @play-section="playIdolStorySection"
        @play-episode="playIdolStoryEpisode"
        @open-communication="openStoryCommunication"
        @open-birthday="openIdolBirthdayArchive"
      />

      <p v-if="view === 'mobile_archive' && mobileReadModelStatus" class="idol-read-model-status" role="status">{{ mobileReadModelStatus }}</p>
      <ArchiveMobileArchive
        v-if="view === 'mobile_archive'"
        :idol-data="mobileIdolReadModelDetail"
        :unit-data="mobileUnitReadModelDetail"
        :idols="mobileIdolOptions"
        :units="mobileUnitOptions"
        :selected-idol="currentCharacterId"
        :selected-unit="currentArchiveUnitCode"
        :mode="currentMobileMode"
        :focused-scenario-id="currentMobileScenarioId"
        @select-idol="selectMobileIdol"
        @select-unit="selectMobileUnit"
        @update:mode="setMobileMode"
        @play="playMobileScenario"
        @play-random-topic="playRandomTalkTopic"
        @open-card="openMobileCard"
        @open-idol-story="openMobileIdolStory"
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
        :identity="bootstrapIdolDictionary"
        :manifest="bootstrapMembership"
        :stories="currentArchiveUnitStories"
        :songs="currentArchiveUnitSongs"
        :card-stats="currentArchiveUnitEntry?.cardStats"
        :event-relations="currentArchiveUnitEntry?.eventRelations"
        @open-idol="openUnitMember"
        @open-story="openUnitStory"
        @open-event="openUnitEvent"
        @open-cards="openUnitCards"
        @open-song="openSong"
      />
      <p v-if="!loading && cardReadModelStatus" role="status">{{ cardReadModelStatus }}</p>
      <p v-if="!loading && gashaReadModelStatus" role="status">{{ gashaReadModelStatus }}</p>
      <p v-if="!loading && eventReadModelStatus" role="status">{{ eventReadModelStatus }}</p>
      <p v-if="!loading && seasonalReadModelStatus" role="status">{{ seasonalReadModelStatus }}</p>
      <p v-if="!loading && workReadModelStatus" role="status">{{ workReadModelStatus }}</p>
      <p v-if="!loading && idolStoryReadModelStatus" role="status">{{ idolStoryReadModelStatus }}</p>
      <p v-if="!loading && collectionReadModelStatus" role="status">{{ collectionReadModelStatus }}</p>
      <p v-if="!loading && storyReadModelStatus" role="status">{{ storyReadModelStatus }}</p>
      <p v-if="!loading && resourceReadModelStatus" role="status">{{ resourceReadModelStatus }}</p>
      <p v-if="['unit_catalog', 'unit_detail'].includes(view) && unitReadModelStatus" class="unit-read-model-status" role="status">{{ unitReadModelStatus }}</p>
      <template #pending>
        <GsLoadingIndicator v-if="routePending" variant="inline" message="正在准备下一页…" />
      </template>
    </ArchiveShell>

    <!-- ====== STORY PLAYER ====== -->
    <section v-if="(playbackError || playbackReadiness?.status === 'blocked') && !loading" class="playback-failure" role="alert">
      <p v-if="playbackError">演出暂时无法载入，请重试或返回。</p>
      <p v-else>当前段落的必要{{ playbackReadiness.reason === 'voice-renderable' ? '语音' : '画面' }}未能准备完成，请重试或返回。</p>
      <details><summary>查看加载详情</summary><p>{{ playbackError || playbackReadiness?.reason }}</p></details>
      <div class="playback-failure-actions">
        <button v-if="playbackController.canRetry.value" type="button" @click="playbackController.retry()">重试载入</button>
        <button v-else-if="playbackReadiness?.status === 'blocked'" type="button" @click="playbackController.retryCurrentStep()">重试当前段落</button>
        <button type="button" @click="playbackController.close()">返回</button>
      </div>
      <details v-if="preloadStatus?.failed"><summary>查看失败资源</summary>
        <ul><li v-for="task in preloadStatus.tasks.filter(task => task.state === 'failed')" :key="task.key">{{ task.id }}：{{ task.error }}</li></ul>
      </details>
    </section>
    <details v-if="view === 'player' && !loading && preloadStatus?.failed" class="preload-notice">
      <summary>预载诊断记录（{{ preloadStatus.failed }} 项）</summary>
      <p>以下是先前预载未成功的记录，不代表当前画面仍然缺失。当前段落状态以播放器提示为准。</p>
      <ul><li v-for="task in preloadStatus.tasks.filter(task => task.state === 'failed')" :key="task.key">{{ task.id }}：{{ task.error }}</li></ul>
    </details>
    <StoryViewer
      v-if="view === 'player' && currentScenario"
      :key="currentScenarioInstance"
      :scenario-json="currentScenario"
      :preview-only="Boolean(currentPreviewCue)"
      :playback-instance="currentScenarioInstance"
      @step-change="playbackController.stepChanged"
      @readiness-change="playbackController.readinessChanged"
      :start-step="currentScenarioStartStep"
      :end-step="currentScenarioEndStep"
      :initial-step="currentScenarioInitialStep"
      :has-next-episode="hasNextPlaybackEpisode"
      :transition-pending="loading && Boolean(playbackController.pendingEntry.value)"
      :queue-status="playbackController.queueStatus.value"
      :queue-error="playbackController.queueError.value"
      @retry-queue="playbackController.ensureQueue({ retry: true })"
      :continuous-playback="continuousPlayback"
      @back="closePlayer"
      @ready="onPlayerReady"
      @next-episode="playNextEpisode"
      @update:continuous-playback="continuousPlayback = $event"
    />

    <!-- ====== SPINE LAB ====== -->
    <SpineViewer v-if="view === 'spine_lab'" :back-label="labBackLabel" @back="closeArchiveExperiment" @open-stage="openChibiStage" />
    <ChibiStageViewer
      v-if="view === 'chibi_stage'"
      :audio-experiments="stageAudioExperiments"
      :stage-target-id="stageTargetId"
      :stage-song-code="currentSongId"
      :stage-handoff="stageHandoff"
      :back-label="stageBackLabel"
      @back="closeArchiveExperiment"
      @open-lab="openSpineLab"
      @target-change="updateStageTarget"
    />

    <details v-if="PLAYER_TRACE" class="player-trace-panel">
      <summary>播放诊断</summary>
      <button type="button" @click="copyPlayerDiagnostics">复制诊断 JSON</button>
      <pre v-if="diagnosticCopyText">{{ diagnosticCopyText }}</pre>
    </details>

    <!-- ====== PRELOADER LOADING SCREEN ====== -->
    <GsLoadingIndicator v-if="routePending && !archiveShellVisible" class="archive-route-pending-fallback"
      variant="inline" message="正在准备下一页…" />
    <LoadingScreen :can-cancel="Boolean(playbackController.pendingEntry.value) || playbackBuffering" @cancel="playbackController.close()" :visible="(hardLoading || playbackBuffering) && view !== 'reader' && !(view === 'player' && !loading && playbackReadiness?.status === 'waiting' && playbackReadiness?.hasFrame)" :status="preloadStatus" :readiness="playbackReadiness" :message="loadingMessage"
      :surface="loadingPurpose === 'stage' ? 'stage' : (playbackBuffering || view === 'player' || loadingPurpose === 'story-playback' ? 'player' : 'archive')" />

  </div>
</template>

<script setup>
import { isDirectScenarioEntry, playerReturnRoute, selectPlayerQueue } from './core/PlayerEntryRequest.js'
import { withLoadDeadline } from './core/AsyncLoadBoundary.js'
import { tracePlayer, playerTraceSnapshot } from './core/PlayerTrace.js'
import { EXTERNAL_STORY_RESOURCES_ENABLED } from '../shared/deploy/ExternalStoryResourcePolicy.js'
import { buildCardRarityTabs, filterArchiveCards } from './data/cardFilters.js'
import { useStoryPlaybackController } from './core/useStoryPlaybackController.js'
import { buildCardVoicePreviewScenario, findCardVoiceCue } from './data/cardVoicePreview.js'
import { createArchiveNavigationCoordinator } from './core/ArchiveNavigationCoordinator.js'
import { useArchiveNavigationState } from './core/useArchiveNavigationState.js'
import { ref, shallowRef, computed, defineAsyncComponent, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { IDOL_ID_TO_NAME } from './utils/IdolNameMap.js'
import { Preloader } from './utils/Preloader.js'
import { prepareArchiveRoute } from './core/prepareArchiveRoute.js'
import LoadingScreen from './components/LoadingScreen.vue'
import GsLoadingIndicator from './components/GsLoadingIndicator.vue'
import StoryReleaseSoakPanel from './components/player/StoryReleaseSoakPanel.vue'
import ArchiveShell from './components/archive/ArchiveShell.vue'
import { readingPlaybackTarget } from './core/ReadingPlayback.js'
import { createReadingRepository } from './data/ReadingRepository.js'
import { createReadingSession } from './core/ReadingSession.js'
import ArchivePortalLauncher from './components/archive/ArchivePortalLauncher.vue'
import ArchiveWelcome from './components/archive/ArchiveWelcome.vue'
import { buildIdolReference } from './presentation/IdolReferencePresentation.js'
import { resolveMobileArchiveUnit } from './core/mobileArchiveIdentity.js'
import { readyEpisodeReading } from './data/IdolStoryReading.js'
import {
  clearArchiveUserPreferences,
  loadArchiveUserPreferences,
  saveArchiveUserPreferences,
} from './data/archiveUserPreferences.js'
import { resolveArchiveHomeAction, resolveArchiveStartup } from './core/archiveStartup.js'
import { readBootstrap } from '../readmodels/runtime/readBootstrap.mjs'
import { ReadModelClient, entityDescriptor } from '../readmodels/runtime/ReadModelClient.mjs'
import { hydrateHomeProfile } from '../readmodels/runtime/hydrateHomeProfile.mjs'
import {
  archiveSectionForRoute,
  buildArchiveBreadcrumbs,
  buildArchiveSourceQuery,
  ownsArchiveSource,
  buildPortalReturnQuery,
  readArchiveSourceRoute,
  readPortalReturnRoute,
  onArchivePopState,
  readArchiveRoute,
  writeArchiveRoute,
} from './core/archiveRoute.js'
import {
  buildArchiveViewContext,
  captureArchiveViewState,
  restoreArchiveViewState,
} from './core/archiveViewRestoration.js'
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
  getRawCharacterImageCandidateUrl,
} from './utils/CharacterImageResolver.js'
import {
  externalResourcesForCollection,
  externalResourcesForEvent,
  externalResourcesForIdolStory,
  externalResourcesForStory,
} from './data/externalStoryResources.js'

setStoryLanguagePreferences(new PlayerPreferencesRepository().load())
const entityTranslationRepository = new EntityTranslationRepository()
const URL_FLAGS = new URLSearchParams(window.location.search)
const NO_AUDIO = URL_FLAGS.get('noAudio') === '1'
const RUNTIME_DEBUG = URL_FLAGS.get('runtimeDebug') === '1'

function localStorageValue(key) {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function setLocalStorageValue(key, value) {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

const storyViewerLoader = () => import('./core/StoryViewer.vue')
const immersiveHomeLoader = () => import('./components/archive/ArchiveImmersiveHome.vue')
const spineViewerLoader = () => import('./components/SpineViewer.vue')
const chibiStageViewerLoader = () => import('./components/ChibiStageViewer.vue')
const StoryViewer = defineAsyncComponent(storyViewerLoader)
const ArchiveImmersiveHome = defineAsyncComponent(immersiveHomeLoader)
const SpineViewer = defineAsyncComponent(spineViewerLoader)
const ChibiStageViewer = defineAsyncComponent(chibiStageViewerLoader)
const archiveRouteLoaders = {
  reader: () => import('./components/archive/ArchiveStoryReader.vue'),
  event_detail: () => import('./components/archive/ArchiveEventDetail.vue'),
  story_catalog: () => import('./components/archive/ArchiveStoryCatalog.vue'),
  story_detail: () => import('./components/archive/ArchiveStoryDetail.vue'),
  story_collection: () => import('./components/archive/ArchiveStoryCollection.vue'),
  seasonal_campaign: () => import('./components/archive/ArchiveSeasonalCampaign.vue'),
  work_archive: () => import('./components/archive/ArchiveWorkStory.vue'),
  idol_story_archive: () => import('./components/archive/ArchiveIdolStory.vue'),
  cards: () => import('./components/archive/ArchiveCardList.vue'),
  card_detail: () => import('./components/archive/ArchiveCardDetail.vue'),
  gashas: () => import('./components/archive/ArchiveGashaCatalog.vue'),
  gasha_detail: () => import('./components/archive/ArchiveGashaDetail.vue'),
  song_catalog: () => import('./components/archive/ArchiveSongCatalog.vue'),
  song_detail: () => import('./components/archive/ArchiveSongDetail.vue'),
  mobile_archive: () => import('./components/archive/ArchiveMobileArchive.vue'),
  unit_catalog: () => import('./components/archive/ArchiveUnitCatalog.vue'),
  unit_detail: () => import('./components/archive/ArchiveUnitDetail.vue'),
  idols: () => import('./components/archive/ArchiveIdolGrid.vue'),
  idol_detail: () => import('./components/archive/ArchiveIdolDetail.vue'),
  groups: () => import('./components/archive/ArchiveGroupList.vue'),
  files: () => import('./components/archive/ArchiveFileList.vue'),
  episode_zero_units: () => import('./components/archive/ArchiveUnitGrid.vue'),
  episodes: () => import('./components/archive/ArchiveEpisodeList.vue'),
  archive_status: () => import('./components/archive/ArchiveStatus.vue'),
  external_story_resources: () => import('./components/archive/ArchiveExternalStoryResources.vue'),
}
const ArchiveStoryReader = defineAsyncComponent(archiveRouteLoaders.reader)
const ArchiveEventDetail = defineAsyncComponent(archiveRouteLoaders.event_detail)
const ArchiveStoryCatalog = defineAsyncComponent(archiveRouteLoaders.story_catalog)
const ArchiveStoryDetail = defineAsyncComponent(archiveRouteLoaders.story_detail)
const ArchiveStoryCollection = defineAsyncComponent(archiveRouteLoaders.story_collection)
const ArchiveSeasonalCampaign = defineAsyncComponent(archiveRouteLoaders.seasonal_campaign)
const ArchiveWorkStory = defineAsyncComponent(archiveRouteLoaders.work_archive)
const ArchiveIdolStory = defineAsyncComponent(archiveRouteLoaders.idol_story_archive)
const ArchiveCardList = defineAsyncComponent(archiveRouteLoaders.cards)
const ArchiveCardDetail = defineAsyncComponent(archiveRouteLoaders.card_detail)
const ArchiveGashaCatalog = defineAsyncComponent(archiveRouteLoaders.gashas)
const ArchiveGashaDetail = defineAsyncComponent(archiveRouteLoaders.gasha_detail)
const ArchiveSongCatalog = defineAsyncComponent(archiveRouteLoaders.song_catalog)
const ArchiveSongDetail = defineAsyncComponent(archiveRouteLoaders.song_detail)
const ArchiveMobileArchive = defineAsyncComponent(archiveRouteLoaders.mobile_archive)
const ArchiveUnitCatalog = defineAsyncComponent(archiveRouteLoaders.unit_catalog)
const ArchiveUnitDetail = defineAsyncComponent(archiveRouteLoaders.unit_detail)
const ArchiveIdolGrid = defineAsyncComponent(archiveRouteLoaders.idols)
const ArchiveIdolDetail = defineAsyncComponent(archiveRouteLoaders.idol_detail)
const ArchiveGroupList = defineAsyncComponent(archiveRouteLoaders.groups)
const ArchiveFileList = defineAsyncComponent(archiveRouteLoaders.files)
const ArchiveUnitGrid = defineAsyncComponent(archiveRouteLoaders.episode_zero_units)
const ArchiveEpisodeList = defineAsyncComponent(archiveRouteLoaders.episodes)
const ArchiveStatus = defineAsyncComponent(archiveRouteLoaders.archive_status)
const ArchiveExternalStoryResources = defineAsyncComponent(archiveRouteLoaders.external_story_resources)
function prepareArchivePage(routeView, data) {
  // The shared pending notice owns progress; discard notices from superseded routes.
  for (const status of [mobileReadModelStatus, songReadModelStatus, idolReadModelStatus,
    unitReadModelStatus, gashaReadModelStatus, cardReadModelStatus, eventReadModelStatus,
    seasonalReadModelStatus, workReadModelStatus, idolStoryReadModelStatus,
    collectionReadModelStatus, storyReadModelStatus, resourceReadModelStatus]) status.value = ''
  return prepareArchiveRoute(archiveRouteLoaders, routeView, data)
}

function primeArchiveRouteComponent(routeView) {
  const load = archiveRouteLoaders[routeView]
  if (load) load().catch(error => console.error(`[ArchiveRoute] Could not load ${routeView}:`, error))
}

const {
  view,
  playerEntryRoute,
  currentPickTarget,
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
} = useArchiveNavigationState()
const stageHandoff = ref(null)

const PLAYER_TRACE = new URLSearchParams(window.location.search).get('playerTrace') === '1'
const diagnosticCopyText = ref('')
async function copyPlayerDiagnostics() {
  const report = playerTraceSnapshot({ entry: playbackController.inspect(),
    runtime: window.__GS_PLAYER_DIAGNOSTICS__?.() || null })
  const text = JSON.stringify(report, null, 2)
  // Keep an inspectable export even when an embedded browser's clipboard is
  // isolated from the host clipboard or silently unavailable to the recipient.
  diagnosticCopyText.value = text
  try { await navigator.clipboard.writeText(text) }
  catch { /* The visible JSON remains available for manual copying. */ }
}
const externalStoryResourcesData = ref(null)
const idolEntityTranslationRevision = ref(0)
const initialUserPreferences = loadArchiveUserPreferences()
const archiveBootstrap = readBootstrap()
const readModelClient = new ReadModelClient({ release: archiveBootstrap.release, observe: event => tracePlayer('read-model', event) })
const initialArchiveStartup = resolveArchiveStartup(window.location.href, initialUserPreferences.preferences,
  archiveBootstrap.idols.filter(idol => idol.home_available).map(idol => idol.id))
const bootstrapIdolDictionary = { by_idol_code: Object.fromEntries(archiveBootstrap.idols.map(idol => [idol.id, {
  display_name: idol.name, unit_name: idol.unitName, color: idol.color,
}])) }
const bootstrapMembership = { unit_membership_by_idol: Object.fromEntries(archiveBootstrap.idols.map(idol => [idol.id, {
  unit_name: idol.unitName,
  unit_code: idol.unitCode,
}])) }
const bootstrapIdolSwitcher = archiveBootstrap.idols.map(idol => ({
  idol_code: idol.id, display_name: idol.name, unit_name: idol.unitName,
}))
const mobileIdolReadModelCatalog = ref(null)
const mobileUnitReadModelCatalog = ref(null)
const mobileIdolReadModelDetail = ref(null)
const mobileUnitReadModelDetail = ref(null)
const mobileReadModelStatus = ref('')
const legacyGroupReadModelDetail = ref(null)
const legacyFileReadModelDetail = ref(null)
const legacyZeroReadModelDetail = ref(null)
const legacyEpisodeReadModelDetail = ref(null)
const legacyAliasStatus = ref('')
let pendingLegacyAliasNavigation = 0
const mobileIdolOptions = archiveBootstrap.idols.map(idol => ({ idol_code: idol.id, display_name: idol.name, color: idol.color }))
const mobileUnitOptions = computed(() => (mobileUnitReadModelCatalog.value || []).map(unit => ({
  unit_code: unit.id, unit_name: unit.name, unit_color: unit.color,
})))
let mobileIdolCatalogPromise = null
let mobileUnitCatalogPromise = null
let pendingMobileNavigation = 0
const userPreferences = ref(initialUserPreferences.preferences)
const userPreferenceNotice = ref(initialUserPreferences.issue)
const legacyEntryStatus = ref('')
const songReadModelCatalog = ref(null)
const songReadModelDetail = ref(null)
const songReadModelStatus = ref('')
let songCatalogPromise = null
let pendingSongNavigation = 0
const idolReadModelCatalog = ref(null)
const idolReadModelDetail = ref(null)
const idolReadModelStatus = ref('')
let idolCatalogPromise = null
let pendingIdolNavigation = 0
const unitReadModelCatalog = ref(null)
const unitReadModelDetail = ref(null)
const unitReadModelStatus = ref('')
let unitCatalogPromise = null
let pendingUnitNavigation = 0
const gashaReadModelCatalog = ref(null)
const gashaCatalogFunctions = shallowRef(null)
const gashaReadModelDetail = ref(null)
const gashaReadModelStatus = ref('')
let gashaCatalogPromise = null
let pendingGashaNavigation = 0
const cardReadModelCatalog = ref(null)
const cardReadModelDetail = ref(null)
const cardReadModelStatus = ref('')
let cardCatalogPromise = null
let pendingCardNavigation = 0
const eventReadModelCatalog = ref(null)
const eventReadModelDetail = ref(null)
const eventReadModelStatus = ref('')
let eventCatalogPromise = null
let pendingEventNavigation = 0
const seasonalReadModelCatalog = shallowRef(null)
const seasonalReadModelDetail = shallowRef(null)
const seasonalReadModelStatus = ref('')
let seasonalCatalogPromise = null
let pendingSeasonalNavigation = 0
const workReadModelCatalog = shallowRef(null)
const workReadModelDetail = shallowRef(null)
const workReadModelStatus = ref('')
let workCatalogPromise = null
let pendingWorkNavigation = 0
const idolStoryReadModelCatalog = shallowRef(null)
const idolStoryReadModelDetail = shallowRef(null)
const idolStoryReadModelStatus = ref('')
let idolStoryCatalogPromise = null
let pendingIdolStoryNavigation = 0
const collectionReadModelCatalog = shallowRef(null)
const collectionReadModelDetail = shallowRef(null)
const collectionReadModelStatus = ref('')
let collectionCatalogPromise = null
let pendingCollectionNavigation = 0
const storyReadModelCatalog = shallowRef(null)
const storyReadModelDetail = shallowRef(null)
const storyReadModelStatus = ref('')
const storyCatalogIndex = shallowRef(null)
const storyCatalogLanding = shallowRef(null)
let storyCatalogPromise = null
let storyLandingPromise = null
let pendingStoryDetailNavigation = 0
const resourceReadModelDetail = shallowRef(null)
const resourceReadModelStatus = ref('')
let resourceDetailPromise = null
let pendingResourceNavigation = 0
const homeReadModelIndex = ref(null)
const homeReadModelProfiles = ref({})
const homeEntryStatus = ref('')
let homeIndexPromise = null
const homeProfilePromises = new Map()
const recentHomeProfiles = []
let pendingHomeNavigation = 0
const continuousPlayback = ref(localStorageValue('sidem:continuous-playback') === '1')
const loading = ref(initialArchiveStartup.route.view === 'player' || !isBootstrapRoute(initialArchiveStartup.route) || ['song_catalog', 'song_detail', 'idol_detail', 'unit_catalog', 'unit_detail', 'seasonal_campaign', 'work_archive', 'idol_story_archive', 'mobile_archive', 'story_collection', 'story_detail', 'story_catalog', 'archive_status', 'groups', 'files', 'episode_zero_units', 'episodes'].includes(initialArchiveStartup.route.view) || initialArchiveStartup.route.view === 'home' && Boolean(initialArchiveStartup.route.homeIdol))
const loadingPurpose = ref('archive-data')
const hardLoading = computed(() => loading.value && (view.value === '__boot__' || loadingPurpose.value !== 'archive-data'))
const routePending = computed(() => loading.value && !hardLoading.value)
const preloadProgress = ref(0)

// View preferences and history lifecycle (navigation refs are owned above).
const cardLayout = ref('compact')
const cardArtMode = ref('clean')
const storyVisibleLimit = ref(80)
let archiveRouteReady = false
let pendingPreReadyRoute = null
let activeArchiveViewContext = null
let archiveViewRestoreRevision = 0
const navigation = createArchiveNavigationCoordinator({ onFinish: () => { loading.value = false; loadingPurpose.value = 'archive-data' } })
const playbackController = useStoryPlaybackController({
  state: { view, playerEntryRoute, currentArchiveRoute, loading, preloadProgress, currentScenarioFile, currentScenarioStartStep, currentScenarioEndStep, currentScenarioInitialStep, currentPreviewCue, returnViewAfterPlayer },
  navigation, loadPlayer: storyViewerLoader,
  preloadAssets: (plan, progress, options) => Preloader.preloadScenario(plan, progress, options),
  syncRoute: () => syncArchiveRoute(), returnTo: restorePlaybackDestination, resolveQueue: loadPlayerQueue,
})
const { currentScenario, currentScenarioInstance, hasNext: hasNextPlaybackEpisode, error: playbackError,
  preloadStatus, playbackBuffering, playbackReadiness } = playbackController
const loadingMessage = computed(() => playbackBuffering.value || view.value === 'player' || loadingPurpose.value === 'story-playback'
  ? '正在准备演出…'
  : loadingPurpose.value === 'stage' ? '正在准备舞台…' : '正在读取资料馆数据…')
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

const archiveStats = computed(() => homeReadModelIndex.value?.stats || [])
const archiveHomeIdols = computed(() => homeReadModelIndex.value
  ? homeReadModelIndex.value.idols.map(idol => homeReadModelProfiles.value[idol.id] || idol)
  : archiveBootstrap.idols.filter(idol => idol.home_available))
const archivePickerIdols = computed(() => archiveBootstrap.idols)
const archiveHomeHighlights = computed(() => homeReadModelIndex.value?.highlights || [])
const validArchiveHomeIdols = computed(() => archiveHomeIdols.value.map(idol => idol.id))
const preferredArchiveIdol = computed(() =>
  archivePickerIdols.value.find(idol => idol.id === userPreferences.value.preferredIdol) || null)
const preferredArchiveIdolReference = computed(() => preferredArchiveIdol.value
  ? buildIdolReference(preferredArchiveIdol.value.id, bootstrapIdolDictionary,
    bootstrapMembership, 'portal:preferred')
  : null)
const idolPickerLabel = computed(() => ({
  home: '游戏风首页',
  profile: '偶像资料',
  work: '工作档案',
  story: '个人故事',
  mobile: '通信档案',
})[currentPickTarget.value] || '游戏风首页')
const stageBackLabel = computed(() => (
  (detailSourceRoute.value && readArchiveSourceRoute(detailSourceRoute.value).view === 'song_detail') ||
  (!detailSourceRoute.value && stageTargetId.value && currentSongId.value)
    ? '返回歌曲'
    : '返回资料馆'
))
// Lab exits the experiment to its archive source; it does not push Stage into the generic source stack.
const labBackLabel = computed(() => (
  detailSourceRoute.value && readArchiveSourceRoute(detailSourceRoute.value).view === 'song_detail'
    ? '返回歌曲详情'
    : detailSourceRoute.value ? '返回来源页' : '返回资料馆'
))

// Public idol and card member grids use the inline bootstrap and card directory.
const idolList = computed(() => {
  if (currentCategoryId.value !== 'cards') {
    return archiveBootstrap.idols.map(idol => ({
      id: idol.id, name: idol.name, color: idol.color, unitId: idol.unitId,
      unitCode: idol.unitCode, unitName: idol.unitName, _isGroup: false,
    }))
  }
  const counts = new Map()
  for (const card of cardReadModelCatalog.value || []) counts.set(card.character_id, (counts.get(card.character_id) || 0) + 1)
  return archiveBootstrap.idols.filter(idol => counts.has(idol.id)).map(idol => ({
    ...idol, cardCount: counts.get(idol.id), _isGroup: false,
  }))
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
  const units = [...new Map(archiveBootstrap.idols.map(idol => [idol.unitId, {
    unit_id: idol.unitId, unit_code: idol.unitCode, unit_name: idol.unitName,
  }])).values()]
  return units.map(unit => ({
    id: String(unit.unit_id),
    code: unit.unit_code,
    name: unit.unit_name,
    count: counts.get(String(unit.unit_id)) || 0,
  })).filter(unit => unit.count)
})

// Group list.
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

const categoryHeaderText = computed(() => {
  if (currentCategoryId.value === 'cards') return '卡片档案'
  if (currentCategoryId.value === 'idol_chat') return '短信聊天'
  if (currentCategoryId.value === 'idol_phone') return '电话聊天'
  return '偶像档案'
})

const categoryFilterPlaceholder = computed(() => {
  if (currentCategoryId.value === 'cards') return 'Search card idol...'
  if (currentCategoryId.value === 'idol_chat') return 'Search chat...'
  if (currentCategoryId.value === 'idol_phone') return 'Search phone...'
  return 'Search idol...'
})

// Episode Zero units.
const episodeZeroUnits = computed(() => {
  return legacyZeroReadModelDetail.value?.id === 'episode_zero' ? legacyZeroReadModelDetail.value.view.units : []
})

const mainStoryDomain = computed(() => storyCatalogLanding.value?.main || null)

const currentSeasonalCampaign = computed(() => seasonalReadModelDetail.value?.id === currentStorySection.value
  ? seasonalReadModelDetail.value.view.campaign : null)

const currentWorkIdol = computed(() => workReadModelDetail.value?.id === currentCharacterId.value
  ? workReadModelDetail.value.view.idol : null)

const idolStoryOptions = computed(() => idolStoryReadModelCatalog.value || [])

const currentIdolStoryPage = computed(() => idolStoryReadModelDetail.value?.id === currentCharacterId.value
  ? idolStoryReadModelDetail.value.view.page : null)

const currentIdolStoryExternalResources = computed(() =>
  externalResourcesForIdolStory(
    externalStoryResourcesData.value,
    currentIdolStoryPage.value,
  ),
)

const storyDomainOptions = computed(() => {
  const counts = new Map()
  const labels = new Map()
  for (const entry of storyCatalogEntries.value) {
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
    count: storyCatalogEntries.value.filter(entry => entry.domain === 'event' && entry.eventScope === id).length,
  }))
})

const filteredStoryCatalog = computed(() => {
  const query = filterQuery.value.trim().toLowerCase()
  const availability = currentStoryAvailability.value
  const entries = storyCatalogEntries.value.filter(entry =>
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

const currentStory = computed(() => storyReadModelDetail.value?.story?.file === currentStoryFile.value
  ? storyReadModelDetail.value.story : null)
const currentStoryExternalResources = computed(() =>
  externalResourcesForStory(externalStoryResourcesData.value, currentStory.value),
)

const extraStoryDomain = computed(() => storyCatalogLanding.value?.extra || null)
const birthdayStoryDomain = computed(() => storyCatalogLanding.value?.birthday || null)

const currentStoryCollection = computed(() => {
  const collection = collectionReadModelDetail.value?.view?.collection
  return collection?.domain === currentStoryDomain.value &&
    (collection.sectionId === currentStorySection.value ||
      collection.legacySectionIds?.includes(currentStorySection.value))
    ? collection : null
})

const currentStoryCollectionExternalResources = computed(() =>
  externalResourcesForCollection(externalStoryResourcesData.value, currentStoryCollection.value),
)

const currentStoryCollectionChapter = computed(() =>
  currentStoryCollection.value?.chapters?.find(chapter =>
    chapter.story?.file === currentStoryFile.value,
  ) || null,
)

const externalStoryNavigationEntries = []

const currentStoryRelated = computed(() => storyReadModelDetail.value?.view?.related || [])

const currentEventStory = computed(() => currentEventProjection.value?.story || null)
const currentEventEpisodes = computed(() => currentEventProjection.value?.episodes || [])

watch(continuousPlayback, enabled => {
  setLocalStorageValue('sidem:continuous-playback', enabled ? '1' : '0')
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
      storyReadModelDetail.value?.view?.promotedVisualUrl || ''
  }
  return ''
})

function eventStoryIdolRawCandidateUrl(idolCode) {
  return getRawCharacterImageCandidateUrl('event_story_visual', idolCode)
}

const unitCatalogEntries = computed(() => (unitReadModelCatalog.value || []).map(row => row.catalog))
const storyCatalogEntries = computed(() => storyReadModelCatalog.value || [])
const currentArchiveUnit = computed(() => {
  const projected = unitReadModelDetail.value?.view.entry.unit
  if (projected && [String(projected.unit_id), projected.unit_code].includes(currentArchiveUnitCode.value)) return projected
  return unitCatalogEntries.value.find(entry =>
    [String(entry.unit.unit_id), entry.unit.unit_code].includes(currentArchiveUnitCode.value))?.unit || null
})
const currentArchiveUnitEntry = computed(() => unitReadModelDetail.value?.view.entry.unit === currentArchiveUnit.value
  ? unitReadModelDetail.value.view.entry
  : unitCatalogEntries.value.find(entry =>
  String(entry.unit.unit_id) === String(currentArchiveUnit.value?.unit_id || ''),
) || null)
const currentArchiveUnitMembers = computed(() => currentArchiveUnitEntry.value?.members || [])
const currentArchiveUnitStories = computed(() => unitReadModelDetail.value?.view.entry.unit === currentArchiveUnit.value
  ? unitReadModelDetail.value.view.stories : [])
const currentArchiveUnitSongs = computed(() => unitReadModelDetail.value?.view.entry.unit === currentArchiveUnit.value
  ? unitReadModelDetail.value.view.songs : [])

const filteredFileEntries = computed(() => {
  if (!currentGroup.value) return []
  if (legacyFileReadModelDetail.value?.id !== String(currentGroup.value.id)) return []
  const entries = legacyFileReadModelDetail.value.view.entries
  const q = filterQuery.value.toLowerCase()
  return q ? entries.filter(entry => entry.searchText.toLowerCase().includes(q)) : entries
})

const currentCards = computed(() => (cardReadModelCatalog.value || [])
  .filter(card => !currentCharacterId.value || card.character_id === currentCharacterId.value))

const cardRarityTabs = computed(() => buildCardRarityTabs(currentCards.value))

const filteredCards = computed(() => filterArchiveCards(currentCards.value, {
  query: filterQuery.value,
  rarity: currentCardRarity.value,
  assetState: currentCardAssetState.value,
  relationState: currentCardRelationState.value,
}))
const filteredCardRows = computed(() => filteredCards.value.map(card => ({
  ...card,
  ownerReference: card.ownerReference,
})))

const currentCard = computed(() => cardReadModelDetail.value?.id === currentCardId.value
  ? cardReadModelDetail.value.card : null)
const currentCardOwnerReference = computed(() => cardReadModelDetail.value?.id === currentCardId.value
  ? cardReadModelDetail.value.ownerReference : null)
const currentCardAssetStatus = computed(() => cardReadModelDetail.value?.id === currentCardId.value
  ? cardReadModelDetail.value.assetStatus : null)
const currentCardEventRelation = computed(() => cardReadModelDetail.value?.id === currentCardId.value
  ? cardReadModelDetail.value.eventRelation : null)
const currentCardGashaRelation = computed(() => cardReadModelDetail.value?.id === currentCardId.value
  ? cardReadModelDetail.value.gashaRelation : null)
const gashaCatalog = computed(() => gashaReadModelCatalog.value?.rows || [])
const gashaCategoryOptions = computed(() => gashaCatalogFunctions.value?.buildGashaCategoryOptions(
  { meta: gashaReadModelCatalog.value?.summary }, gashaCatalog.value) || [])
const filteredGashas = computed(() => gashaCatalogFunctions.value?.filterGashaCatalog(gashaCatalog.value, {
  query: filterQuery.value,
  category: currentGashaCategory.value,
  idolSearchText: idolEntitySearchText,
}) || [])
const currentGasha = computed(() => gashaReadModelDetail.value?.id === currentGashaId.value
  ? gashaReadModelDetail.value.gasha
  : null)
const currentEventProjection = computed(() => eventReadModelDetail.value?.id === currentEventId.value
  ? eventReadModelDetail.value.view : null)
const currentEvent = computed(() => currentEventProjection.value?.event || null)
const currentMasterEvent = computed(() => currentEventProjection.value?.masterEvent || null)
const currentEventExternalResources = computed(() =>
  externalResourcesForEvent(externalStoryResourcesData.value, currentEvent.value?.event_code),
)
const currentEventCards = computed(() => currentEventProjection.value?.cards || [])
const currentEventIdols = computed(() => currentEventProjection.value?.idols || [])
const currentEventUnits = computed(() => currentEventProjection.value?.units || [])
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
  return (cardReadModelCatalog.value || [])
    .filter(card => (card.release_series_id || card.release_series?.series_id) === seriesId)
    .map(card => ({ ...card, character_name: idolSourceName(card.character_id) }))
})

const currentCardCharacterName = computed(() => {
  const id = currentCharacterId.value
  return idolSourceName(id) || 'Cards'
})

const currentIdolDetail = computed(() => idolReadModelDetail.value?.id === currentCharacterId.value
  ? idolReadModelDetail.value.view : null)
const currentIdolProfile = computed(() => currentIdolDetail.value?.profile || null)
const currentIdolStats = computed(() => currentIdolDetail.value?.stats || {})
const currentIdolEvents = computed(() => currentIdolDetail.value?.events || [])
const currentIdolSongs = computed(() => currentIdolDetail.value?.songs || [])

const readingState = ref({ status: 'idle', document: null, entries: [], error: '' })
const readingPlaybackNotice = ref('')
const readingRepository = createReadingRepository({ locatorResolver: async (documentId, { fresh }) => {
  const descriptor = await entityDescriptor(archiveBootstrap, 'reading-docs', documentId, 'reading-docs.detail')
  if (fresh) readModelClient.invalidate(descriptor)
  try {
    const detail = await readModelClient.load(descriptor, { expectedId: documentId,
      validate: data => { if (!data.view?.entry || !Array.isArray(data.view.entries)) throw Error('Reading locator shape mismatch') } })
    return detail.view
  } catch (error) {
    if (error.code !== 'RELEASE_OR_ARTIFACT_MISSING') throw error
    const exists = (await readingRepository.manifest()).entries.some(entry => entry.document_id === documentId)
    if (exists) throw error
    return { entry: null, entries: [] }
  }
} })
const readingCatalogEntries = computed(() => {
  if (view.value === 'story_collection' && currentStoryCollection.value)
    return collectionReadModelDetail.value.view.readingEntries
  if (view.value === 'story_detail' && currentStory.value)
    return storyReadModelDetail.value.view.readingEntries
  if (view.value === 'event_detail' && currentEventProjection.value)
    return eventReadModelDetail.value.view.readingEntries
  if (view.value === 'work_archive' && currentWorkIdol.value)
    return workReadModelDetail.value.view.readingEntries
  if (view.value === 'idol_story_archive' && currentIdolStoryPage.value)
    return idolStoryReadModelDetail.value.view.readingEntries
  return []
})
const readingSession = createReadingSession({ repository: readingRepository, publish: state => { readingState.value = state } })

const archiveShellVisible = computed(() => !['__boot__', 'player', 'spine_lab', 'chibi_stage'].includes(view.value))

const currentSong = computed(() => songReadModelDetail.value?.id === currentSongId.value
  ? songReadModelDetail.value.song : null)
const stageAudioExperiments = computed(() => songReadModelDetail.value?.id === (currentSongId.value || (view.value === 'chibi_stage' ? 'drvalv' : '')) && songReadModelDetail.value?.experimental
  ? { [songReadModelDetail.value.id]: songReadModelDetail.value.experimental }
  : {})
const currentSongPresentation = computed(() => songReadModelDetail.value?.id === currentSongId.value
  ? songReadModelDetail.value.view : null)

const archiveSection = computed(() => archiveSectionForRoute({
  view: view.value,
  reading: readingDocumentId.value,
  category: currentCategoryId.value,
  idol: currentCharacterId.value,
  card: currentCardId.value,
  song: currentSongId.value,
  gasha: currentGashaId.value,
  unit: currentArchiveUnitCode.value || currentUnit.value?.unit_code || currentUnit.value?.id || '',
  group: currentGroup.value?.id || '',
  scenario: view.value === 'player' ? currentScenarioFile.value : '',
  voice: view.value === 'player' ? currentPreviewCue.value : '',
}))

const archiveTitle = computed(() => {
  if (view.value === 'reader') return '剧情阅读'
  if (view.value === 'portal') return '我的资料馆'
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
  if (view.value === 'song_catalog') return '歌曲档案'
  if (view.value === 'song_detail') return currentSong.value?.title || '歌曲详情'
  if (view.value === 'event_detail') return currentEvent.value?.title || '活动详情'
  if (view.value === 'unit_catalog') return '组合资料'
  if (view.value === 'unit_detail') return currentArchiveUnit.value?.unit_name || '组合详情'
  if (view.value === 'idols') return categoryHeaderText.value
  if (view.value === 'idol_detail') return currentIdolProfile.value?.display_name || '偶像详情'
  if (view.value === 'groups') return groupTitle.value
  if (view.value === 'cards') return currentCardCharacterName.value
  if (view.value === 'card_detail') return currentCard.value?.title || '卡片详情'
  if (view.value === 'episode_zero_units') return '第零话'
  if (view.value === 'episodes') return currentUnit.value?.unit_name || '章节'
  if (view.value === 'files') return currentGroup.value?.title || '剧情文件'
  return 'SideM Archive'
})

const archiveSearchable = computed(() => ['idols', 'groups', 'cards', 'gashas', 'files'].includes(view.value) || (view.value === 'story_catalog' && currentStoryMode.value === 'search'))

const archiveSearchPlaceholder = computed(() => {
  if (view.value === 'idols') return categoryFilterPlaceholder.value
  if (view.value === 'cards') return '搜索卡片标题或稀有度'
  if (view.value === 'gashas') return '搜索卡池名称、卡片或偶像'
  if (view.value === 'groups') return '搜索章节标题'
  if (view.value === 'files') return '搜索剧情标题'
  if (view.value === 'story_catalog') return '搜索剧情标题或角色'
  return '搜索资料'
})

const archiveShowBack = computed(() => view.value !== 'home' && (view.value !== 'portal' || Boolean(portalFrom.value)))

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
  return bootstrapIdolDictionary.by_idol_code[id]?.display_name ||
    IDOL_ID_TO_NAME[id] ||
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

function captureActiveArchiveView() {
  if (activeArchiveViewContext) captureArchiveViewState(activeArchiveViewContext)
}

function adoptArchiveViewContext({ restore = true } = {}) {
  activeArchiveViewContext = buildArchiveViewContext(window.location.href, window.history.state)
  const revision = ++archiveViewRestoreRevision
  if (!restore) return
  nextTick(() => {
    if (revision !== archiveViewRestoreRevision || navigation.isDisposed()) return
    restoreArchiveViewState(activeArchiveViewContext).catch(error => {
      console.error('[ArchiveNavigation] Failed to restore view position:', error)
    })
  })
}

function syncArchiveRoute({ replace = false, restoreView = true } = {}) {
  if (!archiveRouteReady || navigation.isRestoring()) return
  writeArchiveRoute(currentArchiveRoute(), { replace })
  adoptArchiveViewContext({ restore: restoreView })
}

function commitView(nextView, options = {}) {
  primeArchiveRouteComponent(nextView)
  captureActiveArchiveView()
  navigation.invalidate()
  if (nextView !== 'player') playbackController.reset()
  loading.value = false
  loadingPurpose.value = 'archive-data'
  view.value = nextView
  if (!archiveRouteReady) pendingPreReadyRoute = currentArchiveRoute()
  syncArchiveRoute(options)
}

function commitArchiveSelection() {
  navigation.invalidate()
  loading.value = false
  syncArchiveRoute({ restoreView: false })
}

function updateArchiveFilter(key, value) {
  const target = {
    filterQuery, currentIdolUnitFilter, currentCardRarity, currentCardAssetState,
    currentCardRelationState, currentGashaCategory, currentSongScope,
    currentStorySection, currentEventScope, currentStoryAvailability, currentStorySort,
  }[key]
  if (!target || Object.is(target.value, value)) return
  navigation.invalidate()
  loading.value = false
  target.value = value
}

async function restoreVoicePreview(route, intent) {
  const card = cardReadModelDetail.value?.id === route.card ? cardReadModelDetail.value.card : null
  if (!card || !route.voice) return false
  const cue = findCardVoiceCue(card, route.voice, card.operational_voice_cues || [])
  if (!cue) return false
  const scenario = buildCardVoicePreviewScenario(card, cue)
  if (!scenario) return false
  loadingPurpose.value = 'story-playback'
  return playbackController.preview(() => scenario,
    route.voice, route.returnView || 'card_detail', { intent, syncRoute: false })
}

async function applyArchiveRoute(route, { restoring = true, intent: inherited } = {}) {
  primeArchiveRouteComponent(route.view)
  captureActiveArchiveView()
  loadingPurpose.value = route.view === 'player' ? 'story-playback' : 'archive-data'
  return navigation.run(async intent => {
    if (isDirectScenarioEntry(route)) {
      // The URL already identifies the media. Parent catalogs are return context,
      // not evidence required to render this scenario. Reader proof is excluded.
      const destination = playerReturnRoute(route)
      playbackController.reset()
      return playbackController.restore(route.scenario, destination.view,
        { startStep: route.startStep, endStep: route.endStep, initialStep: route.initialStep },
        [], intent, destination)
    }
    if (route.view === 'reader' || (route.view === 'player' && route.returnView === 'reader')) {
      readingDocumentId.value = route.reading
      readingRowId.value = route.readingRow || ''
      readingMode.value = route.readingMode || 'original'
      readingRevision.value = route.readingRev || ''
      currentStoryDomain.value = route.storyType || ''
      currentStorySection.value = route.storySection || ''
      currentEpisodeId.value = route.episode || ''
      currentStoryFile.value = route.story || ''
      currentWorkMode.value = route.storyType === 'work' ? (route.workMode || 'stories') : 'stories'
      currentCharacterId.value = route.idol || ''
      currentEventId.value = route.event || ''
      eventParentView.value = route.event ? (route.parentView || '') : ''
      currentCategoryId.value = route.event ? (route.category || '') : ''
      currentArchiveUnitCode.value = route.event && route.parentView === 'unit_detail' ? (route.unit || '') : ''
      detailSourceRoute.value = route.sourceRoute || ''
      readingPlaybackNotice.value = ''
      playbackController.reset()
      view.value = 'reader'
      loading.value = false
      await readingSession.open(route.reading, intent)
      if (!intent.isCurrent()) return
      if (route.view === 'player') await openReaderPlayback(route.readingRow, { intent, route })
      else if (readingRevision.value && readingRevision.value !== readingState.value.entries.find(e => e.document_id === route.reading)?.sha256) {
        readingPlaybackNotice.value = '阅读版本已变化。请重新选择本篇分段，确认最新正文后再演出。'
      }
      return
    }
    if (route.view === 'portal') {
      portalFrom.value = route.portalFrom || ''
      playbackController.reset()
      view.value = 'portal'
      return
    }
    const cardOwnerView = route.view === 'player' ? route.returnView : route.view
    if (route.card && (route.voice || cardOwnerView === 'card_detail') &&
        cardReadModelDetail.value?.id !== route.card) {
      const detail = await loadCardDetail(route.card)
      if (!intent.isCurrent()) return
      cardReadModelDetail.value = detail
    }
    if (route.view === 'idols' && route.category === 'cards') await loadCardCatalog()
    if (!intent.isCurrent()) return
    if ((route.view === 'mobile_archive' || (route.view === 'player' && route.returnView === 'mobile_archive')) &&
      route.idol && archiveBootstrap.idols.some(idol => idol.id === route.idol)) {
      const mobile = await loadMobileRoute(route.idol, route.mobileMode || 'personal', route.unit || '')
      if (!intent.isCurrent()) return
      mobileIdolReadModelDetail.value = mobile.idol
      mobileUnitReadModelDetail.value = mobile.unit
    }
    if (route.view === 'story_catalog' || (route.view === 'player' && route.returnView === 'story_catalog')) {
      await loadStoryReadModelLanding()
      if (!intent.isCurrent()) return
    }
    const aliasRoute = await loadLegacyAliasRoute(route)
    if (!intent.isCurrent()) return
    publishLegacyAliasRoute(aliasRoute)
    if (route.view === 'archive_status') {
      const detail = await loadResourceStatus()
      if (!intent.isCurrent()) return
      resourceReadModelDetail.value = detail
    }
    if ((route.view === 'idol_story_archive' || (route.view === 'player' && route.returnView === 'idol_story_archive')) && route.idol) {
      const detail = await loadIdolStoryDetail(route.idol)
      if (!intent.isCurrent()) return
      idolStoryReadModelDetail.value = detail
    }
    if ((route.view === 'story_collection' || (route.view === 'player' && route.returnView === 'story_collection')) && route.storyType && route.storySection) {
      const detail = await loadCollectionDetail(route.storyType, route.storySection)
      if (!intent.isCurrent()) return
      collectionReadModelDetail.value = detail
    }
    if ((route.view === 'story_detail' || (route.view === 'player' && route.returnView === 'story_detail')) && route.story) {
      const detail = await loadStoryReadModelDetail(route.story)
      if (!intent.isCurrent()) return
      storyReadModelDetail.value = detail
      route = { ...route, storyType: detail.story.domain, storySection: detail.story.sectionId || '' }
    }
    if (!intent.isCurrent()) return
    filterQuery.value = route.query || ''
    const idolOwnerView = route.view === 'player' ? route.returnView : route.view
    const validRouteIdol = !route.idol || (['groups', 'files'].includes(idolOwnerView) && aliasRoute?.groups
      ? true : ['idol_detail', 'cards', 'card_detail', 'work_archive', 'idol_story_archive', 'mobile_archive', 'story_collection'].includes(idolOwnerView)
      ? archiveBootstrap.idols.some(idol => idol.id === route.idol)
      : Boolean(bootstrapIdolDictionary.by_idol_code[route.idol]))
    const invalidIdolPickTarget = !validRouteIdol ? ({
      idol_detail: 'profile',
      work_archive: 'work',
      idol_story_archive: 'story',
      mobile_archive: 'mobile',
    }[idolOwnerView] || '') : ''
    currentPickTarget.value = invalidIdolPickTarget || route.pickTarget || ''
    currentCategoryId.value = route.view === 'idols' && !route.category ? 'idol' : (route.category || '')
    currentCharacterId.value = validRouteIdol ? (route.idol || '') : ''
    currentCardId.value = route.card || ''
    currentEventId.value = route.event || ''
    eventParentView.value = route.parentView || ''
    detailSourceRoute.value = ownsArchiveSource(route.view, route.returnView) ? (route.sourceRoute || '') : ''
    storyDetailParentView.value = (
      route.view === 'story_detail' ||
      (route.view === 'player' && route.returnView === 'story_detail')
    ) ? (route.parentView || '') : ''
    storyCollectionParentView.value = (
      route.view === 'story_collection' ||
      (route.view === 'player' && route.returnView === 'story_collection')
    ) ? (route.parentView || '') : ''
    currentGashaId.value = route.gasha || ''
    gashaParentView.value = route.view === 'gasha_detail' && route.parentView === 'story_collection'
      && route.storyType === 'extra' && route.storySection ? 'story_collection' : ''
    currentGashaCategory.value = route.gashaType || 'all'
    currentSongId.value = route.song || ''
    stageTargetId.value = route.view === 'chibi_stage' ? (route.stageId || '') : ''
    stageHandoff.value = null
    currentSongScope.value = route.songScope || 'all'
    songParentView.value = route.view === 'song_detail' ? (route.parentView || '') : ''
    currentCardRarity.value = route.rarity || 'all'
    currentCardAssetState.value = route.assetState || 'all'
    currentCardRelationState.value = route.relationState || 'all'
    currentIdolUnitFilter.value = route.unitFilter || ''
    currentStoryDomain.value = route.storyType || ''
    currentStoryMode.value = route.storyMode || 'portal'
    currentStorySection.value = route.storySection || ''
    currentStoryFile.value = route.story || ''
    currentWorkMode.value = route.workMode || 'stories'
    currentEventScope.value = route.eventScope || 'all'
    currentStoryAvailability.value = route.availability || 'all'
    currentStorySort.value = route.sort || 'domain'
    currentMobileMode.value = route.mobileMode || 'personal'
    currentMobileScenarioId.value = route.mobileScenario || ''
    currentEpisodeId.value = route.episode || ''
    const requestedHomeIdol = route.homeIdol
      ? archiveHomeIdols.value.find(idol => idol.id === route.homeIdol)
      : null
    homeSelectedId.value = requestedHomeIdol?.id || ''
    homeSelectedCue.value = requestedHomeIdol?.cues?.find(cue => cue.cue === route.homeCue)?.cue || requestedHomeIdol?.cues?.[0]?.cue || ''
    const defaultHomeModel = requestedHomeIdol?.cues?.find(cue => cue.cue === homeSelectedCue.value)?.modelId
    homeSelectedCostume.value = requestedHomeIdol?.costumes?.find(costume => costume.modelId === route.homeCostume)?.modelId ||
      requestedHomeIdol?.costumes?.find(costume => costume.modelId === defaultHomeModel)?.modelId ||
      requestedHomeIdol?.costumes?.[0]?.modelId || ''
    const restoresEventContext = route.view === 'event_detail' ||
      (route.view === 'player' && route.returnView === 'event_detail')
    currentArchiveUnitCode.value = (
      ['unit_catalog', 'unit_detail', 'mobile_archive'].includes(route.view) ||
      (route.view === 'song_detail' && route.parentView === 'unit_detail') ||
      (route.view === 'player' && route.returnView === 'unit_detail') ||
      (restoresEventContext && route.parentView === 'unit_detail')
    ) ? (route.view === 'mobile_archive'
      ? resolveMobileArchiveUnit({
          idolCode: currentCharacterId.value,
          mode: currentMobileMode.value,
          requestedUnit: route.unit,
          manifest: bootstrapMembership,
          units: mobileUnitOptions.value,
          archive: { by_unit_code: Object.fromEntries(mobileUnitOptions.value.map(unit => [unit.unit_code, true])) },
        })
      : route.unit || '') : ''
    currentGroup.value = aliasRoute?.files?.view.group || null
    currentUnit.value = aliasRoute?.episode?.view.unit || null
    playbackController.reset()

    if (route.view === 'player' && route.voice) {
      if (await restoreVoicePreview(route, intent)) return
      if (!intent.isCurrent()) return
      view.value = currentCard.value ? 'card_detail' : 'cards'
      return
    }
    if (route.view === 'spine_lab') await spineViewerLoader()
    if (route.view === 'chibi_stage') await chibiStageViewerLoader()

    if (!intent.isCurrent()) return
    if (invalidIdolPickTarget) view.value = 'idol_picker'
    else if (route.view === 'unit_detail' && !currentArchiveUnit.value) view.value = 'unit_catalog'
    else if (route.view === 'idol_detail' && !currentIdolProfile.value) view.value = 'idols'
    else if (route.view === 'card_detail' && !currentCard.value) view.value = 'cards'
    else if (route.view === 'gasha_detail' && !currentGasha.value) view.value = 'gashas'
    else if (route.view === 'song_detail' && !currentSong.value) view.value = 'song_catalog'
    else if (route.view === 'event_detail' && !currentEvent.value) view.value = 'story_catalog'
    else if (route.view === 'story_detail' && !currentStory.value) view.value = 'story_catalog'
    else if (route.view === 'story_collection' && !currentStoryCollection.value) view.value = 'story_catalog'
    else if (route.view === 'seasonal_campaign' && !currentSeasonalCampaign.value) view.value = 'story_catalog'
    else if (route.view === 'work_archive' && !currentWorkIdol.value) view.value = 'story_catalog'
    else if (route.view === 'idol_story_archive' && !currentIdolStoryPage.value) view.value = 'story_catalog'
    else if (route.view === 'mobile_archive' && !mobileIdolReadModelDetail.value) view.value = 'story_catalog'
    else if (route.view === 'files' && !currentGroup.value) view.value = currentCharacterId.value ? 'groups' : 'home'
    else if (route.view === 'episodes' && !currentUnit.value) view.value = 'episode_zero_units'
    else view.value = route.view || 'home'
  }, { restoring, intent: inherited })
}

function goHome() {
  detailSourceRoute.value = ''
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
  currentSongId.value = ''
  currentSongScope.value = 'all'
  songParentView.value = ''
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
  const destination = resolveArchiveHomeAction(userPreferences.value, validArchiveHomeIdols.value)
  if (destination.view === 'portal') {
    portalFrom.value = ''
    commitView('portal')
  } else if (destination.view === 'home') {
    return openGameHome(destination.homeIdol || '')
  } else {
    commitView('welcome')
  }
}

function navigateArchiveSection(section) {
  if (section === 'portal') {
    loading.value = false
    return openArchivePortal()
  }
  if (!['home', 'stories', 'songs', 'idols', 'gashas', 'cards', 'resources', 'interactions'].includes(section)) return
  if (section !== 'portal' && section !== 'home') {
    detailSourceRoute.value = view.value === 'portal' ? buildArchiveSourceQuery(currentArchiveRoute()) : ''
  }
  if (section === 'home') goHome()
  else if (section === 'stories') openStoryCatalog()
  else if (section === 'songs') openSongCatalog()
  else if (section === 'idols') openIdolDirectory()
  else if (section === 'cards') openPrimaryCards(preferredArchiveIdol.value?.id || '')
  else if (section === 'interactions') {
    if (preferredArchiveIdol.value) openMobileArchive({ idolCode: preferredArchiveIdol.value.id, mode: 'personal', fromSection: true })
    else openIdolPicker('mobile')
  }
  else if (section === 'gashas') openGashaCatalog()
  else if (section === 'resources') openArchiveStatus()
}

async function openStoryReader(documentId, source = {}, returnSourceRoute = '') {
  const context = view.value === 'reader' ? currentArchiveRoute() : { ...source,
    sourceRoute: returnSourceRoute || buildArchiveSourceQuery(currentArchiveRoute()) }
  const pending = applyArchiveRoute({ ...context, view: 'reader', reading: documentId, readingRow: '', readingRev: '', readingMode: readingMode.value }, { restoring: false })
  // Publish the requested route immediately, including while text is loading.
  syncArchiveRoute()
  await pending
}

async function refreshStoryReader() {
  return navigation.run(async intent => {
    loading.value = true
    try {
      await readingRepository.locator(readingDocumentId.value, { fresh: true })
      if (intent.isCurrent()) await openStoryReader(readingDocumentId.value)
    } catch (error) {
      if (intent.isCurrent()) readingPlaybackNotice.value = `正文刷新失败：${error.message}`
    }
  })
}

function openCollectionReader({ chapter, documentId }) {
  return openStoryReader(documentId, { storyType: currentStoryDomain.value,
    storySection: currentStorySection.value, story: chapter.story?.file || '' })
}

function closeStoryReader() {
  // Legacy event Reader URLs stored the event's parent; newer URLs store the event itself.
  if (detailSourceRoute.value && (!currentEventId.value ||
      readArchiveSourceRoute(detailSourceRoute.value).view === 'event_detail')) return restoreDetailSource(openStoryCatalog)
  if (currentStoryDomain.value === 'work' && currentCharacterId.value) {
    const pending = applyArchiveRoute({ view: 'work_archive', storyType: 'work', idol: currentCharacterId.value,
      story: currentStoryFile.value, workMode: currentWorkMode.value }, { restoring: false })
    const revision = navigation.getRevision()
    return pending.then(() => { if (navigation.getRevision() === revision) syncArchiveRoute() })
  }
  if (currentEventId.value) {
    const pending = applyArchiveRoute({ view: 'event_detail', event: currentEventId.value,
      parentView: eventParentView.value, category: currentCategoryId.value,
      unit: currentArchiveUnitCode.value, sourceRoute: detailSourceRoute.value }, { restoring: false })
    const revision = navigation.getRevision()
    return pending.then(() => { if (navigation.getRevision() === revision) syncArchiveRoute() })
  }
  if (!currentStorySection.value && !currentStoryFile.value) return openStoryCatalog()
  const pending = applyArchiveRoute({ view: currentStorySection.value ? 'story_collection' : 'story_detail', storyType: currentStoryDomain.value,
    storySection: currentStorySection.value, story: currentStoryFile.value }, { restoring: false })
  const revision = navigation.getRevision()
  return pending.then(() => { if (navigation.getRevision() === revision) syncArchiveRoute() })
}

function returnToReader() {
  const route = { ...currentArchiveRoute(), view: 'reader', story: currentStoryFile.value, reading: readingDocumentId.value, readingRow: readingRowId.value,
    readingMode: readingMode.value, readingRev: readingRevision.value,
    category: currentEventId.value ? currentCategoryId.value : '',
    unit: currentEventId.value && eventParentView.value === 'unit_detail' ? currentArchiveUnitCode.value : '',
    parentView: currentEventId.value ? eventParentView.value : '',
    sourceRoute: detailSourceRoute.value }
  const pending = applyArchiveRoute(route, { restoring: false })
  syncArchiveRoute()
  return pending
}

function openEventReader(documentId) {
  return openStoryReader(documentId, { event: currentEventId.value, parentView: eventParentView.value,
    category: currentCategoryId.value, unit: currentArchiveUnitCode.value,
    sourceRoute: detailSourceRoute.value })
}

function openIdolStoryReader({ section, episode }) {
  const entry = readyEpisodeReading(readingCatalogEntries.value, episode)
  if (!entry) return
  const source = { ...currentArchiveRoute(), view: 'idol_story_archive', storyType: 'idol_story',
    idol: currentCharacterId.value, storySection: String(section.id), episode: String(episode.id), story: episode.file }
  return openStoryReader(entry.document_id, source, buildArchiveSourceQuery(source))
}

function openWorkReader(file) {
  const entry = readingCatalogEntries.value.find(entry => entry.source_file === file && entry.status === 'ready')
  if (entry) return openStoryReader(entry.document_id, { storyType: 'work', idol: currentCharacterId.value,
    story: file, workMode: currentWorkMode.value })
}

async function openReaderPlayback(rowId, { intent: inherited, route, fullDocument = false } = {}) {
  return navigation.run(async intent => {
    readingPlaybackNotice.value = ''
    try {
      const entry = readingState.value.entries.find(e => e.document_id === readingDocumentId.value)
      const revision = route ? route.readingRev : (readingRevision.value || entry?.sha256)
      // An initial index of 1 denotes the full episode; row remains the return location.
      const target = readingPlaybackTarget(readingState.value.document, rowId, revision, entry,
        { fullDocument: route ? route.initialStep === 1 : fullDocument })
      if (route && (route.scenario !== target.file || route.startStep !== target.startStep ||
          route.endStep !== target.endStep || route.initialStep !== target.initialStep)) {
        throw Error('链接中的演出范围与正文定位不一致，请从正文重新打开演出。')
      }
      readingRevision.value = revision
      readingRowId.value = rowId
      // Pin the requested text version/row even if media preparation subsequently fails.
      if (!route) syncArchiveRoute({ replace: true })
      loadingPurpose.value = 'story-playback'
      const loaded = await playbackController.load(target.file, 'reader', { ...target, intent, syncRoute: !route })
      if (!loaded && intent.isCurrent()) readingPlaybackNotice.value = playbackError.value
    } catch (error) {
      if (intent.isCurrent()) readingPlaybackNotice.value = error.message
    }
  }, { intent: inherited })
}

function updateReadingMode(mode) {
  readingMode.value = mode
  syncArchiveRoute({ replace: true })
}

function locateReadingRow(rowId) {
  if (view.value !== 'reader' || readingState.value.status !== 'ready' || !readingState.value.document.rows.some(row => row.anchor.row_id === rowId)) return
  readingRowId.value = rowId
  syncArchiveRoute({ replace: true })
}

function storeUserPreferences(next) {
  const result = saveArchiveUserPreferences({ ...userPreferences.value, ...next })
  userPreferences.value = result.preferences
  userPreferenceNotice.value = result.issue
  return result.preferences
}

function chooseLightStartup() {
  storeUserPreferences({ startupMode: 'light', startupIdol: null, onboardingComplete: true })
  if (view.value === 'welcome' && detailSourceRoute.value) return restoreDetailSource(openRootPortal)
  openRootPortal()
}

function openRootPortal() {
  legacyEntryStatus.value = ''
  portalFrom.value = ''
  commitView('portal')
  nextTick(() => {
    if (view.value !== 'portal' || !portalFrom.value) return
    portalFrom.value = ''
    syncArchiveRoute({ replace: true, restoreView: false })
  })
}

function chooseStartupLater() {
  if (view.value === 'welcome' && detailSourceRoute.value) return restoreDetailSource(openRootPortal)
  openRootPortal()
}

function chooseImmersiveIdol({ idolCode, rememberStartup = true, setPreferred = false } = {}) {
  const isGeneralPicker = view.value === 'idol_picker' && currentPickTarget.value !== 'home'
  if (!(isGeneralPicker ? archivePickerIdols.value : archiveHomeIdols.value).some(idol => idol.id === idolCode)) return
  const next = {}
  if (rememberStartup) Object.assign(next, { startupMode: 'immersive', startupIdol: idolCode, onboardingComplete: true })
  if (setPreferred) next.preferredIdol = idolCode
  if (Object.keys(next).length) storeUserPreferences(next)
  if (view.value === 'idol_picker') {
    const target = currentPickTarget.value
    captureDetailSource()
    currentPickTarget.value = ''
    if (target === 'profile') openPrimaryIdol(idolCode)
    else if (target === 'work') openWorkArchive(idolCode)
    else if (target === 'story') openIdolStoryArchive(idolCode)
    else if (target === 'mobile') openMobileArchive({ idolCode, mode: 'personal' })
    else openGameHome(idolCode)
    return
  }
  openGameHome(idolCode)
}

function savePreferredIdol(idolCode) {
  if (idolCode && !archivePickerIdols.value.some(idol => idol.id === idolCode)) return
  const preferredIdol = idolCode || null
  storeUserPreferences({ preferredIdol })
}

function clearUserPreferences() {
  legacyEntryStatus.value = ''
  const result = clearArchiveUserPreferences()
  userPreferences.value = result.preferences
  userPreferenceNotice.value = result.issue || '启动与“我的偶像”设置已清除。'
  homeSelectedId.value = ''
  homeSelectedCue.value = ''
  homeSelectedCostume.value = ''
  commitView('welcome', { replace: true })
}

function openWelcomeSettings() {
  legacyEntryStatus.value = ''
  userPreferenceNotice.value = ''
  captureDetailSource()
  commitView('welcome')
}

function openIdolPicker(target) {
  if (!['home', 'profile', 'work', 'story', 'mobile'].includes(target)) return
  captureDetailSource()
  currentPickTarget.value = target
  commitView('idol_picker')
}

function cancelWelcomeOrPicker() {
  legacyEntryStatus.value = ''
  if (detailSourceRoute.value) return restoreDetailSource(openRootPortal)
  if (view.value === 'idol_picker') openRootPortal()
}

async function openGameHome(idolCode = '') {
  const candidate = [idolCode, userPreferences.value.startupIdol, userPreferences.value.preferredIdol]
    .find(code => validArchiveHomeIdols.value.includes(code)) || ''
  if (!candidate) return openIdolPicker('home')
  const request = ++pendingHomeNavigation
  const revision = navigation.getRevision()
  homeEntryStatus.value = '正在准备游戏风首页…'
  try {
    await loadHomeIdol(candidate)
  } catch (error) {
    if (request !== pendingHomeNavigation || revision !== navigation.getRevision()) return
    console.error('[HomeReadModel] Failed to open Home:', error)
    homeEntryStatus.value = '游戏风首页暂时无法打开，请重试。'
    userPreferenceNotice.value = homeEntryStatus.value
    return
  }
  if (request !== pendingHomeNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
  homeEntryStatus.value = ''
  detailSourceRoute.value = ''
  portalFrom.value = ''
  homeSelectedId.value = candidate
  homeSelectedCue.value = ''
  homeSelectedCostume.value = ''
  commitView('home')
}

function openPreferredDestination(destination) {
  if (destination === 'profile') {
    const idolCode = preferredArchiveIdol.value?.id
    if (idolCode) return openIdolReadModel(idolCode, { captureSource: true, resetContext: true })
    return
  }
  const idolCode = preferredArchiveIdol.value?.id
  if (!idolCode) return
  if (destination === 'cards') captureDetailSource()
  if (destination === 'cards') openPrimaryCards(idolCode)
  else if (destination === 'work') openWorkArchive(idolCode)
  else if (destination === 'story') openIdolStoryArchive(idolCode)
  else if (destination === 'mobile') openMobileArchive({ idolCode, mode: 'personal' })
}

function openArchivePortal() {
  if (!archiveShellVisible.value || view.value === 'portal') return
  legacyEntryStatus.value = ''
  const source = currentArchiveRoute()
  portalFrom.value = ['welcome', 'idol_picker'].includes(source.view) ||
    (source.view === 'home' && !source.homeIdol)
    ? ''
    : buildPortalReturnQuery(source)
  commitView('portal')
}

async function closeArchivePortal() {
  if (!portalFrom.value) return
  let route = readPortalReturnRoute(portalFrom.value)
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
  if (route.view === 'story_collection' && route.storyType && route.storySection) collectionReadModelDetail.value = await loadCollectionDetail(route.storyType, route.storySection)
  if (route.view === 'story_detail' && route.story) storyReadModelDetail.value = await loadStoryReadModelDetail(route.story)
  const pending = applyArchiveRoute(route)
  const expected = navigation.getRevision()
  await pending
  if (navigation.isDisposed() || expected !== navigation.getRevision()) return
  syncArchiveRoute()
}

function openSongCatalog() {
  if (view.value !== 'portal') detailSourceRoute.value = ''
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

function openSongStage(target) {
  if (view.value !== 'song_detail' || target?.songCode !== currentSongId.value || !target.choreographyId) return
  return openChibiStage(target)
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

function openHomeIdol(idolId) {
  currentCategoryId.value = 'idol'
  openIdol({ id: idolId })
}

function openHomeCards(idolId) {
  return openPrimaryCards(idolId, { captureSource: true })
}

function openHomeChat(idolId) {
  openMobileArchive({ idolCode: idolId, mode: 'personal' })
}

function goArchiveBack() {
  if (view.value === 'reader') return closeStoryReader()
  if (view.value === 'portal') return closeArchivePortal()
  if (view.value === 'welcome' || view.value === 'idol_picker') return cancelWelcomeOrPicker()
  if (detailSourceRoute.value) return restoreDetailSource(goHome)
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
    gasha_detail: goBackFromGasha,
    song_catalog: goHome,
    song_detail: () => {
      const parent = songParentView.value
      currentSongId.value = ''
      songParentView.value = ''
      if (parent === 'idol_detail' && archiveBootstrap.idols.some(idol => idol.id === currentCharacterId.value)) commitView('idol_detail')
      else if (parent === 'unit_detail' && currentArchiveUnit.value) commitView('unit_detail')
      else {
        commitView('song_catalog')
        ensureSongCatalog()
      }
    },
    event_detail: goBackFromEvent,
    archive_status: goHome,
    story_catalog: () => {
      if (
        currentStoryMode.value === 'portal' &&
        ['main', 'extra', 'birthday'].includes(currentStoryDomain.value)
      ) {
        currentStoryDomain.value = ''
        currentStorySection.value = ''
        commitView('story_catalog')
        return
      }
      goHome()
    },
    external_story_resources: openStoryCatalog,
    story_detail: () => {
      const parent = storyDetailParentView.value
      currentStoryFile.value = ''
      storyDetailParentView.value = ''
      if (parent === 'external_story_resources') {
        commitView('external_story_resources')
        return
      }
      return openStoryCatalog()
    },
    story_collection: () => {
      const parent = storyCollectionParentView.value
      if (parent === 'idol_story_archive' && currentCharacterId.value) {
        currentStoryDomain.value = 'idol_story'
        currentStorySection.value = ''
        currentStoryFile.value = ''
        storyCollectionParentView.value = ''
        commitView('idol_story_archive')
        return
      }
      if (parent === 'song_detail' && currentSongId.value) {
        currentStoryDomain.value = ''
        currentStorySection.value = ''
        currentStoryFile.value = ''
        storyCollectionParentView.value = ''
        commitView('song_detail')
        return
      }
      const domain = currentStoryDomain.value
      const returnsToDomainLanding = ['main', 'extra', 'birthday'].includes(domain) && parent !== 'external_story_resources'
      storyCollectionParentView.value = ''
      if (parent === 'external_story_resources') {
        currentStoryDomain.value = ''
        currentStorySection.value = ''
        currentStoryFile.value = ''
        commitView('external_story_resources')
        return
      }
      return openStoryCatalog({ domain: returnsToDomainLanding ? domain : '' })
    },
    seasonal_campaign: () => {
      currentStoryDomain.value = ''
      currentStorySection.value = ''
      return openStoryCatalog()
    },
    work_archive: () => {
      currentStoryDomain.value = ''
      currentCharacterId.value = ''
      return openStoryCatalog()
    },
    idol_story_archive: () => {
      currentCharacterId.value = ''
      return openStoryCatalog()
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

function openArchiveStatus() {
  const request = ++pendingResourceNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  resourceReadModelStatus.value = '正在读取资源状态…'
  loading.value = true
  return prepareArchivePage('archive_status', loadResourceStatus()).then(detail => {
    if (request !== pendingResourceNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    resourceReadModelDetail.value = detail
    resourceReadModelStatus.value = ''
    if (view.value !== 'portal') detailSourceRoute.value = ''
    filterQuery.value = ''
    currentStoryDomain.value = ''
    currentEventScope.value = 'all'
    currentStoryAvailability.value = 'all'
    currentStorySort.value = 'domain'
    commitView('archive_status')
  }).catch(error => {
    if (request !== pendingResourceNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[ResourceReadModel] Failed to open status:', error)
    resourceReadModelStatus.value = '资源状态暂时无法读取，请重试。'
  })
}

function openGashaCatalog() {
  const request = ++pendingGashaNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  gashaReadModelStatus.value = '正在读取卡池目录…'
  loading.value = true
  return prepareArchivePage('gashas', loadGashaCatalog()).then(() => {
    if (request !== pendingGashaNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    gashaReadModelStatus.value = ''
    if (view.value !== 'portal') detailSourceRoute.value = ''
    gashaParentView.value = ''
    filterQuery.value = ''
    currentCategoryId.value = ''
    currentCharacterId.value = ''
    currentCardId.value = ''
    currentGashaId.value = ''
    currentGashaCategory.value = 'all'
    commitView('gashas')
  }).catch(error => {
    if (request !== pendingGashaNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[GashaReadModel] Failed to load catalog:', error)
    gashaReadModelStatus.value = '卡池目录暂时无法读取，请重试。'
  })
}

async function openStoryCatalog(options = {}) {
  const domain = typeof options?.domain === 'string' ? options.domain : ''
  if (view.value !== 'portal') detailSourceRoute.value = ''
  loading.value = true
  return navigation.run(async intent => {
    await prepareArchivePage('story_catalog', loadStoryReadModelLanding())
    if (!intent.isCurrent()) return
    filterQuery.value = ''
    currentStoryDomain.value = domain
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
  }).catch(error => {
    loading.value = false
    console.error('[StoryReadModel] Failed to load catalog:', error)
    storyReadModelStatus.value = '故事目录暂时无法读取，请重试。'
  })
}

function openExternalStoryResources() {
  detailSourceRoute.value = ''
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
  return openProjectedCollection({ domain: target.domain, section: target.section,
    storyFile: target.storyFile, parent: 'external_story_resources' })
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
    return openProjectedCollection({ domain, section })
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
  const request = ++pendingSeasonalNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  seasonalReadModelStatus.value = '正在读取季节企划…'
  loading.value = true
  return prepareArchivePage('seasonal_campaign', loadSeasonalDetail(campaignId)).then(detail => {
    if (request !== pendingSeasonalNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    seasonalReadModelDetail.value = detail
    seasonalReadModelStatus.value = ''
    captureDetailSource()
    currentStoryDomain.value = 'seasonal_campaign'
    currentStoryMode.value = 'portal'
    currentStorySection.value = detail.id
    commitView('seasonal_campaign')
  }).catch(error => {
    if (request !== pendingSeasonalNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[SeasonalReadModel] Failed to load campaign:', error)
    seasonalReadModelStatus.value = '季节企划暂时无法读取，请重试。'
  })
}

function openProjectedCollection({ domain, section, storyFile = '', parent = '' }) {
  const request = ++pendingCollectionNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  collectionReadModelStatus.value = '正在读取故事章节…'
  loading.value = true
  return prepareArchivePage('story_collection', loadCollectionDetail(domain, section)).then(detail => {
    if (request !== pendingCollectionNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    collectionReadModelDetail.value = detail
    collectionReadModelStatus.value = ''
    captureDetailSource()
    currentStoryDomain.value = domain
    currentStorySection.value = String(section)
    currentStoryMode.value = 'portal'
    currentStoryFile.value = storyFile || ''
    storyCollectionParentView.value = parent
    commitView('story_collection')
  }).catch(error => {
    if (request !== pendingCollectionNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[CollectionReadModel] Failed to open collection:', error)
    collectionReadModelStatus.value = '故事章节暂时无法读取，请重试。'
  })
}

function selectSeasonalCampaign(campaignId) {
  const request = ++pendingSeasonalNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  seasonalReadModelStatus.value = '正在切换季节企划…'
  loading.value = true
  return prepareArchivePage('seasonal_campaign', loadSeasonalDetail(campaignId)).then(detail => {
    if (request !== pendingSeasonalNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    seasonalReadModelDetail.value = detail
    seasonalReadModelStatus.value = ''
    currentStorySection.value = detail.id
    commitArchiveSelection()
  }).catch(error => {
    if (request !== pendingSeasonalNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[SeasonalReadModel] Failed to switch campaign:', error)
    seasonalReadModelStatus.value = '企划切换失败，请重试。'
  })
}

function playSeasonalCampaignStory(file) {
  if (file) loadScenario(file, 'seasonal_campaign')
}

function openWorkArchive(idolCode = '') {
  if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return openIdolPicker('work')
  const request = ++pendingWorkNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  workReadModelStatus.value = '正在读取工作档案…'
  loading.value = true
  return prepareArchivePage('work_archive', loadWorkDetail(idolCode)).then(detail => {
    if (request !== pendingWorkNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    workReadModelDetail.value = detail
    workReadModelStatus.value = ''
    captureDetailSource()
    currentStoryDomain.value = 'work'
    currentStoryFile.value = ''
    currentWorkMode.value = 'stories'
    currentStoryMode.value = 'portal'
    currentStorySection.value = ''
    currentCharacterId.value = idolCode
    commitView('work_archive')
  }).catch(error => {
    if (request !== pendingWorkNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[WorkReadModel] Failed to open idol:', error)
    workReadModelStatus.value = '工作档案暂时无法读取，请重试。'
  })
}

function selectWorkIdol(idolCode) {
  if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
  const request = ++pendingWorkNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  workReadModelStatus.value = '正在切换工作档案…'
  loading.value = true
  return prepareArchivePage('work_archive', loadWorkDetail(idolCode)).then(detail => {
    if (request !== pendingWorkNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    workReadModelDetail.value = detail
    workReadModelStatus.value = ''
    currentCharacterId.value = idolCode
    currentStoryFile.value = ''
    commitArchiveSelection()
  }).catch(error => {
    if (request !== pendingWorkNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[WorkReadModel] Failed to switch idol:', error)
    workReadModelStatus.value = '工作档案切换失败，请重试。'
  })
}

function setWorkMode(mode) {
  if (!['stories', 'lines'].includes(mode) || currentWorkMode.value === mode) return
  currentWorkMode.value = mode
  currentStoryFile.value = ''
  commitArchiveSelection()
}

function playWorkStory(file) {
  if (file) loadScenario(file, 'work_archive')
}

function openIdolStoryArchive(idolCode = '') {
  if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return openIdolPicker('story')
  const request = ++pendingIdolStoryNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  idolStoryReadModelStatus.value = '正在读取个人故事…'
  loading.value = true
  return prepareArchivePage('idol_story_archive', loadIdolStoryDetail(idolCode)).then(detail => {
    if (request !== pendingIdolStoryNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    idolStoryReadModelDetail.value = detail
    idolStoryReadModelStatus.value = ''
    captureDetailSource()
    filterQuery.value = ''
    currentStoryDomain.value = 'idol_story'
    currentStoryMode.value = 'portal'
    currentStorySection.value = ''
    currentEpisodeId.value = ''
    currentCharacterId.value = idolCode
    currentMobileScenarioId.value = ''
    commitView('idol_story_archive')
  }).catch(error => {
    if (request !== pendingIdolStoryNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[IdolStoryReadModel] Failed to open idol:', error)
    idolStoryReadModelStatus.value = '个人故事暂时无法读取，请重试。'
  })
}

function selectIdolStory(idolCode) {
  if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
  const request = ++pendingIdolStoryNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  idolStoryReadModelStatus.value = '正在切换个人故事…'
  loading.value = true
  return prepareArchivePage('idol_story_archive', loadIdolStoryDetail(idolCode)).then(detail => {
    if (request !== pendingIdolStoryNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    idolStoryReadModelDetail.value = detail
    idolStoryReadModelStatus.value = ''
    currentCharacterId.value = idolCode
    currentStorySection.value = ''
    currentEpisodeId.value = ''
    currentMobileScenarioId.value = ''
    commitArchiveSelection()
  }).catch(error => {
    if (request !== pendingIdolStoryNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[IdolStoryReadModel] Failed to switch idol:', error)
    idolStoryReadModelStatus.value = '个人故事切换失败，请重试。'
  })
}

async function openBirthdayIdolStory(relation) {
  if (!relation?.idolCode || !archiveBootstrap.idols.some(idol => idol.id === relation.idolCode)) return
  return navigation.run(async intent => {
    const detail = await loadIdolStoryDetail(relation.idolCode)
    if (!intent.isCurrent()) return
    if (!detail.view.page) return
    idolStoryReadModelDetail.value = detail
    captureDetailSource()
    currentStoryDomain.value = 'idol_story'
    currentStoryMode.value = 'portal'
    currentCharacterId.value = relation.idolCode
    currentStorySection.value = String(relation.sectionId || '')
    currentEpisodeId.value = String(relation.episodeId || '')
    currentStoryFile.value = ''
    storyCollectionParentView.value = ''
    commitView('idol_story_archive')
  })
}

function openIdolBirthdayArchive() {
  if (!currentCharacterId.value) return
  return openProjectedCollection({ domain: 'birthday', section: currentCharacterId.value,
    parent: 'idol_story_archive' })
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

async function openMobileArchive({ idolCode = '', mode = 'personal', scenarioId = '', fromSection = false } = {}) {
  return navigation.run(async intent => {
    if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return openIdolPicker('mobile')
    const selectedMode = ['personal', 'phone', 'unit', 'random'].includes(mode) ? mode : 'personal'
    let mobile
    try { mobile = await loadMobileRoute(idolCode, selectedMode) }
    catch (error) {
      if (intent.isCurrent()) {
        console.error('[MobileReadModel] Failed to open archive:', error)
        legacyEntryStatus.value = 'Mobile 通信暂时无法读取，请重试。'
      }
      return
    }
    if (!intent.isCurrent()) return
    legacyEntryStatus.value = ''
    mobileReadModelStatus.value = ''
    if (!fromSection) captureDetailSource()
    mobileIdolReadModelDetail.value = mobile.idol
    mobileUnitReadModelDetail.value = mobile.unit
    currentCharacterId.value = idolCode
    currentMobileMode.value = selectedMode
    currentArchiveUnitCode.value = mobile.unitCode
    currentMobileScenarioId.value = scenarioId ? String(scenarioId) : ''
    currentStoryDomain.value = 'mobile_archive'
    currentStoryMode.value = 'portal'
    commitView('mobile_archive')
  })
}

function openStoryCommunication(scenario) {
  openMobileArchive({
    idolCode: scenario?.idol_code || currentCharacterId.value,
    mode: scenario?.kind === 'idol_phone' ? 'phone' : 'personal',
    scenarioId: scenario?.id || '',
  })
}

async function selectMobileIdol(idolCode) {
  if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
  const request = ++pendingMobileNavigation
  const revision = navigation.getRevision()
  let mobile
  try { mobile = await loadMobileRoute(idolCode, currentMobileMode.value) }
  catch (error) {
    if (request === pendingMobileNavigation && revision === navigation.getRevision()) {
      console.error('[MobileReadModel] Failed to switch idol:', error)
      mobileReadModelStatus.value = '偶像通信暂时无法读取，请重试。'
    }
    return
  }
  if (request !== pendingMobileNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
  mobileIdolReadModelDetail.value = mobile.idol
  mobileUnitReadModelDetail.value = mobile.unit
  mobileReadModelStatus.value = ''
  currentCharacterId.value = idolCode
  currentArchiveUnitCode.value = mobile.unitCode
  currentMobileScenarioId.value = ''
  commitArchiveSelection()
}

async function selectMobileUnit(unitCode) {
  if (!mobileUnitOptions.value.some(unit => unit.unit_code === unitCode)) return
  const request = ++pendingMobileNavigation
  const revision = navigation.getRevision()
  let detail
  try { detail = await loadMobileDetail('mobile-units', unitCode) }
  catch (error) {
    if (request === pendingMobileNavigation && revision === navigation.getRevision()) {
      console.error('[MobileReadModel] Failed to switch unit:', error)
      mobileReadModelStatus.value = '组合通信暂时无法读取，请重试。'
    }
    return
  }
  if (request !== pendingMobileNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
  mobileUnitReadModelDetail.value = detail
  mobileReadModelStatus.value = ''
  currentArchiveUnitCode.value = unitCode
  currentMobileScenarioId.value = ''
  commitArchiveSelection()
}

async function setMobileMode(mode) {
  if (!['personal', 'phone', 'unit', 'random'].includes(mode)) return
  const request = ++pendingMobileNavigation
  const revision = navigation.getRevision()
  let mobile
  try { mobile = await loadMobileRoute(currentCharacterId.value, mode, currentArchiveUnitCode.value) }
  catch (error) {
    if (request === pendingMobileNavigation && revision === navigation.getRevision()) {
      console.error('[MobileReadModel] Failed to switch mode:', error)
      mobileReadModelStatus.value = '通信分类暂时无法读取，请重试。'
    }
    return
  }
  if (request !== pendingMobileNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
  mobileIdolReadModelDetail.value = mobile.idol
  mobileUnitReadModelDetail.value = mobile.unit
  mobileReadModelStatus.value = ''
  currentMobileMode.value = mode
  currentArchiveUnitCode.value = mobile.unitCode
  currentMobileScenarioId.value = ''
  commitArchiveSelection()
}

function playMobileScenario(file) {
  if (file) loadScenario(file, 'mobile_archive')
}

function playRandomTalkTopic(topic) {
  if (!topic?.file || !Number(topic.startStep)) return
  loadScenario(topic.file, 'mobile_archive', {
    startStep: topic.startStep,
    endStep: topic.endStep,
  })
}

async function openMobileCard(cardId) {
  const refs = currentMobileMode.value === 'unit' ? mobileUnitReadModelDetail.value?.view?.cardRefs : mobileIdolReadModelDetail.value?.view?.cardRefs
  const card = (refs || []).find(entry => Number(entry.card_id) === Number(cardId))
  if (!card) return
  const revision = navigation.getRevision()
  let detail
  try { detail = await loadCardDetail(card.resource_id) }
  catch (error) { console.error('[CardReadModel] Failed to open mobile relation:', error); return }
  if (revision !== navigation.getRevision() || navigation.isDisposed()) return
  cardReadModelDetail.value = detail
  captureDetailSource()
  currentCategoryId.value = 'cards'
  currentCharacterId.value = card.character_id
  currentCardId.value = card.resource_id
  commitView('card_detail')
}

async function openMobileIdolStory(episodeId) {
  const refs = currentMobileMode.value === 'unit' ? mobileUnitReadModelDetail.value?.view?.episodeRefs : mobileIdolReadModelDetail.value?.view?.episodeRefs
  const relation = (refs || []).find(entry => Number(entry.id) === Number(episodeId))
  if (!relation) return
  if (!relation.idolCode) return
  const revision = navigation.getRevision()
  let detail
  try { detail = await loadIdolStoryDetail(relation.idolCode) }
  catch (error) {
    if (revision !== navigation.getRevision()) return
    console.error('[IdolStoryReadModel] Failed to open mobile relation:', error)
    idolStoryReadModelStatus.value = '个人故事暂时无法读取，请重试。'
    return
  }
  if (revision !== navigation.getRevision() || navigation.isDisposed()) return
  idolStoryReadModelDetail.value = detail
  captureDetailSource()
  currentStoryDomain.value = 'idol_story'
  currentStoryMode.value = 'portal'
  currentCharacterId.value = relation.idolCode
  currentStorySection.value = String(relation.sectionId)
  currentEpisodeId.value = String(episodeId)
  currentMobileScenarioId.value = ''
  commitView('idol_story_archive')
}

function openUnitCatalog() {
  const request = ++pendingUnitNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  unitReadModelStatus.value = '正在读取组合目录…'
  loading.value = true
  return prepareArchivePage('unit_catalog', loadUnitCatalog()).then(() => {
    if (request !== pendingUnitNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    unitReadModelStatus.value = ''
    captureDetailSource()
    filterQuery.value = ''
    currentCategoryId.value = 'idol'
    currentCharacterId.value = ''
    currentArchiveUnitCode.value = ''
    commitView('unit_catalog')
  }).catch(error => {
    if (request !== pendingUnitNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[UnitReadModel] Failed to load unit catalog:', error)
    unitReadModelStatus.value = '组合目录暂时无法读取，请重试。'
  })
}

function openArchiveUnit(unit, { clearEventContext = false } = {}) {
  if (!unit) return
  const code = String(unit.unit_code || unit.unit_id || '')
  const request = ++pendingUnitNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  unitReadModelStatus.value = '正在读取组合详情…'
  loading.value = true
  return prepareArchivePage('unit_detail', loadUnitDetail(code)).then(detail => {
    if (request !== pendingUnitNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    unitReadModelDetail.value = detail
    unitReadModelStatus.value = ''
    captureDetailSource()
    if (clearEventContext) { currentEventId.value = ''; eventParentView.value = '' }
    currentCategoryId.value = 'idol'
    currentCharacterId.value = ''
    currentArchiveUnitCode.value = detail.view.entry.unit.unit_code
    commitView('unit_detail')
  }).catch(error => {
    if (request !== pendingUnitNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[UnitReadModel] Failed to load unit detail:', error)
    unitReadModelStatus.value = '组合详情暂时无法读取，请重试。'
  })
}

function openUnitFromIdol(idol) {
  if (idol?.unit_code) return openArchiveUnit({ unit_code: idol.unit_code })
}

function openUnitMember(member) {
  return openIdolReadModel(member.idol_code, { captureSource: true, resetContext: true, clearUnit: true })
}

function openUnitStory(story) {
  if (story?.file && story.exists) return loadScenario(story.file, 'unit_detail')
}

function openUnitEvent(event) {
  return openEventDetail(event, 'unit_detail')
}

function openUnitCards() {
  const unitId = String(currentArchiveUnit.value?.unit_id || '')
  if (!unitId) return
  const request = ++pendingCardNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  unitReadModelStatus.value = '正在读取卡片目录…'
  loading.value = true
  return prepareArchivePage('cards', loadCardCatalog()).then(() => {
    if (request !== pendingCardNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    unitReadModelStatus.value = ''
    captureDetailSource()
    filterQuery.value = ''
    currentCategoryId.value = 'cards'
    currentCharacterId.value = ''
    currentArchiveUnitCode.value = ''
    currentIdolUnitFilter.value = unitId
    currentCardRarity.value = 'all'
    currentCardAssetState.value = 'all'
    currentCardRelationState.value = 'all'
    commitView('idols')
  }).catch(error => {
    if (request !== pendingCardNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[CardReadModel] Failed to load unit cards:', error)
    unitReadModelStatus.value = '卡片目录暂时无法读取，请重试。'
  })
}

function openCatalogStory(entry) {
  if (entry?.eventRelation) openEventDetail(entry.eventRelation, 'story_catalog')
  else openStoryDetail(entry)
}

function openStoryDetail(entry, parentView = '') {
  if (!entry?.file) return
  const file = entry.file
  const request = ++pendingStoryDetailNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  storyReadModelStatus.value = '正在读取故事详情…'
  loading.value = true
  return prepareArchivePage('story_detail', loadStoryReadModelDetail(file)).then(detail => {
    if (request !== pendingStoryDetailNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    storyReadModelDetail.value = detail
    storyReadModelStatus.value = ''
    captureDetailSource()
    currentStoryFile.value = file
    currentStoryDomain.value = detail.story.domain
    currentStorySection.value = detail.story.sectionId || ''
    storyDetailParentView.value = parentView
    commitView('story_detail')
  }).catch(error => {
    if (request !== pendingStoryDetailNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[StoryReadModel] Failed to open detail:', error)
    storyReadModelStatus.value = '故事详情暂时无法读取，请重试。'
  })
}

function playStoryDetail(entry = currentStory.value) {
  if (entry?.file && entry.exists) loadScenario(entry.file, 'story_detail')
}

function playStoryCollectionChapter(chapter) {
  selectStoryCollectionChapter(chapter, { sync: false })
  const queue = (chapter?.episodes || []).filter(episode => episode.exists && episode.file)
  if (queue.length) startEpisodeQueue(queue, 0, 'story_collection')
  else if (chapter?.file && chapter.exists) loadScenario(chapter.file, 'story_collection')
}

function playStoryCollectionEpisode({ chapter, episode }) {
  selectStoryCollectionChapter(chapter, { sync: false })
  const queue = (chapter?.episodes || []).filter(candidate => candidate.exists && candidate.file)
  const index = queue.findIndex(candidate => candidate.id === episode?.id)
  if (index >= 0) startEpisodeQueue(queue, index, 'story_collection')
}

function selectStoryCollectionChapter(chapter, { sync = true } = {}) {
  const file = chapter?.story?.file || chapter?.file || ''
  if (!file || currentStoryFile.value === file) return
  currentStoryFile.value = file
  if (sync) commitArchiveSelection()
}

function openStoryIdol(idolCode) {
  if (!/^\d{3}[a-z0-9]{3}$/i.test(idolCode)) return
  captureDetailSource()
  currentCategoryId.value = 'idol'
  currentCharacterId.value = idolCode
  commitView('idol_detail')
}

function goBackToCards() {
  if (detailSourceRoute.value) {
    currentCardId.value = ''
    return restoreDetailSource(() => commitView('cards'))
  }
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
    if (preferredArchiveIdol.value) openPrimaryIdol(preferredArchiveIdol.value.id)
    else openIdolPicker('profile')
  } else if (cat.id === 'cards') {
    openPrimaryCards(preferredArchiveIdol.value?.id || '')
  } else if (cat.id === 'idol_chat' || cat.id === 'idol_phone') {
    if (preferredArchiveIdol.value) {
      openMobileArchive({
        idolCode: preferredArchiveIdol.value.id,
        mode: cat.id === 'idol_phone' ? 'phone' : 'personal',
      })
    } else openIdolPicker('mobile')
  } else if (cat.id === 'episode_zero') {
    const request = ++pendingLegacyAliasNavigation
    const revision = navigation.getRevision()
    loadLegacyAliasDetail('legacy-zero', 'episode_zero').then(detail => {
      if (request !== pendingLegacyAliasNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      legacyZeroReadModelDetail.value = detail
      legacyAliasStatus.value = ''
      currentCategoryId.value = 'episode_zero'
      commitView('episode_zero_units')
    }).catch(error => {
      if (request !== pendingLegacyAliasNavigation || revision !== navigation.getRevision()) return
      console.error('[LegacyAliasReadModel] Failed to open episode zero:', error)
      legacyAliasStatus.value = '第零话目录暂时无法读取，请重试。'
    })
  } else {
    const request = ++pendingLegacyAliasNavigation
    const revision = navigation.getRevision()
    loadLegacyAliasDetail('legacy-groups', cat.id).then(detail => {
      if (request !== pendingLegacyAliasNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      legacyGroupReadModelDetail.value = detail
      legacyAliasStatus.value = ''
      currentCategoryId.value = cat.id
      currentCharacterId.value = ''
      currentGroup.value = null
      commitView('groups')
    }).catch(error => {
      if (request !== pendingLegacyAliasNavigation || revision !== navigation.getRevision()) return
      console.error('[LegacyAliasReadModel] Failed to open groups:', error)
      legacyAliasStatus.value = '剧情分组暂时无法读取，请重试。'
    })
  }
}

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

function openPrimaryCards(idolCode = '', { captureSource = false } = {}) {
  const request = ++pendingCardNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  cardReadModelStatus.value = '正在读取卡片目录…'
  loading.value = true
  return prepareArchivePage('cards', loadCardCatalog()).then(() => {
    if (request !== pendingCardNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    cardReadModelStatus.value = ''
    if (captureSource) captureDetailSource()
    filterQuery.value = ''
    currentCategoryId.value = 'cards'
    currentCharacterId.value = archiveBootstrap.idols.some(idol => idol.id === idolCode) ? idolCode : ''
    currentGroup.value = null
    currentCardId.value = ''
    currentCardRarity.value = 'all'
    currentCardAssetState.value = 'all'
    currentCardRelationState.value = 'all'
    commitView('cards')
  }).catch(error => {
    if (request !== pendingCardNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[CardReadModel] Failed to load catalog:', error)
    cardReadModelStatus.value = '卡片目录暂时无法读取，请重试。'
  })
}

function selectPrimaryIdol(idolCode) {
  if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
  return openIdolReadModel(idolCode, { selection: true })
}

function selectCardIdol(idolCode) {
  if (!archiveBootstrap.idols.some(idol => idol.id === idolCode)) return
  currentCharacterId.value = idolCode
  currentCardId.value = ''
  filterQuery.value = ''
  currentCardRarity.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  commitArchiveSelection()
}

function openIdol(entry) {
  if (currentCategoryId.value !== 'cards') return openIdolReadModel(entry.id, { captureSource: true })
  captureDetailSource()
  filterQuery.value = ''
  currentCharacterId.value = entry.id
  currentCardId.value = ''
  currentCardRarity.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  commitView('cards')
}

function openIdolDomain(domain) {
  if (domain === 'cards') return openPrimaryCards(currentCharacterId.value, { captureSource: true })
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
}

function openIdolEvent(event) {
  return openEventDetail(event, 'idol_detail')
}

function captureDetailSource() {
  detailSourceRoute.value = buildArchiveSourceQuery(currentArchiveRoute())
}

async function restoreDetailSource(fallback) {
  const source = detailSourceRoute.value
  detailSourceRoute.value = ''
  if (!source) {
    fallback()
    return
  }
  let route = readArchiveSourceRoute(source)
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
  if (route.view === 'story_collection' && route.storyType && route.storySection) collectionReadModelDetail.value = await loadCollectionDetail(route.storyType, route.storySection)
  if (route.view === 'story_detail' && route.story) storyReadModelDetail.value = await loadStoryReadModelDetail(route.story)
  if (route.view === 'song_catalog') await ensureSongCatalog()
  if (route.view === 'song_detail' && route.song) songReadModelDetail.value = await loadSongDetail(route.song)
  if (navigation.isDisposed() || beforeLoad !== navigation.getRevision()) return
  const pending = applyArchiveRoute(route, { restoring: false })
  const revision = navigation.getRevision()
  return pending.then(() => {
    if (navigation.getRevision() === revision) syncArchiveRoute()
  })
}

function openCard(card, { resetContext = false, captureSource = false, clearEventContext = false } = {}) {
  if (!card?.resource_id) return
  const id = card.resource_id
  const request = ++pendingCardNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  cardReadModelStatus.value = '正在读取卡片详情…'
  loading.value = true
  return prepareArchivePage('card_detail', loadCardDetail(id)).then(detail => {
    if (request !== pendingCardNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    cardReadModelDetail.value = detail
    cardReadModelStatus.value = ''
    if (captureSource || view.value !== 'card_detail') captureDetailSource()
    if (clearEventContext) { currentEventId.value = ''; eventParentView.value = '' }
    if (resetContext) {
      currentCategoryId.value = 'cards'
      currentCharacterId.value = card.character_id
      filterQuery.value = ''
    }
    currentCardId.value = id
    commitView('card_detail')
  }).catch(error => {
    if (request !== pendingCardNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[CardReadModel] Failed to load detail:', error)
    cardReadModelStatus.value = '卡片详情暂时无法读取，请重试。'
  })
}

function openCardIdol(idolCode) {
  if (!archiveBootstrap.idols.some(idol => idol.id === idolCode) || currentCard.value?.character_id !== idolCode) return
  return openIdolReadModel(idolCode, { captureSource: true, resetContext: true })
}

function openGasha(gasha) {
  if (!gasha?.id) return
  const id = String(gasha.id)
  const request = ++pendingGashaNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  gashaReadModelStatus.value = '正在读取卡池详情…'
  loading.value = true
  return prepareArchivePage('gasha_detail', loadGashaDetail(id)).then(detail => {
    if (request !== pendingGashaNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    gashaReadModelDetail.value = detail
    gashaReadModelStatus.value = ''
    captureDetailSource()
    gashaParentView.value = view.value === 'story_collection' && currentStoryDomain.value === 'extra'
      ? 'story_collection' : ''
    const preserveCatalogQuery = view.value === 'gashas'
    currentCategoryId.value = ''
    currentCharacterId.value = ''
    currentCardId.value = ''
    currentGashaId.value = id
    if (!preserveCatalogQuery) filterQuery.value = ''
    commitView('gasha_detail')
  }).catch(error => {
    if (request !== pendingGashaNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[GashaReadModel] Failed to load detail:', error)
    gashaReadModelStatus.value = '卡池详情暂时无法读取，请重试。'
  })
}

function goBackFromGasha() {
  const returnsToCollection = gashaParentView.value === 'story_collection' && currentStoryCollection.value
  currentGashaId.value = ''
  gashaParentView.value = ''
  commitView(returnsToCollection ? 'story_collection' : 'gashas')
}

function openCardGasha(relation) {
  if (!relation?.announcement_id) return
  openGasha({ id: String(relation.announcement_id) })
}

async function openGashaCard(relation) {
  if (!cardReadModelCatalog.value) await loadCardCatalog()
  const card = cardReadModelCatalog.value?.find(row => row.resource_id === relation?.card_resource_id)
  if (!card) return
  return openCard(card, { resetContext: true })
}

function openRelatedCard(card) {
  if (!card?.resource_id || !card?.character_id) return
  return openCard(card, { resetContext: true, captureSource: true })
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
    return loadScenario(entry.compiled_file, 'card_detail')
  }
}

async function previewCardVoice(cue) {
  const card = currentCard.value
  if (!card || !cue) return
  await openVoicePreview(card, cue, 'card_detail')
}

function openCardEvent(event) {
  return openEventDetail(event, 'card_detail')
}

function openHomeEvent(event) {
  return openEventDetail(event, 'home')
}

function openEventDetail(event, parentView = 'story_catalog') {
  if (!event?.event_id) return
  const id = String(event.event_id)
  const request = ++pendingEventNavigation
  navigation.invalidate()
  const revision = navigation.getRevision()
  eventReadModelStatus.value = '正在读取活动详情…'
  loading.value = true
  return prepareArchivePage('event_detail', loadEventDetail(id)).then(detail => {
    if (request !== pendingEventNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
    eventReadModelDetail.value = detail
    eventReadModelStatus.value = ''
    captureDetailSource()
    currentEventId.value = id
    eventParentView.value = parentView
    commitView('event_detail')
  }).catch(error => {
    if (request !== pendingEventNavigation || revision !== navigation.getRevision()) return
    loading.value = false
    console.error('[EventReadModel] Failed to load detail:', error)
    eventReadModelStatus.value = '活动详情暂时无法读取，请重试。'
  })
}

function goBackFromEvent() {
  const parent = eventParentView.value
  if (detailSourceRoute.value) {
    currentEventId.value = ''
    eventParentView.value = ''
    return restoreDetailSource(openStoryCatalog)
  }
  currentEventId.value = ''
  eventParentView.value = ''
  if (parent === 'home') commitView('home')
  else if (parent === 'external_story_resources') commitView('external_story_resources')
  else if (parent === 'card_detail' && currentCard.value) commitView('card_detail')
  else if (parent === 'unit_detail' && currentArchiveUnit.value) commitView('unit_detail')
  else if (parent === 'idol_detail' && archiveBootstrap.idols.some(idol => idol.id === currentCharacterId.value)) commitView('idol_detail')
  else return openStoryCatalog()
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
  return playbackController.startQueue(episodes, index, returnView)
}

function playbackEpisodes(returnView) {
  if (returnView === 'story_collection') return (currentStoryCollection.value?.chapters || []).flatMap(chapter => chapter.episodes || [])
  if (returnView === 'event_detail') return currentEventEpisodes.value
  if (returnView === 'idol_story_archive') return (currentIdolStoryPage.value?.sections || []).flatMap(section => section.episodes || [])
  return []
}

function playNextEpisode() { return playbackController.next() }

async function openEventCard(relation) {
  const revision = navigation.getRevision()
  const eventId = currentEventId.value
  try {
    if (!cardReadModelCatalog.value) await loadCardCatalog()
  } catch (error) {
    if (revision === navigation.getRevision() && currentEventId.value === eventId) {
      console.error('[EventReadModel] Failed to load linked cards:', error)
      eventReadModelStatus.value = '关联卡片暂时无法读取，请重试。'
    }
    return
  }
  if (revision !== navigation.getRevision() || view.value !== 'event_detail' || currentEventId.value !== eventId) return
  const card = cardReadModelCatalog.value?.find(row => row.resource_id === relation?.card_resource_id)
  if (!card) return
  return openCard(card, { resetContext: true, captureSource: true, clearEventContext: true })
}

function openEventIdol(idol) {
  return openIdolReadModel(idol.idol_code, { captureSource: true, resetContext: true, clearUnit: true, clearEventContext: true })
}

function openEventUnit(unit) {
  return openArchiveUnit(unit, { clearEventContext: true })
}

async function openVoicePreview(card, cue, returnView) {
  const scenario = buildCardVoicePreviewScenario(card, cue)
  if (!scenario) return false
  loadingPurpose.value = 'story-playback'
  return playbackController.preview(() => scenario,
    typeof cue === 'string' ? cue : cue.cue, returnView)
}

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

async function restorePlaybackDestination(destination, route) {
  if (destination === 'reader') return returnToReader()
  if (!route) return commitView(destination)
  return restoreRoute(route, { restoring: false })
}

async function loadPlayerQueue(route, request) {
  return withLoadDeadline(async signal => {
    const options = { signal, priority: 'background' }
    if (route.view === 'story_collection' && route.storyType && route.storySection) {
      const detail = await loadCollectionDetail(route.storyType, route.storySection, options)
      return selectPlayerQueue(detail.view.collection.chapters, request.file, request)
    }
    if (route.view === 'event_detail' && route.event) {
      const detail = await loadEventDetail(String(route.event), options)
      return (detail.view.episodes || []).filter(episode => episode.exists !== false && episode.file)
    }
    if (route.view === 'idol_story_archive' && route.idol) {
      const detail = await loadIdolStoryDetail(route.idol, options)
      return selectPlayerQueue(detail.view.page.sections, request.file, request)
    }
    return []
  }, { signal: request.signal, timeoutMs: 15000, label: 'episode-queue' })
}

function closePlayer() { return playbackController.close() }
function onPlayerReady() { playbackController.ready() }

async function loadScenario(name, returnView = 'files', options = {}) {
  loadingPurpose.value = 'story-playback'
  return playbackController.load(name, returnView, options)
}

async function loadHomeIndex() {
  if (homeReadModelIndex.value) return homeReadModelIndex.value
  if (!homeIndexPromise) {
    homeIndexPromise = readModelClient.load(archiveBootstrap.domains.home, { validate: data => {
      const expected = archiveBootstrap.idols.filter(idol => idol.home_available).map(idol => idol.id)
      if (!Array.isArray(data.idols) || data.idols.length !== expected.length ||
        data.idols.some((idol, index) => idol.id !== expected[index]) ||
        !Array.isArray(data.stats) || !Array.isArray(data.highlights))
        throw new Error('Home index does not match inline bootstrap')
    } }).then(index => { homeReadModelIndex.value = index; return index })
      .catch(error => { homeIndexPromise = null; throw error })
  }
  return homeIndexPromise
}

async function loadHomeIdol(idolId) {
  if (homeReadModelProfiles.value[idolId]) {
    const previous = recentHomeProfiles.indexOf(idolId)
    if (previous >= 0) recentHomeProfiles.splice(previous, 1)
    recentHomeProfiles.push(idolId)
    return homeReadModelProfiles.value[idolId]
  }
  if (homeProfilePromises.has(idolId)) return homeProfilePromises.get(idolId)
  const pending = (async () => {
    const index = await loadHomeIndex()
    const row = index.idols.find(idol => idol.id === idolId)
    if (!row) throw new Error(`Unavailable Home idol: ${idolId}`)
    const detail = await readModelClient.load(row.detail, { validate: data => {
      if (data.id !== idolId || data.profile?.id !== idolId || !Array.isArray(data.cueIndex))
        throw new Error('Home detail identity mismatch')
    } })
    const pageDescriptors = [...new Map(detail.cueIndex.map(cue => [cue.page.url, cue.page])).values()]
    const pages = await Promise.all(pageDescriptors.map(descriptor => readModelClient.load(descriptor)))
    const profile = hydrateHomeProfile(detail, pageDescriptors, pages)
    recentHomeProfiles.push(idolId)
    const profiles = { ...homeReadModelProfiles.value, [idolId]: profile }
    while (recentHomeProfiles.length > 3) delete profiles[recentHomeProfiles.shift()]
    homeReadModelProfiles.value = profiles
    return profile
  })().finally(() => homeProfilePromises.delete(idolId))
  homeProfilePromises.set(idolId, pending)
  return pending
}

async function loadIdolCatalog() {
  if (idolReadModelCatalog.value) return idolReadModelCatalog.value
  if (!idolCatalogPromise) {
    idolCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.idols)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || rows.length !== archiveBootstrap.idols.length ||
        rows.some((row, position) => row.id !== archiveBootstrap.idols[position].id ||
          row.name !== archiveBootstrap.idols[position].name || !row.detail))
        throw new Error('Idol catalog does not match inline bootstrap')
      idolReadModelCatalog.value = Object.fromEntries(rows.map(row => [row.id, row]))
      return idolReadModelCatalog.value
    })().catch(error => { idolCatalogPromise = null; throw error })
  }
  return idolCatalogPromise
}

async function loadIdolDetail(idolCode) {
  const row = (await loadIdolCatalog())[idolCode]
  if (!row) throw new Error(`Unavailable idol: ${idolCode}`)
  return readModelClient.load(row.detail, { expectedId: idolCode, validate: data => {
    if (data.view?.profile?.idol_code !== idolCode || !data.view?.stats ||
      !Array.isArray(data.view?.events) || !Array.isArray(data.view?.songs))
      throw new Error('Idol detail identity or shape mismatch')
  } })
}

async function loadUnitCatalog() {
  if (unitReadModelCatalog.value) return unitReadModelCatalog.value
  if (!unitCatalogPromise) {
    unitCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.units)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      const expected = [...new Set(archiveBootstrap.idols.map(idol => idol.unitId))]
      if (rows.length !== index.count || rows.length !== expected.length ||
        rows.some((row, position) => row.id !== expected[position] ||
          String(row.catalog?.unit?.unit_id) !== row.id || !row.catalog?.members ||
          !row.catalog?.cardStats || !row.detail))
        throw new Error('Unit catalog does not match inline bootstrap')
      unitReadModelCatalog.value = rows
      return rows
    })().catch(error => { unitCatalogPromise = null; throw error })
  }
  return unitCatalogPromise
}

async function loadUnitDetail(unitCode) {
  const rows = await loadUnitCatalog()
  const row = rows.find(entry => entry.id === unitCode || entry.catalog.unit.unit_code === unitCode)
  if (!row) throw new Error(`Unavailable unit: ${unitCode}`)
  return readModelClient.load(row.detail, { expectedId: row.id, validate: data => {
    if (String(data.view?.entry?.unit?.unit_id) !== row.id ||
      !Array.isArray(data.view?.entry?.members) || !data.view?.entry?.cardStats ||
      !Array.isArray(data.view?.stories) || !Array.isArray(data.view?.songs))
      throw new Error('Unit detail identity or shape mismatch')
  } })
}

async function loadGashaCatalog() {
  if (gashaReadModelCatalog.value) return gashaReadModelCatalog.value
  if (!gashaCatalogPromise) {
    gashaCatalogPromise = (async () => {
      const [functions, index] = await Promise.all([
        import('./data/gashaCatalog.js'),
        readModelClient.load(archiveBootstrap.domains.gashas),
      ])
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || rows.length !== archiveBootstrap.counts.primary_gashas ||
        new Set(rows.map(row => String(row.id))).size !== rows.length ||
        rows.some(row => row.phase !== 'primary' || !row.detail))
        throw new Error('Gasha catalog count or identity mismatch')
      const catalog = { rows, summary: index.summary || {} }
      gashaCatalogFunctions.value = functions
      gashaReadModelCatalog.value = catalog
      return catalog
    })().catch(error => { gashaCatalogPromise = null; throw error })
  }
  return gashaCatalogPromise
}

async function loadGashaDetail(id) {
  const row = (await loadGashaCatalog()).rows.find(entry => String(entry.id) === id)
  if (!row) throw new Error(`Unavailable gasha: ${id}`)
  return readModelClient.load(row.detail, { expectedId: id, validate: data => {
    if (String(data.gasha?.id) !== id || !Array.isArray(data.gasha?.derived_pickup_cards))
      throw new Error('Gasha detail identity or shape mismatch')
  } })
}

async function loadCardCatalog() {
  if (cardReadModelCatalog.value) return cardReadModelCatalog.value
  if (!cardCatalogPromise) {
    cardCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.cards)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || rows.length !== archiveBootstrap.counts.canonical_cards ||
        new Set(rows.map(row => row.resource_id)).size !== rows.length ||
        rows.some(row => row.id !== row.resource_id || !row.detail || !row.ownerReference ||
          !Number.isInteger(row.home_voice_count) || !Number.isInteger(row.scenario_count)))
        throw new Error('Card catalog count or identity mismatch')
      cardReadModelCatalog.value = rows
      return rows
    })().catch(error => { cardCatalogPromise = null; throw error })
  }
  return cardCatalogPromise
}

async function loadCardDetail(id) {
  const row = (await loadCardCatalog()).find(card => card.resource_id === id)
  if (!row) throw new Error(`Unavailable card: ${id}`)
  return readModelClient.load(row.detail, { expectedId: id, validate: data => {
    if (data.card?.resource_id !== id || !data.ownerReference ||
      !Array.isArray(data.card?.home_voice_cues) || !Array.isArray(data.card?.scenario_entries))
      throw new Error('Card detail identity or shape mismatch')
  } })
}

async function loadEventCatalog() {
  if (eventReadModelCatalog.value) return eventReadModelCatalog.value
  if (!eventCatalogPromise) {
    eventCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.events)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || new Set(rows.map(row => String(row.id))).size !== rows.length ||
        rows.some(row => !row.detail || String(row.event_id) !== String(row.id)))
        throw new Error('Event catalog count or identity mismatch')
      eventReadModelCatalog.value = rows
      return rows
    })().catch(error => { eventCatalogPromise = null; throw error })
  }
  return eventCatalogPromise
}

async function loadEventDetail(id, options = {}) {
  const row = (await loadEventCatalog()).find(entry => String(entry.id) === id)
  if (!row) throw new Error(`Unavailable event: ${id}`)
  return readModelClient.load(row.detail, { ...options, expectedId: id, validate: data => {
    if (String(data.view?.event?.event_id) !== id || !Array.isArray(data.view?.episodes) ||
      !Array.isArray(data.view?.cards) || !Array.isArray(data.view?.idols) ||
      !Array.isArray(data.view?.units) || !Array.isArray(data.view?.castReferences) ||
      !Array.isArray(data.view?.readingEntries) ||
      data.view.castReferences.length !== data.view.idols.length ||
      data.view.castReferences.some((entry, index) => entry.idol_code !== data.view.idols[index].idol_code ||
        entry.reference?.idolCode !== entry.idol_code))
      throw new Error('Event detail identity or shape mismatch')
  } })
}

async function loadSeasonalCatalog() {
  if (seasonalReadModelCatalog.value) return seasonalReadModelCatalog.value
  if (!seasonalCatalogPromise) {
    seasonalCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.seasonal)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || new Set(rows.map(row => row.id)).size !== rows.length ||
        rows.some(row => !row.detail || !row.name || !Number.isInteger(row.year) ||
          !['valentine', 'white_day'].includes(row.season)))
        throw new Error('Seasonal catalog count or switch fields mismatch')
      seasonalReadModelCatalog.value = rows
      return rows
    })().catch(error => { seasonalCatalogPromise = null; throw error })
  }
  return seasonalCatalogPromise
}

async function loadSeasonalDetail(requestedId = 'valentine_2023') {
  const rows = await loadSeasonalCatalog()
  const row = rows.find(entry => entry.id === requestedId) ||
    rows.find(entry => entry.id === 'valentine_2023') || rows[0]
  if (!row) throw new Error('No seasonal campaigns available')
  return readModelClient.load(row.detail, { expectedId: row.id, validate: data => {
    if (data.view?.campaign?.id !== row.id || data.view.campaign.year !== row.year ||
      data.view.campaign.season !== row.season || !Array.isArray(data.view.campaign.participants))
      throw new Error('Seasonal campaign identity or shape mismatch')
  } })
}

async function loadWorkCatalog() {
  if (workReadModelCatalog.value) return workReadModelCatalog.value
  if (!workCatalogPromise) {
    workCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.work)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      const expected = archiveBootstrap.idols.map(idol => idol.id)
      if (rows.length !== index.count || rows.length !== expected.length ||
        rows.some((row, position) => row.id !== expected[position] || row.idol_code !== row.id ||
          !row.display_name || !row.work_type_name || !row.detail))
        throw new Error('Work catalog identity or switch fields mismatch')
      workReadModelCatalog.value = rows
      return rows
    })().catch(error => { workCatalogPromise = null; throw error })
  }
  return workCatalogPromise
}

async function loadWorkDetail(id) {
  const row = (await loadWorkCatalog()).find(entry => entry.id === id)
  if (!row) throw new Error(`Unavailable work idol: ${id}`)
  return readModelClient.load(row.detail, { expectedId: id, validate: data => {
    if (data.view?.idol?.idol_code !== id || !Array.isArray(data.view.idol.short_stories) ||
      !Array.isArray(data.view.idol.scene_lines) || !Array.isArray(data.view?.sourceEvidence?.entries) ||
      !Array.isArray(data.view?.readingEntries))
      throw new Error('Work detail identity or shape mismatch')
  } })
}

async function loadIdolStoryCatalog() {
  if (idolStoryReadModelCatalog.value) return idolStoryReadModelCatalog.value
  if (!idolStoryCatalogPromise) {
    idolStoryCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains['idol-stories'])
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      const expected = archiveBootstrap.idols.map(idol => idol.id)
      if (rows.length !== index.count || rows.length !== expected.length ||
        rows.some((row, position) => row.id !== expected[position] || row.idolCode !== row.id ||
          !row.idolName || !Number.isInteger(row.sectionCount) || !Number.isInteger(row.episodeCount) || !row.detail))
        throw new Error('Idol story catalog identity or switch fields mismatch')
      idolStoryReadModelCatalog.value = rows
      return rows
    })().catch(error => { idolStoryCatalogPromise = null; throw error })
  }
  return idolStoryCatalogPromise
}

async function loadIdolStoryDetail(id, options = {}) {
  const row = (await loadIdolStoryCatalog()).find(entry => entry.id === id)
  if (!row) throw new Error(`Unavailable idol story: ${id}`)
  return readModelClient.load(row.detail, { ...options, expectedId: id, validate: data => {
    if (data.view?.page?.idol_code !== id || !Array.isArray(data.view.page.sections) ||
      !Array.isArray(data.view?.readingEntries))
      throw new Error('Idol story detail identity or shape mismatch')
  } })
}

async function loadMobileCatalog(domain) {
  const idol = domain === 'mobile-idols'
  const current = idol ? mobileIdolReadModelCatalog : mobileUnitReadModelCatalog
  if (current.value) return current.value
  const pending = idol ? mobileIdolCatalogPromise : mobileUnitCatalogPromise
  if (pending) return pending
  const promise = (async () => {
    const index = await readModelClient.load(archiveBootstrap.domains[domain])
    const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
    const rows = pages.flatMap(page => page.rows || [])
    if (rows.length !== index.count || rows.some(row => !row.id || !row.detail ||
      (idol ? !row.idolCode || !row.name : !row.unitCode || !row.name)))
      throw new Error(`${domain} catalog identity or shape mismatch`)
    if (idol && (rows.length !== archiveBootstrap.idols.length ||
      rows.some(row => !archiveBootstrap.idols.some(entry => entry.id === row.id))))
      throw new Error('Mobile idol catalog differs from bootstrap identity')
    current.value = rows
    return rows
  })().catch(error => {
    if (idol) mobileIdolCatalogPromise = null
    else mobileUnitCatalogPromise = null
    throw error
  })
  if (idol) mobileIdolCatalogPromise = promise
  else mobileUnitCatalogPromise = promise
  return promise
}

async function loadMobileDetail(domain, id) {
  const row = (await loadMobileCatalog(domain)).find(entry => entry.id === id)
  if (!row) throw new Error(`Unavailable ${domain} entry: ${id}`)
  return readModelClient.load(row.detail, { expectedId: id, validate: data => {
    if (domain === 'mobile-idols' ?
      !Array.isArray(data.view?.personalBundles) || !Array.isArray(data.view?.phoneBundles) || !Array.isArray(data.view?.randomBundles) :
      !Array.isArray(data.view?.unitBundles))
      throw new Error(`${domain} detail identity or shape mismatch`)
  } })
}

async function loadMobileRoute(idolCode, mode, requestedUnit = '') {
  const [idol, units] = await Promise.all([
    loadMobileDetail('mobile-idols', idolCode), loadMobileCatalog('mobile-units'),
  ])
  const unitCode = resolveMobileArchiveUnit({ idolCode, mode, requestedUnit,
    manifest: bootstrapMembership, units: units.map(unit => ({ unit_code: unit.id })),
    archive: { by_unit_code: Object.fromEntries(units.map(unit => [unit.id, true])) },
  })
  const unit = unitCode ? await loadMobileDetail('mobile-units', unitCode) : null
  return { idol, unit, unitCode }
}

async function loadLegacyAliasDetail(domain, id) {
  const descriptor = await entityDescriptor(archiveBootstrap, domain, id, `${domain}.detail`)
  return readModelClient.load(descriptor, { expectedId: id, validate: data => {
    const view = data.view
    if (domain === 'legacy-groups' && (!view?.title || !Array.isArray(view.groups)) ||
      domain === 'legacy-files' && (!view?.group || !Array.isArray(view.entries) || !view.sourceRoute) ||
      domain === 'legacy-episodes' && (!view?.unit || !Array.isArray(view.unit.episodes)) ||
      domain === 'legacy-zero' && !Array.isArray(view?.units))
      throw new Error(`${domain} alias shape mismatch`)
  } })
}

async function loadLegacyAliasRoute(route) {
  const owner = route.view === 'player' ? route.returnView : route.view
  if (owner === 'episode_zero_units') return { zero: await loadLegacyAliasDetail('legacy-zero', 'episode_zero') }
  if (owner === 'episodes') return { episode: await loadLegacyAliasDetail('legacy-episodes', route.unit) }
  if (owner === 'groups') {
    const id = route.idol ? `${route.category}:${route.idol}` : route.category
    return { groups: await loadLegacyAliasDetail('legacy-groups', id) }
  }
  if (owner !== 'files' || !route.group) return null
  const id = route.idol ? `${route.category}:${route.idol}` : route.category
  const [files, parent] = await Promise.all([
    loadLegacyAliasDetail('legacy-files', route.group),
    loadLegacyAliasDetail(route.category === 'episode_zero' ? 'legacy-episodes' : 'legacy-groups',
      route.category === 'episode_zero' ? route.unit : id),
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

async function loadCollectionCatalog() {
  if (collectionReadModelCatalog.value) return collectionReadModelCatalog.value
  if (!collectionCatalogPromise) {
    collectionCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.collections)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || new Set(rows.map(row => row.id)).size !== rows.length ||
        rows.some(row => row.id !== `${row.domain}:${row.sectionId}` || !row.title || !row.detail))
        throw new Error('Collection catalog identity or shape mismatch')
      collectionReadModelCatalog.value = rows
      return rows
    })().catch(error => { collectionCatalogPromise = null; throw error })
  }
  return collectionCatalogPromise
}

async function loadCollectionDetail(domain, section, options = {}) {
  const row = (await loadCollectionCatalog()).find(entry => entry.domain === domain &&
    (entry.sectionId === String(section) || entry.legacySectionIds?.includes(String(section))))
  if (!row) throw new Error(`Unavailable story collection: ${domain}:${section}`)
  return readModelClient.load(row.detail, { ...options, expectedId: row.id, validate: data => {
    const collection = data.view?.collection
    if (collection?.domain !== row.domain || collection.sectionId !== row.sectionId ||
      !Array.isArray(collection.chapters) || !Array.isArray(data.view?.readingEntries))
      throw new Error('Collection detail identity or shape mismatch')
  } })
}

async function loadStoryReadModelCatalog() {
  if (storyReadModelCatalog.value) return storyReadModelCatalog.value
  if (!storyCatalogPromise) {
    storyCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.stories)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || rows.length !== archiveBootstrap.counts.catalog_story_entries ||
        new Set(rows.map(row => row.file)).size !== rows.length ||
        rows.some(row => row.id !== row.file || !row.title || !row.detail))
        throw new Error('Story directory identity or count mismatch')
      storyCatalogIndex.value = index
      storyReadModelCatalog.value = rows
      return rows
    })().catch(error => { storyCatalogPromise = null; throw error })
  }
  return storyCatalogPromise
}

async function loadStoryReadModelLanding() {
  if (storyCatalogLanding.value) return storyCatalogLanding.value
  await loadStoryReadModelCatalog()
  if (!storyLandingPromise) {
    storyLandingPromise = (async () => {
      const descriptors = storyCatalogIndex.value?.landing
      if (!descriptors?.main || !descriptors?.extra || !descriptors?.birthday)
        throw new Error('Story catalog landing descriptors missing')
      const [main, extra, birthday] = await Promise.all(['main', 'extra', 'birthday'].map(key =>
        readModelClient.load(descriptors[key])))
      if (!main?.value?.collections || !extra?.value?.collections || !birthday?.value?.collections)
        throw new Error('Story catalog landing shape mismatch')
      storyCatalogLanding.value = { main: main.value, extra: extra.value, birthday: birthday.value }
      return storyCatalogLanding.value
    })().catch(error => { storyLandingPromise = null; throw error })
  }
  return storyLandingPromise
}

async function loadStoryReadModelDetail(file) {
  const row = (await loadStoryReadModelCatalog()).find(entry => entry.file === file)
  if (!row) throw new Error(`Unavailable story: ${file}`)
  return readModelClient.load(row.detail, { expectedId: row.id, validate: data => {
    if (data.story?.file !== file || !Array.isArray(data.view?.related) ||
      !Array.isArray(data.view?.castReferences) || typeof data.view.promotedVisualUrl !== 'string' ||
      !Array.isArray(data.view?.readingEntries))
      throw new Error('Story detail identity or shape mismatch')
  } })
}

async function loadResourceStatus() {
  if (!resourceDetailPromise) {
    resourceDetailPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.resources)
      if (index.count !== 1 || index.pages?.length !== 1) throw new Error('Resource status directory mismatch')
      const page = await readModelClient.load(index.pages[0])
      const row = page.rows?.[0]
      if (row?.id !== 'archive-status' || !row.detail) throw new Error('Resource status identity mismatch')
      return readModelClient.load(row.detail, { expectedId: row.id, validate: data => {
        if (!data.view?.manifest?.coverage || !data.view?.verification?.scenarios ||
          !data.view?.uiAssets?.meta) throw new Error('Resource status shape mismatch')
      } })
    })().catch(error => { resourceDetailPromise = null; throw error })
  }
  return resourceDetailPromise
}

async function loadSongCatalog() {
  if (songReadModelCatalog.value) return songReadModelCatalog.value
  if (!songCatalogPromise) {
    songCatalogPromise = (async () => {
      const index = await readModelClient.load(archiveBootstrap.domains.songs)
      const pages = await Promise.all(index.pages.map(descriptor => readModelClient.load(descriptor)))
      const rows = pages.flatMap(page => page.rows || [])
      if (rows.length !== index.count || new Set(rows.map(row => row.song_code)).size !== rows.length)
        throw new Error('Song catalog page count or identity mismatch')
      const catalog = { songs: Object.fromEntries(rows.map(row => [row.song_code, row])), summary: index.summary }
      songReadModelCatalog.value = catalog
      return catalog
    })().catch(error => { songCatalogPromise = null; throw error })
  }
  return songCatalogPromise
}

async function ensureSongCatalog() {
  if (songReadModelCatalog.value) return true
  songReadModelStatus.value = '正在读取歌曲目录…'
  try {
    await loadSongCatalog()
    songReadModelStatus.value = ''
    return true
  } catch (error) {
    console.error('[SongReadModel] Failed to load catalog:', error)
    songReadModelStatus.value = '歌曲目录暂时无法读取，请重试。'
    return false
  }
}

async function loadSongDetail(songCode) {
  const row = songReadModelCatalog.value?.songs?.[songCode]
  const descriptor = row?.detail || await entityDescriptor(archiveBootstrap, 'songs', songCode, 'songs.detail')
  return readModelClient.load(descriptor, { validate: data => {
    if (data.song?.song_code !== songCode || data.view?.id !== songCode)
      throw new Error('Song detail identity mismatch')
  } })
}

function isBootstrapRoute(route) {
  return (!EXTERNAL_STORY_RESOURCES_ENABLED && route.view === 'external_story_resources') ||
    ['portal', 'welcome', 'idol_picker', 'home', 'reader', 'idol_detail', 'unit_catalog', 'unit_detail', 'song_catalog', 'song_detail', 'gashas', 'gasha_detail', 'cards', 'card_detail', 'event_detail', 'seasonal_campaign', 'work_archive', 'idol_story_archive', 'mobile_archive', 'story_collection', 'story_detail', 'story_catalog', 'archive_status', 'groups', 'files', 'episode_zero_units', 'episodes', 'spine_lab', 'chibi_stage'].includes(route.view) ||
    (route.view === 'player' && route.returnView === 'reader') ||
    (route.view === 'player' && route.returnView === 'mobile_archive') ||
    (route.view === 'player' && ['story_catalog', 'story_collection', 'story_detail'].includes(route.returnView)) ||
    (route.view === 'player' && ['event_detail', 'seasonal_campaign', 'work_archive', 'idol_story_archive'].includes(route.returnView)) ||
    (route.view === 'player' && ['unit_detail', 'card_detail'].includes(route.returnView)) ||
    (route.view === 'player' && ['files', 'episodes', 'episode_zero_units', 'groups'].includes(route.returnView)) ||
    route.view === 'idols'
}

let startupRouteNormalized = false
let restoreRequest = 0
async function restoreRoute(route, { restoring = true } = {}) {
  return navigation.run(async intent => {
    const request = ++restoreRequest
    primeArchiveRouteComponent(route.view)
    ++pendingSongNavigation
    ++pendingHomeNavigation
    ++pendingIdolNavigation
    ++pendingUnitNavigation
    ++pendingGashaNavigation
    ++pendingCardNavigation
    ++pendingEventNavigation
    ++pendingSeasonalNavigation
    ++pendingWorkNavigation
    ++pendingIdolStoryNavigation
    ++pendingMobileNavigation
    ++pendingLegacyAliasNavigation
    ++pendingCollectionNavigation
    ++pendingStoryDetailNavigation
    ++pendingResourceNavigation
    loading.value = true
    loadingPurpose.value = route.view === 'player' ? 'story-playback' : 'archive-data'
    tracePlayer('route-restore', { view: route.view, directPlayer: isDirectScenarioEntry(route) })
    if (!isDirectScenarioEntry(route)) {
      legacyEntryStatus.value = ''
      if (route.view === 'story_collection' && (!route.storyType || !route.storySection) ||
        route.view === 'story_detail' && !route.story) route = { view: 'story_catalog' }
      if (route.view === 'home' && route.homeIdol) {
        try {
          await loadHomeIdol(route.homeIdol)
          if (!intent.isCurrent() || request !== restoreRequest) return
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[HomeReadModel] Failed to restore Home:', error)
          userPreferenceNotice.value = '游戏风首页暂时无法读取，请重新选择偶像。'
          route = { view: 'welcome' }
        }
      }
      if (['groups', 'files', 'episode_zero_units', 'episodes'].includes(route.view) ||
        (route.view === 'player' && ['groups', 'files', 'episode_zero_units', 'episodes'].includes(route.returnView))) {
        try {
          const alias = await loadLegacyAliasRoute(route)
          if (!intent.isCurrent() || request !== restoreRequest) return
          if (intent.isCurrent() && request === restoreRequest) {
            publishLegacyAliasRoute(alias)
            legacyAliasStatus.value = ''
          }
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[LegacyAliasReadModel] Failed to restore route:', error)
          legacyAliasStatus.value = '旧剧情目录暂时无法读取，请重试。'
          route = { view: route.category === 'episode_zero' ? 'episode_zero_units' : 'home' }
        }
      }
      if (route.view === 'mobile_archive' || (route.view === 'player' && route.returnView === 'mobile_archive')) {
        try {
          if (!archiveBootstrap.idols.some(idol => idol.id === route.idol)) throw new Error('Unknown mobile idol')
          const mobile = await loadMobileRoute(route.idol, route.mobileMode || 'personal', route.unit || '')
          if (!intent.isCurrent() || request !== restoreRequest) return
          if (intent.isCurrent() && request === restoreRequest) {
            mobileIdolReadModelDetail.value = mobile.idol
            mobileUnitReadModelDetail.value = mobile.unit
            mobileReadModelStatus.value = ''
          }
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[MobileReadModel] Failed to restore mobile route:', error)
          mobileReadModelStatus.value = 'Mobile 通信暂时无法读取，请重新选择。'
          route = { view: 'idol_picker', pickTarget: 'mobile' }
        }
      }
      if (route.view === 'idol_detail' && route.idol) {
        if (!archiveBootstrap.idols.some(idol => idol.id === route.idol)) {
          route = { view: 'idol_picker', pickTarget: 'profile' }
        } else {
          try {
            const detail = await loadIdolDetail(route.idol)
            if (!intent.isCurrent() || request !== restoreRequest) return
            idolReadModelDetail.value = detail
            idolReadModelStatus.value = ''
          } catch (error) {
            if (!intent.isCurrent() || request !== restoreRequest) return
            console.error('[IdolReadModel] Failed to restore idol detail:', error)
            idolReadModelStatus.value = '偶像档案暂时无法读取，请重新选择。'
            route = { view: 'idols', category: 'idol' }
          }
        }
      }
      if (route.view === 'unit_catalog' || route.view === 'unit_detail' ||
          (route.view === 'player' && route.returnView === 'unit_detail')) {
        try {
          if (route.view === 'unit_catalog') {
            await loadUnitCatalog()
            if (!intent.isCurrent() || request !== restoreRequest) return
          } else {
            const detail = await loadUnitDetail(route.unit)
            if (!intent.isCurrent() || request !== restoreRequest) return
            unitReadModelDetail.value = detail
          }
          unitReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[UnitReadModel] Failed to restore unit route:', error)
          unitReadModelStatus.value = '组合资料暂时无法读取，请稍后重试。'
          route = { view: 'idols', category: 'idol' }
        }
      }
      if (route.view === 'gashas' || route.view === 'gasha_detail') {
        try {
          if (route.view === 'gashas') {
            await loadGashaCatalog()
            if (!intent.isCurrent() || request !== restoreRequest) return
          } else {
            const detail = await loadGashaDetail(route.gasha)
            if (!intent.isCurrent() || request !== restoreRequest) return
            gashaReadModelDetail.value = detail
          }
          gashaReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[GashaReadModel] Failed to restore gasha route:', error)
          gashaReadModelStatus.value = '卡池资料暂时无法读取，请稍后重试。'
          route = { view: 'gashas' }
        }
      }
      if (route.view === 'cards' || route.view === 'card_detail' ||
          (route.view === 'player' && route.returnView === 'card_detail')) {
        try {
          if (route.view === 'cards') {
            await loadCardCatalog()
            if (!intent.isCurrent() || request !== restoreRequest) return
          } else {
            const detail = await loadCardDetail(route.card)
            if (!intent.isCurrent() || request !== restoreRequest) return
            cardReadModelDetail.value = detail
          }
          cardReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[CardReadModel] Failed to restore card route:', error)
          cardReadModelStatus.value = '卡片资料暂时无法读取，请稍后重试。'
          route = { view: 'cards' }
        }
      }
      if ((route.view === 'event_detail' || (route.view === 'player' && route.returnView === 'event_detail')) && route.event) {
        try {
          const detail = await loadEventDetail(String(route.event))
          if (!intent.isCurrent() || request !== restoreRequest) return
          eventReadModelDetail.value = detail
          eventReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[EventReadModel] Failed to restore event route:', error)
          eventReadModelStatus.value = '活动详情暂时无法读取，请稍后重试。'
          route = { view: 'story_catalog' }
        }
      }
      if (route.view === 'seasonal_campaign' || (route.view === 'player' && route.returnView === 'seasonal_campaign')) {
        try {
          const detail = await loadSeasonalDetail(route.storySection)
          if (!intent.isCurrent() || request !== restoreRequest) return
          seasonalReadModelDetail.value = detail
          route = { ...route, storySection: detail.id }
          seasonalReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[SeasonalReadModel] Failed to restore campaign:', error)
          seasonalReadModelStatus.value = '季节企划暂时无法读取，请稍后重试。'
          route = { view: 'portal' }
        }
      }
      if ((route.view === 'work_archive' || (route.view === 'player' && route.returnView === 'work_archive')) && route.idol) {
        try {
          const detail = await loadWorkDetail(route.idol)
          if (!intent.isCurrent() || request !== restoreRequest) return
          workReadModelDetail.value = detail
          workReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[WorkReadModel] Failed to restore idol:', error)
          workReadModelStatus.value = '工作档案暂时无法读取，请稍后重试。'
          route = { view: 'idol_picker', pickTarget: 'work' }
        }
      }
      if ((route.view === 'idol_story_archive' || (route.view === 'player' && route.returnView === 'idol_story_archive')) && route.idol) {
        try {
          const detail = await loadIdolStoryDetail(route.idol)
          if (!intent.isCurrent() || request !== restoreRequest) return
          idolStoryReadModelDetail.value = detail
          idolStoryReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[IdolStoryReadModel] Failed to restore idol:', error)
          idolStoryReadModelStatus.value = '个人故事暂时无法读取，请稍后重试。'
          route = { view: 'idol_picker', pickTarget: 'story' }
        }
      }
      if ((route.view === 'story_collection' || (route.view === 'player' && route.returnView === 'story_collection')) && route.storyType && route.storySection) {
        try {
          const detail = await loadCollectionDetail(route.storyType, route.storySection)
          if (!intent.isCurrent() || request !== restoreRequest) return
          collectionReadModelDetail.value = detail
          collectionReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[CollectionReadModel] Failed to restore collection:', error)
          collectionReadModelStatus.value = '故事章节暂时无法读取，请稍后重试。'
          route = { view: 'story_catalog' }
        }
      }
      if ((route.view === 'story_detail' || (route.view === 'player' && route.returnView === 'story_detail')) && route.story) {
        try {
          const detail = await loadStoryReadModelDetail(route.story)
          if (!intent.isCurrent() || request !== restoreRequest) return
          storyReadModelDetail.value = detail
          storyReadModelStatus.value = ''
          route = { ...route, storyType: detail.story.domain, storySection: detail.story.sectionId || '' }
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[StoryReadModel] Failed to restore detail:', error)
          storyReadModelStatus.value = '故事详情暂时无法读取，请稍后重试。'
          route = { view: 'story_catalog' }
        }
      }
      if (route.view === 'song_catalog') await ensureSongCatalog()
      if (!intent.isCurrent() || request !== restoreRequest) return
      if (['song_detail', 'chibi_stage'].includes(route.view) && (route.song || route.view === 'chibi_stage')) {
        try {
          const detail = await loadSongDetail(route.song || 'drvalv')
          if (!intent.isCurrent() || request !== restoreRequest) return
          songReadModelDetail.value = detail
          songReadModelStatus.value = ''
        } catch (error) {
          if (!intent.isCurrent() || request !== restoreRequest) return
          console.error('[SongReadModel] Failed to restore song detail:', error)
          if (route.view === 'song_detail') {
            await ensureSongCatalog()
            if (!intent.isCurrent() || request !== restoreRequest) return
            songReadModelStatus.value = '歌曲详情暂时无法读取，请重新选择。'
          }
        }
      }
    }
    if (navigation.isDisposed() || !intent.isCurrent() || request !== restoreRequest) return
    const pending = applyArchiveRoute(route, { restoring, intent })
    const expected = navigation.getRevision()
    await pending
    if (navigation.isDisposed() || expected !== navigation.getRevision()) return
    // Failed media preparation must not rewrite a deep link to an empty catalog.
    if (isDirectScenarioEntry(route) && playbackError.value) return
    if (!startupRouteNormalized) {
      loading.value = false
      startupRouteNormalized = true
      writeArchiveRoute(currentArchiveRoute(), { replace: true })
    }
    if (!restoring) writeArchiveRoute(currentArchiveRoute())
    adoptArchiveViewContext()
  }, { restoring: true })
}

onMounted(async () => {
  cardLayout.value = localStorageValue('sidem-archive-card-layout') === 'grid' ? 'grid' : 'compact'
  cardArtMode.value = localStorageValue('sidem-archive-card-art-mode') === 'framed' ? 'framed' : 'clean'
  loadIdolEntityTranslations().catch(error => {
    console.error('[EntityTranslations] Failed to load idols:', error)
  })
  archiveRouteReady = true
  // Listen before restoration: a newer history entry may finish before the
  // initial route's assets. Only its completion may finalize startup.
  removeArchivePopState = onArchivePopState(route => {
    restoreRoute(route).catch(error => {
      console.error('[ArchiveRoute] Failed to restore browser history:', error)
    })
  })
  removeSpineAnimationDebug = installSpineAnimationDebug()
  const startup = pendingPreReadyRoute
    ? { route: pendingPreReadyRoute, source: 'early-action' }
    : initialArchiveStartup
  if (startup.source === 'invalid-immersive-idol') {
    userPreferenceNotice.value = '之前选择的首页偶像当前不可用，请重新选择。'
  }
  if (isBootstrapRoute(startup.route) && !['song_catalog', 'song_detail', 'idol_detail', 'unit_catalog', 'unit_detail', 'seasonal_campaign', 'work_archive', 'idol_story_archive', 'mobile_archive', 'story_collection', 'story_detail', 'story_catalog', 'archive_status', 'groups', 'files', 'episode_zero_units', 'episodes'].includes(startup.route.view) && !(startup.route.view === 'home' && startup.route.homeIdol)) loading.value = false
  await restoreRoute(startup.route)
})

watch([filterQuery, currentSongScope, currentCardRarity, currentCardAssetState, currentCardRelationState, currentGashaCategory, currentIdolUnitFilter, currentStoryDomain, currentStoryMode, currentStorySection, currentEventScope, currentStoryAvailability, currentStorySort, currentMobileMode, currentMobileScenarioId], () => {
  syncArchiveRoute({ replace: true, restoreView: false })
})

watch([homeSelectedId, homeSelectedCue, homeSelectedCostume], () => {
  if (view.value === 'home') syncArchiveRoute({ replace: true, restoreView: false })
})

watch(homeSelectedId, async (idolId, previousId) => {
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
})

watch([filterQuery, currentStoryDomain, currentStorySection, currentEventScope, currentStoryAvailability, currentStorySort], () => {
  storyVisibleLimit.value = 80
})

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

watch([view, currentCharacterId], ([nextView, idolCode]) => {
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
})

watch(cardLayout, layout => {
  setLocalStorageValue('sidem-archive-card-layout', layout)
})

watch(cardArtMode, mode => {
  setLocalStorageValue('sidem-archive-card-art-mode', mode)
})

watch(storyTranslationLocale, locale => {
  loadIdolEntityTranslations(locale).catch(error => {
    console.error('[EntityTranslations] Failed to reload idols:', error)
  })
})

onBeforeUnmount(() => {
  ++pendingHomeNavigation
  readModelClient.dispose()
  playbackController.dispose()
  navigation.dispose()
  removeArchivePopState?.()
  removeSpineAnimationDebug?.()
})
</script>

<style scoped>
#story-viewer {
  width: 100%; height: 100vh; height: 100dvh; color: #222;
  background: #f8f9fa; overflow: hidden;
}
.player-trace-panel { position: fixed; z-index: 130; top: calc(72px + env(safe-area-inset-top, 0px)); right: 8px; max-width: calc(100vw - 16px); padding: 8px 12px; border: 1px solid #9abab7; border-radius: 8px; background: #f7faf9; color: #193c44; font: 13px/1.5 system-ui; }
.player-trace-panel button { min-height: 44px; }
.player-trace-panel pre { max-height: 45dvh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
.song-read-model-status { margin: 12px 24px; padding: 12px 16px; background: #eef8f7; color: #246d67; font-size: .8rem; }
.idol-read-model-status { position: absolute; top: 80px; right: 16px; z-index: 20; padding: 10px 14px; background: #eef8f7; color: #246d67; font-size: .8rem; }
.unit-read-model-status { position: absolute; top: 80px; right: 16px; z-index: 20; padding: 10px 14px; background: #eef8f7; color: #246d67; font-size: .8rem; }
.home-read-model-status { position: absolute; top: 80px; left: 16px; z-index: 20; padding: 10px 14px; background: #eef8f7; color: #246d67; font-size: .8rem; }
.playback-failure { position: fixed; top: 64px; width: min(480px, calc(100vw - 24px)); left: 50%; transform: translateX(-50%); z-index: 120; max-width: calc(100vw - 32px); margin: 0; padding: 12px 18px; border: 1px solid #e4b7b7; border-radius: 8px; background: #fff4f4; color: #7f3434; font: 14px/1.6 system-ui, sans-serif; overflow-wrap: anywhere; max-height: 60vh; overflow: auto; box-sizing: border-box; }
.playback-failure p { margin: 0 0 10px; }
.playback-failure-actions { display: flex; gap: 12px; }
.playback-failure button { white-space: nowrap; flex-shrink: 0; min-height: 44px; padding: 8px 16px; cursor: pointer; }
.preload-notice { position: fixed; top: 64px; left: 12px; z-index: 120; max-width: min(440px, calc(100vw - 24px)); max-height: 35vh; overflow: auto; box-sizing: border-box; padding: 10px 14px; border: 1px solid #d6b86b; border-radius: 8px; background: #fff8e6; color: #654d18; font: 14px/1.6 system-ui, sans-serif; overflow-wrap: anywhere; }
.preload-notice summary { cursor: pointer; min-height: 24px; }
.preload-notice p { margin: 8px 0; }
.preload-notice ul { margin: 0; padding-left: 20px; }
</style>

<style>
/* Global reset: no page-level scrollbar */
html, body { margin: 0; padding: 0; height: 100%; overflow-x: hidden; overflow-y: hidden; }
*, *::before, *::after { box-sizing: border-box; }
#app { overflow-x: hidden; }
/* Non-archive source pages keep the existing non-blocking feedback semantics. */
.archive-route-pending-fallback {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 1000; max-width: calc(100% - 32px); pointer-events: none;
  animation: gs-route-feedback-in 120ms ease-out 140ms both;
}
@keyframes gs-route-feedback-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .archive-route-pending-fallback { animation: none; }
}
</style>
