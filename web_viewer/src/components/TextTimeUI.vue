<template>
  <div class="text-time-overlay" @click="$emit('next')">
    <div class="caption">{{ text }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStoryLocalization } from '../localization/story/StoryLocalizationContext.js'

const props = defineProps({
  step: { type: Object, default: null },
})

defineEmits(['next'])
const localization = useStoryLocalization()

const text = computed(() => {
  const caption = props.step?.text_time
  return localization?.resolveTimeCaption(caption).text || caption?.text || ''
})
</script>

<style scoped>
.text-time-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.caption {
  max-width: min(72vw, 760px);
  padding: 18px 34px;
  color: #fff;
  font-size: 28px;
  line-height: 1.45;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0;
  text-shadow:
    0 2px 8px rgba(0, 0, 0, 0.85),
    0 0 18px rgba(0, 0, 0, 0.65);
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  .caption {
    max-width: 86vw;
    padding: 14px 22px;
    font-size: 22px;
  }
}
</style>
