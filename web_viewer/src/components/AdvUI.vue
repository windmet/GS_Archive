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
  bottom: var(--player-dialogue-bottom);
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 20;
}

.adv-container {
  position: relative;
  width: min(1040px, calc(100vw - 72px));
  pointer-events: auto;
}

/* ── Nameplate ── */
.nameplate-outer {
  position: absolute;
  top: -21px;
  left: 34px;
  z-index: 10;
}
.nameplate {
  height: 42px;
  display: flex;
  align-items: center;
  background: var(--player-accent-strong);
  color: #fff;
  font-size: 1.02rem;
  font-weight: 700;
  padding: 0 28px;
  border-radius: var(--player-radius-control);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

/* ── Dialog panel ── */
.dialog {
  position: relative;
  width: 100%;
  min-height: 142px;
  max-height: 34vh;
  background: var(--player-paper-glass);
  backdrop-filter: blur(8px);
  border-radius: var(--player-radius-dialogue);
  padding: 34px 44px 26px;
  cursor: pointer;
  border: 1px solid var(--player-border-light);
  box-shadow: var(--player-shadow-dialogue);
  display: flex;
  flex-direction: column;
}

.dialog-text {
  flex: 1;
  min-height: 0;
  font-size: var(--player-font-dialogue);
  color: var(--player-ink-900);
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
  bottom: 14px;
  right: 28px;
  color: var(--player-ink-500);
  font-size: 1.05rem;
  animation: adv-pulse 1.2s ease-in-out infinite;
}

@keyframes adv-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

@media (max-width: 699px) {
  .nameplate-outer { left: 16px; max-width: calc(100% - 32px); }
  .nameplate {
    height: 36px;
    max-width: 100%;
    padding: 0 18px;
    border-radius: 12px;
    font-size: 0.92rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .adv-container { width: calc(100vw - 20px); }
  .dialog {
    min-height: 120px;
    max-height: 42vh;
    border-radius: 20px;
    padding: 28px 18px 18px;
  }
  .dialog-text {
    font-size: var(--player-font-dialogue-mobile);
    --localized-secondary-size: 0.84em;
  }
}
</style>
