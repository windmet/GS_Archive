<template>
  <div class="choice-ui">
    <div class="choice-prompt" v-if="prompt">{{ prompt }}</div>
    <div class="choice-options">
      <button
        v-for="(opt, i) in options"
        :key="opt.option_id || i"
        class="choice-btn"
        @click.stop="select(opt, i)"
      >
        <span class="choice-text">{{ optionText(opt) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStoryLocalization } from '../localization/story/StoryLocalizationContext.js'
import { resolveTextContent } from '../utils/TextHelper.js'

const props = defineProps({
  step: { type: Object, default: null },
})
const emit = defineEmits(['select'])
const localization = useStoryLocalization()

const options = computed(() => props.step?.options || [])
const prompt = computed(() => {
  const dialogue = props.step?.dialogue
  if (!dialogue) return null
  return localization?.resolveDialogue(dialogue).text ?? resolveTextContent(dialogue)
})

function optionText(option) {
  return localization?.resolveChoiceOption(option).text || option.text || option.detail || option.label || ''
}

function select(opt, index) {
  emit('select', { ...opt, index })
}
</script>

<style scoped>
.choice-ui {
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
}
</style>
