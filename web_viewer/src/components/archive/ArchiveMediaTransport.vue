<template>
  <div class="media-transport" role="group" :aria-label="label">
    <button type="button" :disabled="!ready" @click="$emit('toggle')">{{ playing ? '暂停' : '播放' }}</button>
    <button type="button" :disabled="!ready || !knownDuration" @click="$emit('restart')">回到开头</button>
    <input type="range" min="0" :max="knownDuration ? duration : 1" step="0.01" :value="currentTime" :disabled="!ready || !knownDuration" aria-label="播放进度" @input="$emit('seek', Number($event.target.value))" />
    <span class="media-time">{{ time(currentTime) }} / {{ knownDuration ? time(duration) : '待播放' }}</span>
    <span v-if="loading" role="status">正在准备音频…</span>
    <slot />
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ playing: Boolean, ready: { type: Boolean, default: true }, loading: Boolean, currentTime: { type: Number, default: 0 }, duration: Number, label: { type: String, default: '音频播放' } })
defineEmits(['toggle', 'restart', 'seek'])
const knownDuration = computed(() => Number.isFinite(props.duration) && props.duration > 0)
const time = value => { const n = Math.floor(Math.max(0, Number(value) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` }
</script>
<style scoped>
.media-transport { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-width: 0; padding: 12px 0; color: #315660; font-size: 13px; }
button { min-height: 44px; padding: 8px 14px; border: 1px solid #bcd5d3; border-radius: 8px; background: #fff; color: #176f69; font: inherit; cursor: pointer; }
button:first-child { background: #176f69; color: white; border-color: #176f69; }
button:disabled, input:disabled { opacity: .5; cursor: default; }
input { flex: 1 1 140px; min-width: 80px; min-height: 44px; accent-color: #168f87; }
button:focus-visible, input:focus-visible { outline: 3px solid #39ada4; outline-offset: 2px; }
.media-time { font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
