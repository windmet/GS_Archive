import { computed, inject, onScopeDispose, provide, ref, shallowRef, watch } from 'vue'

import {
  normalizeChoiceSelection,
  normalizeLegacyDialogue,
  normalizeLegacySpeaker,
  preferencesFromLegacyLanguageMode,
} from './LegacyDialogueAdapter.js'
import { resolveStoryText } from './StoryTextResolver.js'
import { TranslationRepository } from './TranslationRepository.js'
import { EntityTranslationRepository } from './EntityTranslationRepository.js'
import { speakerDisplayLookup, speakerLabelCandidates, speakerLabelKey } from './SpeakerDisplayNames.js'
import { chatTranslation, isLegacyChat, loadChatTranslations } from './ChatTranslations.js'

export const STORY_LOCALIZATION_KEY = Symbol('story-localization')

export function collectScenarioEntitySourceNames(compiledData) {
  const sources = new Map()
  const catalogId = compiledData?.text_catalog_id || compiledData?.scenario_id || ''
  for (const step of compiledData?.steps || []) {
    const speaker = step?.dialogue ? normalizeLegacySpeaker(step.dialogue) : null
    const label = speakerLabelKey(speaker)
    if (label) {
      if (!sources.has('speaker')) sources.set('speaker', {})
      for (const id of speakerLabelCandidates(label, catalogId)) sources.get('speaker')[id] = label
    }
    const entityType = speaker?.entity_type || speaker?.entityType
    const entityId = speaker?.entity_id || speaker?.entityId
    const sourceName = speaker?.source_name || speaker?.sourceName
    const display = speakerDisplayLookup(speaker)
    if (display) {
      if (!sources.has(display.entityType)) sources.set(display.entityType, {})
      sources.get(display.entityType)[display.entityId] = display.sourceName
      continue
    }
    if (!entityType || !entityId || !sourceName || speaker?.kind === 'unknown') continue
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
  const loading = ref(false)
  const reloadRevision = ref(0)
  const overlay = shallowRef(null)
  // Legacy chats (no text units) translate by source text from the shared chat overlay.
  const chatEntries = shallowRef(null)
  const diagnostics = ref(null)
  const entityDiagnostics = ref([])
  const entityRevision = ref(0)
  const entityViews = new Map()
  const retryAvailable = computed(() => diagnostics.value?.code === 'translation_invalid' ||
    entityDiagnostics.value.some(item => item.code === 'entity_translation_invalid'))
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
      currentPreferences().story_content_mode,
      compiledData?.value,
      reloadRevision.value,
    ],
    async ([scenarioId, locale]) => {
      const requestGeneration = ++generation
      abortController?.abort()
      abortController = null
      overlay.value = null
      chatEntries.value = null
      diagnostics.value = null
      entityDiagnostics.value = []; entityViews.clear(); entityRevision.value++
      loading.value = Boolean(scenarioId)
      if (!scenarioId || currentPreferences().story_content_mode === 'original') {loading.value=false; return}

      abortController = new AbortController()
      try {
        const sourceNamesByType = collectScenarioEntitySourceNames(compiledData?.value)
        const signal = abortController.signal
        // Entity labels publish independently; a stalled optional label cannot hold body text.
        for (const [entityType, sourceNames] of sourceNamesByType) {
          void entityRepository.loadEntity({entityType,locale,sourceNames,signal}).then(loaded => {
            if (requestGeneration !== generation) return
            entityViews.set(entityType,loaded)
            entityDiagnostics.value = [...sourceNamesByType.keys()].map(type => entityRepository.getDiagnostics({entityType:type,locale})).filter(Boolean)
            entityRevision.value++
          }).catch(error => {
            if (error?.name !== 'AbortError' && requestGeneration === generation) {
              entityDiagnostics.value = [...entityDiagnostics.value,{code:'entity_translation_invalid',entityType,locale,errors:[error.message]}]
            }
          })
        }
        if (isLegacyChat(compiledData?.value)) {
          try {
            const entries = await loadChatTranslations({ signal })
            if (requestGeneration !== generation) return
            chatEntries.value = entries
          } catch (error) { if (error?.name === 'AbortError') throw error /* Optional: chats keep their source. */ }
        }
        const loaded = await repository.loadScenario({scenarioId,locale,signal})
        if (requestGeneration !== generation) return
        overlay.value = loaded
        diagnostics.value = repository.getDiagnostics({ scenarioId, locale })
      } catch (error) {
        if (error?.name !== 'AbortError' && requestGeneration === generation) {
          diagnostics.value = {
            code: 'translation_invalid',
            scenarioId,
            locale,
            errors: [error?.message || String(error)],
          }
        }
      } finally {
        if (requestGeneration === generation) loading.value = false
      }
    },
    { immediate: true },
  )

  function retryTranslation() {
    const scenarioId = compiledData?.value?.text_catalog_id || compiledData?.value?.scenario_id
    const locale = currentPreferences().story_translation_locale || translationLocale
    if (!scenarioId || loading.value) return false
    repository.invalidate({ scenarioId, locale })
    for (const [entityType] of collectScenarioEntitySourceNames(compiledData?.value)) {
      if (entityRepository.getDiagnostics({entityType,locale})?.code !== 'entity_translation_ready') entityRepository.invalidate({entityType,locale})
    }
    reloadRevision.value += 1
    return true
  }

  function preferences() {
    return currentPreferences()
  }

  function overlayEntry(textRef, inlineEntry = null, source = '') {
    const unitId = textRef?.unit_id
    if (unitId && overlay.value?.entries?.[unitId]) return overlay.value.entries[unitId]
    if (inlineEntry) return inlineEntry
    const chat = !textRef && chatTranslation(chatEntries.value, source)
    return chat ? { source_hash: null, text: chat, status: 'draft' } : null
  }

  function resolveUnit({ source = '', textRef = null, speaker = null, inlineEntry = null } = {}) {
    entityRevision.value
    return resolveStoryText({
      source,
      textRef,
      speaker,
      overlayEntry: overlayEntry(textRef, inlineEntry, source),
      entityNames: entityNames || ((entityId, locale, entityType = 'idol') => (
        (entityViews.has(entityType) ? entityRepository.getEntry({ entityType, entityId, locale, overlay:entityViews.get(entityType) }) : null)?.name || ''
      )),
      speakerLabelNames: (value, locale) => {
        const display = speakerDisplayLookup(value)
        if (display) return entityViews.has(display.entityType) ? entityRepository.getEntry({ entityType: display.entityType,
          entityId: display.entityId, locale, overlay:entityViews.get(display.entityType) })?.name || '' : ''
        return speakerDictionaryName(value, locale)
      },
      preferences: preferences(),
    })
  }

  function speakerDictionaryName(speaker, locale = currentPreferences().story_translation_locale || translationLocale) {
    if (!entityViews.has('speaker')) return ''
    const catalogId = compiledData?.value?.text_catalog_id || compiledData?.value?.scenario_id || ''
    for (const entityId of speakerLabelCandidates(speakerLabelKey(speaker), catalogId)) {
      const name = entityRepository.getEntry({ entityType: 'speaker', entityId, locale, overlay: entityViews.get('speaker') })?.name
      if (name) return name
    }
    return ''
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
    let speakerView = null
    if (dialogue?.speaker_text_ref && normalized.speaker.kind !== 'producer') {
      speakerView = resolveUnit({
        source: dialogue.speaker_source_text
          ?? (typeof dialogue.speaker === 'string' ? dialogue.speaker : ''),
        textRef: dialogue.speaker_text_ref,
      })
      // An untranslated label unit must not replace an available entity label
      // with its RAW name. Explicitly translated label units retain priority.
      const labelSpeaker = { ...normalized.speaker,
        sourceName: dialogue.speaker_source_text
          ?? (typeof dialogue.speaker === 'string' ? dialogue.speaker : '') }
      const labelLookup = speakerDisplayLookup(labelSpeaker) || speakerDictionaryName(labelSpeaker)
      if (speakerView.translation.available || !labelLookup || view.speaker.display === view.speaker.source)
        speakerText = joinDisplay(speakerView)
    }
    return { speaker: speakerText, speakerView, text: joinDisplay(view), view }
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
    loading,
    retryTranslation,
    retryAvailable,
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
