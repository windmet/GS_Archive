import { getLipSyncUrl, getVoiceUrlCandidates } from '../utils/AssetResolver.js'
import { deriveMainLipPathFromVoice, sampleLipCurve } from '../utils/LipSyncHelpers.js'
import { StoryAudioSession } from './story-runtime/StoryAudioSession.js'

export function useVoicePlayer({
  spineStageRef,
  currentStep,
  currentStepIndex,
  compiledData,
  isPlaying,
  noVoice = false,
  audioSession = null,
}) {
  const session = audioSession || new StoryAudioSession()
  const ownsAudioSession = !audioSession
  let audioCtx = null
  let currentSource = null
  let currentSourceRelease = null
  let lastVoiceUrl = null
  let lastVoiceStepIndex = -1
  let voiceStartedAt = null
  let currentLipCurve = null
  let voiceCharaId = null
  let voiceState = 'idle'
  const ORIGINAL_LIP_GAIN = 1.0

  const getVoiceVolume = () => {
    if (!currentLipCurve || voiceStartedAt == null) return 0
    const elapsed = Math.max(0, session.currentTime() - voiceStartedAt)
    return sampleLipCurve(currentLipCurve, elapsed)
  }

  function setTalking(on) {
    if (noVoice) return
    const mgr = spineStageRef.value?.manager
    if (!mgr || !voiceCharaId) return
    if (on && currentStep.value?.lipSync === false) return
    mgr.setSpineTalking(voiceCharaId, on, getVoiceVolume)
  }

  function ensureAudioCtx() {
    audioCtx = session.ensureContext()
    return audioCtx
  }

  function unlockAudioContext() {
    audioCtx = session.unlockFromUserGesture()
    return audioCtx
  }

  async function waitForRunningAudioContext(timeoutMs = 1800) {
    ensureAudioCtx()
    if (audioCtx.state === 'running') return
    await Promise.race([
      session.resume('voice-wait'),
      new Promise(resolve => setTimeout(resolve, timeoutMs)),
    ])
    if (audioCtx.state !== 'running') throw new Error('AudioContext is waiting for a user gesture')
  }

  function resetVoiceDedup() {
    lastVoiceUrl = null
    lastVoiceStepIndex = -1
  }

  function stopCurrentVoice(reason = 'unspecified') {
    voiceState = 'idle'
    if (!currentSource) {
      currentLipCurve = null
      voiceStartedAt = null
      setTalking(false)
      return
    }
    console.debug('[Audio] stopCurrentVoice:', reason)
    try { currentSource.stop() } catch (_) {}
    try { currentSource.disconnect() } catch (_) {}
    currentSourceRelease?.()
    currentSourceRelease = null
    currentSource = null
    currentLipCurve = null
    voiceStartedAt = null
    setTalking(false)
  }

  async function loadLipCurve(step, audioDuration) {
    if (step?.lipSync === false) return null

    const candidates = []
    const lipPath = step?.dialogue?.lip?.path
    const derivedPath = deriveMainLipPathFromVoice(step?.dialogue?.voice)
    if (lipPath) candidates.push(lipPath)
    if (derivedPath && !candidates.includes(derivedPath)) candidates.push(derivedPath)
    if (!candidates.length) return null

    let lastError = null
    for (const candidate of candidates) {
      try {
        const lipUrl = getLipSyncUrl(candidate)
        const res = await fetch(`${lipUrl}?_=${Date.now()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('text/html')) throw new Error('lip JSON returned HTML')
        const data = await res.json()
        if (!Array.isArray(data.scales) || data.scales.length === 0) {
          throw new Error('missing scales')
        }
        const source = candidate === lipPath ? 'compiled' : 'derived-main'
        return { path: candidate, source, scales: data.scales, duration: audioDuration, gain: ORIGINAL_LIP_GAIN }
      } catch (err) {
        lastError = err
      }
    }

    console.warn('[LipSync] failed to load original curve:', lastError?.message, candidates)
    return null
  }

  async function prepareVoice({ step = currentStep.value, scenarioId = compiledData.value?.scenario_id, includeLip = true } = {}) {
    const voice = step?.dialogue?.voice
    if (!voice) return null

    ensureAudioCtx()
    try {
      const voiceUrls = getVoiceUrlCandidates(voice, scenarioId)
      let arrayBuffer = null
      let lastFetchError = null
      for (const voiceUrl of voiceUrls) {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 6500)
        try {
          const res = await fetch(`${voiceUrl}?_=${Date.now()}`, { signal: controller.signal })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const contentType = res.headers.get('content-type') || ''
          const candidateBuffer = await res.arrayBuffer()
          if (candidateBuffer.byteLength < 1000 || contentType.includes('text/html')) {
            throw new Error(`Not an audio file: ${contentType} (${candidateBuffer.byteLength} bytes)`)
          }
          arrayBuffer = candidateBuffer
          break
        } catch (error) {
          lastFetchError = error
        } finally {
          window.clearTimeout(timeoutId)
        }
      }
      if (!arrayBuffer) throw lastFetchError || new Error('No voice filename candidate resolved')

      let audioBuffer
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      } catch (decodeErr) {
        console.error('[Audio] decodeAudioData FAILED:', decodeErr.message, 'voice:', voice)
        return null
      }

      const lipCurve = includeLip ? await loadLipCurve(step, audioBuffer.duration) : null
      return { voice, step, scenarioId, audioBuffer, lipCurve }
    } catch (err) {
      console.warn('[Audio] prepare failed:', err.message, 'voice:', voice)
      return null
    }
  }

  function playPreparedVoice(prepared) {
    if (!prepared?.audioBuffer || !prepared.voice) return false

    stopCurrentVoice('playPreparedVoice-new')
    ensureAudioCtx()

    lastVoiceUrl = prepared.voice
    lastVoiceStepIndex = currentStepIndex.value
    voiceCharaId = prepared.step?.chara_id || null
    currentLipCurve = prepared.lipCurve || null

    const source = audioCtx.createBufferSource()
    source.buffer = prepared.audioBuffer
    source.connect(session.getBus('voice'))
    const releaseSource = session.registerSource(source, { bus: 'voice', kind: 'dialogue', cue: prepared.voice })
    currentSourceRelease = releaseSource
    voiceStartedAt = session.currentTime()
    currentSource = source
    voiceState = 'playing'
    source.start(0)
    setTalking(true)

    isPlaying.value = true
    source.onended = () => {
      releaseSource()
      if (currentSource !== source) return
      setTalking(false)
      currentLipCurve = null
      voiceStartedAt = null
      currentSourceRelease = null
      currentSource = null
      isPlaying.value = false
      voiceState = 'ended'
    }
    return true
  }

  async function playVoice() {
    if (noVoice) {
      stopCurrentVoice('noVoice-flag')
      isPlaying.value = false
      voiceState = 'idle'
      return false
    }

    const step = currentStep.value
    const voice = step?.dialogue?.voice
    const scenarioId = compiledData.value?.scenario_id
    if (!voice) {
      stopCurrentVoice('step-change-no-voice')
      voiceState = 'idle'
      return false
    }

    if (voice === lastVoiceUrl && currentStepIndex.value === lastVoiceStepIndex) return false
    stopCurrentVoice('step-change-new-voice')
    lastVoiceUrl = voice
    lastVoiceStepIndex = currentStepIndex.value

    isPlaying.value = false
    voiceState = 'preparing'
    const prepared = await prepareVoice({ step, scenarioId })
    if (!prepared || voice !== lastVoiceUrl) {
      voiceState = 'ended'
      return false
    }
    return playPreparedVoice(prepared)
  }

  async function replayVoiceDetached(step) {
    if (noVoice || !step?.dialogue?.voice) return false
    voiceState = 'preparing'
    const prepared = await prepareVoice({
      step,
      scenarioId: compiledData.value?.scenario_id,
      includeLip: false,
    })
    if (!prepared) {
      voiceState = 'ended'
      return false
    }
    return playPreparedVoice({ ...prepared, step: { ...step, chara_id: null } })
  }

  function dispose() {
    stopCurrentVoice('dispose')
    audioCtx = null
    if (ownsAudioSession) session.dispose().catch(() => {})
    resetVoiceDedup()
  }

  return {
    playVoice,
    prepareVoice,
    playPreparedVoice,
    replayVoiceDetached,
    setTalking,
    stopCurrentVoice,
    resetVoiceDedup,
    ensureAudioCtx,
    unlockAudioContext,
    getVoiceVolume,
    getVoiceState: () => voiceState,
    getAudioSession: () => session,
    dispose,
  }
}
