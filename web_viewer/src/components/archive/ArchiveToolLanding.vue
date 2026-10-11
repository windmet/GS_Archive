<template>
  <section class="experiments" data-archive-scroll-container>
    <h2>{{ kind === 'studio' ? '摄影工作台' : 'LIVE' }}</h2>
    <article v-for="tool in tools" :key="tool.id" class="experiment" :aria-labelledby="`tool-${tool.id}`">
      <img :src="tool.image" :alt="tool.imageAlt" width="960" height="540" decoding="async" />
      <div class="experiment-copy">
        <h3 :id="`tool-${tool.id}`">{{ tool.heading }}</h3>
        <p>{{ tool.summary }}</p>
        <ul><li v-for="point in tool.points" :key="point">{{ point }}</li></ul>
        <p class="experiment-size">首次打开约 <b>{{ tool.size }}</b> · {{ tool.sizeNote }}<template v-if="tool.heavy"> · 建议流量充足时打开</template></p>
        <div class="experiment-actions">
          <button v-for="action in tool.actions" :key="action.id" type="button" @click="$emit(action.id)">打开{{ action.label }}</button>
        </div>
        <p v-if="tool.link" class="experiment-link"><button type="button" class="link" @click="$emit(tool.link.id)">{{ tool.link.label }}</button></p>
      </div>
    </article>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import chartImage from '../../assets/tools/chart.webp'
import stageImage from '../../assets/tools/stage.webp'
import studioImage from '../../assets/tools/studio.webp'
const props = defineProps({ kind: { type: String, default: 'live' } })
defineEmits(['charts', 'photo', 'stage', 'photo-catalog'])
// Each tool has its own picture and entry; the two landing pages share one layout and three
// facts. Sizes are what a cold first open downloads (current request list × the deployed files'
// bytes on the wire, re-measured 2026-10-07 after pictures moved to q90 WebP); re-measure when a
// tool's first screen or the deployed images change.
const TOOLS = {
  charts: { id: 'charts', heading: '谱面预览', image: chartImage, imageAlt: '谱面预览：DRIVE A LIVE EXPERT 的透视轨道',
    summary: '选一首歌，像在游戏里一样看音符落下，也可以展开成整首的长轨图逐段读。',
    points: ['透视轨道 / 长轨图两种看法', '4 档难度，可调播放速度和音符落速', '导出 PNG 或 SVG'],
    size: '3 MB', sizeNote: '之后每首不到 0.1 MB', heavy: false,
    actions: [{ id: 'charts', label: '谱面预览' }] },
  stage: { id: 'stage', heading: '2D舞台', image: stageImage, imageAlt: '2D舞台：三位偶像的小人在舞台上跳舞',
    summary: '挑一首歌、编进想看的偶像，看小人们按游戏里的编舞唱跳一整首。',
    points: ['60 首曲目，最多 5 人同台', '切换演唱声部和服装', '纯净模式与舞台截图'],
    size: '12 MB', sizeNote: '含一首歌的音频', heavy: true,
    actions: [{ id: 'stage', label: '2D舞台' }] },
  studio: { id: 'photo', title: '摄影工作台', heading: '背景与人像的自由图层', image: studioImage, imageAlt: '摄影工作台：两位偶像和贴纸摆在街景前',
    summary: '把背景、偶像和贴纸当作图层自由摆放，拼出自己的画面。',
    points: ['133 个地点，49 位偶像，184 张贴纸', '每位偶像可换服装、表情和动作', '保存构图下次接着编，或导出 PNG'],
    size: '2.5 MB', sizeNote: '每加一位偶像约 2 MB', heavy: false,
    actions: [{ id: 'photo', label: '摄影工作台' }],
    link: { id: 'photo-catalog', label: '先去收藏查看背景与人像资源' } },
}
const tools = computed(() => props.kind === 'studio' ? [TOOLS.studio] : [TOOLS.charts, TOOLS.stage])
</script>
<style scoped>
.experiments { height: 100%; box-sizing: border-box; overflow: auto; padding: var(--gs-space-7); background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
h2 { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); }
.experiment { max-width: 1060px; margin-top: var(--gs-space-6); }
.experiment { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); align-items: center; gap: var(--gs-space-7); }
.experiment img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--gs-radius-control); background: var(--gs-line); }
.experiment-copy { display: grid; justify-items: start; gap: var(--gs-space-4); min-width: 0; }
h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.experiment-copy > p { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.7; }
ul { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; color: var(--gs-ink-2); font-size: var(--gs-text-body); }
li::before { content: '·'; margin-right: var(--gs-space-2); color: var(--gs-mint-ink); font-weight: var(--gs-weight-bold); }
.experiment-copy > .experiment-size { justify-self: stretch; padding-top: var(--gs-space-4); border-top: 1px solid var(--gs-line); color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.experiment-size b { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.experiment-actions { display: flex; flex-wrap: wrap; gap: var(--gs-space-3); }
.experiment-link { margin: 0; }
.experiment button.link { min-height: var(--gs-control-touch); padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font-weight: var(--gs-weight-regular, 400); text-decoration: underline; }
.experiment button { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-6); border: 1px solid var(--gs-rule); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.experiment button:hover { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); }
.experiment button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (max-width: 760px) {
  .experiments { padding: var(--gs-space-5) var(--gs-space-4) var(--gs-space-7); }
  h2 { font-size: var(--gs-text-section); }
  .experiment { margin-top: var(--gs-space-4); }
  .experiment { grid-template-columns: 1fr; gap: var(--gs-space-4); }
  .experiment-copy { gap: var(--gs-space-3); }
  .experiment-copy > .experiment-size { padding-top: 0; border-top: 0; font-size: var(--gs-text-meta); }
  .experiment button { justify-self: stretch; }
}
</style>
