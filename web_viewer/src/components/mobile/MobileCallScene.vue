<template>
  <MobileSceneLayout :bg-url="bgUrl" :phase="phase">
    <MobileDeviceFrame variant="call">
      <div class="call-visual-area" :class="{ 'is-neutral': !bgUrl }" :style="visualAreaStyle">
        <MobileCallProfile :chara-id="charaId" :name="speakerName" :theme="theme" />
      </div>
      <div class="call-content-panel">
        <div v-if="dialogueText" class="dialogue-card">
          <LocalizedTextBlock class="dialogue-text" :display="display" />
        </div>
        <div v-if="externalReplyText" class="external-reply">
          <span class="external-reply-label">{{ replyLabel }}</span>{{ externalReplyText }}
        </div>
      </div>
    </MobileDeviceFrame>
    <template #rail>
      <MobileChoiceRail
        v-if="context.phase === 'choice'"
        :options="currentChoices"
        @select="$emit('select', $event)"
      />
    </template>
  </MobileSceneLayout>
</template>

<script setup>
import { computed } from 'vue'
import MobileSceneLayout from './MobileSceneLayout.vue'
import MobileDeviceFrame from './MobileDeviceFrame.vue'
import MobileCallProfile from './MobileCallProfile.vue'
import MobileChoiceRail from './MobileChoiceRail.vue'
import LocalizedTextBlock from '../LocalizedTextBlock.vue'
import { getMobileBgUrl } from '../../utils/AssetResolver.js'
import { IDOL_NAME_TO_ID } from '../../utils/IdolNameMap.js'
import { getUnitCodeByCharaId } from '../../utils/UnitNameMap.js'
import { resolveText } from '../../utils/TextHelper.js'
import { useStoryLocalization } from '../../localization/story/StoryLocalizationContext.js'
import { resolveCommunicationContext } from '../../core/story-runtime/CommunicationPresentationContext.js'
import { getMobileUnitTheme } from '../../data/mobileVisualThemes.js'

const props = defineProps({
  dialogue: { type: Object, default: null },
  step: { type: Object, default: null },
  stepIndex: { type: Number, default: -1 },
  scenarioId: { type: String, default: '' },
  historyStack: { type: Array, default: () => [] },
  steps: { type: Array, default: () => [] },
  externalReplyText: { type: String, default: '' },
})

defineEmits(['select'])

const localization = useStoryLocalization()

// ── Presentation context ──
const context = computed(() => resolveCommunicationContext({
  step: props.step,
  stepIndex: props.stepIndex,
  historyStack: props.historyStack,
  steps: props.steps,
  scenarioId: props.scenarioId,
}))

const phase = computed(() => context.value.phase)
const currentChoices = computed(() => props.step?.options || [])

// ── Speaker / caller ──
const display = computed(() => localization?.resolveDialogue(props.dialogue) ?? resolveText(props.dialogue))
const speakerName = computed(() => display.value.speaker || '')
const dialogueText = computed(() => display.value.text || '')

const charaId = computed(() => {
  if (props.step?.chara_id) return props.step.chara_id
  const raw = typeof props.dialogue?.speaker === 'string' ? props.dialogue.speaker : ''
  return IDOL_NAME_TO_ID[raw] || ''
})

// ── Theme / visual (resource fallback: chara mobile bg → neutral placeholder) ──
const unitCode = computed(() => getUnitCodeByCharaId(charaId.value) || context.value.unitCode || null)
const theme = computed(() => getMobileUnitTheme(unitCode.value))

const bgUrl = computed(() => (charaId.value ? getMobileBgUrl(charaId.value) : null))

const visualAreaStyle = computed(() => {
  // Photo first, theme-tinted fade layered under the content panel edge.
  const photo = bgUrl.value ? `url(${bgUrl.value})` : ''
  const fade = theme.value?.primary
    ? `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.18) 55%, ${theme.value.primary} 140%)`
    : ''
  const layers = [fade, photo].filter(Boolean)
  return layers.length ? { backgroundImage: layers.join(', ') } : null
})

const replyLabel = 'プロデューサー：'
</script>

<style scoped>
.call-visual-area {
  position: relative;
  flex-shrink: 0;
  height: 46%;
  min-height: 180px;
  background-size: cover;
  background-position: center;
  background-color: #2c323c;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: env(safe-area-inset-top);
}

.call-visual-area.is-neutral {
  background-image: linear-gradient(160deg, #5b6472, #2c323c);
}

.call-visual-area::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.12);
}

.call-visual-area > * {
  position: relative;
  z-index: 1;
}

.call-content-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 22px 20px calc(20px + env(safe-area-inset-bottom));
  background: #c4babd;
  overflow-y: auto;
}

.dialogue-card {
  width: 88%;
  max-width: 540px;
  background: #ffffff;
  color: #18242b;
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 6px 20px rgba(70, 55, 55, 0.22);
  flex-shrink: 0;
}

.dialogue-text {
  width: 100%;
  font-size: 0.95rem;
  --localized-primary-line-height: 1.7;
  --localized-secondary-color: #56616c;
  --localized-secondary-size: 0.84em;
  --localized-secondary-gap: 0.24em;
}

.external-reply {
  align-self: flex-end;
  background: #167a43;
  color: #ffffff;
  border-radius: 14px 4px 14px 14px;
  padding: 10px 14px;
  font-size: 0.85rem;
  line-height: 1.5;
  max-width: 82%;
  box-shadow: 0 4px 14px rgba(70, 55, 55, 0.2);
  flex-shrink: 0;
}

.external-reply-label {
  opacity: 0.82;
  margin-right: 0.4em;
  font-size: 0.85em;
}

@media (max-width: 699px) {
  .call-visual-area {
    height: 42%;
    min-height: 150px;
  }
  .call-content-panel {
    padding: 16px 12px calc(14px + env(safe-area-inset-bottom));
  }
  .dialogue-card {
    width: calc(100% - 24px);
    border-radius: 14px;
    padding: 15px 14px;
  }
}
</style>
