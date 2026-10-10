<template>
  <div id="story-viewer">

    <StoryReleaseSoakPanel v-if="RUNTIME_DEBUG" />

    <ArchiveShell
      v-if="archiveShellVisible"
      :model-value="filterQuery"
      @update:model-value="updateArchiveFilter('filterQuery', $event)"
      :active-section="archiveSection"
      compact-mobile
      :immersive-tool="view === 'song_detail'"
      :home-focus="view === 'home' && homeFocus"
      :title="archiveTitle"
      :searchable="archiveSearchable"
      :search-placeholder="archiveSearchPlaceholder"
      :show-back="archiveShowBack"
      :breadcrumbs="archiveBreadcrumbs"
      @navigate="navigateArchiveSection"
      @back="goArchiveBack"
    >
      <template #sidebar-identity>
        <ArchiveStageIdolSwitch
          :idol="preferredArchiveIdol"
          :name="preferredArchiveIdol ? idolDisplayName(preferredArchiveIdol.id) || preferredArchiveIdol.name : ''"
          :stage-light="Boolean(stageLightIdol)"
          :idols="archivePickerIdols"
          :idol-name="idolDisplayName"
          :idol-search="idolEntitySearchText"
          @save-preferred="savePreferredIdol"
          @save-startup="storeUserPreferences"
        />
      </template>
      <ArchiveStoryReader v-if="view === 'reader'" :state="readingState" :chapter="chapterReadingState" :chapter-navigation="readingChapterNavigation" @chapter="selectReaderChapter" :document-id="readingDocumentId" :mode="readingMode" :anchor="readingRowId" :idol-directory="archiveBootstrap.idols"
        :related-event="currentEventId" @open-event="openEventDetail({event_id:currentEventId},'reader')"
        :notice="readingPlaybackNotice" :busy="loading" @refresh="refreshStoryReader" @play-document="openReaderPlayback(readingRowId, { fullDocument: true })" @select="selectReaderDocument" @retry-segment="chapterReadingSession.retry" @play-segment="playChapterReadingSegment" @locate-segment="locateChapterReadingRow" @mode="updateReadingMode" @locate="locateReadingRow" @back="closeStoryReader" @retry="openStoryReader(readingDocumentId)" />
      <ArchivePortalLauncher
        v-if="view === 'portal'"
        :preferred-reference="preferredArchiveIdolReference"
        :idol-name="idolDisplayName"
        :idol-search="idolEntitySearchText"
        :idols="archivePickerIdols"
        :preference-notice="userPreferenceNotice"
        :view-reference="portalViewReference"
        @select-scope="portalData.selectScope"
        :desktop-overview="portalData.overview.value"
        :global-search="portalData.search.value"
        @search="portalData.updateSearch"
        @open-result="openPortalResult"
        @open-directory="openPortalDirectory"
        @open-stage="openPortalStage"
        @retry-overview="portalData.refresh"
        @expand-cards="portalData.expandCardPool"
        @save-preferred="savePreferredIdol"
        :loading-section="gashaReadModelStatus || homeEntryStatus || legacyEntryStatus"
        :retry-section="gashaReadModelStatus && !loading ? 'gashas' : ''"
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
        :idol-name="idolDisplayName"
        :idol-search="idolEntitySearchText"
        :preferences="userPreferences"
        :preferred-idols="archivePickerIdols"
        :notice="userPreferenceNotice"
        :data-ready="archiveBootstrap.idols.length > 0"
        :selection-only="view === 'home' || view === 'idol_picker'"
        :can-cancel="view === 'idol_picker' || view === 'welcome'"
        :target-label="idolPickerLabel"
        @cancel="cancelWelcomeOrPicker"
        @choose-idol="chooseImmersiveIdol"
        @save-preferred="savePreferredIdol"
        @save-startup="storeUserPreferences"
        @settings-applied="userPreferences = loadArchiveUserPreferences().preferences"
      />
      <ArchiveImmersiveHome
        v-if="view === 'home' && homeSelectedId"
        :selected-id="homeSelectedId"
        @update:selected-id="selectHomeIdol"
        v-model:selected-cue="homeSelectedCue"
        v-model:selected-costume="homeSelectedCostume"
        :no-audio="NO_AUDIO"
        :idols="archiveHomeIdols"
        :idol-name="idolDisplayName"
        :home-mode="userPreferences.homeMode === 'card' ? 'card' : 'spine'"
        @update:home-mode="storeUserPreferences({ homeMode: $event })"
        @focus-change="homeFocus = $event"
        :can-return-to-archive="Boolean(homeFrom)"
        @open-archive="openArchivePortal(homeSelectedId)"
        @settings="openWelcomeSettings"
        @return-to-archive="closeHomeVisit"
        :stats="archiveStats"
        @open-story="navigateArchiveSection('stories')"
        @open-cards="openHomeCards"
        @open-idol="openHomeIdol"
        @open-chat="openHomeChat"
        @open-card="openHomeCard"
      />

      <ArchiveAbout v-if="view === 'about'" />
      <ArchiveExperiments v-if="view === 'experiments'" @charts="openChartTool" @photo="openPictureStudio()" @stage="openChibiStage()" />
      <ArchiveIdolGrid
        v-if="view === 'idols'"
        embedded
        :model-value="filterQuery"
        @update:model-value="updateArchiveFilter('filterQuery', $event)"
        :title="categoryHeaderText"
        :filter-placeholder="categoryFilterPlaceholder"
        :idols="filteredIdols"
        :idol-name="idolDisplayName"
        :unit-options="idolUnitOptions"
        :current-unit="currentIdolUnitFilter"
        :idols-before-unit-filter="searchMatchedIdols.length"
        @back="goArchiveBack"
        @select="openIdol"
        @select-unit="updateArchiveFilter('currentIdolUnitFilter', $event)"
        @open-unit="openArchiveUnit"
      />

      <ArchiveCardList
        v-if="view === 'cards'"
        embedded
        :model-value="filterQuery"
        @update:model-value="updateArchiveFilter('filterQuery', $event)"
        :title="currentCardCharacterName"
        :cards="filteredCardRows"
        :idol-name="idolDisplayName"
        :rarity-tabs="cardRarityTabs"
        :current-rarity="currentCardRarity"
        :current-attribute="currentCardAttribute"
        :current-asset-state="currentCardAssetState"
        :current-relation-state="currentCardRelationState"
        :idols="bootstrapIdolSwitcher"
        :selected-idol="currentCharacterId"
        v-model:layout="cardLayout"
        @back="goArchiveBack"
        @select-card="openCard"
        @select-rarity="updateArchiveFilter('currentCardRarity', $event)"
        @select-attribute="updateArchiveFilter('currentCardAttribute', $event)"
        @select-asset-state="updateArchiveFilter('currentCardAssetState', $event)"
        @select-relation-state="updateArchiveFilter('currentCardRelationState', $event)"
        @select-idol="selectCardIdol"
      />

      <ArchiveIdolDetail
        v-if="view === 'idol_detail'"
        :idol="currentIdolProfile"
        :idol-name="idolDisplayName"
        :stats="currentIdolStats" :photo="currentIdolDetail?.photo" :honors="currentIdolDetail?.honors || []"
        :events="currentIdolEvents"
        :songs="currentIdolSongs"
        :idols="bootstrapIdolSwitcher"
        :selected-idol="currentCharacterId"
        @open-domain="openIdolDomain" @open-honor="openCollectionEntity"
        @open-unit="openUnitFromIdol"
        @open-event="openIdolEvent"
        @open-song="openSong"
        @select-idol="selectPrimaryIdol"
      />

      <ArchiveCardDetail
        v-if="view === 'card_detail'"
        embedded
        :card="currentCard"
        :owner-reference="currentCardOwnerReference"
        :asset-status="currentCardAssetStatus"
        :limitbreak-material="currentCardLimitbreakMaterial"
        :art-mode="cardArtMode"
        :previous-card="previousCard"
        :next-card="nextCard"
        :series-cards="currentSeriesCards"
        :event-relation="currentCardEventRelation"
        :gasha-relation="currentCardGashaRelation"
        :focus-voice="homeCardFocus.card === currentCard?.resource_id ? homeCardFocus.voice : ''"
        @back="goArchiveBack"
        @preview-voice="previewCardVoice"
        @open-scenario="openCardScenario"
        @navigate-card="openCard"
        @navigate-related-card="openRelatedCard"
        @open-event="openCardEvent"
        @open-gasha="openCardGasha"
        @open-idol="openCardIdol"
        @open-entity="openCollectionEntity"
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
        :supplement-count="gashaReadModelCatalog?.summary?.ticket_supplement_count || 0"
        :loaded="Boolean(gashaReadModelCatalog)"
        :busy="loading"
        :status="gashaReadModelStatus"
        @retry="openGashaCatalog({preserveBrowse:true})"
        @select="openGasha"
        @update:category="updateArchiveFilter('currentGashaCategory', $event)"
      />

      <ArchiveGashaDetail
        v-if="view === 'gasha_detail'"
        :gasha="currentGasha"
        :idol-name="idolDisplayName"
        @open-card="openGashaCard"
        @open-item="openCollectionEntity"
      />

      <ArchiveSongCatalog
        v-if="view === 'song_catalog'"
        :catalog="songReadModelCatalog"
        :scope-idol="catalogScopeIdol" @clear-idol="clearCatalogIdol"
        :idol-name="idolDisplayName"
        :idol-search="idolEntitySearchText"
        :status="songReadModelStatus"
        :scope="currentSongScope"
        :query="filterQuery"
        @open="openSong"
        @retry="ensureSongCatalog"
        @update:scope="updateArchiveFilter('currentSongScope', $event)"
        @update:query="updateArchiveFilter('filterQuery', $event)"
      />

      <ArchiveSongDetail
        v-if="view === 'song_detail' && currentSongPresentation"
        :key="currentSongPresentation.id"
        ref="songDetailView"
        :song="currentSongPresentation"
        :idol-directory="archiveBootstrap.idols"
        :idol-name="idolDisplayName"
        :idol-search="idolEntitySearchText"
        @open-chart="openChartLab"
        @open-song="openSong"
        @open-unit="openSongUnit"
        @open-idol="openSongIdol"
        @open-related-story="openSongRelatedStory"
        @open-stage="openSongStage"
        @ready="restoreSongDetailView"
      />

      <ArchiveEventDetail
        v-if="view === 'event_detail'"
        :view="currentEventProjection" :load-reading-document="loadSynopsisReadingDocument"
        :client="readModelClient" :bootstrap="archiveBootstrap"
        :external-resources="EXTERNAL_STORY_RESOURCES_ENABLED ? currentEventExternalResources : []"
        @read="openEventReader"
        :display-idol-name="idolDisplayName"
        @play="playCurrentEvent"
        @play-episode="playCurrentEventEpisode"
        @open-card="openEventCard"
        @open-collection-card="openCollectionCard"
        @open-idol="openEventIdol"
        @open-unit="openEventUnit"
        @open-entity="openCollectionEntity" @open-target="openDomainTarget" @open-seasonal="openSeasonalCampaign"
        @open-event="openEventDetail($event, 'event_detail')"
      />

      <ArchiveEventCatalog v-if="view==='event_catalog'" :client="readModelClient" :bootstrap="archiveBootstrap" :query="filterQuery"
        :scope-idol="catalogScopeIdol" :idol-name="idolDisplayName" :load-idol="loadIdolDetail" @clear-idol="clearCatalogIdol"
        :browse-state="currentEventBrowseState" @query="updateEventCatalogQuery" @browse="updateEventBrowse" @ready="onEventCatalogReady" @open-event="openEventDetail($event,view)" />
      <ArchiveCollectionCatalog v-if="view==='collection_catalog'" :display-idol-name="idolDisplayName" :client="readModelClient" :bootstrap="archiveBootstrap" :entity="currentEntityKey" :browse-state="currentCollectionState" :query="filterQuery"
        @query="filterQuery=$event; currentCollectionState={...currentCollectionState,page:0}; syncArchiveRoute({replace:true})" @browse="updateCollectionBrowse" @entity="openCollectionEntity" @open-card="openCollectionCard" @open-event="openEventDetail($event,view)" @open-gasha="openGasha" @open-idol="code => openIdolReadModel(code, { captureSource: true, resetContext: true })" />
      <ArchivePhotoCatalog v-if="view==='photo_catalog'" :client="readModelClient" :bootstrap="archiveBootstrap" :photo-idol="currentPhotoIdol" :photo-entity="currentPhotoEntity" :query="filterQuery" :display-idol-name="idolDisplayName"
        @query="updatePhotoCatalogQuery" @photo-idol="selectPhotoIdol" @photo-entity="selectPhotoEntity" @ready="onPhotoCatalogReady" @open-studio="openPictureStudio" />


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
        :scope-idol="catalogScopeIdol" @clear-idol="clearCatalogIdol"
        :all-entries="catalogStoryEntries"
        :search-entries="filteredStoryCatalog"
        :idol-directory="archiveBootstrap.idols"
        :search-query="filterQuery" @update:search-query="updateArchiveFilter('filterQuery',$event)"
        :idol-name="idolDisplayName"
        :idol-search="idolEntitySearchText"
        :domain-options="storyDomainOptions"
        :domain="currentStoryDomain"
        :section="currentStorySection"
        :mode="currentStoryMode"
        :event-scope-options="storyEventScopeOptions"
        :event-scope="currentEventScope"
        :availability="currentStoryAvailability"
        :sort="currentStorySort"
        :catalog-total="catalogStoryEntries.length"
        :filtered-total="filteredStoryCatalog.length"
        :seasonal-count="storyCatalogIndex?.seasonalCount ?? 0"
        :work-count="storyCatalogIndex?.workCount ?? 0"
        :idol-story-count="archiveBootstrap.idols.length"
        :external-resource-count="externalStoryNavigationEntries.length"
        :main-domain="mainStoryDomain"
        :extra-domain="extraStoryDomain"
        :birthday-domain="birthdayStoryDomain"
        @select="openCatalogStory"
        @open-event="openEventDetail($event,'story_catalog')"
        @browse="browseStoryCollection"
        @open-external-resources="openExternalStoryResources"
        @open-seasonal="openSeasonalCampaign()"
        @open-work="openWorkArchive()"
        @open-idol-story="openIdolStoryArchive($event)"
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
        :idol-name="idolDisplayName"
        :reading-entries="readingCatalogEntries" :reader-source="currentArchiveRoute()" :load-reading-document="loadSynopsisReadingDocument"
        @read-episode="openCollectionReader"
        @play-chapter="playStoryCollectionChapter"
        @play-episode="playStoryCollectionEpisode"
        @select-chapter="selectStoryCollectionChapter"
        @open-gasha="openGasha"
        @open-idol-story="openBirthdayIdolStory"
      />

      <ArchiveSeasonalCampaign
        v-if="view === 'seasonal_campaign' && currentSeasonalPage"
        :page="currentSeasonalPage"
        :focus-id="currentStorySection"
        :participant-code="currentCharacterId"
        :idols="archiveBootstrap.idols"
        :idol-name="idolDisplayName"
        @read="openSeasonalReader"
        @select="selectSeasonalCampaign"
        @select-participant="selectSeasonalParticipant"
        @play="playSeasonalCampaignStory"
        @play-participant="playSeasonalParticipant"
      />

      <ArchiveWorkStory
        v-if="view === 'work_archive'"
        :idol="currentWorkIdol" :load-reading-document="loadSynopsisReadingDocument"
        :idols="workReadModelCatalog || []"
        :idol-name="idolDisplayName"
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
        :story="currentIdolStoryPage" :load-reading-document="loadSynopsisReadingDocument"
        :reading-entries="readingCatalogEntries"
        @read-episode="openIdolStoryReader"
        :idols="idolStoryOptions"
        :idol-name="idolDisplayName"
        :external-resources="EXTERNAL_STORY_RESOURCES_ENABLED ? currentIdolStoryExternalResources : []"
        :focused-section-id="currentStorySection"
        :focused-episode-id="currentEpisodeId"
        @select-idol="selectIdolStory"
        @play-section="playIdolStorySection"
        @play-episode="playIdolStoryEpisode"
        @open-communication="openStoryCommunication"
        @open-birthday="openIdolBirthdayArchive"
      />

      <ArchiveMobileArchive
        v-if="view === 'mobile_archive'"
        :idol-data="mobileIdolReadModelDetail" :load-reading-document="loadSynopsisReadingDocument"
        :unit-data="mobileUnitReadModelDetail"
        :idols="mobileIdolOptions"
        :units="mobileUnitOptions"
        :selected-idol="currentCharacterId"
        :selected-unit="currentArchiveUnitCode"
        :mode="currentMobileMode"
        :focused-scenario-id="currentMobileScenarioId"
        :idol-name-from-source="idolDisplayNameFromSource"
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
        :idol-name="idolDisplayName"
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
      <template #pending>
        <GsLoadingIndicator v-if="routePending" variant="inline" :message="routePendingMessage" />
        <GsLoadingIndicator v-else-if="loadNotice?.kind === 'loading'" variant="inline" :message="loadNotice.message" />
        <ArchiveLoadNotice v-else-if="loadNotice" :message="loadNotice.message" />
      </template>
    </ArchiveShell>
    <ArchiveOnboarding
      v-if="view === 'portal' && !userPreferences.onboardingComplete && archivePickerIdols.length"
      :idols="archivePickerIdols"
      :home-idol-ids="validArchiveHomeIdols"
      :idol-name="idolDisplayName"
      :idol-search="idolEntitySearchText"
      :initial-favorite="userPreferences.preferredIdol || ''"
      @finish="completeOnboarding"
    />

    <!-- ====== STORY PLAYER ====== -->
    <PlayerSessionShell v-if="playerSessionOpen">
    <section v-if="(playbackError || playbackReadiness?.status === 'blocked') && !loading" ref="playbackFailure" class="playback-failure" role="alert" tabindex="-1">
      <p v-if="playbackError">演出暂时无法载入，请重试或返回。</p>
      <p v-else>当前段落的必要{{ playbackReadiness.reason === 'voice-renderable' ? '语音' : '画面' }}未能准备完成，请重试或返回。</p>
      <details v-if="MAINTAINER"><summary>加载详情</summary><p>{{ playbackError || playbackReadiness?.reason }}</p></details>
      <div class="playback-failure-actions">
        <button v-if="playbackController.canRetry.value" type="button" @click="playbackController.retry()">重试载入</button>
        <button v-else-if="playbackReadiness?.status === 'blocked'" type="button" @click="playbackController.retryCurrentStep()">重试当前段落</button>
        <button type="button" @click="playbackController.close()">返回</button>
      </div>
      <details v-if="MAINTAINER && preloadStatus?.failed"><summary>失败资源</summary>
        <ul><li v-for="task in preloadStatus.tasks.filter(task => task.state === 'failed')" :key="task.key">{{ task.id }}：{{ task.error }}</li></ul>
      </details>
    </section>
    <details v-if="MAINTAINER && view === 'player' && !loading && preloadStatus?.failed" class="preload-notice">
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
      :next-target="playbackController.nextTarget.value"
      :position-label="[playbackController.continuation.value?.currentLabel, presentIdolEpisodeLabel({ sourceName:playbackController.queue.current.value?.label, format:'player' })].filter(Boolean).join(' · ')"
      :return-label="returnViewAfterPlayer === 'reader' ? '返回阅读页' : returnViewAfterPlayer === 'mobile_archive' ? '返回通信' : '返回来源目录'"
      :transition-pending="loading && Boolean(playbackController.pendingEntry.value)"
      :recovery-open="Boolean(playbackError || playbackReadiness?.status === 'blocked') && !loading"
      :queue-status="playbackController.queueStatus.value"
      :queue-snapshot="playbackController.queue.snapshot.value" @select-episode="selectPlayerEpisode"
      :queue-error="playbackController.queueError.value"
      @retry-queue="playbackController.ensureQueue({ retry: true })"
      :continuous-playback="playbackController.continuationOverride.value ?? continuousPlayback"
      @back="closePlayer"
      @ready="onPlayerReady"
      @next-episode="playNextEpisode"
      @update:continuous-playback="playbackController.setContinuous($event)"
      :format-episode-label="playerEpisodeLabel"
    >
      <template #language-switch><ArchiveLanguageSwitch /></template>
    </StoryViewer>

    <LoadingScreen :can-cancel="Boolean(playbackController.pendingEntry.value) || playbackBuffering" @cancel="playbackController.close()" :visible="!pickerPreparing && (hardLoading || playbackBuffering) && !(view === 'player' && !loading && playbackReadiness?.status === 'waiting' && playbackReadiness?.hasFrame)" :status="preloadStatus" :readiness="playbackReadiness" :message="loadingMessage" surface="player" />
    </PlayerSessionShell>

    <ArchiveExperimentFrame v-if="view === 'chart_lab'" title="谱面预览" :back-label="detailSourceRoute ? '返回来源页' : currentSongId ? '返回歌曲' : '返回工具'" @back="closeFullScreenExperiment">
      <ArchiveChartLab v-if="!currentSongId || currentSongPresentation?.gameplay" :song="currentSongPresentation?.gameplay ? currentSongPresentation : null"
        :songs="chartSongs" :status="songReadModelStatus" @select-song="selectChartSong" />
      <p v-else role="status">{{ songReadModelStatus || '正在读取谱面资料…' }}</p>
    </ArchiveExperimentFrame>
    <PictureStudio v-if="view === 'picture_studio'" standalone :client="readModelClient" :bootstrap="archiveBootstrap" :photo-idol="currentPhotoIdol" :photo-entity="currentPhotoEntity" :idol-name="idolDisplayName" :idol-search="idolEntitySearchText" @back="closeFullScreenExperiment" />
    <!-- ====== SPINE LAB ====== -->
    <SpineViewer v-if="view === 'spine_lab'" :idol-name="idolDisplayName" :back-label="labBackLabel" @back="closeArchiveExperiment" @open-stage="openChibiStage" />
    <ChibiStageViewer
      v-if="view === 'chibi_stage'"
      :audio-experiments="stageAudioExperiments"
      :idol-directory="archiveBootstrap.idols"
      :idol-name="idolDisplayName"
      :idol-search="idolEntitySearchText"
      :original-performers="stageOriginalPerformers"
      :original-slot-ordered="stageOriginalSlotOrdered"
      :song-directory="stageSongDirectory"
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
    <LoadingScreen v-if="!playerSessionOpen" :can-cancel="Boolean(playbackController.pendingEntry.value) || playbackBuffering" @cancel="playbackController.close()" :visible="!pickerPreparing && (hardLoading || playbackBuffering) && view !== 'reader' && !(view === 'player' && !loading && playbackReadiness?.status === 'waiting' && playbackReadiness?.hasFrame)" :status="preloadStatus" :readiness="playbackReadiness" :message="loadingMessage"
      :surface="loadingPurpose === 'stage' ? 'stage' : (playbackBuffering || view === 'player' || loadingPurpose === 'story-playback' ? 'player' : 'archive')" />

  </div>
