<template>
  <section v-if="audioExperiment" class="song-block experimental-player" aria-labelledby="song-experimental-player-title">
    <div class="song-block-heading"><h3 id="song-experimental-player-title">演唱试听</h3><small>分轨混音 · 实验</small></div>
    <p class="song-block-note">分轨试听与原游戏混音可能不同。</p>
    <div class="song-modes" role="group" aria-label="试听模式" data-vocal-setting-selector>
      <button v-for="item in listeningModes" :key="item.id" type="button" :aria-pressed="mode === item.id" @click="mode = item.id">{{ item.label }}</button>
    </div>
    <button v-if="hasVocalSetting('center') && soloEntries.length" class="solo-open" type="button" @click="soloOpen = true">{{ mode === 'solo' ? `当前 Solo · ${currentSoloTrack?.displayName || '选择偶像'}` : `查看 / 试听 ${soloEntries.length} 位偶像 Solo` }} →</button>
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

      <ArchiveMediaTransport :ready="transportReady" :playing="transportPlaying" :duration="transportDuration" :current-time="transportCurrentTime" @toggle="togglePlayback" @restart="resetPlayback" @seek="seekPlayback({ target: { value: $event } })" />

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
    <ArchiveTechnicalDetails v-if="mode !== 'lineup'" label="试听技术信息">
      <p class="experimental-evidence">
        对齐证据：{{ syncLabel }}。{{ playbackEvidence }}
      </p>
    </ArchiveTechnicalDetails>
    <p v-if="audioError" class="experimental-error" role="alert">{{ audioError }}</p>
    <ArchiveTerminalDialog class="solo-drawer" :open="soloOpen" title="Solo 声部试听" :title-id="soloTitleId" @close="soloOpen = false">
      <div class="solo-filters">
        <label>查找偶像<input v-model="soloQuery" type="search" placeholder="输入姓名或组合" /></label>
        <label>组合<select v-model="soloUnit"><option value="">全部组合</option><option v-for="unit in soloUnits" :key="unit.id" :value="unit.id">{{ unit.name }}</option></select></label>
      </div>
      <p role="status">{{ filteredSoloEntries.length }} 位偶像 · 选择后回到播放条</p>
      <div class="solo-list"><button v-for="entry in filteredSoloEntries" :key="entry.idol_code" type="button" :aria-pressed="mode === 'solo' && selectedIdolCode === entry.idol_code" @click="selectSolo(entry.idol_code)"><strong>{{ entry.displayName }}</strong><small>{{ soloDirectory.get(entry.idol_code)?.unitName }}</small></button></div>
      <p v-if="!filteredSoloEntries.length">没有匹配的偶像，请调整搜索或组合。</p>
    </ArchiveTerminalDialog>
  </section>
</template>

<script setup>
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import '../../styles/archive-terminal.css'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useSongPerformanceSession } from '../../composables/useSongPerformanceSession.js'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import ArchiveSongLineupPlayer from './ArchiveSongLineupPlayer.vue'

const props = defineProps({
  song: { type: Object, required: true },
  audioExperiment: { type: Object, default: null },
  idolDirectory: { type: Array, default: () => [] },
})
const emit = defineEmits(['open-stage', 'request-play'])
const lineupPlayer = ref(null)
defineExpose({ pause: () => { singleAudio.value?.pause(); isPlaying.value = false; soloSession.pause(); lineupPlayer.value?.pause() } })

