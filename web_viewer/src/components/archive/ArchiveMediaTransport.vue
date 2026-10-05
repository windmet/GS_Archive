<template>
  <div v-if="music" class="media-transport media-transport-music" role="group" :aria-label="label">
    <div class="media-music-progress">
      <input type="range" min="0" :max="knownDuration ? duration : 1" step="0.01" :value="currentTime" :disabled="!ready || !knownDuration" aria-label="播放进度" @input="$emit('seek', Number($event.target.value))" />
      <div class="media-music-time"><span>{{ time(currentTime) }}</span><span>{{ knownDuration ? time(duration) : '待播放' }}</span></div>
    </div>
    <div class="media-music-controls">
      <button class="media-music-toggle" type="button" :disabled="!ready" :aria-label="playing ? '暂停' : '播放'" :title="playing ? '暂停' : '播放'" @click="$emit('toggle')"><Pause v-if="playing" :size="24" fill="currentColor" aria-hidden="true" /><Play v-else :size="24" fill="currentColor" aria-hidden="true" /></button>
      <button class="media-music-restart" type="button" :disabled="!ready || !knownDuration" aria-label="回到开头" title="回到开头" @click="$emit('restart')"><RotateCcw :size="20" aria-hidden="true" /></button>
      <div v-if="$slots.default" class="media-music-extra"><slot /></div>
    </div>
    <span v-if="loading" class="media-music-status" role="status">正在准备音频…</span>
  </div>
  <div v-else class="media-transport" role="group" :aria-label="label">
    <button type="button" :disabled="!ready" @click="$emit('toggle')">{{ playing ? '暂停' : '播放' }}</button>
    <button class="media-restart" type="button" :disabled="!ready || !knownDuration" aria-label="回到开头" title="回到开头" @click="$emit('restart')">↺</button>
    <input type="range" min="0" :max="knownDuration ? duration : 1" step="0.01" :value="currentTime" :disabled="!ready || !knownDuration" aria-label="播放进度" @input="$emit('seek', Number($event.target.value))" />
    <span class="media-time">{{ time(currentTime) }} / {{ knownDuration ? time(duration) : '待播放' }}</span>
    <span v-if="loading" role="status">正在准备音频…</span>
    <slot />
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { Play, Pause, RotateCcw } from '@lucide/vue'
const props = defineProps({ music: { type: Boolean, default: false }, playing: Boolean, ready: { type: Boolean, default: true }, loading: Boolean, currentTime: { type: Number, default: 0 }, duration: Number, label: { type: String, default: '音频播放' } })
defineEmits(['toggle', 'restart', 'seek'])
const knownDuration = computed(() => Number.isFinite(props.duration) && props.duration > 0)
const time = value => { const n = Math.floor(Math.max(0, Number(value) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` }
</script>
<style scoped>
/* One transport for music and voice: on the paper, ink controls, stage light only for progress. */
.media-transport { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); min-width: 0; padding: var(--gs-space-4) 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
button { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; cursor: pointer; }
button:first-child { border-color: var(--gs-play-bg); background: var(--gs-play-bg); color: var(--gs-play-ink); }
button:disabled, input:disabled { opacity: .45; cursor: default; }
input { flex: 1 1 80px; min-width: 80px; min-height: var(--gs-control-touch); accent-color: var(--gs-mint); }
button:focus-visible, input:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.media-restart { padding: 0 var(--gs-space-4); font-size: var(--gs-text-section); }
.media-time { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; white-space: nowrap; }
.media-transport-music { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gs-space-4); font-family: var(--gs-font-body); }
.media-music-progress { display: grid; min-width: 0; }
.media-music-progress input { display: block; box-sizing: border-box; width: 100%; min-width: 0; margin: 0; padding: 0; }
.media-music-time { display: flex; justify-content: space-between; gap: var(--gs-space-3); color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; white-space: nowrap; }
.media-music-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--gs-space-4); min-width: 0; }
.media-music-toggle { display: grid; flex: none; place-items: center; box-sizing: border-box; width: 56px; height: 56px; min-height: 56px; padding: 0; border-radius: var(--gs-radius-pill); }
.media-music-restart { display: grid; flex: none; place-items: center; box-sizing: border-box; width: var(--gs-control-touch); height: var(--gs-control-touch); padding: 0; border-radius: var(--gs-radius-pill); }
.media-music-extra { min-width: 0; max-width: 100%; }
.media-music-status { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
</style>
