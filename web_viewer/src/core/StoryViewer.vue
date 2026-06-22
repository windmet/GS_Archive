<template>
  <div class="story-viewer-root" tabindex="0" @keydown.left="goPrev" @keydown.right="goNext">
    <div class="viewer-stage">
    <!-- Spine rendering layer (bg + characters) -->
    <SpineStage ref="spineStageRef" :step="currentStep" />

    <!-- Top bar -->
    <div class="top-bar" v-if="compiledData">
      <button class="bar-btn" @click="$emit('back')">← Back</button>
      <span class="step-counter">{{ currentStepIndex + 1 }} / {{ compiledData.steps.length }}</span>
      <div class="top-bar-right">
        <button class="lang-btn" @click.stop="cycleLanguage">{{ langLabel }}</button>
        <button class="bar-btn" v-if="!isLastStep" @click="goNext">Skip →</button>
      </div>
    </div>

    <!-- Audio player for voice → 改用 Web Audio API，完全绕过 IDM 嗅探 -->

    <!-- UI Overlay — step type specific -->
    <div class="ui-overlay" v-if="compiledData">

      <!-- ADV dialogue -->
      <AdvUI v-if="currentStep.type === 'adv'" :dialogue="currentStep.dialogue" :step="currentStep" :playing="isPlaying" @click="goNext" />

      <!-- Talk / chat mode: v-show keeps component mounted across choice steps -->
      <MobileUI v-show="currentStep.type === 'talk'"
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

      <!-- Synopsis / Title -->
      <div v-if="currentStep.type === 'synopsis' || currentStep.type === 'title'" class="meta-step">
        <div class="meta-title-bg"></div>
        <div class="meta-content">
          <div class="meta-title" v-if="currentStep.dialogue?.speaker">{{ resolveText(currentStep.dialogue, 'JP').speaker }}</div>
          <div class="meta-chapter" v-if="synopsisText && isChapterText(synopsisText)">
            {{ synopsisText }}
          </div>
          <div class="meta-text" v-else-if="synopsisText">{{ synopsisText }}</div>
        </div>
      </div>

    </div>

    <!-- Bottom navigation bar -->
    <div class="nav-bar" v-if="compiledData && compiledData.steps.length > 0">
      <button class="nav-btn" @click.stop="goPrev" :disabled="isFirstStep">◀</button>
      <span class="nav-label">{{ currentStep.type }}</span>
      <button class="nav-btn" @click.stop="goNext" :disabled="isLastStep">▶</button>
    </div>

    </div><!-- /viewer-stage -->
    <div class="loading" v-if="!compiledData">Loading story data...</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, reactive, nextTick, defineAsyncComponent } from 'vue'
import AdvUI from '../components/AdvUI.vue'
import MobileUI from '../components/MobileUI.vue'
import CallUI from '../components/CallUI.vue'
import ChoiceUI from '../components/ChoiceUI.vue'
// SpineStage lazily loaded — PIXI.js (720KB) only loads when user plays a story
const SpineStage = defineAsyncComponent(() => import('../components/SpineStage.vue'))
import { resolveText } from '../utils/TextHelper.js'
import { languageMode, setLanguageMode } from '../utils/LanguageStore.js'
import { getVoiceUrl } from '../utils/AssetResolver.js'

const props = defineProps({
  scenarioJson: { type: Object, default: null },
  scenarioUrl: { type: String, default: null },
})
const emit = defineEmits(['back', 'ready'])

const spineStageRef = ref(null)
const compiledData = ref(null)
const currentStepIndex = ref(0)
const historyStack = ref([])
const selectedChoices = reactive(new Map())
const _ready = ref(false)
const isPlaying = ref(false)

// ── Timeline (mid-sentence face/animation changes) ──
let _timelineEvents = []
const _firedTimeline = new Set()
let _timelineStartTime = 0
let _timelineRAF = false

