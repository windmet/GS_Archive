import { computed } from 'vue'
import { isTransitionStep } from '../utils/StoryStepFlow.js'
import { createChoiceSelectionRecord } from '../localization/story/LegacyDialogueAdapter.js'

function episodeStartIndex(episode) {
  const legacy = Number(episode?.start_step_index)
  if (Number.isFinite(legacy)) return legacy
  const strict = Number(episode?.start_step_id)
  return Number.isFinite(strict) ? Math.max(0, strict - 1) : null
}

function episodeEndIndex(episode) {
  const legacy = Number(episode?.end_step_index)
  if (Number.isFinite(legacy)) return legacy
  const strict = Number(episode?.end_step_id)
  return Number.isFinite(strict) ? Math.max(0, strict - 1) : null
}

export function useStoryNavigation({
  compiledData,
  currentStep,
  currentStepIndex,
  historyStack,
  selectedChoices,
  storyPreferences,
  updateStoryPreferences,
  startStep,
  endStep,
  clearFadeAutoAdvance,
  ensureAudioCtx,
  resetVoiceDedup,
}) {
  const firstPlayableIndex = computed(() => {
    const steps = compiledData.value?.steps || []
    const index = steps.findIndex(step => step?.type !== 'synopsis')
    return index < 0 ? 0 : index
  })
  const startEpisode = computed(() => {
    if (!Number.isFinite(startStep)) return null
    const startIndex = Math.max(0, startStep - 1)
    return (compiledData.value?.episodes || []).find(episode => {
      const first = episodeStartIndex(episode)
      const last = episodeEndIndex(episode)
      return first != null && last != null && startIndex >= first && startIndex <= last
    }) || null
  })
  const navigationStartIndex = computed(() => {
    const lastIndex = Math.max(0, (compiledData.value?.steps?.length || 1) - 1)
    if (!Number.isFinite(startStep)) return Math.min(firstPlayableIndex.value, lastIndex)
    return Math.max(firstPlayableIndex.value, Math.min(lastIndex, startStep - 1))
  })
  const navigationEndIndex = computed(() => {
    const lastIndex = Math.max(0, (compiledData.value?.steps?.length || 1) - 1)
    const inferredEnd = episodeEndIndex(startEpisode.value)
    const requestedEnd = Number.isFinite(endStep) ? endStep - 1 : inferredEnd
    if (!Number.isFinite(requestedEnd)) return lastIndex
    return Math.max(navigationStartIndex.value, Math.min(lastIndex, requestedEnd))
  })
  const isFirstStep = computed(() => historyStack.value.length === 0 && currentStepIndex.value <= navigationStartIndex.value)
  const isLastStep = computed(() => !compiledData.value || currentStepIndex.value >= navigationEndIndex.value)

  const currentEpisode = computed(() => {
    const episodes = compiledData.value?.episodes || []
    if (!episodes.length) return null
    const current = currentStepIndex.value
    return episodes.find(episode => {
      const first = episodeStartIndex(episode)
      const last = episodeEndIndex(episode)
      return first != null && last != null && current >= first && current <= last
    }) || null
  })

  const firstAvailableBg = computed(() => {
    if (!compiledData.value?.steps) return null
    for (const step of compiledData.value.steps.slice(navigationStartIndex.value, navigationEndIndex.value + 1)) {
      const background = step.entry_snapshot?.bg ?? step.state?.bg
      if (background) return background
    }
    return null
  })

  const langLabel = computed(() => {
    const preferences = storyPreferences.value
    if (preferences.story_content_mode === 'translation') return '中文'
    if (preferences.story_content_mode === 'bilingual') {
      return preferences.bilingual_primary === 'translation' ? 'CN+JP' : 'JP+CN'
    }
    return 'JP'
  })

  const LANG_CYCLE = ['original', 'translation', 'bilingual']
  function cycleLanguage() {
    const cur = storyPreferences.value.story_content_mode
    const idx = LANG_CYCLE.indexOf(cur)
    const storyContentMode = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length]
    updateStoryPreferences({
      story_content_mode: storyContentMode,
      bilingual_primary: storyContentMode === 'translation' ? 'translation' : 'original',
    })
  }

  function applyStartStepIfNeeded() {
    if (!compiledData.value?.steps?.length) return
    if (!Number.isFinite(startStep)) {
      currentStepIndex.value = navigationStartIndex.value
      return
    }
    const target = Math.max(navigationStartIndex.value, Math.min(navigationEndIndex.value, startStep - 1))
    currentStepIndex.value = target
  }

  function goNext() {
    clearFadeAutoAdvance()
    ensureAudioCtx()
    if (!isLastStep.value) {
      const step = compiledData.value?.steps?.[currentStepIndex.value]
      if (!isTransitionStep(step)) {
        historyStack.value.push(currentStepIndex.value)
      }
      currentStepIndex.value++
      resetVoiceDedup()
    }
  }

  function goPrev() {
    clearFadeAutoAdvance()
    ensureAudioCtx()
    if (historyStack.value.length > 0) {
      let target = historyStack.value.pop()
      while (target > navigationStartIndex.value && isTransitionStep(compiledData.value?.steps?.[target])) {
        if (historyStack.value.length === 0) {
          target = Math.max(navigationStartIndex.value, target - 1)
          continue
        }
        target = historyStack.value.pop()
      }
      currentStepIndex.value = Math.max(navigationStartIndex.value, target)
      resetVoiceDedup()
    } else if (currentStepIndex.value > navigationStartIndex.value) {
      let target = currentStepIndex.value - 1
      while (target > navigationStartIndex.value && isTransitionStep(compiledData.value?.steps?.[target])) {
        target--
      }
      currentStepIndex.value = Math.max(navigationStartIndex.value, target)
      resetVoiceDedup()
    }
  }

  function onChoice(opt) {
    clearFadeAutoAdvance()
    ensureAudioCtx()
    resetVoiceDedup()
    const selection = createChoiceSelectionRecord(opt, currentStep.value?.choice_id ?? null)
    if (selection.source_text || selection.option_id) {
      selectedChoices.set(currentStepIndex.value, selection)
    }
    const targetStepId = Number(opt.target_step_id ?? opt.step_id)
    if (Number.isFinite(targetStepId) && targetStepId - 1 >= navigationStartIndex.value && targetStepId - 1 <= navigationEndIndex.value) {
      historyStack.value.push(currentStepIndex.value)
      currentStepIndex.value = targetStepId - 1
    }
  }

  function goToStep(index) {
    clearFadeAutoAdvance()
    if (compiledData.value && index >= navigationStartIndex.value && index <= navigationEndIndex.value) {
      historyStack.value.push(currentStepIndex.value)
      currentStepIndex.value = index
    }
  }

  function restoreToStep(index, { historyIndices = [] } = {}) {
    clearFadeAutoAdvance()
    ensureAudioCtx()
    if (!compiledData.value || index < navigationStartIndex.value || index > navigationEndIndex.value) {
      return false
    }
    historyStack.value = historyIndices.filter(candidate =>
      Number.isInteger(candidate)
      && candidate >= navigationStartIndex.value
      && candidate <= navigationEndIndex.value,
    )
    currentStepIndex.value = index
    resetVoiceDedup()
    return true
  }

  return {
    isFirstStep,
    isLastStep,
    firstPlayableIndex,
    navigationStartIndex,
    navigationEndIndex,
    currentEpisode,
    firstAvailableBg,
    langLabel,
    cycleLanguage,
    applyStartStepIfNeeded,
    goNext,
    goPrev,
    onChoice,
    goToStep,
    restoreToStep,
  }
}
