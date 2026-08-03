<template>
  <div class="mobile-choice-rail" :class="`rail-count-${countClass}`" role="group" :aria-label="railLabel">
    <button
      v-for="(opt, i) in options"
      :key="opt.option_id || opt.label || i"
      class="choice-bubble"
      :class="{ 'is-bilingual': isBilingualOption(opt), 'is-selected': selectedIndex === i }"
      :aria-pressed="selectedIndex === i"
      :disabled="locked && selectedIndex !== i"
      @click="select(opt, i)"
    >
      <LocalizedTextBlock class="choice-text" :display="optionDisplay(opt)" />
      <span class="choice-tail" aria-hidden="true"></span>
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
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

// Lock once selected to prevent double submission; unlock on the next step's options.
const locked = ref(false)
const selectedIndex = ref(-1)

watch(() => props.options, () => {
  locked.value = false
  selectedIndex.value = -1
})

function select(opt, index) {
  if (locked.value) return
  locked.value = true
  selectedIndex.value = index
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
  width: min(100%, 380px);
  max-height: min(62vh, 520px);
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 8px 20px 8px 8px;
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.44) transparent;
}

.choice-bubble {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 72px;
  padding: 16px 24px 16px 20px;
  border: 3px solid rgba(105, 217, 199, 0.72);
  border-radius: 28px 28px 10px 28px;
  background: linear-gradient(145deg, #008D82, var(--mobile-choice-teal));
  color: var(--mobile-choice-teal-text);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.5;
  text-align: center;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 0 0 3px rgba(0, 122, 114, 0.18),
    0 10px 28px rgba(3, 12, 20, 0.34);
  transition:
    transform var(--player-motion-fast) var(--player-ease-standard),
    box-shadow var(--player-motion-fast) var(--player-ease-standard);
}

.choice-bubble:nth-child(even) {
  border-color: rgba(183, 219, 59, 0.82);
  background: linear-gradient(145deg, #8DD947, #66B936);
  color: #17331f;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.34),
    0 0 0 3px rgba(183, 219, 59, 0.18),
    0 10px 28px rgba(3, 12, 20, 0.34);
}

.choice-bubble:nth-child(even) .choice-text {
  --localized-secondary-color: rgba(23, 51, 31, 0.72);
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

.choice-bubble:disabled {
  cursor: default;
  opacity: 0.75;
  transform: none;
}

.choice-bubble.is-selected {
  filter: brightness(1.08) saturate(1.08);
  box-shadow: 0 0 0 5px var(--mobile-choice-glow), 0 12px 30px rgba(3, 12, 20, 0.38);
}

.choice-bubble.is-selected .choice-text {
  --localized-secondary-color: rgba(23, 51, 31, 0.72);
}

.choice-bubble:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 0;
  box-shadow: 0 0 0 5px var(--player-focus-outer);
}

.choice-tail {
  position: absolute;
  right: -13px;
  top: 50%;
  width: 18px;
  height: 24px;
  transform: translateY(-50%);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  background: inherit;
  filter: drop-shadow(3px 1px 0 rgba(105, 217, 199, 0.72));
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

@media (prefers-reduced-motion: reduce) {
  .choice-bubble {
    transition: none;
  }
  .choice-bubble:hover {
    transform: none;
  }
  .choice-bubble:active {
    transform: none;
  }
}

@media (max-width: 699px) {
  .mobile-choice-rail {
    width: 100%;
    max-width: 420px;
    gap: 12px;
    max-height: min(42vh, 380px);
    padding: 8px;
  }
  .choice-tail {
    display: none;
  }
  .choice-bubble {
    min-height: 60px;
    border-radius: 22px;
    padding: 13px 18px;
  }
  .rail-count-one .choice-bubble {
    margin-top: 0;
    margin-bottom: 0;
  }
}
</style>
