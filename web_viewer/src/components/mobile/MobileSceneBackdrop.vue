<template>
  <div class="mobile-scene-backdrop" aria-hidden="true">
    <div v-if="backgroundUrl" class="backdrop-image" :style="imageStyle"></div>
    <div class="backdrop-tint"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  backgroundUrl: { type: String, default: '' },
})

const imageStyle = computed(() => ({
  backgroundImage: `url(${props.backgroundUrl})`,
}))
</script>

<style scoped>
.mobile-scene-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #20262a;
}

.backdrop-image {
  position: absolute;
  inset: -28px;
  background-position: center;
  background-size: cover;
  filter: blur(16px) brightness(0.78) saturate(0.82);
  transform: scale(1.045);
}

.backdrop-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(12, 18, 22, 0.18), rgba(12, 18, 22, 0.28));
}

@media (max-width: 699px) {
  .backdrop-image {
    inset: -20px;
    filter: blur(12px) brightness(0.74) saturate(0.8);
  }
}
</style>
