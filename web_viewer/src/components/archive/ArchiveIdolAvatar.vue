<template>
  <span class="idol-avatar-shell" :style="avatarStyle">
    <span class="idol-avatar-clip">
      <img v-if="imageUrl && !imageFailed" :src="imageUrl" :alt="decorative ? '' : alt" loading="lazy" decoding="async" @error="onImageError" />
      <span v-else class="idol-avatar-fallback" aria-hidden="true">{{ fallbackText }}</span>
    </span>
  </span>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getCharaIconUrl, getMobileIconUrl } from '../../utils/AssetResolver.js'
import { normalizeIdolAccentColor } from '../../presentation/idolAccentColor.js'

const props = defineProps({
  idolCode: { type: String, default: '' },
  src: { type: String, default: '' },
  variant: { type: String, default: 'archive', validator: value => ['archive', 'mobile'].includes(value) },
  size: { type: Number, default: 52 },
  accentColor: { type: String, default: '' },
  ringWidth: { type: Number, default: 2 },
  gap: { type: Number, default: 2 },
  scale: { type: Number, default: 1.06 },
  alt: { type: String, default: '' },
  decorative: { type: Boolean, default: false },
  fallbackText: { type: String, default: '?' },
})
const emit = defineEmits(['error'])
const imageUrl = computed(() => props.src || (props.idolCode
  ? props.variant === 'mobile' ? getMobileIconUrl(props.idolCode) : getCharaIconUrl(props.idolCode)
  : ''))
const imageFailed = ref(false)
watch(imageUrl, () => { imageFailed.value = false })
const avatarStyle = computed(() => ({
  '--idol-avatar-base-size': `${props.size}px`,
  '--idol-avatar-color': normalizeIdolAccentColor(props.accentColor) || '#879a9e',
  '--idol-avatar-ring': `${props.ringWidth}px`,
  '--idol-avatar-gap': `${props.gap}px`,
  '--idol-avatar-scale': props.scale,
}))
function onImageError() { imageFailed.value = true; emit('error') }
</script>

<style scoped>
.idol-avatar-shell { --idol-avatar-size: var(--idol-avatar-override-size, var(--idol-avatar-base-size)); display: inline-block; flex: 0 0 var(--idol-avatar-size); width: var(--idol-avatar-size); height: var(--idol-avatar-size); box-sizing: border-box; padding: var(--idol-avatar-gap); border: var(--idol-avatar-ring) solid var(--idol-avatar-color); border-radius: 50%; background: #eef1f3; vertical-align: middle; }
.idol-avatar-clip { display: block; width: 100%; height: 100%; overflow: hidden; border-radius: 50%; }
.idol-avatar-clip img { display: block; width: 100%; height: 100%; object-fit: cover; transform: scale(var(--idol-avatar-scale)); }
.idol-avatar-fallback { display: grid; place-items: center; width: 100%; height: 100%; color: #526e73; font-size: max(12px, calc(var(--idol-avatar-size) * .35)); font-weight: 700; }
</style>