</template>

<script setup>
import ArchiveExperimentFrame from './components/archive/ArchiveExperimentFrame.vue'
import ArchivePageLoadError from './components/archive/ArchivePageLoadError.vue'
import ArchiveLoadNotice from './components/archive/ArchiveLoadNotice.vue'
import ArchiveLanguageSwitch from './components/archive/ArchiveLanguageSwitch.vue'
import { eventResources } from './data/eventResourceGraph.js'
import { fetchSongTimelineManifest } from './utils/songPerformanceData.js'
import { isDirectScenarioEntry, playerReturnRoute, selectPlayerQueue, selectCollectionContinuation } from './core/PlayerEntryRequest.js'
import { withLoadDeadline } from './core/AsyncLoadBoundary.js'
import { isMaintainerMode } from './core/maintainerMode.js'
import { tracePlayer, playerTraceSnapshot } from './core/PlayerTrace.js'
import { EXTERNAL_STORY_RESOURCES_ENABLED } from '../shared/deploy/ExternalStoryResourcePolicy.js'
import {loadArchiveNames,archiveNamedText,archiveNamedSearchText,archiveNamedTranslation} from './components/archive/useArchiveNamedText.js'
import { useStoryPlaybackController } from './core/useStoryPlaybackController.js'
import { useEpisodeQueue } from './core/useEpisodeQueue.js'
import { buildCardVoicePreviewScenario, findCardVoiceCue } from './data/cardVoicePreview.js'
import { createArchiveNavigationCoordinator } from './core/ArchiveNavigationCoordinator.js'
import { useArchiveNavigationState } from './core/useArchiveNavigationState.js'
import { ref, shallowRef, computed, defineAsyncComponent, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { IDOL_ID_TO_NAME } from './utils/IdolNameMap.js'
const preloadScenario = async (...args) => (await import('./utils/Preloader.js')).Preloader.preloadScenario(...args)
import { prepareArchiveRoute } from './core/prepareArchiveRoute.js'
import PlayerSessionShell from './components/player/PlayerSessionShell.vue'
import LoadingScreen from './components/LoadingScreen.vue'
import GsLoadingIndicator from './components/GsLoadingIndicator.vue'
import ArchiveShell from './components/archive/ArchiveShell.vue'
import ArchiveStageIdolSwitch from './components/archive/ArchiveStageIdolSwitch.vue'
import ArchivePortalLauncher from './components/archive/ArchivePortalLauncher.vue'
import { useArchivePortalData } from './components/archive/useArchivePortalData.js'
import ArchiveWelcome from './components/archive/ArchiveWelcome.vue'
import { buildIdolReference } from './presentation/IdolReferencePresentation.js'
import { STAGE_LIGHT_TOKENS, idolStageLightProperties } from './presentation/idolStageLight.js'
import { presentIdolEpisodeLabel, queueEpisodeLabel, playerEpisodeLabel } from './presentation/idolEpisodeLabel.js'
import { resolveMobileArchiveUnit } from './core/mobileArchiveIdentity.js'
import {
  loadArchiveUserPreferences,
  saveArchiveUserPreferences,
} from './data/archiveUserPreferences.js'
import { resolveArchiveHomeAction, resolveArchiveStartup } from './core/archiveStartup.js'
import { readBootstrap } from '../readmodels/runtime/readBootstrap.mjs'
import { ReadModelClient } from '../readmodels/runtime/ReadModelClient.mjs'
import {
  archiveSectionForRoute,
  buildArchiveBreadcrumbs,
  buildArchiveSourceQuery,
  ownsArchiveSource,
  readArchiveSourceRoute,
  buildArchiveUrl,
  onArchivePopState,
  readArchiveRoute,
  writeArchiveRoute,
} from './core/archiveRoute.js'
import { normalizeEventBrowseState } from './core/EventCatalogRouteState.js'
import {
  buildArchiveViewContext,
  captureArchiveViewState,
  readArchiveViewRestoration,
  restoreArchiveViewState,
} from './core/archiveViewRestoration.js'
import { installSpineAnimationDebug } from './debug/installSpineAnimationDebug.js'
import { useStageSongProjection } from './composables/useStageSongProjection.js'
import { useStageNavigation } from './composables/useStageNavigation.js'
import { useSongNavigation } from './composables/useSongNavigation.js'
import { usePhotoCatalogNavigation } from './composables/usePhotoCatalogNavigation.js'
import { useStoryCatalogProjection } from './composables/useStoryCatalogProjection.js'
import { useStoryNavigation } from './composables/useStoryNavigation.js'
import { useStoryArchiveNavigation } from './composables/useStoryArchiveNavigation.js'
import { SEASONAL_SEASON_LABEL } from '../shared/reading/ReadingCatalog.js'
import { useResourceNavigation } from './composables/useResourceNavigation.js'
import { useGashaNavigation } from './composables/useGashaNavigation.js'
import { useCardNavigation } from './composables/useCardNavigation.js'
import { useUnitNavigation } from './composables/useUnitNavigation.js'
import { useIdolNavigation } from './composables/useIdolNavigation.js'
import { useHomeNavigation } from './composables/useHomeNavigation.js'
import { useEventNavigation } from './composables/useEventNavigation.js'
import { useLegacyAliasNavigation } from './composables/useLegacyAliasNavigation.js'
import { useMobileNavigation } from './composables/useMobileNavigation.js'
import { useReaderNavigation } from './composables/useReaderNavigation.js'
import { usePortalNavigation } from './composables/usePortalNavigation.js'
import { EntityTranslationRepository } from './localization/story/EntityTranslationRepository.js'
import { storyCollectionTitle } from './presentation/StoryPageTitle.js'
import { PlayerPreferencesRepository } from './core/story-runtime/PlayerPreferencesRepository.js'
import { communicationOwnerId } from './core/story-runtime/CommunicationPresentationContext.js'
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
  externalResourcesForIdolStory,
  externalResourcesForStory,
} from './data/externalStoryResources.js'

