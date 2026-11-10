<template>
  <div ref="playerRoot" class="story-viewer-root" :class="{ 'stage-only': HIDE_UI || uiHidden, 'immersive-landscape': immersiveCompact }" tabindex="0"
    @pointerdown.capture="_ensureAudioCtx" @keydown="handlePlayerKeydown">
    <pre
      v-if="RUNTIME_DEBUG"
      class="runtime-diagnostics"
      data-testid="story-runtime-diagnostics"
    >{{ JSON.stringify(runtimeDiagnostics, null, 2) }}</pre>
    <div v-if="RUNTIME_DEBUG" class="runtime-debug-actions">
      <button data-testid="story-debug-hide" @click.stop="applyDebugVisibility(true)">SIMULATE HIDDEN</button>
      <button data-testid="story-debug-show" @click.stop="applyDebugVisibility(false)">SIMULATE VISIBLE</button>
    </div>
    <div class="viewer-stage" :inert="menuOpen || viewingOfferOpen || props.recoveryOpen || undefined">
    <!-- Spine rendering layer (background + characters) -->
    <SpineStage v-if="retainedStageStep" ref="spineStageRef" :step="retainedStageStep" :suspended="!communicationContext.needsStage" :fallbackBg="firstAvailableBg" :debug-controls="RUNTIME_DEBUG" :now-milliseconds="storyRuntimeCues.nowMilliseconds" portrait-framing release-owner="story-player" />
    <div ref="frameHoldRoot" v-show="frameHolding" class="held-scene" aria-hidden="true"></div>
    <GsLoadingIndicator v-if="localBuffering && !HIDE_UI" class="local-buffering"
      variant="inline" :message="localBufferingText" />

    <!-- Top bar -->
    <PlayerTopBar
      v-if="compiledData && !HIDE_UI && !uiHidden"
      :compact="immersiveCompact"
      :current="playableStepNumber"
      :total="playableStepTotal"
      :episode-label="positionLabel"
      :language="languageStatus.label"
      :compact-language="languageStatus.compact"
      :language-description="languageStatus.description"
      @back="$emit('back')"
      @language="cycleLanguage"
      @menu="menuOpen = true"
    />

    <button v-if="uiHidden && !HIDE_UI" class="restore-ui" :title="uiText('player.showUi')" :aria-label="uiText('player.showUi')" @click.stop="uiHidden = false">
      <Eye :size="20" />
    </button>

    <div v-if="voiceStatus === 'unavailable' && !showAdvDialogue && !HIDE_UI && !uiHidden && !backlogOpen && !viewingOfferOpen" class="voice-recovery">
      <button @click.stop="retryCurrentVoice()">{{ uiText('player.voice.retry') }}</button>
      <button @click.stop="retryCurrentVoice({ backend: 'media' })">{{ uiText('player.voice.compat') }}</button>
    </div>
    <!-- Audio output is owned by useVoicePlayer, not the scene DOM. -->

    <!-- UI overlay for step-specific screens -->
    <div class="ui-overlay" :class="{ 'held-underlay': frameHolding }" :aria-hidden="frameHolding ? 'true' : undefined" v-if="compiledData && !HIDE_UI && !uiHidden">

      <!-- ADV dialogue -->
      <Transition name="adv-dialogue-fade" appear>
        <AdvUI
          v-if="showAdvDialogue"
          :dialogue="currentStep.dialogue"
          :step="currentStep"
          :playing="isPlaying"
          :voice-status="voiceStatus"
          :auto-held="autoHeld"
          @retry-voice="retryCurrentVoice"
          @click="tapNext"
        />
      </Transition>

      <!-- Talk / chat scene: stays mounted across choice steps via context inheritance -->
      <MobileChatScene
        v-if="communicationContext.mode === 'talk'"
        :dialogue="currentStep.dialogue"
        :step="currentStep"
        :stepIndex="currentStepIndex"
        :scenarioId="compiledData?.scenario_id"
        :historyStack="historyStack"
        :choiceTexts="choiceTexts"
        :steps="compiledData?.steps || []"
        :sceneBackgroundUrl="mobileBackdropUrl"
        @select="onChoice"
      />

      <!-- Phone call scene: stays mounted across choice steps via context inheritance -->
      <MobileCallScene
        v-else-if="communicationContext.mode === 'call'"
        :dialogue="currentStep.dialogue"
        :step="currentStep"
        :stepIndex="currentStepIndex"
        :scenarioId="compiledData?.scenario_id"
        :historyStack="historyStack"
        :choiceTexts="choiceTexts"
        :steps="compiledData?.steps || []"
        :sceneBackgroundUrl="mobileBackdropUrl"
        @select="onChoice"
      />

      <!-- Choice / selection (standalone; communication choices render in-scene via the rail) -->
      <StageChoiceUI
        v-else-if="currentStep.type === 'choice'"
        :step="currentStep"
        @select="onChoice"
      />

      <!-- Pre-play synopsis -->
      <SynopsisUI v-if="currentStep.type === 'synopsis'" :step="currentStep" />

      <!-- Time/location caption -->
      <TextTimeUI v-if="currentStep.type === 'text_time'" :step="currentStep" @next="goNext" />

    </div>

    <!-- Keep a hidden title mounted so restoring UI resumes the same animation.
         Each step owns its card and completion events, including adjacent titles. -->
    <div v-if="compiledData && !HIDE_UI && !episodeFinished && currentStep.type === 'title'"
      class="ui-overlay" :class="{ 'held-underlay': frameHolding }" :aria-hidden="frameHolding ? 'true' : undefined" :style="{ visibility: uiHidden ? 'hidden' : undefined }">
      <TitleUI
        :key="currentStepIndex"
        :step="currentStep"
        :paused="titlePaused"
        @start="onTitleAnimationStart"
        @complete="onTitleAnimationSettled('complete', $event)"
        @cancel="onTitleAnimationSettled('cancel', $event)"
      />
    </div>

    <!-- Bottom control dock -->
    <PlayerControlDock
      v-if="compiledData && compiledData.steps.length > 0 && !HIDE_UI && !uiHidden && !endBarOpen && !previewOnly"
      :compact="immersiveCompact"
      :auto-enabled="autoEnabled"
      :skip-enabled="skipEnabled"
      :previous-disabled="isFirstStep"
      :next-disabled="episodeFinished || currentStep.type === 'choice'"
      @previous="goPrev"
      @auto="toggleAuto"
      @skip="toggleSkip"
      @backlog="openBacklog"
      @next="goNext"
    />

    <StoryBacklog
      v-if="backlogOpen && !HIDE_UI"
      :nodes="backlogNodes"
      :voice-node="backlogVoiceNode" :voice-status="voiceStatus"
      @close="backlogOpen = false"
      @restore="restoreFromBacklog"
      @replay-voice="replayBacklogVoice"
    />

    <button v-if="autoEnabled && audioLocked && audioTapNeeded && !endBarOpen && !localBuffering && !HIDE_UI && !uiHidden && !backlogOpen && !viewingOfferOpen"
      class="audio-tap" type="button" @click.stop="_ensureAudioCtx">
      <Play :size="15" /><span>{{ uiText('player.auto.tapToResume') }}</span>
    </button>

    <!-- Preview mode (one voiced line, no dock): at its end, replay the line or go back to its page. -->
    <div v-if="endBarOpen && previewOnly" class="episode-complete is-preview" role="region" :aria-label="uiText('player.complete.region')">
      <span class="end-copy" role="status"><strong>{{ uiText('player.preview.complete') }}</strong></span>
      <span class="end-actions">
        <button type="button" data-preview-replay @click="replayPreview"><RotateCcw :size="16" aria-hidden="true" />{{ uiText('player.preview.replay') }}</button>
        <button class="primary" type="button" @click="emit('back')">{{ returnLabel }}</button>
      </span>
    </div>
    <!-- End of an episode: the bar takes the dock's place so the last line stays where it was read. -->
    <div v-else-if="endBarOpen" class="episode-complete" role="region" :aria-label="uiText('player.complete.region')">
      <span v-if="chapterCountdownLeftMs" class="end-countdown" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle class="track" cx="12" cy="12" r="10" /><circle class="fill" cx="12" cy="12" r="10" :style="{ strokeDashoffset: 62.83 * (1 - chapterCountdownLeftMs / CHAPTER_COUNTDOWN_MS) }" /></svg>
      </span>
      <span class="end-copy" role="status">
        <strong>{{ chapterCountdownLeftMs ? uiText('player.complete.upNext') : communicationCompleted ? uiText('player.complete.communication') : uiText('player.complete.episode') }}</strong>
        <small v-if="queueStatus === 'idle' || queueStatus === 'loading'">{{ uiText('player.queue.loading') }}</small>
        <small v-else-if="nextTarget?.available">{{ nextLabel }}</small>
        <small v-else-if="queueStatus !== 'error'">{{ nextTarget?.reason || '当前观看范围已结束' }}</small>
      </span>
      <span class="end-actions">
        <button v-if="chapterCountdownLeftMs" type="button" @click="cancelChapterCountdown">{{ uiText('player.complete.cancel') }}</button>
        <button v-else type="button" @click="continueReview">{{ uiText('player.complete.review') }}</button>
        <button v-if="completionLiveLink" class="primary" type="button" data-live-link :title="completionLiveLink.title" @click="emit('open-song', completionLiveLink.code)">{{ uiText('player.complete.live') }}</button>
        <button v-if="queueStatus === 'error'" type="button" @click="emit('retry-queue')">{{ uiText('player.queue.retry') }}</button>
        <button v-else-if="nextTarget?.available" :class="{ primary: !completionLiveLink }" type="button" :disabled="transitioning" @click="requestNextEpisode()">{{ transitioning ? uiText('player.complete.loadingNext') : chapterCountdownLeftMs ? uiText('player.complete.playNow') : uiText(nextTarget.kind === 'chapter' ? 'player.complete.nextEpisode' : 'player.next') }}</button>
        <button v-else :class="{ primary: !completionLiveLink }" type="button" @click="emit('back')">{{ returnLabel }}</button>
      </span>
    </div>

    </div><!-- /viewer-stage -->
    <PlayerMenuPanel v-if="menuOpen && !HIDE_UI" :title="uiText(pickerOpen ? 'player.picker.title' : 'player.settings.panel')" :paused-label="uiText('player.settings.paused')" :close-label="uiText('player.settings.close')" @close="menuOpen = false">
        <PlayerEpisodePicker v-if="pickerOpen" :snapshot="queueSnapshot" :status="queueStatus" :pending="transitioning" @back="pickerOpen = false" @select="selectEpisode" @retry="emit('retry-queue')" />
        <template v-else>
        <button @click="pickerOpen = true">{{ uiText('player.picker.title') }}</button>
        <p v-if="positionLabel" class="menu-position">{{ positionLabel }}</p>
        <button v-if="nextTarget?.available" :disabled="transitioning" @click="requestNextEpisode()"><SkipForward :size="19" /><span>{{ nextLabel }}</span></button>
        <button v-if="queueStatus === 'error'" @click="emit('retry-queue')">{{ uiText('player.queue.retry') }}</button>
        <p v-else-if="queueStatus === 'loading' || queueStatus === 'idle'" role="status">{{ uiText('player.queue.loading') }}</p>
        <button @click="openBacklog"><BookOpenText :size="19" /><span>{{ uiText('player.settings.backlog') }}</span></button>
        <button @click="emit('back')"><LogOut :size="19" /><span>{{ returnLabel }}</span></button>
        <h3>播放</h3>
        <template v-if="immersiveEligible">
          <button v-if="!immersive.active.value" :disabled="immersive.pending.value" @click="enterImmersive"><span>{{ uiText('player.immersive.enter') }}</span></button>
          <button v-else @click="immersive.leave()"><span>{{ uiText('player.immersive.leave') }}</span></button>
          <label class="menu-setting"><span>{{ uiText('player.immersive.mode') }}</span><select v-model="mobileViewMode" @change="saveMobileViewMode"><option value="ask">{{ uiText('player.immersive.ask') }}</option><option value="landscape">{{ uiText('player.immersive.landscape') }}</option><option value="portrait">{{ uiText('player.immersive.portrait') }}</option></select></label>
        </template>
        <button @click="cycleLanguage"><span>{{ uiText('player.immersive.language') }}</span><b>{{ langLabel }}</b></button>
        <button v-if="storyLocalization.retryAvailable.value" :disabled="storyLocalization.loading.value" @click="storyLocalization.retryTranslation()">译文暂时无法载入 · 重试译文</button>
        <label class="menu-toggle">
          <span>{{ uiText('player.settings.continuous') }}</span>
          <input type="checkbox" :checked="continuousPlayback" @change="emit('update:continuous-playback', $event.target.checked)" />
        </label>
        <button :class="{ active: autoEnabled }" @click="toggleAuto"><Play :size="19" /><span>{{ uiText('player.settings.auto') }}</span><b>{{ autoEnabled ? 'ON' : 'OFF' }}</b></button>
        <label class="menu-setting">
          <span>{{ uiText('player.settings.autoDelay') }}</span>
          <input v-model.number="autoDelayMs" type="number" min="0" max="10000" step="100" @change="saveAutoDelay" />
          <small>ms</small>
        </label>
        <button data-testid="player-speed" @click="cycleStorySpeed"><Gauge :size="19" /><span>{{ uiText('player.settings.speed') }}</span><b>×{{ storySpeed.toFixed(1) }}</b></button>
        <button :class="{ active: skipEnabled }" @click="toggleSkip"><FastForward :size="19" /><span>{{ uiText('player.settings.skip') }}</span><b>{{ skipEnabled ? 'ON' : 'OFF' }}</b></button>
        <label class="menu-setting">
          <span>{{ uiText('player.settings.skipRange') }}</span>
          <select v-model="skipMode" @change="saveSkipMode"><option value="readOnly">{{ uiText('player.settings.readOnly') }}</option><option value="all">{{ uiText('player.settings.all') }}</option></select>
        </label>
        <div v-if="$slots['language-switch']" class="menu-setting">
          <span>{{ uiText('player.settings.uiLanguage') }}</span>
          <slot name="language-switch" />
        </div>
        <label class="menu-setting"><span>{{ uiText('player.settings.producerName') }}</span><input class="producer-name-input" :value="producerName" type="text" autocomplete="off" :placeholder="uiText('player.settings.producerNamePlaceholder')" @input="saveProducerName($event.target.value)" /></label>
        <button @click="uiHidden = true; menuOpen = false"><EyeOff :size="19" /><span>{{ uiText('player.settings.hideUi') }}</span></button>
        <label class="menu-setting"><span>{{ uiText('player.voice.backend') }}</span>
          <select v-model="voiceBackend" @change="changeVoiceBackend">
            <option value="auto">{{ uiText('player.voice.auto') }}</option>
            <option value="webaudio">Web Audio</option>
            <option value="media">{{ uiText('player.voice.compat') }}</option>
          </select>
        </label>
        <button @click="menuOpen = false; retryCurrentVoice()">{{ uiText('backlog.replayVoice') }}</button>
        </template>
    </PlayerMenuPanel>

    <div v-if="viewingOfferOpen" class="viewing-offer" role="dialog" aria-modal="true" aria-labelledby="viewing-offer-title" @keydown.stop="handleViewingOfferKeydown">
      <div class="viewing-offer-panel">
        <h2 id="viewing-offer-title">{{ uiText('player.immersive.title') }}</h2>
        <p>{{ uiText('player.immersive.description') }}</p>
        <label><input v-model="rememberViewingChoice" type="checkbox" />{{ uiText('player.immersive.remember') }}</label>
        <button ref="viewingOfferAction" class="primary" @click="chooseViewingMode('landscape')">{{ uiText('player.immersive.enter') }}</button>
        <button @click="chooseViewingMode('portrait')">{{ uiText('player.immersive.continue') }}</button>
      </div>
    </div>
    <div v-else-if="!HIDE_UI && !uiHidden && ((showViewingShortcut && !immersive.active.value) || immersive.notice.value)" class="viewing-notice">
      <span v-if="immersive.notice.value" role="status">{{ uiText(`player.immersive.${immersive.notice.value}`) }}</span>
      <button v-if="!immersive.active.value" :disabled="immersive.pending.value" @click="enterImmersive">{{ uiText('player.immersive.enter') }}</button>
      <button @click="viewingShortcutDismissed = true; immersive.dismiss()">{{ uiText('player.immersive.dismiss') }}</button>
    </div>
    <GsLoadingIndicator class="story-data-loading" v-if="!compiledData && !HIDE_UI"
      tone="dark" :message="uiText('player.loading')" />
  </div>
