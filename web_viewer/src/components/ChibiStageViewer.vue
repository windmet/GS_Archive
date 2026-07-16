<template>
  <div
    class="chibi-stage"
    :data-stage-ready="stageReady"
    :data-song-id="selectedSong?.id || ''"
    :data-active-positions="activePositions.join(',')"
    :data-loaded-positions="loadedPositions.join(',')"
    :data-current-singers="currentSingerPositions.join(',')"
    :data-position-tween-ms="POSITION_TWEEN_MS"
    :data-stage-base-zoom="STAGE_BASE_ZOOM"
    :data-stage-environment-scale="environmentScale.toFixed(3)"
    :data-derived-group-events="derivedGroupEventCount"
    :data-camera-event-time="currentCameraState.eventTime"
    :data-camera-zoom="currentCameraState.zoom.toFixed(4)"
    :data-camera-x="currentCameraState.x.toFixed(2)"
    :data-camera-y="currentCameraState.y.toFixed(2)"
    :data-camera-rotation="currentCameraState.rotation.toFixed(2)"
    :data-camera-focus-position="currentCameraState.stagePosition || ''"
    :data-camera-enabled="cameraEnabled"
    :data-static-stage-enabled="staticStageEnabled"
    :data-backmonitor-enabled="backmonitorEnabled"
    :data-image-layers-enabled="imageLayersEnabled"
    :data-object-layers-enabled="objectLayersEnabled"
    :data-lighting-enabled="lightingEnabled"
    :data-beam-effects-enabled="beamEffectsEnabled"
    :data-characters-enabled="charactersEnabled"
    :data-character-shadows-enabled="characterShadowsEnabled"
    :data-lyrics-enabled="lyricsEnabled"
    :data-backmonitor-movie="currentBackmonitorState.movie || ''"
    :data-backmonitor-event-time="currentBackmonitorState.eventTime"
    :data-backmonitor-transition="currentBackmonitorState.transition || ''"
    :data-backmonitor-transition-active="backmonitorTransitionActive"
    data-backmonitor-transition-mode="alpha-overlay"
    :data-backmonitor-ready="backmonitorReady"
    :data-image-layer-count="visibleImageLayerCount"
    :data-image-layer-assets="visibleImageLayerAssets.join(',')"
    :data-image-layer-depths="visibleImageLayerDepths.join(',')"
    :data-object-layer-count="visibleObjectLayerCount"
    :data-object-layer-assets="visibleObjectLayerAssets.join(',')"
    :data-object-layer-unsupported="unsupportedObjectLayerAssets.join(',')"
    :data-spotlight-count="visibleSpotlightCount"
    :data-spotlight-ids="visibleSpotlightIds.join(',')"
    :data-laserlight-count="visibleLaserlightCount"
    :data-laserlight-ids="visibleLaserlightIds.join(',')"
    :data-pinspotlight-count="visiblePinspotlightCount"
    :data-pinspotlight-ids="visiblePinspotlightIds.join(',')"
    :data-stage-background-ready="stageBackgroundReady"
    :data-stage-background-song="stageBackgroundSongId"
    :data-current-lyric="currentLyric?.text || ''"
    :data-screen-color="currentWholeScreenColor.color"
    :data-screen-color-alpha="currentWholeScreenColor.alpha.toFixed(4)"
    :data-character-light="currentCharacterLight.color"
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

        <div v-if="currentLyric && lyricsEnabled" class="stage-lyric" aria-live="polite">
          {{ currentLyric.text }}
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
            :data-motion-source="slotByPosition(position)?.currentMotionSource || ''"
            :data-position-scale="positionDebugState(position).scale"
            :data-position-tween-progress="positionDebugState(position).progress"
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
              <span>{{ selectedSong?.cameraEvents?.length || 0 }} 条镜头</span>
              <span>{{ selectedSong?.backmonitorEvents?.length || 0 }} 条屏幕</span>
              <span>{{ selectedSong?.imageLayerEvents?.length || 0 }} 条布景</span>
              <span>{{ selectedSong?.lyricEvents?.length || 0 }} 条歌词</span>
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
            <label class="camera-toggle">
              <input v-model="cameraEnabled" type="checkbox" @change="applyCameraTransform" />
              <span>启用 CSV 角色镜头</span>
            </label>
            <fieldset class="layer-debug-controls">
              <legend>图层调试</legend>
              <label>
                <input v-model="staticStageEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>静态舞台</span>
              </label>
              <label>
                <input v-model="backmonitorEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>背景屏幕</span>
              </label>
              <label>
                <input v-model="imageLayersEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>图片布景</span>
              </label>
              <label>
                <input v-model="objectLayersEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>舞台物件</span>
              </label>
              <label>
                <input v-model="lightingEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>灯光染色</span>
              </label>
              <label>
                <input v-model="beamEffectsEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>光束灯效</span>
              </label>
              <label>
                <input v-model="charactersEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>舞台人物</span>
              </label>
              <label>
                <input v-model="characterShadowsEnabled" type="checkbox" @change="applyLayerDebugVisibility" />
                <span>人物阴影</span>
              </label>
              <label>
                <input v-model="lyricsEnabled" type="checkbox" />
                <span>歌词</span>
              </label>
            </fieldset>
            <label class="range-control environment-scale-control">
              <span>环境</span>
              <input
                v-model.number="environmentScale"
                aria-label="舞台环境缩放"
                type="range"
                min="0.9"
                max="1.3"
                step="0.005"
                @input="resizeStage"
              />
              <output>{{ environmentScale.toFixed(3) }}×</output>
            </label>
            <dl class="runtime-summary">
              <div><dt>活动站位</dt><dd>{{ activePositions.join(' / ') || '—' }}</dd></div>
              <div><dt>当前演唱</dt><dd>{{ currentSingerLabel }}</dd></div>
              <div><dt>动作预载</dt><dd>{{ preloading ? `${preloadProgress}%` : (songMotionsReady ? '已完成' : '播放时载入') }}</dd></div>
              <div><dt>音频时钟</dt><dd>{{ audioReady ? '已就绪' : '等待加载' }}</dd></div>
              <div><dt>位置过渡</dt><dd>{{ POSITION_TWEEN_MS }}ms 平滑插值</dd></div>
              <div><dt>动作组补位</dt><dd>{{ derivedGroupEventCount }} 处</dd></div>
              <div><dt>当前镜头</dt><dd>{{ currentCameraLabel }}</dd></div>
              <div><dt>舞台屏幕</dt><dd>{{ currentBackmonitorLabel }}</dd></div>
              <div><dt>图片布景</dt><dd>{{ visibleImageLayerCount }} 层</dd></div>
              <div><dt>舞台对象</dt><dd>{{ visibleObjectLayerCount }} 组</dd></div>
              <div><dt>静态舞台</dt><dd>{{ stageBackgroundReady ? '已载入' : '无/等待' }}</dd></div>
              <div><dt>当前歌词</dt><dd>{{ currentLyric?.text || '—' }}</dd></div>
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
  fetchLiveChibiBackmonitorIndex,
  fetchLiveChibiChoreography,
  fetchLiveChibiImageLayerIndex,
  fetchLiveChibiObjectLayerIndex,
  fetchLiveChibiLipSync,
  fetchLiveChibiManifest,
  fetchLiveChibiMusicIndex,
  fetchLiveChibiStageBackgroundIndex,
  fetchLiveChibiStageEffectIndex,
  injectLiveChibiMotion,
  playLiveChibiMotion,
} from '../utils/liveChibiSpine.js'

const emit = defineEmits(['back', 'open-lab'])
const canvasRef = ref(null)
const manifest = ref(null)
const choreography = ref(null)
const musicIndex = ref(null)
const backmonitorIndex = ref(null)
const imageLayerIndex = ref(null)
const objectLayerIndex = ref(null)
const stageBackgroundIndex = ref(null)
const stageEffectIndex = ref(null)
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
const cameraEnabled = ref(true)
const staticStageEnabled = ref(true)
const backmonitorEnabled = ref(true)
const imageLayersEnabled = ref(true)
const objectLayersEnabled = ref(true)
const lightingEnabled = ref(true)
const beamEffectsEnabled = ref(true)
const charactersEnabled = ref(true)
const characterShadowsEnabled = ref(true)
const lyricsEnabled = ref(true)
const backmonitorReady = ref(false)
const backmonitorTransitionActive = ref(false)
const visibleImageLayerCount = ref(0)
const visibleImageLayerAssets = ref([])
const visibleImageLayerDepths = ref([])
const visibleObjectLayerCount = ref(0)
const visibleObjectLayerAssets = ref([])
const unsupportedObjectLayerAssets = ref([])
const visibleSpotlightCount = ref(0)
const visibleSpotlightIds = ref([])
const visibleLaserlightCount = ref(0)
const visibleLaserlightIds = ref([])
const visiblePinspotlightCount = ref(0)
const visiblePinspotlightIds = ref([])
const stageBackgroundReady = ref(false)
const allPositions = [1, 2, 3, 4, 5]
const POSITION_TWEEN_MS = 350
const STAGE_BASE_ZOOM = 1.1
// Enlarge the authored environment as one registered plane while retaining
// the official full-body character framing. Stage art, monitor movies and
// fixed image/object layers all use this same factor.
const environmentScale = ref(1.073)
const CHARACTER_DEPTH_BASE = 2000
const CHARACTER_DEPTH_Y_FACTOR = 0.5
const CHARACTER_STAGE_SCALE = 0.58
// Backmonitor uses the live-stage content plane rather than the 720 px camera
// midpoint. Fitting all 54 stages with interior alpha cut-outs peaks at 250;
// using 360 leaves every movie visibly below its screen opening.
const BACKMONITOR_Y_ORIGIN = 250