setStoryLanguagePreferences(new PlayerPreferencesRepository().load())
const entityTranslationRepository = new EntityTranslationRepository()
const URL_FLAGS = new URLSearchParams(window.location.search)
const NO_AUDIO = URL_FLAGS.get('noAudio') === '1'
const RUNTIME_DEBUG = URL_FLAGS.get('runtimeDebug') === '1'
const MAINTAINER = isMaintainerMode()

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
// Maintainer-only (?runtimeDebug=1): keep it out of the main bundle.
const StoryReleaseSoakPanel = defineAsyncComponent(() => import('./components/player/StoryReleaseSoakPanel.vue'))
// Only a first visit needs it.
const ArchiveOnboarding = defineAsyncComponent(() => import('./components/archive/ArchiveOnboarding.vue'))
const ArchiveImmersiveHome = defineAsyncComponent(immersiveHomeLoader)
const SpineViewer = defineAsyncComponent(spineViewerLoader)
const ChibiStageViewer = defineAsyncComponent(chibiStageViewerLoader)
const archiveRouteLoaders = {
  event_catalog: () => import('./components/archive/ArchiveEventCatalog.vue'),
  collection_catalog: () => import('./components/archive/ArchiveCollectionCatalog.vue'),
  photo_catalog: () => import('./components/archive/ArchivePhotoCatalog.vue'),
  experiments: () => import('./components/archive/ArchiveExperiments.vue'),
  about: () => import('./components/archive/ArchiveAbout.vue'),
  chart_lab: () => import('./components/archive/ArchiveChartLab.vue'),
  picture_studio: () => import('./components/archive/PictureStudio.vue'),
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
const defineArchivePage = loader => defineAsyncComponent({ loader, errorComponent: ArchivePageLoadError })
const ArchiveStoryReader = defineArchivePage(archiveRouteLoaders.reader)
const ArchiveEventDetail = defineArchivePage(archiveRouteLoaders.event_detail)
const ArchiveEventCatalog = defineArchivePage(archiveRouteLoaders.event_catalog)
const ArchiveCollectionCatalog = defineArchivePage(archiveRouteLoaders.collection_catalog)
const ArchivePhotoCatalog = defineArchivePage(archiveRouteLoaders.photo_catalog)
const ArchiveExperiments = defineArchivePage(archiveRouteLoaders.experiments)
const ArchiveAbout = defineArchivePage(archiveRouteLoaders.about)
const ArchiveChartLab = defineArchivePage(archiveRouteLoaders.chart_lab)
const PictureStudio = defineArchivePage(archiveRouteLoaders.picture_studio)
const ArchiveStoryCatalog = defineArchivePage(archiveRouteLoaders.story_catalog)
const ArchiveStoryDetail = defineArchivePage(archiveRouteLoaders.story_detail)
const ArchiveStoryCollection = defineArchivePage(archiveRouteLoaders.story_collection)
const ArchiveSeasonalCampaign = defineArchivePage(archiveRouteLoaders.seasonal_campaign)
const ArchiveWorkStory = defineArchivePage(archiveRouteLoaders.work_archive)
const ArchiveIdolStory = defineArchivePage(archiveRouteLoaders.idol_story_archive)
const ArchiveCardList = defineArchivePage(archiveRouteLoaders.cards)
const ArchiveCardDetail = defineArchivePage(archiveRouteLoaders.card_detail)
const ArchiveGashaCatalog = defineArchivePage(archiveRouteLoaders.gashas)
const ArchiveGashaDetail = defineArchivePage(archiveRouteLoaders.gasha_detail)
const ArchiveSongCatalog = defineArchivePage(archiveRouteLoaders.song_catalog)
const ArchiveSongDetail = defineArchivePage(archiveRouteLoaders.song_detail)
const ArchiveMobileArchive = defineArchivePage(archiveRouteLoaders.mobile_archive)
const ArchiveUnitCatalog = defineArchivePage(archiveRouteLoaders.unit_catalog)
const ArchiveUnitDetail = defineArchivePage(archiveRouteLoaders.unit_detail)
const ArchiveIdolGrid = defineArchivePage(archiveRouteLoaders.idols)
const ArchiveIdolDetail = defineArchivePage(archiveRouteLoaders.idol_detail)
const ArchiveGroupList = defineArchivePage(archiveRouteLoaders.groups)
const ArchiveFileList = defineArchivePage(archiveRouteLoaders.files)
const ArchiveUnitGrid = defineArchivePage(archiveRouteLoaders.episode_zero_units)
const ArchiveEpisodeList = defineArchivePage(archiveRouteLoaders.episodes)
const ArchiveStatus = defineArchivePage(archiveRouteLoaders.archive_status)
const ArchiveExternalStoryResources = defineArchivePage(archiveRouteLoaders.external_story_resources)
function prepareArchivePage(routeView, data) {
  // The shared pending notice owns progress; discard notices from superseded routes.
  for (const status of [mobileReadModelStatus, songReadModelStatus, idolReadModelStatus,
    unitReadModelStatus, gashaReadModelStatus, cardReadModelStatus, eventReadModelStatus,
    seasonalReadModelStatus, workReadModelStatus, idolStoryReadModelStatus,
    collectionReadModelStatus, storyReadModelStatus, resourceReadModelStatus]) status.value = ''
  return prepareArchiveRoute(archiveRouteLoaders, routeView, data)
}

const archiveComponentPending = ref(false)
const routePendingMessage = ref('正在准备下一页…')
let componentLoadRevision = 0
function primeArchiveRouteComponent(routeView) {
  const revision = ++componentLoadRevision
  const labels = {reader:'阅读器',cards:'卡片目录',card_detail:'卡片详情',idol_picker:'偶像选择',
    portal:'资料馆',event_catalog:'活动目录',event_detail:'活动详情',collection_catalog:'收藏',
    picture_studio:'摄影工作台',photo_catalog:'摄影资料',story_catalog:'故事目录'}
  routePendingMessage.value = `正在打开${labels[routeView] || '下一页'}…`
  const load = archiveRouteLoaders[routeView]
  archiveComponentPending.value = Boolean(load)
  if (load) load().catch(error => console.error(`[ArchiveRoute] Could not load ${routeView}:`, error))
    .finally(async () => {
      await nextTick()
      if (revision === componentLoadRevision) archiveComponentPending.value = false
    })
}

const {
  view,
  playerEntryRoute,
  currentPickTarget,
  portalFrom,
  portalScope, portalQuery, homeFrom,
  detailSourceRoute,
  readingDocumentId,
  readingRowId,
  readingMode,
  readingRevision, readingScope, playMode,
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
  currentEventBrowseState,
  currentEntityKey,
  currentCollectionState,
  currentPhotoIdol,
  currentPhotoEntity,
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
const bootstrapIdolSwitcher = computed(() => archiveBootstrap.idols.map(idol => ({
  idol_code: idol.id, display_name: idolDisplayName(idol.id), unit_name: idol.unitName,
})))
const mobileIdolReadModelCatalog = shallowRef(null)
const mobileUnitReadModelCatalog = shallowRef(null)
const mobileIdolReadModelDetail = shallowRef(null)
const mobileUnitReadModelDetail = shallowRef(null)
const mobileReadModelStatus = ref('')
const legacyGroupReadModelDetail = shallowRef(null)
const legacyFileReadModelDetail = shallowRef(null)
const legacyZeroReadModelDetail = shallowRef(null)
const legacyEpisodeReadModelDetail = shallowRef(null)
const legacyAliasStatus = ref('')
const homeFocus = ref(false)
const userPreferences = ref(initialUserPreferences.preferences)
const userPreferenceNotice = ref(initialUserPreferences.issue)
const legacyEntryStatus = ref('')
const songReadModelCatalog = shallowRef(null)
const songReadModelDetail = shallowRef(null)
const songReadModelStatus = ref('')
const idolReadModelCatalog = shallowRef(null)
const idolReadModelDetail = shallowRef(null)
const idolReadModelStatus = ref('')
const unitReadModelCatalog = shallowRef(null)
const unitReadModelDetail = shallowRef(null)
const unitReadModelStatus = ref('')
const gashaReadModelCatalog = shallowRef(null)
const gashaCatalogFunctions = shallowRef(null)
const gashaReadModelDetail = shallowRef(null)
const gashaReadModelStatus = ref('')
const cardReadModelCatalog = shallowRef(null)
const cardReadModelDetail = shallowRef(null)
const cardReadModelStatus = ref('')
const eventReadModelCatalog = shallowRef(null)
const eventReadModelDetail = shallowRef(null)
const eventReadModelStatus = ref('')
const seasonalReadModelCatalog = shallowRef(null)
const seasonalReadModelDetail = shallowRef(null)
const seasonalReadModelStatus = ref('')
const workReadModelCatalog = shallowRef(null)
const workReadModelDetail = shallowRef(null)
const workReadModelStatus = ref('')
const idolStoryReadModelCatalog = shallowRef(null)
const idolStoryReadModelDetail = shallowRef(null)
const idolStoryReadModelStatus = ref('')
const collectionReadModelCatalog = shallowRef(null)
const collectionReadModelDetail = shallowRef(null)
const collectionReadModelStatus = ref('')
const storyReadModelCatalog = shallowRef(null)
const storyReadModelDetail = shallowRef(null)
const storyReadModelStatus = ref('')
const storyCatalogIndex = shallowRef(null)
const storyCatalogLanding = shallowRef(null)
const resourceReadModelDetail = shallowRef(null)
const resourceReadModelStatus = ref('')
const homeReadModelIndex = shallowRef(null)
const homeReadModelProfiles = shallowRef({})
const homeEntryStatus = ref('')
// One reader-facing message for whatever archive page is being read. Producers keep
// their own status refs (each navigation function is tested against them); this is
// the single place that decides which one is shown and how.
const LEGACY_DIRECTORY_VIEWS = ['groups', 'files', 'episodes', 'episode_zero_units']
const loadNotice = computed(() => {
  const current = view.value
  const scoped = [
    [current === 'home', homeEntryStatus.value],
    [['idols', 'idol_detail'].includes(current), idolReadModelStatus.value],
    [current === 'song_detail', songReadModelStatus.value || legacyEntryStatus.value],
    [LEGACY_DIRECTORY_VIEWS.includes(current), legacyAliasStatus.value],
    [current === 'mobile_archive', mobileReadModelStatus.value],
    [['unit_catalog', 'unit_detail'].includes(current), unitReadModelStatus.value],
  ].filter(([applies]) => applies).map(([, message]) => message)
  const ambient = loading.value ? [] : [
    cardReadModelStatus.value,
    ['portal', 'gashas'].includes(current) ? '' : gashaReadModelStatus.value,
    eventReadModelStatus.value, seasonalReadModelStatus.value, workReadModelStatus.value,
    idolStoryReadModelStatus.value, collectionReadModelStatus.value, storyReadModelStatus.value,
    resourceReadModelStatus.value,
  ]
  const message = [...scoped, ...ambient].find(Boolean)
  if (!message) return null
  const inProgress = message.startsWith('正在')
  // A full-page loading screen already covers in-progress reads; only failures stay visible.
  return inProgress && loading.value ? null : { message, kind: inProgress ? 'loading' : 'error' }
})
const continuousPlayback = ref(localStorageValue('sidem:continuous-playback') === '1')
const loading = ref(initialArchiveStartup.route.view === 'player' || !isBootstrapRoute(initialArchiveStartup.route) || ['song_catalog', 'song_detail', 'idol_detail', 'unit_catalog', 'unit_detail', 'seasonal_campaign', 'work_archive', 'idol_story_archive', 'mobile_archive', 'story_collection', 'story_detail', 'story_catalog', 'archive_status', 'groups', 'files', 'episode_zero_units', 'episodes'].includes(initialArchiveStartup.route.view) || initialArchiveStartup.route.view === 'home' && Boolean(initialArchiveStartup.route.homeIdol))
const loadingPurpose = ref('archive-data')
const hardLoading = computed(() => loading.value && (view.value === '__boot__' || loadingPurpose.value !== 'archive-data'))
const routePending = computed(() => archiveComponentPending.value || (loading.value && !hardLoading.value))
const preloadProgress = ref(0)

// View preferences and history lifecycle (navigation refs are owned above).
const cardLayout = ref('compact')
const cardArtMode = ref('clean')
const storyVisibleLimit = ref(80)
let archiveRouteReady = false
let pendingPreReadyRoute = null
let activeArchiveViewContext = null
let archiveViewRestoreRevision = 0
let pendingEventCatalogRestore = null
let pendingPhotoCatalogRestore = null
const songDetailView = ref(null)
let pendingSongDetailRestore = null
let pendingPortalRestore = null
const navigation = createArchiveNavigationCoordinator({ onFinish: () => { loading.value = false; loadingPurpose.value = 'archive-data' } })
const playbackController = useStoryPlaybackController({
  state: { view, playMode, playerEntryRoute, currentArchiveRoute, loading, preloadProgress, currentScenarioFile, currentScenarioStartStep, currentScenarioEndStep, currentScenarioInitialStep, currentPreviewCue, returnViewAfterPlayer },
  navigation, loadPlayer: storyViewerLoader,
  preloadAssets: (plan, progress, options) => preloadScenario(plan, progress, options),
  syncRoute: () => syncArchiveRoute(), returnTo: restorePlaybackDestination, resolveQueue: loadPlayerQueue,
  resolveReaderSource: (...args) => resolveReaderContinuationSource(...args),
  queue: useEpisodeQueue({ formatLabel: queueEpisodeLabel }),
})
const { currentScenario, currentScenarioInstance, hasNext: hasNextPlaybackEpisode, error: playbackError,
  preloadStatus, playbackBuffering, playbackReadiness } = playbackController
const playerSessionOpen = computed(() => view.value === 'player' || Boolean(playbackController.pendingEntry.value))
const loadingMessage = computed(() => playbackBuffering.value || view.value === 'player' || loadingPurpose.value === 'story-playback'
  ? '正在准备演出…'
  : loadingPurpose.value === 'stage' ? '正在准备舞台…' : '正在读取资料馆数据…')
let removeArchivePopState = null
let removeSpineAnimationDebug = null

const {
  openMobileArchive, openStoryCommunication, selectMobileIdol, selectMobileUnit,
  setMobileMode, playMobileScenario, playRandomTalkTopic, openMobileCard,
  openStoryPhone, loadMobileCatalog, loadMobileDetail, loadMobileRoute,
  mobileIdolOptions, mobileUnitOptions, goBackFromMobileArchive, invalidateMobileNavigation,
  prepareMobileRoute,
} = useMobileNavigation({
  mobileIdolReadModelCatalog, mobileUnitReadModelCatalog, mobileIdolReadModelDetail, mobileUnitReadModelDetail,
  mobileReadModelStatus, legacyEntryStatus, currentCharacterId, currentMobileMode,
  currentArchiveUnitCode, currentMobileScenarioId, currentStoryDomain, currentStoryMode,
  currentCategoryId, currentCardId, cardReadModelDetail, archiveBootstrap,
  bootstrapMembership, navigation, readModelClient, idolDisplayName,
  openIdolPicker, captureDetailSource, commitView, commitArchiveSelection,
  goHome, loadScenario, loadCardDetail: (...args) => loadCardDetail(...args),
})

const archiveStats = computed(() => homeReadModelIndex.value?.stats || [])
const archiveHomeIdols = computed(() => homeReadModelIndex.value
  ? homeReadModelIndex.value.idols.map(idol => homeReadModelProfiles.value[idol.id] || idol)
  : archiveBootstrap.idols.filter(idol => idol.home_available))
const archivePickerIdols = computed(() => archiveBootstrap.idols)
const validArchiveHomeIdols = computed(() => archiveHomeIdols.value.map(idol => idol.id))
const preferredArchiveIdol = computed(() =>
  archivePickerIdols.value.find(idol => idol.id === userPreferences.value.preferredIdol) || null)
const preferredArchiveIdolReference = computed(() => preferredArchiveIdol.value
  ? buildIdolReference(preferredArchiveIdol.value.id, bootstrapIdolDictionary,
    bootstrapMembership, 'portal:preferred')
  : null)
const idolPickerLabel = computed(() => ({
  home: '首页',
  profile: '偶像资料',
  work: '工作档案',
  story: '个人故事',
  mobile: '通信档案',
})[currentPickTarget.value] || '首页')
const {
  loadHomeIndex, loadHomeIdol, openGameHome, closeHomeVisit,
  homeVisits, handleHomeIdolChange, prepareHomeRoute, invalidateHomeNavigation,
} = useHomeNavigation({
  homeReadModelIndex, homeReadModelProfiles, homeEntryStatus, view,
  loading, userPreferenceNotice, userPreferences, validArchiveHomeIdols,
  homeSelectedId, homeSelectedCue, homeSelectedCostume, homeFrom,
  portalFrom, detailSourceRoute, navigation, archiveBootstrap,
  readModelClient, currentArchiveRoute, openIdolPicker, commitView,
  captureActiveArchiveView, restoreRoute, syncArchiveRoute, window,
})

const {
  openPrimaryIdol, openIdolReadModel, openIdolDirectory, selectPrimaryIdol,
  loadIdolCatalog, loadIdolDetail, currentIdolDetail, currentIdolProfile,
  currentIdolDisplayName, currentIdolStats, currentIdolEvents, currentIdolSongs,
  handleIdolDetailChange, prepareIdolRoute, invalidateIdolNavigation,
} = useIdolNavigation({
  idolReadModelCatalog, idolReadModelDetail, idolReadModelStatus, currentCharacterId,
  currentEventId, eventParentView, currentCategoryId, currentGroup,
  currentArchiveUnitCode, currentCardId, filterQuery, view,
  loading, currentIdolUnitFilter, navigation, archiveBootstrap,
  readModelClient, openIdolPicker, captureDetailSource, commitArchiveSelection,
  commitView, idolDisplayName,
})

// The 担当 colour takes over the stage light when the producer opts in. The role tokens
// resolve on :root, so the override must sit on the root element itself.
const stageLightIdol = computed(() => userPreferences.value.stageLight === 'idol' ? preferredArchiveIdol.value : null)
watch(() => stageLightIdol.value?.color || '', color => {
  const root = document.documentElement
  const properties = idolStageLightProperties(color)
  for (const token of STAGE_LIGHT_TOKENS) {
    if (properties[token]) root.style.setProperty(token, properties[token])
    else root.style.removeProperty(token)
  }
}, { immediate: true })
const portalData = useArchivePortalData({ view, bootstrap: archiveBootstrap, client: readModelClient,
  scope: portalScope, searchQuery: portalQuery,
  preferredIdol: preferredArchiveIdol,
  loadCards: options => loadCardCatalog(options),
  idolName: idolDisplayName, idolSearch: idolEntitySearchText,
  cardTitle: source => archiveNamedText('card', source, 'title'),
  cardSearch: source => archiveNamedSearchText('card', source, 'title'),
  songTitle: source => source || '',
})
const portalViewReference = computed(() => portalData.scopeIdol.value
  ? buildIdolReference(portalData.scopeIdol.value.id, bootstrapIdolDictionary, bootstrapMembership, 'portal:view') : null)
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
    color: unitReadModelCatalog.value?.find(row => row.id === String(unit.unit_id))?.catalog.unit.unit_color || '',
    count: counts.get(String(unit.unit_id)) || 0,
  })).filter(unit => unit.count)
})

