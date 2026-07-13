<template>
  <Teleport to="body">
    <div
      v-if="open && currentItem"
      class="lightbox-backdrop"
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
        <button :title="actualSize ? '适应窗口' : '原始尺寸'" @click="actualSize = !actualSize">
          <Minimize2 v-if="actualSize" :size="20" />
          <Maximize2 v-else :size="20" />
        </button>
        <button title="关闭" @click="emit('close')"><X :size="22" /></button>
      </header>

      <button
        v-if="items.length > 1"
        class="lightbox-nav previous"
        title="上一张"
        @click="move(-1)"
      >
        <ChevronLeft :size="30" />
      </button>

      <div class="lightbox-canvas" :class="{ actual: actualSize }">
        <img :src="currentItem.src" :alt="currentItem.label" />
      </div>

      <button
        v-if="items.length > 1"
        class="lightbox-nav next"
        title="下一张"
        @click="move(1)"
      >
        <ChevronRight :size="30" />
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from '@lucide/vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  initialIndex: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const currentIndex = ref(0)
const actualSize = ref(false)
let previousBodyOverflow = ''
const currentItem = computed(() => props.items[currentIndex.value] || null)

watch(() => [props.open, props.initialIndex, props.items.length], ([open, index]) => {
  if (!open) return
  currentIndex.value = Math.max(0, Math.min(props.items.length - 1, Number(index || 0)))
  actualSize.value = false
}, { immediate: true })

watch(() => props.open, open => {
  if (open) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = previousBodyOverflow
  }
})

function move(offset) {
  if (!props.items.length) return
  currentIndex.value = (currentIndex.value + offset + props.items.length) % props.items.length
  actualSize.value = false
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
.lightbox-backdrop { position: fixed; inset: 0; z-index: 2000; display: grid; grid-template-columns: 64px minmax(0, 1fr) 64px; grid-template-rows: 58px minmax(0, 1fr); background: rgba(9, 14, 18, 0.96); color: #fff; }
.lightbox-toolbar { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) 42px 42px; align-items: center; gap: 6px; padding: 0 12px 0 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.14); }
.lightbox-toolbar > div { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.lightbox-toolbar strong { overflow: hidden; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
.lightbox-toolbar span { color: #9ca8b0; font-size: 0.68rem; }
.lightbox-toolbar button, .lightbox-nav { display: grid; place-items: center; border: 0; background: transparent; color: #dce3e7; cursor: pointer; }
.lightbox-toolbar button { width: 42px; height: 42px; border-radius: 4px; }
.lightbox-toolbar button:hover, .lightbox-nav:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.lightbox-nav { grid-row: 2; align-self: stretch; width: 64px; }
.lightbox-nav.previous { grid-column: 1; }
.lightbox-nav.next { grid-column: 3; }
.lightbox-canvas { grid-column: 2; grid-row: 2; display: grid; place-items: center; min-width: 0; min-height: 0; overflow: auto; padding: 18px; }
.lightbox-canvas img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
.lightbox-canvas.actual { display: block; }
.lightbox-canvas.actual img { max-width: none; max-height: none; margin: auto; }

@media (max-width: 560px) {
  .lightbox-backdrop { grid-template-columns: 46px minmax(0, 1fr) 46px; }
  .lightbox-nav { width: 46px; }
  .lightbox-canvas { padding: 8px; }
}
</style>
