<template>
  <span class="idol-avatar-shell" :class="ringClass" :style="avatarStyle">
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
  // Unified ring constitution:
  // - 'group': quiet paper-gap + faint navy ring (unselected/list/crowds, or when no idol color exists)
  // - 'identity': white gap + idol accent color border (single showcase / owner / 担当)
  // - 'selected': white gap + bold 2.5px idol accent ring (current / selected interactive state)
  ring: { type: String, default: '', validator: value => ['', 'group', 'identity', 'selected'].includes(value) },
  ringWidth: { type: Number, default: 2 },
  gap: { type: Number, default: 2 },
  scale: { type: Number, default: 1.12 },
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
const normalizedAccent = computed(() => normalizeIdolAccentColor(props.accentColor))
const resolvedRing = computed(() => {
  if (props.ring === 'selected') return 'selected'
  if (props.ring === 'group' || !props.ringWidth) return 'group'
  return normalizedAccent.value ? 'identity' : 'group'
})
const ringClass = computed(() => ({
  'is-plain': resolvedRing.value === 'group',
  'is-identity': resolvedRing.value === 'identity',
  'is-selected': resolvedRing.value === 'selected',
}))
const avatarStyle = computed(() => ({
  '--idol-avatar-base-size': `${props.size}px`,
  '--idol-avatar-color': normalizedAccent.value || 'var(--gs-mint)',
  '--idol-avatar-ring': `${props.ringWidth}px`,
  '--idol-avatar-gap': `${props.gap}px`,
  '--idol-avatar-scale': props.scale,
}))
function onImageError() { imageFailed.value = true; emit('error') }
</script>

<style scoped>
.idol-avatar-shell { --idol-avatar-size: var(--idol-avatar-override-size, var(--idol-avatar-base-size)); display: inline-block; flex: 0 0 var(--idol-avatar-size); width: var(--idol-avatar-size); height: var(--idol-avatar-size); box-sizing: border-box; padding: var(--idol-avatar-gap); border: var(--idol-avatar-ring) solid var(--idol-avatar-color); border-radius: 50%; background: var(--gs-surface); vertical-align: middle; transition: box-shadow var(--gs-motion-feedback) var(--gs-ease-out), border-color var(--gs-motion-feedback) var(--gs-ease-out); }
.idol-avatar-clip { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; border-radius: 50%; }
/* Unified 3-ring constitution:
   - is-plain (group): quiet paper-gap + faint navy edge; never falls back to a muddy grey border.
   - is-identity: white gap + idol colour border (rules above).
   - is-selected: white gap + bold 2.5px idol accent ring (same inner diameter as is-plain, so toggling never jumps). */
.idol-avatar-shell.is-plain { padding: 0; border: 0; background: var(--gs-paper-2); box-shadow: var(--gs-ring-group); }
.idol-avatar-shell.is-selected { padding: 0; border: 0; background: var(--gs-surface); box-shadow: 0 0 0 2px var(--gs-surface), 0 0 0 4.5px var(--idol-avatar-color); }
.idol-avatar-clip img { display: block; width: 100%; height: 100%; object-fit: cover; transform: scale(var(--idol-avatar-scale)); }
.idol-avatar-fallback { display: grid; place-items: center; width: 100%; height: 100%; color: var(--gs-ink-2); font-size: max(12px, calc(var(--idol-avatar-size) * .35)); font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .idol-avatar-shell { transition: none; } }
</style>
