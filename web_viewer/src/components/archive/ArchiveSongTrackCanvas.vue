<template>
  <canvas
    ref="canvasRef"
    width="1280"
    height="720"
    aria-hidden="true"
    class="track-canvas"
    data-track-canvas
    :data-note-count="scene.glyphs.length"
    :data-middle-count="scene.middleNodes.length"
    :data-link-count="scene.links.length"
    :data-hold-count="scene.holds.length"
    :data-flick-count="scene.holds.filter(h => h.flickConnector).length"
    :data-vertex-count="vertexCount"
    :data-particle-count="particleCount"
    :data-hits-count="hits.length"
    :data-holds-count="holdEffects.length"
    :data-assets-pending="assetsPending"
    :data-assets-failed="assetsFailed"
    :data-textures-pending="texturesPending"
    :data-textures-failed="texturesFailed"
  />
</template>

<script setup>
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createSongTrackCanvasFrameBuilder } from '../../presentation/SongTrackCanvasFrame.js'
import { createSongTrackCanvasRenderer } from '../../presentation/SongTrackCanvasRenderer.js'
import { sampleHitEffectFrame, sampleHoldEffectFrame } from '../../presentation/SongChartHitEffectRenderer.js'
import { subscribeEffectTexture } from '../../presentation/SongChartEffectTextures.js'
import hitEffectsConfig from '../../../config/song-hit-effects.v1.json'

// Holds, links, middle nodes, the judgement line, notes with their hints and the hit particles, all in one
// WebGL frame drawn from one scene. Emits `unavailable` when WebGL is missing or lost; the parent then
// falls back to the SVG layers.
const props = defineProps({
  scene: { type: Object, required: true },
  skin: { type: String, required: true },
  laneAlphas: { type: Array, default: null },
  hits: { type: Array, default: () => [] },
  holdEffects: { type: Array, default: () => [] },
  auditFrame: { type: Object, default: null },
})
const emit = defineEmits(['unavailable', 'texture-status'])
const audit = inject('song-chart-audit', null)
const canvasRef = ref(null)
const vertexCount = ref(0), particleCount = ref(0)
const assetsPending = ref(0), assetsFailed = ref(0), texturesPending = ref(0), texturesFailed = ref(0)
const build = createSongTrackCanvasFrameBuilder()
const effectImages = new Map(), effectStatus = new Map(), subscriptions = []
let renderer = null, resizeObserver = null, redrawQueued = 0, disposed = false

function draw() {
  if (!renderer || disposed || renderer.lost) return
  const start = audit && performance.now()
  const frame = build(props.scene, { skin: props.skin, laneAlphas: props.laneAlphas })
  const particles = []
  for (const hold of props.holdEffects) particles.push(...sampleHoldEffectFrame(hold, hold.age))
  for (const hit of props.hits) particles.push(...sampleHitEffectFrame(hit, hit.age))
  const stats = audit ? { vertices: frame.vertexCount, particles: particles.length, draws: 0, bytes: 0 } : null
  renderer.draw(frame, props.scene, { particles, effectImages, stats })
  vertexCount.value = frame.vertexCount
  particleCount.value = particles.length
  if (stats) {
    stats.ms = performance.now() - start
    audit.record(props.auditFrame, 'canvas', stats)
  }
}
// Textures decode asynchronously; a paused track has no next frame to pick them up.
function redrawSoon() {
  if (redrawQueued || disposed) return
  redrawQueued = requestAnimationFrame(() => { redrawQueued = 0; draw() })
}
function resize() {
  const canvas = canvasRef.value
  if (!canvas || !renderer) return
  const width = Math.round(Math.min(2560, Math.max(640, canvas.clientWidth * (window.devicePixelRatio || 1))))
  if (renderer.resize(width, Math.round(width * 9 / 16))) draw()
}
function unavailable() {
  audit?.event('track-canvas-unavailable')
  emit('unavailable')
}

onMounted(() => {
  const onTextureStatus = status => {
    texturesPending.value = status.pending; texturesFailed.value = status.failed
    emit('texture-status', status)
  }
  try { renderer = createSongTrackCanvasRenderer(canvasRef.value, { onTextureReady: redrawSoon, onTextureStatus, onLost: unavailable }) } catch { renderer = null }
  if (!renderer) { unavailable(); return }
  for (const asset of [...Object.values(hitEffectsConfig.assets), hitEffectsConfig.evaluation.sprite]) {
    subscriptions.push(subscribeEffectTexture(asset.pathId, asset.url, entry => {
      if (disposed) return
      effectImages.set(asset.pathId, entry.image)
      effectStatus.set(asset.pathId, entry.status)
      assetsPending.value = [...effectStatus.values()].filter(s => s === 'pending').length
      assetsFailed.value = [...effectStatus.values()].filter(s => s === 'failed').length
      if (entry.status === 'ready') redrawSoon()
    }))
  }
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvasRef.value)
  resize()
  draw()
})
watch([() => props.scene, () => props.laneAlphas, () => props.hits, () => props.holdEffects, () => props.skin], draw)
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(redrawQueued)
  resizeObserver?.disconnect()
  for (const unsubscribe of subscriptions) unsubscribe()
  renderer?.dispose()
})
</script>

<style scoped>
.track-canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none; }
</style>
