<template>
  <details class="song-lyrics" @toggle="expanded = $event.target.open">
    <summary>歌词资料 <span>演出脚本 · 时间未校对</span></summary>
    <div v-if="expanded" class="song-lyrics-body">
      <p class="song-lyrics-note">以下为演出脚本收录的歌词文本。尚未核对它与本页音源的时间偏移，暂不自动跟随播放或点行跳转。</p>
      <p v-if="loading" role="status">正在读取歌词资料…</p>
      <p v-else-if="error" class="song-lyrics-error" role="alert">{{ error }} <button type="button" @click="load">重试</button></p>
      <p v-else-if="!timeline || !lines.length">这首歌暂无可展示的演出脚本歌词。</p>
      <ol v-else class="song-lyrics-list" aria-label="演出脚本歌词">
        <li v-for="line in lines" :key="line.index">{{ line.text }}</li>
      </ol>
    </div>
  </details>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { fetchSongBaseTimeline } from '../../utils/songPerformanceData.js'

const props = defineProps({ songCode: { type: String, required: true } })
const expanded = ref(false)
const timeline = ref(null)
const loading = ref(false)
const error = ref('')
let generation = 0
const lines = computed(() => (timeline.value?.lyricEvents || [])
  .map((event, index) => ({ index, text: event.text?.trim() || '' }))
  .filter(line => line.text))

async function load() {
  const current = ++generation
  timeline.value = null
  error.value = ''
  loading.value = true
  try {
    const next = await fetchSongBaseTimeline(props.songCode)
    if (current === generation) timeline.value = next
  } catch {
    if (current === generation) error.value = '歌词资料暂时无法读取。'
  } finally {
    if (current === generation) loading.value = false
  }
}

watch([expanded, () => props.songCode], ([isExpanded]) => {
  ++generation
  if (isExpanded) load()
  else { timeline.value = null; loading.value = false; error.value = '' }
})
</script>

<style scoped>
.song-lyrics { margin-top: 14px; border: 1px solid #dce8ec; border-radius: 8px; background: #fff; }
.song-lyrics summary { min-height: 44px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 12px; color: #265a64; font-size: .84rem; font-weight: 700; cursor: pointer; }
.song-lyrics summary::before { content: '▸'; display: inline-block; transition: transform .15s ease; }
.song-lyrics[open] summary::before { transform: rotate(90deg); }
.song-lyrics summary span { color: #71858c; font-size: .65rem; font-weight: 500; }
.song-lyrics summary:focus-visible, .song-lyrics button:focus-visible { outline: 3px solid #37a9a1; outline-offset: 2px; }
.song-lyrics-body { padding: 0 12px 14px; color: #485e66; font-size: .86rem; line-height: 1.7; }
.song-lyrics-note { margin: 0 0 12px; }
.song-lyrics-error { color: #a04747; }
.song-lyrics-error button { min-height: 44px; border: 0; background: none; color: #176f69; font: inherit; text-decoration: underline; cursor: pointer; }
.song-lyrics-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.song-lyrics-list li { padding: 10px 12px; border-left: 2px solid #c7e5e2; background: #f6faf9; white-space: pre-wrap; overflow-wrap: break-word; }
@media (prefers-reduced-motion: reduce) { .song-lyrics summary::before { transition: none; } }
</style>
