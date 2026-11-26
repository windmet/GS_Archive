<template>
  <section
    class="song-block audition-console"
    aria-labelledby="song-audition-title"
    :data-vocal-setting="audition.mode"
    :data-solo-ready="audition.mode === 'solo' ? audition.soloSession.ready : undefined"
    :data-solo-clock="audition.mode === 'solo' ? 'audio-context-scheduled' : undefined"
    :data-lineup-ready="audition.mode === 'lineup' ? audition.lineupSession.ready : undefined"
    :data-loaded-vocals="audition.mode === 'lineup' ? audition.lineupSession.loadedIdolCodes.join(',') : undefined"
    :data-active-stage-positions="audition.mode === 'lineup' ? audition.activeStagePositions.join(',') : undefined"
    :data-clock-mode="audition.mode === 'lineup' || audition.mode === 'solo' ? 'audio-context-scheduled' : 'media-element'"
  >
    <div class="song-block-heading">
      <h3 id="song-audition-title">歌曲播放</h3>
      <small v-if="maintainer">分轨混音 · 实验</small>
    </div>
    <!-- The console only plays: what is on, the transport, the lyrics. Versions are chosen in the panel. -->
    <p class="audition-now"><span>正在播放</span><strong>{{ audition.nowPlaying }}</strong></p>
    <!-- Who sings is shown on the five slots (lit border, 正在演唱). Spelled out here it grew with every
         added singer and wrapped, moving the transport and lyrics mid-song; screen readers still hear it. -->
    <p v-if="audition.mode === 'lineup' && audition.lineupSession.ready" class="audition-singers" aria-live="polite">
      当前演唱：{{ audition.activeSingers.length ? audition.activeSingers.map(entry => `${entry.name}（位置 ${entry.stagePositions.join('/')}）`).join('、') : '间奏 / 无人演唱' }}
    </p>
    <ArchiveMediaTransport music :ready="audition.ready" :playing="audition.playing" :duration="audition.duration" :current-time="audition.currentTime" @toggle="audition.toggle()" @restart="audition.restart()" @seek="audition.seek($event)">
      <ArchiveSongBalance :layered="audition.mode === 'solo' || audition.mode === 'lineup'">
        <template v-if="audition.mode === 'solo' || audition.mode === 'lineup'">
          <label>{{ audition.mode === 'solo' ? 'Solo 音量' : '演唱音量' }}<input v-model.number="audition.vocalGain" type="range" min="0" max="1" step="0.01" /></label>
          <label>伴奏音量<input v-model.number="audition.backingGain" type="range" min="0" max="1" step="0.01" /></label>
        </template>
        <label v-else>音量<input v-model.number="audition.singleVolume" type="range" min="0" max="1" step="0.01" /></label>
      </ArchiveSongBalance>
    </ArchiveMediaTransport>
    <div v-if="audition.mode === 'lineup' || audition.mode === 'solo'" class="audition-export">
      <button
        type="button"
        class="audition-export-btn"
        :disabled="!audition.canExportMixdown || exporting"
        @click="handleExport"
      >
        <Download :size="15" aria-hidden="true" />
        <span>{{ exportButtonLabel }}</span>
      </button>
      <div v-if="aacSupported" class="audition-export-format" role="radiogroup" aria-label="导出格式">
        <button type="button" role="radio" :aria-checked="exportFormat === 'aac'" :disabled="exporting" @click="exportFormat = 'aac'">AAC</button>
        <button type="button" role="radio" :aria-checked="exportFormat === 'wav'" :disabled="exporting" @click="exportFormat = 'wav'">WAV</button>
      </div>
      <span v-if="exportNote" class="audition-export-note" role="status">{{ exportNote }}</span>
    </div>
    <ArchiveErrorNote v-if="exportError" class="audition-error">{{ exportError }}</ArchiveErrorNote>
    <ArchiveErrorNote v-if="audition.error" class="audition-error">{{ audition.error }}</ArchiveErrorNote>
    <ArchiveSongLyrics :key="audition.lyrics.key" :song-code="song.id" :audio-url="audition.lyrics.audioUrl" :source-timeline="audition.lyrics.sourceTimeline"
      :stage-clock="audition.lyrics.stageClock" :current-time="audition.currentTime" :ready="audition.lyrics.ready" @seek="audition.seek($event)" />
    <ArchiveTechnicalDetails v-if="maintainer" label="试听说明">
      <p class="audition-evidence">{{ audition.evidence }}</p>
    </ArchiveTechnicalDetails>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Download } from '@lucide/vue'
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
import ArchiveErrorNote from './ArchiveErrorNote.vue'
import ArchiveSongBalance from './ArchiveSongBalance.vue'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import { isMaintainerMode } from '../../core/maintainerMode.js'

