<template>
  <MobileSceneLayout :phase="phase" :background-url="sceneBackgroundUrl">
    <MobileDeviceFrame variant="call" :surface-style="callSurfaceStyle">
      <div class="call-screen" :class="{ 'is-neutral': !bgUrl }">
        <div class="call-profile-layer">
          <MobileCallProfile :chara-id="charaId" :name="speakerName" :theme="theme" />
        </div>
        <div class="call-content-panel">
          <div v-if="dialogueText" class="dialogue-card">
            <LocalizedTextBlock class="dialogue-text" :display="display" />
          </div>
          <div v-if="externalReplyDisplay" class="external-reply">
            <span class="external-reply-label">{{ replyLabel }}</span>
            <LocalizedTextBlock class="external-reply-text" :display="externalReplyDisplay" />
          </div>
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
import { IDOL_ID_TO_NAME, IDOL_NAME_TO_ID } from '../../utils/IdolNameMap.js'
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
  choiceTexts: { type: Object, default: () => ({}) },
  steps: { type: Array, default: () => [] },
  externalReplyText: { type: String, default: '' },
  sceneBackgroundUrl: { type: String, default: '' },
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
const speakerName = computed(() => display.value.speaker || IDOL_ID_TO_NAME[charaId.value] || '')
const dialogueText = computed(() => display.value.text || '')

const latestChoiceSelection = computed(() => {
  const path = [...(props.historyStack || [])].reverse()
  for (const index of path) {
    if (props.choiceTexts?.[index]) return props.choiceTexts[index]
  }
  return null
})

const externalReplyDisplay = computed(() => {
  if (latestChoiceSelection.value) {
    return localization?.resolveChoiceSelection(latestChoiceSelection.value)
      || resolveText(latestChoiceSelection.value?.source_text || '')
  }
  return props.externalReplyText ? resolveText(props.externalReplyText) : null
})

const charaId = computed(() => {
  if (props.step?.chara_id) return props.step.chara_id
  const raw = typeof props.dialogue?.speaker === 'string' ? props.dialogue.speaker : ''
  return IDOL_NAME_TO_ID[raw] || context.value.primaryCharaId || ''
})

// ── Theme / visual (resource fallback: chara mobile bg → neutral placeholder) ──
const unitCode = computed(() => getUnitCodeByCharaId(charaId.value) || context.value.unitCode || null)
const theme = computed(() => getMobileUnitTheme(unitCode.value))

const bgUrl = computed(() => (charaId.value ? getMobileBgUrl(charaId.value) : null))

const callSurfaceStyle = computed(() => bgUrl.value ? {
  backgroundImage: `url(${bgUrl.value})`,
  backgroundSize: '100% 100%',
  backgroundPosition: 'center',
} : null)

const replyLabel = 'プロデューサー：'
</script>

<style scoped>
.call-screen {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.call-screen.is-neutral {
  background: linear-gradient(180deg, #5b6472 0 44%, #c4babd 44% 100%);
}

.call-profile-layer {
  position: absolute;
  top: 14%;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
}

.call-content-panel {
  position: absolute;
  inset: 50% 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 14px;
  padding: 12% 7% calc(24px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.dialogue-card {
  width: 88%;
  max-width: 620px;
  background: rgba(255, 255, 255, 0.96);
  color: #18242b;
  border-radius: 20px;
  padding: 22px 26px;
  box-shadow: 0 12px 30px rgba(30, 24, 28, 0.16);
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
  display: block;
  opacity: 0.82;
  margin-bottom: 0.2em;
  font-size: 0.85em;
}

.external-reply-text {
  --localized-primary-line-height: 1.45;
  --localized-secondary-color: rgba(255, 255, 255, 0.82);
  --localized-secondary-size: 0.84em;
  --localized-secondary-gap: 0.18em;
}

@media (max-width: 699px) {
  .call-profile-layer {
    top: 12%;
  }
  .call-content-panel {
    inset: 48% 0 0;
    padding: 12% 12px 18px;
  }
  .dialogue-card {
    width: calc(100% - 24px);
    border-radius: 14px;
    padding: 15px 14px;
  }
}

@media (max-height: 760px) and (min-width: 700px) {
  .call-content-panel {
    padding-top: 9%;
  }
}
</style>
