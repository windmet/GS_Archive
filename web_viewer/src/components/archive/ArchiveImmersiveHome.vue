<template>
  <main
    v-if="activeIdol && activeCue"
    class="immersive-home"
    :class="{ 'is-focus-mode': focusMode, 'has-settings': settingsOpen }"
    :data-home-mode="homeMode"
    :data-home-stage-ready="stageReady ? '1' : '0'"
    :data-home-cue="activeCue.cue"
    :data-home-voice="activeCue.voice"
    :data-home-costume="activeCostume?.modelId || ''"
    :data-home-background="selectedBackground"
    :data-dialogue-order="preferences.dialogueOrder"
    :data-stage-tap-loading="stageTapPending ? '1' : '0'"
    :data-last-started-voice="lastStartedVoice"
    :style="homeStyle"
  >
    <ArchiveCardHomeStage v-if="homeMode === 'card'" :card="selectedCard" :loading="cardLoading" :error="cardError" @retry="loadCards(true)" />
    <SpineStage
      v-else
      responsive-positions
      portrait-framing
      ref="spineStageRef"
      :step="renderStep"
      :now-milliseconds="homeCueRuntime.nowMilliseconds"
      :fallback-bg="selectedBackground"
      :manage-background="true"
      :debug-controls="false"
      @ready="handleStageReady"
      @scene-ready="handleSceneReady"
      @error="handleStageError"
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
    <!-- The idol's name is the way into the archive: it opens the archive scoped to this idol.
         Returning sits above it as a back link, only when a page sent the reader here. Producer
         settings live in the scene settings sheet, not on the stage. -->
    <header class="home-masthead">
      <button v-if="canReturnToArchive && !focusMode" type="button" class="home-return" @click="emit('return-to-archive')">
        <ArrowLeft :size="15" aria-hidden="true" />返回资料馆
      </button>
      <button type="button" class="idol-heading" :aria-label="`查看${activeIdol.name}的资料`" @click="emit('open-archive')">
        <span>{{ activeIdol.unitName || '315 STARS' }}</span>
        <h2>{{ activeIdol.name }}</h2>
        <small>{{ activeIdol.kana }}</small>
        <em v-if="!focusMode" class="idol-heading-cta">查看资料<ChevronRight :size="14" aria-hidden="true" /></em>
      </button>
    </header>

    <div class="home-context" aria-label="首页偶像与服装">
      <ArchiveIdolAvatar :idol-code="activeIdol.id" :accent-color="activeIdol.color" :size="34" decorative />
      <label class="context-select context-idol">
        <span>首页偶像</span>
        <select v-model="selectedId" aria-label="首页偶像">
          <option v-for="idol in idols" :key="idol.id" :value="idol.id">
            {{ idol.name }}
          </option>
        </select>
      </label>
      <span v-if="homeMode === 'spine'" class="context-divider" aria-hidden="true"></span>
      <label v-if="homeMode === 'spine'" class="context-select context-costume">
        <span>服装</span>
        <select
          :value="activeCostume?.modelId || ''"
          aria-label="首页服装"
          @change="emit('update:selectedCostume', $event.target.value)"
        >
          <option v-for="costume in activeIdol.costumes" :key="costume.modelId" :value="costume.modelId">
            {{ archiveText('costume',costume.name) }}
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
      <ArchiveIdolAvatar :idol-code="activeIdol.id" :accent-color="activeIdol.color" :size="34" decorative />
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
      v-if="homeMode === 'spine' && activeIdol.costumes.length"
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
          <small>{{ archiveText('costume',costume.name) }}</small>
        </button>
      </div>
    </aside>

    <button v-if="focusMode" class="exit-focus" type="button" @click="focusMode = false">退出专注</button>

    <section class="home-dialogue" aria-label="首页台词" aria-live="polite">
      <div class="dialogue-name">{{ activeCue.speaker || activeIdol.name }}</div>
      <p>{{ presentProducerAddressingText(activeCue.text) }}</p>
      <div class="dialogue-meta">
        <span>{{ activeCue.rarity }} · {{ cardText('card',activeCue.cardTitle,'title') }}</span>

      </div>
      <div class="dialogue-actions">
        <button type="button" :aria-label="playing ? '停止语音' : '播放语音'" :title="playing ? '停止语音' : '播放语音'" @click="toggleVoice">
          <Square v-if="playing" :size="16" fill="currentColor" />
          <Volume2 v-else :size="18" />
        </button>
        <span>{{ cueIndex + 1 }} / {{ activeIdol.cues.length }}</span>
        <ArchiveLanguageSwitch class="home-language-switch" />
      </div>
      <button v-if="voiceError" type="button" class="voice-error" @click="replayCompatibilityVoice">语音资源暂时不可用 · 兼容播放</button>
    </section>

    <dialog v-if="settingsOpen" ref="sceneSettingsRef" class="scene-settings" aria-labelledby="scene-settings-title" @cancel.prevent="closeSettings" @close="closeSettings">
      <header>
        <div>
          <h3 id="scene-settings-title">场景设置</h3>
          <p>首页显示与播放偏好</p>
        </div>
        <button type="button" aria-label="关闭场景设置" title="关闭" @click="closeSettings">
          <X :size="21" />
        </button>
      </header>

      <div class="settings-body">
        <!-- First in the sheet: the stage has no producer button of its own. -->
        <button type="button" class="home-producer-settings" @click="emit('settings')"><span>制作人设置</span><small>{{ producerName ? `${producerName} P · 称呼与担当` : '设置称呼与担当' }}</small><ChevronRight :size="16" aria-hidden="true" /></button>
        <label class="settings-field"><span>首页样式</span><select aria-label="首页样式" :value="homeMode" @change="emit('update:homeMode', $event.target.value)"><option value="card">卡面主页</option><option value="spine">立绘主页</option></select></label>
        <label v-if="homeMode === 'card'" class="settings-field"><span>首页卡面</span>
          <select v-model="preferences.cardKey" aria-label="首页卡面"><option value="">使用当前偶像的默认卡面</option><option v-for="card in idolCards" :key="card.id" :value="card.id">{{ card.label }} · {{ card.variantLabel }}</option></select>
          <small>此选择独立于资料馆壁纸，切换偶像时优先使用该偶像的卡面。</small>
        </label>
        <fieldset v-if="homeMode === 'spine'" class="settings-backgrounds">
          <legend>场景背景</legend>
          <p>固定背景不会随换人、换装或切换台词改变。</p>
          <button type="button" class="background-auto" :aria-pressed="preferences.background === 'cue'" @click="preferences.background = 'cue'">跟随台词背景</button>
          <p v-if="backgroundLoading" role="status">正在读取已收录场景…</p>
          <p v-if="backgroundError" role="status">{{ backgroundError }} <button type="button" @click="loadBackgroundCatalogue(true)">重试</button></p>
          <p v-if="backgroundUnavailable" role="status">之前选择的背景当前不可用，暂用台词背景；请重新选择。</p>
          <label class="settings-field"><span>查找场景</span><input v-model="backgroundQuery" type="search" placeholder="按场景名称查找" /></label>
          <div v-if="backgroundVariants.length" class="background-variants" role="group" aria-label="按时段与天气筛选">
            <button type="button" :aria-pressed="!backgroundVariant" @click="backgroundVariant = ''">全部</button>
            <button v-for="entry in backgroundVariants" :key="entry.id" type="button" :aria-pressed="backgroundVariant === entry.id" @click="backgroundVariant = entry.id">{{ entry.label }} <small>{{ entry.count }}</small></button>
          </div>
          <div class="background-grid">
            <button v-for="background in visibleBackgrounds" :key="background.id" type="button" :aria-pressed="preferences.background === background.id" @click="preferences.background = background.id">
              <img v-if="background.url || background.thumbnail" :src="photoBackgroundThumbnailUrl(background.url) || background.thumbnail" alt="" loading="lazy" decoding="async" @error="backgroundThumbnailFailed($event, background)" />
              <strong>{{ archiveNamedBackground(background.label) }}</strong>
            </button>
          </div>
          <button v-if="filteredBackgrounds.length > backgroundLimit" type="button" class="background-more" @click="backgroundLimit += 12">显示更多场景</button>
          <small>来自资料馆已发布场景；不是原游戏首页可选背景的完整还原清单。</small>
        </fieldset>

        <label class="settings-field">
          <span>首页偶像 · 选择后记住，下次首页沿用</span>
          <select v-model="selectedId">
            <option v-for="idol in idols" :key="idol.id" :value="idol.id">{{ idol.name }}</option>
          </select>
        </label>

        <label v-if="homeMode === 'spine'" class="settings-field settings-costume-field">
          <span>服装</span>
          <select :value="activeCostume?.modelId || ''" @change="emit('update:selectedCostume', $event.target.value)">
            <option v-for="costume in activeIdol.costumes" :key="costume.modelId" :value="costume.modelId">
              {{ archiveText('costume',costume.name) }}
            </option>
          </select>
        </label>

        <fieldset class="settings-segment">
          <legend>台词切换</legend>
          <div class="settings-segment-options">
            <button type="button" :class="{ active: preferences.dialogueOrder === 'sequential' }" :aria-pressed="preferences.dialogueOrder === 'sequential'" @click="preferences.dialogueOrder = 'sequential'">顺序</button>
            <button type="button" :class="{ active: preferences.dialogueOrder === 'random' }" :aria-pressed="preferences.dialogueOrder === 'random'" @click="preferences.dialogueOrder = 'random'">随机</button>
          </div>
        </fieldset>

        <label class="settings-toggle">
          <span>自动播放语音</span>
          <input v-model="preferences.autoVoice" type="checkbox" />
          <i aria-hidden="true"></i>
        </label>

        <label class="settings-toggle settings-toggle-help">
          <span>专注模式<small>隐藏导航与控件，保留姓名、台词及退出按钮</small></span>
          <input v-model="focusMode" type="checkbox" />
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
        <button class="settings-done" type="button" @click="closeSettings">
          <Check :size="16" />
          完成
        </button>
      </footer>
    </dialog>
  </main>
