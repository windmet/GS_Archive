<template>
  <div class="player-modal-layer" @keydown.stop="onKeydown">
    <button class="player-modal-backdrop" data-testid="player-menu-backdrop" tabindex="-1" :aria-label="closeLabel" @click.stop="emit('close')" />
    <section ref="panel" class="player-menu-panel" data-testid="player-menu-panel" role="dialog" aria-modal="true" aria-labelledby="player-menu-title">
      <header><div><strong id="player-menu-title">{{ title }}</strong><small>{{ pausedLabel }}</small></div><button ref="closeButton" data-testid="player-menu-close" :aria-label="closeLabel" @click="emit('close')">×</button></header>
      <div class="player-menu-scroll" data-testid="player-menu-scroll"><slot /></div>
    </section>
  </div>
</template>
<script setup>
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { trapDialogKey } from './dialogFocus.js'
defineProps({ title: String, pausedLabel: String, closeLabel: String })
const emit = defineEmits(['close'])
const panel = ref(null), closeButton = ref(null)
let trigger
onMounted(() => { trigger = document.activeElement; closeButton.value?.focus({ preventScroll: true }) })
onBeforeUnmount(() => { const previous = trigger; nextTick(() => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true }) }) })
function onKeydown(event) { trapDialogKey(event, panel.value, () => emit('close')) }
</script>
<style scoped>
.player-modal-layer { position:absolute; inset:0; z-index:40; overflow:hidden; }
.player-modal-backdrop { position:absolute; inset:0; width:100%; height:100%; padding:0; border:0; background:rgba(235,244,242,.24); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); cursor:default; }
.player-menu-panel { box-sizing:border-box; position:absolute; inset-block:0; inset-inline-end:0; width:min(340px,92%); height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); overflow:hidden; border-left:1px solid #dfe5e7; background:rgba(248,250,251,.98); color:#26343c; box-shadow:-10px 0 30px rgba(0,0,0,.22); }
header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:max(10px,env(safe-area-inset-top)) 16px 10px; border-bottom:1px solid #dfe5e7; }
header div { display:flex; align-items:center; flex-wrap:wrap; gap:10px; } header strong { font-size:18px; } header small { color:#526e69; font-size:13px; }
header button { min-width:44px; min-height:44px; border:0; background:transparent; color:inherit; font-size:28px; cursor:pointer; }
.player-menu-scroll { min-height:0; min-width:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior-y:contain; touch-action:pan-y pinch-zoom; scrollbar-gutter:stable; padding:12px 16px max(16px,env(safe-area-inset-bottom)); }
.player-menu-scroll :deep(button), .player-menu-scroll :deep(.menu-toggle) { display:flex; align-items:center; gap:10px; width:100%; min-height:44px; padding:8px 12px; margin:8px 0; border:1px solid #dce3e6; border-radius:5px; background:#fff; color:#26343c; font:inherit; cursor:pointer; box-sizing:border-box; }
.player-menu-scroll :deep(button b) { margin-left:auto; color:#718087; font-size:12px; }
.player-menu-scroll :deep(button.active) { border-color:#33aa92; background:#e9f8f4; color:#167a67; }
.player-menu-scroll :deep(.menu-toggle) { justify-content:space-between; }
.player-menu-scroll :deep(.menu-toggle input) { width:24px; height:24px; accent-color:#12a87d; }
.player-menu-scroll :deep(.menu-setting) { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; min-height:44px; padding:8px 12px; margin:8px 0; border:1px solid #e3e8ea; border-radius:5px; background:#f7f9fa; font-size:14px; }
.player-menu-scroll :deep(select), .player-menu-scroll :deep(input:not([type=checkbox])) { box-sizing:border-box; min-height:44px; min-width:0; max-width:100%; width:150px; padding:6px; border:1px solid #ccd5d9; border-radius:4px; background:white; color:#26343c; font:inherit; }
.player-menu-scroll :deep(button:disabled) { opacity:.55; cursor:default; }
.player-menu-panel :deep(:focus-visible) { outline:2px solid #168f98; outline-offset:2px; }
@supports not (backdrop-filter:blur(3px)) { .player-modal-backdrop { background:rgba(226,238,235,.38); } }
</style>
