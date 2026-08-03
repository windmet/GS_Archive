<template>
  <div
    class="mobile-scene-layout"
    :class="{ 'is-choice': phase === 'choice' }"
  >
    <MobileSceneBackdrop :background-url="backgroundUrl" />

    <div class="scene-content">
      <div class="scene-device-slot">
        <slot />
      </div>

      <div class="scene-rail-slot">
        <slot name="rail" />
      </div>
    </div>
  </div>
</template>

<script setup>
import MobileSceneBackdrop from './MobileSceneBackdrop.vue'

defineProps({
  phase: { type: String, default: 'dialogue' },
  backgroundUrl: { type: String, default: '' },
})
</script>

<style scoped>
.mobile-scene-layout {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  overflow: hidden;
}

.scene-content {
  position: absolute;
  top: var(--player-content-top);
  bottom: var(--player-content-bottom);
  left: 50%;
  z-index: 1;
  width: min(1360px, calc(100% - (2 * var(--player-edge))));
  min-width: 0;
  min-height: 0;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: minmax(0, 760px);
  justify-content: center;
  align-items: stretch;
}

.scene-device-slot,
.scene-rail-slot {
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scene-rail-slot {
  pointer-events: auto;
}

/* ── Responsive composition (handoff §5.5/§5.8) ── */
@media (min-width: 1100px) {
  .is-choice .scene-content {
    grid-template-columns: minmax(430px, 0.95fr) minmax(320px, 0.65fr);
    gap: clamp(28px, 4vw, 72px);
    padding-inline: clamp(20px, 4vw, 64px);
  }
  .is-choice .scene-device-slot {
    justify-content: flex-end;
  }
}

@media (min-width: 700px) and (max-width: 1099px) {
  .is-choice .scene-content {
    grid-template-columns: minmax(0, 1fr) minmax(230px, 34%);
    gap: 18px;
  }
}

@media (max-width: 699px) {
  .scene-content {
    top: var(--player-content-top);
    bottom: var(--player-content-bottom);
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .scene-device-slot {
    flex: 1 1 auto;
    min-height: 0;
    align-items: stretch;
  }
  .scene-rail-slot {
    position: absolute;
    inset: auto 0 0;
    align-items: flex-end;
    justify-content: center;
    padding: 0 14px 8px;
  }
}
</style>