let app = null
let cameraContainer = null
let backmonitorContainer = null
let backmonitorSprite = null
let backmonitorVideo = null
let backmonitorTexture = null
let backmonitorMovie = ''
let backmonitorTransitionSprite = null
let backmonitorTransitionVideo = null
let backmonitorTransitionAlphaVideo = null
let backmonitorTransitionTexture = null
let backmonitorTransitionAlphaTexture = null
let backmonitorTransitionFilter = null
let backmonitorTransition = ''
let backmonitorTransitionColorReady = false
let backmonitorTransitionAlphaReady = false
let imageLayerSongId = ''
let imageLayerSequence = 0
const imageLayerRuntimes = new Map()
const imageLayerLoads = new Map()
let objectLayerSongId = ''
let objectLayerSequence = 0
const objectLayerRuntimes = new Map()
const objectLayerLoads = new Map()
const spotlightRuntimes = new Map()
let spotlightConeTexture = null
const laserlightRuntimes = new Map()
const pinspotlightRuntimes = new Map()
const pinspotlightRuntimeLoads = new Map()
const pinspotlightTextures = new Map()
const pinspotlightLoads = new Map()
let pinspotlightEnvironmentOverlay = null
let pinspotlightLoadSequence = 0
const stageBackgroundSongId = ref('')
let stageBackgroundSequence = 0
let stageBackgroundSprite = null
let stageBackgroundTexture = null
let wholeScreenColorOverlay = null
let characterShadowTexture = null
let characterShadowLoad = null
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
const performanceEventsByPosition = computed(() => {
  const timelines = new Map(allPositions.map(position => [position, []]))
  const song = selectedSong.value
  if (!song) return timelines

  for (const position of activePositions.value) {
    const scripted = (song.events || [])
      .filter(event => (event.stagePosition ?? event.position) === position)
      .map(event => ({ ...event, source: 'script' }))
    const timeline = [...scripted]
    for (let index = 0; index < scripted.length; index += 1) {
      const event = scripted[index]
      const pauseTime = Number(event.pauseTime)
      if (!Number.isFinite(pauseTime) || pauseTime <= 0 || pauseTime >= 999999) continue
      const dueTime = Number(event.time) + pauseTime
      const nextTime = Number(scripted[index + 1]?.time ?? song.duration ?? dueTime)
      if (dueTime >= nextTime) continue
      const group = activeMotionGroupAt(dueTime)
      const motion = weightedGroupMotion(group, dueTime, position)
      if (!motion) continue
      timeline.push({
        ...event,
        time: dueTime,
        motion: motion.motion,
        speed: 1000,
        mode: 2,
        pauseTime: 999999,
        motionGroup: group,
        source: 'group',
      })
    }
    timelines.set(position, timeline.sort((a, b) => a.time - b.time || (a.source === 'script' ? -1 : 1)))
  }
  return timelines
})
const derivedGroupEventCount = computed(() => [...performanceEventsByPosition.value.values()]
  .flat()
  .filter(event => event.source === 'group').length)
const currentCameraState = computed(() => cameraStateAt(stageTime.value))
const currentBackmonitorState = computed(() => backmonitorStateAt(stageTime.value))
const currentBackmonitorLabel = computed(() => currentBackmonitorState.value.movie
  ? currentBackmonitorState.value.movie.replace('live_backmonitor_movie_', '')
  : '无')
const currentLyric = computed(() => lyricAt(stageTime.value))
const currentWholeScreenColor = computed(() => wholeScreenColorAt(stageTime.value))
const currentCharacterLight = computed(() => characterLightAt(stageTime.value))
const currentCameraLabel = computed(() => {
  const camera = currentCameraState.value
  const focus = camera.stagePosition ? `${camera.stagePosition}号位` : '自由'
  return `${camera.zoom.toFixed(2)}× · ${focus} · ${camera.rotation.toFixed(1)}°`
})

