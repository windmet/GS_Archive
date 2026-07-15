<template>
  <div
    class="chibi-stage"
    :data-stage-ready="stageReady"
    :data-song-id="selectedSong?.id || ''"
    :data-active-positions="activePositions.join(',')"
    :data-loaded-positions="loadedPositions.join(',')"
    :data-current-singers="currentSingerPositions.join(',')"
  >
    <header class="stage-header">
      <button class="icon-button" type="button" aria-label="返回资料馆" @click="emit('back')">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-divider" aria-hidden="true"></div>
      <div>
        <h1>舞台小人 · 多人舞台</h1>
        <p>共享歌曲时钟 · 独立动作轨道与口型</p>
      </div>
      <button class="lab-link" type="button" @click="emit('open-lab')">单人实验室</button>
      <div class="header-meta">Spine 3.8 · {{ loadedPositions.length }}/{{ activePositions.length }} 人就绪</div>
    </header>

    <main class="stage-workspace">
      <section class="performance-shell" aria-label="多人舞台预览">
        <div class="stage-backdrop" aria-hidden="true"></div>
        <div class="stage-floor" aria-hidden="true"></div>
        <div ref="canvasRef" class="stage-canvas"></div>

        <div class="performance-hud">
          <span>NOW PLAYING</span>
          <strong>{{ selectedSong?.title || '—' }}</strong>
          <small>{{ activePositions.length }} 人编排 · 当前演唱 {{ currentSingerLabel }}</small>
        </div>

        <div class="position-rail" aria-label="舞台站位状态">
          <div
            v-for="position in allPositions"
            :key="position"
            class="position-marker"
            :class="{
              active: activePositions.includes(position),
              loaded: loadedPositions.includes(position),
              singing: currentSingerPositions.includes(position),
            }"
            :data-position="position"
            :data-motion="slotByPosition(position)?.currentMotion || ''"
          >
            <span>{{ position }}</span>
            <small>{{ characterForSlot(slotByPosition(position))?.name || '空位' }}</small>
          </div>
        </div>

        <div v-if="booting" class="stage-state">
          <LoaderCircle class="loading-icon" :size="28" />
          <span>{{ statusText }}</span>
        </div>
        <div v-else-if="errorText" class="stage-state error-state">
          <CircleAlert :size="28" />
          <strong>多人舞台暂时无法加载</strong>
          <span>{{ errorText }}</span>
        </div>

        <div class="transport" :class="{ disabled: !stageReady || preloading }">
          <button type="button" aria-label="回到开头" @click="resetStage">
            <RotateCcw :size="19" />
          </button>
          <button
            class="primary-transport"
            type="button"
            :aria-label="playing ? '暂停多人编排' : '播放多人编排'"
            :disabled="!stageReady || preloading"
            @click="toggleStage"
          >
            <Pause v-if="playing" :size="22" fill="currentColor" />
            <Play v-else :size="22" fill="currentColor" />
          </button>
          <div class="transport-copy">
            <strong>{{ preloading ? `正在预载动作 ${preloadProgress}%` : (playing ? '多人编排播放中' : '多人编排已暂停') }}</strong>
            <small>{{ formatTime(stageTime) }} / {{ formatTime(stageDuration) }}</small>
          </div>
          <input
            v-model.number="stageTime"
            aria-label="多人舞台时间轴"
            type="range"
            min="0"
            :max="stageDuration"
            step="100"
            @change="seekStage"
          />
        </div>
      </section>

      <aside class="stage-inspector" aria-label="多人舞台控制台">
        <div class="inspector-scroll">
          <section class="control-section song-section">
            <div class="section-heading">
              <div>
                <h2>歌曲编排</h2>
                <span>{{ songs.length }} 份有效编排</span>
              </div>
              <Music2 :size="18" />
            </div>
            <select v-model="selectedSongId" aria-label="多人舞台歌曲" @change="handleSongChange">
              <option v-for="song in songs" :key="song.id" :value="song.id">
                {{ song.title }} · {{ song.positions.join('/') }} 号位
              </option>
            </select>
            <div class="song-facts">
              <span>{{ selectedSong?.events.length || 0 }} 条动作</span>
              <span>{{ selectedSong?.singerEvents.length || 0 }} 次演唱切换</span>
              <span>{{ selectedSongAudio ? '官方音频' : '无音频' }}</span>
            </div>
          </section>

          <section class="control-section lineup-section">
            <div class="section-heading">
              <div>
                <h2>演出编队</h2>
                <span>站位按舞台从左到右编号</span>
              </div>
              <UsersRound :size="18" />
            </div>

            <article
              v-for="slot in lineup"
              :key="slot.position"
              class="lineup-card"
              :class="{ inactive: !activePositions.includes(slot.position), singing: currentSingerPositions.includes(slot.position) }"
              :data-lineup-position="slot.position"
              :data-runtime-ready="Boolean(runtimeForPosition(slot.position))"
            >
              <div class="slot-number">
                <span>{{ slot.position }}</span>
                <small>{{ activePositions.includes(slot.position) ? (slot.loading ? '加载中' : '出演') : '休息' }}</small>
              </div>
              <div class="slot-controls">
                <select
                  v-model="slot.characterId"
                  :aria-label="`${slot.position}号位角色`"
                  :disabled="!activePositions.includes(slot.position)"
                  @change="handleCharacterChange(slot)"
                >
                  <option v-for="character in characters" :key="character.id" :value="character.id">
                    {{ character.name }}
                  </option>
                </select>
                <select
                  v-model="slot.costumeId"
                  :aria-label="`${slot.position}号位服装`"
                  :disabled="!activePositions.includes(slot.position)"
                  @change="loadSlot(slot)"
                >
                  <option v-for="costume in costumesForSlot(slot)" :key="costume.id" :value="costume.id">
                    {{ costume.label }}
                  </option>
                </select>
              </div>
              <Mic2 v-if="currentSingerPositions.includes(slot.position)" class="singing-icon" :size="17" />
            </article>

            <button class="rebuild-button" type="button" :disabled="booting" @click="rebuildStage">
              <RefreshCw :size="16" />重新构建当前编队
            </button>
          </section>

          <section class="control-section playback-section">
            <div class="section-heading">
              <div>
                <h2>播放参数</h2>
                <span>歌曲、动作、口型共用同一时钟</span>
              </div>
            </div>
            <label class="range-control">
              <span>速度</span>
              <input v-model.number="playbackSpeed" type="range" min="0.5" max="2" step="0.05" @input="applyPlaybackSpeed" />
              <output>{{ playbackSpeed.toFixed(2) }}×</output>
            </label>
            <dl class="runtime-summary">
              <div><dt>活动站位</dt><dd>{{ activePositions.join(' / ') || '—' }}</dd></div>
              <div><dt>当前演唱</dt><dd>{{ currentSingerLabel }}</dd></div>
              <div><dt>动作预载</dt><dd>{{ preloading ? `${preloadProgress}%` : (songMotionsReady ? '已完成' : '播放时载入') }}</dd></div>
              <div><dt>音频时钟</dt><dd>{{ audioReady ? '已就绪' : '等待加载' }}</dd></div>
            </dl>
            <small v-if="audioError" class="audio-error">{{ audioError }}</small>
          </section>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowReactive } from 'vue'
