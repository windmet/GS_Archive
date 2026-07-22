<template>
  <div class="synopsis-screen">
    <div class="synopsis-card">
      <LocalizedTextBlock v-if="titleDisplay" class="synopsis-title" :display="titleDisplay" />
      <LocalizedTextBlock v-if="bodyDisplay" class="synopsis-body" :display="bodyDisplay" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LocalizedTextBlock from './LocalizedTextBlock.vue'
import { resolveText } from '../utils/TextHelper.js'
import { useStoryLocalization } from '../localization/story/StoryLocalizationContext.js'

const props = defineProps({
  step: { type: Object, default: null },
})
const localization = useStoryLocalization()

const display = computed(() => {
  const dialogue = props.step?.dialogue
  return dialogue
    ? (localization?.resolveDialogue(dialogue) ?? resolveText(dialogue))
    : { speaker: '', text: '' }
})

const titleDisplay = computed(() => {
  const resolved = display.value
  if (!resolved?.speaker) return null
  return resolved.speakerView ? { text: resolved.speaker, view: resolved.speakerView } : resolved.speaker
})

const bodyDisplay = computed(() => display.value?.text ? display.value : null)
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
  --localized-primary-line-height: 1.5;
  --localized-secondary-color: #596474;
  --localized-secondary-size: .76em;
  --localized-secondary-gap: .22em;
}

.synopsis-body {
  font-size: 1.05rem;
  line-height: 2;
  color: #444;
  white-space: pre-wrap;
  text-align: center;
  word-break: break-word;
  --localized-primary-line-height: 2;
  --localized-secondary-color: #66717d;
  --localized-secondary-size: .82em;
  --localized-secondary-gap: .3em;
}
</style>
