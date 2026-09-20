<template>
  <section class="song-block single-song-player" aria-labelledby="song-single-player-title" :data-clock-phase="clockSnapshot.phase">
    <div class="song-block-heading">
      <span>FULL MIX</span>
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
    <ArchiveMediaTransport :playing="['playing', 'waiting'].includes(clockSnapshot.phase)" :duration="clockSnapshot.duration" :current-time="clockSnapshot.currentTime" @toggle="togglePlayback" @restart="clock.seek(0)" @seek="clock.seek">
      <label>音量 <input type="range" min="0" max="1" step="0.01" :value="volume" @input="volume = Number($event.target.value); audioElement.volume = volume" /></label>
    </ArchiveMediaTransport>
    <p v-if="clockSnapshot.phase === 'waiting'" class="song-block-note" role="status">正在缓冲音频…</p>
    <p v-if="audioError" class="single-song-error" role="alert">{{ audioError }}</p>
    <ArchiveSongLyrics :song-code="song.id" :audio-url="track.url" :current-time="clockSnapshot.currentTime"
      :ready="clockSnapshot.duration > 0 && clockSnapshot.phase !== 'error'" @seek="clock.seek" />
  </section>
</template>

<script setup>
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { createMediaElementClock } from '../../utils/mediaElementClock.js'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'

const props = defineProps({
  song: { type: Object, required: true },
  track: { type: Object, required: true },
})

const volume = ref(1)
async function togglePlayback() {
  const el = audioElement.value
  if (!el) return
  if (!el.paused) { el.pause(); return }
  if (el.error) el.load()
  audioError.value = ''
  try { await el.play() } catch (error) { if (error.name !== 'AbortError') audioError.value = '暂时无法播放，请重试。' }
}
const audioError = ref('')
const audioElement = ref(null)
const clockSnapshot = ref({ phase: 'idle', currentTime: 0, duration: null, playbackRate: 1, errorCode: null })
const clock = createMediaElementClock(snapshot => { clockSnapshot.value = snapshot })
watch(audioElement, element => clock.bind(element), { immediate: true })
onBeforeUnmount(() => { audioElement.value?.pause(); clock.dispose() })

watch(() => props.track, () => { audioError.value = '' })
</script>

<style scoped>
.single-song-player { border-color: #cfdfe7; background: #fbfdff; }
.single-song-player audio { width: 100%; margin-top: 14px; accent-color: #158f87; }
.single-song-evidence { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px 0 0; }
.single-song-evidence div { min-width: 0; padding: 8px 10px; border-radius: 6px; background: #f1f6f9; }
.single-song-evidence dt { color: #71818b; font-size: 0.62rem; font-weight: 800; }
.single-song-evidence dd { min-width: 0; margin: 3px 0 0; color: #344a56; font-size: 0.68rem; overflow-wrap: anywhere; }
.single-song-error { margin: 8px 0 0; color: #a04747; font-size: 0.72rem; }
@media (max-width: 560px) {
  .single-song-evidence { grid-template-columns: 1fr; }
}
</style>