</template>

<script setup>
import { setStoryRuntimePaused, transferOverlayPause } from './story-runtime/StoryPausePolicy.js'
import { usePlayerSession } from '../composables/PlayerSession.js'
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, onUnmounted, reactive, nextTick, defineAsyncComponent } from 'vue'
import AdvUI from '../components/AdvUI.vue'
import GsLoadingIndicator from '../components/GsLoadingIndicator.vue'
import MobileChatScene from '../components/mobile/MobileChatScene.vue'
import MobileCallScene from '../components/mobile/MobileCallScene.vue'
import StageChoiceUI from '../components/choices/StageChoiceUI.vue'
import TitleUI from '../components/TitleUI.vue'
import SynopsisUI from '../components/SynopsisUI.vue'
import TextTimeUI from '../components/TextTimeUI.vue'
import StoryBacklog from '../components/StoryBacklog.vue'
import { BookOpenText, Eye, EyeOff, FastForward, Gauge, LogOut, Play, RotateCcw, SkipForward, X } from '@lucide/vue'
import PlayerEpisodePicker from '../components/player/PlayerEpisodePicker.vue'
import PlayerMenuPanel from '../components/player/PlayerMenuPanel.vue'
import PlayerTopBar from '../components/player/PlayerTopBar.vue'
import PlayerControlDock from '../components/player/PlayerControlDock.vue'
// SpineStage is lazy-loaded so PIXI.js only loads when a story opens
const SpineStage = defineAsyncComponent(() => import('../components/SpineStage.vue'))
import {
  producerName,
  saveProducerName,
  setStoryLanguagePreferences,
  storyLanguagePreferences,
  uiLocale,
} from '../utils/LanguageStore.js'
import { resolveUiText as uiText } from '../localization/ui/UiTextResolver.js'
import { resolveStoryPresentation } from '../../shared/story/StoryPresentation.js'
import { warmCommunicationScene } from './story-runtime/CommunicationSceneWarmup.js'
import { getBgUrl } from '../utils/AssetResolver.js'
import { useVoicePlayer } from './useVoicePlayer.js'
import { AudioManager } from './AudioManager.js'
import { useStoryNavigation } from './useStoryNavigation.js'
import { useStepSceneEffects } from './useStepSceneEffects.js'
import { useStoryRuntimeCues } from './story-runtime/useStoryRuntimeCues.js'
import { StoryAudioSession } from './story-runtime/StoryAudioSession.js'
import { getStepSceneState, projectStepSceneState } from './story-runtime/StepSceneState.js'
import { SceneSnapshotStore, isReadableHistoryStep } from './story-runtime/SceneSnapshotStore.js'
import { PlayerPreferencesRepository, STORY_SPEEDS } from './story-runtime/PlayerPreferencesRepository.js'
import { playerLanguageStatus } from '../components/player/PlayerLanguageStatus.js'
import { ReadProgressRepository, createReadKey } from './story-runtime/ReadProgressRepository.js'
import { PlaybackModeController } from './story-runtime/PlaybackModeController.js'
import { createNativeCutWait, nativeWaitSeconds } from './story-runtime/NativeCutWait.js'
import { finiteBranchNextIndex, finiteChoiceTargetIndex } from '../../shared/story/FiniteBranchFlow.js'
import { releaseSoakRecorder } from './story-runtime/ReleaseSoakRecorder.js'
import { storyReleaseProbe } from './story-runtime/StoryReleaseProbe.js'
import {
  createStoryLocalization,
  provideStoryLocalization,
} from '../localization/story/StoryLocalizationContext.js'

const props = defineProps({
  previewOnly: Boolean,
  scenarioJson: { type: Object, default: null },
  playbackInstance: { type: Number, default: 0 },
  scenarioUrl: { type: String, default: null },
  startStep: { type: Number, default: null },
  initialStep: { type: Number, default: null },
  endStep: { type: Number, default: null },
  nextTarget: { type: Object, default: null },
  positionLabel: { type: String, default: '' },
  // The host formats episode labels; the player kernel does not know archive presentation.
  formatEpisodeLabel: { type: Function, default: label => label },
  returnLabel: { type: String, default: '返回来源目录' },
  hasNextEpisode: { type: Boolean, default: false },
  continuousPlayback: { type: Boolean, default: false },
  transitionPending: Boolean,
  recoveryOpen: Boolean,
  queueSnapshot: { type:Object, default:null },
  queueStatus: { type: String, default: 'ready' },
  queueError: { type: String, default: '' },
  // A story that hands over to a song's Live ({ afterStepId, code, title }); offered when that step completes.
  liveLink: { type: Object, default: null },
})
const emit = defineEmits(['back', 'replay-preview', 'ready', 'readiness-change', 'step-change', 'next-episode', 'update:continuous-playback', 'retry-queue', 'select-episode', 'open-song'])
const URL_FLAGS = new URLSearchParams(window.location.search)
const HIDE_UI = URL_FLAGS.get('stageOnly') === '1' || URL_FLAGS.get('hideUI') === '1' || URL_FLAGS.get('transparentUI') === '1'
const START_STEP_VALUE = URL_FLAGS.get('startStep')
const START_STEP = Number.isFinite(props.startStep) && props.startStep > 0
  ? props.startStep
  : (START_STEP_VALUE == null || START_STEP_VALUE === '' ? null : Number(START_STEP_VALUE))
