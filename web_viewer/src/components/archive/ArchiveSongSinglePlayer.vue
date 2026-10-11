<template>
  <section class="song-block single-song-player" aria-labelledby="song-single-player-title" :data-clock-phase="clockSnapshot.phase">
    <div class="song-block-heading">
      <h3 id="song-single-player-title">歌曲播放</h3>
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
      <details><summary>音量</summary><label>音量 <input type="range" min="0" max="1" step="0.01" :value="volume" @input="volume = Number($event.target.value); audioElement.volume = volume * masterVolume" /></label></details>
    </ArchiveMediaTransport>
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
import { onBeforeUnmount, ref, watch } from 'vue'
import ArchiveErrorNote from './ArchiveErrorNote.vue'
import { createMediaElementClock } from '../../utils/mediaElementClock.js'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'

const props = defineProps({
  song: { type: Object, required: true },
  track: { type: Object, required: true },
})

const volume = ref(1)
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
watch(audioElement, element => { clock.bind(element); if(element) element.volume = volume.value * masterVolume }, { immediate: true })
onBeforeUnmount(() => { audioElement.value?.pause(); clock.dispose() })

watch(() => props.track, () => { audioError.value = '' })
</script>

<style scoped>
.single-song-player audio { display: none; }
.single-song-player :deep(details) summary { display: flex; align-items: center; min-height: var(--gs-control-touch); color: var(--gs-ink-2); font-size: var(--gs-text-ui); cursor: pointer; }
.single-song-player :deep(details) input { accent-color: var(--gs-mint-ink); }
.single-song-error { margin: var(--gs-space-3) 0 0; color: var(--gs-critical); font-size: var(--gs-text-ui); }
</style>