</template>

<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Shirt,
  Volume2,
  X,
} from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ArchiveCardHomeStage from './ArchiveCardHomeStage.vue'
import { resolveHomeCard } from '../../data/archiveHomePreferences.js'
import { loadTerminalManifest, resolveHomeBackground } from '../../data/terminal/terminalMedia.js'
import { archiveNamedBackground, archiveNamedBackgroundSearch, loadArchiveNames } from './useArchiveNamedText.js'
import { useVoicePlayer } from '../../core/useVoicePlayer.js'
import { useStoryRuntimeCues } from '../../core/story-runtime/useStoryRuntimeCues.js'
import { StoryAudioSession } from '../../core/story-runtime/StoryAudioSession.js'
import { producerName } from '../../utils/LanguageStore.js'
import { PlayerPreferencesRepository } from '../../core/story-runtime/PlayerPreferencesRepository.js'
import {archiveText} from './useArchiveCostumeText.js'
import {archiveText as cardText} from './useArchiveCardTitle.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { photoBackgroundThumbnailUrl, photoVariantKeys, rankPhotoVariants } from '../../presentation/photoSpotScenes.js'
import { archiveText as photoText } from './useArchivePhotoText.js'
import {
  loadArchiveHomePreferences,
  resetArchiveHomePreferences,
  saveArchiveHomePreferences,
} from '../../data/archiveHomePreferences.js'

