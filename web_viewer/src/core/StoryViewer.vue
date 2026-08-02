<template>
  <div class="story-viewer-root" :class="{ 'stage-only': HIDE_UI || uiHidden }" tabindex="0"
    @pointerdown.capture="_ensureAudioCtx" @keydown="handlePlayerKeydown">
    <pre
      v-if="RUNTIME_DEBUG"
      class="runtime-diagnostics"
      data-testid="story-runtime-diagnostics"
    >{{ JSON.stringify(runtimeDiagnostics, null, 2) }}</pre>
    <div v-if="RUNTIME_DEBUG" class="runtime-debug-actions">
      <button data-testid="story-debug-hide" @click.stop="applyDebugVisibility(true)">SIMULATE HIDDEN</button>
      <button data-testid="story-debug-show" @click.stop="applyDebugVisibility(false)">SIMULATE VISIBLE</button>
      <button data-testid="story-soak-start" @click.stop="startReleaseSoak">START SOAK</button>
      <button data-testid="story-soak-stop" @click.stop="stopReleaseSoak">STOP SOAK</button>
      <button data-testid="story-soak-export" @click.stop="exportReleaseSoak">EXPORT SOAK</button>
    </div>
    <textarea
      v-if="RUNTIME_DEBUG && releaseSoakExport"
      class="runtime-soak-export"
      data-testid="story-release-soak-export"
      :value="releaseSoakExport"
      readonly
    ></textarea>
    <div class="viewer-stage">
    <!-- Spine rendering layer (background + characters) -->
    <SpineStage ref="spineStageRef" :step="stageStep" :fallbackBg="firstAvailableBg" :debug-controls="RUNTIME_DEBUG" />

    <!-- Top bar -->
    <PlayerTopBar
      v-if="compiledData && !HIDE_UI && !uiHidden"
      :episode-label="currentEpisodeLabel"
      :current="playableStepNumber"
      :total="playableStepTotal"
      :language="langLabel"
      @back="$emit('back')"
      @language="cycleLanguage"
      @menu="menuOpen = true"
    />

    <button v-if="uiHidden && !HIDE_UI" class="restore-ui" :title="uiText('player.showUi')" :aria-label="uiText('player.showUi')" @click.stop="uiHidden = false">
      <Eye :size="20" />
    </button>

    <!-- Voice audio player: handled by the Web Audio API to avoid IDM sniffing -->

    <!-- UI overlay for step-specific screens -->
    <div class="ui-overlay" v-if="compiledData && !HIDE_UI && !uiHidden && !episodeFinished">

      <!-- ADV dialogue -->
      <Transition name="adv-dialogue-fade" appear>
        <AdvUI
          v-if="showAdvDialogue"
          :dialogue="currentStep.dialogue"
          :step="currentStep"
          :playing="isPlaying"
          @click="goNext"
        />
      </Transition>

      <!-- Talk / chat mode: keep the component mounted across choice steps -->
      <MobileUI v-show="currentStep.type === 'talk' || currentStep.type === 'talk_stamp'"
        :dialogue="currentStep.dialogue" :step="currentStep"
        :stepIndex="currentStepIndex" :scenarioId="compiledData?.scenario_id"
        :historyStack="historyStack" :choiceTexts="choiceTexts" />

      <!-- Phone call -->
      <CallUI v-if="currentStep.type === 'call'" :dialogue="currentStep.dialogue" :step="currentStep" @select="onChoice" />

      <!-- Choice / selection -->
      <ChoiceUI
        v-if="currentStep.type === 'choice'"
        :step="currentStep"
        @select="onChoice"
      />

      <!-- Title (episode/chapter title card) -->
      <TitleUI v-if="currentStep.type === 'title'" :step="currentStep" />

      <!-- Pre-play synopsis -->
      <SynopsisUI v-if="currentStep.type === 'synopsis'" :step="currentStep" />

      <!-- Time/location caption -->
      <TextTimeUI v-if="currentStep.type === 'text_time'" :step="currentStep" @next="goNext" />

    </div>

    <!-- Bottom control dock -->
    <PlayerControlDock
      v-if="compiledData && compiledData.steps.length > 0 && !HIDE_UI && !uiHidden && !episodeFinished"
      :auto-enabled="autoEnabled"
      :skip-enabled="skipEnabled"
      :previous-disabled="isFirstStep"
      @previous="goPrev"
      @auto="toggleAuto"
      @skip="toggleSkip"
      @backlog="openBacklog"
      @next="goNext"
    />

    <Transition name="menu-slide">
      <aside v-if="menuOpen && !HIDE_UI" class="playback-menu" :aria-label="uiText('player.settings.panel')">
        <header><strong>MENU</strong><button class="icon-btn dark" :title="uiText('player.settings.close')" :aria-label="uiText('player.settings.close')" @click="menuOpen = false"><X :size="20" /></button></header>
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
        <button :class="{ active: skipEnabled }" @click="toggleSkip"><FastForward :size="19" /><span>{{ uiText('player.settings.skip') }}</span><b>{{ skipEnabled ? 'ON' : 'OFF' }}</b></button>
        <label class="menu-setting">
          <span>{{ uiText('player.settings.skipRange') }}</span>
          <select v-model="skipMode" @change="saveSkipMode"><option value="readOnly">{{ uiText('player.settings.readOnly') }}</option><option value="all">{{ uiText('player.settings.all') }}</option></select>
        </label>
        <label class="menu-setting">
          <span>{{ uiText('player.settings.uiLanguage') }}</span>
          <select :value="uiLocale" @change="saveUiLocale"><option value="zh-CN">简体中文</option><option value="ja-JP">日本語</option></select>
        </label>
        <button @click="uiHidden = true; menuOpen = false"><EyeOff :size="19" /><span>{{ uiText('player.settings.hideUi') }}</span></button>
        <button @click="openBacklog"><BookOpenText :size="19" /><span>{{ uiText('player.settings.backlog') }}</span></button>
        <button @click="skipEpisode"><SkipForward :size="19" /><span>{{ uiText('player.settings.skipEpisode') }}</span></button>
        <button @click="emit('back')"><LogOut :size="19" /><span>{{ uiText('player.settings.returnCatalog') }}</span></button>
      </aside>
    </Transition>

    <StoryBacklog
      v-if="backlogOpen && !HIDE_UI"
      :nodes="backlogNodes"
      @close="backlogOpen = false"
      @restore="restoreFromBacklog"
      @replay-voice="replayBacklogVoice"
    />

    <div v-if="episodeFinished && !HIDE_UI" class="episode-complete">
      <div class="complete-panel">
        <span>{{ hasNextEpisode ? 'EPISODE COMPLETE' : 'STORY COMPLETE' }}</span>
        <strong>{{ hasNextEpisode ? uiText('player.complete.episode') : uiText('player.complete.story') }}</strong>
        <p v-if="transitioning">{{ uiText('player.complete.loadingNext') }}</p>
        <div v-else>
          <button v-if="hasNextEpisode" class="primary" @click="emit('next-episode')"><SkipForward :size="18" />{{ uiText('player.complete.nextEpisode') }}</button>
          <button @click="emit('back')"><LogOut :size="18" />{{ uiText('player.settings.returnCatalog') }}</button>
        </div>
      </div>
    </div>

    </div><!-- /viewer-stage -->
    <div class="loading" v-if="!compiledData && !HIDE_UI">{{ uiText('player.loading') }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, reactive, nextTick, defineAsyncComponent } from 'vue'
