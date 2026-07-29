<template>
  <main
    v-if="activeIdol && activeCue"
    class="immersive-home"
    :class="[`theme-${preferences.theme}`, { 'is-focus-mode': preferences.focusMode, 'has-settings': settingsOpen }]"
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
      :key="stageLayout"
      ref="spineStageRef"
      :step="renderStep"
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
        <code>{{ activeCue.cue }}</code>
      </div>
      <div class="dialogue-actions">
        <button type="button" :aria-label="playing ? '停止语音' : '播放语音'" :title="playing ? '停止语音' : '播放语音'" @click="toggleVoice">
          <Square v-if="playing" :size="16" fill="currentColor" />
          <Volume2 v-else :size="18" />
        </button>
        <span>{{ cueIndex + 1 }} / {{ activeIdol.cues.length }}</span>
      </div>
      <small v-if="voiceError" class="voice-error">语音资源暂时不可用</small>
    </section>

    <button v-if="settingsOpen" class="settings-scrim" type="button" aria-label="关闭场景设置" @click="settingsOpen = false"></button>
    <aside v-if="settingsOpen" class="scene-settings" role="dialog" aria-modal="true" aria-labelledby="scene-settings-title">
      <header>
        <div>
          <h3 id="scene-settings-title">场景设置</h3>
          <p>首页显示与播放偏好</p>
        </div>
        <button type="button" aria-label="关闭场景设置" title="关闭" @click="settingsOpen = false">
          <X :size="21" />
        </button>
      </header>

      <div class="settings-body">
        <fieldset class="settings-segment settings-theme">
          <legend>显示模式</legend>
          <button type="button" :class="{ active: preferences.theme === 'day' }" @click="preferences.theme = 'day'">日间</button>
          <button type="button" :class="{ active: preferences.theme === 'night' }" @click="preferences.theme = 'night'">夜间</button>
        </fieldset>

        <label class="settings-field">
          <span>背景</span>
          <select v-model="preferences.background">
            <option value="cue">场景台词背景</option>
            <option v-for="background in availableBackgrounds" :key="background" :value="background">
              {{ formatBackgroundLabel(background) }}
            </option>
          </select>
        </label>

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
    </aside>
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
import { getBgUrl, getCharaIconUrl } from '../../utils/AssetResolver.js'
import { useVoicePlayer } from '../../core/useVoicePlayer.js'
import { StoryAudioSession } from '../../core/story-runtime/StoryAudioSession.js'
import {
  loadArchiveHomePreferences,
  resetArchiveHomePreferences,
  saveArchiveHomePreferences,
} from '../../data/archiveHomePreferences.js'

const SpineStage = defineAsyncComponent(() => import('../SpineStage.vue'))
const MOBILE_SPINE_ZOOM = 0.86
const MOBILE_SPINE_LIFT = 300

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
const stageLayout = ref(window.innerWidth <= 560 ? 'compact' : 'wide')
const highlightIndex = ref(0)
const spineStageRef = ref(null)
const currentStepIndex = ref(0)
const settingsOpen = ref(false)
const costumePickerOpen = ref(false)
const stageTapPending = ref(false)
const stageTapCommitPending = ref(false)
const queuedStageCue = ref(null)
const queuedStageVoice = ref(null)
let stageVoiceQueueToken = 0
const preferences = reactive(loadArchiveHomePreferences())

const activeIdol = computed(() => props.idols.find(idol => idol.id === selectedId.value) || props.idols[0] || null)
const activeCue = computed(() => activeIdol.value?.cues?.find(cue => cue.cue === props.selectedCue) || activeIdol.value?.cues?.[0] || null)
const activeCostume = computed(() => activeIdol.value?.costumes?.find(costume => costume.modelId === props.selectedCostume) ||
  activeIdol.value?.costumes?.find(costume => costume.modelId === activeCue.value?.modelId) ||
  activeIdol.value?.costumes?.[0] || null)
const availableBackgrounds = computed(() => [...new Set((activeIdol.value?.cues || []).map(cue => cue.background).filter(Boolean))])
const selectedBackground = computed(() => preferences.background === 'cue' || !availableBackgrounds.value.includes(preferences.background)
  ? activeCue.value?.background || activeIdol.value?.representativeBg || ''
  : preferences.background)