const SpineStage = defineAsyncComponent(() => import('../SpineStage.vue'))

const props = defineProps({
  idols: { type: Array, default: () => [] },
  homeMode: { type: String, default: 'spine' },
  canReturnToArchive: Boolean,
  stats: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  selectedCue: { type: String, default: '' },
  selectedCostume: { type: String, default: '' },
  noAudio: { type: Boolean, default: false },
})
const emit = defineEmits(['settings', 'open-archive', 'return-to-archive', 'open-story', 'open-cards', 'open-idol', 'open-chat', 'update:homeMode', 'focus-change', 'update:selectedId', 'update:selectedCue', 'update:selectedCostume'])

const selectedId = computed({
  get: () => props.selectedId || props.idols[0]?.id || '',
  set: value => emit('update:selectedId', value),
})
const playing = ref(false)
const voiceError = ref(false)
const lastStartedVoice = ref('')
const stageReady = ref(false)
const stageError = ref(false)
const focusMode = ref(false)
watch(focusMode, value => { emit('focus-change', value); if (value) { costumePickerOpen.value = false; closeSettings() } })
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
function closeSettings() {
  sceneSettingsRef.value?.close()
  settingsOpen.value = false
  restoreSettingsFocus()
}
const costumePickerOpen = ref(false)
const stageTapPending = ref(false)
const stageTapCommitPending = ref(false)
const queuedStageCue = ref(null)
const queuedStageVoice = ref(null)
let stageVoiceQueueToken = 0
let queuedVoiceAbort = null
let stageTapAbort = null
let homePlaybackRevision = 0
let autoVoiceTimer = null
const preferences = reactive(loadArchiveHomePreferences())

const activeIdol = computed(() => props.idols.find(idol => idol.id === selectedId.value) || props.idols[0] || null)
const activeCue = computed(() => activeIdol.value?.cues?.find(cue => cue.cue === props.selectedCue) || activeIdol.value?.cues?.[0] || null)
const activeCostume = computed(() => activeIdol.value?.costumes?.find(costume => costume.modelId === props.selectedCostume) ||
  activeIdol.value?.costumes?.find(costume => costume.modelId === activeCue.value?.modelId) ||
  activeIdol.value?.costumes?.[0] || null)
