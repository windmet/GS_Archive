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

function preloadImages() {
  const assets = Object.values(hitEffectsConfig.assets || {})
  for (const a of assets) {
    if (typeof Image === 'undefined') break
    const img = new Image()
    images.set(a.pathId, img)
    assetsPending.value++
    img.onload = () => { if (!disposed) { assetsPending.value--; draw() } }
    img.onerror = () => { if (!disposed) { assetsPending.value--; assetsFailed.value++ } }
    img.src = a.url
  }
  if (hitEffectsConfig.evaluation?.sprite?.url && typeof Image !== 'undefined') {
    const autoImg = new Image()
    images.set(2068, autoImg)
    assetsPending.value++
    autoImg.onload = () => { if (!disposed) { assetsPending.value--; draw() } }
    autoImg.onerror = () => { if (!disposed) { assetsPending.value--; assetsFailed.value++ } }
    autoImg.src = hitEffectsConfig.evaluation.sprite.url
  }
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
      ctx.save()
      ctx.globalCompositeOperation = inst.blendMode || 'lighter'
      ctx.globalAlpha = Math.max(0, Math.min(1, inst.alpha))
      ctx.translate(pt.x + (inst.dx || 0), props.judgeY + (inst.dy || 0))
      if (inst.rotation) ctx.rotate(inst.rotation)
      ctx.drawImage(img, inst.sx, inst.sy, inst.sw, inst.sh, -inst.w / 2, -inst.h / 2, inst.w, inst.h)
      ctx.restore()
    }
  }

  // 2. Draw transient hit effects (Additive blending)
  for (const hit of props.hits) {
    const pt = projectTrackPoint(hit.targetLane, 0)
    const instructions = sampleHitEffectFrame(hit, hit.age)
    for (const inst of instructions) {
      const img = images.get(inst.textureId)
      if (!img || !img.complete || !img.naturalWidth) continue
      ctx.save()
      ctx.globalCompositeOperation = inst.blendMode || 'lighter'
      ctx.globalAlpha = Math.max(0, Math.min(1, inst.alpha))
      ctx.translate(pt.x + (inst.dx || 0), props.judgeY + (inst.dy || 0))
      if (inst.rotation) ctx.rotate(inst.rotation)
      ctx.drawImage(img, inst.sx, inst.sy, inst.sw, inst.sh, -inst.w / 2, -inst.h / 2, inst.w, inst.h)
      ctx.restore()
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
          ctx.translate(640, props.judgeY - 45)
          ctx.scale(layer.scaleX, layer.scaleY)
          if (layer.colorTint && typeof ctx.filter === 'string') {
            const g = Math.round(layer.colorTint.g * 255)
            const b = Math.round(layer.colorTint.b * 255)
            ctx.filter = 'drop-shadow(0 0 10px rgba(0, ' + g + ', ' + b + ', 0.85))'
          }
          ctx.drawImage(autoImg, 0, 0, 136, 63, -68, -31.5, 136, 63)
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
