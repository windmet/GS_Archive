<template>
  <div v-if="wallpaper && !failed" class="terminal-backdrop" aria-hidden="true">
    <picture :key="wallpaper.id">
      <source v-if="!landscapeOnly" media="(max-width: 1100px) and (orientation: portrait)" :srcset="wallpaper.portrait.url" />
      <img :src="wallpaper.landscape.url" alt="" decoding="async" :style="positionStyle" @error="failImage" />
    </picture>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
// The chosen SSR card behind the portal. Nothing renders without one; the caller keeps its plain paper.
const props = defineProps({ wallpaper: { type: Object, default: null }, landscapeOnly: Boolean })
const failed = ref(false)
const emit = defineEmits(['error'])
function failImage() { failed.value = true; emit('error') }
watch(() => props.wallpaper?.id, () => { failed.value = false })
const pair = v => Array.isArray(v) && v.length === 2 && v.every(x => Number.isFinite(x) && x >= 0 && x <= 100) ? `${v[0]}% ${v[1]}%` : '50% 40%'
const positionStyle = computed(() => ({ '--art-position-wide': pair(props.wallpaper?.landscape?.position), '--art-position-tall': pair(props.wallpaper?.portrait?.position) }))
</script>
<style>
.terminal-backdrop { position: absolute; z-index: -1; inset: 0; overflow: hidden; pointer-events: none; }
.terminal-backdrop picture, .terminal-backdrop img { display: block; width: 100%; height: 100%; }
.terminal-backdrop img { object-fit: cover; object-position: var(--art-position-wide, 50% 40%); }
@media (max-width: 1100px) and (orientation: portrait) { .terminal-backdrop img { object-position: var(--art-position-tall, 50% 35%); } }
</style>