const props = defineProps({ song: { type: Object, required: true }, audition: { type: Object, required: true } })
// How the audition is decoded and clocked is a maintainer note, not reader copy.
const maintainer = isMaintainerMode()

const exporting = ref(false)
const exportStage = ref('')
const exportNote = ref('')
const exportError = ref('')
const exportFormat = ref('aac')
const aacSupported = ref(false)

onMounted(async () => {
  if (typeof globalThis.AudioEncoder !== 'function' || typeof globalThis.AudioData !== 'function') {
    exportFormat.value = 'wav'
    return
  }
  try {
    const support = await globalThis.AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitrate: 192000,
      aac: { format: 'adts' },
    })
    aacSupported.value = Boolean(support?.supported)
    if (!aacSupported.value) exportFormat.value = 'wav'
  } catch {
    aacSupported.value = false
    exportFormat.value = 'wav'
  }
})

watch(() => [props.song?.id, props.audition?.mode], () => {
  exportNote.value = ''
  exportError.value = ''
})

const exportButtonLabel = computed(() => {
  if (exporting.value) {
    if (exportStage.value === 'rendering') return '正在离线混音…'
    if (exportStage.value === 'encoding-aac') return '正在编码 AAC…'
    if (exportStage.value === 'encoding-wav') return '正在封装 WAV…'
    return '正在导出…'
  }
  return props.audition.mode === 'solo' ? '导出当前 Solo 音频' : '导出当前编组音频'
})

async function handleExport() {
  if (exporting.value || !props.audition.canExportMixdown) return
  const snapshot = props.audition.getMixdownSnapshot?.()
  if (!snapshot) {
    exportError.value = '请先等待全部音轨载入就绪后再导出。'
    return
  }
  exporting.value = true
  exportStage.value = 'rendering'
  exportNote.value = ''
  exportError.value = ''
  try {
    const { exportSongMixdown } = await import('../../utils/songMixdownExport.js')
    const result = await exportSongMixdown({
      snapshot,
      songTitle: props.song?.title || props.song?.id || '',
      mode: props.audition.mode,
      singerNames: props.audition.mixdownSingerNames || [],
      preferredFormat: aacSupported.value ? exportFormat.value : 'wav',
      onStage: stage => { exportStage.value = stage },
    })
    const mb = (result.bytes / (1024 * 1024)).toFixed(1)
    exportNote.value = `已开始下载 ${result.format.toUpperCase()}（约 ${mb} MB，含当前音量配比）`
  } catch (cause) {
    exportError.value = `导出失败：${cause?.message || cause}`
  } finally {
    exporting.value = false
    exportStage.value = ''
  }
}
</script>

<style scoped>
/* One line whatever is playing, so the transport below never moves. */
.audition-now { display: flex; flex-wrap: nowrap; align-items: baseline; gap: var(--gs-space-1) var(--gs-space-3); margin: var(--gs-space-4) 0 0; }
.audition-now span { flex: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.audition-now strong { min-width: 0; color: var(--gs-ink); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audition-singers { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.audition-export { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2) var(--gs-space-3); margin-top: var(--gs-space-3); }
.audition-export-btn { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.audition-export-btn:disabled { opacity: .52; cursor: default; }
.audition-export-format { display: inline-flex; padding: 2px; border-radius: var(--gs-radius-control); background: var(--gs-mode-track); }
.audition-export-format button { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-segment); background: transparent; color: var(--gs-ink-3); font: inherit; font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.audition-export-format button[aria-checked="true"] { background: var(--gs-mode-thumb); color: var(--gs-mode-ink); box-shadow: var(--gs-shadow-1); }
.audition-export-format button:disabled { opacity: .55; cursor: default; }
.audition-export-note { color: var(--gs-mint-ink); font-size: var(--gs-text-meta); }
@media (hover: hover) {
  .audition-export-btn:not(:disabled):hover { border-color: var(--gs-selected-line); background: var(--gs-mint-wash); color: var(--gs-mint-ink); }
}
.audition-error { margin: var(--gs-space-2) 0 0; color: var(--gs-critical); font-size: var(--gs-text-ui); }
.audition-evidence { margin: var(--gs-space-3) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.6; }
.song-block-heading small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
</style>