const backgroundEntries = ref([])
// The picker shows the game's own background thumbnail; the archive's derivative is the fallback.
function backgroundThumbnailFailed(event, background) {
  if (background.thumbnail && !event.target.src.endsWith(background.thumbnail)) event.target.src = background.thumbnail
}
const backgroundReady = ref(false), backgroundLoading = ref(false), backgroundError = ref('')
const backgroundQuery = ref(''), backgroundLimit = ref(12)
// Time-of-day chips: the photo catalogue's variant rule over each background's photo-studio scenes.
const backgroundVariantIndex = ref({}), backgroundVariant = ref('')
const backgroundKeys = entry => photoVariantKeys(backgroundVariantIndex.value[entry.id])
const backgroundVariants = computed(() => rankPhotoVariants(backgroundEntries.value.map(backgroundKeys), id => photoText('photo-scenes', id)))
const filteredBackgrounds = computed(() => backgroundEntries.value.filter(entry => (!backgroundVariant.value || backgroundKeys(entry).includes(backgroundVariant.value)) &&
  archiveNamedBackgroundSearch(entry.label).toLocaleLowerCase().includes(backgroundQuery.value.trim().toLocaleLowerCase())))
const visibleBackgrounds = computed(() => filteredBackgrounds.value.slice(0, backgroundLimit.value))
watch([backgroundQuery, backgroundVariant], () => { backgroundLimit.value = 12 })
const backgroundUnavailable = computed(() => backgroundReady.value && preferences.background !== 'cue' && !backgroundEntries.value.some(entry => entry.id === preferences.background))
const selectedBackground = computed(() => resolveHomeBackground(preferences.background, backgroundEntries.value,
  activeCue.value?.background || activeIdol.value?.representativeBg || '', backgroundReady.value))