const mode = ref('single')
const soloOpen = ref(false), soloQuery = ref(''), soloUnit = ref('')
const soloTitleId = useId()
const soloDirectory = computed(() => new Map(props.idolDirectory.map(idol => [idol.id, idol])))
const soloUnits = computed(() => [...new Map(soloEntries.value.map(entry => {
  const idol = soloDirectory.value.get(entry.idol_code)
  return [idol?.unitCode, { id: idol?.unitCode, name: idol?.unitName }]
}).filter(([id]) => id)).values()])
const filteredSoloEntries = computed(() => soloEntries.value.filter(entry => {
  const idol = soloDirectory.value.get(entry.idol_code)
  return (!soloUnit.value || idol?.unitCode === soloUnit.value) &&
    (!soloQuery.value.trim() || `${entry.displayName} ${idol?.kana || ''} ${idol?.unitName || ''}`.toLowerCase().includes(soloQuery.value.trim().toLowerCase()))
}))
const listeningModes = computed(() => [
  ...(hasVocalSetting('all_stars') ? [{ id: 'all_stars', label: '全员合唱' }] : []),
  ...(hasVocalSetting('unit') ? [{ id: 'unit', label: '组合预设' }] : []),
  ...(hasVocalSetting('formation') ? [{ id: 'lineup', label: '自由编成 · 5 槽' }] : []),
  ...(auditedOptions.value.length ? [{ id: 'single', label: '收录音轨' }] : []),
])
function selectSolo(id) { selectedIdolCode.value = id; mode.value = 'solo'; soloOpen.value = false }
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
    audioError.value = `浏览器拒绝播放：${error.message || error}`
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
.experimental-player { border-color: #92d8d2; background: #fbfffe; }
.experimental-controls { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
.experimental-controls label, .experimental-mix-controls label { display: grid; gap: 5px; color: #5c6771; font-size: 0.72rem; font-weight: 700; }
.experimental-controls select { min-width: 190px; padding: 7px 9px; border: 1px solid #c9d8d8; border-radius: 5px; background: #fff; color: #26313a; font: inherit; }
.experimental-player-panel { margin-top: 14px; padding: 12px; border: 1px solid #d7e9e7; border-radius: 6px; background: #f3fbfa; }
.experimental-player-panel audio { display: none; }
.experimental-transport { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.experimental-play, .experimental-reset { padding: 7px 12px; border: 0; border-radius: 5px; cursor: pointer; font: inherit; font-size: 0.72rem; }
.experimental-play { background: #158f87; color: #fff; }
.experimental-reset { background: #dceeed; color: #316a67; }
.experimental-seek { flex: 1 1 180px; min-width: 120px; accent-color: #158f87; }
.experimental-time { min-width: 92px; color: #5c6771; font-variant-numeric: tabular-nums; font-size: 0.7rem; text-align: right; }
.experimental-mix-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 12px; }
.experimental-mix-controls input { accent-color: #158f87; }
.experimental-evidence { margin: 10px 0 0; color: #63736f; font-size: 0.7rem; line-height: 1.6; }
.experimental-error { margin: 8px 0 0; color: #a04747; font-size: 0.72rem; }
@media (max-width: 560px) {
  .experimental-controls { display: grid; grid-template-columns: 1fr; }
  .experimental-controls select { width: 100%; }
  .experimental-mix-controls { grid-template-columns: 1fr; }
  .experimental-time { width: 100%; text-align: left; }
}
</style>

<style scoped>
.song-block-heading { display: flex; gap: 8px; align-items: center; }
.song-block-heading small { font-size: 11px; padding: 3px 6px; border-radius: 4px; color: #60717d; background: #eef4f7; }
.song-modes { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px; background: #eef5f5; border-radius: 8px; }
.song-modes button, .solo-open { min-height: 44px; padding: 8px 12px; border: 1px solid #c7dcdf; border-radius: 6px; background: white; color: #245a64; font: inherit; font-size: 12px; cursor: pointer; }
.song-modes button { flex: 1; } .song-modes button[aria-pressed=true] { background: #176f69; color: white; border-color: #176f69; }
.solo-open { width: 100%; margin-top: 12px; text-align: left; }
summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: #245a64; font-size: 13px; }
button:focus-visible { outline: 3px solid #007caa; outline-offset: 2px; }
.solo-drawer { position: fixed; inset: 0 0 0 auto; margin: 0; box-sizing: border-box; width: min(480px,100vw); max-width: 100vw; height: 100dvh; max-height: 100dvh; border: 0; border-left: 1px solid #bed3db; border-radius: 0; padding: 0; color: #254858; background: white; }
.solo-drawer::backdrop { background: #102b3d88; }
.solo-drawer :deep(.terminal-dialog-body) { padding: 18px; }
.solo-filters { display: grid; gap: 12px; }
.solo-filters label { display: grid; gap: 8px; font-size: 13px; }
.solo-filters input, .solo-filters select { width: 100%; min-height: 44px; border: 1px solid #afc8ce; padding: 8px 10px; box-sizing: border-box; border-radius: 6px; font: inherit; background: white; color: #254858; }
.solo-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
.solo-list button { display: grid; gap: 5px; min-height: 64px; border: 1px solid #cbdee4; padding: 10px; border-radius: 6px; text-align: left; color: #254858; background: #f5fafb; font: inherit; font-size: 13px; cursor: pointer; }
.solo-list small { color: #657f8a; } .solo-list button[aria-pressed=true] { border-color: #168f87; background: #e4f7f1; }
@media(max-width:760px) { .solo-drawer { inset: auto 0 0; width: 100vw; height: 85dvh; border-radius: 14px 14px 0 0; } }
</style>
