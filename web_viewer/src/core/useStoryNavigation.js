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
  const isFirstStep = computed(() => historyStack.value.length === 0 && currentStepIndex.value <= firstPlayableIndex.value)
  const isLastStep = computed(() => !compiledData.value || currentStepIndex.value >= compiledData.value.steps.length - 1)

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
    for (const step of compiledData.value.steps.slice(firstPlayableIndex.value)) {
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
      currentStepIndex.value = firstPlayableIndex.value
      return
    }
    const target = Math.max(0, Math.min(compiledData.value.steps.length - 1, startStep - 1))
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
      while (target > firstPlayableIndex.value && isTransitionStep(compiledData.value?.steps?.[target])) {
        if (historyStack.value.length === 0) {
          target = Math.max(firstPlayableIndex.value, target - 1)
          continue
        }
        target = historyStack.value.pop()
      }
      currentStepIndex.value = Math.max(firstPlayableIndex.value, target)
      resetVoiceDedup()
    } else if (currentStepIndex.value > firstPlayableIndex.value) {
      let target = currentStepIndex.value - 1
      while (target > firstPlayableIndex.value && isTransitionStep(compiledData.value?.steps?.[target])) {
        target--
      }
      currentStepIndex.value = Math.max(firstPlayableIndex.value, target)
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
    if (opt.step_id) {
      historyStack.value.push(currentStepIndex.value)
      currentStepIndex.value = opt.step_id - 1
    }
  }

  function goToStep(index) {
    clearFadeAutoAdvance()
    fastForwardTimeline()
    if (compiledData.value && index >= 0 && index < compiledData.value.steps.length) {
      historyStack.value.push(currentStepIndex.value)
      currentStepIndex.value = index
    }
  }

  return {
    isFirstStep,
    isLastStep,
    firstPlayableIndex,
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
  }
}
