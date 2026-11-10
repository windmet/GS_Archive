<template>
  <span ref="root" class="gs-info" @pointerenter="e => { if (e.pointerType === 'mouse') hover = true }" @pointerleave="e => { if (e.pointerType === 'mouse') hover = false }" @keydown.esc="close">
    <button ref="trigger" type="button" class="gs-info-button" :aria-label="label" :aria-expanded="shown" :aria-describedby="shown ? id : undefined" @click="toggle" @focus="focus" @blur="focused = false"><Info :size="14" aria-hidden="true" /></button>
    <span v-if="shown" ref="bubble" :id="id" role="tooltip" popover="manual" class="gs-info-bubble" :style="position"><slot /></span>
  </span>
</template>
<script>
let infoCount = 0
</script>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Info } from '@lucide/vue'
import { floatingOverlayPosition } from '../../presentation/FloatingOverlayPosition.mjs'
// "How to use this" in at most two lines, shown on hover, keyboard focus or tap. Anything longer
// ("what is this based on") belongs in maintainer mode or the About page, not here.
// The bubble opens in the top layer (popover) at viewport coordinates, so no overflow, dialog,
// sheet or screen edge can clip it; pages never position it themselves.
defineProps({ label: { type: String, default: '说明' } })
const id = `gs-info-${++infoCount}`
const root = ref(null), trigger = ref(null), bubble = ref(null)
const hover = ref(false), focused = ref(false), pinned = ref(false)
const shown = computed(() => hover.value || focused.value || pinned.value)
const position = shallowRef({ visibility: 'hidden' })
let frame = 0, last = ''
// Phones replay mouse events after a tap, so only a real mouse (pointer events) counts as hover. A tap also focuses the
// button, but only keyboard focus (:focus-visible) opens the bubble; closing a pinned bubble drops focus and, for a
// non-mouse press, hover, so no stale flag keeps it open.
function focus() { focused.value = trigger.value?.matches(':focus-visible') ?? true }
function toggle(event) {
  pinned.value = !pinned.value
  if (pinned.value) return
  focused.value = false
  if (event.pointerType !== 'mouse') hover.value = false
}
function close() { pinned.value = false; hover.value = false; focused.value = false }
// While open, follow the trigger every frame: scrolling, resizing, and a sheet or drawer still
// sliding in all move it without a scroll or resize event.
function follow() {
  frame = requestAnimationFrame(follow)
  const node = bubble.value
  if (!node || !trigger.value?.isConnected) return
  const anchor = trigger.value.getBoundingClientRect(), size = node.getBoundingClientRect()
  const visual = window.visualViewport
  const viewport = { left: visual?.offsetLeft || 0, top: visual?.offsetTop || 0, width: visual?.width || innerWidth, height: visual?.height || innerHeight }
  const key = [anchor.left, anchor.top, anchor.bottom, size.width, size.height, viewport.left, viewport.top, viewport.width, viewport.height].join()
  if (key === last) return
  last = key
  const spot = floatingOverlayPosition(anchor, size, viewport)
  position.value = { left: `${spot.left}px`, top: `${spot.top}px`, visibility: 'visible' }
}
// A tapped-open bubble closes on the next tap anywhere else.
function outside(event) { if (pinned.value && !root.value?.contains(event.target)) close() }
function stop() { cancelAnimationFrame(frame); frame = 0; last = ''; document.removeEventListener('pointerdown', outside, true) }
watch(shown, async open => {
  stop()
  if (!open) { position.value = { visibility: 'hidden' }; return }
  await nextTick()
  if (!bubble.value) return
  try { bubble.value.showPopover?.() } catch { /* already open: fixed positioning still applies */ }
  document.addEventListener('pointerdown', outside, true)
  follow()
})
onBeforeUnmount(stop)
</script>
<style scoped>
/* The bubble wraps on its own even under a nowrap label or table header, which would push the text past its card. */
.gs-info { position: relative; display: inline-flex; vertical-align: middle; }
.gs-info-button { position: relative; display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--gs-ink-3); cursor: pointer; }
@media (hover: hover) and (pointer: fine) { .gs-info-button:hover { background: var(--gs-hover); color: var(--gs-ink-2); } }
.gs-info-button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* 24px glyph, 44px target on touch: the extension is invisible and does not change layout. Neighbours sit at least 10px away. */
@media (pointer: coarse) { .gs-info-button::before { content: ''; position: absolute; inset: -10px; } }
/* inset / margin / border reset the popover UA box; left / top come from follow(). */
.gs-info-bubble { position: fixed; inset: auto; z-index: 1100; box-sizing: border-box; width: max-content; max-width: min(260px, calc(100vw - 2 * var(--gs-space-4))); margin: 0; padding: var(--gs-space-3) var(--gs-space-4); overflow: visible; overflow-wrap: anywhere; white-space: normal; border: 0; border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-2); box-shadow: var(--gs-shadow-console); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); line-height: var(--gs-leading-ui); text-align: left; pointer-events: none; }
</style>
