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
        <div class="load-label">{{ readiness?.status === 'waiting' ? '正在准备当前画面…' : '正在准备演出…' }}</div>
        <p v-if="status" class="load-count">已预载 {{ status.succeeded }} 项<span v-if="status.failed"> · 失败 {{ status.failed }} 项</span></p>
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  status: { type: Object, default: null },
  readiness: { type: Object, default: null },
})
</script>

<style scoped>
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
