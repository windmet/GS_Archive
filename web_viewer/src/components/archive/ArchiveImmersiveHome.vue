<template>
  <main
    v-if="activeIdol && activeCue"
    class="immersive-home"
    :class="{ 'is-focus-mode': preferences.focusMode, 'has-settings': settingsOpen }"
    :data-home-cue="activeCue.cue"
    :data-home-voice="activeCue.voice"
    :data-home-costume="activeCostume?.modelId || ''"
    :data-home-background="selectedBackground"
    :data-dialogue-order="preferences.dialogueOrder"
    :data-stage-tap-loading="stageTapPending ? '1' : '0'"
    :data-last-started-voice="lastStartedVoice"
    :style="homeStyle"
  >
    <SpineStage
      responsive-positions
      portrait-framing
      ref="spineStageRef"
      :step="renderStep"
      :now-milliseconds="homeCueRuntime.nowMilliseconds"
      :fallback-bg="selectedBackground"
      :manage-background="true"
      :debug-controls="false"
      @ready="stageReady = true"
      @error="stageError = true"
    />
    <button
      class="stage-tap-target"
      type="button"
      aria-label="切换并播放下一句首页台词"
      title="下一句台词"
      :disabled="stageTapPending"
      @click="handleStageTap"
    ></button>
    <div class="scene-shade" aria-hidden="true"></div>

    <header class="home-masthead">
      <div class="idol-heading">
        <span>{{ activeIdol.unitName || '315 STARS' }}</span>
        <h2>{{ activeIdol.name }}</h2>
        <small>{{ activeIdol.kana }}</small>
      </div>
    </header>

    <div class="home-context" aria-label="首页偶像与服装">
      <img :src="getCharaIconUrl(activeIdol.id)" :alt="activeIdol.name" />
      <label class="context-select context-idol">
        <span>首页偶像</span>
        <select v-model="selectedId" aria-label="首页偶像">
          <option v-for="idol in idols" :key="idol.id" :value="idol.id">
            {{ idol.name }}
          </option>
        </select>
      </label>
      <span class="context-divider" aria-hidden="true"></span>
      <label class="context-select context-costume">
        <span>服装</span>
        <select
          :value="activeCostume?.modelId || ''"
          aria-label="首页服装"
          @change="emit('update:selectedCostume', $event.target.value)"
        >
          <option v-for="costume in activeIdol.costumes" :key="costume.modelId" :value="costume.modelId">
            {{ costume.name }}
          </option>
        </select>
      </label>
      <button
        class="settings-trigger"
        type="button"
        aria-label="场景设置"
        aria-haspopup="dialog"
        :aria-expanded="settingsOpen"
        title="场景设置"
        @click="openSettings"
      >
        <SlidersHorizontal :size="17" />
      </button>
    </div>

    <label class="mobile-idol-switch" title="选择首页偶像">
      <span>选择首页偶像</span>
      <ArrowLeftRight :size="20" />
      <select v-model="selectedId" aria-label="选择首页偶像">
        <option v-for="idol in idols" :key="idol.id" :value="idol.id">{{ idol.name }}</option>
      </select>
    </label>

    <button
      class="mobile-settings-trigger"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="settingsOpen"
      aria-label="场景设置"
      title="场景设置"
      @click="openSettings"
    >
      <SlidersHorizontal :size="20" />
    </button>

    <button
      v-if="activeIdol.costumes.length"
      class="mobile-costume-trigger"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="costumePickerOpen"
      aria-label="选择首页服装"
      title="选择首页服装"
      @click="toggleCostumePicker"
    >
      <Shirt :size="20" />
    </button>

    <button
      v-if="costumePickerOpen"
      class="costume-picker-scrim"
      type="button"
      aria-label="关闭服装选择"
      @click="costumePickerOpen = false"
    ></button>
    <aside
      v-if="costumePickerOpen"
      class="mobile-costume-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="costume-picker-title"
    >
      <header>
        <div>
          <span>首页服装</span>
          <strong id="costume-picker-title">{{ activeIdol.name }}</strong>
        </div>
        <button type="button" aria-label="关闭服装选择" @click="costumePickerOpen = false">
          <X :size="18" />
        </button>
      </header>
      <div class="costume-grid">
        <button
          v-for="costume in activeIdol.costumes"
          :key="costume.modelId"
          type="button"
          :class="{ active: activeCostume?.modelId === costume.modelId }"
          :aria-pressed="activeCostume?.modelId === costume.modelId"
          @click="selectCostume(costume.modelId)"
        >
          <span><Shirt :size="18" /></span>
          <small>{{ costume.name }}</small>
        </button>
      </div>
    </aside>

    <section v-if="activeHighlight && !preferences.focusMode" class="home-highlight" aria-label="活动聚焦">
      <button class="highlight-main" type="button" @click="emit('open-event', activeHighlight)">
        <img :src="activeHighlight.bannerUrl" :alt="activeHighlight.title" />
        <span class="highlight-copy">
          <strong>{{ activeHighlight.title }}</strong>
          <small>{{ activeHighlight.scopeLabel }}</small>
        </span>
      </button>
      <div class="highlight-controls">
        <button type="button" aria-label="上一个活动" title="上一个活动" @click="stepHighlight(-1)">
          <ChevronLeft :size="15" />
        </button>
        <span>{{ highlightIndex + 1 }} / {{ highlights.length }}</span>
        <button type="button" aria-label="下一个活动" title="下一个活动" @click="stepHighlight(1)">
          <ChevronRight :size="15" />
        </button>
      </div>
    </section>

    <section class="home-dialogue" aria-label="首页台词" aria-live="polite">
      <div class="dialogue-name">{{ activeCue.speaker || activeIdol.name }}</div>
      <p>{{ activeCue.text }}</p>
      <div class="dialogue-meta">
        <span>{{ activeCue.rarity }} · {{ activeCue.cardTitle }}</span>

      </div>
      <div class="dialogue-actions">
        <button type="button" :aria-label="playing ? '停止语音' : '播放语音'" :title="playing ? '停止语音' : '播放语音'" @click="toggleVoice">
          <Square v-if="playing" :size="16" fill="currentColor" />
          <Volume2 v-else :size="18" />
        </button>
        <span>{{ cueIndex + 1 }} / {{ activeIdol.cues.length }}</span>
      </div>
      <button v-if="voiceError" type="button" class="voice-error" @click="replayCompatibilityVoice">语音资源暂时不可用 · 兼容播放</button>
    </section>

    <dialog ref="sceneSettingsRef" class="scene-settings" aria-labelledby="scene-settings-title" @cancel="settingsOpen = false" @close="restoreSettingsFocus">
      <header>
        <div>
          <h3 id="scene-settings-title">场景设置</h3>
          <p>首页显示与播放偏好</p>
        </div>
        <button type="button" aria-label="关闭场景设置" title="关闭" @click="settingsOpen = false">
          <X :size="21" />
        </button>
      </header>

      <div v-if="settingsOpen" class="settings-body">
        <fieldset class="settings-backgrounds">
          <legend>场景背景</legend>
          <p>固定背景不会随换人、换装或切换台词改变。</p>
          <button type="button" class="background-auto" :aria-pressed="preferences.background === 'cue'" @click="preferences.background = 'cue'">跟随台词背景</button>
          <p v-if="backgroundLoading" role="status">正在读取已收录场景…</p>
          <p v-if="backgroundError" role="status">{{ backgroundError }} <button type="button" @click="loadBackgroundCatalogue(true)">重试</button></p>
          <p v-if="backgroundUnavailable" role="status">之前选择的背景当前不可用，暂用台词背景；请重新选择。</p>
          <label class="settings-field"><span>查找场景</span><input v-model="backgroundQuery" type="search" placeholder="按场景名称查找" /></label>
          <div class="background-grid">
            <button v-for="background in visibleBackgrounds" :key="background.id" type="button" :aria-pressed="preferences.background === background.id" @click="preferences.background = background.id">
              <img v-if="background.thumbnail" :src="background.thumbnail" alt="" loading="lazy" decoding="async" />
              <strong>{{ background.label }}</strong>
            </button>
          </div>
          <button v-if="filteredBackgrounds.length > backgroundLimit" type="button" class="background-more" @click="backgroundLimit += 12">显示更多场景</button>
          <small>来自资料馆已发布场景；不是原游戏首页可选背景的完整还原清单。</small>
        </fieldset>

        <label class="settings-field">
          <span>首页偶像</span>
          <select v-model="selectedId">
            <option v-for="idol in idols" :key="idol.id" :value="idol.id">{{ idol.name }}</option>
          </select>
        </label>

        <label class="settings-field settings-costume-field">
          <span>服装</span>
          <select :value="activeCostume?.modelId || ''" @change="emit('update:selectedCostume', $event.target.value)">
            <option v-for="costume in activeIdol.costumes" :key="costume.modelId" :value="costume.modelId">
              {{ costume.name }}
            </option>
          </select>
        </label>

        <fieldset class="settings-segment">
          <legend>台词切换</legend>
          <button type="button" :class="{ active: preferences.dialogueOrder === 'sequential' }" @click="preferences.dialogueOrder = 'sequential'">顺序</button>
          <button type="button" :class="{ active: preferences.dialogueOrder === 'random' }" @click="preferences.dialogueOrder = 'random'">随机</button>
        </fieldset>

        <label class="settings-toggle">
          <span>自动播放语音</span>
          <input v-model="preferences.autoVoice" type="checkbox" />
          <i aria-hidden="true"></i>
        </label>

        <label class="settings-toggle settings-toggle-help">
          <span>专注角色模式<small>隐藏活动推荐，减少界面干扰</small></span>
          <input v-model="preferences.focusMode" type="checkbox" />
          <i aria-hidden="true"></i>
        </label>

        <label class="settings-range">
          <span>界面透明度</span>
          <div>
            <input v-model.number="preferences.interfaceOpacity" type="range" min="68" max="100" step="1" />
            <output>{{ preferences.interfaceOpacity }}%</output>
          </div>
        </label>
      </div>

      <footer>
        <button class="settings-reset" type="button" @click="resetPreferences">
          <RotateCcw :size="15" />
          恢复默认
        </button>
        <button class="settings-done" type="button" @click="settingsOpen = false">
          <Check :size="16" />
          完成
        </button>
      </footer>
    </dialog>
  </main>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Shirt,
  Volume2,
  X,
} from '@lucide/vue'
import { getCharaIconUrl } from '../../utils/AssetResolver.js'
import { loadTerminalManifest, resolveHomeBackground } from '../../data/terminal/terminalMedia.js'
import { useVoicePlayer } from '../../core/useVoicePlayer.js'
import { useStoryRuntimeCues } from '../../core/story-runtime/useStoryRuntimeCues.js'
import { StoryAudioSession } from '../../core/story-runtime/StoryAudioSession.js'
import {
  loadArchiveHomePreferences,
  resetArchiveHomePreferences,
  saveArchiveHomePreferences,
} from '../../data/archiveHomePreferences.js'