import AdvUI from '../components/AdvUI.vue'
import MobileUI from '../components/MobileUI.vue'
import CallUI from '../components/CallUI.vue'
import ChoiceUI from '../components/ChoiceUI.vue'
import TitleUI from '../components/TitleUI.vue'
import SynopsisUI from '../components/SynopsisUI.vue'
import TextTimeUI from '../components/TextTimeUI.vue'
import StoryBacklog from '../components/StoryBacklog.vue'
import { BookOpenText, Eye, EyeOff, FastForward, LogOut, Play, SkipForward, X } from '@lucide/vue'
import PlayerTopBar from '../components/player/PlayerTopBar.vue'
import PlayerControlDock from '../components/player/PlayerControlDock.vue'
// SpineStage is lazy-loaded so PIXI.js only loads when a story opens
const SpineStage = defineAsyncComponent(() => import('../components/SpineStage.vue'))
import {
  setStoryLanguagePreferences,
  storyLanguagePreferences,
  uiLocale,
} from '../utils/LanguageStore.js'
import { resolveUiText as uiText } from '../localization/ui/UiTextResolver.js'
import { useVoicePlayer } from './useVoicePlayer.js'
import { AudioManager } from './AudioManager.js'
import { useStoryNavigation } from './useStoryNavigation.js'
import { useStepSceneEffects } from './useStepSceneEffects.js'
import { useStoryRuntimeCues } from './story-runtime/useStoryRuntimeCues.js'
import { StoryAudioSession } from './story-runtime/StoryAudioSession.js'
import { getStepSceneState, projectStepSceneState } from './story-runtime/StepSceneState.js'
import { SceneSnapshotStore, isReadableHistoryStep } from './story-runtime/SceneSnapshotStore.js'
import { PlayerPreferencesRepository } from './story-runtime/PlayerPreferencesRepository.js'
import { ReadProgressRepository, createReadKey } from './story-runtime/ReadProgressRepository.js'
import { PlaybackModeController } from './story-runtime/PlaybackModeController.js'
import { releaseSoakRecorder } from './story-runtime/ReleaseSoakRecorder.js'
import {
  createStoryLocalization,
  provideStoryLocalization,
} from '../localization/story/StoryLocalizationContext.js'

