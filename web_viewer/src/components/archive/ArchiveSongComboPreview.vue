<template>
  <g v-if="state?.visible" data-chart-combo :data-count="state.count" :data-scale="state.scale" role="img" :aria-label="`演示 Combo ${state.count}`" pointer-events="none" :transform="`translate(${layout.x} ${layout.y})`">
    <image :href="native.sprites.element_live_combo_underline.url" :x="layout.left" :y="-native.layout.underline.rect.m_AnchoredPosition.y-2" :width="native.layout.underline.rect.m_SizeDelta.x" :height="native.layout.underline.rect.m_SizeDelta.y" />
    <g :transform="`scale(${state.scale})`" data-combo-animated-base>
      <image v-for="(digit,i) in layout.digits" :key="i" :href="digit.url" :x="digit.x" :y="digit.y" :width="digit.width" :height="digit.height" :preserveAspectRatio="native.layout.digitImage.preserveAspect ? 'xMidYMid meet' : 'none'" />
      <image :href="layout.label.url" :x="layout.label.x" :y="layout.label.y" :width="layout.label.width" :height="layout.label.height" />
    </g>
  </g>
</template>
<script setup>
import { computed } from 'vue'
import { comboLayout, songComboTiming as native } from '../../presentation/SongComboTiming.js'
const props=defineProps({state:{type:Object,default:null}})
const layout=computed(()=>comboLayout(props.state?.count||0))
</script>
