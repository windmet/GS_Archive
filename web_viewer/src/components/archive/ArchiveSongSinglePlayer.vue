<template>
  <section class="song-block single-song-player" aria-labelledby="song-single-player-title">
    <div class="song-block-heading">
      <span>FULL MIX</span>
      <h3 id="song-single-player-title">歌曲播放</h3>
    </div>
    <p class="song-block-note">完整混音试听</p>
    <audio
      controls
      preload="metadata"
      :src="track.url"
      :aria-label="`${song.title} 完整混音`"
      @error="audioError = '暂时无法播放，请稍后重试。'"
    />
    <p class="song-block-note">时长 {{ formatDuration(track.source?.duration_seconds) }}</p>
    <p v-if="audioError" class="single-song-error" role="alert">{{ audioError }}</p>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  song: { type: Object, required: true },
  track: { type: Object, required: true },
})

const audioError = ref('')

function formatDuration(value) {
  const seconds = Math.max(0, Math.round(Number(value) || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

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