onMounted(async () => {
  await nextTick()
  createPixiApp()
  try {
    manifest.value = await fetchLiveChibiManifest()
    choreography.value = await fetchLiveChibiChoreography(manifest.value.choreography.index)
    ;[
      musicIndex.value,
      backmonitorIndex.value,
      imageLayerIndex.value,
      objectLayerIndex.value,
      stageBackgroundIndex.value,
      stageEffectIndex.value,
    ] = await Promise.all([
      fetchLiveChibiMusicIndex(),
      fetchLiveChibiBackmonitorIndex(),
      fetchLiveChibiImageLayerIndex(),
      fetchLiveChibiObjectLayerIndex(),
      fetchLiveChibiStageBackgroundIndex(),
      fetchLiveChibiStageEffectIndex(),
    ])
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
  releaseBackmonitor()
  releaseImageLayers()
  releaseObjectLayers()
  releaseSpotlights()
  releaseLaserlights()
  releasePinspotlights()
  releaseStageBackground()
  for (const runtime of runtimes.values()) destroyStageRuntime(runtime)
  runtimes.clear()
  characterShadowTexture?.destroy(true)
  characterShadowTexture = null
  characterShadowLoad = null
  app?.destroy(true)
  app = null
  cameraContainer = null
  backmonitorContainer = null
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
      currentMotionSource: '',
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
  cameraContainer = markRaw(new PIXI.Container())
  cameraContainer.sortableChildren = true
  backmonitorContainer = markRaw(new PIXI.Container())
  // Backmonitor movies are projected through transparent cut-outs in the
  // authored stage art.  Keep the video below the static stage composite so
  // the opaque clockwork/floor pixels act as the original Unity mask.
  backmonitorContainer.zIndex = -30000
  cameraContainer.addChild(backmonitorContainer)
  app.stage.addChild(cameraContainer)
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

function ensureCharacterShadowTexture() {
  if (characterShadowTexture) return Promise.resolve(characterShadowTexture)
  if (!characterShadowLoad) {
    const relativePath = manifest.value?.shared?.characterShadow || 'shared/character-shadow.png'
    characterShadowLoad = loadImageLayerTexture(relativePath).then(texture => {
      characterShadowTexture = texture
      return texture
    })
  }
  return characterShadowLoad
}

function destroyStageRuntime(runtime) {
  runtime?.groundShadow?.removeFromParent()
  runtime?.groundShadow?.destroy()
  destroyLiveChibi(runtime)
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
    destroyStageRuntime(oldRuntime)
  }

  try {
    const [runtime, shadowTexture] = await Promise.all([
      createLiveChibi(character, costume),
      ensureCharacterShadowTexture(),
    ])
    if (sequence !== slot.loadSequence || !app) {
      destroyLiveChibi(runtime)
      return
    }
    const groundShadow = markRaw(new PIXI.Sprite(shadowTexture))
    groundShadow.anchor.set(0.5)
    // The source PNG already tops out at 50% alpha; avoid attenuating it a
    // second time or it disappears against the illuminated stage floor.
    groundShadow.alpha = 1
    const stageRuntime = markRaw({
      ...runtime,
      groundShadow,
      loadedMotions: new Map(),
      preloadedSongs: new Set(),
      characterId: character.id,
      costumeId: costume.id,
      stagePosition: slot.position,
    })
    runtimes.set(slot.position, stageRuntime)
    cameraContainer.addChild(stageRuntime.groundShadow)
    cameraContainer.addChild(stageRuntime.spine)
    slot.loading = false
    resizeStage()
    await syncSlotAtTime(slot, stageTime.value, true)
    applyCurrentLipSync()
    applyStageLighting()
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
  return performanceEventsByPosition.value.get(position) || []
}

function activeMotionGroupAt(milliseconds) {
  return [...(selectedSong.value?.motionGroupChanges || [])]
    .reverse()
    .find(event => Number(event.time) <= milliseconds)?.group ?? null
}

function weightedGroupMotion(group, milliseconds, position) {
  if (group === null) return null
  const pool = (selectedSong.value?.motionGroupEvents || [])
    .filter(event => event.group === group && Number(event.time) <= milliseconds && Number(event.weight) > 0)
  const totalWeight = pool.reduce((sum, event) => sum + Number(event.weight), 0)
  if (!pool.length || totalWeight <= 0) return null
  const seedText = `${selectedSong.value.id}:${position}:${milliseconds}:${group}`
  let hash = 2166136261
  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  let selection = (hash >>> 0) % totalWeight
  for (const event of pool) {
    selection -= Number(event.weight)
    if (selection < 0) return event
  }
  return pool[pool.length - 1]
}

function positionStateForStage(position, milliseconds) {
  const sourceSlot = sourceSlotForStagePosition(position)
  const events = (selectedSong.value?.positionEvents || [])
    .filter(event => event.position === sourceSlot)
  if (!events.length) return null
  const currentIndex = Math.max(0, events.findLastIndex(event => event.time <= milliseconds))
  const current = events[currentIndex]
  const previous = events[currentIndex - 1]
  if (!previous || milliseconds >= Number(current.time) + POSITION_TWEEN_MS) {
    return { ...current, tweenProgress: 1 }
  }
  const rawProgress = Math.max(0, Math.min(1, (milliseconds - Number(current.time)) / POSITION_TWEEN_MS))
  const progress = rawProgress * rawProgress * (3 - 2 * rawProgress)
  const interpolate = key => Number(previous[key]) + (Number(current[key]) - Number(previous[key])) * progress
  return {
    ...current,
    x: interpolate('x'),
    y: interpolate('y'),
    scale: interpolate('scale'),
    tweenProgress: rawProgress,
  }
}

function positionDebugState(position) {
  const state = positionStateForStage(position, stageTime.value)
  return {
    scale: state ? Number(state.scale).toFixed(2) : '',
    progress: state ? Number(state.tweenProgress ?? 1).toFixed(3) : '',
  }
}

function layoutCoordinatesForStage(position, milliseconds, motionEvent = null) {
  const positionState = positionStateForStage(position, milliseconds)
  const event = motionEvent || [...eventsForPosition(position)]
    .reverse()
    .find(item => Number(item.time) <= milliseconds)
  const fallbackX = [-460, -230, 0, 230, 460][position - 1]
  const positionIsNewer = positionState
    && (!event || Number(positionState.time) > Number(event.time))
  return {
    x: Number(positionIsNewer ? positionState.x : (event?.x ?? positionState?.x ?? fallbackX)),
    y: Number(positionIsNewer ? positionState.y : (event?.y ?? positionState?.y ?? 180)),
    scale: Number(positionState?.scale ?? 1700),
    positionState,
  }
}

function sampleCameraTween(tween, milliseconds) {
  if (!tween) return 0
  if (tween.duration <= 1 || milliseconds >= tween.start + tween.duration) return tween.to
  const raw = Math.max(0, Math.min(1, (milliseconds - tween.start) / tween.duration))
  const eased = 1 - ((1 - raw) ** 3)
  return tween.from + (tween.to - tween.from) * eased
}

function cameraStateAt(milliseconds) {
  const state = {
    zoom: 1,
    x: 0,
    y: 360,
    rotation: 0,
    focusSlot: null,
    stagePosition: null,
    eventTime: '',
  }
  let zoomTween = null
  let xTween = null
  let yTween = null
  let rotationTween = null

  for (const event of (selectedSong.value?.cameraEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    state.zoom = zoomTween ? sampleCameraTween(zoomTween, eventTime) : state.zoom
    state.x = xTween ? sampleCameraTween(xTween, eventTime) : state.x
    state.y = yTween ? sampleCameraTween(yTween, eventTime) : state.y
    state.rotation = rotationTween ? sampleCameraTween(rotationTween, eventTime) : state.rotation

    if (event.focusSlot !== null && event.focusSlot !== undefined) {
      state.focusSlot = Number(event.focusSlot) > 0 ? Number(event.focusSlot) : null
      state.stagePosition = state.focusSlot
        ? (event.stagePosition || selectedSong.value?.stagePositionMap
          ?.find(item => item.performerSlot === state.focusSlot)?.stagePosition || null)
        : null
    }
    if (event.zoom !== null && event.zoom !== undefined) {
      zoomTween = {
        from: state.zoom,
        to: Number(event.zoom) / 1000,
        start: eventTime,
        duration: Math.max(0, Number(event.zoomDuration) || 0),
      }
    }
    if (event.x !== null || event.y !== null || event.focusSlot !== null) {
      const focusX = state.stagePosition
        ? layoutCoordinatesForStage(state.stagePosition, eventTime).x
        : 0
      const targetX = state.stagePosition
        ? focusX + Number(event.x ?? 0)
        : Number(event.x ?? state.x)
      // The source uses a character-root coordinate system when focusSlot is set;
      // its Y=0 and free-camera Y=360 both represent the visual stage centre.
      const targetY = state.stagePosition ? 360 : Number(event.y ?? state.y)
      const duration = Math.max(0, Number(event.moveDuration) || 0)
      xTween = { from: state.x, to: targetX, start: eventTime, duration }
      yTween = { from: state.y, to: targetY, start: eventTime, duration }
    }
    if (event.rotation !== null && event.rotation !== undefined) {
      rotationTween = {
        from: state.rotation,
        to: Number(event.rotation),
        start: eventTime,
        duration: Math.max(0, Number(event.rotationDuration) || 0),
      }
    }
    state.eventTime = eventTime
  }

  state.zoom = zoomTween ? sampleCameraTween(zoomTween, milliseconds) : state.zoom
  state.x = xTween ? sampleCameraTween(xTween, milliseconds) : state.x
  state.y = yTween ? sampleCameraTween(yTween, milliseconds) : state.y
  state.rotation = rotationTween ? sampleCameraTween(rotationTween, milliseconds) : state.rotation
  return state
}

function backmonitorStateAt(milliseconds) {
  const state = {
    movie: null,
    movieTime: 0,
    transition: null,
    transitionTime: 0,
    x: 0,
    y: 360,
    scale: 1000,
    rotation: 0,
    opacity: 1000,
    eventTime: '',
  }
  for (const event of (selectedSong.value?.backmonitorEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    if (event.movie) {
      state.movie = event.movie
      state.movieTime = eventTime
    }
    for (const key of ['x', 'y', 'scale', 'rotation', 'opacity']) {
      if (event[key] !== null && event[key] !== undefined) state[key] = Number(event[key])
    }
    state.transition = event.transition || null
    if (state.transition) state.transitionTime = eventTime
    state.eventTime = eventTime
  }
  return state
}

function parseHexColor(value, fallback = 0xffffff) {
  const match = String(value || '').match(/^#?([0-9a-f]{6})/i)
  return match ? Number.parseInt(match[1], 16) : fallback
}

function mixRgb(from, to, progress) {
  const amount = Math.max(0, Math.min(1, progress))
  const channel = shift => Math.round(
    ((from >> shift) & 0xff) + (((to >> shift) & 0xff) - ((from >> shift) & 0xff)) * amount,
  )
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

function sampleColorTransition(transition, milliseconds) {
  if (!transition) return null
  const progress = transition.duration <= 0
    ? 1
    : Math.max(0, Math.min(1, (milliseconds - transition.start) / transition.duration))
  return {
    color: mixRgb(transition.from.color, transition.to.color, progress),
    alpha: transition.from.alpha + (transition.to.alpha - transition.from.alpha) * progress,
    depth: transition.to.depth,
    eventTime: transition.start,
  }
}

function colorTrackAt(events, milliseconds, initial, targetForEvent) {
  let state = { ...initial }
  let transition = null
  for (const event of events || []) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    if (transition) state = sampleColorTransition(transition, eventTime)
    const target = targetForEvent(event, state)
    transition = {
      from: state,
      to: target,
      start: eventTime,
      duration: Math.max(0, Number(event.duration) || 0),
    }
    state = sampleColorTransition(transition, eventTime)
  }
  return transition ? sampleColorTransition(transition, milliseconds) : state
}

function wholeScreenColorAt(milliseconds) {
  return colorTrackAt(
    selectedSong.value?.wholeScreenColorEvents,
    milliseconds,
    { color: 0x000000, alpha: 0, depth: 1750, eventTime: '' },
    (event, state) => ({
      color: event.hide ? state.color : parseHexColor(event.color, state.color),
      alpha: event.hide ? 0 : Math.max(0, Math.min(1, Number(event.opacity) / 1000)),
      depth: Number(event.depth ?? state.depth),
    }),
  )
}

function characterLightAt(milliseconds) {
  return colorTrackAt(
    selectedSong.value?.characterLightEvents,
    milliseconds,
    { color: 0xffffff, alpha: 1, depth: 1250, eventTime: '' },
    event => ({
      color: mixRgb(
        0xffffff,
        parseHexColor(event.color),
        Math.max(0, Math.min(1, Number(event.opacity) / 1000)),
      ),
      alpha: 1,
      depth: Number(event.depth ?? 1250),
    }),
  )
}

function lyricAt(milliseconds) {
  const events = selectedSong.value?.lyricEvents || []
  const event = [...events].reverse().find(item => Number(item.time) <= milliseconds)
  if (!event || milliseconds >= Number(event.time) + Number(event.duration || 0)) return null
  return event
}

function layoutStageBackground() {
  if (!app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const sprite of [stageBackgroundSprite, wholeScreenColorOverlay]) {
    if (!sprite) continue
    sprite.position.set(width * 0.5, height * 0.5)
    sprite.scale.set(viewportScale * environmentScale.value)
  }
  if (stageBackgroundSprite) stageBackgroundSprite.visible = staticStageEnabled.value
}

function releaseStageBackground() {
  stageBackgroundSequence += 1
  stageBackgroundSprite?.removeFromParent()
  stageBackgroundSprite?.destroy()
  stageBackgroundTexture?.destroy(true)
  stageBackgroundSprite = null
  stageBackgroundTexture = null
  stageBackgroundSongId.value = ''
  stageBackgroundReady.value = false
}

async function syncStageBackground() {
  if (!cameraContainer || !selectedSong.value || !stageBackgroundIndex.value) return
  const songCode = selectedSong.value.songCode
  if (stageBackgroundSongId.value === songCode && stageBackgroundSprite) {
    layoutStageBackground()
    return
  }
  releaseStageBackground()
  stageBackgroundSongId.value = songCode
  const entry = stageBackgroundIndex.value.songs?.[songCode]
  if (!entry) return
  const sequence = stageBackgroundSequence
  const texture = await loadImageLayerTexture(entry.file)
  if (sequence !== stageBackgroundSequence || selectedSong.value?.songCode !== songCode) {
    texture.destroy(true)
    return
  }
  stageBackgroundTexture = texture
  stageBackgroundSprite = markRaw(new PIXI.Sprite(texture))
  stageBackgroundSprite.anchor.set(0.5)
  stageBackgroundSprite.zIndex = -20000
  stageBackgroundSprite.visible = staticStageEnabled.value
  cameraContainer.addChild(stageBackgroundSprite)
  stageBackgroundReady.value = true
  layoutStageBackground()
}

function ensureWholeScreenColorOverlay() {
  if (wholeScreenColorOverlay || !cameraContainer) return
  wholeScreenColorOverlay = markRaw(new PIXI.Graphics())
  wholeScreenColorOverlay.beginFill(0xffffff)
  wholeScreenColorOverlay.drawRect(-950, -530, 1900, 1060)
  wholeScreenColorOverlay.endFill()
  wholeScreenColorOverlay.visible = false
  cameraContainer.addChild(wholeScreenColorOverlay)
  layoutStageBackground()
}

function applyStageLighting() {
  ensureWholeScreenColorOverlay()
  if (!lightingEnabled.value) {
    if (wholeScreenColorOverlay) wholeScreenColorOverlay.visible = false
    for (const runtime of runtimes.values()) runtime.spine.tint = 0xffffff
    return
  }
  const screen = currentWholeScreenColor.value
  if (wholeScreenColorOverlay) {
    wholeScreenColorOverlay.tint = screen.color
    wholeScreenColorOverlay.alpha = screen.alpha
    wholeScreenColorOverlay.zIndex = screen.depth
    wholeScreenColorOverlay.visible = screen.alpha > 0.001
  }
  const character = currentCharacterLight.value
  const spotlightStates = [...spotlightStatesAt(stageTime.value).values()]
    .filter(state => state.alpha > 0.001 && state.beamColor)
  const spotlightPositions = new Set(
    spotlightStates
      .filter(state => state.stagePosition)
      .map(state => Number(state.stagePosition)),
  )
  const spotlightEnvironment = spotlightStates.findLast?.(state => state.environmentColor)
    || [...spotlightStates].reverse().find(state => state.environmentColor)
  const spotlightDim = spotlightEnvironment
    ? Math.max(0, Math.min(1, Number(spotlightEnvironment.environmentOpacity || 0) / 1000))
    : 0
  const spotlightDimColor = parseHexColor(spotlightEnvironment?.environmentColor, 0x221d23)
  const pinspotlightStates = [...pinspotlightStatesAt(stageTime.value).values()]
    .filter(state => state.alpha > 0.001 && state.asset)
  const pinspotlightPositions = new Set(pinspotlightStates
    .filter(state => state.stagePosition)
    .map(state => Number(state.stagePosition)))
  const pinspotlightEnvironment = pinspotlightStates.findLast?.(state => state.environmentColor)
    || [...pinspotlightStates].reverse().find(state => state.environmentColor)
  const pinspotlightDim = pinspotlightEnvironment
    ? Math.max(0, Math.min(1, Number(pinspotlightEnvironment.environmentOpacity || 0) / 1000))
    : 0
  const pinspotlightDimColor = parseHexColor(
    pinspotlightEnvironment?.environmentColor,
    0x221d23,
  )
  for (const [position, runtime] of runtimes) {
    // A targeted performer is lit independently from the environment wash.
    // Mixing back toward white reproduces that separation without making the
    // Spine itself translucent beneath the foreground beam sprite.
    if (pinspotlightStates.length > 0) {
      runtime.spine.tint = pinspotlightPositions.has(position)
        ? mixRgb(character.color, 0xffffff, 0.5)
        : mixRgb(character.color, pinspotlightDimColor, pinspotlightDim)
    } else {
      runtime.spine.tint = spotlightPositions.has(position)
        ? mixRgb(character.color, 0xffffff, 0.5)
        : spotlightStates.length > 0
          ? mixRgb(character.color, spotlightDimColor, spotlightDim)
          : character.color
    }
  }
}

function spotlightStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.spotlightEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    const previous = states.get(event.id)
    if (event.hide) {
      if (!previous) continue
      states.set(event.id, {
        ...previous,
        fadeStart: eventTime,
        fadeDuration: Math.max(0, Number(event.duration) || 0),
      })
      continue
    }
    states.set(event.id, {
      ...event,
      alpha: 1,
      fadeStart: null,
      fadeDuration: 0,
    })
  }
  for (const state of states.values()) {
    if (state.fadeStart === null) continue
    state.alpha = state.fadeDuration <= 0
      ? 0
      : Math.max(0, 1 - (milliseconds - state.fadeStart) / state.fadeDuration)
  }
  return states
}

function ensureSpotlightConeTexture() {
  if (spotlightConeTexture) return spotlightConeTexture
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 1024
  const context = canvas.getContext('2d')
  const image = context.createImageData(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y += 1) {
    const vertical = y / (canvas.height - 1)
    const halfWidth = 0.035 + vertical * 0.465
    const verticalAlpha = Math.min(1, vertical * 5) * (0.42 + vertical * 0.58)
    for (let x = 0; x < canvas.width; x += 1) {
      const distance = Math.abs(x / (canvas.width - 1) - 0.5)
      const edge = Math.max(0, Math.min(1, (halfWidth - distance) / 0.09))
      const alpha = Math.round(255 * verticalAlpha * edge * edge * (3 - 2 * edge))
      const offset = (y * canvas.width + x) * 4
      image.data[offset] = 255
      image.data[offset + 1] = 255
      image.data[offset + 2] = 255
      image.data[offset + 3] = alpha
    }
  }
  context.putImageData(image, 0, 0)
  spotlightConeTexture = markRaw(PIXI.Texture.from(canvas))
  return spotlightConeTexture
}

function createSpotlightRuntime(id) {
  const container = markRaw(new PIXI.Container())
  const cone = markRaw(new PIXI.Sprite(ensureSpotlightConeTexture()))
  cone.anchor.set(0.5, 1)
  cone.blendMode = PIXI.BLEND_MODES.ADD
  const pool = markRaw(new PIXI.Graphics())
  pool.beginFill(0xffffff)
  pool.drawEllipse(0, 0, 135, 28)
  pool.endFill()
  pool.blendMode = PIXI.BLEND_MODES.ADD
  container.addChild(cone, pool)
  cameraContainer.addChild(container)
  const runtime = markRaw({ id, container, cone, pool })
  spotlightRuntimes.set(id, runtime)
  return runtime
}

function syncSpotlights() {
  if (!app || !cameraContainer) return
  const states = spotlightStatesAt(stageTime.value)
  const active = beamEffectsEnabled.value
    ? [...states.values()].filter(state => state.alpha > 0.001 && state.beamColor)
    : []
  visibleSpotlightCount.value = active.length
  visibleSpotlightIds.value = active.map(state => state.id).sort((a, b) => a - b)
  for (const [id, runtime] of spotlightRuntimes) {
    runtime.container.visible = Boolean(states.get(id)?.alpha > 0.001)
  }
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const state of active) {
    const runtime = spotlightRuntimes.get(state.id) || createSpotlightRuntime(state.id)
    const target = state.stagePosition
      ? layoutCoordinatesForStage(Number(state.stagePosition), stageTime.value)
      : { x: Number(state.x) || 0, y: 180 }
    const targetX = width * 0.5 + target.x * viewportScale
    const targetY = height * 0.66 + (180 - target.y) * viewportScale
    const topY = height * 0.5 - 500 * viewportScale
    runtime.container.position.set(targetX, targetY)
    runtime.container.zIndex = Number(state.depth) || 1800
    runtime.container.alpha = Math.max(0, Math.min(1, state.alpha))
    runtime.container.visible = true
    runtime.cone.tint = parseHexColor(state.beamColor, 0xffffff)
    runtime.cone.width = 310 * viewportScale
    runtime.cone.height = Math.max(1, targetY - topY)
    runtime.cone.alpha = 0.16
    runtime.pool.tint = runtime.cone.tint
    runtime.pool.scale.set(viewportScale)
    runtime.pool.alpha = 0.16
  }
}

function releaseSpotlights() {
  for (const runtime of spotlightRuntimes.values()) {
    runtime.container.removeFromParent()
    runtime.container.destroy({ children: true })
  }
  spotlightRuntimes.clear()
  spotlightConeTexture?.destroy(true)
  spotlightConeTexture = null
  visibleSpotlightCount.value = 0
  visibleSpotlightIds.value = []
}

function laserlightStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.laserlightEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    const previous = states.get(event.id)
    if (event.hide) {
      if (!previous) continue
      states.set(event.id, {
        ...previous,
        fadeStart: eventTime,
        fadeDuration: Math.max(0, Number(event.duration) || 0),
      })
      continue
    }
    const next = { ...(previous || {}) }
    for (const [key, value] of Object.entries(event)) {
      if (value !== null && value !== undefined && value !== '') next[key] = value
    }
    states.set(event.id, {
      ...next,
      alpha: 1,
      eventTime,
      fadeStart: null,
      fadeDuration: 0,
    })
  }
  for (const state of states.values()) {
    if (state.fadeStart === null) continue
    state.alpha = state.fadeDuration <= 0
      ? 0
      : Math.max(0, 1 - (milliseconds - state.fadeStart) / state.fadeDuration)
  }
  return states
}

function laserSweepAngle(state, milliseconds) {
  const base = Number(state.angle) || 0
  const period = Math.max(1, Number(state.sweepDuration) || 1000)
  const phase = Math.max(0, milliseconds - Number(state.eventTime || state.time || 0)) / period
  const direction = state.direction === 'left' ? -1 : 1
  const style = Number(state.style) || 7
  if (style === 6) return base + direction * phase * 360
  const amplitudes = { 1: 8, 3: 10, 4: 10, 5: 14, 7: 20, 8: 42, 9: 42 }
  const cycle = (phase + (style === 9 ? 1 : 0)) % 2
  const triangle = cycle <= 1 ? cycle : 2 - cycle
  let angle = base + direction * (amplitudes[style] || 20) * triangle
  // The source comments call style 3 "カクカクのやつ": the fixture turns
  // in discrete steps rather than interpolating continuously.
  if (style === 3) angle = Math.round(angle / 5) * 5
  return angle
}

function createLaserlightRuntime(id) {
  const graphics = markRaw(new PIXI.Graphics())
  graphics.blendMode = PIXI.BLEND_MODES.ADD
  cameraContainer.addChild(graphics)
  const runtime = markRaw({ id, graphics })
  laserlightRuntimes.set(id, runtime)
  return runtime
}

function laserBeamOffsets(style) {
  // data.unity3d / LiveObjectLaserlight stores nine prefab references.
  // The dominant style 3 prefab contains four particle systems at
  // 0 / +20 / -20 / 0 degrees. Style 7 contains paired forward/reverse
  // systems. Preserve those authored beam groups instead of reducing every
  // CSV event to one line.
  if (style === 1) return [0, 5, -5]
  if (style === 3 || style === 4) return [0, 20, -20, 0]
  if (style === 5 || style === 6) return [0.5, 1.5, 179.5, 178.5]
  if (style === 7) return [0, 180, 0, 180]
  return [0]
}

function drawLaserlight(runtime, state, viewportScale) {
  const graphics = runtime.graphics
  const length = Math.max(1, Number(state.length) || 900)
    * viewportScale * environmentScale.value
  const width = Math.max(0.2, (Number(state.width) || 1000) / 1000)
  const color = parseHexColor(state.color, 0xffffff)
  const style = Number(state.style) || 7
  const intensity = style === 9 ? 0.55 : 1
  const offsets = laserBeamOffsets(style)
  const duplicateAttenuation = offsets.length >= 4 ? 0.72 : 1
  graphics.clear()
  const drawPass = (lineWidth, lineColor, alpha) => {
    graphics.lineStyle(lineWidth, lineColor, alpha * intensity * duplicateAttenuation)
    for (const offset of offsets) {
      const radians = offset * Math.PI / 180
      graphics.moveTo(0, 0)
      graphics.lineTo(Math.cos(radians) * length, Math.sin(radians) * length)
    }
  }
  drawPass(18 * width * viewportScale, color, 0.08)
  drawPass(7 * width * viewportScale, color, 0.24)
  drawPass(1.25 * width * viewportScale, 0xffffff, 0.82)
}

function syncLaserlights() {
  if (!app || !cameraContainer) return
  const states = laserlightStatesAt(stageTime.value)
  const active = beamEffectsEnabled.value
    ? [...states.values()].filter(state => (
      state.alpha > 0.001 && state.style && state.color
    ))
    : []
  visibleLaserlightCount.value = active.length
  visibleLaserlightIds.value = active.map(state => state.id).sort((a, b) => a - b)
  for (const [id, runtime] of laserlightRuntimes) {
    runtime.graphics.visible = Boolean(states.get(id)?.alpha > 0.001)
  }
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const state of active) {
    const runtime = laserlightRuntimes.get(state.id) || createLaserlightRuntime(state.id)
    drawLaserlight(runtime, state, viewportScale)
    runtime.graphics.position.set(
      width * 0.5 - Number(state.x) * viewportScale * environmentScale.value,
      height * 0.5 + (360 - Number(state.y)) * viewportScale * environmentScale.value,
    )
    // Laserlight's effect-space X axis is opposite the character/ObjectLayer
    // stage axis. Unity's Y-up angle then maps to the screen by negating it:
    // 280/260 degree top fixtures point down and inward, while 110/70 degree
    // floor fixtures point up and outward.
    runtime.graphics.rotation = -laserSweepAngle(state, stageTime.value) * Math.PI / 180
    runtime.graphics.zIndex = Number(state.depth) || 1650
    runtime.graphics.alpha = Math.max(0, Math.min(1, Number(state.alpha) || 0))
    runtime.graphics.visible = true
  }
}

