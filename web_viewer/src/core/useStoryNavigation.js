import { computed } from 'vue'
import { isTransitionStep } from '../utils/StoryStepFlow.js'

export function useStoryNavigation({
  compiledData,
  currentStep,
  currentStepIndex,
  historyStack,
  selectedChoices,
  languageMode,
  setLanguageMode,
  startStep,
  endStep,
  clearFadeAutoAdvance,
  fastForwardTimeline,
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
    return (compiledData.value?.episodes || []).find(episode =>
      startIndex >= episode.start_step_index && startIndex <= episode.end_step_index,
    ) || null
  })
  const navigationStartIndex = computed(() => {
    const lastIndex = Math.max(0, (compiledData.value?.steps?.length || 1) - 1)
    if (!Number.isFinite(startStep)) return Math.min(firstPlayableIndex.value, lastIndex)
    return Math.max(firstPlayableIndex.value, Math.min(lastIndex, startStep - 1))
  })
  const navigationEndIndex = computed(() => {
    const lastIndex = Math.max(0, (compiledData.value?.steps?.length || 1) - 1)
    const inferredEnd = startEpisode.value?.end_step_index
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
    return episodes.find(ep => current >= ep.start_step_index && current <= ep.end_step_index) || null
  })

  const currentEpisodeLabel = computed(() => {
    const ep = currentEpisode.value
    if (!ep) {
      const idx = currentStep.value?.episode_index
      if (idx == null) return ''
      return `EP${String(Number(idx) + 1).padStart(2, '0')}`
    }
    const no = String(ep.episode_no || ep.episode_index + 1).padStart(2, '0')
    return `EP${no}`
  })

  const firstAvailableBg = computed(() => {
    if (!compiledData.value?.steps) return null
    for (const step of compiledData.value.steps.slice(navigationStartIndex.value, navigationEndIndex.value + 1)) {
      if (step.state?.bg) return step.state.bg
    }
    return null
  })

  const langLabel = computed(() => {
    const labels = { JP: 'JP', CN: '中文', BILINGUAL: 'JP+CN' }
    return labels[languageMode.value] || 'JP'
  })

  const LANG_CYCLE = ['JP', 'CN', 'BILINGUAL']
  function cycleLanguage() {
    const cur = languageMode.value
    const idx = LANG_CYCLE.indexOf(cur)
    setLanguageMode(LANG_CYCLE[(idx + 1) % LANG_CYCLE.length])
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
    fastForwardTimeline()
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
    fastForwardTimeline()
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
    fastForwardTimeline()
    ensureAudioCtx()
    resetVoiceDedup()
    const text = opt.detail || opt.text || opt.label || ''
    if (text) {
      selectedChoices.set(currentStepIndex.value, text)
    }
    if (opt.step_id && opt.step_id - 1 >= navigationStartIndex.value && opt.step_id - 1 <= navigationEndIndex.value) {
      historyStack.value.push(currentStepIndex.value)
      currentStepIndex.value = opt.step_id - 1
    }
  }

  function goToStep(index) {
    clearFadeAutoAdvance()
    fastForwardTimeline()
    if (compiledData.value && index >= navigationStartIndex.value && index <= navigationEndIndex.value) {
      historyStack.value.push(currentStepIndex.value)
      currentStepIndex.value = index
    }
  }

  function restoreToStep(index, { historyIndices = [] } = {}) {
    clearFadeAutoAdvance()
    fastForwardTimeline()
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
    currentEpisodeLabel,
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
