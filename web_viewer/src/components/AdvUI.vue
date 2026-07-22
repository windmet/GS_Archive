<template>
  <!-- Locked to bottom of screen, horizontally centered -->
  <div class="adv-root" :class="{ 'is-bilingual': isBilingual }">
    <div class="adv-container">

      <!-- Nameplate -->
      <div v-if="display.speaker" class="nameplate-outer">
        <div class="nameplate">
          {{ display.speaker }}
        </div>
      </div>

      <!-- Dialog panel -->
      <div class="dialog" :class="{ 'is-bilingual': isBilingual }">
        <LocalizedTextBlock class="dialog-text" :display="display" />
        <div class="dialog-next">▶</div>
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
  dialogue: { type: Object, default: null },
  step: { type: Object, default: null },
  playing: { type: Boolean, default: false },
})

const localization = useStoryLocalization()
const display = computed(() => localization?.resolveDialogue(props.dialogue) ?? resolveText(props.dialogue))
const isBilingual = computed(() => Boolean(display.value?.view?.secondary?.text))
</script>

<style scoped>
.adv-root {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 20;
}

.adv-container {
  position: relative;
  width: 100%;
  max-width: 860px;
  padding: 0 20px;
  pointer-events: auto;
}

.adv-root.is-bilingual {
  bottom: 52px;
}

/* ── Nameplate ── */
.nameplate-outer {
  position: absolute;
  top: -16px;
  left: 28px;
  z-index: 10;
}
.nameplate {
  background: #14b8a6;
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  padding: 7px 28px;
  border-radius: 16px 16px 6px 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  border-bottom: 4px solid #0d9488;
}

/* ── Dialog panel ── */
.dialog {
  position: relative;
  width: 100%;
  height: 144px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 40px;
  padding: 34px 40px 18px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 0 40px rgba(255, 255, 255, 0.35),
    0 4px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

.dialog.is-bilingual {
  height: 190px;
}

.dialog-text {
  flex: 1;
  min-height: 0;
  font-size: 1.06rem;
  color: #1a1a2e;
  font-weight: 500;
  overflow-y: auto;
  padding-right: 18px;
  --localized-primary-line-height: 1.72;
  --localized-secondary-color: #526174;
  --localized-secondary-size: 0.86em;
  --localized-secondary-gap: 0.28em;
  --localized-secondary-line-height: 1.55;
}

.dialog-next {
  position: absolute;
  bottom: 18px;
  right: 28px;
  color: #aaa;
  font-size: 1.05rem;
  animation: adv-pulse 1.2s ease-in-out infinite;
}

@keyframes adv-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

@media (max-width: 520px) {
  .adv-root { bottom: 52px; }
  .adv-container { padding: 0 10px; }
  .nameplate-outer { left: 18px; max-width: calc(100% - 36px); }
  .nameplate {
    max-width: 100%;
    padding: 6px 18px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dialog {
    height: min(190px, 31vh);
    border-radius: 26px;
    padding: 30px 24px 14px;
  }
  .dialog-text {
    font-size: 0.96rem;
    --localized-secondary-size: 0.84em;
  }
}
</style>
