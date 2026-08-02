<template>
  <div class="mobile-device-frame" :class="`variant-${variant}`">
    <div class="device-inner">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'chat' },
})
</script>

<style scoped>
.mobile-device-frame {
  position: relative;
  width: clamp(390px, 52vw, 720px);
  height: min(92vh, 900px);
  background: #111;
  border-radius: 34px;
  border: 8px solid #222;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  transform: translate(-4%, 1%) rotate(-3.5deg);
  transform-origin: center;
}

.device-inner {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Call variant sizing (handoff §5.7) */
.variant-call {
  width: clamp(380px, 48vw, 650px);
  height: min(90vh, 860px);
}

@media (min-width: 700px) and (max-width: 1099px) {
  .mobile-device-frame {
    width: min(60vw, 560px);
    height: min(88vh, 760px);
    border-radius: 28px;
    border-width: 6px;
    transform: translate(0, 0) rotate(-1.5deg);
  }
  .variant-call {
    width: min(58vw, 540px);
    height: min(88vh, 780px);
  }
}

@media (max-width: 699px) {
  .mobile-device-frame {
    width: 100%;
    height: 100dvh;
    border-radius: 0;
    border-width: 0;
    box-shadow: none;
    transform: none;
  }
}

@media (max-height: 760px) and (min-width: 700px) {
  .mobile-device-frame {
    height: min(94vh, 720px);
  }
}
</style>
