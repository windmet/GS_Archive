<template>
  <div class="chibi-lab">
    <header class="lab-header">
      <button class="icon-button back-button" type="button" aria-label="返回资料馆" @click="emit('back')">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-divider" aria-hidden="true"></div>
      <h1>舞台小人实验室</h1>
      <div class="header-meta">Spine 3.8 · 实验预览</div>
    </header>

    <main class="lab-workspace">
      <section class="stage-shell" aria-label="舞台小人预览">
        <div class="stage-backdrop" aria-hidden="true"></div>
        <div ref="canvasRef" class="stage-canvas"></div>

        <div v-if="loading" class="stage-state">
          <LoaderCircle class="loading-icon" :size="26" />
          <span>{{ statusText }}</span>
        </div>
        <div v-else-if="errorText" class="stage-state error-state">
          <CircleAlert :size="26" />
          <strong>暂时无法显示舞台小人</strong>
          <span>{{ errorText }}</span>
        </div>

        <div class="transport" :class="{ disabled: !runtimeReady }">
          <button type="button" aria-label="上一个动作" @click="stepMotion(-1)">
            <SkipBack :size="20" />
          </button>
          <button class="primary-transport" type="button" :aria-label="transportPaused ? '播放' : '暂停'" @click="togglePlayback">
            <Play v-if="transportPaused" :size="22" fill="currentColor" />
            <Pause v-else :size="22" fill="currentColor" />
          </button>
          <button type="button" aria-label="下一个动作" @click="stepMotion(1)">
            <SkipForward :size="20" />
          </button>
          <div class="transport-divider" aria-hidden="true"></div>
          <div class="transport-motion">
            <span>{{ selectedMotion?.label || '—' }}</span>
            <small v-if="selectedMotion">{{ selectedMotion.name }} · #{{ selectedMotion.id }}</small>
          </div>
        </div>
      </section>

      <aside
        class="inspector"
        aria-label="舞台小人控制台"
        :data-runtime-diagnostics="runtimeDiagnostics ? JSON.stringify(runtimeDiagnostics) : ''"
        :data-audio-ready="audioReady"
        :data-audio-file="selectedSongAudio?.file || ''"
        :data-song-motions-ready="songMotionsReady"
      >
        <div class="inspector-scroll">
          <section class="control-section selection-section">
            <label>
              <span>角色</span>
              <select v-model="selectedCharacterId" @change="loadSelectedCharacter">
                <option v-for="character in characters" :key="character.id" :value="character.id">
                  {{ character.name }} · {{ character.id }}
                </option>
              </select>
            </label>
            <label>
              <span>服装</span>
              <select v-model="selectedCostumeId" @change="loadSelectedCharacter">
                <option v-for="costume in costumes" :key="costume.id" :value="costume.id">
                  {{ costume.label }}
                </option>
              </select>
            </label>
            <label>
              <span>动作库</span>
              <select v-model="selectedPackId" @change="selectDefaultMotion">
                <option v-for="pack in motionPacks" :key="pack.id" :value="pack.id">
                  {{ pack.label }}
                </option>
              </select>
            </label>
          </section>

          <section class="control-section motion-section">
            <div class="section-heading">
              <div>
                <h2>动作列表</h2>
                <span>{{ motions.length }} 个可用动作</span>
              </div>
              <button class="text-button" type="button" @click="replayMotion">
                <RotateCcw :size="15" />重播
              </button>
            </div>
            <select v-model.number="selectedMotionId" class="motion-select" size="8" @change="playSelectedMotion()">
              <option v-for="motion in motions" :key="motion.id" :value="motion.id">
                {{ String(motion.id).padStart(2, '0') }}　{{ motion.label }}　/ {{ motion.name }}
              </option>
            </select>
          </section>

          <section v-if="selectedSong" class="control-section choreography-section">
            <div class="section-heading">
              <div>
                <h2>歌曲编排</h2>
                <span>{{ selectedSong.events.length }} 条动作 · {{ selectedSong.singerEvents?.length || 0 }} 次演唱切换</span>
              </div>
            </div>
            <div
              class="singer-status"
              :class="{ singing: selectedPositionIsSinging }"
              :data-current-singers="currentSingerPositions.join(',')"
              :data-selected-singing="selectedPositionIsSinging"
              :data-lip-value="lipSyncState.value.toFixed(3)"
              :data-mouth-attachment="lipSyncState.attachment || ''"
              :data-mouth-scale="lipSyncState.scale.toFixed(3)"
            >
              <Mic2 :size="16" />
              <div>
                <span>当前演唱</span>
                <strong>{{ currentSingerLabel }}</strong>
              </div>
              <small>{{ selectedPositionIsSinging ? `${selectedPosition} 号位正在演唱` : `${selectedPosition} 号位伴舞中` }}</small>
            </div>
            <div class="lip-sync-status">
              <span>官方口型曲线</span>
              <strong>{{ selectedSong.lipSync ? `${selectedSong.lipSync.frames} 帧 · 60 Hz` : '无对应数据' }}</strong>
              <small>{{ lipSyncState.attachment || 'mouth_close' }} · {{ lipSyncState.value.toFixed(3) }} · ×{{ lipSyncState.scale.toFixed(2) }}</small>
            </div>
            <div class="lip-sync-status song-audio-status">
              <span>歌曲音频</span>
              <strong>{{ selectedSongAudio ? (audioReady ? '已加载 · 音频主时钟' : '正在加载') : '无对应音频' }}</strong>
              <small v-if="selectedSongAudio">{{ formatTime(selectedSongAudio.duration) }}</small>
            </div>
            <small v-if="audioError" class="audio-error">{{ audioError }}</small>
            <label class="song-position">
              <span>站位</span>
              <select v-model.number="selectedPosition" @change="seekChoreography">
                <option v-for="position in selectedSong.positions" :key="position" :value="position">
                  {{ position }} 号位
                </option>
              </select>
            </label>
            <label class="timeline-control">
              <input
                v-model.number="choreographyTime"
                type="range"
                min="0"
                :max="choreographyDuration"
                step="100"
                @change="seekChoreography"
              />
              <span>{{ formatTime(choreographyTime) }} / {{ formatTime(choreographyDuration) }}</span>
            </label>
            <button class="choreography-play" type="button" :disabled="songMotionsLoading" @click="toggleChoreography">
              <Pause v-if="choreographyPlaying" :size="18" fill="currentColor" />
              <Play v-else :size="18" fill="currentColor" />
              {{ songMotionsLoading ? '正在预载歌曲动作…' : (choreographyPlaying ? '暂停编排' : '播放编排') }}
            </button>
          </section>

          <section class="control-section playback-section">
            <h2>播放控制</h2>
            <div class="playback-buttons">
              <button type="button" @click="replayMotion"><RotateCcw :size="18" /></button>
              <button class="wide-play" type="button" @click="togglePlayback">
                <Play v-if="paused" :size="18" fill="currentColor" />
                <Pause v-else :size="18" fill="currentColor" />
                {{ paused ? '继续播放' : '暂停' }}
              </button>
            </div>
            <label class="range-control">
              <span>速度</span>
              <input v-model.number="playbackSpeed" type="range" min="0.25" max="2" step="0.05" @input="applyPlaybackSpeed" />
              <output>{{ playbackSpeed.toFixed(2) }}</output>
            </label>
            <label class="range-control">
              <span>缩放</span>
              <input v-model.number="modelScale" type="range" min="0.08" max="0.8" step="0.01" @input="applyModelScale" />
              <output>{{ modelScale.toFixed(2) }}</output>
            </label>
          </section>

          <section class="resource-section">
            <h2>当前资源</h2>
            <dl>
              <div><dt>角色</dt><dd>{{ selectedCharacter?.id || '—' }}</dd></div>
              <div><dt>体型骨架</dt><dd>body-{{ selectedCharacter?.bodyType || '—' }}.skel</dd></div>
              <div><dt>动作片段</dt><dd>{{ resolvedMotionFile }}</dd></div>
              <div><dt>服装图集</dt><dd>{{ selectedCostume?.atlas || '—' }}</dd></div>
              <div v-if="selectedSongAudio"><dt>歌曲音频</dt><dd>{{ selectedSongAudio.file }}</dd></div>
            </dl>
          </section>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as PIXI from 'pixi.js'
