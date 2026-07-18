<template>
  <div class="story-viewer-root" :class="{ 'stage-only': HIDE_UI || uiHidden }" tabindex="0" @keydown.left="goPrev" @keydown.right="goNext">
    <div class="viewer-stage">
    <!-- Spine rendering layer (background + characters) -->
    <SpineStage ref="spineStageRef" :step="currentStep" :fallbackBg="firstAvailableBg" />

    <!-- Top bar -->
    <div class="top-bar" v-if="compiledData && !HIDE_UI && !uiHidden">
      <button class="bar-btn" @click="$emit('back')">Back</button>
      <div class="progress-counter">
        <span v-if="currentEpisodeLabel" class="episode-badge">{{ currentEpisodeLabel }}</span>
        <span class="step-counter">{{ playableStepNumber }} / {{ playableStepTotal }}</span>
      </div>
      <div class="top-bar-right">
        <button class="lang-btn" @click.stop="cycleLanguage">{{ langLabel }}</button>
        <button class="icon-btn" title="Menu" aria-label="Menu" @click.stop="menuOpen = true"><Menu :size="19" /></button>
      </div>
    </div>

    <button v-if="uiHidden && !HIDE_UI" class="restore-ui" title="Show UI" aria-label="Show UI" @click.stop="uiHidden = false">
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

      <!-- Time/location caption -->
      <TextTimeUI v-if="currentStep.type === 'text_time'" :step="currentStep" @next="goNext" />

    </div>

    <!-- Bottom navigation bar -->
    <div class="nav-bar" v-if="compiledData && compiledData.steps.length > 0 && !HIDE_UI && !uiHidden && !episodeFinished">
      <button class="nav-btn" @click.stop="goPrev" :disabled="isFirstStep">Prev</button>
      <span class="nav-label">{{ currentStep.type }}</span>
      <button class="nav-btn" title="Next" aria-label="Next" @click.stop="goNext"><ChevronRight :size="21" /></button>
    </div>

    <Transition name="menu-slide">
      <aside v-if="menuOpen && !HIDE_UI" class="playback-menu" aria-label="Playback menu">
        <header><strong>MENU</strong><button class="icon-btn dark" title="Close" aria-label="Close" @click="menuOpen = false"><X :size="20" /></button></header>
        <label class="menu-toggle">
          <span>连续播放</span>
          <input type="checkbox" :checked="continuousPlayback" @change="emit('update:continuous-playback', $event.target.checked)" />
        </label>
        <button @click="uiHidden = true; menuOpen = false"><EyeOff :size="19" /><span>隐藏 UI</span></button>
        <button @click="skipEpisode"><SkipForward :size="19" /><span>跳过本话</span></button>
        <button @click="emit('back')"><LogOut :size="19" /><span>返回目录</span></button>
      </aside>
    </Transition>

    <div v-if="episodeFinished && !HIDE_UI" class="episode-complete">
      <div class="complete-panel">
        <span>{{ hasNextEpisode ? 'EPISODE COMPLETE' : 'STORY COMPLETE' }}</span>
        <strong>{{ hasNextEpisode ? '本话播放完毕' : '故事播放完毕' }}</strong>
        <p v-if="transitioning">正在加载下一话...</p>
        <div v-else>
          <button v-if="hasNextEpisode" class="primary" @click="emit('next-episode')"><SkipForward :size="18" />下一话</button>
          <button @click="emit('back')"><LogOut :size="18" />返回目录</button>
        </div>
      </div>
    </div>

    </div><!-- /viewer-stage -->
    <div class="loading" v-if="!compiledData && !HIDE_UI">Loading story data...</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, reactive, nextTick, defineAsyncComponent } from 'vue'
