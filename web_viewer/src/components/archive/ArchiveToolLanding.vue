<template>
  <section v-if="kind === 'studio'" class="landing landing-studio" data-archive-scroll-container>
    <img class="studio-art" :src="studioImage" alt="摄影工作台：两位偶像和贴纸摆在街景前" width="960" height="540" decoding="async" />
    <div class="studio-start">
      <p class="studio-lede">把背景、偶像和贴纸当作图层自由摆放，拼出自己的画面。</p>
      <ul class="start-list">
        <li>
          <button type="button" class="start-row" :disabled="starting" @click="startWithIdol">
            <ArchiveIdolAvatar v-if="preferredIdol" class="start-avatar" :idol-code="preferredIdol.id" :size="32" :ring-width="0" :gap="0" decorative />
            <span v-else class="start-glyph" aria-hidden="true"><UserRound :size="18" /></span>
            <span class="start-copy"><strong>{{ preferredIdol ? `从${preferredName}开始` : '从一位偶像开始' }}</strong><small>{{ preferredIdol ? '带上担当，直接去换服装、表情和动作' : '进去后在「人物」里选一位偶像' }}</small></span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </li>
        <li>
          <button type="button" class="start-row" @click="emit('photo', {})">
            <span class="start-glyph" aria-hidden="true"><FilePlus2 :size="18" /></span>
            <span class="start-copy"><strong>新建空白构图</strong><small>从地点开始，再一个个加人物</small></span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </li>
        <li v-if="hasSavedComposition">
          <button type="button" class="start-row" @click="emit('photo', { restore: true })">
            <span class="start-glyph" aria-hidden="true"><History :size="18" /></span>
            <span class="start-copy"><strong>继续上次的构图</strong><small>载入这台设备上保存的构图</small></span>
            <ChevronRight :size="18" aria-hidden="true" />
          </button>
        </li>
        <li>
          <button type="button" class="start-row" @click="emit('photo-catalog')">
            <span class="start-glyph" aria-hidden="true"><Images :size="18" /></span>
            <span class="start-copy"><strong>先看背景与人像资源</strong><small>133 个地点，49 位偶像，184 张贴纸</small></span>
            <ArrowUpRight :size="18" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p class="size-note">首次打开约 <b>2.5 MB</b> · 每加一位偶像约 2 MB</p>
    </div>
  </section>

  <section v-else class="landing landing-live" data-archive-scroll-container>
    <div class="tool-pair">
      <button v-for="tool in TOOLS" :key="tool.id" type="button" class="tool" @click="emit(tool.id)">
        <img :src="tool.image" :alt="tool.imageAlt" width="192" height="108" decoding="async" />
        <span class="tool-copy">
          <strong>{{ tool.heading }}<ArrowUpRight :size="16" aria-hidden="true" /></strong>
          <span>{{ tool.summary }}</span>
          <small>首次约 {{ tool.size }} · {{ tool.sizeNote }}</small>
        </span>
      </button>
    </div>

    <section class="song-start" aria-labelledby="live-song-start">
      <header class="song-start-head">
        <h2 id="live-song-start">从一首歌开始</h2>
        <GsSegmented v-model="category" :options="categoryOptions" aria-label="歌曲类别" compact />
      </header>
      <label class="song-start-search">
        <Search :size="17" aria-hidden="true" />
        <input v-model="query" type="search" aria-label="搜索曲目" placeholder="搜索歌名或组合" autocomplete="off" />
      </label>
      <p v-if="!songs.length" class="song-start-status" role="status">正在读取曲目…</p>
      <p v-else-if="!matches.length" class="song-start-status">没有匹配的曲目，试试别的名字或组合。</p>
      <template v-else>
        <section v-for="group in groups" :key="group.key" class="song-group">
          <h3 v-if="group.label">{{ group.label }}</h3>
          <ul>
            <li v-for="song in group.songs" :key="song.song_code" class="song-row">
              <img v-if="song.jacket_url" :src="song.jacket_url" alt="" width="40" height="40" loading="lazy" decoding="async" />
              <span v-else class="song-nojacket" aria-hidden="true"></span>
              <span class="song-copy"><strong :title="song.title">{{ song.title }}</strong><small>{{ subline(song) }}</small></span>
              <span v-if="difficulties(song)" class="song-dots" :title="`${difficulties(song)} 档难度`" aria-hidden="true"><i v-for="n in difficulties(song)" :key="n"></i></span>
              <button v-if="difficulties(song)" type="button" class="song-go" :aria-label="`${song.title} 的谱面`" @click="emit('chart-song', song.song_code)">谱面</button>
              <span v-else class="song-go is-none" aria-label="没有谱面">—</span>
              <button type="button" class="song-go" :aria-label="`${song.title} 的舞台`" @click="emit('stage-song', song.song_code)">舞台</button>
            </li>
          </ul>
        </section>
      </template>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ArrowUpRight, ChevronRight, FilePlus2, History, Images, Search, UserRound } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import GsSegmented from '../gs/GsSegmented.vue'