const SpineStage = defineAsyncComponent(() => import('../SpineStage.vue'))

const props = defineProps({
  idols: { type: Array, default: () => [] },
  highlights: { type: Array, default: () => [] },
  stats: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  selectedCue: { type: String, default: '' },
  selectedCostume: { type: String, default: '' },
  noAudio: { type: Boolean, default: false },
})
const emit = defineEmits(['open-story', 'open-cards', 'open-idol', 'open-chat', 'open-event', 'update:selectedId', 'update:selectedCue', 'update:selectedCostume'])

const selectedId = computed({
  get: () => props.selectedId || props.idols[0]?.id || '',
  set: value => emit('update:selectedId', value),
})
const playing = ref(false)
const voiceError = ref(false)
const lastStartedVoice = ref('')
const stageReady = ref(false)
const stageError = ref(false)
const highlightIndex = ref(0)
const spineStageRef = ref(null)
const currentStepIndex = ref(0)
const performanceRevision = ref(0)
let homeDisposed = false
const settingsOpen = ref(false)
const sceneSettingsRef = ref(null)
let settingsReturnFocus = null
function restoreSettingsFocus() {
  if (settingsReturnFocus?.isConnected) settingsReturnFocus.focus({ preventScroll: true })
  settingsReturnFocus = null
}
watch(settingsOpen, async open => {
  await nextTick()
  if (homeDisposed) return
  if (open && settingsOpen.value && !sceneSettingsRef.value?.open) {
    settingsReturnFocus = document.activeElement
    sceneSettingsRef.value?.showModal()
  } else if (!open && sceneSettingsRef.value?.open) sceneSettingsRef.value.close()
})
const costumePickerOpen = ref(false)
const stageTapPending = ref(false)
const stageTapCommitPending = ref(false)
const queuedStageCue = ref(null)
const queuedStageVoice = ref(null)
let stageVoiceQueueToken = 0
let queuedVoiceAbort = null
let stageTapAbort = null
let homePlaybackRevision = 0
const preferences = reactive(loadArchiveHomePreferences())

