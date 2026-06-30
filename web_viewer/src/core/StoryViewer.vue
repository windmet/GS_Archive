<template>
  <div class="story-viewer-root" :class="{ 'stage-only': HIDE_UI }" tabindex="0" @keydown.left="goPrev" @keydown.right="goNext">
    <div class="viewer-stage">
    <!-- Spine rendering layer (background + characters) -->
    <SpineStage ref="spineStageRef" :step="currentStep" :fallbackBg="firstAvailableBg" />

    <!-- Top bar -->
    <div class="top-bar" v-if="compiledData && !HIDE_UI">
      <button class="bar-btn" @click="$emit('back')">Back</button>
      <div class="progress-counter">
        <span v-if="currentEpisodeLabel" class="episode-badge">{{ currentEpisodeLabel }}</span>
        <span class="step-counter">{{ currentStepIndex + 1 }} / {{ compiledData.steps.length }}</span>
      </div>
      <div class="top-bar-right">
        <button class="lang-btn" @click.stop="cycleLanguage">{{ langLabel }}</button>
        <button class="bar-btn" v-if="!isLastStep" @click="goNext">Skip →</button>
      </div>
    </div>

    <!-- Voice audio player: handled by the Web Audio API to avoid IDM sniffing -->

    <!-- UI overlay for step-specific screens -->
    <div class="ui-overlay" v-if="compiledData && !HIDE_UI">

      <!-- ADV dialogue -->
      <AdvUI v-if="currentStep.type === 'adv'" :dialogue="currentStep.dialogue" :step="currentStep" :playing="isPlaying" @click="goNext" />

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

      <!-- Synopsis (summary text with glassmorphism) -->
      <SynopsisUI v-if="currentStep.type === 'synopsis'" :step="currentStep" />

      <!-- Time/location caption -->
      <TextTimeUI v-if="currentStep.type === 'text_time'" :step="currentStep" @next="goNext" />

    </div>

    <!-- Bottom navigation bar -->
    <div class="nav-bar" v-if="compiledData && compiledData.steps.length > 0 && !HIDE_UI">
      <button class="nav-btn" @click.stop="goPrev" :disabled="isFirstStep">Prev</button>
      <span class="nav-label">{{ currentStep.type }}</span>
      <button class="nav-btn" @click.stop="goNext" :disabled="isLastStep">▶</button>
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
import SynopsisUI from '../components/SynopsisUI.vue'
import TextTimeUI from '../components/TextTimeUI.vue'
// SpineStage is lazy-loaded so PIXI.js only loads when a story opens
const SpineStage = defineAsyncComponent(() => import('../components/SpineStage.vue'))
import { languageMode, setLanguageMode } from '../utils/LanguageStore.js'
import { getAutoAdvanceTiming, isTransitionStep } from '../utils/StoryStepFlow.js'
import { useVoicePlayer } from './useVoicePlayer.js'
import { AudioManager } from './AudioManager.js'

const props = defineProps({
  scenarioJson: { type: Object, default: null },
  scenarioUrl: { type: String, default: null },
})
const emit = defineEmits(['back', 'ready'])
const URL_FLAGS = new URLSearchParams(window.location.search)
const HIDE_UI = URL_FLAGS.get('stageOnly') === '1' || URL_FLAGS.get('hideUI') === '1' || URL_FLAGS.get('transparentUI') === '1'
const START_STEP_VALUE = URL_FLAGS.get('startStep')
const START_STEP = START_STEP_VALUE == null || START_STEP_VALUE === '' ? null : Number(START_STEP_VALUE)
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

// 鈹€鈹€ Timeline (mid-sentence face/animation changes) 鈹€鈹€
let _timelineEvents = []
const _firedTimeline = new Set()
let _timelineStartTime = 0
let _timelineRAF = false
let _fadeAutoTimer = null
let _fadeAutoSeq = 0
let _snapshotTimer = null
let _seTimers = []

// 鈹€鈹€ 闈炶闊抽煶棰戯紙SE/鐜闊?BGM锛夌鐞?鈹€鈹€
const _audioManager = new AudioManager()
let _lastEnvCue = null
let _lastBgmId = null

let voicePlayer = null

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
}

function _resetVoiceDedup() {
  voicePlayer?.resetVoiceDedup?.()
}

function _clearFadeAutoAdvance() {
  _fadeAutoSeq++
  if (_fadeAutoTimer) {
    clearTimeout(_fadeAutoTimer)
    _fadeAutoTimer = null
  }
}

function _clearSnapshotTimer() {
  if (_snapshotTimer) {
    clearTimeout(_snapshotTimer)
    _snapshotTimer = null
  }
}

