<template>
  <dialog ref="dialog" class="terminal-dialog" :aria-labelledby="titleId" @keydown.esc.stop.prevent="emit('close')" @cancel="emit('close')" @close="restoreFocus" @click="onBackdrop">
    <header class="terminal-dialog-header">
      <h2 :id="titleId">{{ title }}</h2>
      <button class="terminal-icon-button" type="button" aria-label="关闭" @click="emit('close')"><X :size="20" /></button>
    </header>
    <div class="terminal-dialog-body"><slot v-if="open" /></div>
  </dialog>
</template>
<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from '@lucide/vue'
const props = defineProps({ open: Boolean, title: String, titleId: { type: String, required: true } })
const emit = defineEmits(['close'])
const dialog = ref(null)
let returnFocus = null
function restoreFocus() { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); returnFocus = null }
function onBackdrop(event) { if (event.target !== dialog.value) return; const box = dialog.value.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) emit('close') }
watch(() => props.open, async open => {
  await nextTick()
  if (open && props.open && !dialog.value?.open) { returnFocus = document.activeElement; dialog.value?.showModal() }
  else if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })
onBeforeUnmount(() => { dialog.value?.close(); restoreFocus() })
</script>