const activeIdol = computed(() => props.idols.find(idol => idol.id === selectedId.value) || props.idols[0] || null)
const activeCue = computed(() => activeIdol.value?.cues?.find(cue => cue.cue === props.selectedCue) || activeIdol.value?.cues?.[0] || null)
const activeCostume = computed(() => activeIdol.value?.costumes?.find(costume => costume.modelId === props.selectedCostume) ||
  activeIdol.value?.costumes?.find(costume => costume.modelId === activeCue.value?.modelId) ||
  activeIdol.value?.costumes?.[0] || null)
const backgroundEntries = ref([])
const backgroundReady = ref(false), backgroundLoading = ref(false), backgroundError = ref('')
const backgroundQuery = ref(''), backgroundLimit = ref(12)
const filteredBackgrounds = computed(() => backgroundEntries.value.filter(entry => entry.label.toLocaleLowerCase().includes(backgroundQuery.value.trim().toLocaleLowerCase())))
const visibleBackgrounds = computed(() => filteredBackgrounds.value.slice(0, backgroundLimit.value))
watch(backgroundQuery, () => { backgroundLimit.value = 12 })
const backgroundUnavailable = computed(() => backgroundReady.value && preferences.background !== 'cue' && !backgroundEntries.value.some(entry => entry.id === preferences.background))
const selectedBackground = computed(() => resolveHomeBackground(preferences.background, backgroundEntries.value,
  activeCue.value?.background || activeIdol.value?.representativeBg || '', backgroundReady.value))