function releaseLaserlights() {
  for (const runtime of laserlightRuntimes.values()) {
    runtime.graphics.removeFromParent()
    runtime.graphics.destroy()
  }
  laserlightRuntimes.clear()
  visibleLaserlightCount.value = 0
  visibleLaserlightIds.value = []
}

function samplePinspotlightState(state, milliseconds) {
  if (!state) return null
  const duration = Math.max(0, Number(state.tweenDuration) || 0)
  const progress = duration <= 0
    ? 1
    : Math.max(0, Math.min(1, (milliseconds - state.tweenStart) / duration))
  const result = {
    ...state,
    x: state.fromX + (state.toX - state.fromX) * progress,
    y: state.fromY + (state.toY - state.fromY) * progress,
  }
  if (state.fadeStart !== null) {
    result.alpha = state.fadeDuration <= 0
      ? 0
      : Math.max(0, 1 - (milliseconds - state.fadeStart) / state.fadeDuration)
  }
  return result
}

function pinspotlightStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.pinspotlightEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    const previous = samplePinspotlightState(states.get(event.id), eventTime)
    if (event.hide) {
      if (!previous) continue
      states.set(event.id, {
        ...previous,
        fadeStart: eventTime,
        fadeDuration: Math.max(0, Number(event.duration) || 0),
      })
      continue
    }
    const next = { ...(previous || {}) }
    for (const [key, value] of Object.entries(event)) {
      if (value !== null && value !== undefined && value !== '') next[key] = value
    }
    const fromX = Number(previous?.x ?? event.x ?? 0)
    const fromY = Number(previous?.y ?? event.y ?? 0)
    states.set(event.id, {
      ...next,
      alpha: 1,
      tweenStart: eventTime,
      tweenDuration: Math.max(0, Number(event.duration) || 0),
      fromX,
      fromY,
      toX: Number(event.x ?? fromX),
      toY: Number(event.y ?? fromY),
      fadeStart: null,
      fadeDuration: 0,
    })
  }
  for (const [id, state] of states) {
    states.set(id, samplePinspotlightState(state, milliseconds))
  }
  return states
}