const END_STEP_VALUE = URL_FLAGS.get('endStep')
const END_STEP = Number.isFinite(props.endStep) && props.endStep > 0
  ? props.endStep
  : (END_STEP_VALUE == null || END_STEP_VALUE === '' ? null : Number(END_STEP_VALUE))
const NO_AUDIO = URL_FLAGS.get('noAudio') === '1'
const NO_VOICE = NO_AUDIO || URL_FLAGS.get('noVoice') === '1'
const SNAPSHOT_AT_VALUE = URL_FLAGS.get('snapshotAt')
const SNAPSHOT_AT = SNAPSHOT_AT_VALUE == null || SNAPSHOT_AT_VALUE === '' ? null : Number(SNAPSHOT_AT_VALUE)
const RUNTIME_DEBUG = URL_FLAGS.get('runtimeDebug') === '1'
const preferencesRepository = new PlayerPreferencesRepository()
const readProgressRepository = new ReadProgressRepository()
const initialPreferences = preferencesRepository.load()
setStoryLanguagePreferences(initialPreferences)

const spineStageRef = ref(null)
const compiledData = ref(null)
const playerRoot = ref(null)
const viewingOfferAction = ref(null)
const viewingOfferOpen = ref(false)
const rememberViewingChoice = ref(true)
const mobileViewMode = ref(initialPreferences.story_mobile_view_mode)
const viewingShortcutDismissed = ref(false)
const playerSession = usePlayerSession()
const immersive = playerSession.immersive
const smallScreen = ref(false)
const shortLandscape = ref(false)
const portraitScreen = ref(false)
const immersiveEligible = computed(() => !props.previewOnly && !HIDE_UI && (compiledData.value?.steps || [])
  .slice(Math.max(0, (props.startStep || 1) - 1), props.endStep || undefined)
  .some(step => ['adv', 'talk', 'call', 'choice'].includes(step.type)))
const immersiveCompact = computed(() => immersiveEligible.value && immersive.active.value && shortLandscape.value)
const showViewingShortcut = computed(() => immersiveEligible.value && smallScreen.value && mobileViewMode.value === 'landscape' && !viewingShortcutDismissed.value)
function saveMobileViewMode() { preferencesRepository.update({ story_mobile_view_mode: mobileViewMode.value }) }
function enterImmersive() {
  // Keep this call before awaits: browsers require a fresh user gesture.
  const request = playerSession.enter()
  viewingOfferOpen.value = false
  menuOpen.value = false
  return request
}
function chooseViewingMode(mode) {
  if (rememberViewingChoice.value) { mobileViewMode.value = mode; saveMobileViewMode() }
  viewingOfferOpen.value = false
  viewingShortcutDismissed.value = mode !== 'landscape'
  if (mode === 'landscape') void enterImmersive()
  else playerRoot.value?.focus()
}
function handleViewingOfferKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); chooseViewingMode('portrait'); return }
  if (event.key !== 'Tab') return
  const items = [...event.currentTarget.querySelectorAll('button, input')]
  const first = items[0], last = items.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
function updateViewingViewport() {
  const width = window.innerWidth, height = window.innerHeight
  smallScreen.value = width <= 760 || (height <= 600 && width <= 1100)
  shortLandscape.value = width > height && height <= 600 && width <= 1100
  portraitScreen.value = width < height
}

const storyLocalization = createStoryLocalization({
  compiledData,
  storyPreferences: storyLanguagePreferences,
})
provideStoryLocalization(storyLocalization)
const currentStepIndex = ref(0)
const historyStack = ref([])
const selectedChoices = reactive(new Map())
const restoredSceneState = ref(null)
const sceneSnapshotStore = new SceneSnapshotStore()
const initialReadyEmitted = ref(false)
const frameHoldRoot = ref(null)
const frameHolding = ref(false)
const frameHoldRequired = ref(false)
const runtimeReadinessStatus = ref('idle')
const runtimeReadinessReason = ref('')
let heldTargetIndex = null
const MAX_HELD_FRAME_PIXELS = 1920 * 1080
const localBuffering = computed(() => initialReadyEmitted.value && runtimeReadinessStatus.value === 'waiting'
  && (frameHolding.value || !frameHoldRequired.value))
const localBufferingText = '正在准备下一段画面…'
const voiceStatus = ref('idle')
const voiceBackend = ref(['auto', 'webaudio', 'media'].includes(URL_FLAGS.get('voiceBackend')) ? URL_FLAGS.get('voiceBackend') : 'auto')
const backlogVoiceNode = ref('')
const isPlaying = ref(false)
const menuOpen = ref(false)
const pickerOpen = ref(false)
watch(menuOpen, open => { if (!open) pickerOpen.value = false })
watch(() => props.recoveryOpen, open => { if (open) menuOpen.value = false }, { flush:'sync' })
function selectEpisode(request) {
  if (!props.transitionPending && !request.restart && request.entryKey === props.queueSnapshot?.currentKey) { menuOpen.value = false; return }
  const keepCurrent = !request.restart && request.entryKey === props.queueSnapshot?.currentKey
  emit('select-episode', { ...request, instance:props.playbackInstance,
    onComplete: keepCurrent ? success => { if (success) menuOpen.value = false } : undefined })
}
const backlogOpen = ref(false)
const backlogNodes = ref([])
const autoEnabled = ref(initialPreferences.auto_enabled)
const autoDelayMs = ref(initialPreferences.auto_delay_ms)
// Native OnClickBackgroundPanel isAutoStop: a tap holds the running auto on this line.
const autoHeld = ref(false)
const storySpeed = ref(initialPreferences.story_speed)
const skipEnabled = ref(false)
const skipMode = ref(initialPreferences.skip_mode)
const uiHidden = ref(initialPreferences.ui_hidden)
const episodeFinished = ref(false)
const completionLiveLink = computed(() => props.liveLink && currentStep.value?.step_id === props.liveLink.afterStepId ? props.liveLink : null)
const completionDismissed = ref(false)
const endBarOpen = computed(() => episodeFinished.value && !completionDismissed.value && !HIDE_UI && !uiHidden.value)
let automaticNextRequested = false
const nextLabel = computed(() => props.nextTarget ? `${props.nextTarget.kind === 'chapter' ? '下一话' : '下一段'} · ${props.formatEpisodeLabel(props.nextTarget.label)}` : '')
function requestNextEpisode({ automatic = false, chapter = !automatic && props.nextTarget?.kind === 'chapter' } = {}) {
  if (props.transitionPending || (automatic && automaticNextRequested)) return
  if (automatic) automaticNextRequested = true
  cancelChapterCountdown()
  menuOpen.value = false
  emit('next-episode', { instance: props.playbackInstance, chapter })
}
function continueReview() { cancelChapterCountdown(); completionDismissed.value = true; nextTick(() => playerRoot.value?.focus()) }

// Continuous playback runs straight through a chapter's segments; at a chapter boundary it
// waits a short, cancellable countdown on the end bar first, about as long as the native
// end fade before it loads the next episode. A Live hand-off never counts down.
const CHAPTER_COUNTDOWN_MS = 1500
const chapterCountdownCancelled = ref(false)
const chapterCountdownLeftMs = ref(0)
let chapterCountdownTimer = null
const chapterCountdownEligible = computed(() => episodeFinished.value && !completionDismissed.value && !chapterCountdownCancelled.value
  && props.continuousPlayback && props.nextTarget?.kind === 'chapter' && props.nextTarget.available
  && props.queueStatus === 'ready' && !completionLiveLink.value && !props.transitionPending)
function stopChapterCountdownTimer() { clearInterval(chapterCountdownTimer); chapterCountdownTimer = null }
function cancelChapterCountdown() { stopChapterCountdownTimer(); chapterCountdownLeftMs.value = 0; chapterCountdownCancelled.value = true }

const transitioning = computed(() => props.transitionPending)
const runtimeDiagnostics = ref(null)
const debugVisibilityOverride = ref(null)
const pageHidden = ref(false)

let _runtimeDiagnosticsTimer = null
let unregisterReleaseViewer = null

const storyAudioSession = new StoryAudioSession({
  masterVolume: initialPreferences.volumes.master,
  busVolumes: initialPreferences.volumes,
  disabled: NO_AUDIO,
  releaseOwner: 'story-player',
})
const _audioManager = new AudioManager({ audioSession: storyAudioSession })

let voicePlayer = null
let clearFadeAutoAdvance = () => {}
let handleStepChange = () => {}
let cleanupStepSceneEffects = () => {}
let inspectStepSceneEffects = () => ({ timer_pending: 0 })
let handleRuntimeStepChange = () => {}
let cleanupRuntimeCues = () => {}
let isRuntimeAutoBlocked = () => false
let playbackController = null
let pendingStepEffects = null
// A cut that only waits holds the screen between two steps (NativeCutWait.js).
const nativeCutWait = createNativeCutWait({ onChange: () => playbackController?.notifyStateChanged() })

// Auto waits for a running AudioContext so it never runs ahead of silent voices. Each episode
// remounts the player after the tap that asked for it, so the lock lifts when this player's
// context first runs; only when it cannot (no activation yet, or WebKit refusing) does the
// player ask for a tap.
const audioLocked = ref(false)
const audioTapNeeded = ref(false)
let audioTapTimer = null
function setAudioLock(locked) {
  audioLocked.value = locked
  if (!locked) { audioTapNeeded.value = false; clearTimeout(audioTapTimer) }
  playbackController?.setPaused('audio-lock', locked)
}
function releaseAudioLockWhenRunning() {
  if (!audioLocked.value) return
  if (!navigator.userActivation?.hasBeenActive) { audioTapNeeded.value = true; return }
  const context = storyAudioSession.ensureContext()
  if (!context) { setAudioLock(false); return }
  // Ask for running outside a gesture; the session still holds it suspended while it is paused.
  void storyAudioSession.resume('audio-lock')
  const check = () => { if (context.state === 'running') { context.removeEventListener('statechange', check); setAudioLock(false) } }
  context.addEventListener('statechange', check)
  check()
  audioTapTimer = setTimeout(() => { if (audioLocked.value) audioTapNeeded.value = true }, 1500)
}