const props = defineProps({
  scenarioJson: { type: Object, default: null },
  scenarioUrl: { type: String, default: null },
  startStep: { type: Number, default: null },
  endStep: { type: Number, default: null },
  hasNextEpisode: { type: Boolean, default: false },
  continuousPlayback: { type: Boolean, default: false },
})
const emit = defineEmits(['back', 'ready', 'next-episode', 'update:continuous-playback'])
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
provideStoryLocalization(createStoryLocalization({
  compiledData,
  storyPreferences: storyLanguagePreferences,
}))
const currentStepIndex = ref(0)
const historyStack = ref([])
const selectedChoices = reactive(new Map())
const restoredSceneState = ref(null)
const sceneSnapshotStore = new SceneSnapshotStore()
const _ready = ref(false)
const isPlaying = ref(false)
const menuOpen = ref(false)
const backlogOpen = ref(false)
const backlogNodes = ref([])
const autoEnabled = ref(initialPreferences.auto_enabled)
const autoDelayMs = ref(initialPreferences.auto_delay_ms)
const skipEnabled = ref(false)
const skipMode = ref(initialPreferences.skip_mode)
const uiHidden = ref(initialPreferences.ui_hidden)
const episodeFinished = ref(false)
const transitioning = ref(false)
const runtimeDiagnostics = ref(null)
const releaseSoakExport = ref('')
const debugVisibilityOverride = ref(null)

let _readyTimer = null
let _runtimeDiagnosticsTimer = null

const storyAudioSession = new StoryAudioSession({
  busVolumes: { bgm: 0.7, ambient: 0.7, voice: 1, se: 0.7 },
  disabled: NO_AUDIO,
})
const _audioManager = new AudioManager({ audioSession: storyAudioSession })

let voicePlayer = null
let clearFadeAutoAdvance = () => {}
let handleStepChange = () => {}
let cleanupStepSceneEffects = () => {}
let handleRuntimeStepChange = () => {}
let cleanupRuntimeCues = () => {}
let isRuntimeAutoBlocked = () => false
let playbackController = null

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
  playbackController?.setPaused('audio-lock', false)
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

// Computed: expose selectedChoices as plain object for MobileUI prop reactivity
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

const currentSceneState = computed(() => restoredSceneState.value || getStepSceneState(currentStep.value))
const stageStep = computed(() => projectStepSceneState(currentStep.value, currentSceneState.value))

const showAdvDialogue = computed(() => {
  const step = currentStep.value
  return step?.type === 'adv' && step?.hide_dialogue !== true && currentSceneState.value?.text_disabled !== true
})

const playableStepNumber = computed(() => Math.max(1, currentStepIndex.value - navigationStartIndex.value + 1))
const playableStepTotal = computed(() => Math.max(0, navigationEndIndex.value - navigationStartIndex.value + 1))

if (!voicePlayer) {
  voicePlayer = useVoicePlayer({
    spineStageRef,
    currentStep,
    currentStepIndex,
    compiledData,
    isPlaying,
    noVoice: NO_VOICE,
    audioSession: storyAudioSession,
  })
}

const {
  isFirstStep,
  isLastStep,
  firstPlayableIndex,
  navigationStartIndex,
  navigationEndIndex,
  currentEpisode,
  currentEpisodeLabel,
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
  endStep: END_STEP,
  clearFadeAutoAdvance: () => clearFadeAutoAdvance(),
  ensureAudioCtx: _ensureAudioCtx,
  resetVoiceDedup: _resetVoiceDedup,
})

