<template>
  <transition name="load-fade">
    <div v-if="visible" class="loading-screen" :class="`loading-screen--${surface}`">
      <!-- The archive curtain only shows before the first page (view __boot__): it continues index.html's boot screen exactly. -->
      <div v-if="surface === 'archive'" class="loading-brand" aria-hidden="true">
        <span class="loading-brand-lockup">
          <img :src="getBrandMarkUrl()" alt="" width="52" height="40" />
          <span class="loading-brand-text"><span class="loading-brand-name">{{ ARCHIVE_BRAND.mark }}</span><span class="loading-brand-sub">{{ ARCHIVE_BRAND.sub }}</span></span>
        </span>
        <span class="loading-site-line">{{ SITE_LINE }}</span>
        <span class="loading-site-rule"></span>
        <span class="loading-site-period">{{ SERVICE_PERIOD.start }} — {{ SERVICE_PERIOD.end }}</span>
      </div>
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
import { getBrandMarkUrl } from '../utils/AssetResolver.js'
import { ARCHIVE_BRAND } from '../core/archiveSections.js'
import { SITE_LINE, SERVICE_PERIOD } from '../content/siteLine.js'

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
  --load-edge: var(--gs-curtain-edge);
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
  background: var(--gs-paper);
  color: var(--load-copy);
  overflow: auto;
  overscroll-behavior: contain;
}
.loading-screen--player,
.loading-screen--stage { --load-copy: #e0ecef; background: #0a1420; }
/* Same lockup, sizes and position as the boot screen in index.html; change both together. */
.loading-brand {
  position: absolute;
  inset: 0 0 8vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 var(--gs-space-5);
  pointer-events: none;
  color: var(--gs-ink);
  text-align: center;
}
.loading-brand-lockup { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; text-align: start; }
.loading-site-line { color: var(--gs-ink-3); font-size: var(--gs-text-ui); line-height: 1.5; }
.loading-site-rule { width: 28px; height: 1px; background: var(--gs-line); }
.loading-site-period { color: var(--gs-ink-3); font-family: var(--gs-font-stage); font-size: var(--gs-text-ui); font-weight: 600; letter-spacing: .12em; line-height: 1; font-variant-numeric: tabular-nums; }
.loading-brand img { flex: none; width: 52px; height: 40px; object-fit: contain; filter: brightness(0); }
.loading-brand-text { display: flex; flex-direction: column; gap: 7px; }
.loading-brand-name { font-family: var(--gs-font-stage); font-size: var(--gs-text-title); font-style: italic; font-weight: var(--gs-weight-bold); letter-spacing: .02em; line-height: 1; white-space: nowrap; }
.loading-brand-sub { color: var(--gs-ink-3); font-size: var(--gs-text-body); letter-spacing: .08em; line-height: 1; white-space: nowrap; }
/* The badge is pinned to the corner; the count, the slow notice and Cancel stack above it,
   right-aligned, so nothing that appears later moves the badge. */
.loading-box {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  width: max-content;
  max-width: min(22rem, 100%);
  max-height: 100%;
  min-width: 0;
  padding: 2px;
  overflow: auto;
  overscroll-behavior: contain;
  font-family: var(--gs-font-body);
}
.loading-box > :first-child { order: 3; }
.loading-details { order: 1; display: grid; gap: 5px; min-width: 0; text-align: end; }
.load-cancel { order: 2; }
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
.load-cancel:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.load-fade-enter-active, .load-fade-leave-active { transition: opacity var(--gs-motion-enter) var(--gs-ease-out); }
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
