<template>
  <section v-if="audioExperiment" class="song-block experimental-player" aria-labelledby="song-experimental-player-title">
    <div class="song-block-heading"><h3 id="song-experimental-player-title">演唱试听</h3><small v-if="maintainer">分轨混音 · 实验</small></div>
    <p class="song-block-note">分轨试听与原游戏混音可能不同。</p>
    <label class="song-mode-selector" data-vocal-setting-selector>
      <span>试听模式</span>
      <select :value="mode" @change="changeListeningMode">
        <option v-for="item in listeningModes" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select>
    </label>
    <button v-if="mode === 'solo' && hasVocalSetting('center') && soloEntries.length" class="solo-open" type="button" @click="soloOpen = true">{{ mode === 'solo' ? `当前 Solo · ${soloDisplayName(currentSoloTrack) || '选择偶像'}` : `查看 / 试听 ${soloEntries.length} 位偶像 Solo` }} →</button>
    <div class="experimental-controls">
      <label v-if="mode === 'unit'">
        组合
        <select v-model="selectedUnitKey">
          <option v-for="option in unitOptions" :key="option.key" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label v-else-if="mode === 'single'">
        收录音轨
        <select v-model="selectedSingleKey">
          <option v-for="option in auditedOptions" :key="option.key" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>

    <ArchiveSongLineupPlayer
      v-if="mode === 'lineup'"
      ref="lineupPlayer"
      :audio-experiment="audioExperiment"
      :idol-name="idolName"
      @request-play="emit('request-play')"
      @open-stage="emit('open-stage', $event)"
    />

    <div
      v-else
      class="experimental-player-panel"
      :class="{ 'is-solo': mode === 'solo' }"
      :data-vocal-setting="mode"
      :data-solo-ready="mode === 'solo' ? soloSession.ready.value : undefined"
      :data-output-peak="mode === 'solo' ? soloSession.outputPeak.value : undefined"
      :data-solo-clock="mode === 'solo' ? 'audio-context-scheduled' : undefined"
    >
      <audio
        ref="singleAudio"
        v-if="isSingleTrackMode"
        preload="metadata"
        :src="currentSingleTrack?.url || ''"
        :aria-label="`${song.title} ${currentSingleTrack?.label || '单轨'}`"
        @loadedmetadata="updateDuration"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @error="onAudioError"
      />

      <ArchiveMediaTransport music :ready="transportReady" :playing="transportPlaying" :duration="transportDuration" :current-time="transportCurrentTime" @toggle="togglePlayback" @restart="resetPlayback" @seek="seekPlayback({ target: { value: $event } })" />

      <details v-if="mode === 'solo'"><summary>音轨平衡</summary><div class="experimental-mix-controls">
        <label>
          Solo 音量
          <input v-model.number="vocalVolume" type="range" min="0" max="1" step="0.01" aria-label="Solo 音量" />
        </label>
        <label>
          伴奏音量
          <input v-model.number="backingVolume" type="range" min="0" max="1" step="0.01" aria-label="伴奏音量" />
        </label>
      </div></details>
    </div>

    <ArchiveSongLyrics v-if="mode !== 'lineup'" :song-code="song.id"
      :audio-url="isSingleTrackMode ? currentSingleTrack?.url || '' : ''"
      :stage-clock="['solo', 'unit'].includes(mode)" :current-time="transportCurrentTime" :ready="transportReady && transportDuration > 0 && !audioError"
      @seek="seekPlayback({ target: { value: $event } })" />
    <ArchiveTechnicalDetails v-if="maintainer && mode !== 'lineup'" label="试听说明">
      <p class="experimental-evidence">
        音画对齐：{{ syncLabel }}。{{ playbackEvidence }}
      </p>
    </ArchiveTechnicalDetails>
    <p v-if="audioError" class="experimental-error" role="alert">{{ audioError }}</p>
    <ArchiveTerminalDialog class="solo-drawer" :open="soloOpen" title="Solo 声部试听" :title-id="soloTitleId" @close="soloOpen = false">
      <div class="solo-filters">
        <label>查找偶像<input v-model="soloQuery" type="search" placeholder="输入姓名或组合" /></label>
        <label>组合<select v-model="soloUnit"><option value="">全部组合</option><option v-for="unit in soloUnits" :key="unit.id" :value="unit.id">{{ unit.name }}</option></select></label>
      </div>
      <p role="status">{{ filteredSoloEntries.length }} 位偶像 · 选择后回到播放条</p>
      <div class="solo-list"><button v-for="entry in filteredSoloEntries" :key="entry.idol_code" type="button" :aria-pressed="mode === 'solo' && selectedIdolCode === entry.idol_code" @click="selectSolo(entry.idol_code)"><strong>{{ soloDisplayName(entry) }}</strong><small>{{ soloDirectory.get(entry.idol_code)?.unitName }}</small></button></div>
      <p v-if="!filteredSoloEntries.length">没有匹配的偶像，请调整搜索或组合。</p>
    </ArchiveTerminalDialog>
  </section>