function finishEpisode() {
  if (episodeFinished.value) return
  clearFadeAutoAdvance()
  storyRuntimeCues.cancelCurrentStep('episode-complete')
  _stopCurrentVoice('episode-complete')
  menuOpen.value = false
  episodeFinished.value = true
  if (props.continuousPlayback && props.hasNextEpisode) {
    transitioning.value = true
    emit('next-episode')
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

function saveUiLocale(event) {
  const saved = preferencesRepository.update({ ui_locale: event.target.value })
  setStoryLanguagePreferences(saved)
}

function stopPlaybackModes(reason = 'manual-navigation') {
  if (!playbackController) return
  playbackController.setAuto(false)
  playbackController.setSkip(false, skipMode.value)
  console.debug('[StoryPlayback]', reason)
}

function handlePlayerKeydown(event) {
  if (event.repeat) return
  const tag = event.target?.tagName
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) && event.key !== 'Escape') return
  const key = event.key.toLowerCase()
  if (key === 'escape') {
    event.preventDefault()
    closeOverlay()
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
  stopPlaybackModes('backlog-restore')
  if (!restoreHistoryNode(node)) restoredSceneState.value = null
}

function replayBacklogVoice(node) {
  _ensureAudioCtx()
  voicePlayer?.replayVoiceDetached?.({
    ...(compiledData.value?.steps?.[node.step_index] || {}),
    dialogue: node.dialogue,
  })
}

function goNext(source = 'user') {
  if (episodeFinished.value || backlogOpen.value || menuOpen.value) return 'blocked'
  const reason = typeof source === 'string' ? `${source}-next` : 'user-next'
  if (storyRuntimeCues.settleCurrentStep(reason)) return 'settled'
  markStepRead()
  recordHistoryStep()
  leaveRestoredScene()
  if (isLastStep.value) {
    finishEpisode()
    return 'finished'
  }
  advanceStep()
  return 'advanced'
}

function goPrev() {
  if (backlogOpen.value || menuOpen.value) return
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
  storyRuntimeCues.cancelCurrentStep('choice')
  const choiceStepIndex = currentStepIndex.value
  markStepRead(choiceStepIndex)
  navigateChoice(option)
  recordHistoryStep(choiceStepIndex)
  leaveRestoredScene()
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
  beforeAutoAdvance: () => {
    markStepRead()
    recordHistoryStep()
    leaveRestoredScene()
  },
})

const storyRuntimeCues = useStoryRuntimeCues({
  compiledData,
  currentStepIndex,
  spineStageRef,
  audioManager: _audioManager,
  debugSnapshotAt: SNAPSHOT_AT,
  debugSnapshotAction: () => freezeScene('snapshotAt'),
})

const runtimePauseReasons = new Set()
function setRuntimeSessionPaused(reason, paused) {
  const wasPaused = runtimePauseReasons.size > 0
  if (paused) runtimePauseReasons.add(reason)
  else runtimePauseReasons.delete(reason)
  const isPaused = runtimePauseReasons.size > 0
  if (!wasPaused && isPaused) storyRuntimeCues.pause().catch(() => {})
  if (wasPaused && !isPaused) storyRuntimeCues.resume().catch(() => {})
  const audioTransition = paused
    ? storyAudioSession.pause(reason)
    : storyAudioSession.resume(reason)
  audioTransition.catch(() => {})
}

function setPlaybackRate(rate) {
  const appliedRate = storyAudioSession.setRate(rate)
  storyRuntimeCues.setRate(appliedRate)
  return appliedRate
}

function buildRuntimeDiagnostics() {
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
    audio_manager: _audioManager.inspect(),
    playback: playbackController?.inspect() || null,
    runtime,
    runtime_active_count: runtime?.active?.length || 0,
    spine: {
      instances: spineEntries.length,
      ids: spineEntries.map(([id]) => id),
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
    release_soak: releaseSoakRecorder.inspect(),
  }
}

const collectReleaseSoakSample = () => buildRuntimeDiagnostics()

function startReleaseSoak() {
  if (!RUNTIME_DEBUG) return
  releaseSoakExport.value = ''
  releaseSoakRecorder.start()
  refreshRuntimeDiagnostics()
}

function stopReleaseSoak() {
  if (!RUNTIME_DEBUG) return
  releaseSoakRecorder.stop()
  refreshRuntimeDiagnostics()
}

function exportReleaseSoak() {
  if (!RUNTIME_DEBUG) return
  releaseSoakExport.value = JSON.stringify(releaseSoakRecorder.export(), null, 2)
}