// Group list.
const {
  openGroup, openScenarioEntry, openUnit, openEpisodeFiles,
  goBackToUnits, goBackFromGroups, returnToMobilePicker, goBackToFiles,
  loadLegacyAliasDetail, loadLegacyAliasRoute, publishLegacyAliasRoute, filteredGroups,
  groupTitle, episodeZeroUnits, filteredFileEntries, prepareLegacyAliasRoute,
  invalidateLegacyAliasNavigation,
} = useLegacyAliasNavigation({
  legacyGroupReadModelDetail, legacyFileReadModelDetail, legacyEpisodeReadModelDetail, legacyZeroReadModelDetail,
  legacyAliasStatus, currentCharacterId, currentCategoryId, currentPickTarget,
  currentGroup, currentUnit, currentEpisodeId, currentCardId,
  filterQuery, detailSourceRoute, navigation, archiveBootstrap,
  readModelClient, captureDetailSource, commitView, goHome,
  loadScenario, openIdolReadModel,
})

const categoryHeaderText = computed(() => {
  if (currentCategoryId.value === 'cards') return '卡片档案'
  if (currentCategoryId.value === 'idol_chat') return '短信聊天'
  if (currentCategoryId.value === 'idol_phone') return '电话聊天'
  return '偶像与组合档案'
})

const categoryFilterPlaceholder = computed(() => {
  if (currentCategoryId.value === 'cards') return 'Search card idol...'
  if (currentCategoryId.value === 'idol_chat') return 'Search chat...'
  if (currentCategoryId.value === 'idol_phone') return 'Search phone...'
  return '搜索偶像姓名或组合…'
})

const mainStoryDomain = computed(() => storyCatalogLanding.value?.main || null)

const {
  currentSeasonalPage, currentSeasonalCampaign, currentWorkIdol, idolStoryOptions, currentIdolStoryPage,
  openSeasonalCampaign, selectSeasonalCampaign, selectSeasonalParticipant, playSeasonalCampaignStory, playSeasonalParticipant,
  openWorkArchive, selectWorkIdol, setWorkMode, playWorkStory,
  openIdolStoryArchive, selectIdolStory, openBirthdayIdolStory, openIdolBirthdayArchive,
  playIdolStorySection, playIdolStoryEpisode, openMobileIdolStory,
  loadSeasonalCatalog, loadSeasonalDetail, loadSeasonalLedgerOnly, loadWorkCatalog, loadWorkDetail, loadIdolStoryCatalog, loadIdolStoryDetail,
  goBackFromSeasonalCampaign, goBackFromWorkArchive, goBackFromIdolStoryArchive,
  invalidateStoryArchiveNavigation, prepareStoryArchiveRoute,
} = useStoryArchiveNavigation({
  loading, filterQuery, currentStoryDomain, currentStoryMode, currentStorySection, currentStoryFile,
  currentCharacterId, currentWorkMode, currentEpisodeId, currentMobileScenarioId, storyCollectionParentView,
  currentMobileMode, mobileUnitReadModelDetail, mobileIdolReadModelDetail,
  seasonalReadModelCatalog, seasonalReadModelDetail, seasonalReadModelStatus,
  workReadModelCatalog, workReadModelDetail, workReadModelStatus,
  idolStoryReadModelCatalog, idolStoryReadModelDetail, idolStoryReadModelStatus,
  navigation, archiveBootstrap, readModelClient, prepareArchivePage, captureDetailSource, commitView, commitArchiveSelection,
  openIdolPicker, loadScenario, startEpisodeQueue,
  openStoryCatalog: (...args) => openStoryCatalog(...args),
  openProjectedCollection: (...args) => openProjectedCollection(...args),
})

