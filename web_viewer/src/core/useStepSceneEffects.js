import { getAutoAdvanceTiming } from '../utils/StoryStepFlow.js'
import { getRuntimeCueFeatureFlags } from './story-runtime/RuntimeFeatureFlags.js'

export function useStepSceneEffects({
  currentStepIndex,
  isLastStep,
  historyStack,
  spineStageRef,
  audioManager,
  voicePlayer,
  resetVoiceDedup,
  startTimeline,
  onEpisodeEnd,
  isAutoBlocked = () => false,
  beforeAutoAdvance = () => {},
  runtimeFlags = getRuntimeCueFeatureFlags(),
}) {
  let _fadeAutoTimer = null
  let _fadeAutoSeq = 0
  let _seTimers = []
  let _lastEnvCue = null
  let _lastBgmId = null

  function clearFadeAutoAdvance() {
    _fadeAutoSeq++
    if (_fadeAutoTimer) {
      clearTimeout(_fadeAutoTimer)
      _fadeAutoTimer = null
    }
  }

  function clearSeTimers() {
    for (const timer of _seTimers) {
      clearTimeout(timer)
    }
    _seTimers = []
  }

  function playStepSE(se) {
    if (!se?.cue) return
    audioManager.preloadSE?.(se.cue)
    const rawDelay = se.delay ?? se.volume ?? 0
    const delay = Number.parseFloat(rawDelay)
    if (Number.isFinite(delay) && delay > 0) {
      const timer = setTimeout(() => {
        audioManager.playSE(se.cue)
      }, delay * 1000)
      _seTimers.push(timer)
    } else {
      audioManager.playSE(se.cue)
    }
  }

  function handleStepChange(newStep, oldStep, { restore = false } = {}) {
    console.log('[Audio] watch(currentStep) fired:', oldStep?.dialogue?.voice, '->', newStep?.dialogue?.voice)
    clearFadeAutoAdvance()
    clearSeTimers()

    const episodeChanged = oldStep && newStep && oldStep.episode_index !== newStep.episode_index
    if (episodeChanged) {
      spineStageRef.value?.manager?.cancelAllSpineTweens?.()
    }

    if (!restore && !runtimeFlags.se) {
      const seEvents = Array.isArray(newStep?.state?.se_events) ? newStep.state.se_events : []
      if (seEvents.length > 0) {
        for (const se of seEvents) {
          playStepSE(se)
        }
      } else {
        playStepSE(newStep?.state?.se)
      }
    }

    const env = newStep?.state?.environmental
    const envCue = env?.cue
    if (envCue && envCue !== _lastEnvCue) {
      audioManager.playAmbient(envCue, 0.5, env?.volume)
      _lastEnvCue = envCue
    } else if (!envCue && _lastEnvCue) {
      audioManager.stopAmbient()
      _lastEnvCue = null
    }
    if (env?.volume != null && env.volume !== '' && envCue === _lastEnvCue) {
      audioManager.setAmbientVolume(env.volume)
    }
    if (newStep?.state?.environmental_duck_target != null) {
      audioManager.setAmbientVolume(newStep.state.environmental_duck_target)
    }

    const bgmId = newStep?.state?.bgm
    const bgmStopFade = newStep?.state?.bgm_stop_fade
    if (bgmId && bgmId !== _lastBgmId) {
      audioManager.playBgm(bgmId)
      _lastBgmId = bgmId
    } else if (!bgmId && _lastBgmId) {
      audioManager.stopBgm(bgmStopFade != null ? bgmStopFade : 1.0)
      _lastBgmId = null
    }

    const autoAdvance = restore ? null : getAutoAdvanceTiming(newStep)
    if (autoAdvance) {
      const autoSeq = _fadeAutoSeq
      const autoStepIndex = currentStepIndex.value
      const attemptAutoAdvance = () => {
        _fadeAutoTimer = null
        if (autoSeq === _fadeAutoSeq && currentStepIndex.value === autoStepIndex) {
          if (isAutoBlocked()) {
            _fadeAutoTimer = setTimeout(attemptAutoAdvance, 50)
            return
          }
          if (isLastStep.value) {
            beforeAutoAdvance()
            onEpisodeEnd?.()
          } else {
            beforeAutoAdvance()
            if (autoAdvance.pushHistory) {
              historyStack.value.push(currentStepIndex.value)
            }
            currentStepIndex.value++
            resetVoiceDedup()
          }
        }
      }
      _fadeAutoTimer = setTimeout(attemptAutoAdvance, autoAdvance.delayMs)
    }

    if (!restore) {
      voicePlayer?.playVoice?.()
      if (!runtimeFlags.spine) startTimeline()
    }
  }

  function cleanup() {
    clearFadeAutoAdvance()
    clearSeTimers()
  }

  return {
    clearFadeAutoAdvance,
    clearSeTimers,
    handleStepChange,
    cleanup,
  }
}
