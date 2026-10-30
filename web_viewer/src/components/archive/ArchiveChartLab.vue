<template>
  <div class="chart-lab" data-chart-scroll-host>
    <div v-if="!song" class="chart-lab-start">
      <h2>选一首歌查看谱面</h2>
      <p>谱面会在这里打开，可以切换难度、视图，随音频播放或逐个音符查看。</p>
      <p v-if="status" class="chart-lab-status" role="status">{{ status }}</p>
      <ArchiveChartSongPicker :songs="songs" :selected="selectedCode" @select="choose" />
    </div>
    <template v-else>
      <ArchiveSongChartPreview :key="song.id" standalone :song-code="song.id" :title="song.title" :difficulties="song.gameplay.difficulties" :initial-difficulty="difficulty" :audio-track="song.playback.track">
        <template #lead><div class="chart-lab-current" :title="song.title"><img v-if="song.jacketUrl" :src="song.jacketUrl" alt="" width="36" height="36" /><strong>{{ song.title }}</strong></div></template>
        <template #actions><button type="button" class="chart-lab-switch" :aria-expanded="pickerOpen" @click="pickerOpen = true"><ListMusic :size="17" aria-hidden="true" />切换曲目</button></template>
      </ArchiveSongChartPreview>
      <ArchiveTerminalDialog class="chart-song-drawer" :open="pickerOpen" title="切换曲目" title-id="chart-song-drawer-title" @close="pickerOpen = false">
        <ArchiveChartSongPicker :songs="songs" :selected="song.id" @select="choose" />
      </ArchiveTerminalDialog>
    </template>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { ListMusic } from '@lucide/vue'