import * as PIXI from 'pixi.js'
import {
  ArrowLeft,
  CircleAlert,
  LoaderCircle,
  Mic2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  UsersRound,
} from '@lucide/vue'
import {
  LIVE_CHIBI_BASE,
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

const emit = defineEmits(['back', 'open-lab'])
const canvasRef = ref(null)
const manifest = ref(null)
const choreography = ref(null)
const musicIndex = ref(null)
const selectedSongId = ref('')
const lineup = ref([])
const booting = ref(true)
const preloading = ref(false)
const preloadProgress = ref(0)
const songMotionsReady = ref(false)
const statusText = ref('正在读取多人舞台资源…')
const errorText = ref('')
const audioReady = ref(false)
const audioError = ref('')
const stageTime = ref(0)
const playbackSpeed = ref(1)
const playing = ref(false)
const allPositions = [1, 2, 3, 4, 5]

let app = null
let resizeObserver = null
let animationFrame = 0
let playbackStartedAt = 0
let playbackStartOffset = 0
let songAudio = null
let lipSyncCurve = null
let lipSyncSequence = 0
let stageBuildSequence = 0
const runtimes = shallowReactive(new Map())
const eventIndices = new Map()

const characters = computed(() => manifest.value?.characters || [])
const songs = computed(() => choreography.value?.songs || [])
const selectedSong = computed(() => songs.value.find(song => song.id === selectedSongId.value) || null)
const activePositions = computed(() => selectedSong.value?.positions || [])
const activeSlots = computed(() => lineup.value.filter(slot => activePositions.value.includes(slot.position)))
const loadedPositions = computed(() => activePositions.value.filter(position => runtimes.has(position)))
const stageReady = computed(() => Boolean(selectedSong.value)
  && activePositions.value.length > 0
  && loadedPositions.value.length === activePositions.value.length
  && !booting.value)
const selectedSongAudio = computed(() => selectedSong.value
  ? musicIndex.value?.songs?.[selectedSong.value.id] || null
  : null)
const stageDuration = computed(() => Math.max(
  selectedSong.value?.duration || 0,
  selectedSong.value?.lipSync?.duration || 0,
  selectedSongAudio.value?.duration || 0,
))
const motionCatalog = computed(() => new Map(
  (choreography.value?.motionCatalog || []).map(motion => [motion.id, motion]),
))
const currentSingerEvent = computed(() => [...(selectedSong.value?.singerEvents || [])]
  .reverse()
  .find(event => event.time <= stageTime.value))
const currentSingerPositions = computed(() => currentSingerEvent.value?.singers || [])
const currentSingerLabel = computed(() => currentSingerPositions.value.length
  ? currentSingerPositions.value.map(position => `${position}号位`).join('、')
  : '无人')

onMounted(async () => {
  await nextTick()
  createPixiApp()
  try {
    manifest.value = await fetchLiveChibiManifest()
    choreography.value = await fetchLiveChibiChoreography(manifest.value.choreography.index)
    musicIndex.value = await fetchLiveChibiMusicIndex()
    initializeLineup()
    selectedSongId.value = songs.value.find(song => song.id === 'drvalv_live_effect')?.id
      || songs.value[0]?.id
      || ''
    await Promise.all([loadSongLipSync(), loadSongAudio()])
    await rebuildStage()
  } catch (error) {
    booting.value = false
    errorText.value = error.message
    console.error('[ChibiStage] initialization failed', error)
  }
})

onBeforeUnmount(() => {
  stageBuildSequence += 1
  lipSyncSequence += 1
  stopStage()
  resizeObserver?.disconnect()
  releaseAudio()
  for (const runtime of runtimes.values()) destroyLiveChibi(runtime)
  runtimes.clear()
  app?.destroy(true)
  app = null
})

function initializeLineup() {
  lineup.value = allPositions.map((position, index) => {
    const character = characters.value[index % Math.max(characters.value.length, 1)]
    return {
      position,
      characterId: character?.id || '',
      costumeId: character?.defaultCostume || character?.costumes?.[0]?.id || '',
      loading: false,
      loadSequence: 0,
      motionSequence: 0,
      currentMotion: null,
    }
  })
}

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
  app.stage.sortableChildren = true
  host.appendChild(app.view)
  resizeObserver = new ResizeObserver(() => resizeStage())
  resizeObserver.observe(host)
}

