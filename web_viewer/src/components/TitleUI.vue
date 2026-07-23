<template>
  <div class="title-screen">
    <div class="title-band">
      <div class="band-container">
        <div class="title-card">
          <LocalizedTextBlock v-if="badgeDisplay" class="badge" :display="badgeDisplay" />
          <LocalizedTextBlock v-if="mainDisplay" class="main-title" :display="mainDisplay" />
        </div>
      </div>
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

const badgeDisplay = computed(() => {
  const resolved = display.value
  if (!resolved?.speaker) return null
  return resolved.speakerView ? { text: resolved.speaker, view: resolved.speakerView } : resolved.speaker
})

const mainDisplay = computed(() => display.value?.text ? display.value : null)
</script>

<style scoped>
.title-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  overflow: hidden;
}

.title-band {
  width: 100%;
  padding: 56px 0;
  background-color: rgba(190, 220, 250, 0.70);
  background-image: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 8px,
    rgba(255, 255, 255, 0.25) 8px,
    rgba(255, 255, 255, 0.25) 10px
  );
  display: flex;
  align-items: center;
  justify-content: center;
}

.band-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.title-card {
  background: #fff;
  border-radius: 12px;
  padding: 32px 100px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.10),
    0 0 0 1px rgba(255, 255, 255, 0.8);
  text-align: center;
  min-width: 360px;
  max-width: 700px;
  position: relative;
  z-index: 1;
}

.badge {
  display: inline-flex;
  background: #0ea5e9;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 3px 18px;
  border-radius: 4px;
  margin-bottom: 18px;
  letter-spacing: 2.5px;
  --localized-primary-line-height: 1.4;
  --localized-secondary-color: rgba(255,255,255,.76);
  --localized-secondary-size: .82em;
  --localized-secondary-gap: .18em;
}

.main-title {
  font-size: 1.65rem;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.7;
  letter-spacing: 3px;
  white-space: pre-wrap;
  --localized-primary-line-height: 1.7;
  --localized-secondary-color: #5d6677;
  --localized-secondary-size: .72em;
  --localized-secondary-gap: .22em;
}
</style>
