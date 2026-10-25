<template>
  <g v-if="state?.visible" data-chart-combo :data-count="state.count" :data-scale="state.scale" role="img" :aria-label="`演示 Combo ${state.count}`" pointer-events="none" :transform="`translate(${layout.x} ${layout.y})`">
    <image data-combo-underline :href="native.sprites.element_live_combo_underline.url" :x="layout.left" :y="-native.layout.underline.rect.m_AnchoredPosition.y-native.layout.underline.rect.m_SizeDelta.y/2" :width="layout.lineWidth" :height="native.layout.underline.rect.m_SizeDelta.y" preserveAspectRatio="none" />
    <g :transform="`scale(${state.scale})`" data-combo-animated-base>
      <image v-for="(digit,i) in layout.digits" :key="i" :href="digit.url" :x="digit.x" :y="digit.y" :width="digit.width" :height="digit.height" :preserveAspectRatio="native.layout.digitImage.preserveAspect ? 'xMidYMid meet' : 'none'" />
      <image :href="layout.label.url" :x="layout.label.x" :y="layout.label.y" :width="layout.label.width" :height="layout.label.height" />
    </g>
    <g v-if="particles.length" data-combo-315 :data-age="state.specialAge">
      <g v-for="(particle,i) in particles" :key="`${particle.nodeId}-${particle.particleId}`" :data-combo-system="particle.subName" :opacity="particle.alpha" :style="{mixBlendMode:particle.blendMode==='lighter'?'plus-lighter':'normal'}" :transform="matrix(particle)">
        <defs><filter :id="`${uid}-${i}`" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" :values="tintMatrix(particle.colorTint)" /></filter></defs>
        <svg :width="particle.sw" :height="particle.sh" :viewBox="`${particle.sx} ${particle.sy} ${particle.sw} ${particle.sh}`" overflow="hidden"><image :href="native.special315.assets[particle.textureId].url" :width="native.special315.assets[particle.textureId].width" :height="native.special315.assets[particle.textureId].height" :filter="`url(#${uid}-${i})`" /></svg>
      </g>
    </g>
  </g>
</template>
<script setup>
import { computed, getCurrentInstance } from 'vue'
import { comboLayout, sampleCombo315, songComboTiming as native } from '../../presentation/SongComboTiming.js'
const props=defineProps({state:{type:Object,default:null}})
const layout=computed(()=>comboLayout(props.state?.count||0))
const particles=computed(()=>sampleCombo315(props.state?.specialAge))
const uid=`combo315-${getCurrentInstance().uid}`
const matrix=p=>`matrix(${p.basis[0]/p.sw} ${p.basis[1]/p.sw} ${p.basis[2]/p.sh} ${p.basis[3]/p.sh} ${p.quad[0].x} ${p.quad[0].y})`
const tintMatrix=c=>`${c.r} 0 0 0 0 0 ${c.g} 0 0 0 0 0 ${c.b} 0 0 0 0 0 1 0`
</script>
