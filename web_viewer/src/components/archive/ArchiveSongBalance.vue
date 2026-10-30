<template>
  <details ref="root" class="song-balance" :open="open" @toggle="open = $event.target.open">
    <summary :aria-label="label" :title="label"><component :is="layered ? SlidersHorizontal : Volume2" :size="18" aria-hidden="true" /></summary>
    <!-- Rendered only while open: a shut <details> still lays its content out, so the layer would sit on the lyrics rule. -->
    <div v-if="open" class="song-balance-panel"><slot /></div>
  </details>
</template>

<script setup>
import { SlidersHorizontal, Volume2 } from '@lucide/vue'
import { onBeforeUnmount, ref, watch } from 'vue'

// The console's volume: one slider for a single track, vocal and backing for stems; a small layer, not a row.
const props = defineProps({ layered: Boolean })
const label = props.layered ? '音轨平衡' : '音量'
const root = ref(null), open = ref(false)
function closeOutside(event) { if (root.value && !root.value.contains(event.target)) open.value = false }
watch(open, value => {
  if (value) document.addEventListener('pointerdown', closeOutside)
  else document.removeEventListener('pointerdown', closeOutside)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))
</script>

<style scoped>
.song-balance { position: relative; }
.song-balance summary { display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); border-radius: var(--gs-radius-pill); color: var(--gs-ink-2); list-style: none; cursor: pointer; }
.song-balance summary::-webkit-details-marker { display: none; }
@media (hover: hover) { .song-balance summary:hover { background: var(--gs-mint-wash); color: var(--gs-ink); } }
.song-balance[open] summary { color: var(--gs-mint-ink); }
.song-balance summary:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.song-balance-panel { position: absolute; top: 100%; right: 0; z-index: 4; display: grid; gap: var(--gs-space-4); width: 220px; margin-top: var(--gs-space-1); padding: var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); box-shadow: var(--gs-shadow-float); }
.song-balance-panel :slotted(label) { display: grid; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.song-balance-panel :slotted(input) { width: 100%; accent-color: var(--gs-mint-ink); }
</style>
