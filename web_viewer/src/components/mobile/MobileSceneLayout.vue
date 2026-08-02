<template>
  <div class="mobile-scene-layout" :class="{ 'is-choice': phase === 'choice' }">
    <!-- Stage background keeps its identity but drops contrast -->
    <div class="scene-backdrop" :style="backdropStyle" aria-hidden="true"></div>
    <div class="scene-dim" aria-hidden="true"></div>

    <div class="scene-device-slot">
      <slot />
    </div>

    <div class="scene-rail-slot">
      <slot name="rail" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  bgUrl: { type: String, default: '' },
  phase: { type: String, default: 'dialogue' },
})

const backdropStyle = computed(() =>
  props.bgUrl ? { backgroundImage: `url(${props.bgUrl})` } : {},
)
</script>

<style scoped>
.mobile-scene-layout {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
}

.scene-backdrop {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: saturate(0.85) brightness(0.92);
}

.scene-dim {
  position: absolute;
  inset: 0;
  background: var(--player-stage-scrim);
}

.scene-device-slot,
.scene-rail-slot {
  position: absolute;
  inset: 0;
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
  .scene-device-slot {
    justify-content: center;
  }
  .scene-rail-slot {
    justify-content: flex-end;
    align-items: center;
    padding-right: 8vw;
  }
}

@media (min-width: 700px) and (max-width: 1099px) {
  .scene-rail-slot {
    justify-content: flex-end;
    align-items: center;
    padding-right: 3vw;
  }
}

@media (max-width: 699px) {
  .scene-backdrop {
    filter: none;
  }
  .scene-dim {
    background: rgba(3, 12, 20, 0.14);
  }
  .scene-device-slot {
    align-items: stretch;
  }
  .scene-rail-slot {
    align-items: flex-end;
    justify-content: center;
    /* Clear the floating control dock above the safe area */
    padding: 0 16px calc(80px + env(safe-area-inset-bottom));
  }
}
</style>