const renderStep = computed(() => {
  const step = activeCue.value?.previewStep
  if (!step?.state) return step || {}
  const compactStage = stageLayout.value === 'compact'
  return {
    ...step,
    state: {
      ...step.state,
      bg: selectedBackground.value,
      spines: (step.state.spines || []).map(spine => {
        if (spine.id !== activeIdol.value?.id) return spine
        const sourceZoom = Number.isFinite(spine.idol_zoom) && spine.idol_zoom > 0 ? spine.idol_zoom : 1
        return {
          ...spine,
          ...(activeCostume.value?.modelId ? { model: activeCostume.value.modelId } : {}),
          ...(compactStage ? {
            idol_zoom: sourceZoom * MOBILE_SPINE_ZOOM,
            pos_y: (spine.pos_y || 0) + MOBILE_SPINE_LIFT,
          } : {}),
        }
      }),
    },
  }
})
const activeHighlight = computed(() => props.highlights[highlightIndex.value] || props.highlights[0] || null)
const cueIndex = computed(() => Math.max(0, activeIdol.value?.cues?.findIndex(cue => cue.cue === activeCue.value?.cue) || 0))
const currentStep = computed(() => activeCue.value?.previewStep || {})
const compiledData = computed(() => ({ scenario_id: activeCue.value?.scenarioId || '' }))
const homeAudioSession = new StoryAudioSession({ disabled: props.noAudio })
const homeStyle = computed(() => ({
  '--idol-color': activeIdol.value?.color || '#21b7c5',
  '--interface-alpha': (preferences.interfaceOpacity / 100).toFixed(2),
  backgroundImage: selectedBackground.value ? `url(${getBgUrl(selectedBackground.value)})` : 'none',
}))
const voicePlayer = useVoicePlayer({
  spineStageRef,
  currentStep,
  currentStepIndex,
  compiledData,
  isPlaying: playing,
  audioSession: homeAudioSession,
})

watch(() => activeIdol.value?.id, () => {
  stageError.value = false
  stopVoice()
  if (activeCue.value?.cue !== props.selectedCue) emit('update:selectedCue', activeCue.value?.cue || '')
  if (activeCostume.value?.modelId !== props.selectedCostume) emit('update:selectedCostume', activeCostume.value?.modelId || '')
  if (preferences.background !== 'cue' && !availableBackgrounds.value.includes(preferences.background)) preferences.background = 'cue'
})

watch(activeCue, () => {
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
  document.documentElement.dataset.archiveHomeTheme = value.theme
}, { deep: true })

function openSettings() {
  costumePickerOpen.value = false
  settingsOpen.value = true
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
  voiceError.value = false
  voicePlayer.unlockAudioContext()
  let prepared = queuedStageCue.value?.cue === next.cue ? queuedStageVoice.value : null
  if (!prepared) {
    stageTapPending.value = true
    prepared = await voicePlayer.prepareVoice({ step: next.previewStep, scenarioId: next.scenarioId })
  }

  if (activeIdol.value?.id !== idolId) {
    stageTapPending.value = false
    return
  }

  stageTapCommitPending.value = true
  emit('update:selectedCue', next.cue)
  let started = false
  if (prepared) {
    started = voicePlayer.playPreparedVoice(prepared)
    if (started) lastStartedVoice.value = next.voice || ''
    voiceError.value = !started
  } else {
    voiceError.value = true
  }
  await nextTick()
  stageTapCommitPending.value = false
  stageTapPending.value = false
}

async function queueNextStageVoice() {
  const next = resolveNextCue()
  const idolId = activeIdol.value?.id
  const token = ++stageVoiceQueueToken
  queuedStageCue.value = next
  queuedStageVoice.value = null
  if (!next?.previewStep) return

  const prepared = await voicePlayer.prepareVoice({ step: next.previewStep, scenarioId: next.scenarioId })
  if (token !== stageVoiceQueueToken || activeIdol.value?.id !== idolId || queuedStageCue.value?.cue !== next.cue) return
  queuedStageVoice.value = prepared
}

function stepHighlight(direction) {
  if (!props.highlights.length) return
  highlightIndex.value = (highlightIndex.value + direction + props.highlights.length) % props.highlights.length
}

