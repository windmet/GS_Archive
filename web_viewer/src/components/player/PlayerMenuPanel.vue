<template>
  <div class="player-modal-layer" @keydown.stop="onKeydown">
    <button class="player-modal-backdrop" data-testid="player-menu-backdrop" tabindex="-1" :aria-label="closeLabel" @click.stop="emit('close')" />
    <section ref="panel" class="player-menu-panel" data-testid="player-menu-panel" role="dialog" aria-modal="true" aria-labelledby="player-menu-title">
      <header><div><strong id="player-menu-title">{{ title }}</strong><small>{{ pausedLabel }}</small></div><button ref="closeButton" data-testid="player-menu-close" :aria-label="closeLabel" @click="emit('close')">×</button></header>
      <div class="player-menu-scroll" data-testid="player-menu-scroll" :data-scroll-input="scrollInput" :data-scroll-input-count="scrollInputCount" @wheel.passive="recordInput('wheel')" @touchmove.passive="recordInput('touch')"><slot /></div>
    </section>
  </div>
</template>
<script setup>
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { trapDialogKey } from './dialogFocus.js'
defineProps({ title: String, pausedLabel: String, closeLabel: String })
const emit = defineEmits(['close'])
const panel = ref(null), closeButton = ref(null)
const scrollInput = ref(''), scrollInputCount = ref(0)
function recordInput(kind) { scrollInput.value = kind; scrollInputCount.value++ }
let trigger
onMounted(() => { trigger = document.activeElement; closeButton.value?.focus({ preventScroll: true }) })
onBeforeUnmount(() => { const previous = trigger; nextTick(() => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true }) }) })
function onKeydown(event) { trapDialogKey(event, panel.value, () => emit('close')) }
</script>
<style scoped>
.player-modal-layer { position:absolute; inset:0; z-index:40; overflow:hidden; }
.player-modal-backdrop { position:absolute; inset:0; width:100%; height:100%; padding:0; border:0; background:rgba(235,244,242,.24); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); cursor:default; }
.player-menu-panel { box-sizing:border-box; position:absolute; inset-block:0; inset-inline-end:0; width:min(340px,92%); height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); overflow:hidden; border-left:1px solid var(--gs-line); background:var(--gs-paper); color:var(--gs-ink); font-family:var(--gs-font-jp); box-shadow:var(--gs-shadow-float); }
header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:max(10px,env(safe-area-inset-top)) 16px 10px; border-bottom:1px solid var(--gs-line); }
header div { display:flex; align-items:baseline; flex-wrap:wrap; gap:10px; } header strong { font-size:var(--gs-text-section); } header small { color:var(--gs-ink-3); font-size:var(--gs-text-meta); }
header button { min-width:44px; min-height:44px; border:0; background:transparent; color:inherit; font-size:var(--gs-text-title); cursor:pointer; }
.player-menu-scroll { min-height:0; min-width:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior-y:contain; touch-action:pan-y pinch-zoom; scrollbar-gutter:stable; padding:4px 16px max(16px,env(safe-area-inset-bottom)); }
/* Menu entries are rows on the panel, separated by hairlines — not boxes. */
.player-menu-scroll :deep(button), .player-menu-scroll :deep(.menu-toggle) { display:flex; align-items:center; gap:10px; width:100%; min-height:44px; padding:8px 4px; margin:0; border:0; border-bottom:1px solid var(--gs-line); border-radius:0; background:none; color:var(--gs-ink); font:inherit; text-align:start; cursor:pointer; box-sizing:border-box; }
.player-menu-scroll :deep(button:hover) { color:var(--gs-mint-ink); }
.player-menu-scroll :deep(button b) { margin-left:auto; color:var(--gs-ink-3); font-size:var(--gs-text-meta); font-weight:500; }
.player-menu-scroll :deep(button.active) { color:var(--gs-mint-ink); font-weight:700; box-shadow:inset 3px 0 0 var(--gs-mint); padding-inline-start:12px; }
.player-menu-scroll :deep(.menu-toggle) { justify-content:space-between; }
.player-menu-scroll :deep(.menu-toggle input) { width:24px; height:24px; accent-color:var(--gs-mint-ink); }
.player-menu-scroll :deep(.menu-setting) { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; min-height:44px; padding:8px 4px; margin:0; border:0; border-bottom:1px solid var(--gs-line); border-radius:0; background:none; font-size:var(--gs-text-body); }
.player-menu-scroll :deep(select), .player-menu-scroll :deep(input:not([type=checkbox])) { box-sizing:border-box; min-height:44px; min-width:0; max-width:100%; width:150px; padding:6px; border:1px solid var(--gs-line); border-radius:var(--gs-radius-field); background:var(--gs-surface); color:var(--gs-ink); font:inherit; }
.player-menu-scroll :deep(button:disabled) { opacity:.55; cursor:default; }
.player-menu-panel :deep(:focus-visible) { outline:2px solid var(--gs-mint-ink); outline-offset:2px; }
@supports not (backdrop-filter:blur(3px)) { .player-modal-backdrop { background:rgba(226,238,235,.38); } }
</style>