const currentIdolStoryExternalResources = computed(() =>
  externalResourcesForIdolStory(
    externalStoryResourcesData.value,
    currentIdolStoryPage.value,
  ),
)

const storyCatalogEntries = computed(() => storyReadModelCatalog.value || [])
const catalogScopeIdol = computed(() => archiveBootstrap.idols.find(row => row.id === currentCharacterId.value) || null)
const { storyDomainOptions, storyEventScopeOptions, catalogStoryEntries, filteredStoryCatalog, visibleStoryCatalogEntries } = useStoryCatalogProjection({
  storyCatalogEntries, catalogScopeIdol, filterQuery, currentStoryAvailability, currentStoryDomain,
  currentStorySection, currentEventScope, currentStorySort, storyVisibleLimit,
})

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

const {
  openStoryCatalog, setStoryDomain, setStoryMode, browseStoryCollection, openExternalStoryResources, openExternalStoryInternal,
  openProjectedCollection, openCatalogStory, openStoryDetail, selectStoryCollectionChapter, openStoryIdol,
  playStoryDetail, playStoryCollectionChapter, playStoryCollectionEpisode,
  loadCollectionCatalog, loadCollectionDetail, loadStoryReadModelCatalog, loadStoryReadModelLanding, loadStoryReadModelDetail,
  goBackFromStoryCatalog, goBackFromStoryDetail, goBackFromStoryCollection,
  invalidateStoryNavigation, normalizeStoryRoute, prepareStoryRoute,
} = useStoryNavigation({
  view, loading, detailSourceRoute, filterQuery, currentStoryDomain, currentCharacterId, currentStoryMode, currentStorySection, currentStoryFile,
  storyDetailParentView, storyCollectionParentView, currentEventScope, currentStoryAvailability, currentStorySort,
  currentMobileMode, currentMobileScenarioId, storyVisibleLimit, currentCategoryId, currentSongId, currentStory,
  collectionReadModelCatalog, collectionReadModelDetail, collectionReadModelStatus,
  storyReadModelCatalog, storyReadModelDetail, storyReadModelStatus, storyCatalogIndex, storyCatalogLanding,
  navigation, archiveBootstrap, readModelClient, prepareArchivePage, captureDetailSource, commitView, commitArchiveSelection,
  goHome, openEventDetail: (...args) => openEventDetail(...args), openIdolStoryArchive, openStoryPhone, loadScenario, startEpisodeQueue,
  openStoryReader: (...args) => openStoryReader(...args),
  idolStoryChapterOwner, openIdolStoryChapter,
})

const {
  openArchiveUnit, openUnitFromIdol, openUnitMember, openUnitStory,
  openUnitEvent, loadUnitCatalog, loadUnitDetail, unitCatalogEntries,
  currentArchiveUnit, currentArchiveUnitEntry, currentArchiveUnitMembers, currentArchiveUnitStories,
  currentArchiveUnitSongs, prepareUnitRoute, invalidateUnitNavigation,
} = useUnitNavigation({
  unitReadModelCatalog, unitReadModelDetail, unitReadModelStatus, currentArchiveUnitCode,
  currentEventId, eventParentView, currentCategoryId, currentCharacterId,
  loading, navigation, archiveBootstrap, readModelClient,
  prepareArchivePage, captureDetailSource, commitView, openIdolReadModel,
  loadScenario, openEventDetail: (...args) => openEventDetail(...args),
})

const {
  loadCardFacets, loadCardCatalog, loadCardDetail, openUnitCards,
  openPrimaryCards, openCard, selectCardIdol, goBackToCards,
  openCardIdol, openRelatedCard, openCollectionCard, goBackFromCards,
  openCardScenario, openCardEvent, openCardGasha, currentCards,
  cardRarityTabs, filteredCards, filteredCardRows, currentCard,
  currentCardOwnerReference, currentCardAssetStatus, currentCardEventRelation, currentCardGashaRelation,
  currentCardLimitbreakMaterial, currentCardIndex, previousCard, nextCard,
  currentSeriesCards, currentCardCharacterName, prepareCardRoute, invalidateCardNavigation,
} = useCardNavigation({
  cardReadModelCatalog, cardReadModelDetail, cardReadModelStatus, currentCharacterId,
  currentCardId, currentCardRarity, currentCardAttribute, currentCardAssetState,
  currentCardRelationState, filterQuery, currentArchiveUnit, unitReadModelStatus,
  currentCategoryId, currentArchiveUnitCode, currentIdolUnitFilter, currentGroup,
  detailSourceRoute, currentEventId, eventParentView, view,
  loading, navigation, archiveBootstrap, readModelClient,
  prepareArchivePage, captureDetailSource, commitView, restoreDetailSource,
  commitArchiveSelection, openIdolReadModel, loadScenario, openEventDetail: (...args) => openEventDetail(...args),
  openGasha: (...args) => openGasha(...args), idolDisplayName, idolSourceName, archiveNamedSearchText,
  fetch: (...args) => fetch(...args),
})

watch(view,nextView=>{
  if (nextView === 'idols') void loadUnitCatalog().catch(error=>console.warn('Unit display metadata unavailable',error));
  if (['portal','cards','card_detail','story_catalog','story_detail','mobile_archive','home'].includes(nextView)) {
    void loadArchiveNames('cards').catch(error=>console.warn('Card name translations unavailable',error));
  }
},{immediate:true});

const {
  openGashaCatalog, openGasha, goBackFromGasha, openGashaCard,
  loadGashaCatalog, loadGashaDetail, gashaCatalog, gashaCategoryOptions,
  filteredGashas, currentGasha, prepareGashaRoute, invalidateGashaNavigation,
} = useGashaNavigation({
  gashaReadModelCatalog, gashaReadModelDetail, gashaReadModelStatus, gashaCatalogFunctions,
  currentGashaId, currentGashaCategory, gashaParentView, currentStoryDomain,
  currentStoryCollection, cardReadModelCatalog, currentCategoryId, currentCharacterId,
  currentCardId, filterQuery, detailSourceRoute, view,
  loading, navigation, archiveBootstrap, readModelClient,
  prepareArchivePage, captureDetailSource, commitView, loadCardCatalog,
  openCard, idolEntitySearchText,
})
const {
  openEventDetail, goBackFromEvent, playCurrentEvent, playCurrentEventEpisode,
  openEventCard, openEventIdol, openEventUnit, loadEventCatalog,
  loadEventDetail, currentEventProjection, currentEvent, currentEventEpisodes,
  currentEventExternalResources, prepareEventRoute, invalidateEventNavigation,
} = useEventNavigation({
  eventReadModelCatalog, eventReadModelDetail, eventReadModelStatus, view,
  loading, currentEventId, eventParentView, detailSourceRoute,
  currentCharacterId, cardReadModelCatalog, currentCard, currentArchiveUnit,
  externalStoryResourcesData, navigation, archiveBootstrap, readModelClient,
  prepareArchivePage, captureDetailSource, commitView, restoreDetailSource,
  openStoryCatalog, startEpisodeQueue, loadScenario, loadCardCatalog,
  openCard, openIdolReadModel, openArchiveUnit,
})

const {
  readingState, chapterReadingState, readingPlaybackNotice, readingCatalogEntries, readingChapterNavigation, chapterReadingSession,
  loadSynopsisReadingDocument, openStoryReader, refreshStoryReader, openCollectionReader,
  selectReaderDocument, selectReaderChapter, locateChapterReadingRow, playChapterReadingSegment,
  closeStoryReader, returnToReader, openEventReader, openIdolStoryReader, openWorkReader, openSeasonalReader,
  openReaderPlayback, updateReadingMode, locateReadingRow, resolveReaderContinuationSource,
  applyReaderRoute, loadReaderQueue,
} = useReaderNavigation({
  view, readingDocumentId, readingRowId, readingMode, readingRevision, readingScope,
  currentStoryDomain, currentStorySection, currentEpisodeId, currentStoryFile, currentWorkMode, currentCharacterId,
  currentEventId, eventParentView, currentCategoryId, currentArchiveUnitCode, detailSourceRoute, currentScenarioFile,
  loading, loadingPurpose, collectionReadModelDetail, storyReadModelDetail, eventReadModelDetail,
  workReadModelDetail, idolStoryReadModelDetail, currentStoryCollection, currentStory, currentEventProjection,
  currentWorkIdol, currentIdolStoryPage, navigation, archiveBootstrap, readModelClient, playbackController, playbackError,
  applyArchiveRoute, syncArchiveRoute, currentArchiveRoute, restoreDetailSource, openStoryCatalog, loadCollectionDetail, loadPlayerQueue,
  loadSeasonalLedger: () => loadSeasonalLedgerOnly(),
  seasonalParticipantName: participant => (participant.participant_type === 'idol' && idolDisplayName(participant.participant_code, participant.display_name)) || participant.display_name,
})
const pickerPreparing = ref(false)
let pickerRequest = 0
const playbackFailure = ref(null)
watch(() => Boolean(playbackError.value || playbackReadiness.value?.status === 'blocked') && !loading.value, async open => {
  if (!open) return
  await nextTick()
  playbackFailure.value?.querySelector('button')?.focus()
}, { flush:'post' })

const archiveShellVisible = computed(() => !['__boot__', 'player', 'spine_lab', 'chibi_stage', 'chart_lab', 'picture_studio'].includes(view.value))

const {
  currentSong, currentSongPresentation, chartSongs,
  loadSongCatalog, ensureSongCatalog, loadSongDetail,
  openSongCatalog, openSong, openSongUnit, openSongIdol, openSongRelatedStory,
  openChartLab, openChartTool, selectChartSong, closeChartTool, goBackFromSong,
  invalidateSongNavigation, prepareSongRoute,
} = useSongNavigation({
  view, currentSongId, currentSongScope, songParentView, currentCharacterId, currentCategoryId, filterQuery, detailSourceRoute,
  songReadModelCatalog, songReadModelDetail, songReadModelStatus, currentArchiveUnit, archiveBootstrap, readModelClient, navigation,
  captureDetailSource, commitView, restoreDetailSource, goHome, openArchiveUnit, openPrimaryIdol, openProjectedCollection,
})
const { stageAudioExperiments, stageOriginalSlotOrdered, stageOriginalPerformers, stageSongDirectory } = useStageSongProjection({
  songReadModelDetail, currentSongId, view, songReadModelCatalog,
})

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
  collection: view.value === 'collection_catalog' ? currentCollectionState.value : undefined,
}))

const archiveTitle = computed(() => {
  if (view.value === 'reader') return '剧情阅读'
  if (view.value === 'portal') return '我的资料馆'
  if (view.value === 'home') return 'SideM Archive'
  if (view.value === 'experiments') return '工具'
  if (view.value === 'about') return '关于本站'
  if (view.value === 'archive_status') return '数据状态'
  if (view.value === 'collection_catalog') return currentCollectionState.value.kind === 'honors' ? '称号' : '道具'
  if (view.value === 'photo_catalog') return '摄影资料'
  if (view.value === 'picture_studio') return '摄影工作台'
  if (view.value === 'event_catalog') return '活动一览'
  if (view.value === 'story_catalog') {
    if (currentStoryMode.value === 'portal' && currentStoryDomain.value === 'main') return '主线剧情'
    if (currentStoryMode.value === 'portal' && currentStoryDomain.value === 'extra') return '额外剧情'
    if (currentStoryMode.value === 'portal' && currentStoryDomain.value === 'birthday') return '生日剧情'
    return '故事目录'
  }
  if (view.value === 'external_story_resources') return '社区中文剧情'
  if (view.value === 'story_detail') return currentStory.value?.title || '故事详情'
  if (view.value === 'story_collection') return storyCollectionTitle(currentStoryCollection.value, idolDisplayName) || '故事章节'
  if (view.value === 'seasonal_campaign') return '季节企划'
  if (view.value === 'work_archive') return `${currentWorkIdol.value ? idolDisplayName(currentWorkIdol.value.idol_code, currentWorkIdol.value.display_name) : ''} 工作档案`.trim()
  if (view.value === 'idol_story_archive') return `${currentIdolStoryPage.value ? idolDisplayName(currentIdolStoryPage.value.idol_code, currentIdolStoryPage.value.idol_name) : ''} 个人故事`.trim()
  if (view.value === 'mobile_archive') return '通信'
  if (view.value === 'gashas') return '卡池档案'
  if (view.value === 'gasha_detail') return gashaCatalogFunctions.value?.translatedGashaName(currentGasha.value?.display_name,uiLocale.value) || '卡池详情'
  if (view.value === 'song_catalog') return '歌曲档案'
  if (view.value === 'song_detail') return currentSong.value?.title || '歌曲详情'
  if (view.value === 'event_detail') return currentEvent.value?.title || '活动详情'
  if (view.value === 'unit_catalog') return '组合资料'
  if (view.value === 'unit_detail') return currentArchiveUnit.value?.unit_name || '组合详情'
  if (view.value === 'idols') return categoryHeaderText.value
  if (view.value === 'idol_detail') return currentIdolDisplayName.value || '偶像详情'
  if (view.value === 'groups') return groupTitle.value
  if (view.value === 'cards') return currentCardCharacterName.value
  if (view.value === 'card_detail') return archiveNamedText('card',currentCard.value?.title,'title') || '卡片详情'
  if (view.value === 'episode_zero_units') return '第零话'
  if (view.value === 'episodes') return currentUnit.value?.unit_name || '章节'
  if (view.value === 'files') return currentGroup.value?.title || '剧情文件'
  return 'SideM Archive'
})

