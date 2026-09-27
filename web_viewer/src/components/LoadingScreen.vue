<template>
  <transition name="load-fade">
    <div v-if="visible" class="loading-screen" :class="`loading-screen--${surface}`">
      <div class="loading-box">
        <GsLoadingIndicator :message="displayMessage" :tone="surface === 'archive' ? 'light' : 'dark'" />
        <div v-if="critical.total || slow" class="loading-details" aria-live="polite">
          <p v-if="critical.total" class="load-count">当前段落资源：{{ critical.ready }} / {{ critical.total }}</p>
          <p v-if="critical.total && critical.ready === critical.total" class="load-count">资源已预载，正在准备画面与语音…</p>
          <p v-if="slow" class="load-count">{{ canCancel ? '加载较慢，可继续等待，或取消后重试。' : '加载较慢，可继续等待。' }}</p>
        </div>
        <button v-if="canCancel" type="button" class="load-cancel" @click.stop="$emit('cancel')">取消并返回</button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { criticalPreloadProgress } from '../presentation/LoadingPresentation.js'
import GsLoadingIndicator from './GsLoadingIndicator.vue'

defineEmits(['cancel'])
const props = defineProps({
  canCancel: Boolean,
  visible: { type: Boolean, default: false },
  status: { type: Object, default: null },
  readiness: { type: Object, default: null },
  message: { type: String, default: '正在读取资料馆数据…' },
  // Appearance only. No view/route readiness is decided inside this component.
  surface: { type: String, default: 'archive', validator: value => ['archive', 'player', 'stage'].includes(value) },
})
const slow = ref(false)
let slowTimer
watch(() => props.visible, visible => {
  clearTimeout(slowTimer)
  slow.value = false
  // Preserve the existing 8s message, without creating timers during SSR tests.
  if (visible && typeof window !== 'undefined') slowTimer = setTimeout(() => { slow.value = true }, 8000)
}, { immediate: true })
onUnmounted(() => clearTimeout(slowTimer))
const critical = computed(() => criticalPreloadProgress(props.status))
const displayMessage = computed(() => props.readiness?.status === 'waiting' ? '正在准备当前画面…' : props.message)
</script>

<style scoped>
.loading-screen {
  --load-edge: clamp(16px, 3vw, 44px);
  --load-copy: #365c60;
  position: fixed;
  inset: 0;
  z-index: 99999;
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  min-width: 0;
  min-height: 0;
  padding: max(var(--load-edge), env(safe-area-inset-top, 0px))
           max(var(--load-edge), env(safe-area-inset-right, 0px))
           max(var(--load-edge), env(safe-area-inset-bottom, 0px))
           max(var(--load-edge), env(safe-area-inset-left, 0px));
  background: #f3faf9;
  color: var(--load-copy);
  overflow: auto;
  overscroll-behavior: contain;
}
.loading-screen--player,
.loading-screen--stage { --load-copy: #e0ecef; background: #0a1420; }
.loading-box {
  box-sizing: border-box;
  display: grid;
  justify-items: start;
  gap: 12px;
  width: max-content;
  max-width: min(22rem, 100%);
  max-height: 100%;
  min-width: 0;
  padding: 2px;
  overflow: auto;
  overscroll-behavior: contain;
  font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans JP", "Noto Sans SC", "Microsoft YaHei", sans-serif;
}
.loading-details { display: grid; gap: 5px; min-width: 0; }
.load-count { margin: 0; color: var(--load-copy); font-size: 0.8125rem; line-height: 1.65; overflow-wrap: anywhere; }
.load-cancel {
  box-sizing: border-box;
  max-width: 100%;
  min-height: 44px;
  padding: 9px 18px;
  border: 1px solid #8fbbbd;
  border-radius: 7px;
  background: #fff;
  color: #205b60;
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.5;
  cursor: pointer;
}
.load-cancel:hover { background: #e6f7f4; }
.load-cancel:focus-visible { outline: 3px solid #20cbb1; outline-offset: 3px; }
.load-fade-enter-active, .load-fade-leave-active { transition: opacity 160ms ease; }
/* Do not let a visually fading old curtain eat a click on the ready page. */
.load-fade-leave-active { pointer-events: none; }
.load-fade-enter-from, .load-fade-leave-to { opacity: 0; }
@media (max-height: 420px) {
  .loading-screen { --load-edge: 12px; }
  .loading-box { gap: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .load-fade-enter-active, .load-fade-leave-active { transition: none; }
}
@media (forced-colors: active) {
  .loading-screen { background: Canvas; color: CanvasText; --load-copy: CanvasText; }
  .load-cancel { border-color: ButtonText; background: ButtonFace; color: ButtonText; }
}
</style>
