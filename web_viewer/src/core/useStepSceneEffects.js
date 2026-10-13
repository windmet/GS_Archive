import { getAutoAdvanceTiming } from '../utils/StoryStepFlow.js'

import { getStepSceneState } from './story-runtime/StepSceneState.js'
import {
  AMBIENCE_DUCK_CURVE,
  AMBIENCE_DUCKED_LEVEL,
  AMBIENCE_RESTORE_CURVE,
} from './story-runtime/storyAmbienceCurves.js'

// Client StoryView.PlayView ducks ambience (AmbienceDucking) when a Title, TimeText or
// Text cut is shown, and StoryPhone.OpenPhone ducks after _mobileAmbienceDuckingTime.
const TEXT_DUCK_STEPS = new Set(['adv', 'title', 'text_time'])
const PHONE_DUCK_STEPS = new Set(['talk', 'call', 'talk_stamp'])
const MOBILE_AMBIENCE_DUCKING_TIME = 0.5

export function useStepSceneEffects({
  currentStepIndex,
  isLastStep,
  historyStack,
  spineStageRef,
  audioManager,
  voicePlayer,
  takePreparedVoice = () => null,
  resetVoiceDedup,
  onEpisodeEnd,
  isAutoBlocked = () => false,
  beforeAutoAdvance = () => {},
  beforeStepChange = () => {},
}) {
  let _fadeAutoTimer = null
  let _fadeAutoSeq = 0
  let _lastEnvCue = null
  let _lastBgmId = null
  // Client StoryView waits `time` seconds from the cut start before ambience/BGM
  // play/stop (WaitSound). Pending waits are dropped on the next step, which then
  // reconciles against what is actually playing.
  let _audioWaits = []
  // StoryView.ambienceVolume: Normal / Ducking. AmbienceDucking is a no-op once ducked;
  // new ambience resets it (CoPlayAmbienceSound).
  let _ambienceDucked = false

  function duckAmbience(seconds) {
    if (_ambienceDucked) return
    _ambienceDucked = true
    // With nothing playing only the state changes; the next ambience restores from it.
    afterAudioWait(seconds, () => {
      const observed = audioManager.inspect?.()
      if (observed && !observed.ambient_cue && !observed.has_ambient_source) return
      audioManager.setAmbientCurve?.(AMBIENCE_DUCK_CURVE)
    })
  }

  function clearAudioWaits() {
    for (const timer of _audioWaits) clearTimeout(timer)
    _audioWaits = []
  }

  function afterAudioWait(seconds, action) {
    const ms = Number(seconds) > 0 ? Number(seconds) * 1000 : 0
    if (!ms) return action()
    _audioWaits.push(setTimeout(action, ms))
  }

  function clearFadeAutoAdvance() {
    _fadeAutoSeq++
    if (_fadeAutoTimer) {
      clearTimeout(_fadeAutoTimer)
      _fadeAutoTimer = null
    }
  }

  function handleStepChange(newStep, oldStep, { restore = false } = {}) {
    console.log('[Audio] watch(currentStep) fired:', oldStep?.dialogue?.voice, '->', newStep?.dialogue?.voice)
    clearFadeAutoAdvance()

    const episodeChanged = oldStep && newStep && oldStep.episode_index !== newStep.episode_index
    if (episodeChanged) {
      spineStageRef.value?.manager?.cancelAllSpineTweens?.()
    }

    clearAudioWaits()
    const sceneState = getStepSceneState(newStep)
    const wait = seconds => (restore ? 0 : seconds)
    // `environmental.volume`, `environmental_duck_target` and `bgm_stop_fade` in older
    // compiled data hold the client's start times (vals[3] / vals[0]), not volumes or
    // fade lengths, so they are never applied as volume.
    const env = sceneState?.environmental
    const envCue = env?.cue
    const observedAudio = audioManager.inspect?.()
    const activeEnvCue = observedAudio ? observedAudio.ambient_cue : _lastEnvCue
    const hasAmbientSource = observedAudio ? observedAudio.has_ambient_source : Boolean(_lastEnvCue)
    const textStep = TEXT_DUCK_STEPS.has(newStep?.type) || PHONE_DUCK_STEPS.has(newStep?.type)
    // Text handling precedes the cut's sound list in PlayView.
    if (restore) {
      _ambienceDucked = textStep
    } else if (TEXT_DUCK_STEPS.has(newStep?.type)) {
      duckAmbience(0)
    } else if (PHONE_DUCK_STEPS.has(newStep?.type)) {
      duckAmbience(MOBILE_AMBIENCE_DUCKING_TIME)
    }
    if (sceneState?.environmental_ducking_delay != null && !restore) {
      duckAmbience(sceneState.environmental_ducking_delay)
    }
    if (envCue && envCue !== activeEnvCue) {
      _lastEnvCue = envCue
      const startDucked = Boolean(env?.ducking_completed) || (restore && _ambienceDucked)
      const restoring = !startDucked && _ambienceDucked
      _ambienceDucked = startDucked
      afterAudioWait(wait(env?.delay), () => audioManager.playAmbient(envCue, 0.5,
        startDucked || restoring ? AMBIENCE_DUCKED_LEVEL : 1,
        { curve: restoring ? AMBIENCE_RESTORE_CURVE : null }))
    } else if (!envCue && (activeEnvCue || hasAmbientSource)) {
      _lastEnvCue = null
      afterAudioWait(wait(sceneState?.environmental_stop_delay), () => audioManager.stopAmbient())
    }

    const bgmId = sceneState?.bgm
    const bgmStopDelay = sceneState?.bgm_stop_delay ?? sceneState?.bgm_stop_fade
    const activeBgmId = observedAudio ? observedAudio.bgm_cue : _lastBgmId
    const hasBgmSource = observedAudio ? observedAudio.has_bgm_source : Boolean(_lastBgmId)
    if (bgmId && bgmId !== activeBgmId) {
      _lastBgmId = bgmId
      afterAudioWait(wait(sceneState?.bgm_delay), () => audioManager.playBgm(bgmId))
    } else if (!bgmId && (activeBgmId || hasBgmSource)) {
      _lastBgmId = null
      afterAudioWait(wait(bgmStopDelay), () => audioManager.stopBgm(1.0))
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
            beforeStepChange(currentStepIndex.value + 1)
            currentStepIndex.value++
            resetVoiceDedup()
          }
        }
      }
      _fadeAutoTimer = setTimeout(attemptAutoAdvance, autoAdvance.delayMs)
    }

    if (!restore) {
      // The step's voice gate hands over either a finished preparation or one still in flight.
      const prepared = takePreparedVoice(newStep, currentStepIndex.value)
      const work = prepared?.promise ? voicePlayer?.playVoice?.({ pending: prepared })
        : prepared ? voicePlayer?.playPreparedVoice?.(prepared) : voicePlayer?.playVoice?.()
      void Promise.resolve(work).catch(error => console.warn('[Voice] Playback failed:', error))
    }
  }

  function cleanup() {
    clearFadeAutoAdvance()
    clearAudioWaits()
  }

  function inspect() {
    return { timer_pending: Number(_fadeAutoTimer != null), audio_waits_pending: _audioWaits.length }
  }

  return {
    clearFadeAutoAdvance,
    handleStepChange,
    inspect,
    cleanup,
  }
}
