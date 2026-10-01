<template>
  <g :data-native-role="role">
    <svg :x="x - width / 2" :y="y - bodyHeight / 2" :width="width" :height="bodyHeight" :viewBox="viewBox(sprite)" overflow="hidden">
      <image :href="sprite.url" :width="sprite.width" :height="sprite.height" />
    </svg>
    <template v-if="hint">
      <defs><filter :id="uid" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" :values="tintMatrix" /></filter></defs>
      <g :data-direction-hint="role" :transform="role === 'swipe_left' ? `translate(${2*x} 0) scale(-1 1)` : undefined">
        <svg :x="hintX" :y="hintY" :width="hintWidth" :height="hintHeight" :viewBox="viewBox(hint)" overflow="hidden">
          <image :href="hint.url" :width="hint.width" :height="hint.height" :filter="`url(#${uid})`" />
        </svg>
      </g>
    </template>
  </g>
</template>
<script setup>
import { computed, getCurrentInstance } from 'vue'
import { noteRendering } from '../../presentation/SongNotePresentation.js'
const props = defineProps({ role: { type: String, required: true }, skin: { type: String, default: 'Note1SpriteAtlas' }, x: Number, y: Number, width: Number })
const uid = `note-hint-${getCurrentInstance().uid}`
const sprite = computed(() => noteRendering.skins[props.skin][props.role])
const aspect = s => (s.displayBounds[3] - s.displayBounds[1]) / (s.displayBounds[2] - s.displayBounds[0])
const viewBox = s => { const [x, y, r, b] = s.displayBounds; return `${x} ${y} ${r-x} ${b-y}` }
const bodyHeight = computed(() => props.width * aspect(sprite.value))
const hint = computed(() => props.role.startsWith('swipe_') ? noteRendering.hints[props.role === 'swipe_up' ? 'up' : 'right'] : null)
const color = computed(() => noteRendering.particles[props.role]?.startColor)
// This native mask stores its pale fill in alpha, while RGB stays white.
// Preserve the opaque white rim and tint the translucent center from the
// prefab's native color. Additive shader/animation remain unreconstructed.
const tintMatrix = computed(() => [color.value.r, color.value.g, color.value.b].map(v => `0 0 0 ${2-2*v} ${2*v-1}`).join(' ') + ' 0 0 0 1 0')
const hintWidth = computed(() => props.width * (props.role === 'swipe_up' ? .65 : .28))
const hintHeight = computed(() => hintWidth.value * aspect(hint.value))
const hintX = computed(() => props.role === 'swipe_up' ? props.x - hintWidth.value / 2 : props.x + props.width * .57)
const hintY = computed(() => props.role === 'swipe_up' ? props.y - bodyHeight.value / 2 - hintHeight.value * 1.12 : props.y - hintHeight.value / 2)
</script>
