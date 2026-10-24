<template>
  <details class="song-lyrics" @toggle="expanded = $event.target.open">
    <summary>
      <span class="lyrics-summary-title">
        <ScrollText class="lyrics-icon" :size="15" aria-hidden="true" />
        歌词
        <span class="lyrics-mode-tag">{{ synchronized ? '同步歌词' : '演出脚本' }}</span>
      </span>
      <button
        v-if="expanded && lines.length > previewCount"
        type="button"
        class="lyrics-toggle-btn lyrics-expand"
        :aria-expanded="fullLyrics"
        @click="toggleFullLyrics"
      >
        {{ fullLyrics ? '收起全文' : '展开全文' }}
      </button>
    </summary>
    <div v-if="expanded" class="song-lyrics-body">
      <p v-if="loading" role="status">正在读取歌词…</p>
      <ArchiveErrorNote v-else-if="error" class="song-lyrics-error">{{ error }} <button type="button" @click="load">重试</button></ArchiveErrorNote>
      <p v-else-if="!lines.length">这首歌暂无可展示的演出脚本歌词。</p>
      <template v-else>
        <p v-if="!synchronized" class="song-lyrics-note">歌词仅供阅读。</p>
        <ol class="song-lyrics-list" :class="{ 'is-preview': !fullLyrics && lines.length > previewCount, 'at-start': isAtStart }" aria-label="演出脚本歌词">
          <li v-for="line in visibleLines" :key="line.index" :class="{ active: synchronized && activeIndex === line.index }">
            <button v-if="synchronized" type="button" :disabled="!ready"
              :aria-current="activeIndex === line.index ? 'true' : undefined"
              @focus="previewFocusIndex = line.index" @blur="previewFocusIndex = null"
              @click="seek(line)">{{ line.text }}</button>
            <span v-else>{{ line.text }}</span>
          </li>
        </ol>
      </template>
    </div>
  </details>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ScrollText } from '@lucide/vue'
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
const isAtStart = computed(() => {
  const authored = lines.value
  const visible = visibleLines.value
  return authored.length > 0 && visible.length > 0 && visible[0].index === authored[0].index
})

function toggleFullLyrics(event) {
  event?.stopPropagation?.()
  event?.preventDefault?.()
  fullLyrics.value = !fullLyrics.value
}

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
.song-lyrics summary { min-height: var(--gs-control-touch); display: flex; align-items: center; gap: var(--gs-space-3); padding: var(--gs-space-3) 0; color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; list-style: none; }
.song-lyrics summary::-webkit-details-marker { display: none; }
.song-lyrics summary::before { content: '▸'; display: inline-block; transition: transform .15s ease; }
.song-lyrics[open] summary::before { transform: rotate(90deg); }
.lyrics-summary-title { display: inline-flex; align-items: center; gap: var(--gs-space-2); }
.lyrics-icon { color: var(--gs-ink-3); flex-shrink: 0; }
.lyrics-mode-tag { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.lyrics-toggle-btn { margin-left: auto; display: inline-flex; align-items: center; min-height: 28px; padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); cursor: pointer; transition: background-color .15s ease, color .15s ease, border-color .15s ease; }
.lyrics-toggle-btn:hover { background: var(--gs-mint-wash); color: var(--gs-mint-ink); border-color: var(--gs-mint); }
.song-lyrics summary:focus-visible, .song-lyrics button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.song-lyrics-body { padding: 0 0 var(--gs-space-4); color: var(--gs-ink-2); font-size: var(--gs-text-body); font-weight: var(--gs-weight-regular); line-height: 1.7; }
.song-lyrics-note { margin: 0 0 var(--gs-space-4); }
.song-lyrics-error { color: var(--gs-critical); }
.song-lyrics-error button { min-height: var(--gs-control-touch); border: 0; background: none; color: var(--gs-mint-ink); font: inherit; text-decoration: underline; cursor: pointer; }
.song-lyrics-list { display: grid; gap: var(--gs-space-1); margin: 0; padding: 0; list-style: none; min-height: calc(6 * var(--gs-control-touch)); }
.song-lyrics-list.is-preview {
  mask-image: linear-gradient(to bottom, transparent, black 14%, black 86%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 14%, black 86%, transparent);
}
.song-lyrics-list.is-preview.at-start {
  mask-image: linear-gradient(to bottom, black 0%, black 86%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 86%, transparent);
}
.song-lyrics-list li { white-space: pre-wrap; overflow-wrap: anywhere; border-radius: var(--gs-radius-control); padding: 0 var(--gs-space-3); color: var(--gs-ink-3); box-sizing: border-box; transition: background-color .15s ease, color .15s ease; }
.song-lyrics-list button, .song-lyrics-list li > span { display: block; width: 100%; min-height: var(--gs-control-touch); padding: var(--gs-space-3) 0; box-sizing: border-box; border: 0; background: none; color: inherit; font: inherit; text-align: left; white-space: pre-wrap; }
.song-lyrics-list button { cursor: pointer; }
.song-lyrics-list button:disabled { cursor: default; }
.song-lyrics-list li.active { color: var(--gs-ink); background: var(--gs-mint-wash); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
@media (prefers-reduced-motion: reduce) {
  .song-lyrics summary::before { transition: none; }
  .song-lyrics-list li { transition: none; }
  .lyrics-toggle-btn { transition: none; }
}
</style>