function ensurePinspotlightEnvironmentOverlay() {
  if (pinspotlightEnvironmentOverlay || !cameraContainer) return
  pinspotlightEnvironmentOverlay = markRaw(new PIXI.Graphics())
  pinspotlightEnvironmentOverlay.beginFill(0xffffff)
  pinspotlightEnvironmentOverlay.drawRect(-950, -530, 1900, 1060)
  pinspotlightEnvironmentOverlay.endFill()
  pinspotlightEnvironmentOverlay.visible = false
  cameraContainer.addChild(pinspotlightEnvironmentOverlay)
}

function loadPinspotlightTexture(asset) {
  const fallbackAsset = stageEffectIndex.value?.assets?.pinspotlight
  const entry = stageEffectIndex.value?.assets?.[asset] || fallbackAsset
  if (!entry) return Promise.resolve(null)
  const cacheKey = stageEffectIndex.value?.assets?.[asset] ? asset : 'pinspotlight'
  if (pinspotlightTextures.has(cacheKey)) {
    return Promise.resolve({ texture: pinspotlightTextures.get(cacheKey), cacheKey })
  }
  if (!pinspotlightLoads.has(cacheKey)) {
    pinspotlightLoads.set(cacheKey, loadImageLayerTexture(entry.file).then(texture => {
      pinspotlightTextures.set(cacheKey, texture)
      pinspotlightLoads.delete(cacheKey)
      return { texture, cacheKey }
    }))
  }
  return pinspotlightLoads.get(cacheKey)
}

function loadPinspotlightRuntime(state, sequence) {
  const desiredAsset = stageEffectIndex.value?.assets?.[state.asset]
    ? state.asset
    : 'pinspotlight'
  const existing = pinspotlightRuntimes.get(state.id)
  if (existing?.asset === desiredAsset) return Promise.resolve(existing)
  const pending = pinspotlightRuntimeLoads.get(state.id)
  if (pending?.asset === desiredAsset) return pending.promise

  const promise = loadPinspotlightTexture(state.asset).then(loaded => {
    const currentPending = pinspotlightRuntimeLoads.get(state.id)
    // A later event may reuse the same lamp ID with another texture while
    // this request is in flight. Only the latest per-ID request may install
    // a Sprite; otherwise the old mask can reappear after it was hidden.
    if (currentPending?.promise !== promise) return pinspotlightRuntimes.get(state.id) || null
    pinspotlightRuntimeLoads.delete(state.id)
    if (!loaded || sequence !== pinspotlightLoadSequence || !cameraContainer) return null
    const current = pinspotlightRuntimes.get(state.id)
    if (current?.asset === loaded.cacheKey) return current
    current?.sprite.removeFromParent()
    current?.sprite.destroy()
    const sprite = markRaw(new PIXI.Sprite(loaded.texture))
    sprite.anchor.set(0.5)
    sprite.blendMode = PIXI.BLEND_MODES.ADD
    cameraContainer.addChild(sprite)
    const runtime = markRaw({ id: state.id, asset: loaded.cacheKey, sprite })
    pinspotlightRuntimes.set(state.id, runtime)
    return runtime
  })
  pinspotlightRuntimeLoads.set(state.id, { asset: desiredAsset, promise })
  return promise
}

async function syncPinspotlights() {
  if (!app || !cameraContainer) return
  ensurePinspotlightEnvironmentOverlay()
  const states = pinspotlightStatesAt(stageTime.value)
  const activeStates = [...states.values()].filter(state => state.alpha > 0.001 && state.asset)
  const visibleStates = beamEffectsEnabled.value ? activeStates : []
  visiblePinspotlightCount.value = visibleStates.length
  visiblePinspotlightIds.value = visibleStates.map(state => state.id).sort((a, b) => a - b)

  const environmentState = lightingEnabled.value
    ? activeStates.findLast?.(state => state.environmentColor)
      || [...activeStates].reverse().find(state => state.environmentColor)
    : null
  if (pinspotlightEnvironmentOverlay) {
    pinspotlightEnvironmentOverlay.visible = Boolean(environmentState)
    if (environmentState) {
      pinspotlightEnvironmentOverlay.tint = parseHexColor(environmentState.environmentColor, 0x221d23)
      pinspotlightEnvironmentOverlay.alpha = Math.max(
        0,
        Math.min(1, Number(environmentState.environmentOpacity || 0) / 1000),
      )
      pinspotlightEnvironmentOverlay.zIndex = Number(environmentState.depth) || 1850
    }
  }

  for (const [id, runtime] of pinspotlightRuntimes) {
    const state = states.get(id)
    runtime.sprite.visible = beamEffectsEnabled.value && Boolean(state?.alpha > 0.001)
  }

  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  const sequence = pinspotlightLoadSequence
  await Promise.all(visibleStates.map(async state => {
    let runtime = pinspotlightRuntimes.get(state.id)
    const desiredAsset = stageEffectIndex.value?.assets?.[state.asset]
      ? state.asset
      : 'pinspotlight'
    if (runtime && runtime.asset !== desiredAsset) {
      runtime.sprite.removeFromParent()
      runtime.sprite.destroy()
      pinspotlightRuntimes.delete(state.id)
      runtime = null
    }
    if (!runtime) runtime = await loadPinspotlightRuntime(state, sequence)
    if (!runtime) return
    const current = pinspotlightStatesAt(stageTime.value).get(state.id)
    if (!current || current.alpha <= 0.001) {
      runtime.sprite.visible = false
      return
    }
    if (current.stagePosition) {
      const target = layoutCoordinatesForStage(Number(current.stagePosition), stageTime.value)
      runtime.sprite.position.set(
        width * 0.5 + target.x * viewportScale,
        height * 0.66 + (180 - target.y) * viewportScale - 135 * viewportScale,
      )
      runtime.sprite.scale.set(viewportScale * 0.62)
    } else {
      runtime.sprite.position.set(
        width * 0.5 + Number(current.x || 0) * viewportScale * environmentScale.value,
        height * 0.5 + (360 - Number(current.y || 0)) * viewportScale * environmentScale.value,
      )
      runtime.sprite.scale.set(viewportScale * environmentScale.value * 0.7)
    }
    runtime.sprite.tint = parseHexColor(current.beamColor, 0xffffff)
    runtime.sprite.alpha = Math.max(0, Math.min(1, Number(current.alpha) || 0)) * 0.34
    runtime.sprite.zIndex = (Number(current.depth) || 1850) + 1
    runtime.sprite.visible = beamEffectsEnabled.value
  }))
}

function releasePinspotlights() {
  pinspotlightLoadSequence += 1
  for (const runtime of pinspotlightRuntimes.values()) {
    runtime.sprite.removeFromParent()
    runtime.sprite.destroy()
  }
  pinspotlightRuntimes.clear()
  pinspotlightRuntimeLoads.clear()
  pinspotlightLoads.clear()
  for (const texture of pinspotlightTextures.values()) texture.destroy(true)
  pinspotlightTextures.clear()
  pinspotlightEnvironmentOverlay?.removeFromParent()
  pinspotlightEnvironmentOverlay?.destroy()
  pinspotlightEnvironmentOverlay = null
  visiblePinspotlightCount.value = 0
  visiblePinspotlightIds.value = []
}

function imageLayerStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.imageLayerEvents || [])) {
    if (Number(event.time) > milliseconds) break
    const previous = states.get(event.asset) || {
      asset: event.asset,
      depth: 0,
      layerType: event.layerType,
      visible: false,
    }
    states.set(event.asset, {
      ...previous,
      depth: event.depth ?? previous.depth,
      layerType: event.layerType || previous.layerType,
      visible: !event.hide,
      eventTime: Number(event.time),
    })
  }
  return states
}

function loadImageLayerTexture(relativePath) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(new PIXI.Texture(new PIXI.BaseTexture(image)))
    image.onerror = () => reject(new Error(`舞台图片加载失败：${relativePath}`))
    image.src = `${LIVE_CHIBI_BASE}/${relativePath}`
  })
}

function layoutImageLayers() {
  if (!app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const runtime of imageLayerRuntimes.values()) {
    runtime.sprite.position.set(width * 0.5, height * 0.5)
    runtime.sprite.scale.set(viewportScale * environmentScale.value)
  }
}

