<template>
  <section class="experiments" data-archive-scroll-container>
    <h2>工具</h2>
    <div class="experiment-list">
      <article v-for="tool in tools" :key="tool.id" class="experiment" :aria-labelledby="`tool-${tool.id}`">
        <img :src="tool.image" :alt="tool.imageAlt" width="960" height="540" loading="lazy" decoding="async" />
        <div class="experiment-copy">
          <h3 :id="`tool-${tool.id}`">{{ tool.title }}</h3>
          <p>{{ tool.summary }}</p>
          <ul><li v-for="point in tool.points" :key="point">{{ point }}</li></ul>
          <p class="experiment-size">首次打开约 <b>{{ tool.size }}</b> · {{ tool.sizeNote }}<template v-if="tool.heavy"> · 建议流量充足时打开</template></p>
          <button type="button" @click="$emit(tool.id)">打开{{ tool.title }}</button>
        </div>
      </article>
    </div>
  </section>
</template>
<script setup>
import chartImage from '../../assets/tools/chart.webp'
import stageImage from '../../assets/tools/stage.webp'
import studioImage from '../../assets/tools/studio.webp'
defineEmits(['charts', 'photo', 'stage'])
// The three tools carry equal weight: one large picture of what each makes, a sentence and three
// facts. Sizes are what a cold first open downloads (current request list × the deployed files'
// bytes on the wire, re-measured 2026-10-07 after pictures moved to q90 WebP); re-measure when a
// tool's first screen or the deployed images change.
const tools = [
  { id: 'charts', title: '谱面预览', image: chartImage, imageAlt: '谱面预览：DRIVE A LIVE EXPERT 的透视轨道',
    summary: '选一首歌，像在游戏里一样看音符落下，也可以展开成整首的长轨图逐段读。',
    points: ['透视轨道 / 长轨图两种看法', '4 档难度，可调播放速度和音符落速', '导出 PNG 或 SVG'],
    size: '3 MB', sizeNote: '之后每首不到 0.1 MB', heavy: false },
  { id: 'stage', title: '舞台小人', image: stageImage, imageAlt: '舞台小人：三位偶像的小人在舞台上跳舞',
    summary: '挑一首歌、编进想看的偶像，看小人们按游戏里的编舞唱跳一整首。',
    points: ['60 首曲目，最多 5 人同台', '切换演唱声部和服装', '纯净模式与舞台截图'],
    size: '12 MB', sizeNote: '含一首歌的音频', heavy: true },
  { id: 'photo', title: '摄影工作台', image: studioImage, imageAlt: '摄影工作台：两位偶像和贴纸摆在街景前',
    summary: '选地点、摆偶像、贴贴纸，拼一张自己的照片。',
    points: ['133 个地点，49 位偶像，184 张贴纸', '每位偶像可换服装、表情和动作', '保存构图下次接着编，或导出 PNG'],
    size: '2.5 MB', sizeNote: '每加一位偶像约 2 MB', heavy: false },
]
</script>
<style scoped>
.experiments { height: 100%; box-sizing: border-box; overflow: auto; padding: var(--gs-space-7); background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
h2 { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); }
.experiment-list { display: grid; gap: var(--gs-space-8); max-width: 1060px; margin-top: var(--gs-space-6); }
.experiment { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); align-items: center; gap: var(--gs-space-7); }
.experiment img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--gs-radius-control); background: var(--gs-line); }
.experiment-copy { display: grid; justify-items: start; gap: var(--gs-space-4); min-width: 0; }
h3 { margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); }
.experiment-copy > p { margin: 0; color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.7; }
ul { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; color: var(--gs-ink-2); font-size: var(--gs-text-body); }
li::before { content: '·'; margin-right: var(--gs-space-2); color: var(--gs-mint-ink); font-weight: var(--gs-weight-bold); }
.experiment-copy > .experiment-size { justify-self: stretch; padding-top: var(--gs-space-4); border-top: 1px solid var(--gs-line); color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.experiment-size b { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.experiment button { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-6); border: 1px solid var(--gs-rule); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.experiment button:hover { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); }
.experiment button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (max-width: 760px) {
  .experiments { padding: var(--gs-space-5) var(--gs-space-4) var(--gs-space-7); }
  h2 { font-size: var(--gs-text-section); }
  .experiment-list { gap: var(--gs-space-7); margin-top: var(--gs-space-4); }
  .experiment { grid-template-columns: 1fr; gap: var(--gs-space-4); }
  .experiment-copy { gap: var(--gs-space-3); }
  .experiment-copy > .experiment-size { padding-top: 0; border-top: 0; font-size: var(--gs-text-meta); }
  .experiment button { justify-self: stretch; }
}
</style>