function slotByPosition(position) {
  return lineup.value.find(slot => slot.position === position) || null
}

function runtimeForPosition(position) {
  return runtimes.get(position) || null
}

function characterForSlot(slot) {
  if (!slot) return null
  return characters.value.find(character => character.id === slot.characterId) || null
}

function costumesForSlot(slot) {
  return characterForSlot(slot)?.costumes || []
}

function costumeForSlot(slot) {
  return costumesForSlot(slot).find(costume => costume.id === slot.costumeId) || null
}

async function handleCharacterChange(slot) {
  const character = characterForSlot(slot)
  slot.costumeId = character?.defaultCostume || character?.costumes?.[0]?.id || ''
  await loadSlot(slot)
}

async function loadSlot(slot) {
  if (!app || !activePositions.value.includes(slot.position)) return
  const character = characterForSlot(slot)
  const costume = costumeForSlot(slot)
  if (!character || !costume) return

  const sequence = ++slot.loadSequence
  slot.motionSequence += 1
  slot.loading = true
  songMotionsReady.value = false
  const oldRuntime = runtimes.get(slot.position)
  if (oldRuntime) {
    runtimes.delete(slot.position)
    destroyLiveChibi(oldRuntime)
  }

  try {
    const runtime = await createLiveChibi(character, costume)
    if (sequence !== slot.loadSequence || !app) {
      destroyLiveChibi(runtime)
      return
    }
    const stageRuntime = markRaw({
      ...runtime,
      loadedMotions: new Map(),
      preloadedSongs: new Set(),
      characterId: character.id,
      costumeId: costume.id,
      stagePosition: slot.position,
    })
    runtimes.set(slot.position, stageRuntime)
    app.stage.addChild(stageRuntime.spine)
    slot.loading = false
    resizeStage()
    await syncSlotAtTime(slot, stageTime.value, true)
    applyCurrentLipSync()
  } catch (error) {
    if (sequence !== slot.loadSequence) return
    slot.loading = false
    errorText.value = `${slot.position}号位加载失败：${error.message}`
    console.error('[ChibiStage] slot load failed', slot.position, error)
  }
}