// True while a title step is playing its FX. The FX is a transition the player
// owns, not a screen the user dismisses: it always advances when it ends, which
// is the same contract `getAutoAdvanceTiming` gives every other transition
// step. Auto is held for its duration so it cannot paste its delay on top of a
// card that is still animating.
const titleAnimationPending = ref(false)

function setTitleAnimationPending(pending) {
  const next = Boolean(pending)
  if (next === titleAnimationPending.value) return
  titleAnimationPending.value = next
  playbackController?.notifyStateChanged()
}

// A completion belongs to one mounted step. Pause and asynchronous cue
// settlement may defer it, but navigation must never transfer it to a new card.
let titleAdvancePending = null

function onTitleAnimationStart(step) {
  if (step === currentStep.value) setTitleAnimationPending(true)
}

function retryTitleAdvance() {
  const request = titleAdvancePending
  if (!request || request.step !== currentStep.value) { titleAdvancePending = null; return }
  if (titlePaused.value || request.settling) return
  request.settling = true
  const result = goNext('title-animation', () => {
    if (titleAdvancePending !== request || currentStep.value !== request.step) return
    request.settling = false
    retryTitleAdvance()
  })
  if (result !== 'settled') request.settling = false
  if (result !== 'blocked' && result !== 'settled' && titleAdvancePending === request) {
    titleAdvancePending = null
  }
}

// `cancel` means the step was left mid-flight, so advancing again would skip a
// step the user never saw. Reduced motion emits neither event: the card stays
// static and the step is dismissed by the user, exactly as it was before the FX.
function onTitleAnimationSettled(event, step) {
  if (step !== currentStep.value) return
  setTitleAnimationPending(false)
  if (event === 'cancel') return
  if (!titleAdvancePending) titleAdvancePending = { step, settling: false }
  retryTitleAdvance()
}

const getVoiceVolume = () => voicePlayer?.getVoiceVolume?.() || 0

// 控制 Spine 嘴型动画（Track 2），传入真实音量回调
function _setTalking(on) {
  if (NO_VOICE) return
  voicePlayer?.setTalking?.(on)
}

/**
 * Ensure AudioContext is created and in 'running' state.
 * Must be called SYNCHRONOUSLY within a user gesture (click, keydown).
 * Once running, subsequent source.start(0) calls work even from async contexts.
 */
function _ensureAudioCtx() {
  if (!NO_AUDIO) storyAudioSession.unlockFromUserGesture()
  setAudioLock(false)
}

function retryCurrentVoice(options = {}) {
  _ensureAudioCtx()
  if (options?.backend) voiceBackend.value = options.backend
  voicePlayer?.setBackendMode(voiceBackend.value)
  void voicePlayer?.retryVoice?.({ backend: voiceBackend.value })
}
function changeVoiceBackend() {
  voicePlayer?.setBackendMode(voiceBackend.value)
}


function _resetVoiceDedup() {
  voicePlayer?.resetVoiceDedup?.()
}

function _stopCurrentVoice(reason = 'unspecified') {
  voicePlayer?.stopCurrentVoice?.(reason)
}

function freezeScene(reason = 'snapshot') {
  clearFadeAutoAdvance()
  spineStageRef.value?.manager?.cancelAllSpineTweens?.()
  _stopCurrentVoice(reason)
  return spineStageRef.value?.dumpScene?.() || window.dumpScene?.() || []
}

// Computed: expose selectedChoices as plain object for mobile scene prop reactivity
const choiceTexts = computed(() => {
  const obj = {}
  for (const [k, v] of selectedChoices.entries()) {
    obj[k] = v
  }
  return obj
})

const currentStep = computed(() => {
  if (!compiledData.value?.steps) return {}
  return compiledData.value.steps[currentStepIndex.value] || {}
})
const languageStatus = computed(() => playerLanguageStatus(storyLanguagePreferences.value,
  currentStep.value.dialogue && currentStep.value.hide_dialogue !== true
    ? storyLocalization.resolveDialogue(currentStep.value.dialogue).view : null))

const currentSceneState = computed(() => restoredSceneState.value || getStepSceneState(currentStep.value))
const stageStep = computed(() => projectStepSceneState(currentStep.value, currentSceneState.value))

function beginFrameHold(targetIndex) {
  runtimeReadinessStatus.value = 'waiting'
  if (!initialReadyEmitted.value) return
  if (frameHolding.value) { heldTargetIndex = targetIndex; return }
  const manager = spineStageRef.value?.manager
  const targetStep = compiledData.value?.steps?.[targetIndex]
  if (!manager?.app?.renderer || !targetStep) return
  // A text-disable bridge is intentionally short and can advance before the
  // following actor has loaded. Preserve the last dialogue's stage pixels
  // through that bridge, without restoring its intentionally hidden text.
  const bridge = targetStep.type === 'text_disable' ? compiledData.value.steps[targetIndex + 1] : null
  const visualTarget = bridge || targetStep
  const source = getStepSceneState(currentStep.value) || {}
  const target = getStepSceneState(visualTarget) || {}
  const actorPending = (target.spines || []).some(actor => actor?.id && actor?.model
    && manager.spineInstances?.[actor.id]?.modelId !== actor.model
    && !manager._silhouetteSprites?.[actor.id])
  frameHoldRequired.value = actorPending || source.bg !== target.bg
  if (!frameHoldRequired.value) return
  heldTargetIndex = bridge ? targetIndex + 1 : targetIndex
  const host = frameHoldRoot.value
  if (!host) return
  try {
    // Extract the last playable Pixi frame before the next step can remove its
    // actors. A detached canvas holds pixels without encoding a large data URL.
    manager.app.renderer.render(manager.app.stage)
    const extracted = manager.app.renderer.extract.canvas()
    let canvas = extracted
    if (extracted.width * extracted.height > MAX_HELD_FRAME_PIXELS) {
      const scale = Math.sqrt(MAX_HELD_FRAME_PIXELS / (extracted.width * extracted.height))
      canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(extracted.width * scale))
      canvas.height = Math.max(1, Math.round(extracted.height * scale))
      canvas.getContext('2d').drawImage(extracted, 0, 0, canvas.width, canvas.height)
    }
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    host.replaceChildren(canvas)
    if (!bridge && currentStep.value.type === 'adv') {
      for (const overlay of host.parentElement.querySelectorAll(':scope > .ui-overlay')) {
        host.appendChild(overlay.cloneNode(true))
      }
    }
    frameHolding.value = true
  } catch (error) {
    host.replaceChildren()
    console.warn('[StoryFrameHold] capture failed:', error?.message || error)
  }
}

function releaseFrameHold() {
  frameHolding.value = false
  frameHoldRequired.value = false
  heldTargetIndex = null
  frameHoldRoot.value?.replaceChildren()
}

const showAdvDialogue = computed(() => {
  const step = currentStep.value
  return step?.type === 'adv' && step?.hide_dialogue !== true && currentSceneState.value?.text_disabled !== true
})

const communicationContext = computed(() => resolveStoryPresentation({
  step: currentStep.value,
  stepIndex: currentStepIndex.value,
  historyStack: historyStack.value,
  steps: compiledData.value?.steps || [],
  scenarioId: compiledData.value?.scenario_id || '',
}))

// Preserve the last stage while an opaque communication surface is visible.
// A direct communication entry never constructs a renderer.
// Readiness binds to the exact projected step. A deep ref would proxy this
// plain object, making SpineStage's identity check wait forever after loading.
const retainedStageStep = shallowRef(null)
watch([stageStep, communicationContext], ([step, presentation]) => {
  if (compiledData.value && presentation.needsStage) retainedStageStep.value = step
}, { immediate: true, flush: 'sync' })

const playableStepNumber = computed(() => Math.max(1, currentStepIndex.value - navigationStartIndex.value + 1))
const playableStepTotal = computed(() => Math.max(0, navigationEndIndex.value - navigationStartIndex.value + 1))

if (!voicePlayer) {
  voicePlayer = useVoicePlayer({
    spineStageRef,
    currentStep,
    currentStepIndex,
    compiledData,
    isPlaying,
    noVoice: () => NO_VOICE || storySpeed.value > 1,
    canAnimateStage: () => communicationContext.value.needsStage,
    onStateChange: state => { voiceStatus.value = state },
    audioSession: storyAudioSession,
    backendMode: voiceBackend.value,
  })
}

const {
  isFirstStep,
  isLastStep,
  firstPlayableIndex,
  navigationStartIndex,
  navigationEndIndex,
  currentEpisode,
  firstAvailableBg,
  langLabel,
  cycleLanguage,
  applyStartStepIfNeeded,
  goNext: advanceStep,
  goPrev: navigatePrev,
  onChoice: navigateChoice,
  goToStep: navigateToStep,
  restoreToStep: navigateRestore,
} = useStoryNavigation({
  compiledData,
  currentStep,
  currentStepIndex,
  historyStack,
  selectedChoices,
  storyPreferences: storyLanguagePreferences,
  updateStoryPreferences: patch => {
    const saved = preferencesRepository.update(patch)
    setStoryLanguagePreferences(saved)
  },
  startStep: START_STEP,
  initialStep: props.initialStep,
  endStep: END_STEP,
  clearFadeAutoAdvance: () => clearFadeAutoAdvance(),
  ensureAudioCtx: _ensureAudioCtx,
  resetVoiceDedup: _resetVoiceDedup,
  beforeStepChange: beginFrameHold,
})

const mobileBackdropUrl = computed(() => {
  const backgroundId = currentSceneState.value?.bg || firstAvailableBg.value || ''
  return backgroundId ? getBgUrl(backgroundId) : ''
})

const communicationCompleted = computed(() => (
  episodeFinished.value && (communicationContext.value.mode === 'talk' || communicationContext.value.mode === 'call')
))

function finishEpisode() {
  if (episodeFinished.value) return
  clearFadeAutoAdvance()
  storyRuntimeCues.cancelCurrentStep('episode-complete')
  _stopCurrentVoice('episode-complete')
  episodeFinished.value = true
  completionDismissed.value = false
  chapterCountdownCancelled.value = false
  if (props.continuousPlayback && props.hasNextEpisode) {
    requestNextEpisode({ automatic: true })
  }
}

