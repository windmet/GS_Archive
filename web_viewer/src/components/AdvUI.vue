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
        <small v-if="voiceStatus === 'preparing'" class="voice-status voice-preparing" role="status"><span aria-hidden="true">···</span><span class="voice-loading-label">语音加载中</span></small>
        <small v-else-if="voiceStatus === 'unavailable'" class="voice-status">语音暂不可用</small>
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
  voiceStatus: { type: String, default: 'idle' },
})

const localization = useStoryLocalization()
const display = computed(() => localization?.resolveDialogue(props.dialogue) ?? resolveText(props.dialogue))
const isBilingual = computed(() => Boolean(display.value?.view?.secondary?.text))
</script>

<style scoped>
.voice-status { position: absolute; bottom: 9px; left: 24px; color: #65747b; font: 11px/1.3 system-ui, sans-serif; pointer-events: none; }
.voice-preparing { visibility: hidden; animation: reveal-voice-status 0s 350ms forwards; }
.voice-loading-label { margin-left: 5px; visibility: hidden; animation: reveal-voice-status 0s 1500ms forwards; }
@keyframes reveal-voice-status { to { visibility: visible; } }

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
  background: linear-gradient(
    100deg,
    var(--player-nameplate-surface),
    var(--player-nameplate-surface-end)
  );
  color: var(--player-nameplate-ink);
  font-size: 1.02rem;
  font-weight: 700;
  padding: 0 28px;
  border-radius: var(--player-radius-control);
  border: 1px solid rgba(255, 255, 255, 0.38);
  box-shadow:
    0 5px 16px var(--player-nameplate-shadow),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  text-shadow: 0 1px 2px rgba(3, 64, 47, 0.28);
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
/* Short landscape screens need room for the portrait as well as the text. */
@media (orientation: landscape) and (max-height: 500px) {
  .adv-container { width: min(1040px, calc(100vw - 80px)); }
  .nameplate-outer { top: -15px; left: 20px; }
  .nameplate { height: 28px; padding: 0 16px; font-size: 12px; }
  .dialog { min-height: 84px; max-height: 30vh; padding: 20px 24px 16px; border-radius: 14px; }
  .dialog-text { font-size: 14px; --localized-primary-line-height: 1.4; }
  .dialog-next { right: 16px; bottom: 10px; font-size: 12px; }
  .voice-status { bottom: 3px; font-size: 10px; }
}
</style>
