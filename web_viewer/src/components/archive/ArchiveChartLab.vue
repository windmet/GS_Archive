<template>
  <div class="chart-lab" data-chart-scroll-host>
    <div v-if="!song" class="chart-lab-start">
      <h2>选一首歌查看谱面</h2>
      <p>谱面会在这里打开，可以切换难度、视图，随音频播放或逐个音符查看。</p>
      <p v-if="status" class="chart-lab-status" role="status">{{ status }}</p>
      <ArchiveChartSongPicker :songs="songs" :selected="selectedCode" @select="choose" />
    </div>
    <template v-else>
      <div class="chart-lab-current">
        <img v-if="song.jacketUrl" :src="song.jacketUrl" alt="" width="36" height="36" />
        <strong>{{ song.title }}</strong>
        <button type="button" class="chart-lab-switch" :aria-expanded="pickerOpen" @click="pickerOpen = true"><ListMusic :size="17" aria-hidden="true" />切换曲目</button>
      </div>
      <ArchiveSongChartPreview :key="song.id" standalone :song-code="song.id" :title="song.title" :difficulties="song.gameplay.difficulties" :audio-track="song.playback.track" />
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
defineProps({ song: { type: Object, default: null }, songs: { type: Array, default: () => [] }, status: { type: String, default: '' } })
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
.chart-lab-current { display: flex; flex: none; align-items: center; gap: var(--gs-space-4); padding-bottom: var(--gs-space-3); }
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
@media (max-width: 760px) {
  .chart-lab { padding: var(--gs-space-3); }
  .chart-lab-start { padding: var(--gs-space-3) var(--gs-space-2) var(--gs-space-7); }
  .chart-lab-start h2 { font-size: var(--gs-text-section); }
  .chart-song-drawer { inset: auto 0 0; width: 100vw; height: 85dvh; border-top-left-radius: var(--gs-radius-panel); border-top-right-radius: var(--gs-radius-panel); }
}
@media (min-width: 761px) and (min-height: 501px) {
  .chart-lab { overflow: auto; }
  .chart-lab :deep(.chart-preview.is-long) { flex: none; height: auto; min-height: 100%; overflow: visible; padding-bottom: 160px; }
  .chart-lab :deep(.chart-toolbar) { position: sticky; top: calc(-1 * var(--gs-space-4)); z-index: 3; padding: var(--gs-space-3) 0; background: var(--gs-paper); }
  .chart-lab :deep(.chart-viewport.is-long) { flex: none; overflow: visible; }
  .chart-lab :deep(.chart-viewport.is-long .chart-scroll) { flex: none; height: auto; overflow-x: auto; overflow-y: hidden; }
  .chart-lab :deep(.chart-preview.is-long .chart-transport) { position: fixed; bottom: var(--gs-space-4); left: var(--gs-space-7); right: var(--gs-space-7); z-index: 4; background: var(--gs-paper); }
}
@media (max-height: 500px) and (min-width: 761px) {
  .chart-lab { padding: var(--gs-space-3); }
  .chart-lab-current { padding-bottom: var(--gs-space-2); }
  .chart-lab :deep(.chart-toolbar) { flex-wrap: nowrap; overflow-x: auto; gap: var(--gs-space-3); margin-bottom: var(--gs-space-3); }
  .chart-lab :deep(.chart-toolbar > div), .chart-lab :deep(.chart-actions) { flex-shrink: 0; flex-wrap: nowrap; }
  .chart-lab :deep(.chart-transport) { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--gs-space-1) var(--gs-space-4); margin-top: var(--gs-space-3); padding: var(--gs-space-2) 0 0; }
  .chart-lab :deep(.chart-timeline) { display: grid; grid-template-columns: auto 1fr; gap: 0 var(--gs-space-3); }
  .chart-lab :deep(.chart-timeline > input[type=range]) { grid-row: 2; grid-column: 1 / -1; }
  .chart-lab :deep(.chart-navigation) { margin-top: 0; }
  .chart-lab :deep(.chart-shortcuts), .chart-lab :deep(.chart-position-status) { grid-column: 1 / -1; margin: 0; }
}
</style>
