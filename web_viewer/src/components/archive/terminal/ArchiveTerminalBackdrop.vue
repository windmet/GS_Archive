<template>
  <div class="terminal-backdrop" aria-hidden="true">
    <picture v-if="wallpaper && !failed" :key="wallpaper.id">
      <source media="(max-width: 1100px) and (orientation: portrait)" :srcset="wallpaper.portrait.url" />
      <img :src="wallpaper.landscape.url" alt="" decoding="async" :style="positionStyle" @error="failImage" />
    </picture>
    <div v-else class="terminal-neutral"><span>315</span></div>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
const props = defineProps({ wallpaper: { type: Object, default: null } })
const failed = ref(false)
const emit = defineEmits(['error'])
function failImage() { failed.value = true; emit('error') }
watch(() => props.wallpaper?.id, () => { failed.value = false })
const pair = v => Array.isArray(v) && v.length === 2 && v.every(x => Number.isFinite(x) && x >= 0 && x <= 100) ? `${v[0]}% ${v[1]}%` : '50% 40%'
const positionStyle = computed(() => ({ '--art-position-wide': pair(props.wallpaper?.landscape?.position), '--art-position-tall': pair(props.wallpaper?.portrait?.position) }))
</script>
