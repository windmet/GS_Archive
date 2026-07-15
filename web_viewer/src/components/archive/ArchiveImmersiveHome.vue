<template>
  <main
    v-if="activeIdol && activeCue"
    class="immersive-home"
    :data-home-cue="activeCue.cue"
    :data-home-voice="activeCue.voice"
    :data-last-started-voice="lastStartedVoice"
    :style="{ '--idol-color': activeIdol.color, backgroundImage: `url(${getBgUrl(activeCue.background || activeIdol.representativeBg)})` }"
  >
    <SpineStage
      :key="stageLayout"
      ref="spineStageRef"
      :step="activeCue.previewStep"
      :fallback-bg="activeCue.background || activeIdol.representativeBg"
      :debug-controls="false"
      @ready="stageReady = true"
      @error="stageError = true"
    />
    <div class="scene-shade" aria-hidden="true"></div>

    <header class="home-masthead">
      <div class="idol-heading">
        <span>{{ activeIdol.unitName || '315 STARS' }}</span>
        <h2>{{ activeIdol.name }}</h2>
        <small>{{ activeIdol.kana }}</small>
      </div>
      <label class="idol-select">
        <span>首页偶像</span>
        <select v-model="selectedId">
          <option v-for="idol in idols" :key="idol.id" :value="idol.id">
            {{ idol.name }} · {{ idol.unitName }}
          </option>
        </select>
      </label>
    </header>

    <section v-if="activeHighlight" class="home-highlight" aria-label="活动聚焦">
      <button class="highlight-main" type="button" @click="emit('open-event', activeHighlight)">
        <img :src="activeHighlight.bannerUrl" :alt="activeHighlight.title" />
        <span>
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
          <Square v-if="playing" :size="17" fill="currentColor" />
          <Volume2 v-else :size="18" />
        </button>
        <button type="button" aria-label="下一句台词" title="下一句台词" @click="nextCue">
          <RefreshCw :size="17" />
        </button>
        <span>{{ cueIndex + 1 }} / {{ activeIdol.cues.length }}</span>
      </div>
      <small v-if="voiceError" class="voice-error">语音资源暂时不可用</small>
    </section>

    <nav class="home-actions" aria-label="首页资料入口">
      <button type="button" @click="emit('open-story')">
        <BookOpenText :size="21" />
        <span><strong>故事</strong><small>剧情目录</small></span>
      </button>
      <button type="button" @click="emit('open-cards', activeIdol.id)">
        <Images :size="21" />
        <span><strong>卡片</strong><small>{{ activeIdol.name }}</small></span>
      </button>
      <button type="button" @click="emit('open-idol', activeIdol.id)">
        <ContactRound :size="21" />
        <span><strong>偶像</strong><small>个人档案</small></span>
      </button>
      <button type="button" @click="emit('open-chat', activeIdol.id)">
        <MessageSquareText :size="21" />
        <span><strong>互动</strong><small>短信与电话</small></span>
      </button>
    </nav>

    <div class="idol-switcher">
      <button type="button" aria-label="上一位偶像" title="上一位偶像" @click="stepIdol(-1)">
        <ChevronLeft :size="20" />
      </button>
      <img :src="getCharaIconUrl(activeIdol.id)" :alt="activeIdol.name" />
      <div>
        <strong>{{ activeIdol.name }}</strong>
        <small>{{ stageError ? '角色模型不可用' : (stageReady ? '场景已载入' : '正在载入场景') }}</small>
      </div>
      <button type="button" aria-label="下一位偶像" title="下一位偶像" @click="stepIdol(1)">
        <ChevronRight :size="20" />
      </button>
    </div>

    <dl class="home-stats" aria-label="资料库统计">
      <div v-for="stat in stats.slice(0, 4)" :key="stat.label">
        <dt>{{ stat.label }}</dt>
        <dd>{{ formatCount(stat.value) }}</dd>
      </div>
    </dl>
  </main>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Images,
  MessageSquareText,
  RefreshCw,
  Square,
  Volume2,
} from '@lucide/vue'
import { getBgUrl, getCharaIconUrl } from '../../utils/AssetResolver.js'
import { useVoicePlayer } from '../../core/useVoicePlayer.js'

const SpineStage = defineAsyncComponent(() => import('../SpineStage.vue'))

const props = defineProps({
  idols: { type: Array, default: () => [] },
  highlights: { type: Array, default: () => [] },
  stats: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  selectedCue: { type: String, default: '' },
})
const emit = defineEmits(['open-story', 'open-cards', 'open-idol', 'open-chat', 'open-event', 'update:selectedId', 'update:selectedCue'])

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

