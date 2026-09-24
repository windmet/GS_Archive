<template>
  <transition name="load-fade">
    <div v-if="visible" class="loading-screen">
      <div class="loading-box" role="status" aria-live="polite">
        <div class="load-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="48" height="48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#2a2a3a" stroke-width="3" />
            <circle
              cx="24" cy="24" r="20" fill="none" stroke="#4488cc"
              stroke-width="3" stroke-linecap="round"
              stroke-dasharray="30 100"
            />
          </svg>
        </div>
        <div class="load-label">{{ readiness?.status === 'waiting' ? '正在准备当前画面…' : message }}</div>
        <p v-if="critical.total" class="load-count">当前段落资源：{{ critical.ready }} / {{ critical.total }}</p>
        <p v-if="critical.total && critical.ready === critical.total" class="load-count">资源已预载，正在准备画面与语音…</p>
        <p v-if="slow" class="load-count">加载较慢，可继续等待，或取消后重试。</p>
        <button v-if="canCancel" type="button" class="load-cancel" @click="$emit('cancel')">取消并返回</button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { criticalPreloadProgress } from '../presentation/LoadingPresentation.js'
defineEmits(['cancel'])
const props = defineProps({
  canCancel: Boolean,
  visible: { type: Boolean, default: false },
  status: { type: Object, default: null },
  readiness: { type: Object, default: null },
  message: { type: String, default: '正在读取资料馆数据…' },
})
const slow = ref(false)
let slowTimer
watch(() => props.visible, visible => {
  clearTimeout(slowTimer)
  slow.value = false
  if (visible) slowTimer = setTimeout(() => { slow.value = true }, 8000)
}, { immediate: true })
onUnmounted(() => clearTimeout(slowTimer))
const critical = computed(() => criticalPreloadProgress(props.status))
</script>

<style scoped>
.load-cancel { min-height: 44px; padding: 10px 20px; border: 1px solid #81999d; border-radius: 8px; background: #203337; color: #fff; font: inherit; cursor: pointer; }
.load-cancel:focus-visible { outline: 3px solid #66c8c0; outline-offset: 3px; }
.loading-screen {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: #111; z-index: 99999;
  display: flex; align-items: center; justify-content: center;
}
.loading-box {
  display: flex; flex-direction: column; align-items: center; gap: 20px;
}
.load-icon {
  position: relative;
  width: 64px; height: 64px;
  display: flex; align-items: center; justify-content: center;
}
.load-count { color: #ccc; font-size: 0.85rem; margin: 0; }
.load-label {
  color: #888; font-size: 0.85rem; letter-spacing: 1px;
}
.load-fade-enter-active, .load-fade-leave-active {
  transition: opacity 0.3s;
}
.load-fade-enter-from, .load-fade-leave-to {
  opacity: 0;
}
</style>