function releaseImageLayers() {
  imageLayerSequence += 1
  for (const load of imageLayerLoads.values()) {
    load.then(texture => texture.destroy(true)).catch(() => {})
  }
  imageLayerLoads.clear()
  for (const runtime of imageLayerRuntimes.values()) {
    runtime.sprite.removeFromParent()
    runtime.sprite.destroy()
    runtime.texture.destroy(true)
  }
  imageLayerRuntimes.clear()
  imageLayerSongId = ''
  visibleImageLayerCount.value = 0
  visibleImageLayerAssets.value = []
  visibleImageLayerDepths.value = []
}

async function syncImageLayers() {
  if (!cameraContainer || !selectedSong.value || !imageLayerIndex.value) return
  if (imageLayerSongId !== selectedSong.value.id) {
    releaseImageLayers()
    imageLayerSongId = selectedSong.value.id
  }
  const sequence = imageLayerSequence
  const states = imageLayerStatesAt(stageTime.value)
  const visibleStates = imageLayersEnabled.value
    ? [...states.values()].filter(state => state.visible)
    : []
  visibleImageLayerCount.value = visibleStates.length
  visibleImageLayerAssets.value = visibleStates.map(state => state.asset).sort()
  visibleImageLayerDepths.value = visibleStates
    .map(state => `${state.asset}:${state.depth}`)
    .sort()

  for (const [asset, runtime] of imageLayerRuntimes) {
    const state = states.get(asset)
    runtime.sprite.visible = imageLayersEnabled.value && Boolean(state?.visible)
    if (state) runtime.sprite.zIndex = Number(state.depth) || 0
  }

  await Promise.all(visibleStates.map(async state => {
    let runtime = imageLayerRuntimes.get(state.asset)
    if (!runtime) {
      const entry = imageLayerIndex.value.assets?.[state.asset]
      if (!entry) {
        console.warn('[ChibiStage] missing image-layer asset', state.asset)
        return
      }
      let load = imageLayerLoads.get(state.asset)
      if (!load) {
        load = loadImageLayerTexture(entry.file)
        imageLayerLoads.set(state.asset, load)
      }
      const texture = await load
      const ownsLoad = imageLayerLoads.get(state.asset) === load
      if (ownsLoad) imageLayerLoads.delete(state.asset)
      if (sequence !== imageLayerSequence || imageLayerSongId !== selectedSong.value?.id) {
        if (ownsLoad) texture.destroy(true)
        return
      }
      runtime = imageLayerRuntimes.get(state.asset)
      if (!runtime) {
        const sprite = markRaw(new PIXI.Sprite(texture))
        sprite.anchor.set(0.5)
        cameraContainer.addChild(sprite)
        runtime = { texture, sprite }
        imageLayerRuntimes.set(state.asset, runtime)
      }
    }
    const current = imageLayerStatesAt(stageTime.value).get(state.asset)
    runtime.sprite.visible = imageLayersEnabled.value && Boolean(current?.visible)
    runtime.sprite.zIndex = Number(current?.depth) || 0
  }))
  layoutImageLayers()
}

function sampleObjectLayerAlpha(state, milliseconds) {
  const duration = Number(state.tweenDuration) || 0
  if (duration <= 1 || milliseconds >= state.tweenStart + duration) return state.tweenTo
  const progress = Math.max(0, Math.min(1, (milliseconds - state.tweenStart) / duration))
  return state.tweenFrom + (state.tweenTo - state.tweenFrom) * progress
}

function objectLayerStatesAt(milliseconds) {
  const states = new Map()
  for (const event of (selectedSong.value?.objectLayerEvents || [])) {
    const eventTime = Number(event.time)
    if (eventTime > milliseconds) break
    const previous = states.get(event.asset) || {
      asset: event.asset,
      x: 0,
      y: 360,
      scale: 1000,
      depth: 0,
      tweenStart: eventTime,
      tweenDuration: 1,
      tweenFrom: 0,
      tweenTo: 0,
    }
    const alphaAtEvent = sampleObjectLayerAlpha(previous, eventTime)
    states.set(event.asset, {
      ...previous,
      x: event.x ?? previous.x,
      y: event.y ?? previous.y,
      scale: event.scale ?? previous.scale,
      depth: event.depth ?? previous.depth,
      tweenStart: eventTime,
      tweenDuration: Math.max(1, Number(event.duration) || 1),
      tweenFrom: alphaAtEvent,
      tweenTo: event.hide ? 0 : 1,
      eventTime,
    })
  }
  for (const state of states.values()) state.alpha = sampleObjectLayerAlpha(state, milliseconds)
  return states
}

async function loadObjectLayerRuntime(entry) {
  const textures = await Promise.all(entry.textures.map(async metadata => ({
    metadata,
    texture: await loadImageLayerTexture(metadata.file),
  })))
  const textureById = new Map(textures.map(item => [item.metadata.id, item]))
  const container = markRaw(new PIXI.Container())
  container.sortableChildren = true
  for (const instance of entry.instances) {
    const item = textureById.get(instance.texture)
    if (!item) continue
    const sprite = markRaw(new PIXI.Sprite(item.texture))
    sprite.name = instance.name
    sprite.anchor.set(item.metadata.pivot?.x ?? 0.5, item.metadata.pivot?.y ?? 0.5)
    sprite.position.set(Number(instance.x) || 0, Number(instance.y) || 0)
    const pixelsToStage = 100 / (Number(item.metadata.pixelsPerUnit) || 100)
    sprite.scale.set(
      (Number(instance.scaleX) || 1) * pixelsToStage,
      (Number(instance.scaleY) || 1) * pixelsToStage,
    )
    sprite.rotation = (Number(instance.rotation) || 0) * Math.PI / 180
    sprite.tint = Number(instance.tint) || 0xffffff
    sprite.alpha = Number.isFinite(Number(instance.alpha)) ? Number(instance.alpha) : 1
    sprite.blendMode = instance.blendMode === 'add' ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL
    sprite.zIndex = Number(instance.sortingOrder) || 0
    container.addChild(sprite)
  }
  return { container, textures: textures.map(item => item.texture), entry }
}

function destroyObjectLayerRuntime(runtime) {
  runtime?.container?.removeFromParent()
  runtime?.container?.destroy({ children: true })
  for (const texture of (runtime?.textures || [])) texture.destroy(true)
}

