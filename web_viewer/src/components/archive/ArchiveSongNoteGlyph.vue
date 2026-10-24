<template>
  <g :data-native-role="role">
    <svg v-if="showBody" :x="x - width / 2" :y="y - bodyHeight / 2" :width="width" :height="bodyHeight" :viewBox="viewBox(sprite)" overflow="hidden">
      <image :href="sprite.url" :width="sprite.width" :height="sprite.height" />
    </svg>
    <g v-if="marker" :data-direction-hint="role" :data-effect-prefab="marker.defaultIndex" data-effect-presentation="static-emitter">
      <template v-for="(layer, i) in marker.layers" :key="i">
        <defs><filter :id="`${uid}-${i}`" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" :values="tintMatrix(layer.color)" /></filter></defs>
        <image :href="layer.url" :x="layer.cx - layer.width / 2" :y="layer.cy - layer.height / 2" :width="layer.width" :height="layer.height" :transform="`rotate(${layer.rotation} ${layer.cx} ${layer.cy})`" :filter="`url(#${uid}-${i})`" preserveAspectRatio="none" />
      </template>
    </g>
  </g>
</template>
<script setup>
import { computed, getCurrentInstance } from 'vue'
import { noteRendering } from '../../presentation/SongNotePresentation.js'
import { songChartStaticFlickHint } from '../../presentation/SongTrackNativeEffects.js'
const props = defineProps({ role: { type: String, required: true }, skin: { type: String, default: 'Note1SpriteAtlas' }, x: Number, y: Number, width: Number, showBody: { type: Boolean, default: true }, hint: { type: Object, default: null } })
const uid = `note-hint-${getCurrentInstance().uid}`
const sprite = computed(() => noteRendering.skins[props.skin][props.role])
const viewBox = s => { const [x, y, r, b] = s.displayBounds; return `${x} ${y} ${r-x} ${b-y}` }
const bodyHeight = computed(() => props.width * (sprite.value.displayBounds[3] - sprite.value.displayBounds[1]) / (sprite.value.displayBounds[2] - sprite.value.displayBounds[0]))
const marker = computed(() => props.hint || (props.showBody ? songChartStaticFlickHint(props.role, props.x, props.y, props.width, props.skin) : null))
// Static source-color multiplication. Original particle shader/blur and
// prewarmed emission phases are intentionally not represented by these PNGs.
const tintMatrix = c => `${c.r} 0 0 0 0 0 ${c.g} 0 0 0 0 0 ${c.b} 0 0 0 0 0 ${c.a} 0`
</script>