import ArchiveSongChartPreview from './ArchiveSongChartPreview.vue'
import ArchiveChartSongPicker from './ArchiveChartSongPicker.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
// The chart tool picks its own song (like the Chibi stage): with none chosen it opens on the picker,
// and a chosen song can be switched in place without leaving for the song page.
// difficulty: the difficulty type a song page's column asked for; the preview starts there.
defineProps({ song: { type: Object, default: null }, songs: { type: Array, default: () => [] }, difficulty: { type: Number, default: null }, status: { type: String, default: '' } })
const emit = defineEmits(['select-song'])
const pickerOpen = ref(false), selectedCode = ref('')
function choose(code) { pickerOpen.value = false; selectedCode.value = code; emit('select-song', code) }
</script>
<style scoped>
.chart-lab { display: flex; flex-direction: column; box-sizing: border-box; height: 100%; padding: var(--gs-space-4); overflow: hidden; background: var(--gs-paper); }
.chart-lab-start { width: 100%; max-width: var(--gs-content-width); margin: 0 auto; padding: var(--gs-space-6) var(--gs-space-3) var(--gs-space-8); box-sizing: border-box; overflow-y: auto; }
.chart-lab:has(.chart-lab-start) { overflow-y: auto; }
.chart-lab-start h2 { margin: 0; font-size: var(--gs-text-title); font-weight: var(--gs-weight-bold); }
.chart-lab-start > p { max-width: 46em; margin: var(--gs-space-3) 0 var(--gs-space-6); color: var(--gs-ink-2); font-size: var(--gs-text-body); line-height: 1.7; }
.chart-lab-start > .chart-lab-status { margin-top: calc(-1 * var(--gs-space-4)); padding-left: var(--gs-space-4); border-left: 2px solid var(--gs-mint); }
/* The song sits at the start of the chart's own toolbar row; its title gives way first when the row runs short. */
.chart-lab-current { display: flex; flex: 1 1 160px; align-items: center; gap: var(--gs-space-3); min-width: 0; }
.chart-lab-current img { flex: none; border-radius: var(--gs-radius-media); object-fit: cover; }
.chart-lab-current strong { flex: 1; min-width: 0; overflow: hidden; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.chart-lab-switch { display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.chart-lab-switch:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* Switching songs: a side drawer on wide screens, a bottom sheet on phones. */
.chart-song-drawer { position: fixed; inset: 0 0 0 auto; width: min(var(--gs-surface-drawer-width), 100vw); max-width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; border-radius: 0; }
.chart-lab :deep(.chart-preview) { display: flex; flex: 1; flex-direction: column; min-height: 0; margin: 0; padding: 0; border: 0; overflow: auto; }
.chart-lab :deep(.chart-toolbar), .chart-lab :deep(.chart-transport) { flex-shrink: 0; }
.chart-lab :deep(.chart-viewport) { flex: 1; min-height: 120px; overflow: hidden; background: #13212e; }
.chart-lab :deep(.chart-viewport.is-long) { display: flex; flex-direction: column; }
.chart-lab :deep(.chart-scroll) { flex: 1; height: auto; min-height: 0; }
.chart-lab :deep(.chart-hud), .chart-lab :deep(.chart-reading-note) { flex-shrink: 0; }
.chart-lab :deep(.track-preview), .chart-lab :deep(.track-svg) { height: 100%; }
.chart-lab :deep(.chart-reading-note) { margin: 0; padding: var(--gs-space-2) var(--gs-space-3); font-size: var(--gs-text-meta); color: #bed5da; }
/* Resident panel: the canvas column and the settings column share the height left under the toolbar.
   Perspective: the track keeps its 16:9 inside whatever box that leaves (as in 沉浸查看, less the svg's 1px border),
   and the width a 16:9 track cannot use goes to the settings column (292–400px) instead of dark bars beside it.
   --chart-chrome-block is the toolbar row plus the one-row transport; if either wraps, the split is only an estimate
   and the track still fits. Long view: the drawing scrolls inside the canvas. The settings scroll on their own. */
.chart-lab :deep(.chart-preview:has(.chart-layout.has-panel)) { --chart-chrome-block: 117px; container-type: size; overflow: hidden; }
.chart-lab :deep(.chart-layout.has-panel) { flex: 1 1 0; grid-template-rows: minmax(0, 1fr); align-items: stretch; min-height: 0; }
.chart-lab :deep(.chart-preview:not(.is-long) .chart-layout.has-panel) { grid-template-columns: clamp(100cqw - 400px - var(--gs-gap-group), (100cqh - var(--chart-chrome-block)) * 16 / 9 + 2px, 100cqw - var(--gs-tool-panel-compact) - var(--gs-gap-group)) minmax(0, 1fr); }
.chart-lab :deep(.chart-layout.has-panel .chart-main) { display: flex; flex-direction: column; min-height: 0; }
.chart-lab :deep(.chart-layout.has-panel .chart-settings) { min-height: 0; overflow-y: auto; scrollbar-width: thin; }
.chart-lab :deep(.chart-layout.has-panel .chart-viewport:not(.is-long)) { display: grid; place-items: center; container-type: size; }
.chart-lab :deep(.chart-layout.has-panel .chart-viewport:not(.is-long) .track-preview) { width: min(100cqw - 2px, calc((100cqh - 2px) * 16 / 9)); height: auto; }
@media (max-width: 760px) {
  .chart-lab { padding: var(--gs-space-3); }
  .chart-lab-start { padding: var(--gs-space-3) var(--gs-space-2) var(--gs-space-7); }
  .chart-lab-start h2 { font-size: var(--gs-text-section); }
  .chart-song-drawer { inset: auto 0 0; width: 100vw; height: 85dvh; border-top-left-radius: var(--gs-radius-panel); border-top-right-radius: var(--gs-radius-panel); }
}
@media (min-width: 761px) and (min-height: 501px) {
  .chart-lab { overflow: auto; }
  .chart-lab :deep(.chart-preview.is-long:not(:has(.chart-layout.has-panel))) { flex: none; height: auto; min-height: 100%; overflow: visible; padding-bottom: 160px; }
  .chart-lab :deep(.chart-preview:not(:has(.chart-layout.has-panel)) .chart-toolbar) { position: sticky; top: calc(-1 * var(--gs-space-4)); z-index: 3; padding: var(--gs-space-3) 0; background: var(--gs-paper); }
  .chart-lab :deep(.chart-layout:not(.has-panel) .chart-viewport.is-long) { flex: none; overflow: visible; }
  .chart-lab :deep(.chart-layout:not(.has-panel) .chart-viewport.is-long .chart-scroll) { flex: none; height: auto; overflow-x: auto; overflow-y: hidden; }
  .chart-lab :deep(.chart-preview.is-long:not(:has(.chart-layout.has-panel)) .chart-transport) { position: fixed; bottom: var(--gs-space-4); left: var(--gs-space-7); right: var(--gs-space-7); z-index: 4; background: var(--gs-paper); }
}
@media (max-height: 500px) and (min-width: 761px) {
  .chart-lab { padding: var(--gs-space-3); }
  .chart-lab :deep(.chart-toolbar) { flex-wrap: nowrap; overflow-x: auto; gap: var(--gs-space-3); margin-bottom: var(--gs-space-3); }
  .chart-lab :deep(.chart-toolbar > div), .chart-lab :deep(.chart-actions) { flex-shrink: 0; flex-wrap: nowrap; }
  .chart-lab :deep(.chart-transport) { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--gs-space-1) var(--gs-space-4); margin-top: var(--gs-space-3); padding: var(--gs-space-2) 0 0; }
  .chart-lab :deep(.chart-timeline) { display: grid; grid-template-columns: auto 1fr; gap: 0 var(--gs-space-3); }
  .chart-lab :deep(.chart-timeline > input[type=range]) { grid-row: 2; grid-column: 1 / -1; }
  .chart-lab :deep(.chart-navigation) { margin-top: 0; }
  .chart-lab :deep(.chart-shortcuts), .chart-lab :deep(.chart-position-status) { grid-column: 1 / -1; margin: 0; }
}
</style>