function initializeSnapshotHistory() {
  if (!compiledData.value) return
  sceneSnapshotStore.beginScenario({
    scenarioId: compiledData.value.scenario_id || props.scenarioUrl || 'inline-scenario',
    sourceHash: compiledData.value.source_hash || null,
    sourceRange: { start_step: START_STEP, end_step: END_STEP },
  })
  historyStack.value = []
  restoredSceneState.value = null
}

function recordHistoryStep(stepIndex = currentStepIndex.value) {
  if (!storyRuntimeCues.isSnapshotEnabled()) return null
  const step = storyRuntimeCues.getNormalizedStep(stepIndex)
  if (!isReadableHistoryStep(step) || !step?.settled_snapshot) return null
  return sceneSnapshotStore.record({
    stepIndex,
    step,
    snapshot: step.settled_snapshot,
    entrySnapshot: step.entry_snapshot,
    selectedChoices,
  })
}

function readIdentity(step) {
  if (!step || !Number.isInteger(step.step_id)) return null
  return {
    scenarioId: compiledData.value?.scenario_id || props.scenarioUrl || 'inline-scenario',
    sourceHash: compiledData.value?.source_hash || null,
    stepId: step.step_id,
  }
}

function isStepRead(step) {
  const identity = readIdentity(step)
  return identity ? readProgressRepository.has(createReadKey(identity)) : false
}

function markStepRead(stepIndex = currentStepIndex.value) {
  const identity = readIdentity(storyRuntimeCues.getNormalizedStep(stepIndex))
  if (identity) readProgressRepository.mark(identity)
}

function leaveRestoredScene() {
  restoredSceneState.value = null
}

function restoreSelectedChoices(values) {
  selectedChoices.clear()
  for (const [key, value] of Object.entries(values || {})) {
    const numericKey = Number(key)
    selectedChoices.set(Number.isNaN(numericKey) ? key : numericKey, value)
  }
}

function currentBacklogNode() {
  const step = storyRuntimeCues.getNormalizedStep()
  if (!isReadableHistoryStep(step)) return null
  return {
    node_id: `current:${step.step_id}`,
    episode_index: step.episode_index ?? null,
    step_index: currentStepIndex.value,
    step_id: step.step_id,
    dialogue: step.dialogue || null,
    selected_choices: Object.fromEntries(selectedChoices),
    voice: step.dialogue?.voice ? { cue: step.dialogue.voice } : null,
    current: true,
  }
}

function openBacklog() {
  if (RUNTIME_DEBUG) releaseSoakRecorder.record('backlog-open')
  menuOpen.value = false
  clearFadeAutoAdvance()
  storyRuntimeCues.cancelCurrentStep('backlog-open')
  _stopCurrentVoice('backlog-open')
  const current = currentBacklogNode()
  backlogNodes.value = [
    ...sceneSnapshotStore.list({ readableOnly: true }),
    ...(current ? [current] : []),
  ]
  backlogOpen.value = true
}

function closeOverlay() {
  if (backlogOpen.value) backlogOpen.value = false
  else if (menuOpen.value) menuOpen.value = false
}

function toggleAuto() {
  _ensureAudioCtx()
  playbackController?.setAuto(!autoEnabled.value)
}

// Native OnClickBackgroundPanel: while auto runs, the first tap on a line holds it there (stop
// icon on the balloon) and the next tap moves on, after which auto carries on. Without auto, or
// during a cut wait (which a tap clears), a tap moves on as before.
function tapNext() {
  if (autoEnabled.value && !autoHeld.value && !nativeCutWait.pending && !episodeFinished.value) {
    autoHeld.value = true
    return 'held'
  }
  const result = goNext()
  // The second tap is taken even when a cut wait now holds the screen; auto resumes after it.
  if (result !== 'blocked') autoHeld.value = false
  return result
}
watch(autoHeld, held => playbackController?.setPaused('tap-hold', held))
watch(autoEnabled, enabled => { if (!enabled) autoHeld.value = false })

// Native speed ×1.0 / ×1.5 / ×2.0 (AdventureSettingsPanel, one button cycling): the cue clock,
// idol motion, cut waits and auto timing run faster; BGM and SE keep their speed. Above ×1.0 the
// native voice switch is masked off, so voice stops and lines wait only for reading.
function setPlaybackRate(rate) {
  const speed = STORY_SPEEDS.includes(rate) ? rate : 1
  storySpeed.value = speed
  storyRuntimeCues.setRate(speed)
  spineStageRef.value?.manager?.setPlaybackRate?.(speed)
  playbackController?.setRate(speed)
  if (speed > 1) _stopCurrentVoice('story-speed')
  return speed
}

function cycleStorySpeed() {
  const next = STORY_SPEEDS[(STORY_SPEEDS.indexOf(storySpeed.value) + 1) % STORY_SPEEDS.length]
  storySpeed.value = preferencesRepository.update({ story_speed: setPlaybackRate(next) }).story_speed
}

function toggleSkip() {
  _ensureAudioCtx()
  playbackController?.setSkip(!skipEnabled.value, skipMode.value)
}

function saveAutoDelay() {
  playbackController?.setAutoDelay(autoDelayMs.value)
  const saved = preferencesRepository.update({ auto_delay_ms: autoDelayMs.value })
  autoDelayMs.value = saved.auto_delay_ms
}

function saveSkipMode() {
  const saved = preferencesRepository.update({ skip_mode: skipMode.value })
  skipMode.value = saved.skip_mode
  if (skipEnabled.value) playbackController?.setSkip(true, skipMode.value)
}

function stopPlaybackModes(reason = 'manual-navigation') {
  if (!playbackController) return
  playbackController.setAuto(false)
  playbackController.setSkip(false, skipMode.value)
  console.debug('[StoryPlayback]', reason)
}

function handlePlayerKeydown(event) {
  if (viewingOfferOpen.value) return
  if (event.target?.closest?.('button, a') && [' ', 'Enter'].includes(event.key)) return
  if (event.repeat) return
  const tag = event.target?.tagName
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) && event.key !== 'Escape') return
  const key = event.key.toLowerCase()
  if (key === 'escape') {
    event.preventDefault()
    if (!menuOpen.value && !backlogOpen.value && immersive.active.value) void immersive.leave()
    else closeOverlay()
  } else if (key === 'arrowleft') {
    event.preventDefault()
    goPrev()
  } else if (key === 'arrowright' || key === 'enter' || key === ' ') {
    event.preventDefault()
    goNext()
  } else if (key === 'a') {
    event.preventDefault()
    toggleAuto()
  } else if (key === 's' || key === 'control') {
    event.preventDefault()
    toggleSkip()
  } else if (key === 'l') {
    event.preventDefault()
    openBacklog()
  } else if (key === 'h') {
    event.preventDefault()
    uiHidden.value = !uiHidden.value
  }
}

function restoreHistoryNode(node) {
  const navigationSnapshot = node.navigation_snapshot || node.snapshot
  storyRuntimeCues.cancelCurrentStep('history-restore')
  restoreSelectedChoices(node.selected_choices)
  storyRuntimeCues.prepareRestore(node.step_index, navigationSnapshot)
  restoredSceneState.value = navigationSnapshot
  const remaining = sceneSnapshotStore.list().map(candidate => candidate.step_index)
  return navigateRestore(node.step_index, { historyIndices: remaining })
}

function restoreFromBacklog(nodeId) {
  const node = sceneSnapshotStore.get(nodeId)
  if (!node || !sceneSnapshotStore.truncateAfter(nodeId)) return
  sceneSnapshotStore.popPrevious()
  backlogOpen.value = false
  episodeFinished.value = false
  completionDismissed.value = false
  stopPlaybackModes('backlog-restore')
  if (!restoreHistoryNode(node)) restoredSceneState.value = null
}

// Preview mode (one voiced line: card voices, office lines, the profile self-introduction) has no dock
// or episode end: the line closes when its voice ends. Replay plays it again from its start (scene,
// motion timeline, lip, voice), which the backlog's silent restore does not: App publishes it anew.
function replayPreview() { emit('replay-preview') }
watch(voiceStatus, state => {
  if (props.previewOnly && state === 'ended' && isLastStep.value && !episodeFinished.value) goNext()
})

function replayBacklogVoice(node, backend) {
  backlogVoiceNode.value = node.node_id
  if (backend) { voiceBackend.value = backend; voicePlayer?.setBackendMode(backend) }
  _ensureAudioCtx()
  voicePlayer?.replayVoiceDetached?.({
    ...(compiledData.value?.steps?.[node.step_index] || {}),
    dialogue: node.dialogue,
  })
}

function goNext(source = 'user', onSettled) {
  if (episodeFinished.value || backlogOpen.value || menuOpen.value || viewingOfferOpen.value
      || runtimeReadinessStatus.value !== 'playable') return 'blocked'
  if (source === 'title-animation' && titlePaused.value) return 'blocked'
  if (source !== 'title-animation') titleAdvancePending = null
  if (source !== 'title-animation' && titleAnimationPending.value) {
    // Title steps own the full FX duration: a manual advance (or an explicit
    // skip) drops the pending animation and moves on immediately.
    setTitleAnimationPending(false)
  }
  // A tap during a cut wait clears it (client OnClickBackgroundPanel); auto mode waits it out.
  if (nativeCutWait.pending) {
    if (source === 'auto') return 'blocked'
    const held = nativeCutWait.step
    nativeCutWait.cancel()
    if (held?.step === currentStep.value) {
      if (!held.option) return leaveStep(held.manual)
      commitChoice(held.option)
      return 'advanced'
    }
  }
  const manual = typeof source !== 'string' || source === 'user'
  if (currentStep.value.type === 'choice') return 'blocked'
  const reason = typeof source === 'string' ? `${source}-next` : 'user-next'
  if (manual) {
    if (storyRuntimeCues.hasNonSkippable()) return 'blocked'
    storyRuntimeCues.cancelCurrentStep(reason)
    _stopCurrentVoice(reason)
  } else if (storyRuntimeCues.settleCurrentStep(reason, onSettled)) return 'settled'
  if (source !== 'skip') {
    const hold = nativeWaitSeconds(compiledData.value?.steps, currentStepIndex.value,
      finiteBranchNextIndex(compiledData.value, currentStepIndex.value))
    if (hold > 0) {
      const step = currentStep.value
      holdNativeCut({ step, manual }, hold / storySpeed.value, () => leaveStep(manual))
      return 'held'
    }
  }
  return leaveStep(manual)
}

// The wait counts down only while the story is running; an open menu or backlog
// (or any runtime pause) keeps it pending until the story resumes.
function holdNativeCut(entry, seconds, resume) {
  nativeCutWait.start(entry, seconds, function finish() {
    if (currentStep.value !== entry.step) return
    if (backlogOpen.value || menuOpen.value || viewingOfferOpen.value || runtimePauseReasons.size > 0) {
      nativeCutWait.start(entry, 0.05, finish)
      return
    }
    resume()
  })
}

