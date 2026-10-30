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
    <ArchiveErrorNote v-if="audition.error" class="audition-error">{{ audition.error }}</ArchiveErrorNote>
    <ArchiveSongLyrics :key="audition.lyrics.key" :song-code="song.id" :audio-url="audition.lyrics.audioUrl" :source-timeline="audition.lyrics.sourceTimeline"
      :stage-clock="audition.lyrics.stageClock" :current-time="audition.currentTime" :ready="audition.lyrics.ready" @seek="audition.seek($event)" />
    <ArchiveTechnicalDetails v-if="maintainer" label="试听说明">
      <p class="audition-evidence">{{ audition.evidence }}</p>
    </ArchiveTechnicalDetails>
  </section>
</template>

<script setup>
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
import ArchiveErrorNote from './ArchiveErrorNote.vue'
import ArchiveSongBalance from './ArchiveSongBalance.vue'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import { isMaintainerMode } from '../../core/maintainerMode.js'

defineProps({ song: { type: Object, required: true }, audition: { type: Object, required: true } })
// How the audition is decoded and clocked is a maintainer note, not reader copy.
const maintainer = isMaintainerMode()
</script>

<style scoped>
/* One line whatever is playing, so the transport below never moves. */
.audition-now { display: flex; flex-wrap: nowrap; align-items: baseline; gap: var(--gs-space-1) var(--gs-space-3); margin: var(--gs-space-4) 0 0; }
.audition-now span { flex: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.audition-now strong { min-width: 0; color: var(--gs-ink); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audition-singers { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.audition-error { margin: var(--gs-space-2) 0 0; color: var(--gs-critical); font-size: var(--gs-text-ui); }
.audition-evidence { margin: var(--gs-space-3) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.6; }
.song-block-heading small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
</style>