function layoutObjectLayers(states = objectLayerStatesAt(stageTime.value)) {
  if (!app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  for (const [asset, runtime] of objectLayerRuntimes) {
    const state = states.get(asset)
    if (!state) continue
    runtime.container.position.set(
      width * 0.5 + Number(state.x) * viewportScale * environmentScale.value,
      height * 0.5 + (360 - Number(state.y)) * viewportScale * environmentScale.value,
    )
    runtime.container.scale.set(
      viewportScale * environmentScale.value * Number(state.scale) / 1000,
    )
    runtime.container.zIndex = Number(state.depth) || 0
    runtime.container.alpha = Math.max(0, Math.min(1, Number(state.alpha) || 0))
    runtime.container.visible = objectLayersEnabled.value && runtime.container.alpha > 0.001
  }
}

function releaseObjectLayers() {
  objectLayerSequence += 1
  for (const load of objectLayerLoads.values()) {
    load.then(destroyObjectLayerRuntime).catch(() => {})
  }
  objectLayerLoads.clear()
  for (const runtime of objectLayerRuntimes.values()) destroyObjectLayerRuntime(runtime)
  objectLayerRuntimes.clear()
  objectLayerSongId = ''
  visibleObjectLayerCount.value = 0
  visibleObjectLayerAssets.value = []
  unsupportedObjectLayerAssets.value = []
}

async function syncObjectLayers() {
  if (!cameraContainer || !selectedSong.value || !objectLayerIndex.value) return
  if (objectLayerSongId !== selectedSong.value.id) {
    releaseObjectLayers()
    objectLayerSongId = selectedSong.value.id
  }
  const sequence = objectLayerSequence
  const states = objectLayerStatesAt(stageTime.value)
  const activeStates = objectLayersEnabled.value
    ? [...states.values()].filter(state => state.alpha > 0.001)
    : []
  const supportedStates = []
  const unsupportedStates = []
  for (const state of activeStates) {
    const entry = objectLayerIndex.value.assets?.[state.asset]
    if (entry?.kind === 'sprite' || entry?.kind === 'mixed') supportedStates.push(state)
    else unsupportedStates.push(state)
  }
  visibleObjectLayerCount.value = supportedStates.length
  visibleObjectLayerAssets.value = supportedStates.map(state => state.asset).sort()
  unsupportedObjectLayerAssets.value = unsupportedStates.map(state => state.asset).sort()

  for (const [asset, runtime] of objectLayerRuntimes) {
    const state = states.get(asset)
    runtime.container.visible = objectLayersEnabled.value && Boolean(state && state.alpha > 0.001)
  }

  await Promise.all(supportedStates.map(async state => {
    let runtime = objectLayerRuntimes.get(state.asset)
    if (!runtime) {
      const entry = objectLayerIndex.value.assets[state.asset]
      let load = objectLayerLoads.get(state.asset)
      if (!load) {
        load = loadObjectLayerRuntime(entry)
        objectLayerLoads.set(state.asset, load)
      }
      runtime = await load
      const ownsLoad = objectLayerLoads.get(state.asset) === load
      if (ownsLoad) objectLayerLoads.delete(state.asset)
      if (sequence !== objectLayerSequence || objectLayerSongId !== selectedSong.value?.id) {
        if (ownsLoad) destroyObjectLayerRuntime(runtime)
        return
      }
      if (!objectLayerRuntimes.has(state.asset)) {
        objectLayerRuntimes.set(state.asset, runtime)
        cameraContainer.addChild(runtime.container)
      } else if (ownsLoad) {
        destroyObjectLayerRuntime(runtime)
      }
    }
  }))
  layoutObjectLayers(objectLayerStatesAt(stageTime.value))
}

function ensureBackmonitor() {
  if (backmonitorVideo || !backmonitorContainer) return
  const video = document.createElement('video')
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.addEventListener('loadedmetadata', () => {
    if (backmonitorVideo !== video) return
    backmonitorReady.value = true
    syncBackmonitor(true)
  })
  video.addEventListener('error', () => {
    if (backmonitorVideo !== video || !backmonitorMovie || !video.getAttribute('src')) return
    backmonitorReady.value = false
    console.warn('[ChibiStage] backmonitor video failed', backmonitorMovie)
  })
  backmonitorVideo = video
  const resource = markRaw(new PIXI.VideoResource(video, { autoPlay: false }))
  backmonitorTexture = markRaw(new PIXI.Texture(new PIXI.BaseTexture(resource)))
  backmonitorSprite = markRaw(new PIXI.Sprite(backmonitorTexture))
  backmonitorSprite.anchor.set(0.5)
  backmonitorSprite.zIndex = -10000
  backmonitorContainer.addChild(backmonitorSprite)
}

function ensureBackmonitorTransition() {
  if (backmonitorTransitionVideo || !backmonitorContainer) return
  const colorVideo = document.createElement('video')
  const alphaVideo = document.createElement('video')
  for (const video of [colorVideo, alphaVideo]) {
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
  }
  colorVideo.addEventListener('loadedmetadata', () => {
    if (backmonitorTransitionVideo !== colorVideo) return
    backmonitorTransitionColorReady = true
    syncBackmonitor(true)
  })
  alphaVideo.addEventListener('loadedmetadata', () => {
    if (backmonitorTransitionAlphaVideo !== alphaVideo) return
    backmonitorTransitionAlphaReady = true
    syncBackmonitor(true)
  })
  const handleError = () => {
    if (
      !backmonitorTransition
      || !colorVideo.getAttribute('src')
      || !alphaVideo.getAttribute('src')
    ) return
    backmonitorTransitionActive.value = false
    if (backmonitorTransitionSprite) backmonitorTransitionSprite.visible = false
    console.warn('[ChibiStage] backmonitor transition failed', backmonitorTransition)
  }
  colorVideo.addEventListener('error', handleError)
  alphaVideo.addEventListener('error', handleError)
  backmonitorTransitionVideo = colorVideo
  backmonitorTransitionAlphaVideo = alphaVideo
  const colorResource = markRaw(new PIXI.VideoResource(colorVideo, { autoPlay: false }))
  const alphaResource = markRaw(new PIXI.VideoResource(alphaVideo, { autoPlay: false }))
  backmonitorTransitionTexture = markRaw(new PIXI.Texture(new PIXI.BaseTexture(colorResource)))
  backmonitorTransitionAlphaTexture = markRaw(new PIXI.Texture(new PIXI.BaseTexture(alphaResource)))
  backmonitorTransitionFilter = markRaw(new PIXI.Filter(undefined, `
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform sampler2D uAlphaTexture;
    void main(void) {
      vec4 color = texture2D(uSampler, vTextureCoord);
      float mask = texture2D(uAlphaTexture, vTextureCoord).r;
      gl_FragColor = color * mask;
    }
  `, {
    uAlphaTexture: backmonitorTransitionAlphaTexture,
  }))
  backmonitorTransitionSprite = markRaw(new PIXI.Sprite(backmonitorTransitionTexture))
  backmonitorTransitionSprite.anchor.set(0.5)
  backmonitorTransitionSprite.zIndex = -9999
  backmonitorTransitionSprite.filters = [backmonitorTransitionFilter]
  backmonitorTransitionSprite.visible = false
  backmonitorContainer.addChild(backmonitorTransitionSprite)
}

function layoutBackmonitor(state) {
  if (!backmonitorSprite || !app) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  backmonitorSprite.position.set(
    width * 0.5 + state.x * viewportScale * environmentScale.value,
    height * 0.5 + (BACKMONITOR_Y_ORIGIN - state.y) * viewportScale * environmentScale.value,
  )
  backmonitorSprite.scale.set(
    viewportScale * environmentScale.value * state.scale / 1000 * 2,
  )
  backmonitorSprite.rotation = -state.rotation * Math.PI / 180
  backmonitorSprite.alpha = Math.max(0, Math.min(1, state.opacity / 1000))
  backmonitorSprite.visible = backmonitorEnabled.value && Boolean(state.movie) && state.y < 4000
  if (backmonitorTransitionSprite) {
    backmonitorTransitionSprite.position.copyFrom(backmonitorSprite.position)
    backmonitorTransitionSprite.scale.copyFrom(backmonitorSprite.scale)
    backmonitorTransitionSprite.rotation = backmonitorSprite.rotation
    backmonitorTransitionSprite.alpha = backmonitorSprite.alpha
  }
}

function pauseBackmonitorTransition() {
  backmonitorTransitionVideo?.pause()
  backmonitorTransitionAlphaVideo?.pause()
  backmonitorTransitionActive.value = false
  if (backmonitorTransitionSprite) backmonitorTransitionSprite.visible = false
}

function syncBackmonitorTransition(state, forceSeek = false) {
  const asset = state.transition
    ? backmonitorIndex.value?.transitions?.[state.transition]
    : null
  if (!asset) {
    pauseBackmonitorTransition()
    return
  }
  ensureBackmonitorTransition()
  if (backmonitorTransition !== state.transition) {
    backmonitorTransition = state.transition
    backmonitorTransitionColorReady = false
    backmonitorTransitionAlphaReady = false
    backmonitorTransitionVideo.src = `${LIVE_CHIBI_BASE}/${asset.colorFile}`
    backmonitorTransitionAlphaVideo.src = `${LIVE_CHIBI_BASE}/${asset.alphaFile}`
    backmonitorTransitionVideo.load()
    backmonitorTransitionAlphaVideo.load()
    return
  }
  if (!backmonitorTransitionColorReady || !backmonitorTransitionAlphaReady) return
  const duration = Math.min(
    Number(asset.color?.duration) || 0,
    Number(asset.alpha?.duration) || 0,
  ) / 1000
  const elapsed = Math.max(0, stageTime.value - state.transitionTime) / 1000
  if (duration <= 0 || elapsed >= duration) {
    pauseBackmonitorTransition()
    return
  }
  backmonitorTransitionActive.value = true
  backmonitorTransitionSprite.visible = backmonitorEnabled.value
  for (const video of [backmonitorTransitionVideo, backmonitorTransitionAlphaVideo]) {
    if (forceSeek || Math.abs(video.currentTime - elapsed) > 0.06) video.currentTime = elapsed
    video.playbackRate = playbackSpeed.value
    if (playing.value && video.paused) video.play().catch(() => {})
  }
}

function syncBackmonitor(forceSeek = false) {
  const state = currentBackmonitorState.value
  if (!state.movie || !backmonitorIndex.value?.assets?.[state.movie]) {
    if (backmonitorSprite) backmonitorSprite.visible = false
    pauseBackmonitorTransition()
    return
  }
  ensureBackmonitor()
  layoutBackmonitor(state)
  syncBackmonitorTransition(state, forceSeek)
  const asset = backmonitorIndex.value.assets[state.movie]
  if (backmonitorMovie !== state.movie) {
    backmonitorMovie = state.movie
    backmonitorReady.value = false
    backmonitorVideo.src = `${LIVE_CHIBI_BASE}/${asset.file}`
    backmonitorVideo.load()
    return
  }
  if (!backmonitorReady.value || !Number.isFinite(backmonitorVideo.duration)) return
  const elapsed = Math.max(0, stageTime.value - state.movieTime) / 1000
  const desiredTime = elapsed % backmonitorVideo.duration
  if (forceSeek || Math.abs(backmonitorVideo.currentTime - desiredTime) > 0.18) {
    backmonitorVideo.currentTime = desiredTime
  }
  backmonitorVideo.playbackRate = playbackSpeed.value
  if (playing.value && backmonitorVideo.paused) backmonitorVideo.play().catch(() => {})
}

function releaseBackmonitor() {
  backmonitorVideo?.pause()
  pauseBackmonitorTransition()
  backmonitorMovie = ''
  backmonitorTransition = ''
  if (backmonitorVideo) {
    backmonitorVideo.removeAttribute('src')
    backmonitorVideo.load()
  }
  backmonitorSprite?.removeFromParent()
  backmonitorSprite?.destroy()
  backmonitorTexture?.destroy(true)
  for (const video of [backmonitorTransitionVideo, backmonitorTransitionAlphaVideo]) {
    if (!video) continue
    video.removeAttribute('src')
    video.load()
  }
  backmonitorTransitionSprite?.removeFromParent()
  backmonitorTransitionSprite?.destroy()
  backmonitorTransitionTexture?.destroy(true)
  backmonitorTransitionAlphaTexture?.destroy(true)
  backmonitorTransitionFilter?.destroy()
  backmonitorVideo = null
  backmonitorTexture = null
  backmonitorSprite = null
  backmonitorTransitionSprite = null
  backmonitorTransitionVideo = null
  backmonitorTransitionAlphaVideo = null
  backmonitorTransitionTexture = null
  backmonitorTransitionAlphaTexture = null
  backmonitorTransitionFilter = null
  backmonitorTransitionColorReady = false
  backmonitorTransitionAlphaReady = false
  backmonitorReady.value = false
  backmonitorTransitionActive.value = false
}

function applyCameraTransform() {
  if (!cameraContainer || !app) return
  if (!cameraEnabled.value) {
    cameraContainer.position.set(0, 0)
    cameraContainer.pivot.set(0, 0)
    cameraContainer.scale.set(1)
    cameraContainer.rotation = 0
    return
  }
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const viewportScale = Math.min(width / 1280, height / 720)
  const camera = currentCameraState.value
  cameraContainer.position.set(width * 0.5, height * 0.5)
  cameraContainer.pivot.set(
    width * 0.5 + camera.x * viewportScale,
    height * 0.5 + (camera.y - 360) * viewportScale,
  )
  cameraContainer.scale.set(camera.zoom * STAGE_BASE_ZOOM)
  cameraContainer.rotation = -camera.rotation * Math.PI / 180
}

function applyLayerDebugVisibility() {
  if (stageBackgroundSprite) stageBackgroundSprite.visible = staticStageEnabled.value
  if (backmonitorContainer) backmonitorContainer.visible = backmonitorEnabled.value
  for (const [position, runtime] of runtimes) {
    runtime.spine.visible = charactersEnabled.value
      && activePositions.value.includes(position)
      && layoutCoordinatesForStage(position, stageTime.value).y < 4000
    if (runtime.groundShadow) {
      runtime.groundShadow.visible = charactersEnabled.value
        && characterShadowsEnabled.value
        && runtime.spine.visible
    }
  }
  syncSpotlights()
  syncLaserlights()
  syncPinspotlights().catch(error => console.warn('[ChibiStage] pinspotlight debug sync failed', error))
  applyStageLighting()
  syncBackmonitor(true)
  syncImageLayers().catch(error => console.warn('[ChibiStage] image-layer debug sync failed', error))
  syncObjectLayers().catch(error => console.warn('[ChibiStage] object-layer debug sync failed', error))
}

function layoutRuntime(position, motionEvent = null) {
  const runtime = runtimes.get(position)
  if (!runtime || !app || !canvasRef.value) return
  const width = app.renderer.width / app.renderer.resolution
  const height = app.renderer.height / app.renderer.resolution
  const coordinates = layoutCoordinatesForStage(position, stageTime.value, motionEvent)
  const { x, y, scale: sourceScale, positionState } = coordinates
  const viewportScale = Math.min(width / 1280, height / 720)
  const character = characters.value.find(item => item.id === runtime.characterId)
  const characterScale = Number(character?.previewScale) || 0.28
  const viewportFit = Math.min(1, height / 620)
  runtime.spine.x = width * 0.5 + x * viewportScale
  // Live CSV Y is a depth coordinate: smaller values stand closer to the
  // camera (and therefore lower on screen). Legacy starts the centre member
  // at Y=170 and the side members at Y=190, matching the official stagger.
  runtime.spine.y = height * 0.66 + (180 - y) * viewportScale
  // Unity keeps the chibi prefab scale stable across solo, duo and ensemble
  // lives. Formation coordinates and the authored camera provide the framing;
  // scaling characters by active member count made three-person stages about
  // 24% larger than the already calibrated five-person reference.
  runtime.spine.scale.set(characterScale * CHARACTER_STAGE_SCALE * viewportFit * sourceScale / 1700)
  runtime.spine.visible = charactersEnabled.value && activePositions.value.includes(position) && y < 4000
  // Unity reserves the 1200-1900 band for environment washes, beams and
  // image/object layers. Characters occupy their own band around 2000; Y only
  // orders performers against one another. The previous x10 mapping pushed a
  // rear-platform performer down to z=900, causing authored light planes at
  // z=1500 to cut across the body.
  runtime.spine.zIndex = CHARACTER_DEPTH_BASE
    + Math.round((360 - y) * CHARACTER_DEPTH_Y_FACTOR)
    + position
  if (runtime.groundShadow) {
    runtime.groundShadow.position.set(runtime.spine.x, runtime.spine.y + 3 * viewportScale)
    runtime.groundShadow.scale.set(runtime.spine.scale.x * 2.1, runtime.spine.scale.y * 0.42)
    runtime.groundShadow.visible = charactersEnabled.value
      && characterShadowsEnabled.value
      && runtime.spine.visible
    runtime.groundShadow.zIndex = runtime.spine.zIndex - 1
  }
  runtime.positionTweenProgress = positionState?.tweenProgress ?? 1
}

function resizeStage() {
  if (!app || !canvasRef.value) return
  const width = Math.max(1, canvasRef.value.clientWidth)
  const height = Math.max(1, canvasRef.value.clientHeight)
  app.renderer.resize(width, height)
  for (const position of activePositions.value) {
    const event = eventsForPosition(position)
      .findLast?.(item => item.time <= stageTime.value)
      || [...eventsForPosition(position)].reverse().find(item => item.time <= stageTime.value)
    layoutRuntime(position, event)
  }
  applyCameraTransform()
  layoutStageBackground()
  syncSpotlights()
  syncLaserlights()
  syncPinspotlights().catch(error => console.warn('[ChibiStage] pinspotlight sync failed', error))
  applyStageLighting()
  syncBackmonitor(true)
  syncImageLayers().catch(error => console.warn('[ChibiStage] image-layer sync failed', error))
  syncObjectLayers().catch(error => console.warn('[ChibiStage] object-layer sync failed', error))
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
  slot.currentMotionSource = event.source || 'script'
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
  await syncStageBackground()
  syncSpotlights()
  syncLaserlights()
  await syncPinspotlights()
  applyStageLighting()
  applyCameraTransform()
  syncBackmonitor(true)
  await syncImageLayers()
  await syncObjectLayers()
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
  syncBackmonitor(true)
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
  applyCameraTransform()
  syncSpotlights()
  syncLaserlights()
  syncPinspotlights().catch(error => console.warn('[ChibiStage] pinspotlight sync failed', error))
  applyStageLighting()
  syncBackmonitor()
  syncImageLayers().catch(error => console.warn('[ChibiStage] image-layer sync failed', error))
  syncObjectLayers().catch(error => console.warn('[ChibiStage] object-layer sync failed', error))
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
  backmonitorVideo?.pause()
  backmonitorTransitionVideo?.pause()
  backmonitorTransitionAlphaVideo?.pause()
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
  if (backmonitorVideo) backmonitorVideo.playbackRate = playbackSpeed.value
  if (backmonitorTransitionVideo) backmonitorTransitionVideo.playbackRate = playbackSpeed.value
  if (backmonitorTransitionAlphaVideo) backmonitorTransitionAlphaVideo.playbackRate = playbackSpeed.value
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
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--text);
  background: var(--ink);
  font-family: Inter, "Noto Sans SC", "Microsoft YaHei", sans-serif;
}