function _clearSeTimers() {
  for (const timer of _seTimers) {
    clearTimeout(timer)
  }
  _seTimers = []
}

function _playStepSE(se) {
  if (!se?.cue) return
  const rawDelay = se.delay ?? se.volume ?? 0
  const delay = Number.parseFloat(rawDelay)
  if (Number.isFinite(delay) && delay > 0) {
    const timer = setTimeout(() => {
      _audioManager.playSE(se.cue)
    }, delay * 1000)
    _seTimers.push(timer)
  } else {
    _audioManager.playSE(se.cue)
  }
}

function _stopCurrentVoice(reason = 'unspecified') {
  voicePlayer?.stopCurrentVoice?.(reason)
}


// 鈹€鈹€ Timeline (mid-sentence face/animation changes) 鈹€鈹€

function _startTimeline() {
  _cancelTimeline()
  const step = currentStep.value
  if (!step?.timeline || step.timeline.length === 0) {
    _timelineEvents = []
    return
  }
  _timelineEvents = step.timeline
  _firedTimeline.clear()
  _timelineStartTime = performance.now()
  _timelineRAF = true
  _tickTimeline()
}

function _tickTimeline() {
  if (!_timelineRAF) return
  // Stop polling once all events fired
  if (_firedTimeline.size >= _timelineEvents.length) {
    _timelineRAF = false
    return
  }

  const elapsed = (performance.now() - _timelineStartTime) / 1000

  for (let i = 0; i < _timelineEvents.length; i++) {
    if (_firedTimeline.has(i)) continue
    if (elapsed >= _timelineEvents[i].time) {
      _fireTimelineEvent(_timelineEvents[i])
      _firedTimeline.add(i)
    }
  }

  requestAnimationFrame(_tickTimeline)
}

function _fireTimelineEvent(event) {
  const mgr = spineStageRef.value?.manager
  if (!mgr) return
  console.log('[Timeline] fire:', event.type, event.chara_id, event.value, 'at', event.time + 's')
  if (event.type === 'spine_face') {
    mgr.updateSpineFace(event.chara_id, event.value, {
      anim_flag: event.anim_flag,
      blush_flag: event.blush_flag,
      sweat_flag: event.sweat_flag,
    })
  } else if (event.type === 'spine_anim') {
    if (event.no_back) mgr.playSpineAnim?.(event.chara_id, event.value, false, true)
    else mgr.switchSpineAnim(event.chara_id, event.value)
  } else if (event.type === 'spine_neck_anim') {
    mgr.playSpineNeckAnim?.(event.chara_id, event.value)
  } else if (event.type === 'spine_neck_stop') {
    mgr.stopSpineNeckAnim?.(event.chara_id)
  } else if (event.type === 'spine_color') {
    mgr.setSpineColor(event.chara_id, event.value, event.duration ?? 0, 0)
  }
}

/**
 * Fast-forward: fire all remaining un-fired timeline events instantly.
 * Must be called BEFORE navigating to the next step, so the spine state
 * catches up to where it would have been had the timeline completed naturally.
 */
function _fastForwardTimeline() {
  if (!_timelineEvents || _timelineEvents.length === 0) return
  for (let i = 0; i < _timelineEvents.length; i++) {
    if (_firedTimeline.has(i)) continue
    _fireTimelineEvent(_timelineEvents[i])
    _firedTimeline.add(i)
  }
  _cancelTimeline()
}

function _cancelTimeline() {
  _timelineRAF = false
  _timelineEvents = []
  _firedTimeline.clear()
}

function freezeScene(reason = 'snapshot') {
  _clearFadeAutoAdvance()
  _clearSnapshotTimer()
  _cancelTimeline()
  spineStageRef.value?.manager?.cancelAllSpineTweens?.()
  _stopCurrentVoice(reason)
  return spineStageRef.value?.dumpScene?.() || window.dumpScene?.() || []
}

