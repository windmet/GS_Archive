<template>
  <div class="archive-video" :class="{ started }">
    <p v-if="theater" class="video-away" :style="{ aspectRatio: `${width} / ${height}` }">正在大屏播放</p>
    <!-- Theater mode teleports the same element to <body>, so the video keeps its position and state. -->
    <Teleport to="body" :disabled="!theater">
      <div
        ref="shellRef"
        class="video-shell"
        :class="{ theater, fullscreen }"
        :role="theater ? 'dialog' : undefined"
        :aria-modal="theater ? 'true' : undefined"
        :aria-label="label"
        tabindex="-1"
        @keydown="onKeydown"
        @click.self="theater && closeTheater()"
      >
        <header v-if="theater" class="video-theater-bar">
          <strong>{{ label }}</strong>
          <button type="button" class="video-control" title="退出大屏（Esc）" aria-label="退出大屏" @click="closeTheater"><X :size="20" /></button>
        </header>
        <div class="video-stage" :style="{ aspectRatio: `${width} / ${height}` }" @click.self="theater && closeTheater()">
          <video
            v-if="started"
            ref="videoRef"
            :key="src"
            :src="src"
            :poster="poster"
            :loop="loop"
            autoplay
            playsinline
            muted
            preload="auto"
            :aria-label="label"
            @click="toggle"
            @play="playing = true"
            @pause="playing = false"
            @ended="playing = false"
            @timeupdate="current = videoRef?.currentTime || 0"
            @loadedmetadata="onMetadata"
          ></video>
          <button v-else type="button" class="video-poster" :aria-label="`播放${label}${sizeLabel ? `（${sizeLabel}）` : ''}`" @click="start">
            <img v-if="poster" :src="poster" alt="" loading="lazy" />
            <span class="video-poster-play" aria-hidden="true"><Play :size="22" /></span>
          </button>
        </div>
        <div v-if="started" class="video-controls" role="toolbar" :aria-label="`${label}控制`">
          <button type="button" class="video-control" :title="playing ? '暂停（空格）' : '播放（空格）'" :aria-label="playing ? '暂停' : '播放'" @click="toggle">
            <Pause v-if="playing" :size="18" /><Play v-else :size="18" />
          </button>
          <button type="button" class="video-control" title="上一帧（←）" aria-label="上一帧" @click="step(-1)"><StepBack :size="18" /></button>
          <button type="button" class="video-control" title="下一帧（→）" aria-label="下一帧" @click="step(1)"><StepForward :size="18" /></button>
          <input
            class="video-seek"
            type="range"
            min="0"
            :max="duration || 0"
            step="0.01"
            :value="current"
            aria-label="播放进度"
            :aria-valuetext="`${current.toFixed(1)} / ${duration.toFixed(1)} 秒`"
            @input="seek($event.target.value)"
          />
          <span class="video-time">{{ current.toFixed(1) }} / {{ duration.toFixed(1) }} s</span>
          <div class="video-rates" role="group" aria-label="播放速度">
            <button v-for="value in RATES" :key="value" type="button" :aria-pressed="rate === value" @click="setRate(value)">{{ value }}×</button>
          </div>
          <button type="button" class="video-control" :aria-pressed="loop" :title="loop ? '循环：开' : '循环：关'" aria-label="循环播放" @click="loop = !loop"><Repeat :size="18" /></button>
          <button v-if="!fullscreen" type="button" class="video-control" :title="theater ? '退出大屏（Esc）' : '大屏播放'" :aria-label="theater ? '退出大屏' : '大屏播放'" :aria-pressed="theater" @click="theater ? closeTheater() : openTheater()"><MonitorPlay :size="18" /></button>
          <button type="button" class="video-control" :title="fullscreen ? '退出全屏（F）' : '全屏（F）'" :aria-label="fullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
            <Minimize v-if="fullscreen" :size="18" /><Maximize v-else :size="18" />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Maximize, Minimize, MonitorPlay, Pause, Play, Repeat, StepBack, StepForward, X } from '@lucide/vue'

const props = defineProps({
  src: { type: String, required: true },
  poster: { type: String, default: '' },
  width: { type: Number, default: 16 },
  height: { type: Number, default: 9 },
  label: { type: String, default: '视频' },
  sizeLabel: { type: String, default: '' },
  // Frame step for ←/→; client cut-ins are 30 fps.
  fps: { type: Number, default: 30 },
})

const RATES = [0.25, 0.5, 1]
const shellRef = ref(null)
const videoRef = ref(null)
const started = ref(false)
const playing = ref(false)
const theater = ref(false)
const fullscreen = ref(false)
const loop = ref(false)
const rate = ref(1)
const current = ref(0)
const duration = ref(0)
let previousBodyOverflow = ''
let returnFocus = null

// A new source returns to the poster, so nothing loads until asked.
watch(() => props.src, () => {
  closeTheater(); started.value = false; playing.value = false; current.value = 0; duration.value = 0
})

async function start() {
  started.value = true
  await nextTick()
  shellRef.value?.focus({ preventScroll: true })
}
function onMetadata() {
  const video = videoRef.value
  if (!video) return
  duration.value = Number.isFinite(video.duration) ? video.duration : 0
  video.playbackRate = rate.value
}
function toggle() {
  const video = videoRef.value
  if (!video) return
  if (video.paused || video.ended) video.play().catch(() => {})
  else video.pause()
}
function seek(value) {
  const video = videoRef.value
  if (!video) return
  video.currentTime = Math.min(duration.value || 0, Math.max(0, Number(value) || 0))
  current.value = video.currentTime
}
function step(frames) {
  videoRef.value?.pause()
  seek((videoRef.value?.currentTime || 0) + frames / props.fps)
}
function setRate(value) {
  rate.value = value
  if (videoRef.value) videoRef.value.playbackRate = value
}

