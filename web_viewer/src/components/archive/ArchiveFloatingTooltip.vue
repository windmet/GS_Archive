<template>
  <Teleport to="body">
    <div v-if="anchor" :id="id" ref="panel" role="tooltip" class="archive-floating-tooltip" :style="position">
      <slot />
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { floatingOverlayPosition } from '../../presentation/FloatingOverlayPosition.mjs'

const props = defineProps({ anchor: Object, id: { type: String, required: true } })
const emit = defineEmits(['dismiss'])
const panel = ref(null), position = shallowRef({ visibility: 'hidden' })
let frame = 0, observer

function place() {
  frame = 0
  if (!props.anchor?.isConnected || !panel.value) return
  const visual = window.visualViewport
  const viewport = { left: visual?.offsetLeft || 0, top: visual?.offsetTop || 0, width: visual?.width || innerWidth, height: visual?.height || innerHeight }
  const anchor = props.anchor.getBoundingClientRect()
  const location = floatingOverlayPosition(anchor, panel.value.getBoundingClientRect(), viewport)
  position.value = { left: `${location.left}px`, top: `${location.top}px`, maxWidth: `${viewport.width - 16}px`, maxHeight: `${viewport.height - 16}px`, visibility: 'visible' }
}
function schedule() { if (!frame) frame = requestAnimationFrame(place) }
function dismiss() { if (props.anchor) emit('dismiss') }
watch(() => props.anchor, async () => {
  observer?.disconnect()
  position.value = { visibility: 'hidden' }
  await nextTick()
  if (!props.anchor || !panel.value) return
  observer?.observe(panel.value)
  observer?.observe(props.anchor)
  schedule()
})
onMounted(() => {
  observer = new ResizeObserver(schedule)
  // A scrolled-away trigger must never leave a detached tooltip over other content.
  window.addEventListener('scroll', dismiss, true)
  window.addEventListener('resize', schedule)
  window.visualViewport?.addEventListener('resize', schedule)
  window.visualViewport?.addEventListener('scroll', dismiss)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', dismiss, true)
  window.removeEventListener('resize', schedule)
  window.visualViewport?.removeEventListener('resize', schedule)
  window.visualViewport?.removeEventListener('scroll', dismiss)
})
</script>

<style scoped>
.archive-floating-tooltip { position: fixed; z-index: 1100; width: 260px; box-sizing: border-box; overflow: hidden; overflow-wrap: anywhere; padding: 12px; border: 1px solid #c8dcd8; border-radius: 8px; background: #fff; color: #254557; box-shadow: 0 8px 24px #122e4824; font: 12px/1.6 system-ui, sans-serif; pointer-events: none; }
</style>
