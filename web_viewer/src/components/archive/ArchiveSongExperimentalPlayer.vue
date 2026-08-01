<template>
  <section v-if="audioExperiment" class="song-block experimental-player" aria-labelledby="song-experimental-player-title">
    <div class="song-block-heading">
      <span>EXPERIMENTAL PLAYER</span>
      <h3 id="song-experimental-player-title">单轨、Solo 与五槽演唱实验</h3>
    </div>
    <p class="song-block-note">
      这是歌曲详情页的实验播放器，不复用故事播放器。单轨模式播放已有单文件；Solo 模式同步一条个人声部与伴奏；五槽模式按演唱切换表组织自定义编组。
    </p>

    <div class="experimental-controls">
      <label>
        播放模式
        <select v-model="mode">
          <option value="single">单轨模式</option>
          <option value="solo" :disabled="!soloEntries.length">Solo＋伴奏（实验）</option>
          <option value="lineup" :disabled="!audioExperiment?.stage_vocal">五槽演唱编组（实验）</option>
        </select>
      </label>
      <label v-if="mode === 'single'">
        版本
        <select v-model="selectedSingleKey">
          <option v-for="option in singleOptions" :key="option.key" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label v-else-if="mode === 'solo'">
        Solo 偶像
        <select v-model="selectedIdolCode">
          <option v-for="entry in soloEntries" :key="entry.idol_code" :value="entry.idol_code">
            {{ entry.name }}（{{ entry.idol_code }}）
          </option>
        </select>
      </label>
    </div>

    <ArchiveSongLineupPlayer
      v-if="mode === 'lineup'"
      :audio-experiment="audioExperiment"
    />

    <div
      v-else
      class="experimental-player-panel"
      :class="{ 'is-solo': mode === 'solo' }"
      :data-solo-ready="mode === 'solo' ? soloSession.ready.value : undefined"
      :data-solo-clock="mode === 'solo' ? 'audio-context-scheduled' : undefined"
    >
      <audio
        ref="singleAudio"
        v-if="mode === 'single'"
        preload="metadata"
        :src="currentSingleTrack?.url || ''"
        :aria-label="`${song.title} ${currentSingleTrack?.label || '单轨'}`"
        @loadedmetadata="updateDuration"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @error="onAudioError"
      />

      <div class="experimental-transport">
        <button type="button" class="experimental-play" :disabled="!transportReady" @click="togglePlayback">
          {{ transportPlaying ? '暂停' : '播放' }}
        </button>
        <button type="button" class="experimental-reset" :disabled="!transportReady" @click="resetPlayback">归零</button>
        <input
          class="experimental-seek"
          type="range"
          min="0"
          :max="transportDuration || 0"
          step="0.01"
          :value="transportCurrentTime"
          aria-label="播放进度"
          :disabled="!transportReady"
          @input="seekPlayback"
        />
        <span class="experimental-time">{{ formatTime(transportCurrentTime) }} / {{ formatTime(transportDuration) }}</span>
      </div>

      <div v-if="mode === 'solo'" class="experimental-mix-controls">
        <label>
          Solo 音量
          <input v-model.number="vocalVolume" type="range" min="0" max="1" step="0.01" aria-label="Solo 音量" />
        </label>
        <label>
          伴奏音量
          <input v-model.number="backingVolume" type="range" min="0" max="1" step="0.01" aria-label="伴奏音量" />
        </label>
      </div>
    </div>

    <p v-if="mode !== 'lineup'" class="experimental-evidence">
      对齐证据：{{ syncLabel }}。{{ playbackEvidence }}
    </p>
    <p v-if="audioError" class="experimental-error" role="alert">{{ audioError }}</p>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { IDOL_ID_TO_NAME } from '../../utils/IdolNameMap.js'
import { useSongPerformanceSession } from '../../composables/useSongPerformanceSession.js'
import ArchiveSongLineupPlayer from './ArchiveSongLineupPlayer.vue'

const props = defineProps({
  song: { type: Object, required: true },
  audioExperiment: { type: Object, default: null },
})

const mode = ref('single')
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

const soloEntries = computed(() => Object.values(props.audioExperiment?.solo_tracks || {})
  .map(entry => ({ ...entry, name: IDOL_ID_TO_NAME[entry.idol_code] || entry.name || entry.idol_code })))
const currentSoloTrack = computed(() => props.audioExperiment?.solo_tracks?.[selectedIdolCode.value] || null)
const singleOptions = computed(() => {
  const experiment = props.audioExperiment || {}
  const options = []
  if (experiment.single_tracks?.full_mix) options.push({ key: 'full_mix', ...experiment.single_tracks.full_mix })
  if (experiment.backing) options.push({ key: 'backing', ...experiment.backing })
  for (const track of experiment.special_tracks || []) options.push({
    key: `special:${track.song_code}`,
    label: `特殊版：${track.label}`,
    ...track,
  })
  for (const track of experiment.unit_tracks || []) options.push({
    key: `unit:${track.unit_code}`,
    label: `组合版：${track.label}`,
    ...track,
  })
  return options
})
const currentSingleTrack = computed(() => singleOptions.value.find(option => option.key === selectedSingleKey.value) || singleOptions.value[0] || null)
const syncLabel = computed(() => {
  if (mode.value !== 'solo') return '单轨，无需双轨同步'
  const delta = currentSoloTrack.value?.sync?.sample_delta
  if (delta == null) return '未提供双轨元数据'
  return `44.1 kHz，声部与伴奏差 ${delta} sample`
})
const transportCurrentTime = computed(() => mode.value === 'solo' ? soloSession.currentTime.value : currentTime.value)
const transportDuration = computed(() => mode.value === 'solo' ? soloSession.duration.value : duration.value)
const transportPlaying = computed(() => mode.value === 'solo' ? soloSession.playing.value : isPlaying.value)
const transportReady = computed(() => mode.value === 'solo'
  ? soloSession.ready.value
  : Boolean(currentSingleTrack.value?.url))
const playbackEvidence = computed(() => mode.value === 'solo'
  ? '声部与伴奏已在播放前完整解码，并由同一个 AudioContext 时钟同步启动。混音仍为浏览器实验值。'
  : '单轨不存在跨轨时钟漂移；实验状态仍未完成完整听感校准。')

function audioElements() {
  return mode.value === 'single' && singleAudio.value ? [singleAudio.value] : []
}

function updateDuration() {
  const values = audioElements().map(audio => Number(audio.duration)).filter(Number.isFinite)
  duration.value = values.length ? Math.max(...values) : 0
}

function onTimeUpdate() {
  if (singleAudio.value) currentTime.value = singleAudio.value.currentTime
}

async function togglePlayback() {
  audioError.value = ''
  if (mode.value === 'solo') {
    if (soloSession.playing.value) soloSession.pause()
    else if (!await soloSession.play()) audioError.value = soloSession.error.value
    return
  }
  const elements = audioElements()
  if (!elements.length || elements.some(audio => !audio.src)) {
    audioError.value = '实验音频尚未准备，无法播放。'
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
  audioError.value = '实验音频资源不可用；请先运行实验音频准备脚本。'
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
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

watch([mode, selectedSingleKey, selectedIdolCode], reloadSources)
watch(() => props.audioExperiment, async experiment => {
  selectedIdolCode.value = Object.keys(experiment?.solo_tracks || {})[0] || ''
  selectedSingleKey.value = 'full_mix'
  mode.value = 'single'
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