async function rebuildStage() {
  const buildSequence = ++stageBuildSequence
  stopStage()
  booting.value = true
  errorText.value = ''
  songMotionsReady.value = false
  statusText.value = `正在构建 ${activePositions.value.length} 人编队…`

  for (const position of allPositions) {
    const runtime = runtimes.get(position)
    if (runtime) runtime.spine.visible = activePositions.value.includes(position)
  }
  try {
    await Promise.all(activeSlots.value.map(slot => loadSlot(slot)))
    if (buildSequence !== stageBuildSequence) return
    booting.value = false
    resizeStage()
    await seekStage()
  } catch (error) {
    if (buildSequence !== stageBuildSequence) return
    booting.value = false
    errorText.value = error.message
  }
}

function sourceSlotForStagePosition(position) {
  return selectedSong.value?.stagePositionMap
    ?.find(item => item.stagePosition === position)?.performerSlot || position
}

function eventsForPosition(position) {
  return (selectedSong.value?.events || [])
    .filter(event => (event.stagePosition ?? event.position) === position)
}

function positionStateForStage(position, milliseconds) {
  const sourceSlot = sourceSlotForStagePosition(position)
  const events = (selectedSong.value?.positionEvents || [])
    .filter(event => event.position === sourceSlot)
  return [...events].reverse().find(event => event.time <= milliseconds)
    || events[0]
    || null
}

function layoutRuntime(position, motionEvent = null) {
  const runtime = runtimes.get(position)
  if (!runtime || !app || !canvasRef.value) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const positionState = positionStateForStage(position, stageTime.value)
  const fallbackX = [-460, -230, 0, 230, 460][position - 1]
  const positionIsNewer = positionState
    && (!motionEvent || Number(positionState.time) > Number(motionEvent.time))
  const x = Number(positionIsNewer ? positionState.x : (motionEvent?.x ?? positionState?.x ?? fallbackX))
  const y = Number(positionIsNewer ? positionState.y : (motionEvent?.y ?? positionState?.y ?? 180))
  const sourceScale = Number(positionState?.scale ?? 1700)
  const viewportScale = Math.min(width / 1280, height / 720)
  const character = characters.value.find(item => item.id === runtime.characterId)
  const characterScale = Number(character?.previewScale) || 0.28
  const viewportFit = Math.min(1, height / 620)
  const ensembleScale = activePositions.value.length >= 5 ? 0.58
    : activePositions.value.length >= 4 ? 0.64
      : activePositions.value.length >= 3 ? 0.72
        : activePositions.value.length >= 2 ? 0.84
          : 1

  runtime.spine.x = width * 0.5 + x * viewportScale
  runtime.spine.y = height * 0.82 + (y - 180) * viewportScale * 0.32
  runtime.spine.scale.set(characterScale * ensembleScale * viewportFit * sourceScale / 1700)
  runtime.spine.visible = activePositions.value.includes(position) && y < 4000
  runtime.spine.zIndex = Math.round(y * 10) + position
}

function resizeStage() {
  if (!app || !canvasRef.value) return
  const width = Math.max(1, canvasRef.value.clientWidth)
  const height = Math.max(1, canvasRef.value.clientHeight)
  app.renderer.resize(width, height)
  for (const position of activePositions.value) {
    const slot = slotByPosition(position)
    const event = eventsForPosition(position)
      .findLast?.(item => item.time <= stageTime.value)
      || [...eventsForPosition(position)].reverse().find(item => item.time <= stageTime.value)
    layoutRuntime(position, event)
    if (slot && runtimes.has(position)) runtimes.get(position).spine.visible = true
  }
}

async function handleSongChange() {
  stopStage(true)
  songMotionsReady.value = false
  errorText.value = ''
  await Promise.all([loadSongLipSync(), loadSongAudio()])
  for (const position of allPositions) {
    const runtime = runtimes.get(position)
    if (runtime) runtime.spine.visible = activePositions.value.includes(position)
  }
  const missingSlots = activeSlots.value.filter(slot => !runtimes.has(slot.position))
  if (missingSlots.length) {
    booting.value = true
    statusText.value = `正在补齐 ${missingSlots.length} 个舞台站位…`
    await Promise.all(missingSlots.map(slot => loadSlot(slot)))
    booting.value = false
  }
  resizeStage()
  await seekStage()
}