function leaveStep(manual) {
  markStepRead()
  recordHistoryStep()
  leaveRestoredScene()
  if (isLastStep.value) {
    finishEpisode()
    return 'finished'
  }
  if (!advanceStep({ manual })) {
    finishEpisode()
    return 'finished'
  }
  return 'advanced'
}

function goPrev() {
  if (backlogOpen.value || menuOpen.value || viewingOfferOpen.value) return
  episodeFinished.value = false
  completionDismissed.value = false
  stopPlaybackModes('previous')
  storyRuntimeCues.cancelCurrentStep('previous')
  const node = storyRuntimeCues.isSnapshotEnabled() ? sceneSnapshotStore.popPrevious() : null
  if (node) {
    const navigationSnapshot = node.navigation_snapshot || node.snapshot
    const remaining = sceneSnapshotStore.list().map(candidate => candidate.step_index)
    restoreSelectedChoices(node.selected_choices)
    storyRuntimeCues.prepareRestore(node.step_index, navigationSnapshot)
    restoredSceneState.value = navigationSnapshot
    if (navigateRestore(node.step_index, { historyIndices: remaining })) return
    restoredSceneState.value = null
  }
  navigatePrev()
}

function onChoice(option) {
  if (nativeCutWait.pending) {
    // Choosing again during the wait skips it, like a tap.
    const held = nativeCutWait.step
    nativeCutWait.cancel()
    if (held?.step === currentStep.value && held.option) return commitChoice(held.option)
  }
  const hold = nativeWaitSeconds(compiledData.value?.steps, currentStepIndex.value,
    finiteChoiceTargetIndex(compiledData.value, currentStepIndex.value, option))
  if (hold > 0 && !playbackController?.skipEnabled) {
    storyRuntimeCues.cancelCurrentStep('choice')
    const step = currentStep.value
    holdNativeCut({ step, option }, hold, () => commitChoice(option))
    return
  }
  commitChoice(option)
}

function commitChoice(option) {
  if (RUNTIME_DEBUG) releaseSoakRecorder.record('choice-selected')
  storyRuntimeCues.cancelCurrentStep('choice')
  const choiceStepIndex = currentStepIndex.value
  markStepRead(choiceStepIndex)
  const outcome = navigateChoice(option)
  recordHistoryStep(choiceStepIndex)
  leaveRestoredScene()
  if (outcome === 'finished') finishEpisode()
}

function goToStep(index) {
  storyRuntimeCues.cancelCurrentStep('go-to-step')
  markStepRead()
  recordHistoryStep()
  leaveRestoredScene()
  navigateToStep(index)
}

function skipEpisode() {
  finishEpisode()
}

const stepSceneEffects = useStepSceneEffects({
  currentStepIndex,
  isLastStep,
  historyStack,
  spineStageRef,
  audioManager: _audioManager,
  voicePlayer,
  resetVoiceDedup: _resetVoiceDedup,
  onEpisodeEnd: finishEpisode,
  isAutoBlocked: () => isRuntimeAutoBlocked(),
  getRate: () => storySpeed.value,
  beforeAutoAdvance: () => {
    markStepRead()
    recordHistoryStep()
    leaveRestoredScene()
  },
  beforeStepChange: beginFrameHold,
  getSteps: () => compiledData.value?.steps,
})

const runtimePauseReasons = reactive(new Set())
const titlePaused = computed(() => runtimePauseReasons.size > 0 || uiHidden.value)
const storyRuntimeCues = useStoryRuntimeCues({
  compiledData,
  getStageStep: () => stageStep.value,
  needsStage: () => communicationContext.value.needsStage,
  prepareCommunication: ({ signal }) => warmCommunicationScene({
    scenario: compiledData.value, stepIndex: currentStepIndex.value,
    historyStack: historyStack.value, backdropUrl: mobileBackdropUrl.value, signal,
  }),
  currentStepIndex,
  spineStageRef,
  audioManager: _audioManager,
  debugSnapshotAt: SNAPSHOT_AT,
  isPaused: () => runtimePauseReasons.size > 0,
  debugSnapshotAction: () => freezeScene('snapshotAt'),
  onReadinessChange: handleRuntimeReadinessChange,
})

function handleRuntimeReadinessChange(readiness) {
  // The stage manager only exists once SpineStage mounts; new idols take its rate when they spawn.
  if (readiness.status === 'playable') spineStageRef.value?.manager?.setPlaybackRate?.(storySpeed.value)
  runtimeReadinessStatus.value = readiness.status
  runtimeReadinessReason.value = readiness.reason || ''
  const hasFrame = initialReadyEmitted.value && (frameHolding.value || !frameHoldRequired.value)
  const report = { ...readiness, hasFrame, instance: props.playbackInstance }
  emit('readiness-change', report)
  const buffering = readiness.status === 'waiting' || readiness.status === 'blocked'
  if (readiness.status === 'playable' && frameHolding.value && currentStepIndex.value === heldTargetIndex) {
    // Paint the completed target before the old frame is released or audio is
    // resumed; otherwise the next voice can lead the first visible frame.
    const manager = spineStageRef.value?.manager
    try { manager?.app?.renderer?.render(manager.app.stage) } catch (error) {
      console.warn('[StoryFrameHold] target render failed:', error?.message || error)
    }
    releaseFrameHold()
  }
  playbackController?.setPaused('buffering', buffering)
  setRuntimeSessionPaused('buffering', buffering)
  if (readiness.status !== 'playable') return
  const pending = pendingStepEffects
  if (pending && pending.step === currentStep.value && pending.stepIndex === currentStepIndex.value) {
    pendingStepEffects = null
    handleStepChange(pending.step, pending.oldStep, { restore: pending.restore })
  }
  if (!initialReadyEmitted.value) {
    initialReadyEmitted.value = true
    emit('ready')
  }
}

function setRuntimeSessionPaused(reason, paused) {
  setStoryRuntimePaused({ reasons: runtimePauseReasons, cues: storyRuntimeCues, audioSession: storyAudioSession }, reason, paused).catch(() => {})
}

function buildRuntimeDiagnostics({ includeProjector = false } = {}) {
  const memory = performance.memory
  const stageManager = spineStageRef.value?.manager
  const spineEntries = Object.entries(stageManager?.spineInstances || {})
  const silhouetteEntries = Object.entries(stageManager?._silhouetteSprites || {})
    .filter(([, sprite]) => Boolean(sprite))
  const pendingSilhouettes = Object.keys(stageManager?._silhouettePending || {})
  const runtime = storyRuntimeCues.inspect()
  return {
    captured_at: new Date().toISOString(),
    route: props.scenarioUrl || window.location.href,
    step: {
      index: currentStepIndex.value,
      id: currentStep.value?.step_id ?? null,
      type: currentStep.value?.type ?? null,
    },
    visibility: {
      state: document.visibilityState,
      hidden: document.hidden,
      debug_override: debugVisibilityOverride.value,
      pause_reasons: [...runtimePauseReasons].sort(),
    },
    audio_session: storyAudioSession.inspect(),
    voice_player: voicePlayer.getDiagnostics(),
    audio_manager: _audioManager.inspect(),
    playback: playbackController?.inspect() || null,
    step_effects: inspectStepSceneEffects(),
    runtime,
    ...(includeProjector ? { projector_shadow: storyRuntimeCues.inspectProjectorShadow() } : {}),
    runtime_active_count: runtime?.active?.length || 0,
    runtime_frame_pending: Number(Boolean(runtime?.frame_pending)),
    spine: {
      instances: spineEntries.length,
      ids: spineEntries.map(([id]) => id),
      models: spineEntries.map(([id, instance]) => ({ id, model: instance.modelId })),
      silhouettes: silhouetteEntries.length,
      silhouette_ids: silhouetteEntries.map(([id]) => id),
      pending_silhouettes: pendingSilhouettes.length,
      pending_silhouette_ids: pendingSilhouettes,
    },
    stage: stageManager?.inspectReleaseState?.() || null,
    memory: memory ? {
      used_js_heap_size: memory.usedJSHeapSize,
      total_js_heap_size: memory.totalJSHeapSize,
      js_heap_size_limit: memory.jsHeapSizeLimit,
    } : null,
  }
}

function refreshRuntimeDiagnostics() {
  if (!RUNTIME_DEBUG) return
  runtimeDiagnostics.value = {
    ...buildRuntimeDiagnostics(),
  }
}

const collectReleaseSoakSample = options => buildRuntimeDiagnostics(options)

function applyVisibilityPause(hidden) {
  pageHidden.value = Boolean(hidden)
  if (hidden) clearFadeAutoAdvance()
  playbackController?.setPaused('visibility', hidden)
  setRuntimeSessionPaused('visibility', hidden)
  if (RUNTIME_DEBUG) releaseSoakRecorder.record(hidden ? 'visibility-hidden' : 'visibility-visible')
  refreshRuntimeDiagnostics()
}

function applyDebugVisibility(hidden) {
  if (!RUNTIME_DEBUG) return
  debugVisibilityOverride.value = Boolean(hidden)
  applyVisibilityPause(debugVisibilityOverride.value)
}

// Auto mode's reading time for a line with no voice: about ten characters a second of the text
// shown first, capped so a long monologue still moves on.
function unvoicedReadingMs() {
  const step = currentStep.value
  // Above ×1.0 voice is off, so voiced lines wait for reading too (PlaybackModeController scales it).
  if (!step?.dialogue || (step.dialogue.voice && storySpeed.value === 1) || step.hide_dialogue === true) return 0
  const text = storyLocalization.resolveDialogue(step.dialogue).view?.primary?.text || ''
  return Math.min(8000, [...text.replace(/\s+/gu, '')].length * 100)
}
playbackController = new PlaybackModeController({
  getStep: () => storyRuntimeCues.getNormalizedStep(),
  getVoiceState: () => voicePlayer?.getVoiceState?.() || 'idle',
  hasBlockingAuto: () => storyRuntimeCues.hasBlockingAuto() || titleAnimationPending.value || nativeCutWait.pending,
  hasNonSkippable: () => storyRuntimeCues.hasNonSkippable(),
  isRead: isStepRead,
  getReadingMs: unvoicedReadingMs,
  autoDelayMs: autoDelayMs.value,
  onAdvance: source => goNext(source),
  onModeChange: state => {
    autoEnabled.value = state.auto_enabled
    skipEnabled.value = state.skip_enabled
    skipMode.value = state.skip_mode
    preferencesRepository.update({
      auto_enabled: state.auto_enabled,
      auto_delay_ms: autoDelayMs.value,
      skip_mode: state.skip_mode,
    })
    if (RUNTIME_DEBUG) {
      releaseSoakRecorder.record(
        state.auto_enabled ? 'auto-enabled' : state.skip_enabled ? 'skip-enabled' : 'playback-manual',
      )
    }
  },
})
playbackController.setAuto(autoEnabled.value)
setPlaybackRate(storySpeed.value)
setAudioLock(autoEnabled.value && !NO_AUDIO)

