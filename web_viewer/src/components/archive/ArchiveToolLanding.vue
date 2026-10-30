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
          <button type="button" class="start-row" @click="emit('photo', { background: true })">
            <span class="start-glyph" aria-hidden="true"><Images :size="18" /></span>
            <span class="start-copy"><strong>从背景开始</strong><small>先选地点，再一个个加人物</small></span>
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
          <small>首次约 {{ tool.size }}<span class="tool-size-note"> · {{ tool.sizeNote }}</span></small>
        </span>
      </button>
    </div>

    <ArchiveLiveChartTable :songs="songs" @chart-song="(code, difficulty) => emit('chart-song', code, difficulty)" @stage-song="emit('stage-song', $event)" />
  </section>
</template>

<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue'
import { ArrowUpRight, ChevronRight, History, Images, UserRound } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import chartImage from '../../assets/tools/chart.webp'
import stageImage from '../../assets/tools/stage.webp'
import studioImage from '../../assets/tools/studio.webp'

// LIVE: the two tools side by side, then the chart table (every chart of every song; a row opens it in the chart tool
// and its end opens the stage), so nobody has to open a tool to find a song. The table and its figures load only on
// LIVE. Studio: the ways to start, one row each. Sizes are what a cold first open downloads (re-measured 2026-10-07
// after pictures moved to q90 WebP); re-measure when a tool's first screen or the deployed images change.
const props = defineProps({
  kind: { type: String, default: 'live' },
  songs: { type: Array, default: () => [] },
  preferredIdol: { type: Object, default: null },
  preferredName: { type: String, default: '' },
})
const emit = defineEmits(['charts', 'stage', 'photo', 'chart-song', 'stage-song'])
const TOOLS = [
  { id: 'charts', heading: '谱面预览', image: chartImage, imageAlt: '谱面预览：DRIVE A LIVE EXPERT 的透视轨道',
    summary: '像在游戏里一样看音符落下，或展开成整首的长轨图。', size: '3 MB', sizeNote: '之后每首不到 0.1 MB' },
  { id: 'stage', heading: '2D舞台', image: stageImage, imageAlt: '2D舞台：三位偶像的小人在舞台上跳舞',
    summary: '把偶像编进想看的曲目，看小人们按游戏里的编舞唱跳。', size: '12 MB', sizeNote: '含一首歌的音频，建议流量充足时打开' },
]

const ArchiveLiveChartTable = defineAsyncComponent(() => import('./ArchiveLiveChartTable.vue'))

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
  /* The two tools side by side: a 16:9 picture over the name ↗ and one line of size (线框减法册 L4). */
  .tool-pair { gap: var(--gs-space-4); }
  .tool { flex-direction: column; align-items: stretch; gap: var(--gs-space-2); padding: 0; }
  .tool img { width: 100%; height: auto; aspect-ratio: 16 / 9; }
  .tool-copy { gap: 2px; }
  .tool-copy strong { font-size: var(--gs-text-ui); }
  .tool-copy > span { display: none; }
  .tool-size-note { display: none; }
  .landing-studio { grid-template-columns: 1fr; gap: var(--gs-space-5); }
}
</style>