function releaseAudio() {
  if (!songAudio) return
  songAudio.pause()
  songAudio.removeAttribute('src')
  songAudio.load()
  songAudio = null
}

async function loadSongAudio() {
  releaseAudio()
  audioReady.value = false
  audioError.value = ''
  const audioEntry = selectedSongAudio.value
  if (!audioEntry) return
  const audio = new Audio(`${LIVE_CHIBI_BASE}/${audioEntry.file}`)
  audio.preload = 'auto'
  audio.playbackRate = playbackSpeed.value
  audio.addEventListener('loadedmetadata', () => {
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

async function loadSongLipSync() {
  const song = selectedSong.value
  const sequence = ++lipSyncSequence
  lipSyncCurve = null
  applyCurrentLipSync()
  if (!song?.lipSync?.file) return
  try {
    const curve = await fetchLiveChibiLipSync(song.lipSync.file)
    if (sequence !== lipSyncSequence || selectedSong.value?.id !== song.id) return
    lipSyncCurve = curve
    applyCurrentLipSync()
  } catch (error) {
    if (sequence === lipSyncSequence) console.warn('[ChibiStage] lip-sync load failed', error)
  }
}

function applyCurrentLipSync() {
  for (const position of activePositions.value) {
    applyLiveChibiLipSync(
      runtimes.get(position),
      lipSyncCurve,
      stageTime.value,
      currentSingerPositions.value.includes(position),
    )
  }
}

async function preloadSongMotions() {
  if (!selectedSong.value || !stageReady.value) return false
  const songId = selectedSong.value.id
  const targets = activeSlots.value
    .map(slot => ({ slot, runtime: runtimes.get(slot.position) }))
    .filter(item => item.runtime && !item.runtime.preloadedSongs.has(songId))
  if (!targets.length) {
    songMotionsReady.value = true
    return true
  }

  const motions = selectedSong.value.motionIds.map(id => motionCatalog.value.get(id)).filter(Boolean)
  const total = Math.max(1, targets.length * motions.length)
  let completed = 0
  preloading.value = true
  preloadProgress.value = 0
  audioError.value = ''
  try {
    await Promise.all(targets.map(async ({ runtime }) => {
      await Promise.all(motions.map(async motion => {
        await injectLiveChibiMotion(runtime, motion)
        completed += 1
        preloadProgress.value = Math.round(completed / total * 100)
      }))
      runtime.preloadedSongs.add(songId)
    }))
    songMotionsReady.value = true
    return true
  } catch (error) {
    audioError.value = `舞台动作预载失败：${error.message}`
    console.error('[ChibiStage] motion preload failed', error)
    return false
  } finally {
    preloading.value = false
  }
}

async function playSlotEvent(slot, event, { reset = false, seekTime = null } = {}) {
  const runtime = runtimes.get(slot.position)
  const motion = motionCatalog.value.get(event.motion)
  if (!runtime || !motion) return
  const sequence = ++slot.motionSequence
  const animationNames = await injectLiveChibiMotion(runtime, motion)
  if (sequence !== slot.motionSequence || runtimes.get(slot.position) !== runtime) return
  slot.currentMotion = motion.id
  const speedScale = (Number(event.speed) || 1000) / 1000
  runtime.currentMotionEvent = event
  runtime.motionSpeedScale = speedScale
  playLiveChibiMotion(runtime, animationNames, { mode: event.mode, reset })
  if (seekTime !== null && seekTime > event.time) {
    runtime.spine.update((seekTime - event.time) / 1000 * speedScale)
  }
  runtime.spine.state.timeScale = playbackSpeed.value * speedScale
  layoutRuntime(slot.position, event)
}

async function syncSlotAtTime(slot, milliseconds, reset = true) {
  const event = [...eventsForPosition(slot.position)]
    .reverse()
    .find(item => item.time <= milliseconds)
  if (event) await playSlotEvent(slot, event, { reset, seekTime: milliseconds })
  else layoutRuntime(slot.position)
}

async function seekStage() {
  stopStage()
  if (songAudio && Number.isFinite(songAudio.duration)) songAudio.currentTime = stageTime.value / 1000
  await Promise.all(activeSlots.value.map(slot => syncSlotAtTime(slot, stageTime.value, true)))
  resetEventIndices()
  applyCurrentLipSync()
}

function resetEventIndices() {
  eventIndices.clear()
  for (const position of activePositions.value) {
    const events = eventsForPosition(position)
    const index = events.findIndex(event => event.time > stageTime.value)
    eventIndices.set(position, index < 0 ? events.length : index)
  }
}

async function toggleStage() {
  if (playing.value) {
    stopStage()
    return
  }
  if (!await preloadSongMotions()) return
  if (stageTime.value >= stageDuration.value) stageTime.value = 0
  await Promise.all(activeSlots.value.map(slot => syncSlotAtTime(slot, stageTime.value, true)))
  resetEventIndices()
  playbackStartOffset = stageTime.value
  playbackStartedAt = performance.now()
  if (songAudio && selectedSongAudio.value) {
    songAudio.currentTime = stageTime.value / 1000
    songAudio.playbackRate = playbackSpeed.value
    try {
      await songAudio.play()
      audioError.value = ''
    } catch (error) {
      audioError.value = `歌曲音频无法播放：${error.message}`
      return
    }
  }
  playing.value = true
  animationFrame = requestAnimationFrame(updateStage)
}

function updateStage(now) {
  if (!playing.value || !selectedSong.value) return
  stageTime.value = Math.min(
    stageDuration.value,
    songAudio && !songAudio.paused
      ? songAudio.currentTime * 1000
      : playbackStartOffset + (now - playbackStartedAt) * playbackSpeed.value,
  )
  for (const slot of activeSlots.value) {
    const events = eventsForPosition(slot.position)
    let index = eventIndices.get(slot.position) || 0
    while (index < events.length && events[index].time <= stageTime.value) {
      playSlotEvent(slot, events[index])
      index += 1
    }
    eventIndices.set(slot.position, index)
    layoutRuntime(slot.position, runtimes.get(slot.position)?.currentMotionEvent)
  }
  applyCurrentLipSync()
  if (stageTime.value >= stageDuration.value) {
    stopStage()
    return
  }
  animationFrame = requestAnimationFrame(updateStage)
}

function stopStage(reset = false) {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
  playing.value = false
  songAudio?.pause()
  if (reset) {
    stageTime.value = 0
    if (songAudio) songAudio.currentTime = 0
  }
}

async function resetStage() {
  stopStage(true)
  await seekStage()
}

function applyPlaybackSpeed() {
  if (songAudio) songAudio.playbackRate = playbackSpeed.value
  for (const position of activePositions.value) {
    const runtime = runtimes.get(position)
    if (runtime) {
      runtime.spine.state.timeScale = playbackSpeed.value * (runtime.motionSpeedScale || 1)
    }
  }
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
</script>

<style scoped>
.chibi-stage {
  --ink: #07111f;
  --panel: #102238;
  --line: rgba(167, 197, 228, 0.18);
  --text: #edf5fc;
  --muted: #8ca2b8;
  --accent: #41a5ff;
  position: fixed;
  inset: 0;
  z-index: 100;
  color: var(--text);
  background: var(--ink);
  font-family: Inter, "Noto Sans SC", "Microsoft YaHei", sans-serif;
}

.stage-header {
  position: absolute;
  z-index: 5;
  inset: 0 0 auto;
  height: 66px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 22px;
  border-bottom: 1px solid var(--line);
  background: rgba(5, 15, 28, 0.96);
}
.stage-header h1 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }
.stage-header p { margin: 4px 0 0; color: var(--muted); font-size: 10px; }
.icon-button { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; color: var(--text); background: transparent; border: 0; border-radius: 8px; cursor: pointer; }
.icon-button:hover { background: rgba(255, 255, 255, 0.07); }
.header-divider { width: 1px; height: 28px; background: var(--line); }
.header-meta { margin-left: auto; color: var(--muted); font-size: 11px; }
.lab-link { height: 34px; margin-left: 8px; padding: 0 13px; color: #dbeeff; background: rgba(30, 109, 184, 0.22); border: 1px solid rgba(65, 165, 255, 0.42); border-radius: 7px; font: 650 11px/1 inherit; cursor: pointer; }

.stage-workspace { position: absolute; inset: 66px 0 0; display: grid; grid-template-columns: minmax(0, 1fr) 430px; min-height: 0; }
.performance-shell { position: relative; min-width: 0; overflow: hidden; background: #0b1726; }
.stage-backdrop { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(5, 12, 23, 0.16), rgba(5, 12, 23, 0.04) 55%, rgba(2, 8, 16, 0.62)), url('/assets/bg/bg086_dancestudio_in_01.png') center / cover no-repeat; filter: saturate(0.82) brightness(0.7); transform: scale(1.015); }
.stage-floor { position: absolute; z-index: 1; left: 6%; right: 6%; bottom: 7%; height: 30%; border: 1px solid rgba(104, 180, 245, 0.2); border-radius: 50%; background: radial-gradient(ellipse at center, rgba(67, 163, 241, 0.16), rgba(20, 70, 115, 0.05) 52%, transparent 72%); transform: perspective(500px) rotateX(62deg); transform-origin: center bottom; }
.stage-canvas { position: absolute; z-index: 2; inset: 0; }
.stage-canvas :deep(canvas) { display: block; width: 100%; height: 100%; }
.performance-shell::after { content: ""; position: absolute; z-index: 2; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 47%, transparent 28%, rgba(2, 7, 14, 0.34) 100%); }

.performance-hud { position: absolute; z-index: 4; top: 24px; left: 28px; display: grid; gap: 5px; padding: 13px 16px; border-left: 2px solid var(--accent); background: rgba(4, 13, 24, 0.64); backdrop-filter: blur(12px); }
.performance-hud span { color: #73bfff; font-size: 9px; font-weight: 750; letter-spacing: 0.16em; }
.performance-hud strong { font-size: 16px; }
.performance-hud small { color: var(--muted); font-size: 10px; }

.position-rail { position: absolute; z-index: 4; left: 50%; bottom: 128px; width: min(720px, calc(100% - 48px)); display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; transform: translateX(-50%); pointer-events: none; }
.position-marker { min-width: 0; display: grid; justify-items: center; gap: 4px; color: rgba(163, 184, 204, 0.3); }
.position-marker span { display: grid; place-items: center; width: 25px; height: 25px; border: 1px solid currentColor; border-radius: 50%; font: 700 10px/1 monospace; background: rgba(5, 14, 25, 0.66); }
.position-marker small { max-width: 110px; overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.position-marker.active { color: #9eb7ce; }
.position-marker.loaded span { color: #ddecf9; border-color: rgba(103, 179, 241, 0.64); }
.position-marker.singing { color: #83c8ff; }
.position-marker.singing span { color: white; border-color: #61b7ff; background: rgba(28, 112, 187, 0.7); box-shadow: 0 0 20px rgba(65, 165, 255, 0.48); }

.stage-state { position: absolute; z-index: 6; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #cbd9e7; background: rgba(5, 13, 23, 0.58); backdrop-filter: blur(5px); }
.loading-icon { animation: spin 1s linear infinite; }
.error-state { color: #ffc2c2; text-align: center; }
.error-state span { max-width: 420px; color: #b3c1cf; }
@keyframes spin { to { transform: rotate(360deg); } }

.transport { position: absolute; z-index: 5; left: 50%; bottom: 28px; width: min(760px, calc(100% - 50px)); min-height: 80px; display: grid; grid-template-columns: 44px 56px minmax(140px, auto) minmax(160px, 1fr); gap: 13px; align-items: center; padding: 0 20px; border: 1px solid rgba(150, 194, 231, 0.3); border-radius: 15px; background: rgba(5, 16, 29, 0.9); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4); transform: translateX(-50%); backdrop-filter: blur(16px); }
.transport.disabled { opacity: 0.62; }
.transport button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; color: #dceaf7; background: #142941; border: 1px solid rgba(151, 192, 227, 0.27); border-radius: 9px; cursor: pointer; }
.transport .primary-transport { width: 56px; height: 56px; border-radius: 50%; border-color: var(--accent); background: rgba(36, 119, 195, 0.56); }
.transport button:disabled { cursor: wait; }
.transport-copy { display: grid; gap: 5px; }
.transport-copy strong { font-size: 12px; }
.transport-copy small { color: var(--muted); font: 600 10px/1 monospace; }
.transport input { width: 100%; accent-color: var(--accent); }

.stage-inspector { min-width: 0; overflow: hidden; border-left: 1px solid var(--line); background: linear-gradient(180deg, #142940, #0c1b2d); }
.inspector-scroll { height: 100%; overflow-y: auto; scrollbar-color: rgba(126, 158, 187, 0.4) transparent; }
.control-section { padding: 20px; border-bottom: 1px solid var(--line); }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; color: #a9c4dd; }
.section-heading > div { display: grid; gap: 4px; }
.section-heading h2 { margin: 0; color: #d9e7f3; font-size: 12px; letter-spacing: 0.06em; }
.section-heading span { color: var(--muted); font-size: 10px; }
select { width: 100%; height: 39px; padding: 0 10px; color: #edf5fc; background: #0e2034; border: 1px solid rgba(158, 192, 222, 0.28); border-radius: 7px; outline: none; font: 500 12px/1 inherit; }
select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(65, 165, 255, 0.12); }
.song-facts { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
.song-facts span { padding: 5px 7px; color: #9eb4c8; background: rgba(4, 14, 25, 0.42); border-radius: 5px; font-size: 9px; }

.lineup-section { display: grid; gap: 9px; }
.lineup-card { position: relative; display: grid; grid-template-columns: 46px minmax(0, 1fr) 18px; gap: 9px; align-items: center; padding: 9px; border: 1px solid rgba(151, 185, 215, 0.17); border-radius: 9px; background: rgba(5, 16, 29, 0.34); transition: opacity 160ms ease, border-color 160ms ease; }
.lineup-card.inactive { opacity: 0.38; }
.lineup-card.singing { border-color: rgba(73, 171, 255, 0.52); background: rgba(27, 101, 166, 0.18); }
.slot-number { display: grid; justify-items: center; gap: 4px; }
.slot-number span { display: grid; place-items: center; width: 30px; height: 30px; color: #e3effa; border: 1px solid rgba(119, 180, 230, 0.5); border-radius: 50%; font: 700 11px/1 monospace; }
.slot-number small { color: var(--muted); font-size: 8px; }
.slot-controls { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 7px; }
.slot-controls select { height: 35px; min-width: 0; }
.singing-icon { color: #6ebcff; }
.rebuild-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; margin-top: 3px; color: #e6f3ff; background: rgba(30, 112, 185, 0.38); border: 1px solid rgba(66, 163, 246, 0.52); border-radius: 8px; font: 650 11px/1 inherit; cursor: pointer; }

.playback-section { display: grid; gap: 13px; }
.range-control { display: grid; grid-template-columns: 36px minmax(0, 1fr) 48px; gap: 9px; align-items: center; color: #c9d9e8; font-size: 11px; }
.range-control input { width: 100%; accent-color: var(--accent); }
.range-control output { text-align: right; font: 650 11px/1 monospace; }
.runtime-summary { display: grid; gap: 8px; margin: 0; }
.runtime-summary div { display: grid; grid-template-columns: 70px 1fr; gap: 10px; font-size: 10px; }
.runtime-summary dt { color: var(--muted); }
.runtime-summary dd { margin: 0; color: #d8e6f2; }
.audio-error { color: #ff9d9d; font-size: 10px; }

@media (max-width: 980px) {
  .stage-header { height: 58px; padding: 0 13px; }
  .stage-header h1 { font-size: 15px; }
  .stage-header p, .header-meta { display: none; }
  .stage-workspace { inset-top: 58px; grid-template-columns: 1fr; grid-template-rows: minmax(430px, 62vh) minmax(0, 1fr); overflow-y: auto; }
  .performance-shell { min-height: 430px; }
  .stage-inspector { overflow: visible; border-top: 1px solid var(--line); border-left: 0; }
  .inspector-scroll { height: auto; overflow: visible; }
  .position-rail { bottom: 112px; }
  .transport { bottom: 16px; min-height: 72px; grid-template-columns: 40px 50px minmax(110px, auto) 1fr; padding: 0 12px; }
  .transport button { width: 40px; height: 40px; }
  .transport .primary-transport { width: 50px; height: 50px; }
}

@media (max-width: 620px) {
  .lab-link { margin-left: auto; }
  .stage-workspace { grid-template-rows: minmax(390px, 58vh) minmax(0, 1fr); }
  .performance-shell { min-height: 390px; }
  .performance-hud { top: 14px; left: 14px; }
  .position-rail { bottom: 105px; width: calc(100% - 24px); gap: 2px; }
  .position-marker small { max-width: 58px; }
  .transport { width: calc(100% - 20px); grid-template-columns: 38px 48px 1fr; gap: 8px; }
  .transport input { grid-column: 1 / -1; margin-bottom: 8px; }
  .slot-controls { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .loading-icon { animation: none; }
}
</style>
