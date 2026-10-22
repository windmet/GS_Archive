<template>
  <article class="score-page" data-archive-scroll-container>
    <header class="score-intro">
      <p>剧情里响起的配乐、歌曲、环境音与音效，按用途分开列出，每条标出用到它的剧情篇数，展开可以跳到对应剧情。配乐名称按资源编号意译，不是官方曲名。</p>
    </header>
    <nav class="score-shelves" aria-label="声音分类">
      <button v-for="entry in SHELVES" :key="entry.id" type="button" :data-score-shelf="entry.id" :aria-pressed="entry.id === shelf.id" @click="select(entry.id)">{{ entry.label }}</button>
    </nav>
    <section class="score-shelf" :data-score-shelf-view="shelf.id" :aria-label="shelf.label">
      <header class="score-shelf-head">
        <p class="score-note">{{ shelf.note }}</p>
        <p class="score-meta">{{ cues.length }} 条<template v-if="missing"> · 其中 {{ missing }} 条音频尚未转换</template></p>
        <label v-if="shelf.search" class="score-search"><Search :size="14" aria-hidden="true" /><input v-model.trim="query" type="search" placeholder="按编号筛选" aria-label="按编号筛选音效"></label>
      </header>
      <ol class="score-cues">
        <li v-for="entry in visibleCues" :key="entry.cue" :data-score-cue="entry.cue" :class="{ 'is-open': open === entry.cue }">
          <div class="score-row">
            <button type="button" class="score-play" :disabled="!entry.available" :aria-pressed="playing === entry.cue" :aria-label="entry.available ? `播放 ${entry.cue}` : `${entry.cue} 音频未转换`" @click="play(entry)"><component :is="playing === entry.cue ? Pause : Play" :size="14" aria-hidden="true" /></button>
            <span class="score-name">
              <button v-if="entry.song" type="button" class="score-song" :data-score-song="entry.song" @click="stop(); emit('open-song', entry.song)">{{ entry.title }}<small v-if="SONG_FORM[entry.kind]"> · {{ SONG_FORM[entry.kind] }}</small></button>
              <strong v-else-if="entry.label">{{ entry.label }}</strong>
              <code>{{ entry.cue }}</code>
              <span v-if="!entry.available" class="score-tag">音频未转换</span>
            </span>
            <button type="button" class="score-count" :aria-expanded="open === entry.cue" :aria-label="`${entry.files.length} 篇剧情使用 ${entry.cue}`" @click="toggle(entry.cue)">{{ entry.files.length }} 篇<ChevronDown :size="14" aria-hidden="true" /></button>
          </div>
          <ul v-if="open === entry.cue" class="score-stories">
            <li v-for="story in storiesOf(entry)" :key="story.file">
              <button type="button" :data-score-story="story.file" @click="stop(); emit('open-story', story)"><small v-if="story.domainLabel">{{ story.domainLabel }}</small><span :class="{ 'is-pending': storyTitle.pending() }">{{ storyTitle(story.file, story.title) }}</span></button>
            </li>
            <li v-if="entry.files.length > STORY_LIMIT && !expanded.has(entry.cue)"><button type="button" class="score-more" @click="expanded = new Set([...expanded, entry.cue])">显示全部 {{ entry.files.length }} 篇</button></li>
          </ul>
        </li>
      </ol>
      <p v-if="!visibleCues.length" class="score-note">没有符合的编号。</p>
    </section>
    <p class="score-status" role="status">{{ failed ? `${failed} 暂时无法播放。` : storiesFailed ? '剧情目录暂时无法读取，先显示资源编号。' : '' }}</p>
    <audio ref="audio" preload="none" @ended="settle" @pause="settle" @error="fail" />
  </article>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { ChevronDown, Pause, Play, Search } from '@lucide/vue'
