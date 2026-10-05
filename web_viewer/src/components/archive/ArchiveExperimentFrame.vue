<template>
  <section class="experiment-frame" :aria-label="title">
    <header><button type="button" @click="$emit('back')"><ArrowLeft :size="18" />{{ backLabel }}</button><h1>{{ title }}</h1><span>工具</span><ArchiveLanguageSwitch /></header>
    <main><slot /></main>
  </section>
</template>
<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import { ArrowLeft } from '@lucide/vue'
defineProps({ title: String, backLabel: { type: String, default: '返回来源页' } })
defineEmits(['back'])
</script>
<style scoped>
/* Full-screen tool frame: a plain archive top bar over the tool. */
.experiment-frame { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--gs-paper); color: var(--gs-ink); font-family: var(--gs-font-body); }
header { display: flex; align-items: center; gap: var(--gs-space-4); padding: max(var(--gs-space-3), env(safe-area-inset-top)) var(--gs-space-4) var(--gs-space-3); border-bottom: 1px solid var(--gs-line); background: var(--gs-paper); }
button { display: flex; flex-shrink: 0; align-items: center; gap: 6px; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
h1 { min-width: 0; margin: 0; font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
header > span { margin-left: auto; color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
main { flex: 1; min-height: 0; overflow: auto; padding-bottom: env(safe-area-inset-bottom); }
@media (max-width: 760px) { header { gap: var(--gs-space-3); } header > span { display: none; } }
</style>
