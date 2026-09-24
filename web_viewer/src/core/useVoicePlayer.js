import { waitForSignal, createLoadTimeout, attachOptionalResource } from './AsyncLoadBoundary.js'
import { getLipSyncUrl, getVoiceUrlCandidates } from '../utils/AssetResolver.js'
import { deriveMainLipPathFromVoice, sampleLipCurve } from '../utils/LipSyncHelpers.js'
import { isKnownDanglingStoryVoice } from '../data/knownDanglingStoryVoices.js'
import { StoryAudioSession } from './story-runtime/StoryAudioSession.js'
import { compressedVoiceCache } from './CompressedVoiceCache.js'

export function useVoicePlayer({
  spineStageRef,
  currentStep,
  currentStepIndex,
  compiledData,
  isPlaying,
  noVoice = false,
  canAnimateStage = () => true,
  audioSession = null,
  onStateChange = () => {},
  voiceTimeoutMs = 20000,
  lipTimeoutMs = 8000,
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
  let activeVoiceLoad = null
  let optionalLipLoad = null
  let lastVoiceFailure = null
  function cancelOptionalLip() { optionalLipLoad?.cancel(); optionalLipLoad = null }
  function recordVoiceFailure(error, phase) {
    lastVoiceFailure = { phase, code: error?.code || error?.name || 'ERROR', message: String(error?.message || error) }
  }
  function setVoiceState(state) { voiceState = state; onStateChange(state) }
  let voiceRequestGeneration = 0
  const pendingVoiceLoads = new Set()
  const decodedVoiceCache = new Map()
  const MAX_DECODED_VOICES = 12
  const MAX_DECODED_VOICE_BYTES = 32 * 1024 * 1024
  let decodedVoiceBytes = 0
  const ORIGINAL_LIP_GAIN = 1.0

  function rememberDecodedVoice(key, buffer) {
    const previous = decodedVoiceCache.get(key)
    if (previous) decodedVoiceBytes -= previous.bytes
    decodedVoiceCache.delete(key)
    // AudioBuffer is 32-bit float PCM per channel. Unknown or oversized
    // buffers stay playable but cannot claim a bounded retained cache slot.
    const bytes = Number(buffer?.length) * Number(buffer?.numberOfChannels) * 4
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_DECODED_VOICE_BYTES) return
    decodedVoiceCache.set(key, { buffer, bytes })
    decodedVoiceBytes += bytes
    while (decodedVoiceCache.size > MAX_DECODED_VOICES || decodedVoiceBytes > MAX_DECODED_VOICE_BYTES) {
      const oldestKey = decodedVoiceCache.keys().next().value
      decodedVoiceBytes -= decodedVoiceCache.get(oldestKey).bytes
      decodedVoiceCache.delete(oldestKey)
    }
  }

  const getVoiceVolume = () => {
    if (!currentLipCurve || voiceStartedAt == null) return 0
    const elapsed = Math.max(0, session.currentTime() - voiceStartedAt)
    return sampleLipCurve(currentLipCurve, elapsed)
  }

  function setTalking(on) {
    if (noVoice || (on && !canAnimateStage())) return
    const mgr = spineStageRef.value?.manager
    if (!mgr || !voiceCharaId) return
    if (on && currentStep.value?.lipSync === false) return
    mgr.setSpineTalking(voiceCharaId, on, getVoiceVolume)
  }

  function ensureAudioCtx() {
    if (session.disabled) return null
    audioCtx = session.ensureContext()
    return audioCtx
  }

  function unlockAudioContext() {
    if (session.disabled) return null
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
    voiceRequestGeneration++
    lastVoiceUrl = null
    lastVoiceStepIndex = -1
  }

  function stopCurrentVoice(reason = 'unspecified') {
    cancelOptionalLip()
    voiceRequestGeneration++
    activeVoiceLoad?.abort()
    activeVoiceLoad = null
    isPlaying.value = false
    setVoiceState('idle')
    if (!currentSource) {
      currentLipCurve = null
      voiceStartedAt = null
      setTalking(false)
      return
    }
    console.debug('[Audio] stopCurrentVoice:', reason)
    currentSource.onended = null
    try { currentSource.stop() } catch (_) {}
    try { currentSource.disconnect() } catch (_) {}
    currentSourceRelease?.()
    currentSourceRelease = null
    currentSource = null
    currentLipCurve = null
    voiceStartedAt = null
    setTalking(false)
  }

  async function loadLipCurve(step, audioDuration, signal) {
    if (step?.lipSync === false) return null

    const candidates = []
    const lipPath = step?.dialogue?.lip?.path
    const derivedPath = deriveMainLipPathFromVoice(step?.dialogue?.voice)
    if (lipPath) candidates.push(lipPath)
    if (derivedPath && !candidates.includes(derivedPath)) candidates.push(derivedPath)
    if (!candidates.length) return null

    let lastError = null
    for (const candidate of candidates) {
      if (signal?.aborted) return null
      try {
        const lipUrl = getLipSyncUrl(candidate)
        const res = await fetch(lipUrl, { signal, cache: 'default' })
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
        if (signal?.aborted) return null
        lastError = err
      }
    }

    console.warn('[LipSync] failed to load original curve:', lastError?.message, candidates)
    return null
  }

  function requiresVoice(step = currentStep.value, scenarioId = compiledData.value?.scenario_id) {
    const voice = step?.dialogue?.voice
    return !!voice && !noVoice && !session.disabled && !isKnownDanglingStoryVoice(scenarioId, voice)
  }

  function hasDecodedVoice(step = currentStep.value, scenarioId = compiledData.value?.scenario_id) {
    const voice = step?.dialogue?.voice
    return !!voice && decodedVoiceCache.has(`${scenarioId || ''}\0${voice}`)
  }

  async function prepareVoice({ step = currentStep.value, scenarioId = compiledData.value?.scenario_id, includeLip = true, signal } = {}) {
    const voice = step?.dialogue?.voice
    if (!voice || noVoice || session.disabled || signal?.aborted) return null
    if (!requiresVoice(step, scenarioId)) {
      console.info('[Audio] skipped RAW-authored dangling story voice:', { scenarioId, voice })
      return null
    }

    const preparingContext = ensureAudioCtx()
    const isCurrentContext = () => preparingContext && audioCtx === preparingContext
      && preparingContext.state !== 'closed' && !signal?.aborted
    const cacheKey = `${scenarioId || ''}\0${voice}`
    try {
      let audioBuffer = decodedVoiceCache.get(cacheKey)?.buffer
      if (audioBuffer) rememberDecodedVoice(cacheKey, audioBuffer)
      else {
        const voiceUrls = getVoiceUrlCandidates(voice, scenarioId)
        let arrayBuffer = null
        let lastFetchError = null
        for (const voiceUrl of voiceUrls) {
          if (!isCurrentContext()) return null
          const controller = new AbortController()
          pendingVoiceLoads.add(controller)
          const forwardAbort = () => controller.abort(signal.reason)
          signal?.addEventListener('abort', forwardAbort, { once: true })
          if (signal?.aborted) forwardAbort()
          try {
            arrayBuffer = await compressedVoiceCache.get(voiceUrl, { signal: controller.signal })
            break
          } catch (error) {
            lastFetchError = error
            if (controller.signal.aborted || ![404, 410].includes(error.status)) throw error
          } finally {
            signal?.removeEventListener('abort', forwardAbort)
            pendingVoiceLoads.delete(controller)
          }
        }
        if (!arrayBuffer) throw lastFetchError || new Error('No voice filename candidate resolved')
        if (!isCurrentContext()) return null

        try {
          audioBuffer = await preparingContext.decodeAudioData(arrayBuffer)
        } catch (decodeErr) {
          if (!isCurrentContext()) return null
          recordVoiceFailure(decodeErr, 'decode-audio')
          console.error('[Audio] decodeAudioData FAILED:', decodeErr.message, 'voice:', voice)
          return null
        }
        if (!isCurrentContext()) return null
        rememberDecodedVoice(cacheKey, audioBuffer)
      }
      if (!isCurrentContext()) return null
      // The optional curve must not gate an already decoded, playable voice.
      // Load it after start with its own owner; do not reuse this preparation signal.
      return { voice, step, scenarioId, audioBuffer, lipCurve: null, lipStep: includeLip ? step : null }
    } catch (err) {
      if (!isCurrentContext()) return null
      recordVoiceFailure(err, 'fetch-or-prepare')
      console.warn('[Audio] prepare failed:', err.message, 'voice:', voice)
      return null
    }
  }

  function playPreparedVoice(prepared) {
    if (noVoice || session.disabled || !prepared?.audioBuffer || !prepared.voice) return false

    stopCurrentVoice('playPreparedVoice-new')
    ensureAudioCtx()

    lastVoiceUrl = prepared.voice
    lastVoiceStepIndex = currentStepIndex.value
    voiceCharaId = prepared.step?.chara_id || null
    currentLipCurve = prepared.lipCurve || null

    let source
    try {
      source = audioCtx.createBufferSource()
      source.buffer = prepared.audioBuffer
      source.connect(session.getBus('voice'))
      const releaseSource = session.registerSource(source, { bus: 'voice', kind: 'dialogue', cue: prepared.voice })
      currentSourceRelease = releaseSource
      voiceStartedAt = session.currentTime()
      currentSource = source
      setVoiceState('playing')
      source.start(0)
      setTalking(true)

      isPlaying.value = true
      if (prepared.lipStep && !prepared.lipCurve) {
        const generation = voiceRequestGeneration // captured after stopCurrentVoice above
        optionalLipLoad = attachOptionalResource({
          timeoutMs: lipTimeoutMs,
          load: signal => loadLipCurve(prepared.lipStep, prepared.audioBuffer.duration, signal),
          isCurrent: () => currentSource === source && voiceRequestGeneration === generation,
          apply: curve => {
            currentLipCurve = curve
            // Sample from elapsed playback time; never restart the voice for a late curve.
            setTalking(true)
          },
          onFailure: error => console.debug('[LipSync] optional curve unavailable:', error?.message),
        })
      }
      source.onended = () => {
        releaseSource()
        if (currentSource !== source) return
        cancelOptionalLip()
        setTalking(false)
        currentLipCurve = null
        voiceStartedAt = null
        currentSourceRelease = null
        currentSource = null
        isPlaying.value = false
        setVoiceState('ended')
      }
      return true
    } catch (error) {
      // A source that cannot start must not retain the voice bus or dedup lock.
      if (source && currentSource !== source) { try { source.disconnect() } catch {} }
      stopCurrentVoice('source-start-failed')
      resetVoiceDedup()
      recordVoiceFailure(error, 'source-start')
      setVoiceState('unavailable')
      return false
    }
  }

  async function preparePlaybackVoice(options) {
    const controller = activeVoiceLoad = new AbortController()
    const timeout = setTimeout(() => controller.abort(createLoadTimeout('voice-ready', voiceTimeoutMs)), voiceTimeoutMs)
    try { return await waitForSignal(prepareVoice({ ...options, signal: controller.signal }), controller.signal) }
    catch (error) {
      if (activeVoiceLoad === controller) recordVoiceFailure(error, 'voice-ready')
      return null
    }
    finally {
      clearTimeout(timeout)
      if (activeVoiceLoad === controller) activeVoiceLoad = null
    }
  }

  async function playVoice() {
    if (noVoice) {
      stopCurrentVoice('noVoice-flag')
      isPlaying.value = false
      setVoiceState('idle')
      return false
    }

    const step = currentStep.value
    const voice = step?.dialogue?.voice
    const scenarioId = compiledData.value?.scenario_id
    if (!voice) {
      stopCurrentVoice('step-change-no-voice')
      setVoiceState('idle')
      return false
    }

    if (voice === lastVoiceUrl && currentStepIndex.value === lastVoiceStepIndex) return false
    stopCurrentVoice('step-change-new-voice')
    const requestGeneration = voiceRequestGeneration
    const stepIndex = currentStepIndex.value
    lastVoiceUrl = voice
    lastVoiceStepIndex = currentStepIndex.value

    isPlaying.value = false
    setVoiceState('preparing')
    const prepared = await preparePlaybackVoice({ step, scenarioId, includeLip: canAnimateStage() })
    if (requestGeneration !== voiceRequestGeneration || step !== currentStep.value
      || stepIndex !== currentStepIndex.value || voice !== lastVoiceUrl) return false
    if (!prepared) {
      // A failed attempt is not a successfully played cue. Allow same-step retry.
      lastVoiceUrl = null
      lastVoiceStepIndex = -1
      setVoiceState('unavailable')
      return false
    }
    lastVoiceFailure = null
    return playPreparedVoice(prepared)
  }

  async function replayVoiceDetached(step) {
    if (noVoice || !step?.dialogue?.voice) return false
    stopCurrentVoice('backlog-replay')
    const requestGeneration = voiceRequestGeneration
    setVoiceState('preparing')
    const prepared = await preparePlaybackVoice({
      step,
      scenarioId: compiledData.value?.scenario_id,
      includeLip: false,
    })
    if (requestGeneration !== voiceRequestGeneration) return false
    if (!prepared) {
      setVoiceState('unavailable')
      return false
    }
    return playPreparedVoice({ ...prepared, step: { ...step, chara_id: null } })
  }

  function retryVoice() {
    stopCurrentVoice('explicit-voice-retry')
    resetVoiceDedup()
    return playVoice()
  }

  function dispose() {
    stopCurrentVoice('dispose')
    for (const controller of pendingVoiceLoads) controller.abort()
    pendingVoiceLoads.clear()
    decodedVoiceCache.clear()
    decodedVoiceBytes = 0
    audioCtx = null
    if (ownsAudioSession) session.dispose().catch(() => {})
    resetVoiceDedup()
  }

  return {
    playVoice,
    retryVoice,
    getDiagnostics: () => ({ state: voiceState, lastFailure: lastVoiceFailure && { ...lastVoiceFailure } }),
    requiresVoice,
    hasDecodedVoice,
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
