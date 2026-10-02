<template>
  <div class="chart-lab" data-chart-scroll-host>
    <ArchiveSongChartPreview :key="song.id" standalone :song-code="song.id" :title="song.title" :difficulties="song.gameplay.difficulties" :audio-track="song.playback.track" />
  </div>
</template>
<script setup>
import ArchiveSongChartPreview from './ArchiveSongChartPreview.vue'
defineProps({ song: { type: Object, required: true } })
</script>
<style scoped>
.chart-lab { box-sizing: border-box; padding: 12px; height: 100%; overflow: hidden; }
.chart-lab :deep(.chart-preview) { margin: 0; padding: 0; border: 0; height: 100%; display: flex; flex-direction: column; overflow: auto; }
.chart-lab :deep(.chart-toolbar), .chart-lab :deep(.chart-transport) { flex-shrink: 0; }
.chart-lab :deep(.chart-viewport) { flex: 1; min-height: 120px; overflow: hidden; background: #13212e; }
.chart-lab :deep(.chart-viewport.is-long) { display: flex; flex-direction: column; }
.chart-lab :deep(.chart-scroll) { flex: 1; height: auto; min-height: 0; }
.chart-lab :deep(.chart-hud), .chart-lab :deep(.chart-reading-note) { flex-shrink: 0; }
.chart-lab :deep(.track-preview), .chart-lab :deep(.track-svg) { height: 100%; }
.chart-lab :deep(.chart-reading-note) { margin: 0; padding: 5px 8px; font-size: 11px; color: #bed5da; }
@media (min-width: 761px) and (min-height: 501px) {
  .chart-lab { overflow: auto; }
  .chart-lab :deep(.chart-preview.is-long) { height: auto; min-height: 100%; overflow: visible; padding-bottom: 160px; }
  .chart-lab :deep(.chart-toolbar) { position: sticky; top: -12px; z-index: 3; padding: 10px 0; background: #f3f7f8; }
  .chart-lab :deep(.chart-viewport.is-long) { flex: none; overflow: visible; }
  .chart-lab :deep(.chart-viewport.is-long .chart-scroll) { flex: none; height: auto; overflow-x: auto; overflow-y: hidden; }
  .chart-lab :deep(.chart-preview.is-long .chart-transport) { position: fixed; bottom: 12px; left: 24px; right: 24px; z-index: 4; background: #f1f7f7; }
}
@media (max-height: 500px) and (min-width: 600px) {
  .chart-lab { padding: 8px; }
  .chart-lab :deep(.chart-toolbar) { flex-wrap: nowrap; overflow-x: auto; gap: 8px; margin-bottom: 8px; }
  .chart-lab :deep(.chart-toolbar > div), .chart-lab :deep(.chart-actions) { flex-shrink: 0; flex-wrap: nowrap; }
  .chart-lab :deep(.chart-transport) { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 6px 10px; margin-top: 8px; }
  .chart-lab :deep(.chart-timeline) { display: grid; grid-template-columns: auto 1fr; gap: 0 8px; }
  .chart-lab :deep(.chart-timeline > input[type=range]) { grid-row: 2; grid-column: 1 / -1; }
  .chart-lab :deep(.chart-navigation) { margin-top: 0; }
  .chart-lab :deep(.chart-shortcuts), .chart-lab :deep(.chart-position-status) { grid-column: 1 / -1; margin: 0; }
}
</style>
