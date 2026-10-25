<template>
  <canvas
    ref="canvasRef"
    width="1280"
    height="720"
    aria-hidden="true"
    class="track-effects-canvas"
    :data-hits-count="hits.length"
    :data-holds-count="holds.length"
    :data-auto-active="autoEval.active"
    :data-assets-pending="assetsPending"
    :data-assets-failed="assetsFailed"
  />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  sampleHitEffectFrame,
  sampleHoldEffectFrame,
  sampleAutoEvaluationFrame,
} from '../../presentation/SongChartHitEffectRenderer.js'
import { projectTrackPoint } from '../../presentation/SongTrackPresentation.js'
import hitEffectsConfig from '../../../config/song-hit-effects.v1.json'
import { subscribeEffectTexture, drawEffectTexture } from '../../presentation/SongChartEffectTextures.js'

const props = defineProps({
  hits: { type: Array, default: () => [] },
  holds: { type: Array, default: () => [] },
  autoEval: { type: Object, default: () => ({ active: false, age: 0, alpha: 0 }) },
  judgeY: { type: Number, default: 572 },
})

const canvasRef = ref(null)
const images = new Map()
const assetsPending = ref(0), assetsFailed = ref(0)
let disposed = false

const subscriptions = []
const status = new Map()
function preloadImages() {
  const assets = [...Object.values(hitEffectsConfig.assets), hitEffectsConfig.evaluation.sprite]
  for (const a of assets) {
    subscriptions.push(subscribeEffectTexture(a.pathId, a.url, entry => {
      if (disposed) return
      images.set(a.pathId, entry.image)
      status.set(a.pathId, entry.status)
      assetsPending.value = [...status.values()].filter(s => s === 'pending').length
      assetsFailed.value = [...status.values()].filter(s => s === 'failed').length
      if (entry.status === 'ready') draw()
    }))
  }
}
function drawParticle(ctx, img, inst, x, y) {
  ctx.save()
  ctx.globalCompositeOperation = inst.blendMode
  ctx.globalAlpha = Math.max(0, Math.min(1, inst.alpha))
  ctx.translate(x + inst.dx, y + inst.dy)
  ctx.transform(...inst.basis, 0, 0)
  drawEffectTexture(ctx, img, inst, [-.5, -.5, 1, 1])
  ctx.restore()
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || disposed) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, 1280, 720)

  // 1. Draw continuous hold effects (Additive blending)
  for (const hold of props.holds) {
    const pt = projectTrackPoint(hold.lane, 0)
    const instructions = sampleHoldEffectFrame(hold, hold.age)
    for (const inst of instructions) {
      const img = images.get(inst.textureId)
      if (!img || !img.complete || !img.naturalWidth) continue
      drawParticle(ctx, img, inst, pt.x, props.judgeY)
    }
  }

  // 2. Draw transient hit effects (Additive blending)
  for (const hit of props.hits) {
    const pt = projectTrackPoint(hit.targetLane, 0)
    const instructions = sampleHitEffectFrame(hit, hit.age)
    for (const inst of instructions) {
      const img = images.get(inst.textureId)
      if (!img || !img.complete || !img.naturalWidth) continue
      drawParticle(ctx, img, inst, pt.x, props.judgeY)
    }
  }

  // 3. Draw native Auto UI badge (3-layer EvalAnimationAuto)
  if (props.autoEval.active) {
    const evalData = sampleAutoEvaluationFrame(props.autoEval.age)
    if (evalData) {
      const autoImg = images.get(2068)
      if (autoImg && autoImg.complete && autoImg.naturalWidth) {
        for (const layer of evalData.layers) {
          ctx.save()
          ctx.globalCompositeOperation = layer.blendMode || 'source-over'
          ctx.globalAlpha = Math.max(0, Math.min(1, layer.alpha))
          ctx.translate(layer.x, layer.y)
          ctx.scale(layer.scaleX, layer.scaleY)
          drawEffectTexture(ctx, autoImg, { sx: 0, sy: 0, sw: 136, sh: 63, colorTint: layer.colorTint }, [-68, -31.5, 136, 63])
          ctx.restore()
        }
      }
    }
  }
}

watch([() => props.hits, () => props.holds, () => props.autoEval], draw, { deep: false })

onMounted(() => {
  preloadImages()
  draw()
})

onBeforeUnmount(() => {
  disposed = true
  for (const unsubscribe of subscriptions) unsubscribe()
})
</script>

<style scoped>
.track-effects-canvas {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