async function loadBackgroundCatalogue(retry = false) {
  if (backgroundLoading.value || (backgroundReady.value && !retry)) return
  backgroundLoading.value = true; backgroundError.value = ''
  try {
    const catalogue = await loadTerminalManifest('backgrounds', { retry })
    if (homeDisposed) return
    backgroundEntries.value = catalogue.entries; backgroundReady.value = true
  } catch {
    if (!homeDisposed) backgroundError.value = '场景目录暂时不可用。现有首页仍可继续使用。'
  } finally { if (!homeDisposed) backgroundLoading.value = false }
}
const renderStep = computed(() => {
  performanceRevision.value // Replay reprojects the source entry pose without remounting the stage.
  const step = activeCue.value?.previewStep
  if (!step?.state) return step || {}
  return {
    ...step,
    state: {
      ...step.state,
      bg: selectedBackground.value,
      spines: (step.state.spines || []).map(spine => {
        if (spine.id !== activeIdol.value?.id) return spine
        return {
          ...spine,
          ...(activeCostume.value?.modelId ? { model: activeCostume.value.modelId } : {}),
        }
      }),
    },
  }
})
const activeHighlight = computed(() => props.highlights[highlightIndex.value] || props.highlights[0] || null)
const cueIndex = computed(() => Math.max(0, activeIdol.value?.cues?.findIndex(cue => cue.cue === activeCue.value?.cue) || 0))
const currentStep = computed(() => activeCue.value?.previewStep || {})
const compiledData = computed(() => ({ scenario_id: activeCue.value?.scenarioId || '', steps: [renderStep.value] }))
const homeAudioSession = new StoryAudioSession({ disabled: props.noAudio })
const homeStyle = computed(() => ({
  '--idol-color': activeIdol.value?.color || '#21b7c5',
  '--interface-alpha': (preferences.interfaceOpacity / 100).toFixed(2),
}))
const voicePlayer = useVoicePlayer({
  spineStageRef,
  currentStep,
  currentStepIndex,
  compiledData,
  isPlaying: playing,
  audioSession: homeAudioSession,
})