.stage-header {
  position: sticky;
  z-index: 5;
  top: 0;
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

.stage-workspace { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); min-height: 0; }
.performance-shell { position: relative; width: 100%; min-width: 0; aspect-ratio: 16 / 9; overflow: hidden; background: #0b1726; }
.stage-backdrop { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(5, 12, 23, 0.16), rgba(5, 12, 23, 0.04) 55%, rgba(2, 8, 16, 0.62)), url('/assets/bg/bg086_dancestudio_in_01.png') center / cover no-repeat; filter: saturate(0.82) brightness(0.7); transform: scale(1.015); }
.stage-floor { position: absolute; z-index: 1; left: 6%; right: 6%; bottom: 7%; height: 30%; border: 1px solid rgba(104, 180, 245, 0.2); border-radius: 50%; background: radial-gradient(ellipse at center, rgba(67, 163, 241, 0.16), rgba(20, 70, 115, 0.05) 52%, transparent 72%); transform: perspective(500px) rotateX(62deg); transform-origin: center bottom; }
.chibi-stage[data-static-stage-enabled="false"] .stage-backdrop,
.chibi-stage[data-static-stage-enabled="false"] .stage-floor { visibility: hidden; }
.stage-canvas { position: absolute; z-index: 2; inset: 0; }
.stage-canvas :deep(canvas) { display: block; width: 100%; height: 100%; }
.performance-shell::after { content: ""; position: absolute; z-index: 2; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 47%, transparent 28%, rgba(2, 7, 14, 0.34) 100%); }

.performance-hud { position: absolute; z-index: 4; top: 24px; left: 28px; display: grid; gap: 5px; padding: 13px 16px; border-left: 2px solid var(--accent); background: rgba(4, 13, 24, 0.64); backdrop-filter: blur(12px); }
.performance-hud span { color: #73bfff; font-size: 9px; font-weight: 750; letter-spacing: 0.16em; }
.performance-hud strong { font-size: 16px; }
.performance-hud small { color: var(--muted); font-size: 10px; }

.stage-lyric {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: 180px;
  max-width: min(820px, calc(100% - 80px));
  padding: 2px 10px 4px;
  color: #fff;
  font-size: clamp(15px, 1.7vw, 24px);
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  -webkit-font-smoothing: antialiased;
  -webkit-text-stroke: 1.5px rgba(0, 0, 0, 0.96);
  paint-order: stroke fill;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
  transform: translateX(-50%);
  pointer-events: none;
}

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

.stage-inspector { min-width: 0; overflow: visible; border-top: 1px solid var(--line); background: linear-gradient(180deg, #142940, #0c1b2d); }
.inspector-scroll { display: grid; grid-template-columns: minmax(300px, 0.8fr) minmax(460px, 1.25fr) minmax(340px, 0.95fr); align-items: start; height: auto; overflow: visible; }
.control-section { min-width: 0; height: 100%; padding: 20px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.control-section:last-child { border-right: 0; }
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
.camera-toggle { display: flex; gap: 8px; align-items: center; color: #c9d9e8; font-size: 11px; }
.camera-toggle input { margin: 0; accent-color: var(--accent); }
.layer-debug-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin: 12px 0 0; padding: 11px 12px 12px; border: 1px solid rgba(111, 174, 229, 0.22); border-radius: 10px; }
.layer-debug-controls legend { padding: 0 5px; color: #8ebfe9; font-size: 10px; letter-spacing: 0.08em; }
.layer-debug-controls label { display: flex; gap: 7px; align-items: center; min-width: 0; color: #c9d9e8; font-size: 11px; }
.layer-debug-controls input { margin: 0; accent-color: var(--accent); }
.runtime-summary { display: grid; gap: 8px; margin: 0; }
.runtime-summary div { display: grid; grid-template-columns: 70px 1fr; gap: 10px; font-size: 10px; }
.runtime-summary dt { color: var(--muted); }
.runtime-summary dd { margin: 0; color: #d8e6f2; }
.audio-error { color: #ff9d9d; font-size: 10px; }

@media (max-width: 980px) {
  .stage-header { height: 58px; padding: 0 13px; }
  .stage-header h1 { font-size: 15px; }
  .stage-header p, .header-meta { display: none; }
  .stage-workspace { grid-template-columns: 1fr; overflow: visible; }
  .performance-shell { min-height: 0; }
  .stage-inspector { overflow: visible; border-top: 1px solid var(--line); border-left: 0; }
  .inspector-scroll { grid-template-columns: 1fr; height: auto; overflow: visible; }
  .control-section { height: auto; border-right: 0; }
  .position-rail { bottom: 112px; }
  .stage-lyric { bottom: 160px; }
  .transport { bottom: 16px; min-height: 72px; grid-template-columns: 40px 50px minmax(110px, auto) 1fr; padding: 0 12px; }
  .transport button { width: 40px; height: 40px; }
  .transport .primary-transport { width: 50px; height: 50px; }
}

@media (max-width: 620px) {
  .lab-link { margin-left: auto; }
  .performance-shell { min-height: 390px; aspect-ratio: auto; }
  .performance-hud { top: 14px; left: 14px; }
  .position-rail { bottom: 105px; width: calc(100% - 24px); gap: 2px; }
  .stage-lyric { bottom: 150px; }
  .position-marker small { max-width: 58px; }
  .transport { width: calc(100% - 20px); grid-template-columns: 38px 48px 1fr; gap: 8px; }
  .transport input { grid-column: 1 / -1; margin-bottom: 8px; }
  .slot-controls { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .loading-icon { animation: none; }
}
</style>