const archiveSearchable = computed(() => ['idols', 'groups', 'cards', 'gashas', 'files'].includes(view.value))

const archiveSearchPlaceholder = computed(() => {
  if (view.value === 'idols') return categoryFilterPlaceholder.value
  if (view.value === 'cards') return '搜索卡片标题或稀有度'
  if (view.value === 'gashas') return '搜索卡池名称、卡片或偶像'
  if (view.value === 'groups') return '搜索章节标题'
  if (view.value === 'files') return '搜索剧情标题'
  if (view.value === 'story_catalog') return '搜索剧情标题或角色'
  return '搜索资料'
})

const archiveShowBack = computed(() => view.value === 'home' ? Boolean(homeFrom.value) : (view.value !== 'portal' || Boolean(portalFrom.value)))

const archiveBreadcrumbs = computed(() => {
  const route = currentArchiveRoute()
  const entityByView = {
    idol_detail: {
      title: currentIdolDisplayName.value,
      id: currentCharacterId.value,
    },
    unit_detail: {
      title: currentArchiveUnit.value?.unit_name,
      id: currentArchiveUnitCode.value,
    },
    card_detail: {
      title: archiveNamedText('card',currentCard.value?.title,'title'),
      id: currentCardId.value,
    },
    gasha_detail: {
      title: gashaCatalogFunctions.value?.translatedGashaName(currentGasha.value?.display_name,uiLocale.value),
      id: currentGashaId.value,
    },
    event_detail: {
      title: currentEvent.value?.title,
      id: currentEventId.value,
    },
    story_collection: {
      title: storyCollectionTitle(currentStoryCollection.value, idolDisplayName),
      id: currentStorySection.value,
      domainLabel: currentStoryCollection.value?.domainLabel,
    },
    story_detail: {
      title: currentStory.value?.title,
      id: currentStoryFile.value,
      domainLabel: currentStory.value?.domainLabel,
    },
    seasonal_campaign: {
      title: currentSeasonalCampaign.value ? `${currentSeasonalCampaign.value.year} ${SEASONAL_SEASON_LABEL[currentSeasonalCampaign.value.season] || ''}`.trim() : '季节企划',
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

// A source (Japanese) idol name as it appears inside game text, shown in the reader's language.
const idolCodeBySourceName = computed(() => new Map(Object.entries(bootstrapIdolDictionary.by_idol_code || {})
  .map(([code, row]) => [String(row.display_name || '').replace(/\s+/g, ''), code])))
function idolDisplayNameFromSource(sourceName) {
  const code = idolCodeBySourceName.value.get(String(sourceName || '').replace(/\s+/g, ''))
  return code ? idolDisplayName(code, sourceName) : sourceName
}

function idolDisplayName(id, fallbackSourceName = '') {
  const sourceName = idolSourceName(id, fallbackSourceName)
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
  const context = activeArchiveViewContext
  const revision = ++archiveViewRestoreRevision
  const navigationRevision = navigation.getRevision()
  pendingSongDetailRestore = null
  pendingPortalRestore = restore && view.value === 'portal' ? {context,revision,navigationRevision} : null
  pendingEventCatalogRestore = restore && view.value==='event_catalog'
    ? {context:activeArchiveViewContext,revision,navigationRevision:navigation.getRevision()} : null
  pendingPhotoCatalogRestore = restore && view.value==='photo_catalog'
    ? {context:activeArchiveViewContext,revision,navigationRevision:navigation.getRevision()} : null
  if (!restore) return
  if (view.value === 'portal') { nextTick(restorePortalPosition); return }
  if (view.value === 'song_detail') {
    pendingSongDetailRestore = { context, revision, navigationRevision, songId: currentSongId.value }
    nextTick(() => restoreSongDetailView())
    return
  }
  nextTick(() => {
    const isCurrent = () => context === activeArchiveViewContext && revision === archiveViewRestoreRevision &&
      navigationRevision === navigation.getRevision() && !navigation.isDisposed()
    if (!isCurrent()) return
    restoreArchiveViewState(context, { isCurrent }).catch(error => {
      console.error('[ArchiveNavigation] Failed to restore view position:', error)
    })
  })
}

async function restorePortalPosition() {
  const pending = pendingPortalRestore
  if (!pending || portalData.overview.value.loading || portalData.search.value.loading) return
  const isCurrent = () => pending === pendingPortalRestore && pending.context === activeArchiveViewContext && pending.revision === archiveViewRestoreRevision && pending.navigationRevision === navigation.getRevision() && view.value === 'portal' && !navigation.isDisposed()
  await nextTick()
  if (!isCurrent()) return
  await restoreArchiveViewState(pending.context, {isCurrent})
  if (isCurrent()) pendingPortalRestore = null
}
watch([() => portalData.overview.value.loading, () => portalData.search.value.loading], () => { void restorePortalPosition() })

async function restoreSongDetailView({ songId } = {}) {
  const pending = pendingSongDetailRestore
  const component = songDetailView.value
  if (!pending || pending.running || (songId && songId !== pending.songId) ||
      typeof component?.prepareRestoreFocus !== 'function') return false
  const isCurrent = () => pending === pendingSongDetailRestore && component === songDetailView.value &&
    pending.context === activeArchiveViewContext && pending.revision === archiveViewRestoreRevision &&
    pending.navigationRevision === navigation.getRevision() && !navigation.isDisposed() &&
    view.value === 'song_detail' && currentSongId.value === pending.songId
  if (!isCurrent()) return false
  pending.running = true
  try {
    const saved = readArchiveViewRestoration(pending.context)
    if (!saved) return false
    await component.prepareRestoreFocus({ focusId: saved.focusId, songId: pending.songId, isCurrent })
    if (!isCurrent()) return false
    return await restoreArchiveViewState(pending.context, { isCurrent })
  } catch (error) {
    console.error('[ArchiveNavigation] Failed to restore song detail position:', error)
    return false
  } finally {
    if (pending === pendingSongDetailRestore) pendingSongDetailRestore = null
  }
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
    filterQuery, currentIdolUnitFilter, currentCardRarity, currentCardAttribute, currentCardAssetState,
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
  const scenario = translatedVoicePreview(card, cue)
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
        { startStep: route.startStep, endStep: route.endStep, initialStep: route.initialStep, entryIntent: route.playMode },
        [], intent, destination)
    }
    if (route.view === 'reader' || (route.view === 'player' && route.returnView === 'reader')) {
      return applyReaderRoute(route, intent)
    }
    if (route.view === 'portal') {
      portalFrom.value = route.portalFrom || ''
      portalScope.value = route.portalScope === 'all' || archiveBootstrap.idols.some(row => row.id === route.portalScope) ? route.portalScope : userPreferences.value.portalDefaultScope === 'all' ? 'all' : ''
      portalQuery.value = route.portalQuery || ''
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
      // Old links to a phone call as a "card story" land on the call in the communication archive.
      if (route.view === 'story_detail' && detail.story.domain === 'card_scenarios') return openStoryPhone(detail.story)
      if (route.view === 'story_detail' && idolStoryChapterOwner(detail.story)) return openIdolStoryChapter(detail.story)
      storyReadModelDetail.value = detail
      route = { ...route, storyType: detail.story.domain, storySection: detail.story.sectionId || '' }
    }
    if (!intent.isCurrent()) return
    filterQuery.value = route.query || ''
    const idolOwnerView = route.view === 'player' ? route.returnView : route.view
    const validRouteIdol = !route.idol || (['groups', 'files'].includes(idolOwnerView) && aliasRoute?.groups
      ? true : ['idol_detail', 'cards', 'card_detail', 'work_archive', 'idol_story_archive', 'mobile_archive', 'story_collection', 'song_catalog', 'story_catalog', 'event_catalog'].includes(idolOwnerView)
      ? archiveBootstrap.idols.some(idol => idol.id === route.idol)
      // The seasonal ledger also lists the two office staff, who are not archive idols, and the shared openings.
      : idolOwnerView === 'seasonal_campaign' ? /^(?:[0-9]{3}[a-z]{3}|common)$/.test(route.idol)
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
    currentEventBrowseState.value = normalizeEventBrowseState(route.eventBrowse)
    currentEntityKey.value = route.entity || ''
    currentCollectionState.value = route.collection || {kind:'items',category:'',idol:'',unit:'',attribute:'',page:0}
    currentPhotoIdol.value = route.photoIdol || ''
    currentPhotoEntity.value = route.photoEntity || ''
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
    currentCardAttribute.value = route.cardAttribute || 'all'
    currentCardAssetState.value = route.assetState || 'all'
    currentCardRelationState.value = route.relationState || 'all'
    currentIdolUnitFilter.value = route.unitFilter || ''
    currentStoryDomain.value = route.storyType || ''
    currentStoryMode.value = route.view === 'story_catalog' && currentCharacterId.value ? 'search' : route.storyMode || 'portal'
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
    homeFrom.value = route.view === 'home' ? route.homeFrom || '' : ''
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
    if (route.view === 'chibi_stage') {
      await chibiStageViewerLoader()
      void ensureSongCatalog()
    }

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
    else if (route.view === 'seasonal_campaign' && !currentSeasonalPage.value) view.value = 'story_catalog'
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
  currentCardAttribute.value = 'all'
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

function openPortalDirectory({ domain, idolCode = '', rarity = '', attribute = '' } = {}) {
  if (view.value !== 'portal' || !['cards','songs','stories','events'].includes(domain)) return
  if (idolCode && !archiveBootstrap.idols.some(row => row.id === idolCode)) return
  captureDetailSource()
  currentStoryDomain.value = ''; currentStorySection.value = ''; currentStoryFile.value = ''
  currentStoryMode.value = 'portal'; currentStoryAvailability.value = 'all'; currentStorySort.value = 'domain'
  currentEventScope.value = 'all'; currentSongScope.value = 'all'
  currentCardRarity.value = 'all'; currentCardAttribute.value = 'all'
  currentCardAssetState.value = 'all'; currentCardRelationState.value = 'all'
  if (domain === 'cards') return openPrimaryCards(idolCode, { rarity, attribute })
  if (domain === 'songs') return openSongCatalog({ idolCode })
  if (domain === 'stories') return openStoryCatalog({ idolCode, mode: 'search' })
  return openDomainCatalog('events', { idolCode })
}

function clearCatalogIdol() {
  navigation.invalidate()
  currentCharacterId.value = ''
  currentStoryAvailability.value = 'all'
  storyVisibleLimit.value = 80
  currentEventBrowseState.value = { ...currentEventBrowseState.value, page: 0 }
  syncArchiveRoute({ replace: true })
}

function navigateArchiveSection(section) {
  if (section !== 'gashas') gashaReadModelStatus.value = ''
  if (section === 'portal') {
    loading.value = false
    return openArchivePortal()
  }
  if (!['home', 'stories', 'songs', 'idols', 'gashas', 'cards', 'resources', 'interactions','events','collections','honors','photos','experiments','about'].includes(section)) return
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
  else if (section === 'experiments') { filterQuery.value = ''; commitView('experiments') }
  else if (section === 'about') { filterQuery.value = ''; commitView('about') }
  else if (section === 'resources') openArchiveStatus()
  else if (['events','collections','honors','photos'].includes(section)) openDomainCatalog(section)
}

function openDomainCatalog(section, { idolCode = '' } = {}) {
  currentEventBrowseState.value=normalizeEventBrowseState()
  currentCollectionState.value={kind:section==='honors'?'honors':'items',category:'',idol:'',unit:'',attribute:'',page:0}
  filterQuery.value = ''; currentEntityKey.value = ''; currentPhotoIdol.value = ''; currentPhotoEntity.value = ''
  currentEventId.value = ''; currentCategoryId.value = ''; currentCharacterId.value = idolCode
  commitView(({events:'event_catalog',collections:'collection_catalog',honors:'collection_catalog',photos:'photo_catalog'})[section])
}
function openCollectionEntity(key) {
  if (!key && view.value==='collection_catalog') {currentEntityKey.value='';syncArchiveRoute({replace:true});return}
  if (!/^(item|honor):\d+$/.test(key || '')) return
  if (view.value !== 'collection_catalog') {captureDetailSource();filterQuery.value='';currentCollectionState.value={kind:key.startsWith('honor:')?'honors':'items',category:'',idol:'',unit:'',attribute:'',page:0}}
  currentEntityKey.value=key; currentEventId.value=''; currentCharacterId.value=''; currentCategoryId.value=''
  commitView('collection_catalog')
}
function updateCollectionBrowse(next) {
  if(next.kind!==currentCollectionState.value.kind){currentEntityKey.value='';filterQuery.value=''}
  currentCollectionState.value=next
  syncArchiveRoute({replace:true})
}
function updateEventBrowse(next) {
  currentEventBrowseState.value=normalizeEventBrowseState(next)
  syncArchiveRoute({replace:true,restoreView:false})
}
function updateEventCatalogQuery(query) {
  updateArchiveFilter('filterQuery',query)
  currentEventBrowseState.value={...currentEventBrowseState.value,page:0}
  syncArchiveRoute({replace:true,restoreView:false})
}
async function onEventCatalogReady() {
  const pending=pendingEventCatalogRestore
  pendingEventCatalogRestore=null
  if(!pending)return
  await nextTick()
  if(view.value!=='event_catalog'||pending.context!==activeArchiveViewContext||pending.revision!==archiveViewRestoreRevision||pending.navigationRevision!==navigation.getRevision()||navigation.isDisposed())return
  return restoreArchiveViewState(pending.context).catch(error=>{
    console.error('[ArchiveNavigation] Failed to restore event directory position:',error)
  })
}
const { selectPhotoIdol, updatePhotoCatalogQuery, selectPhotoEntity, openPictureStudio } = usePhotoCatalogNavigation({
  view, currentPhotoIdol, currentPhotoEntity, filterQuery, syncArchiveRoute, captureDetailSource, commitView,
})

async function onPhotoCatalogReady() {
  const pending=pendingPhotoCatalogRestore
  pendingPhotoCatalogRestore=null
  if(!pending)return
  await nextTick()
  if(view.value!=='photo_catalog'||pending.context!==activeArchiveViewContext||pending.revision!==archiveViewRestoreRevision||pending.navigationRevision!==navigation.getRevision()||navigation.isDisposed())return
  return restoreArchiveViewState(pending.context).catch(error=>{
    console.error('[ArchiveNavigation] Failed to restore photo directory position:',error)
  })
}

async function openDomainTarget(target){
  if(target?.view==='card_detail' && /^[a-z0-9_]+$/.test(target.card || ''))return openEventCard({card_resource_id:target.card})
  if(target?.view==='photo_catalog' && /^(spots|scenes|stickers|frames|filters):\d+$/.test(target.photoEntity || '')){captureDetailSource();currentPhotoIdol.value='';currentPhotoEntity.value=target.photoEntity;currentEventId.value='';currentCharacterId.value='';currentCategoryId.value='';filterQuery.value='';commitView('photo_catalog')}
}

function storeUserPreferences(next) {
  const result = saveArchiveUserPreferences({ ...userPreferences.value, ...next })
  userPreferences.value = result.preferences
  userPreferenceNotice.value = result.issue
  return result.preferences
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

// First visit: the archive is the default start; the onboarding sheet records the producer
// name (stored by its own field), a favourite idol, and may send the visitor to that idol's home.
function completeOnboarding({ preferredIdol = '', openHome = false } = {}) {
  const idol = archivePickerIdols.value.some(row => row.id === preferredIdol) ? preferredIdol : ''
  const next = { onboardingComplete: true }
  if (userPreferences.value.startupPage === 'unset') next.startupPage = 'portal'
  if (idol) next.preferredIdol = idol
  if (idol && validArchiveHomeIdols.value.includes(idol)) next.startupIdol = idol
  storeUserPreferences(next)
  if (openHome && next.startupIdol) openGameHome(idol)
}

function chooseImmersiveIdol({ idolCode, rememberStartup = true, setPreferred = false, homeMode = 'spine' } = {}) {
  const isGeneralPicker = view.value === 'idol_picker' && currentPickTarget.value !== 'home'
  if (!(isGeneralPicker ? archivePickerIdols.value : archiveHomeIdols.value).some(idol => idol.id === idolCode)) return
  const next = {}
  if (rememberStartup || currentPickTarget.value === 'home' || (view.value === 'home' && !homeSelectedId.value)) {
    Object.assign(next, { startupIdol: idolCode, onboardingComplete: true })
    if (rememberStartup) Object.assign(next, { startupPage: 'home', homeMode })
  }
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

function selectHomeIdol(idolCode) {
  if (!archiveHomeIdols.value.some(idol => idol.id === idolCode)) return
  homeSelectedId.value = idolCode
  storeUserPreferences({ startupIdol: idolCode })
}

function savePreferredIdol(idolCode) {
  if (idolCode && !archivePickerIdols.value.some(idol => idol.id === idolCode)) return
  const preferredIdol = idolCode || null
  storeUserPreferences({ preferredIdol })
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
  if (['idol_picker', 'welcome'].includes(view.value)) openRootPortal()
}

function openPreferredDestination(request) {
  const destination = typeof request === 'string' ? request : request?.action
  const idolCode = typeof request === 'string' ? preferredArchiveIdol.value?.id : request?.idolCode
  if (!idolCode || !archiveBootstrap.idols.some(row => row.id === idolCode)) return
  if (destination === 'profile') return openIdolReadModel(idolCode, { captureSource: true, resetContext: true })
  if (destination === 'cards') captureDetailSource()
  if (destination === 'cards') openPrimaryCards(idolCode)
  else if (destination === 'work') openWorkArchive(idolCode)
  else if (destination === 'story') openIdolStoryArchive(idolCode)
  else if (destination === 'mobile') openMobileArchive({ idolCode, mode: 'personal' })
}

const { openArchivePortal, closeArchivePortal } = usePortalNavigation({
  view, homeSelectedId, homeVisits, currentArchiveRoute, archiveShellVisible, legacyEntryStatus, archiveBootstrap,
  portalScope, portalFrom, commitView, navigation, applyArchiveRoute, syncArchiveRoute,
  loadHomeIdol, loadIdolDetail, idolReadModelDetail, loadUnitCatalog, loadUnitDetail, unitReadModelDetail,
  loadGashaCatalog, loadGashaDetail, gashaReadModelDetail, loadCardCatalog, loadCardDetail, cardReadModelDetail,
  loadEventDetail, eventReadModelDetail, loadSeasonalDetail, seasonalReadModelDetail, loadWorkDetail, workReadModelDetail,
  loadIdolStoryDetail, idolStoryReadModelDetail, loadCollectionDetail, collectionReadModelDetail, loadStoryReadModelDetail, storyReadModelDetail,
  ensureSongCatalog, loadSongDetail, songReadModelDetail,
})

function openHomeIdol(idolId) {
  currentCategoryId.value = 'idol'
  openIdol({ id: idolId })
}

function openHomeCards(idolId) {
  return openPrimaryCards(idolId, { captureSource: true })
}

// The home dialogue's card link: the card page, scrolled to that touch voice. The mark lasts
// while the reader stays on the card (including its voice previews), not as part of the route.
const homeCardFocus = ref({ card: '', voice: '' })
watch(view, next => { if (!['card_detail', 'player'].includes(next)) homeCardFocus.value = { card: '', voice: '' } })
function openHomeCard({ idolId, cardId, voice }) {
  homeCardFocus.value = { card: cardId, voice }
  return openCard({ resource_id: cardId, character_id: idolId }, { resetContext: true, captureSource: true })
}

function openHomeChat(idolId) {
  openMobileArchive({ idolCode: idolId, mode: 'personal' })
}

function goArchiveBack() {
  if (view.value === 'home' && homeFrom.value) return closeHomeVisit()
  if (view.value === 'reader') return closeStoryReader()
  if (view.value === 'portal') return closeArchivePortal()
  if (view.value === 'welcome' || view.value === 'idol_picker') return cancelWelcomeOrPicker()
  if (detailSourceRoute.value) return restoreDetailSource(goHome)
  const backByView = {
    event_catalog:goHome,
    collection_catalog:goHome,
    photo_catalog:goHome,
    picture_studio:()=>commitView('photo_catalog'),
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
    song_detail: goBackFromSong,
    event_detail: goBackFromEvent,
    archive_status: goHome,
    story_catalog: goBackFromStoryCatalog,
    external_story_resources: openStoryCatalog,
    story_detail: goBackFromStoryDetail,
    story_collection: goBackFromStoryCollection,
    seasonal_campaign: goBackFromSeasonalCampaign,
    work_archive: goBackFromWorkArchive,
    idol_story_archive: goBackFromIdolStoryArchive,
    mobile_archive: goBackFromMobileArchive,
    unit_catalog: () => commitView('idols'),
    unit_detail: () => {
      currentArchiveUnitCode.value = ''
      commitView('unit_catalog')
    },
  }
  const handler = backByView[view.value] || goHome
  handler()
}

function closeFullScreenExperiment() {
  if (view.value === 'chart_lab') return closeChartTool()
  if (detailSourceRoute.value) return restoreDetailSource(goHome)
  commitView('photo_catalog')
}

const { openSongStage, openSpineLab, openChibiStage, closeArchiveExperiment, updateStageTarget } = useStageNavigation({
  view, currentSongId, detailSourceRoute, stageTargetId, stageHandoff, songReadModelDetail,
  loading, loadingPurpose, preloadProgress, navigation, captureDetailSource, commitView, restoreDetailSource, goHome,
  syncArchiveRoute, spineViewerLoader, chibiStageViewerLoader, loadSongDetail, ensureSongCatalog,
})

const { openArchiveStatus, loadResourceStatus, invalidateResourceNavigation } = useResourceNavigation({
  resourceReadModelDetail, resourceReadModelStatus, view, loading,
  detailSourceRoute, filterQuery, currentStoryDomain, currentEventScope,
  currentStoryAvailability, currentStorySort, navigation, archiveBootstrap,
  readModelClient, prepareArchivePage, commitView,
})

function openIdol(entry) {
  if (currentCategoryId.value !== 'cards') return openIdolReadModel(entry.id, { captureSource: true })
  captureDetailSource()
  filterQuery.value = ''
  currentCharacterId.value = entry.id
  currentCardId.value = ''
  currentCardRarity.value = 'all'
  currentCardAttribute.value = 'all'
  currentCardAssetState.value = 'all'
  currentCardRelationState.value = 'all'
  commitView('cards')
}

function openIdolDomain(domain) {
  if(domain==='photos' && currentIdolDetail.value?.photo){captureDetailSource();currentPhotoIdol.value=String(currentIdolDetail.value.photo.idolId);currentPhotoEntity.value='';currentEventId.value='';currentCharacterId.value='';currentCategoryId.value='';filterQuery.value='';commitView('photo_catalog');return}
  if (domain === 'cards') return openPrimaryCards(currentCharacterId.value, { captureSource: true })
  if (domain === 'stories') {
    openIdolStoryArchive(currentCharacterId.value)
    return
  }
  if (domain === 'seasonal') return openSeasonalCampaign('', currentCharacterId.value)
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
  if (['song_detail', 'chart_lab'].includes(route.view) && route.song) songReadModelDetail.value = await loadSongDetail(route.song)
  if (navigation.isDisposed() || beforeLoad !== navigation.getRevision()) return
  const pending = applyArchiveRoute(route, { restoring: false })
  const revision = navigation.getRevision()
  return pending.then(() => {
    if (navigation.getRevision() === revision) syncArchiveRoute()
  })
}

async function openPortalResult(result) {
  if (view.value !== 'portal' || !result?.target) return
  const target = result.target, sourceRevision = navigation.getRevision()
  const stillHere = () => view.value === 'portal' && sourceRevision === navigation.getRevision() && !navigation.isDisposed()
  try {
    if (target.domain === 'units' && target.view === 'unit_detail' && archiveBootstrap.idols.some(row => row.unitCode === target.unitCode)) {
      return openArchiveUnit({unit_code: target.unitCode})
    } else if (target.view === 'story_gateway') {
      if (target.gateway === 'idol_story') return openIdolStoryArchive()
      if (target.gateway === 'work') return openWorkArchive()
      if (target.gateway === 'seasonal_campaign') return openSeasonalCampaign()
      if (['birthday','extra'].includes(target.gateway)) {
        captureDetailSource()
        return openStoryCatalog({domain:target.gateway})
      }
    } else if (target.domain === 'collections' && target.view === 'story_collection') {
      const rows = await loadCollectionCatalog()
      if (stillHere() && rows.some(row => row.id === target.collectionId && row.chapterCount > 0)) return openProjectedCollection({domain: target.storyDomain, section: target.sectionId})
    } else if (target.domain === 'cards' && target.view === 'card_detail') {
      const rows = await loadCardCatalog()
      if (!stillHere()) return
      const card = rows.find(row => row.resource_id === target.cardId && row.character_id === target.idolCode)
      if (card) return openCard(card, { resetContext: true, captureSource: true, clearEventContext: true })
    } else if (target.domain === 'songs' && target.view === 'song_detail') {
      const catalog = await loadSongCatalog()
      if (stillHere() && catalog.songs[target.songCode]) return openSong(target.songCode)
    } else if (target.domain === 'idols' && target.view === 'idol_detail' && archiveBootstrap.idols.some(row => row.id === target.idolCode)) {
      return openIdolReadModel(target.idolCode, { captureSource: true, resetContext: true, clearEventContext: true })
    } else if (target.domain === 'stories' && target.view === 'story_detail') {
      if (stillHere()) return openStoryDetail({ file: target.file, domain: target.storyDomain }, 'portal')
    } else if (target.domain === 'events' && target.view === 'event_detail') {
      const rows = await loadEventCatalog()
      if (stillHere() && rows.some(row => String(row.id) === target.eventId)) return openEventDetail({ event_id: target.eventId }, 'portal')
    }
  } catch (error) {
    if (stillHere()) userPreferenceNotice.value = '该资料暂时无法打开，请重试。'
  }
}

async function openPortalStage(target) {
  if (view.value !== 'portal' || !target?.songCode || !target?.choreographyId) return
  const sourceRevision = navigation.getRevision()
  try {
    const [catalog, manifest] = await Promise.all([loadSongCatalog(), fetchSongTimelineManifest()])
    if (view.value !== 'portal' || sourceRevision !== navigation.getRevision() || navigation.isDisposed()) return
    const entry = manifest.songs[target.songCode]?.find(row => row.id === target.choreographyId && ['choreography_candidate', 'special_single'].includes(row.stageKind))
    if (catalog.songs[target.songCode] && entry) return openChibiStage({ songCode: target.songCode, choreographyId: entry.id })
  } catch (error) {
    if (view.value === 'portal' && sourceRevision === navigation.getRevision()) userPreferenceNotice.value = '舞台资料暂时无法打开，请重试。'
  }
}

// A personal-story chapter belongs to its owner's story page (episodes, small talks, follow-up
// call), so catalog, search and portal links land on that chapter instead of a generic detail.
// The owner comes from the file name: a birthday chapter's cast can list another idol first.
function idolStoryChapterOwner(story) {
  const idolCode = story?.domain === 'idol_story' ? communicationOwnerId(story.file) : ''
  return archiveBootstrap.idols.some(idol => idol.id === idolCode) ? idolCode : ''
}
function openIdolStoryChapter(story) {
  return openBirthdayIdolStory({ idolCode: idolStoryChapterOwner(story), compiledFile: story.file })
}

async function previewCardVoice(cue) {
  const card = currentCard.value
  if (!card || !cue) return
  await openVoicePreview(card, cue, 'card_detail')
}

function startEpisodeQueue(episodes, index, returnView, options = {}) {
  return playbackController.startQueue(episodes, index, returnView, { ...options, continuation: returnView === 'story_collection' ? selectCollectionContinuation(currentStoryCollection.value, episodes[index]?.file, episodes[index]) : null })
}

async function selectPlayerEpisode(request) {
  const token = ++pickerRequest
  pickerPreparing.value = true
  try {
    const selected = await playbackController.selectEpisode(request)
    if (token === pickerRequest) request.onComplete?.(selected)
    return selected
  }
  finally { if (token === pickerRequest) pickerPreparing.value = false }
}

function playNextEpisode(request = {}) { return playbackController.next(request.instance, { chapter: request.chapter === true }) }

// Card voice previews are touch voices; the player gets their card-lines translation inline. Null when
// the cue has no stage preview; otherwise the scenario promise, whose shard load overlaps the player's
// and which the playback controller awaits under its own navigation ownership.
function translatedVoicePreview(card, cue) {
  if (!buildCardVoicePreviewScenario(card, cue)) return null
  return loadArchiveNames('card-lines').catch(error => console.warn('Card line translations unavailable', error))
    .then(() => buildCardVoicePreviewScenario(card, cue, { translate: source => archiveNamedTranslation('card-touch', source, 'text') }))
}

async function openVoicePreview(card, cue, returnView) {
  const scenario = translatedVoicePreview(card, cue)
  if (!scenario) return false
  loadingPurpose.value = 'story-playback'
  return playbackController.preview(() => scenario,
    typeof cue === 'string' ? cue : cue.cue, returnView)
}

async function restorePlaybackDestination(destination, route) {
  if (destination === 'reader') return returnToReader()
  if (!route) return commitView(destination)
  return restoreRoute(route, { restoring: false })
}

async function loadPlayerQueue(route, request) {
  return withLoadDeadline(async signal => {
    const options = { signal, priority: 'background' }
    if (['story_collection', 'reader'].includes(route.view) && route.storyType && route.storySection) {
      const detail = await loadCollectionDetail(route.storyType, route.storySection, options)
      return selectCollectionContinuation(detail.view.collection, request.file, { ...request, verifiedWholeFile:route.view === 'reader' })
    }
    if (['event_detail', 'reader'].includes(route.view) && route.event) {
      const detail = await loadEventDetail(String(route.event), options)
      return (detail.view.episodes || []).filter(episode => episode.exists !== false && episode.file)
    }
    if (route.view === 'idol_story_archive' && route.idol) {
      const detail = await loadIdolStoryDetail(route.idol, options)
      return selectPlayerQueue(detail.view.page.sections, request.file, request)
    }
    if (route.view === 'reader' && route.reading) {
      return loadReaderQueue(route)
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

function isBootstrapRoute(route) {
  if (['event_catalog','collection_catalog','photo_catalog','picture_studio'].includes(route.view)) return true
  return (!EXTERNAL_STORY_RESOURCES_ENABLED && route.view === 'external_story_resources') ||
    ['experiments', 'about', 'chart_lab', 'portal', 'welcome', 'idol_picker', 'home', 'reader', 'idol_detail', 'unit_catalog', 'unit_detail', 'song_catalog', 'song_detail', 'gashas', 'gasha_detail', 'cards', 'card_detail', 'event_detail', 'seasonal_campaign', 'work_archive', 'idol_story_archive', 'mobile_archive', 'story_collection', 'story_detail', 'story_catalog', 'archive_status', 'groups', 'files', 'episode_zero_units', 'episodes', 'spine_lab', 'chibi_stage'].includes(route.view) ||
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
    invalidateSongNavigation()
    invalidateHomeNavigation()
    invalidateIdolNavigation()
    invalidateUnitNavigation()
    invalidateGashaNavigation()
    invalidateCardNavigation()
    invalidateEventNavigation()
    invalidateStoryArchiveNavigation()
    invalidateMobileNavigation()
    invalidateLegacyAliasNavigation()
    invalidateStoryNavigation()
    invalidateResourceNavigation()
    loading.value = true
    loadingPurpose.value = route.view === 'player' ? 'story-playback' : 'archive-data'
    tracePlayer('route-restore', { view: route.view, directPlayer: isDirectScenarioEntry(route) })
    if (!isDirectScenarioEntry(route)) {
      legacyEntryStatus.value = ''
      route = normalizeStoryRoute(route)
      const preparedHomeRoute = await prepareHomeRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedHomeRoute) return
      route = preparedHomeRoute
      const preparedLegacyRoute = await prepareLegacyAliasRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedLegacyRoute) return
      route = preparedLegacyRoute
      const preparedMobileRoute = await prepareMobileRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedMobileRoute) return
      route = preparedMobileRoute
      const preparedIdolRoute = await prepareIdolRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedIdolRoute) return
      route = preparedIdolRoute
      const preparedUnitRoute = await prepareUnitRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedUnitRoute) return
      route = preparedUnitRoute
      const preparedGashaRoute = await prepareGashaRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedGashaRoute) return
      route = preparedGashaRoute
      const preparedCardRoute = await prepareCardRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedCardRoute) return
      route = preparedCardRoute
      const preparedEventRoute = await prepareEventRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedEventRoute) return
      route = preparedEventRoute
      const preparedStoryArchiveRoute = await prepareStoryArchiveRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedStoryArchiveRoute) return
      route = preparedStoryArchiveRoute
      const preparedStoryRoute = await prepareStoryRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })
      if (!preparedStoryRoute) return
      route = preparedStoryRoute
      if (!await prepareSongRoute(route, { isCurrent: () => intent.isCurrent() && request === restoreRequest })) return
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
  if (startup.source === 'invalid-home-idol') {
    userPreferenceNotice.value = '之前选择的首页偶像当前不可用，请重新选择。'
  }
  if (isBootstrapRoute(startup.route) && !['song_catalog', 'song_detail', 'idol_detail', 'unit_catalog', 'unit_detail', 'seasonal_campaign', 'work_archive', 'idol_story_archive', 'mobile_archive', 'story_collection', 'story_detail', 'story_catalog', 'archive_status', 'groups', 'files', 'episode_zero_units', 'episodes'].includes(startup.route.view) && !(startup.route.view === 'home' && startup.route.homeIdol)) loading.value = false
  try {
    await restoreRoute(startup.route)
  } catch (error) {
    // A failed first read must not leave a blank page: the portal degrades gracefully offline.
    console.error('[ArchiveRoute] Failed to open the initial route:', error)
    if (view.value !== '__boot__') return
    loading.value = false
    userPreferenceNotice.value = '该页面暂时无法打开，已回到资料馆。'
    commitView('portal')
  }
})