clearFadeAutoAdvance = stepSceneEffects.clearFadeAutoAdvance
handleStepChange = stepSceneEffects.handleStepChange
cleanupStepSceneEffects = stepSceneEffects.cleanup
inspectStepSceneEffects = stepSceneEffects.inspect
handleRuntimeStepChange = storyRuntimeCues.handleStepChange
cleanupRuntimeCues = storyRuntimeCues.cleanup
isRuntimeAutoBlocked = storyRuntimeCues.hasBlockingAuto

onMounted(async () => {
  updateViewingViewport()
  window.addEventListener('resize', updateViewingViewport)
  if (RUNTIME_DEBUG || URL_FLAGS.get('playerTrace') === '1') window.__GS_PLAYER_DIAGNOSTICS__ = buildRuntimeDiagnostics
  window.__STORY_PLAYBACK__ = playbackController
  window.__STORY_AUDIO__ = storyAudioSession
  document.addEventListener('visibilitychange', handleVisibilityChange)
  handleVisibilityChange()
  releaseAudioLockWhenRunning()
  if (RUNTIME_DEBUG) {
    unregisterReleaseViewer = storyReleaseProbe.registerViewer(collectReleaseSoakSample)
    releaseSoakRecorder.record('viewer-attached')
    refreshRuntimeDiagnostics()
    _runtimeDiagnosticsTimer = setInterval(refreshRuntimeDiagnostics, 2000)
  }
  // 全局调试工具：在 Console 输入 showAnims("001tom") 查看角色的所有动作
  window.showAnims = window.showAnims || (async (charaId, modelIdx) => {
    const models = ['001tom_002_00','001tom_003_00','001tom_004_00','001tom_004_01','001tom_005_00','001tom_101_00','001tom_101_01','001tom_102_00','001tom_103_00','001tom_103_01',
      '002dra_002_00','002dra_003_00','003min_002_00','003min_003_00','004ren_002_00','004ren_003_00','005sho_002_00','005sho_003_00',
      '006aio_002_00','006aio_003_00','007you_002_00','007you_003_00',
      '008ter_002_00','008ter_003_00','009ryu_002_00','009ryu_003_00',
      '010kai_002_00','010kai_003_00']
    const modelList = models.filter(m => m.startsWith(charaId))
    if (modelList.length === 0) { console.warn('Unknown charaId:', charaId, '- try one of:', [...new Set(models.map(m => m.split('_')[0]))].join(', ')); return }
    const targetModels = modelIdx !== undefined ? [modelList[modelIdx]] : modelList
    for (const modelId of targetModels) {
      try {
        const { Spine, SkeletonBinary, AtlasAttachmentLoader } = await import('@pixi-spine/runtime-3.8')
        const { TextureAtlas } = await import('@pixi-spine/base')
        const atlasUrl = `/assets/spines/${modelId}/comu.atlas`
        const skelUrl = `/assets/spines/${modelId}/comu.skel`
        const [atlasR, skelR] = await Promise.all([fetch(atlasUrl), fetch(skelUrl)])
        if (!atlasR.ok || !skelR.ok) { console.warn(`[${modelId}] files not found`); continue }
        const [atlasBuf, skelBuf] = await Promise.all([atlasR.arrayBuffer(), skelR.arrayBuffer()])
        const atlasText = new TextDecoder('utf-8').decode(skelBuf.slice(0, 100)).includes('size:')
          ? new TextDecoder('utf-8').decode(atlasBuf)
          : (() => { const v = new DataView(atlasBuf); const n = v.getUint32(0,true); const pad=(4-(4+n)%4)%4; return new TextDecoder('utf-8').decode(atlasBuf.slice(4+n+pad+4)) })()
        const texFile = atlasText.split('\n').find(l => /\.png/.test(l.trim()))?.trim() || 'comu.png'
        const texUrl = atlasUrl.replace('comu.atlas', texFile)
        const img = await new Promise((rs, rj) => { const i = new Image(); i.crossOrigin='anonymous'; i.onload=()=>rs(i); i.onerror=rj; i.src=texUrl })
        const texMap = {}; texMap[texFile] = { baseTexture: { alphaMode: 1, _image: img, valid: true } }
        const atlas = await new Promise((rs, rj) => {
          new TextureAtlas(atlasText, (p, cb) => { const f = p.split('/').pop(); cb(texMap[f]?.baseTexture || null) }, r => r ? rs(r) : rj())
        })
        atlas.pages.forEach(p => p.pma = true)
        const sd = new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(skelBuf))
        const anims = sd.animations.map(a => a.name)
        console.log(`%c> ${modelId} - ${anims.length} animations`, 'font-weight:bold;color:#88ddff;font-size:13px')
        console.log(anims.map((a, i) => `${String(i+1).padStart(2,'0')}. ${a}`).join('\n'))
      } catch (e) { console.warn(`[${modelId}] load failed:`, e.message) }
    }
  })
  console.log('[TIP] Console: type showAnims("001tom") to list all animations for a character')
  if (props.scenarioJson) {
    compiledData.value = props.scenarioJson
    applyStartStepIfNeeded()
    initializeSnapshotHistory()
  } else if (props.scenarioUrl) {
    await loadScenario(props.scenarioUrl)
  }

  // Focus root for keyboard events
  nextTick(() => { if (viewingOfferOpen.value) viewingOfferAction.value?.focus(); else playerRoot.value?.focus() })

  // SpineStage and the Runtime publish source-bound readiness. The player no
  // longer treats a timeout or a duplicate warmup request as playable proof.
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewingViewport)
  stopChapterCountdownTimer()
  clearTimeout(audioTapTimer)
  titleAdvancePending = null
  nativeCutWait.cancel()
  pendingStepEffects = null
  releaseFrameHold()
  if (RUNTIME_DEBUG) console.debug('[Lifecycle] StoryViewer onBeforeUnmount')
  cleanupStepSceneEffects()
  cleanupRuntimeCues()
  playbackController?.dispose()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (window.__GS_PLAYER_DIAGNOSTICS__ === buildRuntimeDiagnostics) delete window.__GS_PLAYER_DIAGNOSTICS__
  if (window.__STORY_PLAYBACK__ === playbackController) delete window.__STORY_PLAYBACK__
  if (window.__STORY_AUDIO__ === storyAudioSession) delete window.__STORY_AUDIO__
  if (_runtimeDiagnosticsTimer) {
    clearInterval(_runtimeDiagnosticsTimer)
    _runtimeDiagnosticsTimer = null
  }
  voicePlayer?.dispose?.()
  _audioManager.dispose()
  storyAudioSession.dispose().catch(() => {})
})

onUnmounted(() => {
  unregisterReleaseViewer?.()
  unregisterReleaseViewer = null
  if (RUNTIME_DEBUG) releaseSoakRecorder.record('viewer-detached')
})

// Keep the legacy effects watcher behavior unchanged. The opt-in runtime watcher
// is immediate so a scenario opened directly at an authored step is scheduled.
watch(currentStep, (newStep, oldStep) => {
  // Catch-all release: any navigation that is not the title's own completion
  // (prev, backlog restore, go-to-step, episode end) must drop the hold. The
  // incoming title card re-claims it from its own onMounted.
  titleAdvancePending = null
  setTitleAnimationPending(false)
  nativeCutWait.cancel()
  autoHeld.value = false
  pendingStepEffects = {
    step: newStep,
    oldStep,
    stepIndex: currentStepIndex.value,
    restore: Boolean(restoredSceneState.value),
  }
  clearFadeAutoAdvance()
  _stopCurrentVoice('step-buffering')
  isPlaying.value = false
  playbackController?.notifyStateChanged()
})
watch(currentStep, handleRuntimeStepChange, { immediate: true })
watch([menuOpen, backlogOpen, episodeFinished, viewingOfferOpen, () => props.recoveryOpen], ([menu, backlog, finished, viewingOffer, recovery], previous = []) => {
  const any = menu || backlog || finished || viewingOffer || recovery
  if (any) clearFadeAutoAdvance()
  playbackController?.setPaused('overlay', any)
  transferOverlayPause(setRuntimeSessionPaused, [['menu', menu], ['backlog', backlog], ['episode-complete', finished], ['viewing-offer', viewingOffer], ['recovery', recovery]])
  if ([menu, backlog, finished, viewingOffer, recovery].some((value, index) => value && !previous[index]) || (previous[1] && !backlog)) {
    _stopCurrentVoice('overlay-transition')
    backlogVoiceNode.value = ''
  }
}, { immediate: true })
// A late queue lookup must not turn a completed episode into a permanent dead end.
watch(() => props.hasNextEpisode, hasNext => {
  if (hasNext && episodeFinished.value && props.continuousPlayback && !transitioning.value) {
    requestNextEpisode({ automatic: true })
  }
})
// The countdown holds while anything covers the end bar or the page is hidden, and resumes
// from where it stopped; leaving the finished state (previous, backlog) resets it.
watch([chapterCountdownEligible, () => menuOpen.value || backlogOpen.value || viewingOfferOpen.value || props.recoveryOpen || pageHidden.value], ([eligible, held]) => {
  if (!eligible) { stopChapterCountdownTimer(); chapterCountdownLeftMs.value = 0; return }
  if (!chapterCountdownLeftMs.value) chapterCountdownLeftMs.value = CHAPTER_COUNTDOWN_MS
  if (held) { stopChapterCountdownTimer(); return }
  if (chapterCountdownTimer) return
  let last = performance.now()
  chapterCountdownTimer = setInterval(() => {
    const now = performance.now()
    chapterCountdownLeftMs.value = Math.max(0, chapterCountdownLeftMs.value - (now - last))
    last = now
    if (!chapterCountdownLeftMs.value) requestNextEpisode({ automatic: true, chapter: true })
  }, 100)
}, { immediate: true })
watch([immersiveEligible, smallScreen, portraitScreen], ([eligible, small, portrait]) => {
  if (eligible && small && portrait && !immersive.active.value && !immersive.pending.value && !uiHidden.value && mobileViewMode.value === 'ask' && playerSession.claimOffer()) {
    viewingOfferOpen.value = true
    nextTick(() => viewingOfferAction.value?.focus())
  }
})
watch(titlePaused, paused => {
  if (!paused) retryTitleAdvance()
})
watch(currentStep, step => {
  if (step?.step_id != null) emit('step-change', { instance: props.playbackInstance, stepIndex: currentStepIndex.value })
}, { immediate: true })
watch(uiHidden, hidden => {
  preferencesRepository.update({ ui_hidden: hidden })
})