import { groupSongTiers } from '../../presentation/SongTiers.js'
import { classifySongLineup } from '../../presentation/SongPresentation.js'
import chartImage from '../../assets/tools/chart.webp'
import stageImage from '../../assets/tools/stage.webp'
import studioImage from '../../assets/tools/studio.webp'

// LIVE: the two tools side by side, then every song with its own two doors (谱面 / 舞台), so nobody has to open a tool
// to find a song. Studio: the ways to start, one row each. Sizes are what a cold first open downloads (re-measured
// 2026-10-07 after pictures moved to q90 WebP); re-measure when a tool's first screen or the deployed images change.
const props = defineProps({
  kind: { type: String, default: 'live' },
  songs: { type: Array, default: () => [] },
  chartSongs: { type: Array, default: () => [] },
  preferredIdol: { type: Object, default: null },
  preferredName: { type: String, default: '' },
})
const emit = defineEmits(['charts', 'stage', 'photo', 'photo-catalog', 'chart-song', 'stage-song'])
const TOOLS = [
  { id: 'charts', heading: '谱面预览', image: chartImage, imageAlt: '谱面预览：DRIVE A LIVE EXPERT 的透视轨道',
    summary: '像在游戏里一样看音符落下，或展开成整首的长轨图。', size: '3 MB', sizeNote: '之后每首不到 0.1 MB' },
  { id: 'stage', heading: '2D舞台', image: stageImage, imageAlt: '2D舞台：三位偶像的小人在舞台上跳舞',
    summary: '把偶像编进想看的曲目，看小人们按游戏里的编舞唱跳。', size: '12 MB', sizeNote: '含一首歌的音频，建议流量充足时打开' },
]

const query = ref(''), category = ref('all')
const difficultyByCode = computed(() => new Map(props.chartSongs.map(entry => [entry.code, entry.difficultyCount])))
const difficulties = song => difficultyByCode.value.get(song.song_code) || 0
const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '')
const matches = computed(() => {
  const needle = normalize(query.value)
  return props.songs.filter(song => (category.value === 'all' || classifySongLineup(song) === category.value) &&
    (!needle || normalize([song.title, song.kana, song.song_code, song.performance?.unitName].join(' ')).includes(needle)))
})
const categoryOptions = computed(() => [['all', '全部'], ['configurable_formation', '代表曲'], ['fixed_unit', '组合曲'], ['fixed_special_lineup', '特别']]
  .map(([value, label]) => ({ value, label: `${label} ${value === 'all' ? props.songs.length : props.songs.filter(song => classifySongLineup(song) === value).length}` })))
const groups = computed(() => {
  const tiers = groupSongTiers(matches.value, classifySongLineup)
  return [
    tiers.featured.length && { key: 'featured', label: '代表曲', songs: tiers.featured },
    ...tiers.units.map(unit => ({ key: `unit:${unit.code || unit.name}`, label: unit.name || '其他', songs: unit.songs })),
    tiers.special.length && { key: 'special', label: '特别编成', songs: tiers.special },
  ].filter(Boolean)
})
function subline(song) {
  const people = song.performance?.performers?.length
  const unit = song.performance?.unitName
  if (classifySongLineup(song) === 'configurable_formation') return '全员'
  return [unit, people ? `${people} 人` : ''].filter(Boolean).join(' · ') || '特别编成'
}

// A saved composition is a local convenience the studio already keeps; only its presence is read here.
const hasSavedComposition = ref(false)
onMounted(() => { try { hasSavedComposition.value = Boolean(localStorage.getItem('sidem-studio-document-v1')) } catch { /* private window */ } })
const starting = ref(false)
function startWithIdol() {
  if (!props.preferredIdol) return emit('photo', {})
  starting.value = true
  emit('photo', { idolCode: props.preferredIdol.id })
}
</script>

<style scoped>
.landing { height: 100%; box-sizing: border-box; overflow: auto; padding: var(--gs-space-6) var(--gs-gutter) var(--gs-space-7); background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
.landing button { font: inherit; }
.landing :focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }

