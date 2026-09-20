<template>
  <div class="archive-voice">
    <audio ref="audio" preload="none" @loadedmetadata="sync" @durationchange="sync" @timeupdate="sync" @play="sync" @pause="sync" @ended="sync" @waiting="loading = true" @playing="loading = false" @error="fail" />
    <ArchiveMediaTransport :label="label" :playing="playing" :loading="loading" :current-time="currentTime" :duration="duration" @toggle="toggle" @restart="seek(0)" @seek="seek" />
    <p v-if="error" role="alert">音频暂时无法播放。<button type="button" @click="toggle">重试</button></p>
  </div>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
const props = defineProps({ src: { type: String, required: true }, label: { type: String, default: '语音播放' } })
const audio = ref(null), playing = ref(false), loading = ref(false), error = ref(false), currentTime = ref(0), duration = ref(null)
let generation = 0
function sync() { const el = audio.value; if (!el) return; playing.value = !el.paused && !el.ended; currentTime.value = el.currentTime || 0; duration.value = Number.isFinite(el.duration) ? el.duration : null; if (el.paused) loading.value = false }
function fail() { error.value = true; loading.value = false; playing.value = false }
async function toggle() {
  const el = audio.value
  if (!el) return
  if (!el.paused) { el.pause(); return }
  const run = ++generation
  if (!el.getAttribute('src') || error.value) { el.src = props.src; el.load() }
  error.value = false; loading.value = true
  try { await el.play(); if (run === generation) { loading.value = false; sync() } }
  catch (e) { if (run === generation && e.name !== 'AbortError') fail() }
}
function seek(value) { if (audio.value && duration.value > 0) audio.value.currentTime = Math.min(duration.value, Math.max(0, value)) }
function reset() { generation++; const el = audio.value; if (el) { el.pause(); el.removeAttribute('src'); el.load() } playing.value = false; loading.value = false; error.value = false; currentTime.value = 0; duration.value = null }
watch(() => props.src, reset)
onBeforeUnmount(reset)
</script>
<style scoped>
.archive-voice { min-width: 0; flex: 1 1 300px; }
p { margin: 0; color: #a04747; font-size: 13px; }
p button { min-height: 44px; border: 0; background: none; color: #176f69; cursor: pointer; }
</style>
