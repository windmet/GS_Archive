import { inject, onScopeDispose, provide, ref, watch } from 'vue'

import {
  normalizeChoiceSelection,
  normalizeLegacyDialogue,
  preferencesFromLegacyLanguageMode,
} from './LegacyDialogueAdapter.js'
import { resolveStoryText } from './StoryTextResolver.js'
import { TranslationRepository } from './TranslationRepository.js'

export const STORY_LOCALIZATION_KEY = Symbol('story-localization')

function joinDisplay(view) {
  return [view?.primary?.text, view?.secondary?.text]
    .filter(text => typeof text === 'string' && text.length > 0)
    .join('\n')
}

function sourceTextRecord(value, { detail = false } = {}) {
  const record = value && typeof value === 'object' ? value : {}
  if (detail) {
    return {
      source: record.detail_source_text ?? record.detail ?? record.source_text ?? record.text ?? record.label ?? '',
      textRef: record.detail_text_ref ?? record.text_ref ?? null,
    }
  }
  return {
    source: record.source_text ?? record.text ?? record.text_jp ?? record.detail_source_text ?? record.detail ?? record.label ?? '',
    textRef: record.text_ref ?? record.detail_text_ref ?? null,
  }
}

export function createStoryLocalization({
  compiledData,
  languageMode,
  repository = new TranslationRepository(),
  translationLocale = 'zh-CN',
  entityNames = null,
} = {}) {
  const overlay = ref(null)
  const diagnostics = ref(null)
  let generation = 0
  let abortController = null

  const stop = watch(
    () => compiledData?.value?.text_catalog_id || compiledData?.value?.scenario_id || '',
    async scenarioId => {
      const requestGeneration = ++generation
      abortController?.abort()
      abortController = null
      overlay.value = null
      diagnostics.value = null
      if (!scenarioId) return

      abortController = new AbortController()
      try {
        const loaded = await repository.loadScenario({
          scenarioId,
          locale: translationLocale,
          signal: abortController.signal,
        })
        if (requestGeneration !== generation) return
        overlay.value = loaded
        diagnostics.value = repository.getDiagnostics({ scenarioId, locale: translationLocale })
      } catch (error) {
        if (error?.name !== 'AbortError' && requestGeneration === generation) {
          diagnostics.value = {
            code: 'translation_invalid',
            scenarioId,
            locale: translationLocale,
            errors: [error?.message || String(error)],
          }
        }
      }
    },
    { immediate: true },
  )

  function preferences() {
    return preferencesFromLegacyLanguageMode(languageMode?.value, translationLocale)
  }

  function overlayEntry(textRef, inlineEntry = null) {
    const unitId = textRef?.unit_id
    return (unitId && overlay.value?.entries?.[unitId]) || inlineEntry || null
  }

  function resolveUnit({ source = '', textRef = null, speaker = null, inlineEntry = null } = {}) {
    return resolveStoryText({
      source,
      textRef,
      speaker,
      overlayEntry: overlayEntry(textRef, inlineEntry),
      entityNames,
      preferences: preferences(),
    })
  }

  function resolveDialogue(dialogue) {
    const normalized = normalizeLegacyDialogue(dialogue)
    const view = resolveUnit({
      source: normalized.source,
      textRef: normalized.textRef,
      speaker: normalized.speaker,
      inlineEntry: normalized.overlayEntry,
    })
    let speakerText = view.speaker.display
    if (dialogue?.speaker_text_ref) {
      speakerText = joinDisplay(resolveUnit({
        source: typeof dialogue.speaker === 'string' ? dialogue.speaker : '',
        textRef: dialogue.speaker_text_ref,
      }))
    }
    return { speaker: speakerText, text: joinDisplay(view), view }
  }

  function resolveChoiceOption(option, { detail = false } = {}) {
    const record = sourceTextRecord(option, { detail })
    const view = resolveUnit(record)
    return { text: joinDisplay(view), view }
  }

  function resolveChoiceSelection(selection) {
    const record = normalizeChoiceSelection(selection)
    const view = resolveUnit({ source: record.source, textRef: record.textRef })
    return { ...record, text: joinDisplay(view), view }
  }

  function resolveTimeCaption(textTime) {
    const record = sourceTextRecord(textTime)
    const view = resolveUnit(record)
    return { text: joinDisplay(view), view }
  }

  function dispose() {
    generation += 1
    abortController?.abort()
    abortController = null
    stop()
  }

  onScopeDispose(dispose)

  return {
    overlay,
    diagnostics,
    resolveUnit,
    resolveDialogue,
    resolveChoiceOption,
    resolveChoiceSelection,
    resolveTimeCaption,
    dispose,
  }
}

export function provideStoryLocalization(localization) {
  provide(STORY_LOCALIZATION_KEY, localization)
  return localization
}

export function useStoryLocalization() {
  return inject(STORY_LOCALIZATION_KEY, null)
}