import AdvUI from '../components/AdvUI.vue'
import MobileUI from '../components/MobileUI.vue'
import CallUI from '../components/CallUI.vue'
import ChoiceUI from '../components/ChoiceUI.vue'
import TitleUI from '../components/TitleUI.vue'
import TextTimeUI from '../components/TextTimeUI.vue'
import { ChevronRight, Eye, EyeOff, LogOut, Menu, SkipForward, X } from '@lucide/vue'
// SpineStage is lazy-loaded so PIXI.js only loads when a story opens
const SpineStage = defineAsyncComponent(() => import('../components/SpineStage.vue'))
import { languageMode, setLanguageMode } from '../utils/LanguageStore.js'
import { useVoicePlayer } from './useVoicePlayer.js'
import { AudioManager } from './AudioManager.js'
import { useTimelineRunner } from './useTimelineRunner.js'
import { useStoryNavigation } from './useStoryNavigation.js'
import { useStepSceneEffects } from './useStepSceneEffects.js'

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
const NO_VOICE = URL_FLAGS.get('noVoice') === '1'
const SNAPSHOT_AT_VALUE = URL_FLAGS.get('snapshotAt')
const SNAPSHOT_AT = SNAPSHOT_AT_VALUE == null || SNAPSHOT_AT_VALUE === '' ? null : Number(SNAPSHOT_AT_VALUE)

const spineStageRef = ref(null)
const compiledData = ref(null)
const currentStepIndex = ref(0)
const historyStack = ref([])
const selectedChoices = reactive(new Map())
const _ready = ref(false)
const isPlaying = ref(false)
const menuOpen = ref(false)
const uiHidden = ref(false)
const episodeFinished = ref(false)
const transitioning = ref(false)

let _readyTimer = null

const _audioManager = new AudioManager()

let voicePlayer = null
let clearFadeAutoAdvance = () => {}
let clearSnapshotTimer = () => {}
let clearSeTimers = () => {}
let scheduleSnapshot = () => {}
let handleStepChange = () => {}
let cleanupStepSceneEffects = () => {}

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
  voicePlayer?.ensureAudioCtx?.()
  _audioManager.ensureContext()
}

function _resetVoiceDedup() {
  voicePlayer?.resetVoiceDedup?.()
}

function _stopCurrentVoice(reason = 'unspecified') {
  voicePlayer?.stopCurrentVoice?.(reason)
}

function freezeScene(reason = 'snapshot') {
  clearFadeAutoAdvance()
  clearSnapshotTimer()
  cancelTimeline()
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

const showAdvDialogue = computed(() => {
  const step = currentStep.value
  return step?.type === 'adv' && step?.hide_dialogue !== true && step?.state?.text_disabled !== true
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
  })
}

const { startTimeline, fastForwardTimeline, cancelTimeline } = useTimelineRunner({
  spineStageRef,
  currentStep,
})

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
  goPrev,
  onChoice,
  goToStep,
} = useStoryNavigation({
  compiledData,
  currentStep,
  currentStepIndex,
  historyStack,
  selectedChoices,
  languageMode,
  setLanguageMode,
  startStep: START_STEP,
  endStep: END_STEP,
  clearFadeAutoAdvance: () => clearFadeAutoAdvance(),
  fastForwardTimeline,
  ensureAudioCtx: _ensureAudioCtx,
  resetVoiceDedup: _resetVoiceDedup,
})

function finishEpisode() {
  if (episodeFinished.value) return
  clearFadeAutoAdvance()
  fastForwardTimeline()
  _stopCurrentVoice('episode-complete')
  menuOpen.value = false
  episodeFinished.value = true
  if (props.continuousPlayback && props.hasNextEpisode) {
    transitioning.value = true
    emit('next-episode')
  }
}

function goNext() {
  if (episodeFinished.value) return
  if (isLastStep.value) finishEpisode()
  else advanceStep()
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
  startTimeline,
  onEpisodeEnd: finishEpisode,
  snapshotAt: SNAPSHOT_AT,
  snapshotAction: () => { window.__SNAPSHOT__ = freezeScene('snapshotAt') },
})

clearFadeAutoAdvance = stepSceneEffects.clearFadeAutoAdvance
clearSnapshotTimer = stepSceneEffects.clearSnapshotTimer
clearSeTimers = stepSceneEffects.clearSeTimers
scheduleSnapshot = stepSceneEffects.scheduleSnapshot
handleStepChange = stepSceneEffects.handleStepChange
cleanupStepSceneEffects = stepSceneEffects.cleanup