/* LIVE: two tools on the paper, no cards. */
.tool-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-7); max-width: var(--gs-content-width); margin: 0 auto; }
.tool { display: flex; align-items: center; gap: var(--gs-space-5); padding: var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: inherit; text-align: left; cursor: pointer; }
.tool img { flex: none; width: 192px; height: 108px; object-fit: cover; border-radius: var(--gs-radius-control); background: var(--gs-line); }
.tool-copy { display: grid; gap: var(--gs-space-2); min-width: 0; }
.tool-copy strong { display: flex; align-items: center; gap: var(--gs-space-2); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.tool-copy strong svg { color: var(--gs-ink-3); }
.tool-copy > span { color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.5; }
.tool-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
@media (hover: hover) { .tool:hover { background: var(--gs-hover); } }

.song-start { max-width: var(--gs-content-width); margin: var(--gs-space-6) auto 0; padding-top: var(--gs-space-5); border-top: 1px solid var(--gs-line); }
.song-start-head { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-5); flex-wrap: wrap; }
.song-start-head h2 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.song-start-search { display: flex; align-items: center; gap: var(--gs-space-3); height: var(--gs-control-normal); margin: var(--gs-space-4) 0; padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-3); }
.song-start-search:focus-within { border-color: var(--gs-ink-3); box-shadow: 0 0 0 var(--gs-focus-ring) var(--gs-mint); }
.song-start-search input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.song-start-status { margin: var(--gs-space-5) 0; color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.song-group h3 { margin: var(--gs-space-4) 0 var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.song-group ul { margin: 0; padding: 0; list-style: none; }
.song-row { display: flex; align-items: center; gap: var(--gs-space-4); box-sizing: border-box; height: 56px; border-bottom: 1px solid var(--gs-line); }
.song-row img, .song-nojacket { flex: none; width: 40px; height: 40px; border-radius: var(--gs-radius-control); object-fit: cover; background: var(--gs-line); }
.song-copy { display: grid; flex: 1; gap: 2px; min-width: 0; }
.song-copy strong { overflow: hidden; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.song-copy small { overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
.song-dots { display: flex; flex: none; gap: 3px; }
.song-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--gs-ink-3); }
.song-go { flex: none; min-width: 44px; height: 36px; padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font-size: var(--gs-text-ui); cursor: pointer; }
.song-go.is-none { display: grid; place-items: center; color: var(--gs-ink-3); cursor: default; }
@media (hover: hover) { button.song-go:hover { background: var(--gs-hover); color: var(--gs-ink); } }

/* Studio: the picture, and the ways in. */
.landing-studio { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); align-content: start; align-items: start; gap: var(--gs-space-8); }
.studio-art { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--gs-radius-control); background: var(--gs-line); }
.studio-start { display: grid; gap: var(--gs-space-4); min-width: 0; }
.studio-lede { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.6; }
.start-list { margin: 0; padding: 0; border-top: 1px solid var(--gs-line); list-style: none; }
.start-list li { border-bottom: 1px solid var(--gs-line); }
.start-row { display: flex; align-items: center; gap: var(--gs-space-4); box-sizing: border-box; width: 100%; height: 64px; padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink); text-align: left; cursor: pointer; }
.start-row:disabled { opacity: .6; cursor: default; }
.start-row > svg { flex: none; color: var(--gs-ink-3); }
.start-avatar, .start-glyph { flex: none; width: 32px; height: 32px; }
.start-glyph { display: grid; place-items: center; color: var(--gs-ink-2); }
.start-copy { display: grid; flex: 1; gap: 2px; min-width: 0; }
.start-copy strong { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.start-copy small { overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-meta); text-overflow: ellipsis; white-space: nowrap; }
@media (hover: hover) { .start-row:not(:disabled):hover { background: var(--gs-hover); } }
.size-note { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.size-note b { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }

@media (max-width: 760px) {
  .landing { padding: var(--gs-space-4) var(--gs-space-5) var(--gs-space-7); }
  .tool-pair { grid-template-columns: 1fr; gap: var(--gs-space-2); }
  .tool img { width: 112px; height: 63px; }
  .tool-copy > span { display: none; }
  .song-start { margin-top: var(--gs-space-4); }
  .song-row { height: auto; min-height: 64px; flex-wrap: wrap; padding: var(--gs-space-3) 0; }
  .song-copy { flex-basis: calc(100% - 56px); }
  .song-dots { display: none; }
  .song-go { flex: 1; height: 52px; border: 1px solid var(--gs-line); }
  .song-row img, .song-nojacket { align-self: flex-start; }
  .landing-studio { grid-template-columns: 1fr; gap: var(--gs-space-5); }
}
</style>
