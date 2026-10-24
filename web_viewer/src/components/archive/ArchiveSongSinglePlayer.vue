<template>
  <section class="song-block single-song-player" aria-labelledby="song-single-player-title" :data-clock-phase="clockSnapshot.phase">
    <div class="song-block-heading">
      <h3 id="song-single-player-title">歌曲播放</h3>
      <slot name="header-action" />
    </div>
    <p class="song-block-note">完整混音试听</p>
    <audio
      ref="audioElement"
      preload="metadata"
      :src="track.url"
      :aria-label="`${song.title} 完整混音`"
      @error="audioError = '暂时无法播放，请稍后重试。'"
    />
    <ArchiveMediaTransport music :playing="['playing', 'waiting'].includes(clockSnapshot.phase)" :duration="clockSnapshot.duration" :current-time="clockSnapshot.currentTime" @toggle="togglePlayback" @restart="clock.seek(0)" @seek="clock.seek">
      <details><summary>音量</summary><label>音量 <input type="range" min="0" max="1" step="0.01" :value="volume" @input="volume = Number($event.target.value); audioElement.volume = volume * masterVolume; centerLine.setVolume(volume * masterVolume)" /></label></details>
    </ArchiveMediaTransport>
    <!-- Unit_serif: the mix leaves one line silent; the game plays the deck center card's take there. -->
    <div v-if="songCenterLine && centerLineAvailable" class="center-line-slot">
      <label><span>Center 台词</span><select v-model="centerLineSelection" aria-label="Center 台词音轨"><option :value="ONESHOT_CENTER">原曲演唱位 1 · {{ defaultCenterName || '未收录' }}</option><option v-for="entry in songCenterLine.idols" :key="entry.id" :value="entry.id">{{ entry.displayName }}</option><option :value="ONESHOT_OFF">关闭 · 保留原曲留白</option></select></label>
      <p class="song-block-note">{{ centerLineTimes }} 原曲在此留白，游戏播放编成 Center 卡偶像的台词；这里可任选 {{ songCenterLine.idols.length }} 人试听。</p>
    </div>
    <p v-if="clockSnapshot.phase === 'waiting'" class="song-block-note" role="status">正在缓冲音频…</p>
    <ArchiveErrorNote v-if="audioError" class="single-song-error">{{ audioError }}</ArchiveErrorNote>
    <ArchiveSongLyrics :song-code="song.id" :audio-url="track.url" :current-time="clockSnapshot.currentTime"
      :ready="clockSnapshot.duration > 0 && clockSnapshot.phase !== 'error'" @seek="clock.seek" />
  </section>
</template>

<script setup>
import { PlayerPreferencesRepository } from '../../core/story-runtime/PlayerPreferencesRepository.js'
const masterVolume = new PlayerPreferencesRepository().load().volumes.master
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ArchiveErrorNote from './ArchiveErrorNote.vue'
import { createMediaElementClock } from '../../utils/mediaElementClock.js'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'
import { ONESHOT_CENTER, ONESHOT_OFF, useStageOneshotVoice } from '../../composables/useStageOneshotVoice.js'
import { resolveSongCenterLine } from '../../presentation/SongPresentation.js'

const props = defineProps({
  song: { type: Object, required: true },
  track: { type: Object, required: true },
})

const volume = ref(1)
const songCenterLine = computed(() => resolveSongCenterLine(props.song))
const centerLine = useStageOneshotVoice({
  songCode: computed(() => songCenterLine.value ? props.song.id : ''),
  centerIdolCode: computed(() => songCenterLine.value?.defaultIdolCode || ''),
  playbackRate: ref(1),
})
centerLine.setVolume(masterVolume)
const centerLineSelection = centerLine.selection
const centerLineAvailable = centerLine.available
const defaultCenterName = computed(() => songCenterLine.value?.idols.find(entry => entry.id === songCenterLine.value.defaultIdolCode)?.displayName || '')
const centerLineTimes = computed(() => centerLine.triggers.value.map(trigger => {
  const seconds = Math.floor(trigger.time_ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}).join('、'))
// The media clock publishes at timeupdate cadence; the line is driven per frame from the element itself.
let centerLineFrame = 0
function driveCenterLine() {
  const el = audioElement.value
  if (!el || el.paused) { centerLineFrame = 0; return }
  centerLine.update(el.currentTime * 1000)
  centerLineFrame = requestAnimationFrame(driveCenterLine)
}
function bindCenterLine(element) {
  if (!element) return
  element.addEventListener('playing', () => {
    centerLine.start(element.currentTime * 1000)
    if (!centerLineFrame) centerLineFrame = requestAnimationFrame(driveCenterLine)
  })
  element.addEventListener('pause', () => centerLine.stop())
  element.addEventListener('seeking', () => centerLine.stop())
  element.addEventListener('seeked', () => { if (!element.paused) centerLine.start(element.currentTime * 1000) })
}
const emit = defineEmits(['request-play'])
defineExpose({ pause: () => audioElement.value?.pause() })
async function togglePlayback() {
  const el = audioElement.value
  if (!el) return
  if (!el.paused) { el.pause(); return }
  emit('request-play')
  if (el.error) el.load()
  audioError.value = ''
  try { await el.play() } catch (error) { if (error.name !== 'AbortError') audioError.value = '暂时无法播放，请重试。' }
}
const audioError = ref('')
const audioElement = ref(null)
const clockSnapshot = ref({ phase: 'idle', currentTime: 0, duration: null, playbackRate: 1, errorCode: null })
const clock = createMediaElementClock(snapshot => { clockSnapshot.value = snapshot })
watch(audioElement, element => { clock.bind(element); bindCenterLine(element); if(element) element.volume = volume.value * masterVolume }, { immediate: true })
onBeforeUnmount(() => { audioElement.value?.pause(); clock.dispose(); cancelAnimationFrame(centerLineFrame); centerLine.release() })

watch(() => props.track, () => { audioError.value = '' })
</script>

<style scoped>
.single-song-player audio { display: none; }
.single-song-player :deep(details) summary { display: flex; align-items: center; min-height: var(--gs-control-touch); color: var(--gs-ink-2); font-size: var(--gs-text-ui); cursor: pointer; }
.single-song-player :deep(details) input { accent-color: var(--gs-mint-ink); }
.center-line-slot { display: grid; gap: var(--gs-space-2); margin-top: var(--gs-space-3); }
.center-line-slot label { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--gs-space-3); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.center-line-slot select { min-width: 0; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; }
.single-song-player .center-line-slot .song-block-note { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.5; }
.single-song-error { margin: var(--gs-space-3) 0 0; color: var(--gs-critical); font-size: var(--gs-text-ui); }
.song-block-heading { display: flex; gap: var(--gs-space-3); align-items: center; }
</style>
