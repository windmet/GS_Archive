<template>
  <g v-if="frame" data-auto-evaluation pointer-events="none" aria-hidden="true">
    <template v-for="layer in frame.layers" :key="layer.target">
      <defs><filter :id="`${uid}-${layer.target}`" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" :values="tintMatrix(layer.colorTint)" /></filter></defs>
      <image :data-auto-layer="layer.target" :href="sprite.url" :x="-sprite.width/2" :y="-sprite.height/2" :width="sprite.width" :height="sprite.height" :opacity="layer.alpha" :transform="`translate(${layer.x} ${layer.y}) scale(${layer.scaleX} ${layer.scaleY})`" :filter="`url(#${uid}-${layer.target})`" :style="{mixBlendMode:layer.blendMode==='lighter'?'plus-lighter':'normal'}" />
    </template>
  </g>
</template>
<script setup>
import { computed, getCurrentInstance } from 'vue'
import { sampleAutoEvaluationFrame, hitEffectsConfig } from '../../presentation/SongChartHitEffectRenderer.js'
const props=defineProps({state:{type:Object,required:true}})
const uid=`auto-evaluation-${getCurrentInstance().uid}`
const sprite=hitEffectsConfig.evaluation.sprite
const frame=computed(()=>props.state.active?sampleAutoEvaluationFrame(props.state.age):null)
// UI base keeps source-over. Only the two authored additive flashes add to
// the actual SVG backdrop, rather than flattening all three into a canvas.
const tintMatrix=c=>`${c.r} 0 0 0 0 0 ${c.g} 0 0 0 0 0 ${c.b} 0 0 0 0 0 1 0`
</script>
