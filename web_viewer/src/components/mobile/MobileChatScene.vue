<template>
  <MobileSceneLayout :phase="phase" :background-url="sceneBackgroundUrl">
    <MobileDeviceFrame :surface-style="deviceSurfaceStyle">
      <MobileChatHeader :title="chatTitle" :theme="theme" :is-group="context.isGroup" />
      <MobileMessageList
        :messages="historyMessages"
        :show-typing="showTyping"
        :reserve-choice-space="context.phase === 'choice'"
      />
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
import { ref, computed, watch } from 'vue'
import MobileSceneLayout from './MobileSceneLayout.vue'
import MobileDeviceFrame from './MobileDeviceFrame.vue'
import MobileChatHeader from './MobileChatHeader.vue'
import MobileMessageList from './MobileMessageList.vue'
import MobileChoiceRail from './MobileChoiceRail.vue'
import { getUnitMobileBgUrl } from '../../utils/AssetResolver.js'
import { UNIT_CODE_TO_NAME, normalizeUnitCode } from '../../utils/UnitNameMap.js'
import { IDOL_NAME_TO_ID, IDOL_ID_TO_NAME } from '../../utils/IdolNameMap.js'
import { resolveTextContent } from '../../utils/TextHelper.js'
import { useStoryLocalization } from '../../localization/story/StoryLocalizationContext.js'
import { resolveCommunicationContext } from '../../core/story-runtime/CommunicationPresentationContext.js'
import { getMobileUnitTheme } from '../../data/mobileVisualThemes.js'

const props = defineProps({
  dialogue: { type: Object, default: null },
  step: { type: Object, default: null },
  stepIndex: { type: Number, default: -1 },
  scenarioId: { type: String, default: '' },
  historyStack: { type: Array, default: () => [] },
  choiceTexts: { type: Object, default: () => {} },
  steps: { type: Array, default: () => [] },
  showTyping: { type: Boolean, default: false },
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

// ── Helpers (ported from MobileUI) ──
function isProducer(speaker, charaId = '') {
  if (!speaker) return !charaId
  const p = speaker.replace(/\s/g, '').replace(' ', '').trim()
  return p === '<P>' || p === 'プロデューサー' || p === 'Producer' || p === 'producer'
}

function cleanSpeaker(raw) {
  return (raw || '').replace(/ /g, ' ').trim()
}

function stepToMessage(step) {
  const d = step.dialogue || {}
  const stamp = step.stamp || null
  const rawSpeaker = d.speaker || ''
  const display = localization?.resolveDialogue(d) || { text: resolveTextContent(d), view: null }
  let speaker = cleanSpeaker(stamp?.speaker || display?.speaker || rawSpeaker)
  const sourceSpeaker = cleanSpeaker(stamp?.speaker || rawSpeaker)
  const sourceCharaId = step.presentation_context?.primary_chara_id
    || step.presentation_context?.primaryCharaId
    || stamp?.chara_id
    || step.chara_id
    || d.speaker_identity?.entity_id
    || IDOL_NAME_TO_ID[sourceSpeaker]
    || ''
  const inheritedCharaId = context.value.primaryCharaId || ''
  const charaId = IDOL_ID_TO_NAME[sourceCharaId]
    ? sourceCharaId
    : (sourceCharaId && IDOL_ID_TO_NAME[inheritedCharaId] ? inheritedCharaId : sourceCharaId)
  if (/^\d{3}[a-z0-9]{3}$/.test(speaker)) {
    speaker = IDOL_ID_TO_NAME[speaker] || speaker
  }
  const text = display.text
  const prod = isProducer(rawSpeaker, charaId)
  if (stamp?.id) {
    return { speaker, display: null, charaId, isProducer: prod, isStamp: true, stampId: stamp.id }
  }
  const stampMatch = text.match(/^<emoji>(image_mobile_stamp_.+?)<\/emoji>$/)
  return { speaker, display: stampMatch ? null : display, charaId, isProducer: prod, isStamp: !!stampMatch, stampId: stampMatch ? stampMatch[1] : null }
}

function isTalkHistoryStep(step) {
  return step?.type === 'talk' || step?.type === 'talk_stamp'
}

// ── Accumulate talk messages as encountered (presentation projection) ──
const talkByIndex = ref({})
const _acc = ref(new Set())

watch(() => props.stepIndex, (idx) => {
  const step = props.step
  if (!isTalkHistoryStep(step)) return
  if (_acc.value.has(idx)) return
  _acc.value = new Set([..._acc.value, idx])
  talkByIndex.value = { ...talkByIndex.value, [idx]: step }
}, { immediate: true })

watch(() => props.step, (step) => {
  const idx = props.stepIndex
  if (!isTalkHistoryStep(step) || _acc.value.has(idx)) return
  _acc.value = new Set([..._acc.value, idx])
  talkByIndex.value = { ...talkByIndex.value, [idx]: step }
})

// ── History: walk the path and merge talk + P-injection messages ──
const historyMessages = computed(() => {
  const msgs = []
  const stack = props.historyStack || []
  const current = props.stepIndex
  if (current < 0) return msgs
  const path = [...stack, current]
  const talkMap = talkByIndex.value

  for (const idx of path) {
    const chosenText = props.choiceTexts[idx]
    if (chosenText) {
      const fallbackText = (typeof chosenText === 'string' ? chosenText : chosenText.source_text) || ''
      const choiceDisplay = localization?.resolveChoiceSelection(chosenText) || fallbackText
      msgs.push({ speaker: 'プロデューサー', display: choiceDisplay, charaId: '', isProducer: true, isStamp: false, stampId: null })
    }
    const talk = talkMap[idx]
    if (talk) {
      msgs.push(stepToMessage(talk))
    }
  }
  return msgs
})

// ── Unit / theme / title ──
const unitCode = computed(() => {
  const sid = props.scenarioId || ''
  const m = sid.match(/8_2_x_(\d{3}[a-z0-9]{3})/)
  if (m) return normalizeUnitCode(m[1])
  return context.value.unitCode || null
})

const theme = computed(() => getMobileUnitTheme(unitCode.value))

const bgUrl = computed(() => {
  const uc = unitCode.value
  return uc ? getUnitMobileBgUrl(uc) : null
})

const deviceSurfaceStyle = computed(() => {
  if (!bgUrl.value) return null
  return {
    backgroundImage: `linear-gradient(rgba(246, 248, 247, 0.08), rgba(246, 248, 247, 0.08)), url(${bgUrl.value})`,
  }
})

const chatTitle = computed(() => {
  const sid = props.scenarioId || ''
  if (sid.startsWith('8_2_')) {
    const uc = unitCode.value
    if (uc && UNIT_CODE_TO_NAME[uc]) return UNIT_CODE_TO_NAME[uc]
  }
  const names = new Set()
  for (const msg of historyMessages.value) {
    if (!msg.isProducer && msg.speaker) names.add(cleanSpeaker(msg.speaker))
  }
  const arr = Array.from(names)
  if (arr.length === 0) {
    const inheritedName = IDOL_ID_TO_NAME[context.value.primaryCharaId]
    return inheritedName || 'トーク'
  }
  if (arr.length === 1) return arr[0]
  if (arr.length === 2) return arr.join('、')
  return arr[0] + ' 他'
})
</script>
