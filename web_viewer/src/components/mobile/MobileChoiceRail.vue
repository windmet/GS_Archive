<template>
  <div class="mobile-choice-rail" :class="`rail-count-${countClass}`" role="group" :aria-label="railLabel">
    <button
      v-for="(opt, i) in options"
      :key="opt.option_id || opt.label || i"
      class="choice-bubble"
      :class="{ 'is-bilingual': isBilingualOption(opt) }"
      @click="select(opt, i)"
    >
      <LocalizedTextBlock class="choice-text" :display="optionDisplay(opt)" />
      <span class="choice-tail" aria-hidden="true"></span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LocalizedTextBlock from '../LocalizedTextBlock.vue'
import { useStoryLocalization } from '../../localization/story/StoryLocalizationContext.js'
import { resolveText } from '../../utils/TextHelper.js'

const props = defineProps({
  options: { type: Array, default: () => [] },
  railLabel: { type: String, default: '回复选项' },
})

const emit = defineEmits(['select'])

const localization = useStoryLocalization()

function optionDisplay(option) {
  return localization?.resolveChoiceOption(option) || resolveText(option?.text || option?.detail || option?.label || '')
}

function isBilingualOption(option) {
  return Boolean(optionDisplay(option)?.view?.secondary?.text)
}

function select(opt, index) {
  emit('select', { ...opt, index })
}

const countClass = computed(() => {
  const n = props.options.length
  if (n <= 1) return 'one'
  if (n === 2) return 'two'
  if (n === 3) return 'three'
  return 'many'
})
</script>

<style scoped>
.mobile-choice-rail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: clamp(220px, 26vw, 360px);
  max-height: min(62vh, 520px);
  overflow-y: auto;
  pointer-events: auto;
}

.choice-bubble {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64px;
  padding: 14px 22px 14px 20px;
  border: none;
  border-radius: 18px;
  background: var(--mobile-choice-teal);
  color: var(--mobile-choice-teal-text);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.5;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(3, 12, 20, 0.28);
  transition:
    transform var(--player-motion-fast) var(--player-ease-standard),
    box-shadow var(--player-motion-fast) var(--player-ease-standard);
}

.choice-bubble.is-bilingual {
  min-height: 78px;
}

.choice-bubble:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(3, 12, 20, 0.34);
}

.choice-bubble:active {
  transform: scale(0.98);
}

.choice-bubble:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 0;
  box-shadow: 0 0 0 5px var(--player-focus-outer);
}

.choice-tail {
  position: absolute;
  right: -14px;
  top: 50%;
  width: 18px;
  height: 24px;
  transform: translateY(-50%);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  background: inherit;
  border-left: none;
}

.choice-text {
  width: 100%;
  --localized-primary-line-height: 1.5;
  --localized-secondary-color: rgba(255, 255, 255, 0.82);
  --localized-secondary-size: 0.84em;
  --localized-secondary-gap: 0.2em;
}

.rail-count-one .choice-bubble {
  margin-top: auto;
  margin-bottom: 8vh;
}

.rail-count-three {
  gap: 10px;
}

.rail-count-many .choice-bubble {
  flex-shrink: 0;
}

@media (max-width: 699px) {
  .mobile-choice-rail {
    width: 100%;
    max-width: 420px;
    gap: 12px;
    max-height: min(42vh, 380px);
  }
  .choice-tail {
    right: auto;
    left: 50%;
    top: -14px;
    width: 24px;
    height: 18px;
    transform: translateX(-50%);
    clip-path: polygon(0 0, 50% 100%, 100% 0);
  }
  .rail-count-one .choice-bubble {
    margin-top: 0;
    margin-bottom: 0;
  }
}
</style>
