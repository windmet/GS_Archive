import { inject, onScopeDispose, provide, ref, watch } from 'vue'

import {
  normalizeChoiceSelection,
  normalizeLegacyDialogue,
  preferencesFromLegacyLanguageMode,
} from './LegacyDialogueAdapter.js'
import { resolveStoryText } from './StoryTextResolver.js'
import { TranslationRepository } from './TranslationRepository.js'
import { EntityTranslationRepository } from './EntityTranslationRepository.js'

export const STORY_LOCALIZATION_KEY = Symbol('story-localization')

export function collectScenarioEntitySourceNames(compiledData) {
  const sources = new Map()
  for (const step of compiledData?.steps || []) {
    const speaker = step?.dialogue?.speaker_identity
    const entityType = speaker?.entity_type || speaker?.entityType
    const entityId = speaker?.entity_id || speaker?.entityId
    const sourceName = speaker?.source_name || speaker?.sourceName
    if (!entityType || !entityId || !sourceName) continue
    if (!sources.has(entityType)) sources.set(entityType, {})
    sources.get(entityType)[entityId] = sourceName
  }
  return sources
}

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
  storyPreferences = null,
  languageMode = null,
  repository = new TranslationRepository(),
  entityRepository = new EntityTranslationRepository(),
  translationLocale = 'zh-CN',
  entityNames = null,
} = {}) {
  const overlay = ref(null)
  const diagnostics = ref(null)
  const entityDiagnostics = ref([])
  const entityRevision = ref(0)
  let generation = 0
  let abortController = null

  function currentPreferences() {
    return storyPreferences?.value
      || preferencesFromLegacyLanguageMode(languageMode?.value, translationLocale)
  }

  const stop = watch(
    () => [
      compiledData?.value?.text_catalog_id || compiledData?.value?.scenario_id || '',
      currentPreferences().story_translation_locale || translationLocale,
    ],
    async ([scenarioId, locale]) => {
      const requestGeneration = ++generation
      abortController?.abort()
      abortController = null
      overlay.value = null
      diagnostics.value = null
      entityDiagnostics.value = []
      if (!scenarioId) return

      abortController = new AbortController()
      try {
        const sourceNamesByType = collectScenarioEntitySourceNames(compiledData?.value)
        const [loaded] = await Promise.all([
          repository.loadScenario({ scenarioId, locale, signal: abortController.signal }),
          ...[...sourceNamesByType].map(([entityType, sourceNames]) => (
            entityRepository.loadEntity({
              entityType,
              locale,
              sourceNames,
              signal: abortController.signal,
            })
          )),
        ])
        if (requestGeneration !== generation) return
        overlay.value = loaded
        diagnostics.value = repository.getDiagnostics({ scenarioId, locale })
        entityDiagnostics.value = [...sourceNamesByType.keys()]
          .map(entityType => entityRepository.getDiagnostics({ entityType, locale }))
          .filter(Boolean)
        entityRevision.value += 1
      } catch (error) {
        if (error?.name !== 'AbortError' && requestGeneration === generation) {
          diagnostics.value = {
            code: 'translation_invalid',
            scenarioId,
            locale,
            errors: [error?.message || String(error)],
          }
        }
      }
    },
    { immediate: true },
  )

  function preferences() {
    return currentPreferences()
  }

  function overlayEntry(textRef, inlineEntry = null) {
    const unitId = textRef?.unit_id
    return (unitId && overlay.value?.entries?.[unitId]) || inlineEntry || null
  }

  function resolveUnit({ source = '', textRef = null, speaker = null, inlineEntry = null } = {}) {
    entityRevision.value
    return resolveStoryText({
      source,
      textRef,
      speaker,
      overlayEntry: overlayEntry(textRef, inlineEntry),
      entityNames: entityNames || ((entityId, locale, entityType = 'idol') => (
        entityRepository.getEntry({ entityType, entityId, locale })?.name || ''
      )),
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
    entityDiagnostics,
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
