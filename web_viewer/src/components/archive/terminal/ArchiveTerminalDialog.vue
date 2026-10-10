<template>
  <dialog ref="dialog" class="terminal-dialog gs-dialog-motion" :aria-labelledby="titleId" @keydown.esc.stop.prevent="emit('close')" @cancel="emit('close')" @close="restoreFocus" @click="onBackdrop">
    <header class="terminal-dialog-header">
      <h2 :id="titleId">{{ title }}</h2>
      <button class="terminal-icon-button" type="button" aria-label="关闭" @click="emit('close')"><X :size="20" /></button>
    </header>
    <div class="terminal-dialog-body"><slot v-if="contentOpen" /></div>
  </dialog>
</template>
<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from '@lucide/vue'
const props = defineProps({ open: Boolean, title: String, titleId: { type: String, required: true } })
const emit = defineEmits(['close'])
const dialog = ref(null)
// The body stays mounted while the dialog fades out (gs-motion.css, 120ms), so it never collapses
// to an empty frame on its way out; it unmounts once the exit is over.
const EXIT_MS = 160
const contentOpen = ref(props.open)
let returnFocus = null, releaseTimer = 0
function restoreFocus() { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); returnFocus = null }
function onBackdrop(event) { if (event.target !== dialog.value) return; const box = dialog.value.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) emit('close') }
watch(() => props.open, async open => {
  clearTimeout(releaseTimer)
  if (open) contentOpen.value = true
  await nextTick()
  if (open && props.open && !dialog.value?.open) { returnFocus = document.activeElement; dialog.value?.showModal() }
  else if (!open && dialog.value?.open) dialog.value.close()
  if (!open) releaseTimer = setTimeout(() => { if (!props.open) contentOpen.value = false }, EXIT_MS)
}, { immediate: true })
onBeforeUnmount(() => { clearTimeout(releaseTimer); dialog.value?.close(); restoreFocus() })
</script>
<style>
/* Dialog L: a floating surface with a fixed header and a scrolling body. The class names are a
   contract: Chibi, photo, song and wallpaper dialogs restyle these parts with :deep(). */
.terminal-dialog { --dialog-block-gap: max(24px, var(--gs-safe-top), var(--gs-safe-bottom)); --dialog-inline-gap: max(16px, var(--gs-safe-left), var(--gs-safe-right)); box-sizing: border-box; width: min(var(--gs-surface-selector-width), calc(100% - var(--dialog-inline-gap) - var(--dialog-inline-gap))); max-height: calc(100% - var(--dialog-block-gap) - var(--dialog-block-gap)); padding: 0; overflow: hidden; border: 0; border-radius: var(--gs-radius-panel); background: var(--gs-surface); color: var(--gs-ink); font-family: var(--gs-font-body); box-shadow: var(--gs-shadow-float); }
.terminal-dialog *, .terminal-dialog *::before, .terminal-dialog *::after { box-sizing: border-box; }
.terminal-dialog[open] { display: flex; flex-direction: column; }
.terminal-dialog::backdrop { background: rgb(19 33 58 / 45%); }
.terminal-dialog-header { display: flex; flex: 0 0 auto; align-items: center; gap: var(--gs-space-5); padding: var(--gs-space-4) var(--gs-space-4) var(--gs-space-4) var(--gs-space-6); border-bottom: 1px solid var(--gs-line); }
.terminal-dialog-header h2 { flex: 1; min-width: 0; margin: 0; font-size: var(--gs-text-section); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.terminal-dialog-body { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: var(--gs-space-6); }
.terminal-icon-button { display: inline-grid; flex: 0 0 var(--gs-control-touch); place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); padding: 0; border: 0; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); font: inherit; cursor: pointer; }
.terminal-icon-button:hover { background: var(--gs-paper); }
.terminal-dialog :is(button, input, select, summary):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (max-width: 760px) { .terminal-dialog { --dialog-block-gap: max(10px, var(--gs-safe-top), var(--gs-safe-bottom)); --dialog-inline-gap: max(8px, var(--gs-safe-left), var(--gs-safe-right)); } .terminal-dialog-header { padding-left: var(--gs-space-5); } .terminal-dialog-body { padding: var(--gs-space-5); } }
</style>
