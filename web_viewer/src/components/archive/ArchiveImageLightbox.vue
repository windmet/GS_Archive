<template>
  <Teleport to="body">
    <Transition name="gs-overlay">
    <div
      v-if="open && currentItem"
      class="lightbox-backdrop gs-enter-backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="currentItem.label || '卡面原图'"
      @click.self="emit('close')"
    >
      <header class="lightbox-toolbar">
        <div>
          <strong>{{ currentItem.label }}</strong>
          <span>{{ currentIndex + 1 }} / {{ items.length }}</span>
        </div>
        <button
          type="button"
          :aria-label="actualSize ? '适应窗口' : '原始尺寸'"
          :title="actualSize ? '适应窗口' : '原始尺寸'"
          @click="actualSize = !actualSize"
        >
          <Minimize2 v-if="actualSize" :size="20" aria-hidden="true" />
          <Maximize2 v-else :size="20" aria-hidden="true" />
        </button>
        <button ref="closeButton" type="button" aria-label="关闭原图" title="关闭" @click="emit('close')"><X :size="22" aria-hidden="true" /></button>
      </header>

      <button
        v-if="items.length > 1"
        type="button"
        class="lightbox-nav previous"
        aria-label="上一张"
        title="上一张"
        @click="move(-1)"
      >
        <ChevronLeft :size="30" aria-hidden="true" />
      </button>

      <div class="lightbox-canvas" :class="{ actual: actualSize }" @click.self="emit('close')" @pointerdown="swipeStart" @pointerup="swipeEnd" @pointercancel="swipe = null">
        <img :src="currentItem.src" :alt="currentItem.label" />
      </div>

      <button
        v-if="items.length > 1"
        type="button"
        class="lightbox-nav next"
        aria-label="下一张"
        title="下一张"
        @click="move(1)"
      >
        <ChevronRight :size="30" aria-hidden="true" />
      </button>
    </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from '@lucide/vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  initialIndex: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const currentIndex = ref(0)
const actualSize = ref(false)
const closeButton = ref(null)
let previousBodyOverflow = ''
let opener = null
const currentItem = computed(() => props.items[currentIndex.value] || null)

watch(() => [props.open, props.initialIndex, props.items.length], ([open, index]) => {
  if (!open) return
  currentIndex.value = Math.max(0, Math.min(props.items.length - 1, Number(index || 0)))
  actualSize.value = false
}, { immediate: true })

watch(() => props.open, open => {
  if (open) {
    opener = globalThis.document?.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nextTick(() => closeButton.value?.focus({ preventScroll: true }))
  } else {
    document.body.style.overflow = previousBodyOverflow
    if (opener?.isConnected) opener.focus({ preventScroll: true })
    opener = null
  }
})

function move(offset) {
  if (!props.items.length) return
  currentIndex.value = (currentIndex.value + offset + props.items.length) % props.items.length
  actualSize.value = false
}

// Phones: a horizontal swipe on the picture moves to the next or previous one; two fingers zoom it
// (touch-action pinch-zoom), and a swipe is ignored while zoomed or at original size.
const swipe = ref(null)
function swipeStart(event) {
  if (event.pointerType !== 'touch' || !event.isPrimary) return
  swipe.value = { x: event.clientX, y: event.clientY }
}
function swipeEnd(event) {
  const start = swipe.value
  swipe.value = null
  if (!start || actualSize.value || (globalThis.visualViewport?.scale || 1) > 1.01) return
  const dx = event.clientX - start.x, dy = event.clientY - start.y
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1)
}

function onKeydown(event) {
  if (!props.open) return
  if (event.key === 'Escape') emit('close')
  else if (event.key === 'ArrowLeft') move(-1)
  else if (event.key === 'ArrowRight') move(1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = previousBodyOverflow
})
</script>

<style scoped>
.lightbox-backdrop { position: fixed; inset: 0; z-index: 2000; display: grid; grid-template-columns: 64px minmax(0, 1fr) 64px; grid-template-rows: calc(56px + var(--gs-safe-top)) minmax(0, 1fr); padding-bottom: var(--gs-safe-bottom); background: color-mix(in srgb, var(--gs-media-backdrop) 96%, transparent); color: var(--gs-media-ink); }
.lightbox-toolbar { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) var(--gs-control-touch) var(--gs-control-touch); align-items: center; gap: var(--gs-space-2); padding: var(--gs-safe-top) max(var(--gs-space-4), var(--gs-safe-right)) 0 max(var(--gs-space-5), var(--gs-safe-left)); border-bottom: 1px solid var(--gs-media-line); }
.lightbox-toolbar > div { display: flex; align-items: baseline; gap: var(--gs-space-3); min-width: 0; }
.lightbox-toolbar strong { overflow: hidden; font-size: var(--gs-text-ui); text-overflow: ellipsis; white-space: nowrap; }
.lightbox-toolbar span { flex: none; color: var(--gs-media-ink-2); font-family: var(--gs-font-stage); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.lightbox-toolbar button, .lightbox-nav { display: grid; place-items: center; border: 0; background: transparent; color: var(--gs-media-ink-2); cursor: pointer; }
.lightbox-toolbar button { width: var(--gs-control-touch); height: var(--gs-control-touch); border-radius: var(--gs-radius-control); }
.lightbox-toolbar button:focus-visible, .lightbox-nav:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (hover: hover) {
  .lightbox-toolbar button:hover, .lightbox-nav:hover { background: var(--gs-media-hover); color: var(--gs-media-ink); }
}
.lightbox-nav { grid-row: 2; align-self: stretch; width: 64px; }
.lightbox-nav.previous { grid-column: 1; }
.lightbox-nav.next { grid-column: 3; }
.lightbox-canvas { grid-column: 2; grid-row: 2; display: grid; place-items: center; min-width: 0; min-height: 0; overflow: auto; padding: var(--gs-space-5); }
.lightbox-canvas img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; touch-action: pinch-zoom; }
.lightbox-canvas.actual { display: block; }
.lightbox-canvas.actual img { max-width: none; max-height: none; margin: auto; }

@media (max-width: 760px) {
  .lightbox-backdrop { grid-template-columns: var(--gs-control-touch) minmax(0, 1fr) var(--gs-control-touch); }
  .lightbox-nav { width: var(--gs-control-touch); }
  .lightbox-canvas { padding: var(--gs-space-3); }
}
</style>
