<template>
  <section class="experiment-frame" :aria-label="title">
    <header><button type="button" @click="$emit('back')"><ArrowLeft :size="18" />{{ backLabel }}</button><h1>{{ title }}</h1><span>实验室</span></header>
    <main><slot /></main>
  </section>
</template>
<script setup>
import { ArrowLeft } from '@lucide/vue'
defineProps({ title: String, backLabel: { type: String, default: '返回来源页' } })
defineEmits(['back'])
</script>
<style scoped>
.experiment-frame { position: absolute; inset: 0; display: flex; flex-direction: column; background: #f3f7f8; color: #1c3945; }
header { display: flex; align-items: center; gap: 12px; padding: max(8px, env(safe-area-inset-top)) 12px 8px; border-bottom: 1px solid #cadce1; background: white; }
button { display: flex; align-items: center; gap: 6px; flex-shrink: 0; min-height: 44px; padding: 8px 12px; border: 1px solid #cadce1; border-radius: 7px; color: #166e71; background: white; font: inherit; cursor: pointer; }
button:focus-visible { outline: 3px solid #007caa; outline-offset: 2px; }
h1 { font-size: 16px; margin: 0; min-width: 0; overflow-wrap: anywhere; }
header > span { margin-left: auto; font-size: 12px; color: #6a7e89; white-space: nowrap; }
main { flex: 1; min-height: 0; overflow: auto; padding-bottom: env(safe-area-inset-bottom); }
@media(max-width:560px) { header { gap: 8px; } header > span { display: none; } h1 { font-size: 14px; } }
</style>
