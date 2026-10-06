<template>
  <section class="experiments" data-archive-scroll-container>
    <h2>工具</h2>
    <div class="experiment-list" role="list">
      <div class="experiment-head" aria-hidden="true"><span></span><span>工具</span><span>首次打开下载</span><span></span></div>
      <article v-for="tool in tools" :key="tool.id" class="experiment-row" role="listitem" :aria-labelledby="`tool-${tool.id}`">
        <img :src="tool.image" alt="" width="160" height="90" loading="lazy" decoding="async" />
        <div class="experiment-copy"><h3 :id="`tool-${tool.id}`">{{ tool.title }}</h3><p>{{ tool.summary }}</p></div>
        <p class="experiment-size"><b>约 {{ tool.size }}</b><span>{{ tool.sizeNote }}</span><span v-if="tool.heavy">建议流量充足时打开</span></p>
        <button type="button" :aria-label="`打开${tool.title}`" @click="$emit(tool.id)"><span>打开</span><ChevronRight :size="18" aria-hidden="true" /></button>
      </article>
    </div>
  </section>
</template>
<script setup>
import { ChevronRight } from '@lucide/vue'
import chartImage from '../../assets/tools/chart.webp'
import stageImage from '../../assets/tools/stage.webp'
import studioImage from '../../assets/tools/studio.webp'
defineEmits(['charts', 'photo', 'stage'])
// The three tools stand side by side, none above the others. Sizes are what a cold first open
// downloads (current request list × the deployed files' bytes on the wire, 2026-10-06); re-measure
// when the tool's first screen or the deployed images change.
const tools = [
  { id: 'charts', title: '谱面预览', summary: '选一首歌，全屏看音符、调速度、导出图片。', image: chartImage, size: '10 MB', sizeNote: '之后每首约 0.1 MB', heavy: true },
  { id: 'stage', title: '舞台小人', summary: '按曲目编成最多 5 人的小人舞台，看动作与演唱切换。', image: stageImage, size: '13 MB', sizeNote: '含一首歌的音频', heavy: true },
  { id: 'photo', title: '摄影工作台', summary: '把偶像、地点和贴纸摆成一张照片，保存构图或导出 PNG。', image: studioImage, size: '3 MB', sizeNote: '每加一位偶像约 2 MB', heavy: false },
]
</script>
<style scoped>
.experiments { height: 100%; box-sizing: border-box; overflow: auto; padding: var(--gs-space-7); background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
h2 { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); }
.experiment-list { display: grid; max-width: 980px; margin-top: var(--gs-space-6); }
.experiment-head, .experiment-row { display: grid; grid-template-columns: 160px minmax(0, 1fr) 150px 120px; align-items: center; gap: var(--gs-space-6); }
.experiment-head { padding-bottom: var(--gs-space-3); border-bottom: 1px solid var(--gs-rule); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.experiment-row { padding: var(--gs-space-5) 0; border-bottom: 1px solid var(--gs-line); }
.experiment-row img { display: block; width: 160px; height: 90px; object-fit: cover; border-radius: var(--gs-radius-media); background: var(--gs-line); }
.experiment-copy { display: grid; gap: var(--gs-space-2); min-width: 0; }
h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.experiment-copy p { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.7; }
.experiment-size { display: grid; gap: 2px; margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.experiment-size b { color: var(--gs-ink); font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); }
.experiment-row button { display: inline-flex; align-items: center; justify-content: center; gap: 2px; min-height: var(--gs-control-touch); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.experiment-row button svg { display: none; }
.experiment-row button:hover { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); }
.experiment-row button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* Phones: each tool is one tappable line — picture, words, size, chevron. */
@media (max-width: 760px) {
  .experiments { padding: var(--gs-space-5) var(--gs-space-4); }
  h2 { font-size: var(--gs-text-section); }
  .experiment-list { margin-top: var(--gs-space-3); }
  .experiment-head { display: none; }
  .experiment-row { position: relative; grid-template-columns: 72px minmax(0, 1fr) 20px; grid-template-areas: 'art copy go' 'art size go'; gap: var(--gs-space-1) var(--gs-space-4); padding: var(--gs-space-4) 0; }
  .experiment-row img { grid-area: art; width: 72px; height: 72px; }
  .experiment-copy { grid-area: copy; gap: var(--gs-space-1); }
  h3 { font-size: var(--gs-text-subtitle); }
  .experiment-copy p { font-size: var(--gs-text-ui); line-height: 1.5; }
  .experiment-size { grid-area: size; display: block; font-size: var(--gs-text-meta); }
  .experiment-size b { font-size: var(--gs-text-meta); }
  .experiment-size span::before { content: ' · '; }
  .experiment-size span:first-of-type { display: none; }
  /* The whole row is the target; the button stretches over it and shows only the chevron. */
  .experiment-row button { grid-area: go; position: static; border: 0; background: none; color: var(--gs-ink-3); }
  .experiment-row button::after { content: ''; position: absolute; inset: 0; }
  .experiment-row button span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .experiment-row button svg { display: block; }
  .experiment-row button:hover { background: none; }
}
</style>
