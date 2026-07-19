<template>
  <div class="synopsis-screen">
    <div class="synopsis-card">
      <div v-if="titleText" class="synopsis-title">{{ titleText }}</div>
      <div v-if="bodyText" class="synopsis-body">{{ bodyText }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolveText } from '../utils/TextHelper.js'
import { useStoryLocalization } from '../localization/story/StoryLocalizationContext.js'

const props = defineProps({
  step: { type: Object, default: null },
})
const localization = useStoryLocalization()

function display() {
  const dialogue = props.step?.dialogue
  return dialogue
    ? (localization?.resolveDialogue(dialogue) ?? resolveText(dialogue))
    : { speaker: '', text: '' }
}

const titleText = computed(() => {
  return display().speaker
})

const bodyText = computed(() => {
  return display().text
})
</script>

<style scoped>
.synopsis-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.synopsis-card {
  max-width: 700px;
  width: 85%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 48px 48px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.10),
    0 0 0 1px rgba(255, 255, 255, 0.5);
}

.synopsis-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 24px;
  text-align: center;
  line-height: 1.5;
  white-space: pre-wrap;
}

.synopsis-body {
  font-size: 1.05rem;
  line-height: 2;
  color: #444;
  white-space: pre-wrap;
  text-align: center;
  word-break: break-word;
}
</style>
