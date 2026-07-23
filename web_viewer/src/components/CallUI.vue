<template>
  <div class="call-ui-overlay">
    <div class="backdrop-mask"></div>

    <div class="mockup-phone">
      <div class="phone-screen" :style="{ backgroundImage: `url(${bgUrl})` }">

        <!-- Top: caller profile -->
        <div class="caller-profile">
          <img class="caller-avatar" :src="iconUrl" alt="" />
          <div class="caller-nameplate">{{ speakerName }}</div>
        </div>

        <!-- Choices inside phone screen (if any) -->
        <div v-if="hasChoices" class="phone-choices">
          <button
            v-for="opt in currentChoices"
            :key="opt.option_id || opt.label"
            class="choice-btn"
            @click.stop="$emit('select', opt)"
          >
            <LocalizedTextBlock class="choice-text" :display="optionDisplay(opt)" />
          </button>
        </div>

        <!-- Bottom: dialogue bubble -->
        <div class="call-dialogue-bubble" v-if="dialogueText">
          <LocalizedTextBlock class="dialogue-text" :display="display" />
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LocalizedTextBlock from './LocalizedTextBlock.vue'
import { getMobileBgUrl, getMobileIconUrl } from '../utils/AssetResolver.js'
import { IDOL_NAME_TO_ID } from '../utils/IdolNameMap.js'
import { resolveText } from '../utils/TextHelper.js'
import { useStoryLocalization } from '../localization/story/StoryLocalizationContext.js'

const props = defineProps({
  dialogue: { type: Object, default: null },
  step: { type: Object, default: null },
})
defineEmits(['select'])

const localization = useStoryLocalization()
const display = computed(() => localization?.resolveDialogue(props.dialogue) ?? resolveText(props.dialogue))
const speakerName = computed(() => display.value.speaker)
const dialogueText = computed(() => display.value.text)

function optionDisplay(option) {
  return localization?.resolveChoiceOption(option) || option.text || option.detail || option.label || ''
}

const charaId = computed(() => {
  if (props.step?.chara_id) return props.step.chara_id
  const name = typeof props.dialogue?.speaker === 'string' ? props.dialogue.speaker : ''
  return IDOL_NAME_TO_ID[name] || null
})

const bgUrl = computed(() => {
  const id = charaId.value
  return id ? getMobileBgUrl(id) : null
})

const iconUrl = computed(() => {
  const id = charaId.value
  return id ? getMobileIconUrl(id) : null
})

const currentChoices = computed(() => props.step?.options || [])
const hasChoices = computed(() => currentChoices.value.length > 0)
</script>

<style scoped>
.call-ui-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
}
.backdrop-mask {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.mockup-phone {
  position: relative; z-index: 10;
  width: 340px; height: 75vh; max-height: 660px;
  background: #111;
  border-radius: 2.5rem;
  border: 8px solid #222;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  overflow: hidden;
}
.phone-screen {
  width: 100%; height: 100%;
  background-size: cover; background-position: center;
  display: flex; flex-direction: column;
  padding: 50px 12px 0;
  position: relative;
}
.caller-profile {
  display: flex; flex-direction: column;
  align-items: center; gap: 8px;
  flex-shrink: 0;
}
.caller-avatar {
  width: 90px; height: 90px;
  border-radius: 50%;
  border: 4px solid rgba(255,255,255,0.85);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  object-fit: cover;
  background: #ddd;
}
.caller-nameplate {
  background: rgba(25, 25, 80, 0.85);
  color: #fff;
  border-radius: 999px;
  padding: 6px 20px;
  font-size: 0.95rem;
  font-weight: bold;
  text-align: center;
  backdrop-filter: blur(2px);
}
/* Choices inside phone */
.phone-choices {
  margin: 16px 0;
  display: flex; flex-direction: column; gap: 8px;
  flex-shrink: 0;
}
.choice-btn {
  background: rgba(0,0,0,0.7);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  text-align: center;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s;
  pointer-events: auto;
}
.choice-btn:hover { background: rgba(0,0,0,0.9); }
.choice-text { --localized-primary-line-height: 1.45; --localized-secondary-color: rgba(255,255,255,.72); --localized-secondary-size: .82em; --localized-secondary-gap: .18em; }
/* Bubble anchored to bottom */
.call-dialogue-bubble {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 16px;
  padding: 14px 16px;
  color: #222;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  min-height: 60px;
  display: flex; align-items: center;
  margin-top: auto;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.dialogue-text {
  width: 100%;
  font-size: 0.9rem;
  --localized-primary-line-height: 1.6;
  --localized-secondary-color: #56616c;
  --localized-secondary-size: .84em;
  --localized-secondary-gap: .24em;
}
</style>