// ── Web Audio API 语音播放 ──
let _audioCtx = null
let _currentSource = null
let _lastVoiceUrl = null
let _lastVoiceStepIndex = -1
let _voiceCharaId = null  // 当前说话的角色，用于嘴型动画

// ── Web Audio AnalyserNode: 实时音频频谱分析 ──
let globalAnalyser = null
let _globalGain = null  // GainNode: 全局音量控制（当前 0.6 = 60%）
let frequencyData = null

/**
 * 获取当前播放语音的实时音量 (0.0 ~ 1.0).
 * 基于 AnalyserNode 的频域数据计算平均强度.
 */
const getVoiceVolume = () => {
  if (!globalAnalyser || !frequencyData) return 0
  globalAnalyser.getByteFrequencyData(frequencyData)
  let sum = 0
  for (let i = 0; i < frequencyData.length; i++) sum += frequencyData[i]
  return (sum / frequencyData.length) / 255.0
}

// 控制 Spine 嘴型动画（Track 2），传入真实音量回调
function _setTalking(on) {
  const mgr = spineStageRef.value?.manager
  if (mgr && _voiceCharaId) {
    mgr.setSpineTalking(_voiceCharaId, on, getVoiceVolume)
  }
}

/**
 * Ensure AudioContext is created and in 'running' state.
 * Must be called SYNCHRONOUSLY within a user gesture (click, keydown).
 * Once running, subsequent source.start(0) calls work even from async contexts.
 */
function _ensureAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (_audioCtx.state === 'suspended') {
    // fire-and-forget — browser grants resume within user gesture
    _audioCtx.resume()
  }
}

function _resetVoiceDedup() {
  _lastVoiceUrl = null
  _lastVoiceStepIndex = -1
}

function _stopCurrentVoice(reason = 'unspecified') {
  if (_currentSource) {
    console.warn('🛑 [Audio] _stopCurrentVoice  reason:', reason)
    try { _currentSource.stop() } catch (e) { /* 可能已经 stopped */ }
    try { _currentSource.disconnect() } catch (e) { /* 可能已经 disconnected */ }
    _currentSource = null
    _setTalking(false)
  }
}