import {
  ArrowLeft,
  CircleAlert,
  LoaderCircle,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from '@lucide/vue'
import {
  applyLiveChibiLipSync,
  createLiveChibi,
  destroyLiveChibi,
  fetchLiveChibiChoreography,
  fetchLiveChibiLipSync,
  fetchLiveChibiManifest,
  fetchLiveChibiMusicIndex,
  injectLiveChibiMotion,
  playLiveChibiMotion,
} from '../utils/liveChibiSpine.js'

const emit = defineEmits(['back'])
const canvasRef = ref(null)
const manifest = ref(null)
const choreography = ref(null)
const musicIndex = ref(null)
const selectedCharacterId = ref('')
const selectedCostumeId = ref('')
const selectedPackId = ref('common')
const selectedMotionId = ref(12)
const loading = ref(true)
const statusText = ref('正在准备舞台…')
const errorText = ref('')
const paused = ref(false)
const playbackSpeed = ref(1)
const modelScale = ref(0.28)
const runtimeReady = ref(false)
const runtimeDiagnostics = ref(null)
const selectedPosition = ref(3)
const choreographyTime = ref(0)
const choreographyPlaying = ref(false)
const lipSyncState = ref({ value: 0, singing: false, attachment: 'mouth_close', scale: 1 })
const audioReady = ref(false)
const audioError = ref('')
const songMotionsReady = ref(false)
const songMotionsLoading = ref(false)

let app = null
let runtime = null
let resizeObserver = null
let loadSequence = 0
let motionSequence = 0
let choreographyFrame = 0
let choreographyStartedAt = 0
let choreographyStartOffset = 0
let choreographyEventIndex = 0
let lipSyncCurve = null
let lipSyncLoadSequence = 0
let songAudio = null

const characters = computed(() => manifest.value?.characters || [])
const selectedCharacter = computed(() => characters.value.find(item => item.id === selectedCharacterId.value))
const choreographyBodyTypes = computed(() => choreography.value?.bodyTypes
  || (choreography.value?.bodyType ? [choreography.value.bodyType] : []))
const choreographySupportsCharacter = computed(() => choreographyBodyTypes.value
  .includes(selectedCharacter.value?.bodyType))
const motionPacks = computed(() => [
  ...(manifest.value?.motionPacks || []),
  ...((choreographySupportsCharacter.value
    ? choreography.value?.songs
    : []) || []).map(song => ({
    id: `song:${song.id}`,
    label: `歌曲 · ${song.title}`,
  })),
])
const costumes = computed(() => selectedCharacter.value?.costumes || [])
const selectedCostume = computed(() => costumes.value.find(item => item.id === selectedCostumeId.value))
const selectedPack = computed(() => motionPacks.value.find(item => item.id === selectedPackId.value))
const selectedSong = computed(() => {
  if (!choreographySupportsCharacter.value) return null
  if (!selectedPackId.value.startsWith('song:')) return null
  const songId = selectedPackId.value.slice(5)
  return choreography.value?.songs.find(song => song.id === songId) || null
})
const selectedSongAudio = computed(() => (
  selectedSong.value ? musicIndex.value?.songs?.[selectedSong.value.id] || null : null
))
const choreographyDuration = computed(() => Math.max(
  selectedSong.value?.duration || 0,
  selectedSong.value?.lipSync?.duration || 0,
  selectedSongAudio.value?.duration || 0,
))
const choreographyMotionMap = computed(() => new Map(
  (choreography.value?.motionCatalog || []).map(motion => [motion.id, motion]),
))
const motions = computed(() => selectedSong.value
  ? selectedSong.value.motionIds.map(id => choreographyMotionMap.value.get(id)).filter(Boolean)
  : selectedPack.value?.motions || [])
const selectedMotion = computed(() => motions.value.find(item => item.id === selectedMotionId.value))
const resolvedMotionFile = computed(() => selectedMotion.value?.file
  ?.replace('{bodyType}', String(selectedCharacter.value?.bodyType || '—')) || '—')
const transportPaused = computed(() => selectedSong.value ? !choreographyPlaying.value : paused.value)
const selectedTimelineEvents = computed(() => (selectedSong.value?.events || [])
  .filter(event => (event.stagePosition ?? event.position) === selectedPosition.value))
const currentSingerEvent = computed(() => [...(selectedSong.value?.singerEvents || [])]
  .reverse()
  .find(event => event.time <= choreographyTime.value))
const currentSingerPositions = computed(() => currentSingerEvent.value?.singers || [])
const selectedPositionIsSinging = computed(() => currentSingerPositions.value.includes(selectedPosition.value))
const currentSingerLabel = computed(() => currentSingerPositions.value.length
  ? currentSingerPositions.value.map(position => `${position} 号位`).join('、')
  : '无人')

onMounted(async () => {
  await nextTick()
  createPixiApp()
  try {
    manifest.value = await fetchLiveChibiManifest()
    if (manifest.value.choreography?.index) {
      choreography.value = await fetchLiveChibiChoreography(manifest.value.choreography.index)
    }
    musicIndex.value = await fetchLiveChibiMusicIndex()
    const initialCharacter = characters.value[0]
    selectedCharacterId.value = initialCharacter?.id || ''
    selectedCostumeId.value = initialCharacter?.defaultCostume || initialCharacter?.costumes?.[0]?.id || ''
    selectDefaultMotion(false)
    await loadSelectedCharacter()
  } catch (error) {
    loading.value = false
    errorText.value = error.message
    console.error('[ChibiLab]', error)
  }
})

onBeforeUnmount(() => {
  loadSequence += 1
  lipSyncLoadSequence += 1
  stopChoreography()
  if (songAudio) {
    songAudio.pause()
    songAudio.removeAttribute('src')
    songAudio.load()
    songAudio = null
  }
  resizeObserver?.disconnect()
  destroyLiveChibi(runtime)
  runtime = null
  app?.destroy(true)
  app = null
})

function createPixiApp() {
  const host = canvasRef.value
  if (!host) return
  app = markRaw(new PIXI.Application({
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  }))
  host.appendChild(app.view)
  resizeObserver = new ResizeObserver(() => resizeStage())
  resizeObserver.observe(host)
}

async function loadSelectedCharacter() {
  const character = selectedCharacter.value
  if (!character) return
  if (selectedPackId.value.startsWith('song:')
    && !choreographySupportsCharacter.value) {
    selectedPackId.value = 'common'
    selectDefaultMotion(false)
  }
  if (!costumes.value.some(item => item.id === selectedCostumeId.value)) {
    selectedCostumeId.value = character.defaultCostume || costumes.value[0]?.id || ''
  }
  const costume = selectedCostume.value
  if (!costume) return

  const sequence = ++loadSequence
  motionSequence += 1
  loading.value = true
  runtimeReady.value = false
  songMotionsReady.value = false
  runtimeDiagnostics.value = null
  errorText.value = ''
  statusText.value = `正在组合 ${character.name} 的骨架与服装…`
  destroyLiveChibi(runtime)
  runtime = null

  try {
    const nextRuntime = await createLiveChibi(character, costume)
    if (sequence !== loadSequence || !app) {
      destroyLiveChibi(nextRuntime)
      return
    }
    runtime = markRaw({ ...nextRuntime, loadedMotions: new Map() })
    runtimeDiagnostics.value = nextRuntime.diagnostics
    app.stage.addChild(runtime.spine)
    resizeStage(true)
    loading.value = false
    runtimeReady.value = true
    await playSelectedMotion({ reset: true })
    applyCurrentLipSync()
  } catch (error) {
    loading.value = false
    errorText.value = error.message
    console.error('[ChibiLab] character load failed', error)
  }
}

function resizeStage(resetScale = false) {
  if (!app || !canvasRef.value) return
  const width = Math.max(1, canvasRef.value.clientWidth)
  const height = Math.max(1, canvasRef.value.clientHeight)
  app.renderer.resize(width, height)
  if (!runtime?.spine) return
  runtime.spine.x = width * 0.5
  runtime.spine.y = height * 0.87
  if (resetScale) {
    const dataWidth = Math.max(runtime.skeletonData.width, 1)
    const dataHeight = Math.max(runtime.skeletonData.height, 1)
    const fitScale = Math.min(
      width * 0.52 / dataWidth,
      height * 0.68 / dataHeight,
    )
    modelScale.value = selectedCharacter.value?.previewScale || fitScale
  }
  runtime.spine.scale.set(modelScale.value)
}

function selectDefaultMotion(play = true) {
  stopChoreography(true)
  songMotionsReady.value = false
  loadSelectedSongLipSync()
  loadSelectedSongAudio()
  if (selectedSong.value) {
    if (!selectedSong.value.positions.includes(selectedPosition.value)) {
      selectedPosition.value = selectedSong.value.positions[0] || 3
    }
    const initialEvent = [...selectedTimelineEvents.value]
      .reverse()
      .find(event => event.time <= 0) || selectedTimelineEvents.value[0]
    selectedMotionId.value = initialEvent?.motion || motions.value[0]?.id || 0
    if (play && initialEvent) playSelectedMotion({
      speedScale: initialEvent.speed / 1000,
      mode: initialEvent.mode,
      pauseTime: initialEvent.pauseTime,
      reset: true,
    })
    return
  }
  const requestedMotionId = Number(new URLSearchParams(window.location.search).get('motion'))
  const preferred = motions.value.find(item => item.id === requestedMotionId)
    || motions.value.find(item => item.name === 'wait')
    || motions.value[0]
  selectedMotionId.value = preferred?.id || 0
  if (play) playSelectedMotion({ reset: true })
}

async function preloadSelectedSongMotions() {
  if (!runtime || !selectedSong.value) return false
  if (songMotionsReady.value) return true
  const targetRuntime = runtime
  const targetSongId = selectedSong.value.id
  songMotionsLoading.value = true
  try {
    await Promise.all(motions.value.map(motion => injectLiveChibiMotion(targetRuntime, motion)))
    if (runtime !== targetRuntime || selectedSong.value?.id !== targetSongId) return false
    songMotionsReady.value = true
    return true
  } catch (error) {
    audioError.value = `歌曲动作预载失败：${error.message}`
    return false
  } finally {
    if (runtime === targetRuntime) songMotionsLoading.value = false
  }
}

function loadSelectedSongAudio() {
  if (songAudio) {
    songAudio.pause()
    songAudio.removeAttribute('src')
    songAudio.load()
  }
  songAudio = null
  audioReady.value = false
  audioError.value = ''
  const audioEntry = selectedSongAudio.value
  if (!audioEntry?.file) return

  const audio = new Audio(`/assets/live-chibi/${audioEntry.file}`)
  audio.preload = 'auto'
  audio.playbackRate = playbackSpeed.value
  audio.addEventListener('canplay', () => {
    if (songAudio === audio) audioReady.value = true
  })
  audio.addEventListener('error', () => {
    if (songAudio !== audio) return
    audioReady.value = false
    audioError.value = '歌曲音频加载失败'
  })
  songAudio = audio
  audio.load()
}

async function loadSelectedSongLipSync() {
  const song = selectedSong.value
  const sequence = ++lipSyncLoadSequence
  lipSyncCurve = null
  applyCurrentLipSync()
  if (!song?.lipSync?.file) return
  try {
    const curve = await fetchLiveChibiLipSync(song.lipSync.file)
    if (sequence !== lipSyncLoadSequence || selectedSong.value?.id !== song.id) return
    lipSyncCurve = curve
    applyCurrentLipSync()
  } catch (error) {
    if (sequence !== lipSyncLoadSequence) return
    console.warn('[ChibiLab] lip-sync load failed', error)
  }
}

function applyCurrentLipSync() {
  lipSyncState.value = applyLiveChibiLipSync(
    runtime,
    lipSyncCurve,
    choreographyTime.value,
    selectedPositionIsSinging.value,
  )
}

async function playSelectedMotion({
  speedScale = 1,
  mode = 2,
  pauseTime = 0,
  reset = true,
  seekOffset = 0,
} = {}) {
  if (!runtime || !selectedMotion.value) return
  const motion = selectedMotion.value
  const sequence = ++motionSequence
  const motionRuntime = runtime
  statusText.value = `正在载入动作 ${motion.label}…`
  try {
    const animationNames = await injectLiveChibiMotion(motionRuntime, motion)
    if (sequence !== motionSequence || runtime !== motionRuntime) return
    motionRuntime.currentAnimations = animationNames
    motionRuntime.motionSpeedScale = speedScale
    paused.value = false
    const playback = playLiveChibiMotion(motionRuntime, animationNames, { mode, reset })
    if (seekOffset > 0) motionRuntime.spine.update(seekOffset / 1000 * speedScale)
    const visualBounds = motionRuntime.spine.getLocalBounds()
    runtimeDiagnostics.value = {
      ...motionRuntime.diagnostics,
      motion: motion.id,
      choreographyMode: mode,
      pauseTime,
      seekOffset,
      playback,
      visualBounds: {
        x: visualBounds.x,
        y: visualBounds.y,
        width: visualBounds.width,
        height: visualBounds.height,
      },
      previewScale: modelScale.value,
      renderedHeight: visualBounds.height * modelScale.value,
    }
    applyPlaybackSpeed()
  } catch (error) {
    errorText.value = `动作 ${motion.id} 加载失败：${error.message}`
    console.error('[ChibiLab] motion load failed', error)
  }
}

function replayMotion() {
  if (!runtime?.currentAnimations) return
  paused.value = false
  playLiveChibiMotion(runtime, runtime.currentAnimations, { reset: true })
  applyPlaybackSpeed()
}

function togglePlayback() {
  if (selectedSong.value) {
    toggleChoreography()
    return
  }
  if (!runtime) return
  paused.value = !paused.value
  runtime.spine.state.timeScale = paused.value ? 0 : playbackSpeed.value
}

function applyPlaybackSpeed() {
  if (runtime && !paused.value) {
    runtime.spine.state.timeScale = playbackSpeed.value * (runtime.motionSpeedScale || 1)
  }
  if (songAudio) songAudio.playbackRate = playbackSpeed.value
}

function applyModelScale() {
  runtime?.spine?.scale.set(modelScale.value)
}

function stepMotion(direction) {
  stopChoreography()
  if (!motions.value.length) return
  const currentIndex = Math.max(0, motions.value.findIndex(item => item.id === selectedMotionId.value))
  const nextIndex = (currentIndex + direction + motions.value.length) % motions.value.length
  selectedMotionId.value = motions.value[nextIndex].id
  playSelectedMotion()
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function playChoreographyEvent(event, { reset = false, seekTime = null } = {}) {
  const motion = choreographyMotionMap.value.get(event.motion)
  if (!motion) return
  selectedMotionId.value = motion.id
  return playSelectedMotion({
    speedScale: event.speed / 1000,
    mode: event.mode,
    pauseTime: event.pauseTime,
    reset,
    seekOffset: seekTime === null ? 0 : Math.max(0, seekTime - event.time),
  })
}

function seekChoreography() {
  stopChoreography()
  if (songAudio) songAudio.currentTime = choreographyTime.value / 1000
  const event = [...selectedTimelineEvents.value]
    .reverse()
    .find(item => item.time <= choreographyTime.value)
  if (event) playChoreographyEvent(event, { reset: true, seekTime: choreographyTime.value })
  applyCurrentLipSync()
}

async function toggleChoreography() {
  if (choreographyPlaying.value) {
    stopChoreography()
    return
  }
  const events = selectedTimelineEvents.value
  if (!events.length || !selectedSong.value) return
  if (!await preloadSelectedSongMotions()) return
  if (choreographyTime.value >= choreographyDuration.value) choreographyTime.value = 0

  choreographyEventIndex = events.findIndex(event => event.time > choreographyTime.value)
  if (choreographyEventIndex < 0) choreographyEventIndex = events.length
  const currentEvent = events[Math.max(0, choreographyEventIndex - 1)]
  if (currentEvent && currentEvent.time <= choreographyTime.value) {
    await playChoreographyEvent(currentEvent, {
      reset: true,
      seekTime: choreographyTime.value,
    })
  }

  choreographyStartOffset = choreographyTime.value
  choreographyStartedAt = performance.now()
  if (songAudio && selectedSongAudio.value) {
    songAudio.currentTime = choreographyTime.value / 1000
    songAudio.playbackRate = playbackSpeed.value
    try {
      await songAudio.play()
      audioError.value = ''
    } catch (error) {
      audioError.value = `歌曲音频无法播放：${error.message}`
      return
    }
  }
  choreographyPlaying.value = true
  choreographyFrame = requestAnimationFrame(updateChoreography)
}

function updateChoreography(now) {
  if (!choreographyPlaying.value || !selectedSong.value) return
  const events = selectedTimelineEvents.value
  choreographyTime.value = Math.min(
    choreographyDuration.value,
    songAudio && !songAudio.paused
      ? songAudio.currentTime * 1000
      : choreographyStartOffset + (now - choreographyStartedAt) * playbackSpeed.value,
  )
  while (choreographyEventIndex < events.length
    && events[choreographyEventIndex].time <= choreographyTime.value) {
    playChoreographyEvent(events[choreographyEventIndex])
    choreographyEventIndex += 1
  }
  applyCurrentLipSync()
  if (choreographyTime.value >= choreographyDuration.value) {
    stopChoreography()
    return
  }
  choreographyFrame = requestAnimationFrame(updateChoreography)
}

function stopChoreography(reset = false) {
  if (choreographyFrame) cancelAnimationFrame(choreographyFrame)
  choreographyFrame = 0
  choreographyPlaying.value = false
  songAudio?.pause()
  if (reset) {
    choreographyTime.value = 0
    if (songAudio) songAudio.currentTime = 0
  }
}
</script>

<style scoped>
.chibi-lab {
  --ink: #08111f;
  --panel: #132235;
  --panel-deep: #0e1a2a;
  --line: rgba(172, 197, 224, 0.18);
  --text: #f2f6fb;
  --muted: #91a4ba;
  --accent: #3c9cff;
  position: fixed;
  inset: 0;
  z-index: 100;
  color: var(--text);
  background: var(--ink);
  font-family: Inter, "Noto Sans SC", "Microsoft YaHei", sans-serif;
}

.lab-header {
  position: absolute;
  inset: 0 0 auto 0;
  z-index: 4;
  height: 62px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 22px;
  border-bottom: 1px solid var(--line);
  background: rgba(7, 17, 31, 0.96);
}

.lab-header h1 { margin: 0; font-size: 20px; font-weight: 680; letter-spacing: 0.02em; }
.header-meta { margin-left: auto; color: var(--muted); font-size: 12px; letter-spacing: 0.04em; }
.header-divider { width: 1px; height: 26px; background: var(--line); }
.icon-button { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; color: var(--text); background: transparent; border: 0; border-radius: 8px; cursor: pointer; }
.icon-button:hover { background: rgba(255, 255, 255, 0.07); }

.lab-workspace { position: absolute; inset: 62px 0 0; display: grid; grid-template-columns: minmax(0, 1fr) 380px; min-height: 0; }
.stage-shell { position: relative; min-width: 0; overflow: hidden; background: #101a26; }
.stage-backdrop { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(4, 9, 17, 0.25), rgba(4, 9, 17, 0.08) 56%, rgba(4, 9, 17, 0.48)), url('/assets/bg/bg086_dancestudio_in_01.png') center / cover no-repeat; filter: saturate(0.72) brightness(0.62); transform: scale(1.015); }
.stage-shell::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 52%, transparent 22%, rgba(3, 8, 15, 0.34) 92%); }
.stage-canvas { position: absolute; inset: 0; z-index: 1; }
.stage-canvas :deep(canvas) { display: block; width: 100%; height: 100%; }