function stopVoice() {
  voicePlayer.stopCurrentVoice('archive-home')
  voicePlayer.resetVoiceDedup()
  playing.value = false
}

async function toggleVoice() {
  if (playing.value) {
    stopVoice()
    return
  }
  voiceError.value = false
  voicePlayer.unlockAudioContext()
  voicePlayer.resetVoiceDedup()
  const started = await voicePlayer.playVoice()
  if (started) lastStartedVoice.value = activeCue.value?.voice || ''
  voiceError.value = !started
}

function resetPreferences() {
  Object.assign(preferences, resetArchiveHomePreferences())
}

function formatBackgroundLabel(background) {
  return `背景 ${background}`
}

function syncStageLayout() {
  stageLayout.value = window.innerWidth <= 560 ? 'compact' : 'wide'
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (settingsOpen.value) settingsOpen.value = false
  if (costumePickerOpen.value) costumePickerOpen.value = false
}

onMounted(() => {
  document.documentElement.dataset.archiveHomeTheme = preferences.theme
  window.addEventListener('resize', syncStageLayout)
  window.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncStageLayout)
  window.removeEventListener('keydown', handleKeydown)
  voicePlayer.dispose()
  homeAudioSession.dispose().catch(() => {})
})
</script>

<style scoped>
.immersive-home {
  --archive-cyan: #21b7c5;
  --archive-green: #20bf83;
  --archive-navy: #101b27;
  --archive-ink: #20303d;
  --archive-muted: #91a4b1;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  background-position: center;
  background-size: cover;
  color: #fff;
  --chrome-bg: rgb(14 27 39 / var(--interface-alpha));
  --chrome-ink: #fff;
  --chrome-muted: #91a4b1;
  --chrome-border: rgba(255,255,255,.38);
  --dialogue-bg: rgb(255 255 255 / var(--interface-alpha));
  --dialogue-ink: #20303d;
  --dialogue-muted: #71828c;
  --control-bg: #fff;
  --control-border: #cbd7dc;
}
.immersive-home.theme-day {
  --chrome-bg: rgb(248 252 253 / var(--interface-alpha));
  --chrome-ink: #20303d;
  --chrome-muted: #56707d;
  --chrome-border: rgba(255,255,255,.78);
}
.immersive-home.theme-night {
  --dialogue-bg: rgb(14 27 39 / var(--interface-alpha));
  --dialogue-ink: #f6fafb;
  --dialogue-muted: #a4b5be;
  --control-bg: rgba(255,255,255,.08);
  --control-border: rgba(255,255,255,.28);
}
.immersive-home :deep(.spine-stage-root) { z-index: 1; }
.stage-tap-target {
  position: absolute;
  z-index: 3;
  top: 11%;
  bottom: 0;
  left: 35%;
  width: 38%;
  padding: 0;
  border: 0;
  outline-offset: -4px;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
}
.stage-tap-target:focus-visible { outline: 2px solid rgba(33,183,197,.82); }
.stage-tap-target:disabled { cursor: progress; }
.scene-shade {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(8, 17, 24, .58) 0%, rgba(8, 17, 24, .05) 35%, transparent 66%, rgba(8, 17, 24, .16) 100%);
}
.scene-shade::after { content: ""; position: absolute; inset: 72% 0 0; background: linear-gradient(transparent, rgba(7, 14, 20, .42)); }
.home-masthead { position: absolute; z-index: 4; top: 26px; left: 30px; }
.idol-heading { padding-left: 14px; border-left: 4px solid var(--idol-color); text-shadow: 0 2px 7px rgba(0,0,0,.55); }
.idol-heading span { color: #edf5f7; font-size: .64rem; font-weight: 750; }
.idol-heading h2 { margin: 5px 0 2px; font-size: 1.55rem; line-height: 1.15; letter-spacing: .01em; }
.idol-heading small { color: #d0dce1; font-size: .66rem; }

.home-context {
  position: absolute;
  z-index: 5;
  top: 24px;
  right: 28px;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 44px;
  padding: 4px;
  border: 1px solid var(--chrome-border);
  border-radius: 5px;
  background: var(--chrome-bg);
  color: var(--chrome-ink);
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
}
.home-context > button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; background: transparent; color: currentColor; cursor: pointer; }
.home-context > button:hover { background: rgba(255,255,255,.09); }
.home-context > img {
  width: 32px;
  height: 32px;
  box-sizing: border-box;
  object-fit: contain;
  margin-left: 2px;
  overflow: hidden;
  border: 1px solid #b5c8e5;
  border-radius: 6px;
  background: #e6edfa;
  box-shadow: 0 0 0 1px rgba(230,237,250,.72);
}
.context-select { position: relative; display: flex; align-items: center; min-width: 0; height: 34px; }
.context-select > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.context-select select { height: 34px; padding: 0 26px 0 9px; border: 0; outline: 0; background: transparent; color: currentColor; font: inherit; font-size: .66rem; font-weight: 650; }
.context-select option { color: #182630; }
.context-idol select { width: 116px; }
.context-costume select { width: 144px; }
.context-divider { width: 1px; height: 24px; background: rgba(255,255,255,.2); }
.settings-trigger { width: 34px !important; margin-left: 8px; padding: 0 !important; border: 1px solid rgba(255,255,255,.35) !important; border-radius: 4px; }
.settings-trigger:hover { border-color: var(--archive-cyan) !important; color: #baf8fa; }
.mobile-costume-trigger,
.mobile-idol-switch,
.mobile-settings-trigger,
.costume-picker-scrim,
.mobile-costume-picker { display: none; }

.home-highlight {
  position: absolute;
  z-index: 4;
  top: 86px;
  right: 28px;
  width: min(300px, 29vw);
  overflow: hidden;
  border: 1px solid var(--chrome-border);
  border-radius: 5px;
  background: var(--chrome-bg);
  color: var(--chrome-ink);
  box-shadow: 0 14px 34px rgba(0,0,0,.24);
}
.highlight-main { display: block; width: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.highlight-main img { display: block; width: 100%; aspect-ratio: 940 / 510; object-fit: cover; }
.highlight-copy { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 10px 11px 5px; }
.highlight-copy strong { overflow: hidden; flex: 1; font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
.highlight-copy small { flex: 0 0 auto; color: var(--archive-cyan); font-size: .53rem; }
.highlight-controls { display: flex; align-items: center; justify-content: flex-end; gap: 5px; padding: 2px 7px 7px; color: var(--chrome-muted); font-size: .54rem; }
.highlight-controls button { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 3px; background: rgba(255,255,255,.08); color: #fff; cursor: pointer; }

.home-dialogue {
  position: absolute;
  z-index: 4;
  left: 30px;
  bottom: 30px;
  width: min(420px, 40vw);
  min-height: 154px;
  padding: 28px 22px 16px;
  border: 1px solid rgba(255,255,255,.78);
  border-radius: 5px 16px 16px 16px;
  background: var(--dialogue-bg);
  color: var(--dialogue-ink);
  box-shadow: 0 16px 42px rgba(0,0,0,.22);
}
.home-dialogue::after { content: ""; position: absolute; top: -14px; right: 25px; border-width: 0 0 15px 28px; border-style: solid; border-color: transparent transparent var(--dialogue-bg) transparent; }
.dialogue-name { position: absolute; top: -14px; left: 10px; min-width: 150px; padding: 6px 13px; border-radius: 4px; background: var(--archive-cyan); color: #fff; font-size: .7rem; font-weight: 800; box-shadow: 0 4px 10px rgba(0,0,0,.12); }
.home-dialogue p { min-height: 54px; margin: 0; white-space: pre-line; font-size: .78rem; font-weight: 520; line-height: 1.68; }
.dialogue-meta { display: flex; align-items: center; gap: 8px; min-width: 0; margin-top: 9px; color: var(--dialogue-muted); font-size: .58rem; }
.dialogue-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dialogue-meta code { margin-left: auto; color: #97a2a8; white-space: nowrap; }
.dialogue-actions { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.dialogue-actions button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 1px solid var(--control-border); border-radius: 4px; background: var(--control-bg); color: #19a8b4; cursor: pointer; }
.dialogue-actions button:hover { border-color: var(--archive-cyan); background: #f3fdfe; }
.dialogue-actions > span { margin-left: 5px; color: #788992; font-size: .6rem; }
.voice-error { display: block; margin-top: 5px; color: #a25353; font-size: .58rem; }

.settings-scrim { position: absolute; z-index: 10; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: rgba(4,10,15,.12); cursor: default; }
.scene-settings {
  position: absolute;
  z-index: 11;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  width: min(340px, 100%);
  height: 100%;
  overflow: hidden;
  border-left: 1px solid rgba(33,183,197,.65);
  background: rgba(10,24,35,.97);
  color: #fff;
  box-shadow: -18px 0 45px rgba(0,0,0,.32);
  animation: drawer-in .2s ease-out;
}
@keyframes drawer-in { from { transform: translateX(28px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.scene-settings > header { display: flex; flex: 0 0 auto; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 18px 20px 12px; }
.scene-settings h3 { margin: 0; font-size: 1.02rem; }
.scene-settings header p { margin: 5px 0 0; color: #a8b8c1; font-size: .61rem; }
.scene-settings header button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; background: transparent; color: #fff; cursor: pointer; }
.settings-body { display: flex; flex: 1; flex-direction: column; gap: 13px; min-height: 0; padding: 5px 20px 12px; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.settings-field, .settings-range { display: flex; flex-direction: column; gap: 7px; color: #d9e3e7; font-size: .65rem; }
.settings-field select { width: 100%; height: 36px; padding: 0 34px 0 11px; border: 1px solid #647782; border-radius: 4px; outline: 0; background: #0f202d; color: #fff; font: inherit; font-size: .66rem; }
.settings-field select:focus { border-color: var(--archive-cyan); box-shadow: 0 0 0 2px rgba(33,183,197,.13); }
.settings-segment { display: grid; grid-template-columns: 1fr 1fr; margin: 0; padding: 0; border: 1px solid #536773; border-radius: 4px; }
.settings-segment legend { margin-bottom: 7px; padding: 0; color: #d9e3e7; font-size: .65rem; }
.settings-segment button { height: 34px; border: 0; background: transparent; color: #b9c7ce; font: inherit; font-size: .65rem; cursor: pointer; }
.settings-segment button.active { margin: 3px; height: 28px; border-radius: 3px; background: #138ba2; color: #fff; }
.settings-toggle { display: grid; grid-template-columns: minmax(0, 1fr) 40px; align-items: center; gap: 12px; min-height: 30px; color: #e2e9ec; font-size: .67rem; cursor: pointer; }
.settings-toggle span { display: flex; flex-direction: column; gap: 3px; }
.settings-toggle small { color: #8da0aa; font-size: .54rem; line-height: 1.45; }
.settings-toggle input { position: absolute; opacity: 0; pointer-events: none; }
.settings-toggle i { position: relative; width: 38px; height: 22px; border-radius: 12px; background: #43545f; transition: background .16s ease; }
.settings-toggle i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .16s ease; }
.settings-toggle input:checked + i { background: var(--archive-green); }
.settings-toggle input:checked + i::after { transform: translateX(16px); }
.settings-toggle input:focus-visible + i { outline: 2px solid var(--archive-cyan); outline-offset: 2px; }
.settings-range > div { display: grid; grid-template-columns: minmax(0, 1fr) 42px; align-items: center; gap: 10px; }
.settings-range input { width: 100%; accent-color: var(--archive-cyan); }
.settings-range output { color: #fff; font-size: .68rem; text-align: right; }
.scene-settings > footer { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px 16px; border-top: 1px solid rgba(255,255,255,.08); background: #0a1823; }
.scene-settings footer button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 38px; border-radius: 4px; font: inherit; font-size: .65rem; cursor: pointer; }
.settings-reset { padding: 0; border: 0; background: transparent; color: #d5e0e4; }
.settings-done { min-width: 116px; padding: 0 18px; border: 1px solid #29c5d0; background: #14aebe; color: #fff; }

@media (max-width: 980px) {
  .context-idol select { width: 96px; }
  .context-costume select { width: 115px; }
  .home-highlight { width: 250px; }
  .home-dialogue { width: min(390px, 45vw); }
}

@media (max-width: 760px) {
  .immersive-home { min-height: 0; }
  .home-masthead { top: 16px; left: 14px; }
  .idol-heading h2 { font-size: 1.18rem; }
  .home-context { top: 16px; right: 12px; }
  .context-costume, .context-divider { display: none; }
  .settings-trigger { margin-left: 4px; }
  .home-highlight { top: 76px; right: 12px; width: 190px; }
  .highlight-copy { padding: 6px 7px 3px; }
  .highlight-copy strong { font-size: .57rem; }
  .highlight-copy small { display: none; }
  .home-dialogue { left: 14px; bottom: 14px; width: min(365px, calc(100vw - 28px)); min-height: 138px; padding: 24px 16px 12px; }
}

@media (max-width: 560px) {
  .scene-shade { background: linear-gradient(180deg, rgba(8,17,24,.42), transparent 34%, transparent 58%, rgba(7,14,20,.38)); }
  .home-masthead { max-width: calc(100% - 82px); }
  .idol-heading span, .idol-heading h2, .idol-heading small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .home-context { display: none; }
  .mobile-idol-switch,
  .mobile-settings-trigger,
  .mobile-costume-trigger {
    position: absolute;
    z-index: 6;
    right: 12px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--chrome-border);
    border-radius: 5px;
    background: var(--chrome-bg);
    color: var(--chrome-ink);
    box-shadow: 0 8px 24px rgba(0,0,0,.18);
  }
  .mobile-idol-switch { top: 16px; overflow: hidden; cursor: pointer; }
  .mobile-idol-switch > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .mobile-idol-switch select { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; opacity: 0; cursor: pointer; }
  .mobile-costume-trigger { top: 66px; }
  .mobile-settings-trigger { top: 116px; }
  .mobile-costume-trigger[aria-expanded="true"] { border-color: var(--archive-cyan); color: var(--archive-cyan); }
  .costume-picker-scrim {
    position: absolute;
    z-index: 8;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: rgba(4,10,15,.16);
  }
  .mobile-costume-picker {
    position: absolute;
    z-index: 9;
    top: 16px;
    right: 64px;
    display: block;
    width: min(310px, calc(100% - 76px));
    max-height: min(420px, calc(100% - 32px));
    overflow: hidden;
    border: 1px solid rgba(33,183,197,.58);
    border-radius: 8px;
    background: rgba(10,24,35,.97);
    color: #fff;
    box-shadow: 0 18px 42px rgba(0,0,0,.34);
  }
  .mobile-costume-picker > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 14px 10px; border-bottom: 1px solid rgba(255,255,255,.09); }
  .mobile-costume-picker header div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .mobile-costume-picker header span { color: #95aab4; font-size: .54rem; }
  .mobile-costume-picker header strong { overflow: hidden; font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }
  .mobile-costume-picker header button { display: grid; flex: 0 0 auto; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; background: transparent; color: #fff; }
  .costume-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 342px; padding: 10px 12px 13px; overflow-y: auto; overscroll-behavior: contain; }
  .costume-grid > button { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 8px; min-height: 50px; padding: 7px; border: 1px solid #455c69; border-radius: 5px; background: #0f202d; color: #dce7eb; text-align: left; }
  .costume-grid > button > span { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 4px; background: rgba(255,255,255,.07); color: #72d8de; }
  .costume-grid small { overflow: hidden; font-size: .58rem; line-height: 1.35; text-overflow: ellipsis; }
  .costume-grid > button.active { border-color: var(--archive-cyan); background: rgba(19,139,162,.24); color: #fff; }
  .costume-grid > button.active > span { background: #138ba2; color: #fff; }
  .home-highlight { display: none; }
  .home-dialogue { right: 12px; left: 12px; bottom: 12px; width: auto; min-height: 132px; }
  .home-dialogue p { min-height: 48px; font-size: .72rem; line-height: 1.58; }
  .dialogue-meta code { display: none; }
  .scene-settings { width: 100%; }
  .settings-costume-field { display: none; }
  .stage-tap-target { top: 12%; left: 20%; width: 60%; }
}

@media (max-width: 380px) {
  .home-masthead { max-width: calc(100% - 80px); }
  .idol-heading small { display: none; }
  .idol-heading h2 { font-size: 1.02rem; }
  .mobile-idol-switch, .mobile-settings-trigger, .mobile-costume-trigger { right: 10px; }
  .mobile-costume-picker { right: 62px; width: calc(100% - 74px); }
}

@media (prefers-reduced-motion: reduce) {
  .scene-settings { animation: none; }
}
</style>