function applyVisibilityPause(hidden) {
  if (hidden) clearFadeAutoAdvance()
  playbackController?.setPaused('visibility', hidden)
  setRuntimeSessionPaused('visibility', hidden)
  refreshRuntimeDiagnostics()
}

function applyDebugVisibility(hidden) {
  if (!RUNTIME_DEBUG) return
  debugVisibilityOverride.value = Boolean(hidden)
  applyVisibilityPause(debugVisibilityOverride.value)
}

playbackController = new PlaybackModeController({
  getStep: () => storyRuntimeCues.getNormalizedStep(),
  getVoiceState: () => voicePlayer?.getVoiceState?.() || 'idle',
  hasBlockingAuto: () => storyRuntimeCues.hasBlockingAuto(),
  hasNonSkippable: () => storyRuntimeCues.hasNonSkippable(),
  isRead: isStepRead,
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
  },
})
playbackController.setAuto(autoEnabled.value)
playbackController.setPaused('audio-lock', autoEnabled.value && !NO_AUDIO)

clearFadeAutoAdvance = stepSceneEffects.clearFadeAutoAdvance
handleStepChange = stepSceneEffects.handleStepChange
cleanupStepSceneEffects = stepSceneEffects.cleanup
handleRuntimeStepChange = storyRuntimeCues.handleStepChange
cleanupRuntimeCues = storyRuntimeCues.cleanup
isRuntimeAutoBlocked = storyRuntimeCues.hasBlockingAuto

