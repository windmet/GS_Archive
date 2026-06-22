<template>
  <transition name="load-fade">
    <div v-if="visible" class="loading-screen">
      <div class="loading-box">
        <div class="load-icon">
          <svg viewBox="0 0 48 48" width="48" height="48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#2a2a3a" stroke-width="3" />
            <circle
              cx="24" cy="24" r="20" fill="none" stroke="#4488cc"
              stroke-width="3" stroke-linecap="round"
              :style="{ strokeDasharray: `${progress} 100`, strokeDashoffset: '0', transform: 'rotate(-90deg)', transformOrigin: 'center' }"
            />
          </svg>
          <span class="load-pct">{{ progress }}%</span>
        </div>
        <div class="load-label">Loading assets...</div>
        <div class="load-bar-track">
          <div class="load-bar-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  progress: { type: Number, default: 0 },
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
.load-pct {
  position: absolute;
  color: #ccc; font-size: 0.8rem; font-weight: bold;
}
.load-label {
  color: #888; font-size: 0.85rem; letter-spacing: 1px;
}
.load-bar-track {
  width: 200px; height: 4px;
  background: #2a2a3a; border-radius: 2px; overflow: hidden;
}
.load-bar-fill {
  height: 100%; background: #4488cc;
  border-radius: 2px; transition: width 0.15s ease;
}
.load-fade-enter-active, .load-fade-leave-active {
  transition: opacity 0.3s;
}
.load-fade-enter-from, .load-fade-leave-to {
  opacity: 0;
}
</style>
