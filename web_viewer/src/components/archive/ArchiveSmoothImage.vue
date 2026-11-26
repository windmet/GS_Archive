<template>
  <span class="gs-smooth-image" :class="{ 'is-pending': pending }">
    <img v-if="displaySrc" class="gs-smooth-base" :src="displaySrc" :alt="alt" :decoding="decoding" :loading="loading" @error="emit('error', $event)" />
    <img v-if="overlaySrc" class="gs-smooth-overlay" :src="overlaySrc" data-gs-loaded alt="" decoding="async" aria-hidden="true" />
  </span>
</template>

<script setup>
import { useSmoothImage } from '../../composables/useSmoothImage.js'

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  decoding: { type: String, default: 'async' },
  loading: { type: String, default: undefined },
})
const emit = defineEmits(['error'])
const { displaySrc, overlaySrc, pending } = useSmoothImage(() => props.src)
</script>

<style scoped>
.gs-smooth-image { position: relative; display: block; width: 100%; height: 100%; }
.gs-smooth-image img { display: block; width: 100%; height: 100%; object-fit: inherit; object-position: inherit; }
.gs-smooth-overlay { position: absolute; inset: 0; pointer-events: none; animation: gs-fade-in var(--gs-motion-enter) var(--gs-ease-out) backwards; }
@media (prefers-reduced-motion: reduce) { .gs-smooth-overlay { animation: none; } }
</style>
