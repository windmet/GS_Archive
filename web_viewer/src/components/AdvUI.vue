<template>
  <!-- Locked to bottom of screen, horizontally centered -->
  <div class="adv-root">
    <div class="adv-container">

      <!-- Nameplate -->
      <div v-if="display.speaker" class="nameplate-outer">
        <div class="nameplate">
          {{ display.speaker }}
        </div>
      </div>

      <!-- Dialog panel -->
      <div class="dialog">
        <div class="dialog-text">
          {{ display.text }}
        </div>
        <div class="dialog-next">▶</div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolveText } from '../utils/TextHelper.js'

const props = defineProps({
  dialogue: { type: Object, default: null },
  step: { type: Object, default: null },
  playing: { type: Boolean, default: false },
})

const display = computed(() => resolveText(props.dialogue))
</script>

<style scoped>
.adv-root {
  position: absolute;
  bottom: 48px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 20;
}

.adv-container {
  position: relative;
  width: 100%;
  max-width: 1000px;
  padding: 0 16px;
  pointer-events: auto;
}

/* ── Nameplate ── */
.nameplate-outer {
  position: absolute;
  top: -20px;
  left: 40px;
  z-index: 10;
}
.nameplate {
  background: #14b8a6;
  color: #fff;
  font-size: 1.15rem;
  font-weight: 700;
  padding: 8px 32px;
  border-radius: 16px 16px 6px 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  border-bottom: 4px solid #0d9488;
}

/* ── Dialog panel ── */
.dialog {
  position: relative;
  width: 100%;
  height: 180px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 48px;
  padding: 48px 48px 24px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 0 40px rgba(255, 255, 255, 0.35),
    0 4px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

.dialog-text {
  flex: 1;
  font-size: 1.2rem;
  line-height: 1.9;
  color: #1a1a2e;
  font-weight: 500;
  white-space: pre-wrap;
  overflow-y: auto;
}

.dialog-next {
  position: absolute;
  bottom: 24px;
  right: 32px;
  color: #aaa;
  font-size: 1.2rem;
  animation: adv-pulse 1.2s ease-in-out infinite;
}

@keyframes adv-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
</style>
