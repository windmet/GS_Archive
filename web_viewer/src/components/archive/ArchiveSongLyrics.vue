<template>
  <details class="song-lyrics" @toggle="expanded = $event.target.open">
    <summary>歌词 <span>{{ synchronized ? '同步歌词' : '演出脚本' }}</span></summary>
    <div v-if="expanded" class="song-lyrics-body">
      <p v-if="loading" role="status">正在读取歌词…</p>
      <ArchiveErrorNote v-else-if="error" class="song-lyrics-error">{{ error }} <button type="button" @click="load">重试</button></ArchiveErrorNote>
      <p v-else-if="!lines.length">这首歌暂无可展示的演出脚本歌词。</p>
      <template v-else>
        <p v-if="!synchronized" class="song-lyrics-note">歌词仅供阅读。</p>
        <ol class="song-lyrics-list" aria-label="演出脚本歌词">
          <li v-for="line in visibleLines" :key="line.index" :class="{ active: synchronized && activeIndex === line.index }">
            <button v-if="synchronized" type="button" :disabled="!ready"
              :aria-current="activeIndex === line.index ? 'true' : undefined"
              @focus="previewFocusIndex = line.index" @blur="previewFocusIndex = null"
              @click="seek(line)">{{ line.text }}</button>
            <span v-else>{{ line.text }}</span>
          </li>
        </ol>
        <button v-if="lines.length > previewCount" class="lyrics-expand" type="button" :aria-expanded="fullLyrics" @click="fullLyrics = !fullLyrics">{{ fullLyrics ? '收起全文' : '展开完整歌词' }}</button>
      </template>
    </div>
  </details>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ArchiveErrorNote from './ArchiveErrorNote.vue'
import { fetchSongBaseTimeline } from '../../utils/songPerformanceData.js'
import { authoredSongLyrics, activeSongLyric, sharesSongAudio } from '../../utils/songLyrics.js'

const props = defineProps({
  songCode: { type: String, required: true },
  currentTime: { type: Number, default: 0 },
  audioUrl: { type: String, default: '' },
  ready: { type: Boolean, default: false },
  // An existing Chibi performance session already consumes this authored clock.
  stageClock: { type: Boolean, default: false },
  sourceTimeline: { type: Object, default: null },
})
const emit = defineEmits(['seek'])
const expanded = ref(false), fullLyrics = ref(false)
const fetchedTimeline = ref(null)
const timeline = computed(() => props.sourceTimeline || fetchedTimeline.value)
const loading = ref(false)
const error = ref('')
const previewCount = 6
const previewFocusIndex = ref(null)
let generation = 0
const lines = computed(() => authoredSongLyrics(timeline.value, props.songCode))
const synchronized = computed(() => lines.value.length > 0 && (props.stageClock || sharesSongAudio(timeline.value, props.songCode, props.audioUrl)))
const activeIndex = computed(() => props.ready && synchronized.value ? activeSongLyric(lines.value, props.currentTime) : null)
const visibleLines = computed(() => {
  const authored = lines.value
  if (fullLyrics.value || authored.length <= previewCount) return authored
  if (!props.ready || !synchronized.value) return authored.slice(0, previewCount)
  // Keep a focused lyric mounted while playback advances. No page scrolling.
  let anchor = authored.findIndex(line => line.index === (previewFocusIndex.value ?? activeIndex.value))
  if (anchor < 0) {
    // A gap has no current lyric; keep the nearest preceding authored event nearby.
    for (let index = authored.length - 1; index >= 0; index--) {
      if (authored[index].time <= props.currentTime * 1000) { anchor = index; break }
    }
  }
  const start = Math.min(Math.max(0, anchor - 2), authored.length - previewCount)
  return authored.slice(start, start + previewCount)
})

function seek(line) {
  if (props.ready && synchronized.value) emit('seek', Math.max(0, line.time / 1000))
}

async function load() {
  const current = ++generation
  fetchedTimeline.value = null
  error.value = ''
  loading.value = true
  try {
    const next = props.sourceTimeline || await fetchSongBaseTimeline(props.songCode)
    if (current === generation) fetchedTimeline.value = next
  } catch {
    if (current === generation) error.value = '歌词资料暂时无法读取。'
  } finally {
    if (current === generation) loading.value = false
  }
}

watch([expanded, () => props.songCode, () => props.sourceTimeline], ([isExpanded]) => {
  ++generation
  fullLyrics.value = false
  previewFocusIndex.value = null
  if (isExpanded) load()
  else { fetchedTimeline.value = null; loading.value = false; error.value = '' }
})
onBeforeUnmount(() => { ++generation })
</script>

<style scoped>
.song-lyrics { margin-top: var(--gs-space-4); border-top: 1px solid var(--gs-line); border-bottom: 1px solid var(--gs-line); font-family: var(--gs-font-body); }
.song-lyrics summary { min-height: var(--gs-control-touch); display: flex; align-items: center; flex-wrap: wrap; gap: var(--gs-space-3); padding: var(--gs-space-3) 0; color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.song-lyrics summary::before { content: '▸'; display: inline-block; transition: transform .15s ease; }
.song-lyrics[open] summary::before { transform: rotate(90deg); }
.song-lyrics summary span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.song-lyrics summary:focus-visible, .song-lyrics button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.song-lyrics-body { padding: 0 0 var(--gs-space-4); color: var(--gs-ink-2); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); line-height: 1.7; }
.song-lyrics-note { margin: 0 0 var(--gs-space-4); }
.song-lyrics-error { color: var(--gs-critical); }
.song-lyrics-error button { min-height: var(--gs-control-touch); border: 0; background: none; color: var(--gs-mint-ink); font: inherit; text-decoration: underline; cursor: pointer; }
.song-lyrics-list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.song-lyrics-list li { white-space: pre-wrap; overflow-wrap: anywhere; }
.song-lyrics-list button, .song-lyrics-list li > span { display: block; width: 100%; min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; box-sizing: border-box; border: 0; background: none; color: inherit; font: inherit; text-align: left; white-space: pre-wrap; }
.song-lyrics-list button { cursor: pointer; }
.song-lyrics-list button:disabled { cursor: default; }
.song-lyrics-list li.active { color: var(--gs-ink); box-shadow: inset 2px 0 var(--gs-mint); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.lyrics-expand { min-height: var(--gs-control-touch); margin-top: var(--gs-space-3); padding: var(--gs-space-3) 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .song-lyrics summary::before { transition: none; } }
</style>