onMounted(async () => {
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
    const firstStep = currentStep.value
    if (firstStep?.state) {
      try {
        if (firstStep.state.bg) {
          await mgr.preloadStepState(firstStep.state)
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
  console.warn('[Lifecycle] StoryViewer onBeforeUnmount FIRED!')
  cleanupStepSceneEffects()
  if (_readyTimer) {
    clearTimeout(_readyTimer)
    _readyTimer = null
  }
  fastForwardTimeline()
  _stopCurrentVoice('onBeforeUnmount')
  // Stop BGM and ambient in AudioManager
  _audioManager.dispose()
  _resetVoiceDedup()
})

// Watch step changes to trigger voice playback and timeline
watch(currentStep, handleStepChange)



async function loadScenario(url) {
  try {
    const sep = url.includes('?') ? '&' : '?'
    const r = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' })
    compiledData.value = await r.json()
    applyStartStepIfNeeded()
  } catch (err) {
    console.error('[StoryViewer] Failed to load:', err)
  }
}

defineExpose({ goNext, goPrev, goToStep, currentStepIndex, freezeScene })
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
.top-bar {
  position: absolute; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 12px; background: rgba(0,0,0,0.35);
}
.bar-btn {
  background: rgba(255,255,255,0.15); color: #fff; border: none; padding: 4px 10px;
  border-radius: 4px; cursor: pointer; font-size: 0.75rem;
}
.bar-btn:hover { background: rgba(255,255,255,0.25); }
.progress-counter {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
.step-counter { color: rgba(255,255,255,0.78); font-size: 0.75rem; }
.episode-badge {
  color: #061521;
  background: rgba(136, 221, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.top-bar-right { display: flex; align-items: center; gap: 6px; }
.lang-btn {
  background: rgba(255,255,255,0.12); color: #88ddff; border: 1px solid rgba(136,221,255,0.3);
  padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;
  font-weight: bold; letter-spacing: 0.5px;
}
.lang-btn:hover { background: rgba(136,221,255,0.2); }
.nav-bar {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
  display: flex; justify-content: center; align-items: center; gap: 24px;
  padding: 6px 16px; background: rgba(0,0,0,0.25);
}
.nav-btn {
  background: transparent; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.25);
  border-radius: 50%; width: 36px; height: 36px;
  cursor: pointer; font-size: 1rem; line-height: 1;
}
.nav-btn:hover { background: rgba(255,255,255,0.15); }
.nav-btn:disabled { opacity: 0.3; cursor: default; }
.nav-btn svg { display: block; margin: auto; }
.nav-label { color: rgba(255,255,255,0.5); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; }

.icon-btn { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid rgba(255,255,255,.3); border-radius: 4px; background: rgba(255,255,255,.12); color: #fff; cursor: pointer; }
.icon-btn.dark { border-color: #d8e0e3; background: #fff; color: #26343c; }
.restore-ui { position: absolute; top: 12px; right: 12px; z-index: 30; display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.55); border-radius: 5px; background: rgba(15,25,30,.58); color: #fff; cursor: pointer; }
.playback-menu { position: absolute; top: 0; right: 0; z-index: 40; display: flex; flex-direction: column; gap: 8px; width: min(320px, 86vw); height: 100%; padding: 18px; border-left: 1px solid #dfe5e7; background: rgba(248,250,251,.97); color: #26343c; box-shadow: -10px 0 30px rgba(0,0,0,.22); }
.playback-menu header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 1.25rem; }
.playback-menu > button, .menu-toggle { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 13px; border: 1px solid #dce3e6; border-radius: 5px; background: #fff; color: #26343c; font: inherit; cursor: pointer; }
.menu-toggle { justify-content: space-between; cursor: default; }
.menu-toggle input { width: 42px; height: 22px; accent-color: #12a87d; cursor: pointer; }
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