const activeIdol = computed(() => props.idols.find(idol => idol.id === selectedId.value) || props.idols[0] || null)
const activeCue = computed(() => activeIdol.value?.cues?.find(cue => cue.cue === props.selectedCue) || activeIdol.value?.cues?.[0] || null)
const activeHighlight = computed(() => props.highlights[highlightIndex.value] || props.highlights[0] || null)
const cueIndex = computed(() => Math.max(0, activeIdol.value?.cues?.findIndex(cue => cue.cue === activeCue.value?.cue) || 0))
const currentStep = computed(() => activeCue.value?.previewStep || {})
const compiledData = computed(() => ({ scenario_id: activeCue.value?.scenarioId || '' }))
const voicePlayer = useVoicePlayer({
  spineStageRef,
  currentStep,
  currentStepIndex,
  compiledData,
  isPlaying: playing,
})

watch(() => activeIdol.value?.id, () => {
  stageError.value = false
  stopVoice()
  if (activeCue.value?.cue !== props.selectedCue) emit('update:selectedCue', activeCue.value?.cue || '')
})

watch(activeCue, () => {
  voiceError.value = false
  stopVoice()
})

function stepIdol(direction) {
  if (!props.idols.length) return
  const index = Math.max(0, props.idols.findIndex(idol => idol.id === activeIdol.value?.id))
  selectedId.value = props.idols[(index + direction + props.idols.length) % props.idols.length].id
}

function nextCue() {
  if (!activeIdol.value?.cues?.length) return
  const nextIndex = (cueIndex.value + 1) % activeIdol.value.cues.length
  emit('update:selectedCue', activeIdol.value.cues[nextIndex].cue)
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
  voicePlayer.ensureAudioCtx()
  voicePlayer.resetVoiceDedup()
  const started = await voicePlayer.playVoice()
  if (started) lastStartedVoice.value = activeCue.value?.voice || ''
  voiceError.value = !started
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function syncStageLayout() {
  stageLayout.value = window.innerWidth <= 560 ? 'compact' : 'wide'
}

onMounted(() => window.addEventListener('resize', syncStageLayout))
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncStageLayout)
  voicePlayer.dispose()
})
</script>