async function openTheater() {
  if (theater.value) return
  returnFocus = document.activeElement
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  theater.value = true
  await nextTick()
  shellRef.value?.focus({ preventScroll: true })
}
function closeTheater() {
  if (!theater.value) return
  theater.value = false
  document.body.style.overflow = previousBodyOverflow
  nextTick(() => returnFocus?.focus?.({ preventScroll: true }))
}

async function toggleFullscreen() {
  if (document.fullscreenElement) return document.exitFullscreen().catch(() => {})
  const shell = shellRef.value
  if (shell?.requestFullscreen) return shell.requestFullscreen().catch(() => {})
  // iOS Safari fullscreens only the video element itself.
  videoRef.value?.webkitEnterFullscreen?.()
}
function onFullscreenChange() {
  fullscreen.value = !!shellRef.value && document.fullscreenElement === shellRef.value
}

function onKeydown(event) {
  if (event.target instanceof HTMLInputElement && event.key !== 'Escape') return
  if (event.key === ' ' || event.key === 'k') { event.preventDefault(); toggle() }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1) }
  else if (event.key === 'ArrowRight') { event.preventDefault(); step(1) }
  else if (event.key === 'f') { event.preventDefault(); toggleFullscreen() }
  else if (event.key === 'Escape' && theater.value && !fullscreen.value) { event.preventDefault(); closeTheater() }
}

onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (theater.value) document.body.style.overflow = previousBodyOverflow
})
</script>

<style scoped>
.archive-video { min-width: 0; }
.video-away { display: grid; place-items: center; margin: 0; border-radius: var(--gs-radius-media); background: var(--gs-mint-wash); color: var(--gs-mint-ink); font-size: var(--gs-text-ui); }
.video-shell { display: grid; min-width: 0; outline: none; }
.video-stage { position: relative; overflow: hidden; border-radius: var(--gs-radius-media); background: var(--gs-media-bg); }
.video-stage video, .video-poster { display: block; width: 100%; height: 100%; }
.video-stage video { object-fit: contain; cursor: pointer; }
.video-poster { position: relative; padding: 0; border: 0; background: var(--gs-media-bg); cursor: pointer; }
.video-poster img { width: 100%; height: 100%; object-fit: cover; }
.video-poster-play { position: absolute; top: 50%; left: 50%; display: grid; place-items: center; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; background: var(--gs-media-scrim); color: var(--gs-media-ink); }
.video-poster-play svg { margin-left: 3px; fill: currentColor; }
.video-poster:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }

.video-controls { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2); padding: var(--gs-space-3) 0 0; color: var(--gs-ink-2); }
.video-control, .video-rates button { display: inline-grid; place-items: center; min-width: var(--gs-control-normal); height: var(--gs-control-normal); padding: 0 var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: inherit; font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.video-control[aria-pressed="true"], .video-rates button[aria-pressed="true"] { background: var(--gs-selected-bg); color: var(--gs-selected-ink); }
.video-control:focus-visible, .video-rates button:focus-visible, .video-seek:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.video-seek { flex: 1 1 96px; min-width: 72px; accent-color: var(--gs-mint); }
.video-time { min-width: 6.5em; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.video-rates { display: inline-flex; gap: var(--gs-space-1); }
@media (hover: hover) and (pointer: fine) {
  .video-poster:hover .video-poster-play { background: var(--gs-mint-ink); }
  .video-control:hover, .video-rates button:hover { background: var(--gs-mint-wash); }
}

/* Theater and fullscreen: the video fills what the window leaves after the bars. */
.video-shell.theater, .video-shell.fullscreen { position: fixed; inset: 0; z-index: 2000; grid-template-rows: auto minmax(0, 1fr) auto; padding: var(--gs-safe-top) var(--gs-safe-right) var(--gs-safe-bottom) var(--gs-safe-left); background: var(--gs-media-backdrop); color: var(--gs-media-ink); }
.video-shell.fullscreen { grid-template-rows: minmax(0, 1fr) auto; background: var(--gs-media-bg); }
.video-theater-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-4); min-height: var(--gs-control-toolbar); padding: var(--gs-space-2) var(--gs-space-4); border-bottom: 1px solid var(--gs-media-line); }
.video-theater-bar strong { overflow: hidden; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.theater .video-stage, .fullscreen .video-stage { place-self: center; width: auto; height: auto; max-width: 100%; max-height: 100%; aspect-ratio: auto !important; border-radius: 0; background: transparent; }
.theater .video-stage video, .fullscreen .video-stage video { width: auto; height: auto; max-width: 100vw; max-height: calc(100vh - 120px); max-height: calc(100dvh - 120px); }
.fullscreen .video-stage video { max-height: calc(100vh - 64px); max-height: calc(100dvh - 64px); }
.theater .video-controls, .fullscreen .video-controls { justify-content: center; padding: var(--gs-space-3) var(--gs-space-4); border-top: 1px solid var(--gs-media-line); color: var(--gs-media-ink-2); }
.theater .video-time, .fullscreen .video-time { color: var(--gs-media-ink-2); }
.theater .video-seek, .fullscreen .video-seek { max-width: 520px; }
.theater .video-control[aria-pressed="true"], .theater .video-rates button[aria-pressed="true"],
.fullscreen .video-control[aria-pressed="true"], .fullscreen .video-rates button[aria-pressed="true"] { background: var(--gs-media-hover); color: var(--gs-mint); }
@media (hover: hover) and (pointer: fine) {
  .theater .video-control:hover, .theater .video-rates button:hover,
  .fullscreen .video-control:hover, .fullscreen .video-rates button:hover { background: var(--gs-media-hover); color: var(--gs-media-ink); }
}
</style>
