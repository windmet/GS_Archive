<template>
  <details class="song-lyrics" @toggle="expanded = $event.target.open">
    <summary>歌词 <span>{{ synchronized ? '跟随播放' : '演出脚本' }}</span></summary>
    <div v-if="expanded" class="song-lyrics-body">
      <p v-if="loading" role="status">正在读取歌词…</p>
      <p v-else-if="error" class="song-lyrics-error" role="alert">{{ error }} <button type="button" @click="load">重试</button></p>
      <p v-else-if="!lines.length">这首歌暂无可展示的演出脚本歌词。</p>
      <template v-else>
        <label v-if="synchronized" class="lyrics-follow"><input v-model="follow" type="checkbox" />自动跟随当前句 <span>点击歌词跳转</span></label>
        <p v-else class="song-lyrics-note">当前音轨暂不支持歌词跟随。</p>
        <ol ref="listElement" class="song-lyrics-list" aria-label="演出脚本歌词">
          <li v-for="line in lines" :key="line.index" :class="{ active: synchronized && activeIndex === line.index }">
            <button v-if="synchronized" type="button" :disabled="!ready"
              :aria-current="activeIndex === line.index ? 'true' : undefined"
              @click="emit('seek', Math.max(0, line.time / 1000))">{{ line.text }}</button>
            <span v-else>{{ line.text }}</span>
          </li>
        </ol>
      </template>
    </div>
  </details>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
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
const expanded = ref(false)
const fetchedTimeline = ref(null)
const timeline = computed(() => props.sourceTimeline || fetchedTimeline.value)
const loading = ref(false)
const error = ref('')
const follow = ref(true)
const listElement = ref(null)
let generation = 0
const lines = computed(() => authoredSongLyrics(timeline.value, props.songCode))
const synchronized = computed(() => lines.value.length > 0 && (props.stageClock || sharesSongAudio(timeline.value, props.songCode, props.audioUrl)))
const activeIndex = computed(() => props.ready && synchronized.value ? activeSongLyric(lines.value, props.currentTime) : null)

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
  if (isExpanded) load()
  else { fetchedTimeline.value = null; loading.value = false; error.value = '' }
})
watch([activeIndex, follow, expanded], async () => {
  await nextTick()
  if (!follow.value || !expanded.value || activeIndex.value == null) return
  const list = listElement.value
  const active = list?.querySelector('[aria-current="true"]')
  if (active) list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2
})
onBeforeUnmount(() => { ++generation })
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
.song-lyrics-list { position: relative; max-height: 320px; overflow-y: auto; overscroll-behavior: contain; scroll-padding: 12px; display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.song-lyrics-list li { border-left: 2px solid #c7e5e2; background: #f6faf9; white-space: pre-wrap; overflow-wrap: break-word; }
.song-lyrics-list button, .song-lyrics-list li > span { display: block; width: 100%; min-height: 44px; padding: 10px 12px; box-sizing: border-box; border: 0; background: none; color: inherit; font: inherit; text-align: left; white-space: pre-wrap; cursor: pointer; }
.song-lyrics-list button:disabled { cursor: default; }
.song-lyrics-list li.active { background: #dff3ec; border-color: #087e65; color: #075b4a; font-weight: 700; }
.lyrics-follow { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-height: 44px; font-size: .76rem; cursor: pointer; }
.lyrics-follow span { margin-left: auto; color: #71858c; }
@media (prefers-reduced-motion: reduce) { .song-lyrics summary::before { transition: none; } }
</style>
