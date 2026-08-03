<template>
  <div class="mobile-device-frame" :class="`variant-${variant}`">
    <div class="device-inner" :style="surfaceStyle">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'chat' },
  surfaceStyle: { type: Object, default: null },
})
</script>

<style scoped>
.mobile-device-frame {
  position: relative;
  width: auto;
  max-width: 100%;
  height: min(760px, calc(100dvh - var(--player-content-top) - var(--player-content-bottom)));
  max-height: 760px;
  aspect-ratio: 0.78;
  flex: 0 0 auto;
  background: #111;
  border-radius: 34px;
  border: 8px solid #222;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  transform: rotate(-1.5deg);
  transform-origin: center;
}

.device-inner {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #eef1ef;
  background-position: center;
  background-size: cover;
}

/* Call variant sizing (handoff §5.7) */
.variant-call {
  aspect-ratio: 0.72;
}

@media (min-width: 700px) and (max-width: 1099px) {
  .mobile-device-frame {
    width: auto;
    border-radius: 28px;
    border-width: 6px;
    transform: translate(0, 0) rotate(-1.5deg);
  }
  .variant-call {
    aspect-ratio: 0.72;
  }
}

@media (max-width: 699px) {
  .mobile-device-frame {
    width: 100%;
    height: calc(100dvh - var(--player-content-top) - var(--player-content-bottom));
    max-height: none;
    aspect-ratio: auto;
    border-radius: 0;
    border-width: 0;
    box-shadow: none;
    transform: none;
  }
}

@media (max-height: 760px) and (min-width: 700px) {
  .mobile-device-frame {
    max-height: 100%;
  }
}
</style>