import CATALOG from '../../data/storyAudioCatalog.json'
import { useStoryTitles } from './useReaderTitles.js'
import { getAmbientUrl, getBgmUrl, getSeUrl } from '../../utils/AssetResolver.js'
// `shelf` is the address's ?sound=; an empty or unknown id opens the first shelf. Cues and the stories that
// play them come from scripts/build-story-audio-catalog.mjs.
const props = defineProps({ shelf: { type: String, default: '' }, loadStories: { type: Function, default: null } })
const emit = defineEmits(['shelf', 'open-story', 'open-song'])
const SONG_FORM = { song_inst: '伴奏', song_arrangement: '剧情编曲' }
const SHELVES = [
  { id: 'score', label: '配乐', kind: 'bgm', url: getBgmUrl, keep: entry => entry.kind === 'score' || entry.kind === 'other',
    note: '剧情的背景音乐：商谈、工作、日常与各类场景曲。' },
  { id: 'songs', label: '剧中歌曲', kind: 'bgm', url: getBgmUrl, keep: entry => Boolean(entry.song),
    note: '剧情里作为背景音乐响起的偶像歌曲与伴奏，点歌名打开歌曲页。' },
  { id: 'ambient', label: '环境音', kind: 'ambient', url: getAmbientUrl, keep: () => true,
    note: '持续铺在场景下的环境声：街道、雨声、人群、室内等。' },
  { id: 'se', label: '音效', kind: 'se', url: getSeUrl, keep: () => true, search: true,
    note: '剧情中的单次音效：脚步、开门、手机铃声等，按资源编号列出。' },
]
const STORY_LIMIT = 30
const storyTitle = useStoryTitles()
const shelf = computed(() => SHELVES.find(entry => entry.id === props.shelf) || SHELVES[0])
const cues = computed(() => CATALOG[shelf.value.kind].filter(shelf.value.keep))
const missing = computed(() => cues.value.filter(entry => !entry.available).length)
const query = ref('')
const visibleCues = computed(() => {
  const text = shelf.value.search ? query.value.toLowerCase() : ''
  return text ? cues.value.filter(entry => entry.cue.toLowerCase().includes(text)) : cues.value
})
const open = ref(''), expanded = ref(new Set())
const playing = ref(''), failed = ref(''), audio = ref(null)
// Story rows by catalogue id, loaded the first time a list opens; a story missing from the catalogue still opens by its file.
const stories = shallowRef(null), storiesFailed = ref(false)
let storiesRequest = null
function ensureStories() {
  if (storiesRequest || !props.loadStories) return
  storiesRequest = Promise.resolve(props.loadStories())
    .then(rows => { stories.value = new Map(rows.map(row => [row.file, row])) })
    .catch(error => { console.warn('Story catalogue unavailable', error); storiesFailed.value = true })
}
function storiesOf(entry) {
  const files = expanded.value.has(entry.cue) ? entry.files : entry.files.slice(0, STORY_LIMIT)
  return files.map(index => {
    const file = CATALOG.files[index]
    return stories.value?.get(file) || { file, title: file.replace(/\.json$/, '') }
  })
}
function toggle(cue) { open.value = open.value === cue ? '' : cue; if (open.value) ensureStories() }
function select(id) {
  if (id === shelf.value.id) return
  stop(); failed.value = ''; open.value = ''; query.value = ''
  emit('shelf', id === SHELVES[0].id ? '' : id)
}
function stop() { const el = audio.value; if (el && !el.paused) el.pause(); playing.value = '' }
async function play(entry) {
  const el = audio.value
  if (!el || !entry.available) return
  if (playing.value === entry.cue) { stop(); return }
  stop(); failed.value = ''
  // A song cue is the song's full mix and carries its file; other cues play from the story audio paths.
  el.src = entry.url || shelf.value.url(entry.cue)
  playing.value = entry.cue
  try { await el.play() } catch (error) { if (error.name !== 'AbortError') fail() }
}
// A pause queued by switching clips arrives after the next clip started; only a stopped element clears.
function settle() { if (audio.value?.paused) playing.value = '' }
function fail() { if (playing.value) failed.value = playing.value; playing.value = '' }
onBeforeUnmount(() => { const el = audio.value; if (el) { el.pause(); el.removeAttribute('src'); el.load() } })
</script>
<style scoped>
.score-page { display: grid; align-content: start; gap: var(--gs-space-5); height: 100%; padding: var(--gs-space-8); overflow-y: auto; box-sizing: border-box; background: var(--gs-paper); color: var(--gs-ink-2); }
.score-intro p, .score-note { margin: 0; max-width: 72ch; color: var(--gs-ink-3); font-size: var(--gs-text-ui); line-height: 1.7; }
/* Same tab row as 其他语音: underlined, kept in view, equal cells on a phone. */
.score-shelves { position: sticky; top: calc(-1 * var(--gs-space-8)); z-index: 2; display: flex; gap: var(--gs-space-1); border-bottom: 1px solid var(--gs-line); background: var(--gs-paper); }
.score-shelves button { min-width: 88px; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 0; border-bottom: 2px solid transparent; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-body); cursor: pointer; white-space: nowrap; }
.score-shelves button[aria-pressed='true'] { border-color: var(--gs-selected-line); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.score-shelf { display: grid; gap: var(--gs-space-4); padding: var(--gs-space-6); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-surface); background: var(--gs-surface); }
.score-shelf-head { display: grid; gap: var(--gs-space-2); }
.score-meta { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.score-search { display: flex; align-items: center; gap: 6px; max-width: 320px; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); color: var(--gs-ink-3); }
.score-search input { flex: 1; min-width: 0; border: 0; background: none; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); outline: none; }
.score-cues { display: grid; margin: 0; padding: 0; list-style: none; }
.score-cues > li { border-top: 1px solid var(--gs-line); }
.score-row { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 4px; }
.score-play { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--gs-line); border-radius: 50%; background: var(--gs-surface); color: var(--gs-mint-ink); cursor: pointer; }
.score-play:hover:not(:disabled) { border-color: var(--gs-mint-ink); }
.score-play[aria-pressed='true'] { border-color: var(--gs-mint-ink); background: var(--gs-mint-wash); }
.score-play:disabled { color: var(--gs-ink-4, var(--gs-ink-3)); opacity: .45; cursor: default; }
.score-name { flex: 1; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; min-width: 0; font-size: var(--gs-text-ui); }
.score-name strong { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.score-name code { color: var(--gs-ink-3); font-size: var(--gs-text-meta); overflow-wrap: anywhere; }
.score-song { padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; font-weight: var(--gs-weight-semibold); text-align: left; cursor: pointer; }
.score-song small { color: var(--gs-ink-3); font-weight: 400; }
.score-song:hover { text-decoration: underline; }
.score-tag { padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.score-count { flex: none; display: inline-flex; align-items: center; gap: 2px; min-height: 32px; padding: 0 8px; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; cursor: pointer; }
.score-count:hover { color: var(--gs-mint-ink); }
.score-count svg { transition: transform .15s; }
.is-open .score-count svg { transform: rotate(180deg); }
.score-stories { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 4px; margin: 0 0 var(--gs-space-3); padding: 8px; border-radius: var(--gs-radius-control); background: var(--gs-paper); list-style: none; }
.score-stories button { display: grid; width: 100%; min-height: 36px; padding: 4px 8px; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); text-align: left; cursor: pointer; }
.score-stories button:hover { background: var(--gs-surface); color: var(--gs-mint-ink); }
.score-stories small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.score-stories .is-pending { visibility: hidden; }
.score-stories .score-more { color: var(--gs-mint-ink); }
.score-status { min-height: 1em; margin: 0; color: var(--gs-critical); font-size: var(--gs-text-ui); }
@media (max-width: 760px) {
  .score-page { gap: var(--gs-space-4); padding: var(--gs-space-5) var(--gs-space-4); }
  .score-shelves { top: calc(-1 * var(--gs-space-5)); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .score-shelves button { min-width: 0; padding: 0; }
  .score-shelf { padding: var(--gs-space-4); }
  .score-row { gap: 8px; padding: 4px 0; }
  .score-stories { grid-template-columns: 1fr; padding: 4px; }
}
</style>