.stage-state { position: absolute; z-index: 3; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 11px; color: #c8d6e6; font-size: 13px; background: rgba(7, 14, 24, 0.46); backdrop-filter: blur(4px); }
.loading-icon { animation: spin 1s linear infinite; }
.error-state { text-align: center; color: #ffc9c9; }
.error-state span { max-width: 420px; color: #aebbc9; line-height: 1.6; }
@keyframes spin { to { transform: rotate(360deg); } }

.transport { position: absolute; z-index: 3; left: 50%; bottom: 30px; width: min(620px, calc(100% - 48px)); min-height: 82px; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; gap: 18px; padding: 0 28px; border: 1px solid rgba(170, 199, 231, 0.28); border-radius: 15px; background: rgba(8, 18, 32, 0.9); box-shadow: 0 18px 55px rgba(0, 0, 0, 0.38); backdrop-filter: blur(16px); }
.transport.disabled { pointer-events: none; opacity: 0.55; }
.transport button, .playback-buttons button { display: inline-flex; align-items: center; justify-content: center; height: 44px; min-width: 58px; color: #dce8f4; background: #142438; border: 1px solid rgba(173, 202, 232, 0.28); border-radius: 8px; cursor: pointer; }
.transport button:hover, .playback-buttons button:hover { border-color: rgba(79, 164, 255, 0.75); background: #192e47; }
.transport .primary-transport { width: 58px; height: 58px; border-radius: 50%; color: white; border-color: var(--accent); background: rgba(34, 107, 181, 0.52); }
.transport-divider { width: 1px; height: 38px; background: var(--line); }
.transport-motion { min-width: 150px; display: flex; flex-direction: column; gap: 4px; }
.transport-motion span { font-size: 15px; font-weight: 650; }
.transport-motion small { color: var(--muted); font-size: 11px; }

.inspector { min-width: 0; background: linear-gradient(180deg, #17283c, #101e2f); border-left: 1px solid var(--line); overflow: hidden; }
.inspector-scroll { height: 100%; overflow-y: auto; scrollbar-color: rgba(134, 162, 192, 0.38) transparent; }
.control-section, .resource-section { padding: 22px 22px 20px; border-bottom: 1px solid var(--line); }
.selection-section { display: grid; gap: 15px; }
.selection-section label { display: grid; grid-template-columns: 66px minmax(0, 1fr); gap: 12px; align-items: center; }
.selection-section label > span, .range-control > span { color: #d8e3ef; font-size: 13px; }
select { width: 100%; color: #edf4fb; background: #122033; border: 1px solid rgba(170, 199, 229, 0.3); border-radius: 7px; font: 500 13px/1.2 inherit; outline: none; }
.selection-section select { height: 42px; padding: 0 12px; }
select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(60, 156, 255, 0.12); }
h2 { margin: 0; color: #d4dfeb; font-size: 12px; font-weight: 650; letter-spacing: 0.05em; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
.section-heading > div { display: flex; flex-direction: column; gap: 5px; }
.section-heading span { color: var(--muted); font-size: 11px; }
.text-button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; color: #bcd0e4; background: transparent; border: 0; border-radius: 6px; font: 600 11px/1 inherit; cursor: pointer; }
.text-button:hover { background: rgba(255, 255, 255, 0.06); }
.motion-select { height: 208px; padding: 5px; overflow-y: auto; }
.motion-select option { padding: 10px 9px; border-radius: 5px; color: #bdcddd; }
.motion-select option:checked { color: #fff; background: linear-gradient(#174b78, #174b78); }
.choreography-section { display: grid; gap: 15px; background: rgba(30, 74, 116, 0.14); }
.singer-status { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 10px; align-items: center; min-height: 48px; padding: 9px 11px; color: #9db0c4; background: rgba(7, 17, 31, 0.42); border: 1px solid rgba(157, 176, 196, 0.16); border-radius: 8px; }
.singer-status > div { display: grid; gap: 4px; }
.singer-status span { color: var(--muted); font-size: 10px; letter-spacing: 0.08em; }
.singer-status strong { color: #dce8f4; font-size: 12px; }
.singer-status small { color: #8296aa; font-size: 10px; }
.singer-status.singing { color: #7fc0ff; background: rgba(38, 116, 190, 0.18); border-color: rgba(74, 160, 242, 0.42); }
.singer-status.singing strong, .singer-status.singing small { color: #dff1ff; }
.lip-sync-status { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; }
.lip-sync-status strong { color: var(--text); font-weight: 600; }
.lip-sync-status small { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.audio-error { color: #ff9b9b; font-size: 11px; }
.song-position { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 10px; align-items: center; color: #d8e3ef; font-size: 13px; }
.song-position select { height: 38px; padding: 0 10px; }
.timeline-control { display: grid; gap: 7px; }
.timeline-control input { width: 100%; margin: 0; accent-color: var(--accent); }
.timeline-control span { color: var(--muted); font: 600 11px/1 monospace; text-align: right; }
.choreography-play { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; color: white; background: rgba(34, 107, 181, 0.52); border: 1px solid var(--accent); border-radius: 8px; font: 650 12px/1 inherit; cursor: pointer; }
.choreography-play:hover { background: rgba(40, 127, 213, 0.62); }
.playback-section { display: grid; gap: 17px; }
.playback-buttons { display: flex; gap: 10px; }
.playback-buttons .wide-play { flex: 1; gap: 8px; font: 600 12px/1 inherit; }
.range-control { display: grid; grid-template-columns: 42px minmax(0, 1fr) 48px; gap: 10px; align-items: center; }
.range-control input { width: 100%; accent-color: var(--accent); }
.range-control output { color: #e9f2fb; font: 600 12px/1 inherit; text-align: right; font-variant-numeric: tabular-nums; }
.resource-section { border-bottom: 0; }
.resource-section h2 { margin-bottom: 14px; }
.resource-section dl { margin: 0; display: grid; gap: 10px; }
.resource-section dl div { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 10px; font-size: 11px; }
.resource-section dt { color: var(--muted); }
.resource-section dd { margin: 0; color: #d3dfeb; overflow-wrap: anywhere; }

@media (max-width: 860px) {
  .lab-header { height: 54px; padding: 0 12px; gap: 11px; }
  .lab-header h1 { font-size: 16px; }
  .header-meta { display: none; }
  .lab-workspace { inset-top: 54px; grid-template-columns: 1fr; grid-template-rows: minmax(390px, 58vh) minmax(0, 1fr); overflow-y: auto; }
  .stage-shell { min-height: 390px; }
  .inspector { border-left: 0; border-top: 1px solid var(--line); overflow: visible; }
  .inspector-scroll { height: auto; overflow: visible; }
  .transport { bottom: 16px; min-height: 66px; gap: 10px; padding: 0 14px; }
  .transport button { min-width: 44px; height: 40px; }
  .transport .primary-transport { width: 48px; height: 48px; }
  .transport-motion { min-width: 0; flex: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .loading-icon { animation: none; }
}
</style>