function scheduleSnapshot() {
  _clearSnapshotTimer()
  if (!Number.isFinite(SNAPSHOT_AT) || SNAPSHOT_AT < 0) return
  _snapshotTimer = setTimeout(() => {
    window.__SNAPSHOT__ = freezeScene('snapshotAt')
  }, SNAPSHOT_AT * 1000)
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

const isFirstStep = computed(() => historyStack.value.length === 0)
const isLastStep = computed(() => !compiledData.value || currentStepIndex.value >= compiledData.value.steps.length - 1)

const currentEpisode = computed(() => {
  const episodes = compiledData.value?.episodes || []
  if (!episodes.length) return null
  const current = currentStepIndex.value
  return episodes.find(ep => current >= ep.start_step_index && current <= ep.end_step_index) || null
})

const currentEpisodeLabel = computed(() => {
  const ep = currentEpisode.value
  if (!ep) {
    const idx = currentStep.value?.episode_index
    if (idx == null) return ''
    return `EP${String(Number(idx) + 1).padStart(2, '0')}`
  }
  const no = String(ep.episode_no || ep.episode_index + 1).padStart(2, '0')
  return `EP${no}`
})

const firstAvailableBg = computed(() => {
  if (!compiledData.value?.steps) return null
  for (const step of compiledData.value.steps) {
    if (step.state?.bg) return step.state.bg
  }
  return null
})

const langLabel = computed(() => {
  const labels = { JP: 'JP', CN: '涓枃', BILINGUAL: 'JP+CN' }
  return labels[languageMode.value] || 'JP'
})

const LANG_CYCLE = ['JP', 'CN', 'BILINGUAL']
function cycleLanguage() {
  const cur = languageMode.value
  const idx = LANG_CYCLE.indexOf(cur)
  setLanguageMode(LANG_CYCLE[(idx + 1) % LANG_CYCLE.length])
}

function applyStartStepIfNeeded() {
  if (!compiledData.value?.steps?.length) return
  if (!Number.isFinite(START_STEP)) return
  const target = Math.max(0, Math.min(compiledData.value.steps.length - 1, START_STEP - 1))
  currentStepIndex.value = target
}

onMounted(async () => {
  // 全局调试工具：在 Console 输入 showAnims("001tom") 查看角色的所有动作
  window.showAnims = window.showAnims || (async (charaId, modelIdx) => {
    const models = ['001tom_002_00','001tom_003_00','001tom_004_00','001tom_004_01','001tom_005_00','001tom_101_00','001tom_101_01','001tom_102_00','001tom_103_00','001tom_103_01',
      '002dra_002_00','002dra_003_00','003min_002_00','003min_003_00','004ren_002_00','004ren_003_00','005sho_002_00','005sho_003_00',
      '006aio_002_00','006aio_003_00','007you_002_00','007you_003_00',
      '008ter_002_00','008ter_003_00','009ryu_002_00','009ryu_003_00',
      '010kai_002_00','010kai_003_00']
    const modelList = models.filter(m => m.startsWith(charaId))
    if (modelList.length === 0) { console.warn('Unknown charaId:', charaId, '鈥?try one of:', [...new Set(models.map(m => m.split('_')[0]))].join(', ')); return }
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
        console.log(`%c鈻?${modelId} 鈥?${anims.length} animations`, 'font-weight:bold;color:#88ddff;font-size:13px')
        console.log(anims.map((a, i) => `${String(i+1).padStart(2,'0')}. ${a}`).join('\n'))
      } catch (e) { console.warn(`[${modelId}] load failed:`, e.message) }
    }
  })
  console.log('馃挕 Console tip: type showAnims("001tom") to see all animations for a character')
  if (props.scenarioJson) {
    compiledData.value = props.scenarioJson
    applyStartStepIfNeeded()
  } else if (props.scenarioUrl) {
    await loadScenario(props.scenarioUrl)
  }

  // Focus root for keyboard events
  nextTick(() => { document.querySelector('.story-viewer-root')?.focus() })

  // Safety timeout: ready always fires within 5s even if assets fail
  const readyTimer = setTimeout(() => {
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

  clearTimeout(readyTimer)

  // SpineStage applies first step state reactively via :step prop binding.
  // No explicit applyStepState call needed.

  // Voice playback is handled in watch(currentStep) for a single source of truth

  // Enable runtime watch
  _ready.value = true
  emit('ready')
})

onBeforeUnmount(() => {
  console.warn('馃毃 [Lifecycle] StoryViewer onBeforeUnmount FIRED!')
  _clearFadeAutoAdvance()
  _clearSeTimers()
  _fastForwardTimeline()
  _stopCurrentVoice('onBeforeUnmount')
  // Stop BGM and ambient in AudioManager
  _audioManager.dispose()
  _resetVoiceDedup()
})

// Watch step changes to trigger voice playback and timeline
watch(currentStep, (newStep, oldStep) => {
  console.log('[Audio] watch(currentStep) fired:', oldStep?.dialogue?.voice, '->', newStep?.dialogue?.voice)
  _clearFadeAutoAdvance()
  _clearSeTimers()
  _clearSnapshotTimer()

  const episodeChanged = oldStep && newStep && oldStep.episode_index !== newStep.episode_index
  if (episodeChanged) {
    spineStageRef.value?.manager?.cancelAllSpineTweens?.()
  }

  // SE (one-shot)
  const seEvents = Array.isArray(newStep?.state?.se_events) ? newStep.state.se_events : []
  if (seEvents.length > 0) {
    for (const se of seEvents) {
      _playStepSE(se)
    }
  } else {
    const se = newStep?.state?.se
    _playStepSE(se)
  }

  // Ambient audio (looping)
  const env = newStep?.state?.environmental
  const oldEnv = oldStep?.state?.environmental
  const envCue = env?.cue
  const oldEnvCue = oldEnv?.cue
  if (envCue && envCue !== _lastEnvCue) {
    _audioManager.playAmbient(envCue, 0.5, env?.volume)
    _lastEnvCue = envCue
  } else if (!envCue && _lastEnvCue) {
    _audioManager.stopAmbient()
    _lastEnvCue = null
  }
  // Environmental volume ducking
  if (env?.volume != null && env.volume !== '' && envCue === _lastEnvCue) {
    _audioManager.setAmbientVolume(env.volume)
  }
  if (newStep?.state?.environmental_duck_target != null) {
    _audioManager.setAmbientVolume(newStep.state.environmental_duck_target)
  }

  // BGM
  const bgmId = newStep?.state?.bgm
  const bgmStopFade = newStep?.state?.bgm_stop_fade
  if (bgmId && bgmId !== _lastBgmId) {
    _audioManager.playBgm(bgmId)
    _lastBgmId = bgmId
  } else if (!bgmId && _lastBgmId) {
    _audioManager.stopBgm(bgmStopFade != null ? bgmStopFade : 1.0)
    _lastBgmId = null
  }

  // Screen fade step: auto-advance after animation
  const autoAdvance = getAutoAdvanceTiming(newStep)
  if (autoAdvance) {
    const autoSeq = _fadeAutoSeq
    const autoStepIndex = currentStepIndex.value
    _fadeAutoTimer = setTimeout(() => {
      _fadeAutoTimer = null
      if (autoSeq === _fadeAutoSeq && currentStepIndex.value === autoStepIndex && !isLastStep.value) {
        if (autoAdvance.pushHistory) {
          historyStack.value.push(currentStepIndex.value)
        }
        currentStepIndex.value++
        _resetVoiceDedup()
      }
    }, autoAdvance.delayMs)
  }

  voicePlayer?.playVoice?.()
  _startTimeline()
  scheduleSnapshot()
})



function goNext() {
  _clearFadeAutoAdvance()
  // Fast-forward any remaining timeline events before leaving this step
  _fastForwardTimeline()
  // Activate AudioContext synchronously within user gesture
  _ensureAudioCtx()
  if (!isLastStep.value) {
    const currentStep = compiledData.value?.steps?.[currentStepIndex.value]
    if (!isTransitionStep(currentStep)) {
      historyStack.value.push(currentStepIndex.value)
    }
    currentStepIndex.value++
    _resetVoiceDedup()
  }
}
function goPrev() {
  _clearFadeAutoAdvance()
  _fastForwardTimeline()
  _ensureAudioCtx()
  if (historyStack.value.length > 0) {
    let target = historyStack.value.pop()
    while (target > 0 && isTransitionStep(compiledData.value?.steps?.[target])) {
      if (historyStack.value.length === 0) {
        target--
        continue
      }
      target = historyStack.value.pop()
    }
    currentStepIndex.value = target
    _resetVoiceDedup()
  } else if (currentStepIndex.value > 0) {
    let target = currentStepIndex.value - 1
    while (target > 0 && isTransitionStep(compiledData.value?.steps?.[target])) {
      target--
    }
    currentStepIndex.value = target
    _resetVoiceDedup()
  }
}
function onChoice(opt) {
  _clearFadeAutoAdvance()
  _fastForwardTimeline()
  _ensureAudioCtx()
  _resetVoiceDedup()
  const text = opt.detail || opt.text || opt.label || ''
  if (text) {
    selectedChoices.set(currentStepIndex.value, text)
  }
  if (opt.step_id) {
    historyStack.value.push(currentStepIndex.value)
    currentStepIndex.value = opt.step_id - 1
  }
}
function goToStep(index) {
  _clearFadeAutoAdvance()
  _fastForwardTimeline()
  if (compiledData.value && index >= 0 && index < compiledData.value.steps.length) {
    historyStack.value.push(currentStepIndex.value)
    currentStepIndex.value = index
  }
}

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
.nav-label { color: rgba(255,255,255,0.5); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; }

.loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #333; font-size: 1.2rem; }
</style>


