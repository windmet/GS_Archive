import { resolveCommunicationContext } from '../../src/core/story-runtime/CommunicationPresentationContext.js'
import { communicationUiAssets, messageMarkers } from './CommunicationUiAssets.js'
import { normalizeLegacyDialogue, createChoiceSelectionRecord, normalizeChoiceSelection }
  from '../../src/localization/story/LegacyDialogueAdapter.js'
import { resolveStoryText } from '../../src/localization/story/StoryTextResolver.js'
import { IDOL_NAME_TO_ID, IDOL_ID_TO_NAME } from '../../src/utils/IdolNameMap.js'

// These selectors mirror the concrete Call/Profile and Chat/Bubble consumers,
// not the scene resolver's primary character. Independent production-function
// tests pin their precedence so discovery cannot silently substitute an actor.
function callerId(step, context) {
  const raw = typeof step.dialogue?.speaker === 'string' ? step.dialogue.speaker : ''
  return step.chara_id || IDOL_NAME_TO_ID[raw] || context.primaryCharaId || ''
}

function chatActor(step, context) {
  const raw = step.dialogue?.speaker || ''
  const sourceName = (step.stamp?.speaker || raw).replace(/ /g, ' ').trim()
  const sourceId = step.presentation_context?.primary_chara_id || step.presentation_context?.primaryCharaId
    || step.stamp?.chara_id || step.chara_id || step.dialogue?.speaker_identity?.entity_id
    || IDOL_NAME_TO_ID[sourceName] || ''
  const inherited = context.primaryCharaId || ''
  const charaId = IDOL_ID_TO_NAME[sourceId] ? sourceId
    : (sourceId && IDOL_ID_TO_NAME[inherited] ? inherited : sourceId)
  const producer = raw ? ['<P>', 'プロデューサー', 'Producer', 'producer'].includes(raw.replace(/\s/g, '').trim()) : !charaId
  return { charaId, producer, historyDependent: Boolean(sourceId && !IDOL_ID_TO_NAME[sourceId]) }
}

function markerAssets(text, allowStamp) {
  const { stamps, emojis } = messageMarkers(text, { allowStamp })
  return [...stamps.map(id => ({ kind: 'stamp', id })), ...emojis.map(id => ({ kind: 'emoji', id }))]
}

// The compiled input contains original and optional legacy-inline translation.
// Enumerate each supported display mode; external overlays are not in this input.
function dialogueAssets(dialogue) {
  const normalized = normalizeLegacyDialogue(dialogue)
  const assets = []
  for (const story_content_mode of ['original', 'translation', 'bilingual']) {
    const view = resolveStoryText({ ...normalized, overlayEntry: normalized.overlayEntry,
      preferences: { story_content_mode } })
    const texts = [view.primary?.text, view.secondary?.text].filter(Boolean)
    const joined = texts.join('\n')
    const whole = messageMarkers(joined)
    if (whole.stamps.length) assets.push(...whole.stamps.map(id => ({ kind: 'stamp', id })))
    else for (const text of texts) assets.push(...markerAssets(text, false))
  }
  if (normalized.textRef?.unit_id) assets.push({ reason: 'communication-translation-overlay-pending' })
  return assets
}

/**
 * The communication assets a scenario loads, one entry per step that renders a
 * phone scene.
 *
 * `resolveCommunicationContext` is the runtime's rule for which scene a step
 * shows — including what a choice step inside a conversation inherits from the
 * steps before it — so it is the only rule applied here. The walk uses the
 * linear order, which is the deterministic path a direct entry into the
 * scenario takes; a different history can reach a different character, and a
 * requirement that only one route needs must still be discoverable.
 *
 * Requirements retain each originating step (and choice option). Original and
 * inline-translated messages are enumerated; choice/history and unloaded
 * translation overlays remain explicit pending requirements. This linear
 * surface pass is not a proof of arbitrary accumulated-history projections.
 */
export function communicationRequirements(scenario) {
  const steps = scenario?.steps
  if (!Array.isArray(steps)) return []
  const scenarioId = scenario.scenario_id
  const hasCommunication = steps.some(step => ['talk', 'talk_stamp', 'call'].includes(step?.type)
    || step?.state?.talk_mode || step?.state?.phone_mode)
  const hasChat = steps.some(step => ['talk', 'talk_stamp'].includes(step?.type) || step?.state?.talk_mode)
  return steps.flatMap((step, stepIndex) => {
    const context = resolveCommunicationContext({ step, stepIndex, historyStack: [], steps, scenarioId })
    const callCharaId = context.mode === 'call' ? callerId(step, context) : ''
    const requirements = communicationUiAssets({
      mode: context.mode, unitCode: context.unitCode || null, charaId: callCharaId,
    })
    if (['talk', 'talk_stamp'].includes(step?.type)) {
      const actor = chatActor(step, context)
      if (!actor.producer && actor.charaId) requirements.push({ kind: 'mobile-icon', id: actor.charaId })
      if (!actor.producer && actor.historyDependent) requirements.push({ reason: 'communication-history-avatar-pending' })
    }
    // Explicit stamps replace the display text in MobileChatScene. The main
    // plan already collects step.stamp, so do not invent hidden text images.
    if (['talk', 'talk_stamp'].includes(step?.type) && !step?.stamp?.id) {
      requirements.push(...dialogueAssets(step.dialogue))
    }
    if (step?.type === 'choice' && hasCommunication) {
      requirements.push({ reason: 'communication-history-dependent' })
      // History can inject any selected option into a later chat, even when
      // the direct-entry context at the choice currently resolves to a call.
      if (hasChat) for (const [optionIndex, option] of (step.options || []).entries()) {
        const selection = normalizeChoiceSelection(createChoiceSelectionRecord(option, step.choice_id))
        requirements.push(...markerAssets(selection.source, false).map(asset => ({ ...asset, optionIndex })))
        if (selection.textRef?.unit_id) requirements.push({ reason: 'communication-translation-overlay-pending', optionIndex })
      }
    }
    if (!context.mode && !requirements.length) return []
    return [{
      stepIndex,
      mode: context.mode,
      charaId: context.mode === 'call' ? callCharaId : (context.primaryCharaId || ''),
      unitCode: context.unitCode || null,
      requirements,
    }]
  })
}