// App owns assembled catalogues only while their directory/detail is in use.
// The shared client keeps its independently bounded immutable-byte LRU.
watch(view,next=> {
  if(['player','reader'].includes(next))return
  for(const [catalog,detail,owners] of [
    [cardReadModelCatalog,cardReadModelDetail,['cards','card_detail','idols']],
    // The chart tool owns the song detail it shows and the catalogue its picker lists.
    [songReadModelCatalog,songReadModelDetail,['song_catalog','song_detail','chibi_stage','chart_lab']],
    [idolReadModelCatalog,idolReadModelDetail,['idol_detail','idols']],
    [unitReadModelCatalog,unitReadModelDetail,['unit_catalog','unit_detail']],
    [gashaReadModelCatalog,gashaReadModelDetail,['gashas','gasha_detail']],
    [eventReadModelCatalog,eventReadModelDetail,['event_catalog','event_detail']],
    [seasonalReadModelCatalog,seasonalReadModelDetail,['seasonal_campaign']],
    [workReadModelCatalog,workReadModelDetail,['work_archive']],
    [idolStoryReadModelCatalog,idolStoryReadModelDetail,['idol_story_archive']],
    [collectionReadModelCatalog,collectionReadModelDetail,['collection_catalog','story_collection']],
    [storyReadModelCatalog,storyReadModelDetail,['story_catalog','story_detail']],
    [mobileIdolReadModelCatalog,mobileIdolReadModelDetail,['mobile_archive']],
    [mobileUnitReadModelCatalog,mobileUnitReadModelDetail,['mobile_archive']],
  ])if(!owners.includes(next)){catalog.value=null;detail.value=null}
  for(const [detail,owners] of [
    [legacyGroupReadModelDetail,['groups','files']],
    [legacyFileReadModelDetail,['files']],
    [legacyZeroReadModelDetail,['episode_zero_units','episodes']],
    [legacyEpisodeReadModelDetail,['episodes']],
  ])if(!owners.includes(next))detail.value=null
},{flush:'post'})