async function loadBackgroundCatalogue(retry = false) {
  if (backgroundLoading.value || (backgroundReady.value && !retry)) return
  backgroundLoading.value = true; backgroundError.value = ''
  void loadArchiveNames('photos').catch(error => console.warn('Background names unavailable', error))
  try {
    const [catalogue, variants] = await Promise.all([loadTerminalManifest('backgrounds', { retry }),
      fetch('/data/masterdata/background_variants.json').then(response => response.ok ? response.json() : null).catch(() => null)])
    if (homeDisposed) return
    // Without the index the picker still works, just without chips.
    backgroundVariantIndex.value = variants?.kind === 'background-variants' ? variants.variants || {} : {}
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
const cards = ref([]), cardLoading = ref(false), cardError = ref('')
const idolCards = computed(() => cards.value.filter(card => card.idolCode === activeIdol.value?.id))
const selectedCard = computed(() => resolveHomeCard(cards.value, activeIdol.value?.id, preferences.cardKey))
async function loadCards(retry = false) {
  if (cardLoading.value || (cards.value.length && !retry)) return
  cardLoading.value = true; cardError.value = ''
  try { const data = await loadTerminalManifest('wallpapers', { retry }); if (!homeDisposed) cards.value = data.entries }
  catch { if (!homeDisposed) cardError.value = '卡面暂时无法载入，台词和语音仍可使用。' }
  finally { if (!homeDisposed) cardLoading.value = false }
}
const cueIndex = computed(() => Math.max(0, activeIdol.value?.cues?.findIndex(cue => cue.cue === activeCue.value?.cue) || 0))
const currentStep = computed(() => activeCue.value?.previewStep || {})
const compiledData = computed(() => ({ scenario_id: activeCue.value?.scenarioId || '', steps: [renderStep.value] }))
const homeAudioPreferences = new PlayerPreferencesRepository().load().volumes
const homeAudioSession = new StoryAudioSession({ disabled: props.noAudio, masterVolume: homeAudioPreferences.master, busVolumes: homeAudioPreferences })
const homeStyle = computed(() => ({
  '--idol-color': activeIdol.value?.color || 'var(--gs-mint)',
  '--interface-alpha': (preferences.interfaceOpacity / 100).toFixed(2),
}))
const voicePlayer = useVoicePlayer({
  spineStageRef,
  currentStep,
  currentStepIndex,
  compiledData,
  isPlaying: playing,
  audioSession: homeAudioSession,
  canAnimateStage: () => props.homeMode === 'spine',
})

async function handleStageReady() {
  // Child ready fires during mount, before Vue necessarily assigns its ref.
  await nextTick()
  if (homeDisposed || props.homeMode !== 'spine' || !spineStageRef.value?.manager) return
  stageReady.value = true
  stageError.value = false
  // Audio can start while the async renderer is still loading. Reattach the
  // current audio clock. Scene-ready repeats this after actor replacement.
  if (playing.value) voicePlayer.setTalking(true)
}

function handleStageError() {
  stageReady.value = false
  stageError.value = true
}

function handleSceneReady(step) {
  if (homeDisposed || props.homeMode !== 'spine' || step !== renderStep.value) return
  if (playing.value) voicePlayer.setTalking(true)
}

// defineAsyncComponent forwards the exposed ref after the child's mount/ready
// event. Cover both arrival orders rather than assuming one nextTick is enough.
watch(spineStageRef, stage => {
  if (stage?.manager) handleStageReady()
  else stageReady.value = false
}, { flush: 'post' })

const homeCueRuntime = useStoryRuntimeCues({
  compiledData, currentStepIndex, spineStageRef,
  getStageStep: () => renderStep.value,
  audioManager: {}, // Home source timelines contain only spine face/body/neck cues.
  isPaused: () => document.hidden,
  needsStage: () => props.homeMode === 'spine',
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
  if (preferences.autoVoice && !stageTapPending.value) autoVoiceTimer = window.setTimeout(() => {
    autoVoiceTimer = null
    if (!homeDisposed && preferences.autoVoice) toggleVoice()
  }, 180)
})

watch([
  () => activeIdol.value?.id,
  () => activeCue.value?.cue,
  () => preferences.dialogueOrder,
], () => queueNextStageVoice(), { immediate: true })

watch(preferences, value => {
  saveArchiveHomePreferences(value)
}, { deep: true })

async function openSettings() {
  if (settingsOpen.value) return
  settingsReturnFocus = document.activeElement
  costumePickerOpen.value = false
  settingsOpen.value = true
  await nextTick()
  if (!homeDisposed && settingsOpen.value) sceneSettingsRef.value?.showModal()
  if (props.homeMode === 'spine') loadBackgroundCatalogue()
}

function toggleCostumePicker() {
  closeSettings()
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
    if (!prepared) prepared = await voicePlayer.prepareVoice({ step: next.previewStep, scenarioId: next.scenarioId, includeLip: props.homeMode === 'spine', signal: tapOwner.signal })
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
      props.homeMode === 'spine' && homeCueRuntime.handleStepChange()
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

  const prepared = await voicePlayer.prepareVoice({ step: next.previewStep, scenarioId: next.scenarioId, includeLip: props.homeMode === 'spine', signal: owner.signal })
  if (homeDisposed || owner.signal.aborted || token !== stageVoiceQueueToken || activeIdol.value?.id !== idolId || queuedStageCue.value?.cue !== next.cue) {
    voicePlayer.releasePreparedVoice(prepared)
    return
  }
  queuedStageVoice.value = prepared
}

function stopVoice() {
  clearTimeout(autoVoiceTimer)
  autoVoiceTimer = null
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
    props.homeMode === 'spine' && homeCueRuntime.handleStepChange()
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
    props.homeMode === 'spine' && homeCueRuntime.handleStepChange()
  }
}

function resetPreferences() {
  Object.assign(preferences, resetArchiveHomePreferences())
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (settingsOpen.value) closeSettings()
  else if (focusMode.value) focusMode.value = false
  if (costumePickerOpen.value) costumePickerOpen.value = false
}

watch(() => props.homeMode, mode => {
  stageTapAbort?.abort()
  stopVoice(); costumePickerOpen.value = false
  stageReady.value = false
  stageError.value = false
  queueNextStageVoice()
  if (mode === 'card') loadCards()
  else if (preferences.background !== 'cue' || settingsOpen.value) loadBackgroundCatalogue()
})

onMounted(() => {
  delete document.documentElement.dataset.archiveHomeTheme
  if (props.homeMode === 'card') loadCards()
  else if (preferences.background !== 'cue') loadBackgroundCatalogue()
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('visibilitychange', syncHomeVisibility)
})
onBeforeUnmount(() => {
  homeDisposed = true
  emit('focus-change', false)
  clearTimeout(autoVoiceTimer)
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

<style scoped>
.dialogue-actions { min-width:0;flex-wrap:wrap;row-gap:6px; }
.dialogue-actions > span { flex:none; }
.home-language-switch { pointer-events:auto;margin-left:auto; }
.home-masthead { display:flex; flex-direction:column; align-items:start; gap:8px; }
@media(max-width:760px){ .home-masthead { max-width:calc(100% - 78px); } }
</style>
