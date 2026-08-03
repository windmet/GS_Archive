<template>
  <div class="stage-choice-ui">
    <LocalizedTextBlock v-if="promptDisplay" class="choice-prompt" :display="promptDisplay" />
    <div class="choice-options">
      <button
        v-for="(opt, i) in options"
        :key="opt.option_id || i"
        class="choice-btn"
        @click.stop="select(opt, i)"
      >
        <LocalizedTextBlock class="choice-text" :display="optionDisplay(opt)" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LocalizedTextBlock from '../LocalizedTextBlock.vue'
import { useStoryLocalization } from '../../localization/story/StoryLocalizationContext.js'
import { resolveText } from '../../utils/TextHelper.js'

const props = defineProps({
  step: { type: Object, default: null },
})
const emit = defineEmits(['select'])
const localization = useStoryLocalization()

const options = computed(() => props.step?.options || [])
const promptDisplay = computed(() => {
  const dialogue = props.step?.dialogue
  if (!dialogue) return null
  return localization?.resolveDialogue(dialogue) ?? resolveText(dialogue)
})

function optionDisplay(option) {
  return localization?.resolveChoiceOption(option) || {
    text: option.text || option.detail || option.label || '',
  }
}

function select(opt, index) {
  emit('select', { ...opt, index })
}
</script>

<style scoped>
.stage-choice-ui {
  position: absolute;
  top: 52%; left: 0; right: 0;
  transform: translateY(-50%);
  display: flex; flex-direction: column;
  justify-content: center;
  padding: 32px;
  pointer-events: none;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}
.choice-prompt {
  color: rgba(255,255,255,0.9);
  font-size: 0.9rem;
  margin-bottom: 16px;
  text-align: center;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 12px 20px;
  border-radius: 12px;
  --localized-primary-line-height: 1.5;
  --localized-secondary-color: rgba(255,255,255,0.72);
  --localized-secondary-size: 0.86em;
}
.choice-options {
  display: flex; flex-direction: column; gap: 10px;
  pointer-events: auto;
}
.choice-btn {
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.94);
  color: #111936;
  border: 3px solid #20c8e8;
  border-radius: 10px;
  padding: 18px 24px;
  cursor: pointer;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.5;
  transition: background 0.2s, border-color 0.2s, transform 0.1s;
  box-shadow: 0 0 9px rgba(32, 200, 232, 0.75), 0 2px 12px rgba(0, 0, 0, 0.24);
}
.choice-btn:hover {
  background: #fff;
  border-color: #13b7da;
  transform: scale(1.01);
}
.choice-text {
  flex: 1;
  text-align: center;
  --localized-primary-line-height: 1.45;
  --localized-secondary-color: #607086;
  --localized-secondary-size: 0.82em;
  --localized-secondary-gap: 0.2em;
}

@media (max-width: 520px) {
  .stage-choice-ui { padding: 18px 12px; }
  .choice-options { gap: 8px; }
  .choice-btn { padding: 12px 14px; font-size: 0.95rem; }
}
</style>