watch([filterQuery, currentSongScope, currentCardRarity, currentCardAttribute, currentCardAssetState, currentCardRelationState, currentGashaCategory, currentIdolUnitFilter, currentStoryDomain, currentStoryMode, currentStorySection, currentEventScope, currentStoryAvailability, currentStorySort, currentMobileMode, currentMobileScenarioId], () => {
  syncArchiveRoute({ replace: true, restoreView: false })
})

watch([portalScope, portalQuery], () => {
  if (view.value === 'portal' && !navigation.isRestoring()) { captureActiveArchiveView(); syncArchiveRoute({replace:true,restoreView:false}) }
})

watch([homeSelectedId, homeSelectedCue, homeSelectedCostume], () => {
  if (view.value === 'home') syncArchiveRoute({ replace: true, restoreView: false })
})

watch(homeSelectedId, handleHomeIdolChange)

watch([view, currentCharacterId], handleIdolDetailChange)

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
  invalidateHomeNavigation()
  readModelClient.dispose()
  playbackController.dispose()
  navigation.dispose()
  removeArchivePopState?.()
  removeSpineAnimationDebug?.()
})
</script>

<style scoped>
#story-viewer {
  width: 100%; height: 100vh; height: 100dvh; min-height: 100%; color: #222;
  background: var(--gs-paper); overflow: hidden;
}
.player-trace-panel { position: fixed; z-index: 130; top: calc(72px + env(safe-area-inset-top, 0px)); right: 8px; max-width: calc(100vw - 16px); padding: 8px 12px; border: 1px solid #9abab7; border-radius: 8px; background: #f7faf9; color: #193c44; font: 13px/1.5 system-ui; }
.player-trace-panel button { min-height: 44px; }
.player-trace-panel pre { max-height: 45dvh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
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
/* iPad Safari can resolve 100dvh a few pixels short of the html box; the uncovered strip must be
   the archive's paper, not the browser's white. */
html, body { background: var(--gs-paper); }
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