onMounted(async () => {
  window.__STORY_PLAYBACK__ = playbackController
  window.__STORY_AUDIO__ = storyAudioSession
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (RUNTIME_DEBUG) {
    releaseSoakRecorder.attachCollector(collectReleaseSoakSample)
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
  nextTick(() => { document.querySelector('.story-viewer-root')?.focus() })

  // Safety timeout: ready always fires within 5s even if assets fail
  _readyTimer = setTimeout(() => {
    if (!_ready.value) {
      _ready.value = true
      emit('ready')
    }
  }, 5000)

  // The Preloader (called from App.vue) has already cached all assets.
  // PIXI.Assets.load() will resolve instantly from cache.
  const mgr = spineStageRef.value?.manager
  if (compiledData.value && mgr) {
    const firstState = currentSceneState.value
    if (firstState) {
      try {
        if (firstState.bg) {
          await mgr.preloadStepState(firstState)
        }
      } catch (e) {
        console.warn('[StoryViewer] preload warmup failed:', e.message)
      }
    }
  }

  if (_readyTimer) {
    clearTimeout(_readyTimer)
    _readyTimer = null
  }

  // SpineStage applies first step state reactively via :step prop binding.
  // No explicit applyStepState call needed.

  // Voice playback is handled in watch(currentStep) for a single source of truth

  // Enable runtime watch
  _ready.value = true
  emit('ready')
})

onBeforeUnmount(() => {
  if (RUNTIME_DEBUG) console.debug('[Lifecycle] StoryViewer onBeforeUnmount')
  cleanupStepSceneEffects()
  cleanupRuntimeCues()
  playbackController?.dispose()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (window.__STORY_PLAYBACK__ === playbackController) delete window.__STORY_PLAYBACK__
  if (window.__STORY_AUDIO__ === storyAudioSession) delete window.__STORY_AUDIO__
  if (_readyTimer) {
    clearTimeout(_readyTimer)
    _readyTimer = null
  }
  if (_runtimeDiagnosticsTimer) {
    clearInterval(_runtimeDiagnosticsTimer)
    _runtimeDiagnosticsTimer = null
  }
  if (RUNTIME_DEBUG) releaseSoakRecorder.detachCollector(collectReleaseSoakSample)
  voicePlayer?.dispose?.()
  _audioManager.dispose()
  storyAudioSession.dispose().catch(() => {})
})

// Keep the legacy effects watcher behavior unchanged. The opt-in runtime watcher
// is immediate so a scenario opened directly at an authored step is scheduled.
watch(currentStep, (newStep, oldStep) => {
  handleStepChange(newStep, oldStep, { restore: Boolean(restoredSceneState.value) })
  playbackController?.notifyStateChanged()
})
watch(currentStep, handleRuntimeStepChange, { immediate: true })
watch([menuOpen, backlogOpen, episodeFinished], ([menu, backlog, finished]) => {
  if (menu || backlog || finished) clearFadeAutoAdvance()
  playbackController?.setPaused('overlay', menu || backlog || finished)
  setRuntimeSessionPaused('overlay', menu || backlog || finished)
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
.story-viewer-root {
  position: fixed; inset: 0;
  outline: none; background: #000;
}
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
.ui-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 1;
  pointer-events: none;
}
.ui-overlay > * {
  pointer-events: auto;
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
.runtime-soak-export {
  position: fixed;
  left: 12px;
  bottom: 48px;
  z-index: 10002;
  width: min(560px, calc(100vw - 24px));
  height: min(320px, calc(100vh - 96px));
  padding: 10px;
  resize: both;
  border: 1px solid rgba(102, 221, 255, 0.55);
  border-radius: 8px;
  background: rgba(3, 12, 20, 0.94);
  color: #bfefff;
  font: 11px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace;
}
.adv-dialogue-fade-enter-active,
.adv-dialogue-fade-leave-active {
  transition:
    opacity 280ms ease,
    transform 280ms ease,
    filter 280ms ease;
}
.adv-dialogue-fade-enter-from,
.adv-dialogue-fade-leave-to {
  opacity: 0;
  transform: translateY(14px);
  filter: blur(2px);
}
.adv-dialogue-fade-enter-to,
.adv-dialogue-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}
.icon-btn { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid rgba(255,255,255,.3); border-radius: 4px; background: rgba(255,255,255,.12); color: #fff; cursor: pointer; }
.icon-btn.dark { border-color: #d8e0e3; background: #fff; color: #26343c; }
.restore-ui { position: absolute; top: 12px; right: 12px; z-index: 30; display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.55); border-radius: 5px; background: rgba(15,25,30,.58); color: #fff; cursor: pointer; }
.playback-menu { position: absolute; top: 0; right: 0; z-index: 40; display: flex; flex-direction: column; gap: 8px; width: min(320px, 86vw); height: 100%; padding: 18px; border-left: 1px solid #dfe5e7; background: rgba(248,250,251,.97); color: #26343c; box-shadow: -10px 0 30px rgba(0,0,0,.22); }
.playback-menu header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 1.25rem; }
.playback-menu > button, .menu-toggle { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 13px; border: 1px solid #dce3e6; border-radius: 5px; background: #fff; color: #26343c; font: inherit; cursor: pointer; }
.playback-menu > button b { margin-left: auto; color: #718087; font-size: .68rem; }
.playback-menu > button.active { border-color: #33aa92; background: #e9f8f4; color: #167a67; }
.playback-menu > button.active b { color: #167a67; }
.menu-toggle { justify-content: space-between; cursor: default; }
.menu-toggle input { width: 42px; height: 22px; accent-color: #12a87d; cursor: pointer; }
.menu-setting { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 7px; min-height: 42px; padding: 0 13px; border: 1px solid #e3e8ea; border-radius: 5px; background: #f7f9fa; color: #4b5b63; font-size: .78rem; }
.menu-setting input { width: 76px; }
.menu-setting select, .menu-setting input { min-height: 28px; border: 1px solid #ccd5d9; border-radius: 4px; background: #fff; color: #26343c; }
.menu-setting small { color: #839096; }
.episode-complete { position: absolute; inset: 0; z-index: 35; display: grid; place-items: center; background: rgba(0,0,0,.5); }
.complete-panel { width: min(390px, calc(100vw - 32px)); padding: 24px; border: 1px solid rgba(255,255,255,.6); border-radius: 6px; background: rgba(250,252,252,.97); color: #26343c; text-align: center; box-shadow: 0 18px 45px rgba(0,0,0,.28); }
.complete-panel > span { color: #0d9c75; font-size: .66rem; font-weight: 800; }
.complete-panel > strong { display: block; margin: 6px 0 18px; font-size: 1.05rem; }
.complete-panel p { margin: 8px 0 0; color: #64727a; }
.complete-panel div { display: flex; justify-content: center; gap: 8px; }
.complete-panel button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 0 14px; border: 1px solid #d6dfe2; border-radius: 5px; background: #fff; color: #26343c; cursor: pointer; font: inherit; }
.complete-panel button.primary { border-color: #0d9c75; background: #0d9c75; color: #fff; }
.menu-slide-enter-active, .menu-slide-leave-active { transition: transform 180ms ease, opacity 180ms ease; }
.menu-slide-enter-from, .menu-slide-leave-to { transform: translateX(100%); opacity: 0; }

.loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #333; font-size: 1.2rem; }
</style>
