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
    :data-particle-renderer="particleRenderer"
  />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  sampleHitEffectFrame,
  sampleHoldEffectFrame,
} from '../../presentation/SongChartHitEffectRenderer.js'
import { drawParticleCanvas } from '../../presentation/SongChartParticleCanvas.js'
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
const particleRenderer = ref('pending')
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
// Canvas2D fallback uses each projected triangle; GPU path retains exact
// homogeneous depth for UV interpolation. No guessed global ellipse scaling.
function drawParticleFallback(ctx, img, inst) {
  const uv = [[0,0],[1,0],[0,1],[1,1]]
  for (const indices of [[0,2,1],[1,2,3]]) {
    const [i,j,k]=indices, a=uv[i],b=uv[j],c=uv[k],p=inst.quad[i],q=inst.quad[j],r=inst.quad[k]
    const determinant=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
    const axis=key=>{
      const m=((q[key]-p[key])*(c[1]-a[1])-(r[key]-p[key])*(b[1]-a[1]))/determinant
      const n=((r[key]-p[key])*(b[0]-a[0])-(q[key]-p[key])*(c[0]-a[0]))/determinant
      return [m,n,p[key]-m*a[0]-n*a[1]]
    }
    const [m,n,tx]=axis('x'),[o,v,ty]=axis('y')
    if(![m,n,tx,o,v,ty].every(Number.isFinite))continue
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=inst.alpha
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip()
    ctx.transform(m,o,n,v,tx,ty)
    drawEffectTexture(ctx,img,inst,[0,0,1,1]);ctx.restore()
  }
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || disposed) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, 1280, 720)

  const particles = []
  for (const hold of props.holds) particles.push(...sampleHoldEffectFrame(hold, hold.age))
  for (const hit of props.hits) particles.push(...sampleHitEffectFrame(hit, hit.age))
  if (drawParticleCanvas(ctx, particles, images)) particleRenderer.value = 'webgl-perspective'
  else {
    particleRenderer.value = 'canvas2d-fallback'
    for(const inst of particles) {
      const img=images.get(inst.textureId)
      if(img?.complete&&img.naturalWidth)drawParticleFallback(ctx,img,inst)
    }
  }

  // Auto UI uses a separate SVG sibling: its base is source-over, while
  // this particle surface adds to the real track backdrop.

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