const homeCueRuntime = useStoryRuntimeCues({
  compiledData, currentStepIndex, spineStageRef,
  getStageStep: () => renderStep.value,
  audioManager: {}, // Home source timelines contain only spine face/body/neck cues.
  isPaused: () => document.hidden,
})
function syncHomeVisibility() {
  const action = document.hidden ? 'pause' : 'resume'
  homeCueRuntime[action]().catch(() => {})
  homeAudioSession[action]('visibility').catch(() => {})
}
watch(() => activeCostume.value?.modelId, () => stopVoice())

watch(() => activeIdol.value?.id, () => {
  stageTapAbort?.abort()
  stageError.value = false
  stopVoice()
  if (activeCue.value?.cue !== props.selectedCue) emit('update:selectedCue', activeCue.value?.cue || '')
  if (activeCostume.value?.modelId !== props.selectedCostume) emit('update:selectedCostume', activeCostume.value?.modelId || '')
})

watch(activeCue, () => {
  homeCueRuntime.cancelCurrentStep('home-cue-change')
  voiceError.value = false
  if (stageTapCommitPending.value) return
  stopVoice()
  if (preferences.autoVoice && !stageTapPending.value) window.setTimeout(() => toggleVoice(), 180)
})

watch([
  () => activeIdol.value?.id,
  () => activeCue.value?.cue,
  () => preferences.dialogueOrder,
], () => queueNextStageVoice(), { immediate: true })

watch(preferences, value => {
  saveArchiveHomePreferences(value)
}, { deep: true })

function openSettings() {
  costumePickerOpen.value = false
  settingsOpen.value = true
  loadBackgroundCatalogue()
}

function toggleCostumePicker() {
  settingsOpen.value = false
  costumePickerOpen.value = !costumePickerOpen.value
}

function selectCostume(modelId) {
  emit('update:selectedCostume', modelId)
  costumePickerOpen.value = false
}

function resolveNextCue() {
  const cues = activeIdol.value?.cues || []
  if (!cues.length) return null
  let nextIndex = (cueIndex.value + 1) % cues.length
  if (preferences.dialogueOrder === 'random' && cues.length > 1) {
    nextIndex = Math.floor(Math.random() * (cues.length - 1))
    if (nextIndex >= cueIndex.value) nextIndex += 1
  }
  return cues[nextIndex]
}

function nextCue() {
  const next = resolveNextCue()
  if (next) emit('update:selectedCue', next.cue)
}

async function handleStageTap() {
  if (stageTapPending.value) return
  const next = queuedStageCue.value || resolveNextCue()
  if (!next) return
  const idolId = activeIdol.value?.id
  const revision = ++homePlaybackRevision
  const tapOwner = stageTapAbort = new AbortController()
  const isCurrent = () => !homeDisposed && !tapOwner.signal.aborted && stageTapAbort === tapOwner
    && homePlaybackRevision === revision && activeIdol.value?.id === idolId
  stageTapPending.value = true // cached MediaElement preparation is asynchronous too
  voiceError.value = false
  voicePlayer.unlockAudioContext()
  let prepared = queuedStageCue.value?.cue === next.cue ? queuedStageVoice.value : null
  if (prepared) queuedStageVoice.value = null // ownership transferred to this tap
  try {
    if (!prepared) prepared = await voicePlayer.prepareVoice({ step: next.previewStep, scenarioId: next.scenarioId, signal: tapOwner.signal })
    if (!isCurrent()) { voicePlayer.releasePreparedVoice(prepared); return }
    homeCueRuntime.cancelCurrentStep('home-next-cue')
    stageTapCommitPending.value = true
    emit('update:selectedCue', next.cue)
    await nextTick()
    if (!isCurrent()) { voicePlayer.releasePreparedVoice(prepared); return }
    const started = prepared ? await voicePlayer.playPreparedVoice(prepared) : false
    if (!isCurrent()) return
    voiceError.value = !started
    if (started) {
      lastStartedVoice.value = next.voice || ''
      homeCueRuntime.handleStepChange()
    }
  } finally {
    if (stageTapAbort === tapOwner) {
      stageTapAbort = null
      stageTapCommitPending.value = false
      stageTapPending.value = false
    }
  }
}