function handleVisibilityChange() {
  debugVisibilityOverride.value = null
  applyVisibilityPause(document.hidden)
}



async function loadScenario(url) {
  try {
    const sep = url.includes('?') ? '&' : '?'
    const r = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' })
    compiledData.value = await r.json()
    applyStartStepIfNeeded()
    initializeSnapshotHistory()
  } catch (err) {
    console.error('[StoryViewer] Failed to load:', err)
  }
}

defineExpose({ goNext, goPrev, goToStep, currentStepIndex, freezeScene, setPlaybackRate })
</script>

<style scoped>
.voice-recovery { position: absolute; top: var(--player-content-top); left: var(--player-edge); z-index: 32; display: flex; flex-wrap: wrap; gap: 8px; max-width: calc(100% - 2 * var(--player-edge)); }
.voice-recovery button { min-height: 44px; padding: 8px 12px; border: 1px solid #96bbb6; border-radius: 8px; color: #176f69; background: #f7faf9; cursor: pointer; }

.viewing-offer { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; padding: 20px; background: rgba(6,21,33,.7); }
.viewing-offer-panel { box-sizing: border-box; width: min(100%, 400px); max-height: 100%; overflow: auto; padding: 24px; border-radius: 20px; background: #f7faf9; color: #193c44; box-shadow: 0 14px 50px #0006; display: grid; gap: 14px; }
.viewing-offer h2 { margin: 0; font-size: 22px; }
.viewing-offer p { margin: 0; line-height: 1.7; }
.viewing-offer label { display: flex; align-items: center; gap: 8px; min-height: 44px; }
.viewing-offer button, .viewing-notice button { min-height: 44px; padding: 8px 14px; border: 1px solid #97b9b5; border-radius: 10px; color: #176f69; background: white; font: inherit; cursor: pointer; }
.viewing-offer button.primary { background: #176f69; color: white; }
.viewing-offer button:focus-visible, .viewing-notice button:focus-visible { outline: 3px solid #45b8ae; outline-offset: 2px; }
.viewing-notice { position: absolute; top: max(64px, var(--player-content-top)); left: 50%; transform: translateX(-50%); z-index: 30; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: max-content; max-width: calc(100% - 32px); box-sizing: border-box; padding: 8px 12px; border-radius: 12px; background: #f7faf9; color: #23434a; box-shadow: 0 8px 25px #0004; font-size: 13px; }
@media (orientation: landscape) and (max-height: 600px) {
  .story-viewer-root.immersive-landscape { --player-edge: 8px; --player-topbar-height: 0px; --player-topbar-gap: 0px; --player-dock-gap: 6px; --player-dock-bottom: 6px; --player-dock-height: 44px; --player-dialogue-gap: 6px; --player-dialogue-bottom: calc(56px + env(safe-area-inset-bottom)); --player-content-top: max(8px, env(safe-area-inset-top)); }
}

.story-viewer-root {
  position: fixed; inset: 0;
  outline: none; background: #000;
  --player-edge: 20px;
  --player-topbar-height: 52px;
  --player-topbar-gap: 14px;
  --player-dock-gap: 18px;
  --player-content-top: calc(var(--player-edge) + var(--player-topbar-height) + var(--player-topbar-gap));
  --player-content-bottom: calc(var(--player-dock-bottom) + var(--player-dock-height) + var(--player-dock-gap) + env(safe-area-inset-bottom));
}
.playback-menu h3, .menu-position { padding: 8px 16px; margin: 0; font-size: 14px; }
.viewer-stage {
  position: relative;
  width: 100%; height: 100%;
  overflow: hidden;
}
.viewer-stage :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.held-scene { position: absolute; inset: 0; z-index: 10; overflow: hidden; pointer-events: none; }
.local-buffering {
  position: absolute; z-index: 25;
  top: max(var(--player-content-top), env(safe-area-inset-top, 0px));
  left: max(var(--player-edge), env(safe-area-inset-left, 0px));
  max-width: calc(100% - max(var(--player-edge), env(safe-area-inset-left, 0px)) - max(var(--player-edge), env(safe-area-inset-right, 0px)));
  pointer-events: none;
  animation: gs-step-feedback-in 100ms ease-out 160ms both; /* pending delay is 160ms here, not --gs-pending-delay (140ms): the player has its own pacing; unify only after a feel check */
}
@keyframes gs-step-feedback-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .local-buffering { animation: none; } }
.ui-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 1;
  pointer-events: none;
}
.ui-overlay > * {
  pointer-events: auto;
}
.ui-overlay.held-underlay > * { pointer-events: none; }
@media (max-width: 760px) {
  .story-viewer-root {
    --player-edge: 10px;
    --player-topbar-height: 48px;
    --player-topbar-gap: 8px;
    --player-dock-gap: 10px;
  }
}
.runtime-diagnostics {
  position: fixed;
  top: 48px;
  right: 12px;
  z-index: 10000;
  width: min(420px, calc(100vw - 24px));
  max-height: calc(100vh - 96px);
  margin: 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid rgba(102, 221, 255, 0.45);
  border-radius: 8px;
  background: rgba(3, 12, 20, 0.88);
  color: #bfefff;
  font: 11px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace;
  pointer-events: none;
  white-space: pre-wrap;
}
.runtime-debug-actions {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 10001;
  display: flex;
  gap: 6px;
}
.runtime-debug-actions button {
  padding: 6px 8px;
  border: 1px solid rgba(102, 221, 255, 0.55);
  border-radius: 6px;
  background: rgba(3, 12, 20, 0.9);
  color: #bfefff;
  font: 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  cursor: pointer;
}
/* The dialogue box comes and goes with its alpha only, as the native panel does (AdventureBalloonTextPanel.UpdateAlpha /
   FadeInText / FadeOutText; their timings are not decompiled). It leaves faster than it arrives so it never holds up the
   next scene; no blur, which is costly over a full-width box and smears the text. */
.adv-dialogue-fade-enter-active { transition: opacity var(--player-motion-base) var(--player-ease-standard); }
.adv-dialogue-fade-leave-active { transition: opacity var(--player-motion-fast) ease-in; }
.adv-dialogue-fade-enter-from,
.adv-dialogue-fade-leave-to {
  opacity: 0;
}
.icon-btn { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid rgba(255,255,255,.3); border-radius: 4px; background: rgba(255,255,255,.12); color: #fff; cursor: pointer; }
.icon-btn.dark { border-color: #d8e0e3; background: #fff; color: #26343c; }
.restore-ui {
  position: absolute;
  top: var(--player-space-4);
  right: var(--player-space-5);
  z-index: 30;
  display: grid;
  place-items: center;
  width: var(--player-hit-min);
  height: var(--player-hit-min);
  border: 1px solid var(--player-control-border);
  border-radius: var(--player-radius-control);
  background: var(--player-control-surface);
  color: var(--player-control-ink);
  box-shadow: 0 4px 16px rgba(3, 12, 20, 0.16);
  cursor: pointer;
  transition:
    background var(--player-motion-fast) var(--player-ease-standard),
    transform var(--player-motion-fast) var(--player-ease-standard);
}
.restore-ui:hover {
  background: var(--player-control-surface-hover);
  transform: translateY(-2px);
}
.restore-ui:focus-visible {
  outline: 2px solid var(--player-focus-outer);
  outline-offset: 2px;
}
/* End of a story or a chat: a bar in the dock's place and of its height, so nothing above it
   moves. Status on the left, then 回看 and the one navy action. */
.episode-complete {
  position: absolute; z-index: 35; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--player-dock-bottom) + env(safe-area-inset-bottom));
  box-sizing: border-box; display: flex; align-items: center; gap: var(--gs-space-3);
  width: min(560px, calc(100% - 2 * var(--player-edge))); min-height: var(--player-dock-height);
  padding: var(--gs-space-2) var(--gs-space-2) var(--gs-space-2) var(--gs-space-5);
  border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink); box-shadow: var(--gs-shadow-float);
}
.end-copy { flex: 1; min-width: 0; display: grid; line-height: 1.35; }
.end-copy strong, .end-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.end-copy strong { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.end-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.end-actions { flex: none; display: flex; gap: var(--gs-space-2); }
.end-actions button { min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink); cursor: pointer; font: inherit; font-size: var(--gs-text-ui); white-space: nowrap; }
.end-actions button.primary { border-color: var(--gs-action-bg); background: var(--gs-action-bg); color: var(--gs-action-ink); font-weight: var(--gs-weight-semibold); }
.end-actions button:disabled { opacity: .5; cursor: default; }
.episode-complete.is-preview .end-actions button { display: inline-flex; align-items: center; gap: var(--gs-space-2); }
.end-actions button:focus-visible, .audio-tap:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.end-countdown { position: relative; flex: none; width: 28px; height: 28px; margin-left: calc(-1 * var(--gs-space-2)); }
.end-countdown svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.end-countdown circle { fill: none; stroke-width: 2.5; stroke-dasharray: 62.83; }
.end-countdown .track { stroke: var(--gs-line); }
.end-countdown .fill { stroke: var(--gs-mint); transition: stroke-dashoffset .1s linear; }
@media (max-width: 760px) {
  .episode-complete { gap: var(--gs-space-2); padding-left: var(--gs-space-4); }
  .end-actions button { padding: 0 var(--gs-space-3); }
}
@media (prefers-reduced-motion: reduce) { .end-countdown .fill { transition: none; } }
/* Auto is on but this player's audio has not started: one tap starts it. */
.audio-tap {
  position: absolute; z-index: 21; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--player-dock-bottom) + var(--player-dock-height) + var(--gs-space-3) + env(safe-area-inset-bottom));
  display: inline-flex; align-items: center; gap: 6px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-5);
  border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-mint-ink);
  box-shadow: var(--gs-shadow-float); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; white-space: nowrap;
}

/* A curtain over the player: the same corner as LoadingScreen's player curtain it follows. */
.story-data-loading {
  position: absolute; z-index: 25;
  right: max(var(--gs-curtain-edge), env(safe-area-inset-right, 0px));
  bottom: max(var(--gs-curtain-edge), env(safe-area-inset-bottom, 0px));
  max-width: min(22rem, calc(100% - 32px));
}
.complete-loading { margin-top: 8px; max-width: 100%; }
</style>