</template>

<script setup>
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useSongPerformanceSession } from '../../composables/useSongPerformanceSession.js'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveSongLineupPlayer from './ArchiveSongLineupPlayer.vue'
import { isMaintainerMode } from '../../core/maintainerMode.js'

const props = defineProps({
  song: { type: Object, required: true },
  audioExperiment: { type: Object, default: null },
  idolDirectory: { type: Array, default: () => [] },
  idolName: { type: Function, default: () => '' },
  idolSearch: { type: Function, default: () => '' },
})
const emit = defineEmits(['open-stage', 'request-play'])
const lineupPlayer = ref(null)
// How the audition is decoded and clocked is a maintainer note, not reader copy.
const maintainer = isMaintainerMode()
defineExpose({ pause: () => { singleAudio.value?.pause(); isPlaying.value = false; soloSession.pause(); lineupPlayer.value?.pause() } })

const mode = ref('single')
const soloOpen = ref(false), soloQuery = ref(''), soloUnit = ref('')
const soloTitleId = useId()
const soloDirectory = computed(() => new Map(props.idolDirectory.map(idol => [idol.id, idol])))
function soloDisplayName(entry) { return (entry?.idol_code && props.idolName(entry.idol_code, entry.displayName)) || entry?.displayName || '' }
const soloUnits = computed(() => [...new Map(soloEntries.value.map(entry => {
  const idol = soloDirectory.value.get(entry.idol_code)
  return [idol?.unitCode, { id: idol?.unitCode, name: idol?.unitName }]
}).filter(([id]) => id)).values()])
const filteredSoloEntries = computed(() => soloEntries.value.filter(entry => {
  const idol = soloDirectory.value.get(entry.idol_code)
  return (!soloUnit.value || idol?.unitCode === soloUnit.value) &&
    (!soloQuery.value.trim() || [props.idolSearch(entry.idol_code, entry.displayName), soloDisplayName(entry), entry.displayName, idol?.kana || '', idol?.unitName || ''].join(' ').toLowerCase().includes(soloQuery.value.trim().toLowerCase()))
}))
const listeningModes = computed(() => [
  ...(hasVocalSetting('all_stars') ? [{ id: 'all_stars', label: '全员合唱' }] : []),
  ...(hasVocalSetting('unit') ? [{ id: 'unit', label: '组合预设' }] : []),
  ...(hasVocalSetting('formation') ? [{ id: 'lineup', label: '自由编成 · 5 槽' }] : []),
  ...(hasVocalSetting('center') && soloEntries.value.length ? [{ id: 'solo', label: 'Solo 试听' }] : []),
  ...(auditedOptions.value.length ? [{ id: 'single', label: '收录音轨' }] : []),
])
function changeListeningMode(event) {
  const selector = event.target
  const requestedMode = selector.value
  if (!listeningModes.value.some(item => item.id === requestedMode)) {
    selector.value = mode.value
    return
  }
  if (requestedMode === 'solo') {
    // A Solo request opens the picker; the active mode changes only on selection.
    selector.value = mode.value
    selector.focus({ preventScroll: true })
    soloOpen.value = true
    return
  }
  mode.value = requestedMode
}
function selectSolo(id) {
  if (!hasVocalSetting('center') || !props.audioExperiment?.solo_tracks?.[id]) return
  selectedIdolCode.value = id
  mode.value = 'solo'
  soloOpen.value = false
}
const selectedSingleKey = ref('full_mix')
const selectedIdolCode = ref('')
const singleAudio = ref(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const audioError = ref('')
const soloSession = useSongPerformanceSession()
const vocalVolume = soloSession.vocalGain
const backingVolume = soloSession.backingGain
const vocalSettingModes = computed(() => props.audioExperiment?.vocal_settings?.modes || [])
const selectedUnitKey = ref('')

function hasVocalSetting(id) {
  return vocalSettingModes.value.some(entry => entry.id === id)
}

const soloEntries = computed(() => Object.values(props.audioExperiment?.solo_tracks || {}))
const currentSoloTrack = computed(() => props.audioExperiment?.solo_tracks?.[selectedIdolCode.value] || null)
const unitOptions = computed(() => (props.audioExperiment?.unit_tracks || []).map(track => ({
  key: `unit:${track.unit_code}`,
  ...track,
  label: track.label,
})))
const auditedOptions = computed(() => {
  const experiment = props.audioExperiment || {}
  const options = []
  if (experiment.single_tracks?.full_mix && !hasVocalSetting('all_stars')) options.push({
    key: 'full_mix',
    ...experiment.single_tracks.full_mix,
    label: experiment.single_tracks.full_mix.label,
  })
  if (experiment.backing) options.push({ key: 'backing', ...experiment.backing, label: '伴奏' })
  for (const track of experiment.special_tracks || []) options.push({
    key: `special:${track.song_code}`,
    ...track,
    label: `特殊版：${track.label}`,
  })
  return options
})
const isSingleTrackMode = computed(() => ['all_stars', 'unit', 'single'].includes(mode.value))
const currentSingleTrack = computed(() => {
  if (mode.value === 'all_stars') return props.audioExperiment?.single_tracks?.full_mix || null
  if (mode.value === 'unit') {
    return unitOptions.value.find(option => option.key === selectedUnitKey.value) || unitOptions.value[0] || null
  }
  return auditedOptions.value.find(option => option.key === selectedSingleKey.value) || auditedOptions.value[0] || null
})
const syncLabel = computed(() => {
  if (mode.value !== 'solo') return '单轨，无需双轨同步'
  const delta = currentSoloTrack.value?.sync?.sample_delta
  if (delta == null) return '未提供双轨元数据'
  return `44.1 kHz，声部与伴奏差 ${delta} sample`
})
const transportCurrentTime = computed(() => mode.value === 'solo' ? soloSession.currentTime.value : currentTime.value)
const transportDuration = computed(() => mode.value === 'solo' ? soloSession.duration.value : duration.value)
const transportPlaying = computed(() => mode.value === 'solo' ? soloSession.playing.value || soloSession.starting.value : isPlaying.value)
const transportReady = computed(() => mode.value === 'solo'
  ? soloSession.ready.value
  : Boolean(currentSingleTrack.value?.url))
const playbackEvidence = computed(() => mode.value === 'solo'
  ? '声部与伴奏已在播放前完整解码，并由同一个 AudioContext 时钟同步启动。混音仍为浏览器实验值。'
  : '单轨不存在跨轨时钟漂移；实验状态仍未完成完整听感校准。')

function audioElements() {
  return isSingleTrackMode.value && singleAudio.value ? [singleAudio.value] : []
}

function updateDuration() {
  const values = audioElements().map(audio => Number(audio.duration)).filter(Number.isFinite)
  duration.value = values.length ? Math.max(...values) : 0
}

function onTimeUpdate() {
  if (singleAudio.value) currentTime.value = singleAudio.value.currentTime
}

async function togglePlayback() {
  if (!transportPlaying.value) emit('request-play')
  audioError.value = ''
  if (mode.value === 'solo') {
    if (soloSession.playing.value || soloSession.starting.value) soloSession.pause()
    else if (!await soloSession.play()) audioError.value = soloSession.error.value
    return
  }
  const elements = audioElements()
  if (!elements.length || elements.some(audio => !audio.src)) {
    audioError.value = '当前试听资源暂时不可用，请稍后重试。'
    return
  }
  if (isPlaying.value) {
    elements.forEach(audio => audio.pause())
    isPlaying.value = false
    return
  }
  try {
    const startAt = currentTime.value
    elements.forEach(audio => { audio.currentTime = startAt })
    await Promise.all(elements.map(audio => audio.play()))
    isPlaying.value = true
  } catch (error) {
    console.warn('[song-audition] play rejected', error)
    audioError.value = '浏览器没有允许播放，请再点一次播放。'
    isPlaying.value = false
  }
}

function resetPlayback() {
  soloSession.reset()
  if (singleAudio.value) {
    singleAudio.value.pause()
    singleAudio.value.currentTime = 0
  }
  isPlaying.value = false
  currentTime.value = 0
}

function seekPlayback(event) {
  const nextTime = Number(event.target.value)
  if (mode.value === 'solo') {
    soloSession.seek(nextTime)
    return
  }
  audioElements().forEach(audio => { audio.currentTime = nextTime })
  currentTime.value = nextTime
}

function onEnded() {
  if (audioElements().every(audio => audio.ended)) isPlaying.value = false
}

function onAudioError() {
  audioError.value = '音轨暂时无法读取，请重新选择或稍后重试。'
}


async function reloadSources() {
  resetPlayback()
  audioError.value = ''
  if (mode.value === 'solo') {
    const experiment = props.audioExperiment
    if (!experiment || !currentSoloTrack.value?.vocal?.url) {
      soloSession.release()
      audioError.value = '当前偶像缺少 Solo 声部或伴奏资源。'
      return
    }
    await soloSession.configure({
      experiment,
      events: [],
      performerLineup: [selectedIdolCode.value],
      continuous: true,
    })
    audioError.value = soloSession.error.value
    return
  }
  soloSession.release()
  await nextTick()
  audioElements().forEach(audio => audio.load())
}

watch([mode, selectedSingleKey, selectedUnitKey, selectedIdolCode], reloadSources)
watch(() => props.audioExperiment, async experiment => {
  selectedIdolCode.value = Object.keys(experiment?.solo_tracks || {})[0] || ''
  selectedUnitKey.value = unitOptions.value[0]?.key || ''
  selectedSingleKey.value = auditedOptions.value[0]?.key || ''
  mode.value = hasVocalSetting('all_stars') ? 'all_stars' : 'single'
  await reloadSources()
}, { immediate: true })

onBeforeUnmount(() => resetPlayback())
</script>

<style scoped>
/* Audition: sits on the paper like every other section; controls are plain archive controls. */
.experimental-controls { display: flex; flex-wrap: wrap; gap: var(--gs-space-4); margin-top: var(--gs-space-4); }
.experimental-controls label, .experimental-mix-controls label { display: grid; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.experimental-controls select { min-width: 190px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.experimental-player-panel { margin-top: var(--gs-space-4); }
.experimental-player-panel audio { display: none; }
.experimental-mix-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-5); margin-top: var(--gs-space-3); }
.experimental-mix-controls input { accent-color: var(--gs-mint-ink); }
.experimental-evidence { margin: var(--gs-space-3) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.6; }
.experimental-error { margin: var(--gs-space-3) 0 0; color: var(--gs-critical); font-size: var(--gs-text-ui); }
.song-block-heading { display: flex; gap: var(--gs-space-3); align-items: baseline; }
.song-block-heading small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.song-mode-selector { display: grid; gap: var(--gs-space-2); min-width: 0; margin-top: var(--gs-space-4); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.song-mode-selector select { width: 100%; min-width: 0; min-height: var(--gs-control-touch); box-sizing: border-box; padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.solo-open { width: 100%; min-height: var(--gs-control-touch); margin-top: var(--gs-space-3); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); text-align: left; cursor: pointer; }
summary { display: flex; align-items: center; min-height: var(--gs-control-touch); color: var(--gs-ink-2); font-size: var(--gs-text-ui); cursor: pointer; }
.experimental-player :is(button, select, input, summary):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* Solo picker: a side drawer on wide screens, an 85dvh bottom sheet on phones. */
.solo-drawer {
  --solo-safe-top: var(--gs-safe-top);
  --solo-safe-right: var(--gs-safe-right);
  --solo-safe-bottom: var(--gs-safe-bottom);
  --solo-safe-left: var(--gs-safe-left);
  --solo-header-safe-top: var(--solo-safe-top);
  --solo-inline-left: max(var(--gs-space-5), var(--solo-safe-left));
  --solo-inline-right: max(var(--gs-space-5), var(--solo-safe-right));
  position: fixed; inset: 0 0 0 auto; margin: 0; box-sizing: border-box;
  width: min(var(--gs-surface-drawer-width), 100vw); max-width: 100vw; height: 100dvh; max-height: 100dvh;
  padding: 0; border: 0; border-radius: 0;
  background: var(--gs-surface); color: var(--gs-ink); font-family: var(--gs-font-body); font-size: var(--gs-text-body);
}
.solo-drawer :deep(.terminal-dialog-header) { min-width: 0; padding: calc(var(--gs-space-4) + var(--solo-header-safe-top)) var(--solo-inline-right) var(--gs-space-4) var(--solo-inline-left); }
.solo-drawer :deep(.terminal-dialog-header h2) { min-width: 0; font-size: var(--gs-text-section); overflow-wrap: anywhere; }
.solo-drawer :deep(.terminal-dialog-body) { min-width: 0; padding: var(--gs-space-5) var(--solo-inline-right) calc(var(--gs-space-5) + var(--solo-safe-bottom)) var(--solo-inline-left); }
.solo-filters { display: grid; gap: var(--gs-space-4); }
.solo-filters label { display: grid; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.solo-filters input, .solo-filters select { width: 100%; min-width: 0; min-height: var(--gs-control-touch); box-sizing: border-box; padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-subtitle); }
.solo-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--gs-space-5); }
.solo-list button { display: grid; gap: var(--gs-space-1); min-width: 0; min-height: 56px; padding: var(--gs-space-3) var(--gs-space-2); border: 0; border-bottom: 1px solid var(--gs-line); border-radius: 0; background: none; color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.solo-list strong { font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.solo-list small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); overflow-wrap: anywhere; }
.solo-list button[aria-pressed=true] { background: var(--gs-mint-wash); box-shadow: inset 2px 0 var(--gs-mint); }
@media (max-width: 760px) {
  /* Only protect the top inset left uncovered by this 85dvh sheet's 15dvh gap. */
  .solo-drawer { --solo-header-safe-top: max(0px, calc(var(--solo-safe-top) - 15dvh)); inset: auto 0 0; width: 100vw; height: 85dvh; border-radius: 0; border-top-left-radius: var(--gs-radius-panel); border-top-right-radius: var(--gs-radius-panel); }
  .experimental-controls { display: grid; grid-template-columns: 1fr; }
  .experimental-controls select { width: 100%; min-height: var(--gs-control-touch); font-size: var(--gs-text-subtitle); }
  .experimental-mix-controls { grid-template-columns: 1fr; }
  .song-mode-selector select { font-size: var(--gs-text-subtitle); }
}
</style>