async function queueNextStageVoice() {
  queuedVoiceAbort?.abort()
  voicePlayer.releasePreparedVoice(queuedStageVoice.value)
  const owner = queuedVoiceAbort = new AbortController()
  const next = resolveNextCue()
  const idolId = activeIdol.value?.id
  const token = ++stageVoiceQueueToken
  queuedStageCue.value = next
  queuedStageVoice.value = null
  if (!next?.previewStep) return

  const prepared = await voicePlayer.prepareVoice({ step: next.previewStep, scenarioId: next.scenarioId, signal: owner.signal })
  if (homeDisposed || owner.signal.aborted || token !== stageVoiceQueueToken || activeIdol.value?.id !== idolId || queuedStageCue.value?.cue !== next.cue) {
    voicePlayer.releasePreparedVoice(prepared)
    return
  }
  queuedStageVoice.value = prepared
}

function stepHighlight(direction) {
  if (!props.highlights.length) return
  highlightIndex.value = (highlightIndex.value + direction + props.highlights.length) % props.highlights.length
}

function stopVoice() {
  homePlaybackRevision++
  homeCueRuntime.cancelCurrentStep('home-stop-voice')
  voicePlayer.stopCurrentVoice('archive-home')
  voicePlayer.resetVoiceDedup()
  playing.value = false
}

async function toggleVoice() {
  if (playing.value) {
    stopVoice()
    return
  }
  const revision = ++homePlaybackRevision
  const cue = activeCue.value
  voiceError.value = false
  voicePlayer.unlockAudioContext()
  voicePlayer.resetVoiceDedup()
  homeCueRuntime.cancelCurrentStep('home-replay')
  performanceRevision.value++
  await nextTick()
  if (homeDisposed || revision !== homePlaybackRevision || activeCue.value !== cue) return
  const started = await voicePlayer.playVoice()
  if (homeDisposed || revision !== homePlaybackRevision || activeCue.value !== cue) return
  if (started) {
    lastStartedVoice.value = activeCue.value?.voice || ''
    homeCueRuntime.handleStepChange()
  }
  voiceError.value = !started
}

async function replayCompatibilityVoice() {
  const revision = ++homePlaybackRevision
  const cue = activeCue.value
  voicePlayer.unlockAudioContext()
  homeCueRuntime.cancelCurrentStep('home-compat-replay')
  const started = await voicePlayer.retryVoice({ backend: 'media' })
  if (homeDisposed || revision !== homePlaybackRevision || activeCue.value !== cue) return
  voiceError.value = !started
  if (started) {
    lastStartedVoice.value = activeCue.value?.voice || ''
    homeCueRuntime.handleStepChange()
  }
}

function resetPreferences() {
  Object.assign(preferences, resetArchiveHomePreferences())
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (settingsOpen.value) settingsOpen.value = false
  if (costumePickerOpen.value) costumePickerOpen.value = false
}

onMounted(() => {
  delete document.documentElement.dataset.archiveHomeTheme
  if (preferences.background !== 'cue') loadBackgroundCatalogue()
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('visibilitychange', syncHomeVisibility)
})
onBeforeUnmount(() => {
  homeDisposed = true
  sceneSettingsRef.value?.close()
  restoreSettingsFocus()
  delete document.documentElement.dataset.archiveHomeTheme
  queuedVoiceAbort?.abort()
  stageTapAbort?.abort()
  voicePlayer.releasePreparedVoice(queuedStageVoice.value)
  homeCueRuntime.cleanup()
  document.removeEventListener('visibilitychange', syncHomeVisibility)
  window.removeEventListener('keydown', handleKeydown)
  voicePlayer.dispose()
  homeAudioSession.dispose().catch(() => {})
})
</script>

<style scoped src="../../styles/archive-home-day.css"></style>