async function playVoice() {
  const step = currentStep.value
  const voice = step?.dialogue?.voice
  const scenarioId = compiledData.value?.scenario_id
  if (!voice) {
    console.log('[Audio] playVoice: no voice in step, skipping')
    return
  }

  // 去重：同一个 step 的同一段语音，不去重复触发
  if (voice === _lastVoiceUrl && currentStepIndex.value === _lastVoiceStepIndex) {
    console.log('[Audio] dedup: same voice already processed for this step, skip')
    return
  }
  _lastVoiceUrl = voice
  _lastVoiceStepIndex = currentStepIndex.value

  _stopCurrentVoice('playVoice-new')
  _voiceCharaId = step.chara_id || null
  isPlaying.value = false

  // AudioContext should already be running (activated in goNext/goPrev/onChoice)
  _ensureAudioCtx()

  try {
    const voiceUrl = getVoiceUrl(voice, scenarioId)
    console.log('[Audio] stepIdx:', currentStepIndex.value, 'voice:', voice, 'url:', voiceUrl)
    const bust = Date.now()
    const res = await fetch(`${voiceUrl}?_=${bust}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') || ''
    console.log('[Audio] response:', { voice, status: res.status, contentType, size: res.headers.get('content-length') })

    const arrayBuffer = await res.arrayBuffer()
    console.log('[Audio] fetch OK, size:', arrayBuffer.byteLength, 'voice:', voice)

    // Guard: reject non-audio responses (Vite SPA fallback returns HTML)
    if (arrayBuffer.byteLength < 1000 || contentType.includes('text/html')) {
      console.warn('⚠️ [Audio] non-audio response, content-type:', contentType, 'size:', arrayBuffer.byteLength)
      throw new Error(`Not an audio file: ${contentType} (${arrayBuffer.byteLength} bytes)`)
    }

    // Fallback resume — in case this path was reached without user gesture
    if (_audioCtx.state === 'suspended') {
      console.warn('[Audio] AudioContext was suspended, attempting resume')
      await _audioCtx.resume()
    }

    let audioBuffer
    try {
      audioBuffer = await _audioCtx.decodeAudioData(arrayBuffer)
    } catch (decodeErr) {
      console.error('❌ [Audio] decodeAudioData FAILED:', decodeErr.message, 'voice:', voice, 'bufferSize:', arrayBuffer.byteLength)
      isPlaying.value = false
      return
    }
    console.log('✅ [Audio] decoded OK:', voice, 'duration:', audioBuffer.duration.toFixed(2) + 's', 'channels:', audioBuffer.numberOfChannels, 'ctxState:', _audioCtx.state)

    // 在 start 之前再检查一次有没有被新的 playVoice 取代
    if (_currentSource || voice !== _lastVoiceUrl) {
      console.log('[Audio] superseded by newer voice before start, dropping')
      return
    }

    // 创建 AnalyserNode + GainNode（全局音量），保持永久连接至 destination
    if (!globalAnalyser) {
      _globalGain = _audioCtx.createGain()
      _globalGain.gain.value = 0.5  // 全局音量 50%
      globalAnalyser = _audioCtx.createAnalyser()
      globalAnalyser.fftSize = 256
      frequencyData = new Uint8Array(globalAnalyser.frequencyBinCount)
      // 路由: Source → Gain(0.6) → Analyser → Destination
      _globalGain.connect(globalAnalyser)
      globalAnalyser.connect(_audioCtx.destination)
    }
    const source = _audioCtx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(_globalGain)
    source.start(0)

    // 开始嘴型动画 (Track 2)
    _setTalking(true)

    _currentSource = source
    isPlaying.value = true
    console.log('🔊 [Audio] playback started:', voice)

    source.onended = () => {
      console.log('[Audio] playback ended:', voice)
      _setTalking(false)
      isPlaying.value = false
      if (_currentSource === source) _currentSource = null
    }
  } catch (err) {
    console.warn('[Audio] playback failed:', err.message, 'voice:', voice)
    isPlaying.value = false
  }
}

// ── Timeline (mid-sentence face/animation changes) ──

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
    mgr.switchSpineAnim(event.chara_id, event.value)
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

const isFirstStep = computed(() => historyStack.value.length === 0)
const isLastStep = computed(() => !compiledData.value || currentStepIndex.value >= compiledData.value.steps.length - 1)

const synopsisText = computed(() => {
  const d = currentStep.value?.dialogue
  return d ? resolveText(d).text : ''
})

const langLabel = computed(() => {
  const labels = { JP: 'JP', CN: '中文', BILINGUAL: 'JP+CN' }
  return labels[languageMode.value] || 'JP'
})

const LANG_CYCLE = ['JP', 'CN', 'BILINGUAL']
function cycleLanguage() {
  const cur = languageMode.value
  const idx = LANG_CYCLE.indexOf(cur)
  setLanguageMode(LANG_CYCLE[(idx + 1) % LANG_CYCLE.length])
}

onMounted(async () => {
  // 全局调试工具：在 Console 输入 showAnims('001tom') 查看角色的所有动作
  window.showAnims = window.showAnims || (async (charaId, modelIdx) => {
    const models = ['001tom_002_00','001tom_003_00','001tom_004_00','001tom_004_01','001tom_005_00','001tom_101_00','001tom_101_01','001tom_102_00','001tom_103_00','001tom_103_01',
      '002dra_002_00','002dra_003_00','003min_002_00','003min_003_00','004ren_002_00','004ren_003_00','005sho_002_00','005sho_003_00',
      '006aio_002_00','006aio_003_00','007you_002_00','007you_003_00',
      '008ter_002_00','008ter_003_00','009ryu_002_00','009ryu_003_00',
      '010kai_002_00','010kai_003_00']
    const modelList = models.filter(m => m.startsWith(charaId))
    if (modelList.length === 0) { console.warn('Unknown charaId:', charaId, '— try one of:', [...new Set(models.map(m => m.split('_')[0]))].join(', ')); return }
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
        console.log(`%c▼ ${modelId} — ${anims.length} animations`, 'font-weight:bold;color:#88ddff;font-size:13px')
        console.log(anims.map((a, i) => `${String(i+1).padStart(2,'0')}. ${a}`).join('\n'))
      } catch (e) { console.warn(`[${modelId}] load failed:`, e.message) }
    }
  })
  console.log('💡 Console tip: type showAnims("001tom") to see all animations for a character')
  if (props.scenarioJson) {
    compiledData.value = props.scenarioJson
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

  // 语音由 watch(currentStep) 统一处理

  // Enable runtime watch
  _ready.value = true
  emit('ready')
})

onBeforeUnmount(() => {
  console.warn('🚨 [Lifecycle] StoryViewer onBeforeUnmount FIRED!')
  _fastForwardTimeline()
  _stopCurrentVoice('onBeforeUnmount')
  if (_audioCtx) {
    _audioCtx.close().catch(() => {})
    _audioCtx = null
  }
  _resetVoiceDedup()
})

// Watch step changes to trigger voice playback and timeline
watch(currentStep, (newStep, oldStep) => {
  console.log('[Audio] watch(currentStep) fired:', oldStep?.dialogue?.voice, '→', newStep?.dialogue?.voice)
  playVoice()
  _startTimeline()
})

function isChapterText(text) {
  return /^[第\d零壱弐参話\-]+/.test(text)
}


function goNext() {
  // Fast-forward any remaining timeline events before leaving this step
  _fastForwardTimeline()
  // Activate AudioContext synchronously within user gesture
  _ensureAudioCtx()
  if (!isLastStep.value) {
    historyStack.value.push(currentStepIndex.value)
    currentStepIndex.value++
    _resetVoiceDedup()
  }
}
function goPrev() {
  _fastForwardTimeline()
  _ensureAudioCtx()
  if (historyStack.value.length > 0) {
    currentStepIndex.value = historyStack.value.pop()
    _resetVoiceDedup()
  }
}
function onChoice(opt) {
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
  _fastForwardTimeline()
  if (compiledData.value && index >= 0 && index < compiledData.value.steps.length) {
    historyStack.value.push(currentStepIndex.value)
    currentStepIndex.value = index
  }
}

async function loadScenario(url) {
  try {
    const r = await fetch(url)
    compiledData.value = await r.json()
  } catch (err) {
    console.error('[StoryViewer] Failed to load:', err)
  }
}

defineExpose({ goNext, goPrev, goToStep, currentStepIndex })
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
.step-counter { color: rgba(255,255,255,0.65); font-size: 0.75rem; }
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

.meta-step {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #333;
}
.meta-title-bg {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 70%; max-width: 500px;
  height: auto;
  min-height: 180px;
  background: rgba(255, 255, 255, 0.7);
  pointer-events: none;
}
/* Diagonal lines overlay on bg */
.meta-title-bg::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.04) 2px,
    rgba(0, 0, 0, 0.04) 6px
  );
  opacity: 0.7;
}
.meta-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.meta-title { font-size: 1.6rem; font-weight: bold; margin-bottom: 4px; color: #222; text-align: center; }
.meta-chapter {
  display: inline-block;
  background: #11BAFC;
  color: #fff;
  padding: 6px 18px;
  border-radius: 4px;
  font-size: 0.95rem;
  font-weight: 500;
  text-align: center;
}
.meta-text { font-size: 1rem; line-height: 1.8; max-width: 600px; text-align: center; color: #444; }
.loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #333; font-size: 1.2rem; }
</style>