<style scoped>
.immersive-home {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  background-position: center;
  background-size: cover;
  color: #fff;
}
.immersive-home :deep(.spine-stage-root) { z-index: 1; }
.scene-shade { position: absolute; z-index: 2; inset: 0; pointer-events: none; background: linear-gradient(90deg, rgba(8, 15, 21, 0.72) 0%, rgba(8, 15, 21, 0.08) 44%, rgba(8, 15, 21, 0.1) 72%, rgba(8, 15, 21, 0.5) 100%); }
.scene-shade::after { content: ""; position: absolute; inset: 55% 0 0; background: linear-gradient(transparent, rgba(7, 12, 17, 0.78)); }
.home-masthead { position: absolute; z-index: 4; top: 24px; left: 28px; right: 28px; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.idol-heading { padding-left: 13px; border-left: 4px solid var(--idol-color); text-shadow: 0 1px 4px rgba(0,0,0,0.45); }
.idol-heading span { color: #d6e2e8; font-size: 0.64rem; font-weight: 750; }
.idol-heading h2 { margin: 4px 0 1px; font-size: 1.45rem; letter-spacing: 0; }
.idol-heading small { color: #b8c6ce; font-size: 0.66rem; }
.idol-select { display: flex; flex-direction: column; gap: 4px; width: min(260px, 32vw); }
.idol-select span { color: #d5dee3; font-size: 0.6rem; text-align: right; }
.idol-select select { width: 100%; height: 36px; padding: 0 30px 0 10px; border: 1px solid rgba(255,255,255,0.42); border-radius: 5px; background: rgba(17,28,36,0.84); color: #fff; font: inherit; font-size: 0.72rem; }
.home-highlight { position: absolute; z-index: 4; top: 88px; right: 28px; width: min(300px, 31vw); background: rgba(15,25,33,0.9); box-shadow: 0 12px 34px rgba(0,0,0,0.25); }
.highlight-main { display: block; width: 100%; padding: 0; border: 0; background: transparent; color: #fff; cursor: pointer; text-align: left; }
.highlight-main img { display: block; width: 100%; aspect-ratio: 940 / 510; object-fit: cover; }
.highlight-main span { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 8px 10px 4px; }
.highlight-main strong { overflow: hidden; flex: 1; font-size: 0.64rem; text-overflow: ellipsis; white-space: nowrap; }
.highlight-main small { flex: 0 0 auto; color: #88d9d3; font-size: 0.53rem; }
.highlight-controls { display: flex; align-items: center; justify-content: flex-end; gap: 5px; padding: 2px 6px 6px; color: #a8b6bf; font-size: 0.54rem; }
.highlight-controls button { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 3px; background: rgba(255,255,255,0.09); color: #fff; cursor: pointer; }
.home-dialogue { position: absolute; z-index: 4; left: 28px; bottom: 106px; width: min(430px, 43vw); min-height: 132px; padding: 21px 22px 15px; border-left: 4px solid var(--idol-color); background: rgba(255,255,255,0.94); color: #26313a; box-shadow: 0 14px 42px rgba(0,0,0,0.24); }
.dialogue-name { position: absolute; top: -24px; left: 0; min-width: 150px; padding: 7px 13px; background: var(--idol-color); color: #fff; font-size: 0.72rem; font-weight: 750; }
.home-dialogue p { min-height: 52px; margin: 0; white-space: pre-line; font-size: 0.78rem; line-height: 1.65; }
.dialogue-meta { display: flex; align-items: center; gap: 8px; min-width: 0; margin-top: 9px; color: #75818a; font-size: 0.59rem; }
.dialogue-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dialogue-meta code { margin-left: auto; color: #929ba1; white-space: nowrap; }
.dialogue-actions { display: flex; align-items: center; gap: 5px; margin-top: 9px; }
.dialogue-actions button, .idol-switcher > button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 1px solid #d6dde1; border-radius: 4px; background: #fff; color: #147f78; cursor: pointer; }
.dialogue-actions > span { margin-left: 4px; color: #89939a; font-size: 0.6rem; }
.voice-error { display: block; margin-top: 5px; color: #a25353; font-size: 0.58rem; }
.home-actions { position: absolute; z-index: 4; right: 28px; bottom: 106px; display: grid; grid-template-columns: repeat(2, minmax(126px, 1fr)); gap: 7px; width: min(310px, 31vw); }
.home-actions button { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 58px; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.46); border-radius: 6px; background: rgba(18,29,37,0.88); color: #fff; cursor: pointer; text-align: left; }
.home-actions button:hover { border-color: var(--idol-color); background: rgba(27,42,52,0.95); }
.home-actions button > svg { flex: 0 0 auto; color: #72d4cc; }
.home-actions span { display: flex; flex-direction: column; min-width: 0; }
.home-actions strong { font-size: 0.75rem; }
.home-actions small { overflow: hidden; margin-top: 2px; color: #9fb0ba; font-size: 0.58rem; text-overflow: ellipsis; white-space: nowrap; }
.idol-switcher { position: absolute; z-index: 4; left: 28px; bottom: 24px; display: grid; grid-template-columns: 32px 44px minmax(120px, 1fr) 32px; align-items: center; gap: 8px; min-width: 270px; padding: 7px; background: rgba(15,25,33,0.88); }
.idol-switcher img { width: 44px; height: 44px; object-fit: contain; background: rgba(255,255,255,0.92); }
.idol-switcher div { display: flex; flex-direction: column; min-width: 0; }
.idol-switcher strong { font-size: 0.7rem; }
.idol-switcher small { margin-top: 2px; color: #a7b6bf; font-size: 0.56rem; }
.idol-switcher > button { border-color: rgba(255,255,255,0.2); background: transparent; color: #fff; }
.home-stats { position: absolute; z-index: 4; right: 28px; bottom: 24px; display: grid; grid-template-columns: repeat(4, minmax(62px, 1fr)); min-width: 310px; margin: 0; padding: 9px 0; background: rgba(15,25,33,0.88); }
.home-stats div { padding: 0 12px; border-left: 1px solid rgba(255,255,255,0.15); }
.home-stats div:first-child { border-left: 0; }
.home-stats dt { color: #9fb0ba; font-size: 0.55rem; }
.home-stats dd { margin: 3px 0 0; font-size: 0.78rem; font-weight: 750; }

@media (max-width: 900px) {
  .home-highlight { width: 250px; }
  .home-dialogue { width: min(420px, 52vw); }
  .home-actions { width: 250px; grid-template-columns: 1fr; }
  .home-actions button { min-height: 46px; }
  .home-stats { display: none; }
}

@media (max-width: 560px) {
  .immersive-home { min-height: 0; }
  .scene-shade { background: linear-gradient(180deg, rgba(8,15,21,0.48), transparent 28%, transparent 52%, rgba(7,12,17,0.84)); }
  .home-masthead { top: 14px; left: 14px; right: 14px; }
  .idol-heading h2 { font-size: 1.12rem; }
  .idol-select { width: 168px; }
  .idol-select span { display: none; }
  .home-highlight { top: 62px; right: 14px; width: 168px; }
  .highlight-main img { display: none; }
  .highlight-main span { padding: 5px 7px 2px; }
  .highlight-main strong { font-size: 0.54rem; }
  .highlight-main small { display: none; }
  .highlight-controls { padding: 1px 4px 4px; }
  .home-dialogue { left: 14px; right: 14px; bottom: 164px; width: auto; min-height: 116px; padding: 18px 16px 11px; }
  .home-dialogue p { min-height: 44px; font-size: 0.72rem; line-height: 1.55; }
  .dialogue-meta { margin-top: 5px; }
  .home-actions { left: 14px; right: 14px; bottom: 78px; grid-template-columns: repeat(4, minmax(0, 1fr)); width: auto; gap: 4px; }
  .home-actions button { flex-direction: column; justify-content: center; gap: 3px; min-height: 66px; padding: 6px 3px; text-align: center; }
  .home-actions small { display: none; }
  .idol-switcher { left: 14px; right: 14px; bottom: 12px; grid-template-columns: 32px 40px minmax(0, 1fr) 32px; min-width: 0; }
  .idol-switcher img { width: 40px; height: 40px; }
}
</style>
