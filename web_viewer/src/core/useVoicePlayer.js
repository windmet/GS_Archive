import { withLoadDeadline } from './AsyncLoadBoundary.js'
import { getVoiceUrlCandidates } from '../utils/AssetResolver.js'
import { sampleLipCurve } from '../utils/LipSyncHelpers.js'
import { isKnownDanglingStoryVoice } from '../data/knownDanglingStoryVoices.js'
import { PlayerPreferencesRepository } from './story-runtime/PlayerPreferencesRepository.js'
import { StoryAudioSession } from './story-runtime/StoryAudioSession.js'
import { compressedVoiceCache } from './CompressedVoiceCache.js'
import { VoiceMediaOutput } from './VoiceMediaOutput.js'
import { createVoiceLipStore } from './VoiceLipStore.js'
import { tracePlayer } from './PlayerTrace.js'

export function useVoicePlayer({ spineStageRef, currentStep, currentStepIndex, compiledData, isPlaying,
  noVoice = false, canAnimateStage = () => true, audioSession = null, onStateChange = () => {},
  voiceTimeoutMs = 20000, lipTimeoutMs = 8000, decodeTimeoutMs = 6000,
  backendMode = 'auto', createAudio, resolveVoiceUrls = getVoiceUrlCandidates, voiceCache = compressedVoiceCache, lipStore = createVoiceLipStore(),
}) {
  const volumes = audioSession ? null : new PlayerPreferencesRepository().load().volumes
  const session = audioSession || new StoryAudioSession({ masterVolume: volumes.master, busVolumes: volumes })
  const ownsAudioSession = !audioSession
  const lifetime = new AbortController()
  const preparations = new Set(), lipRequests = new Set()
  const decodedCache = new Map(), resolvedUrls = new Map()
  let decodedBytes = 0, audioCtx = null, generation = 0, foregroundPreparation = null
  let current = null, voiceState = 'idle', mode = backendMode
  let lastVoiceUrl = null, lastVoiceStepIndex = -1, lastFailure = null, lastAttempt = null
  const media = new VoiceMediaOutput(session, { createAudio, timeoutMs: voiceTimeoutMs })
  const disposed = () => lifetime.signal.aborted
  const keyOf = (step, scenarioId) => `${scenarioId || ''}\0${step?.dialogue?.voice || ''}`
  function ensureAudioCtx() { if (disposed() || session.disabled) return null; return audioCtx = session.ensureContext() }
  function unlockAudioContext() { if (disposed() || session.disabled) return null; return audioCtx = session.unlockFromUserGesture() }
  function setVoiceState(value) { voiceState = value; onStateChange(value) }
  function fail(error, phase, attempt = lastAttempt) {
    lastFailure = { voice: attempt?.voice || null, url: attempt?.url || null, phase,
      code: error?.code || error?.name || 'ERROR', message: String(error?.message || error) }
    tracePlayer('voice-failure', lastFailure)
  }
  function remember(key, buffer) {
    const previous = decodedCache.get(key)
    if (previous) decodedBytes -= previous.bytes
    decodedCache.delete(key)
    const bytes = Number(buffer?.length) * Number(buffer?.numberOfChannels) * 4
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 32 * 1024 * 1024) return
    decodedCache.set(key, { buffer, bytes }); decodedBytes += bytes
    while (decodedCache.size > 12 || decodedBytes > 32 * 1024 * 1024) {
      const first = decodedCache.keys().next().value
      decodedBytes -= decodedCache.get(first).bytes; decodedCache.delete(first)
    }
  }
  function rememberUrl(key, url) {
    resolvedUrls.delete(key); resolvedUrls.set(key, url)
    if (resolvedUrls.size > 128) resolvedUrls.delete(resolvedUrls.keys().next().value)
  }
  function startLip(step, enabled) {
    if (!enabled || step?.lipSync === false) return null
    const controller = new AbortController()
    const request = { controller, curve: null, cancel: () => controller.abort() }
    lipRequests.add(request)
    request.done = lipStore.load(step, { signal: controller.signal, timeoutMs: lipTimeoutMs })
      .then(curve => {
        if (!controller.signal.aborted && !disposed()) request.curve = curve
      }).catch(error => {
        if (!controller.signal.aborted) tracePlayer('optional-lip-unavailable', { message: error.message })
      }).finally(() => lipRequests.delete(request))
    return request
  }
  function releasePreparedVoice(prepared) { prepared?.lipRequest?.cancel() }
  function requiresVoice(step = currentStep.value, scenarioId = compiledData.value?.scenario_id) {
    const voice = step?.dialogue?.voice
    return Boolean(voice && !noVoice && !session.disabled && !disposed() && !isKnownDanglingStoryVoice(scenarioId, voice))
  }
  function hasDecodedVoice(step = currentStep.value, scenarioId = compiledData.value?.scenario_id) {
    return decodedCache.has(keyOf(step, scenarioId))
  }
  function makeMediaPrepared(step, scenarioId, includeLip = true) {
    const voice = step.dialogue.voice
    const url = resolvedUrls.get(keyOf(step, scenarioId)) || resolveVoiceUrls(voice, scenarioId)[0]
    return { voice, step, scenarioId, backend: 'media', url,
      lipRequest: startLip(step, includeLip), diagnostics: { voice, scenarioId, url, backend: 'media', sourceStarted: false } }
  }
  async function prepareVoice({ step = currentStep.value, scenarioId = compiledData.value?.scenario_id,
    includeLip = true, signal, backend = mode } = {}) {
    if (!requiresVoice(step, scenarioId) || signal?.aborted) return null
    if (backend === 'media') return makeMediaPrepared(step, scenarioId, includeLip)
    const context = ensureAudioCtx()
    if (!context) return null
    const controller = new AbortController()
    const abort = () => controller.abort(signal?.reason || lifetime.signal.reason)
    signal?.addEventListener('abort', abort, { once: true })
    lifetime.signal.addEventListener('abort', abort, { once: true })
    preparations.add(controller)
    const currentOwner = () => !disposed() && !controller.signal.aborted && audioCtx === context && context.state !== 'closed'
    const key = keyOf(step, scenarioId), voice = step.dialogue.voice
    const attempt = { voice, scenarioId, url: null, transport: null, decoded: null, sourceStarted: false,
      backend: 'webaudio', startedAt: performance.now(), timings: {} }
    lastAttempt = attempt
    lastFailure = null
    // Start optional lip alongside audio, never after source.start and never as a gate.
    const lipRequest = startLip(step, includeLip)
    let transferred = false
    try {
      let audioBuffer = decodedCache.get(key)?.buffer
      if (audioBuffer) {
        attempt.cache = 'decoded'; attempt.url = resolvedUrls.get(key) || resolveVoiceUrls(voice, scenarioId)[0]
        remember(key, audioBuffer)
      } else {
        const bytes = await withLoadDeadline(async requestSignal => {
          const urls = resolveVoiceUrls(voice, scenarioId)
          for (let index = 0; index < urls.length; index++) {
            attempt.url = urls[index]
            try {
              const data = await voiceCache.get(urls[index], { signal: requestSignal, onDiagnostics: value => {
                attempt.transport = value; attempt.url = value.url; attempt.cache = value.cache
              } })
              rememberUrl(key, urls[index])
              return data
            } catch (error) {
              if (error.diagnostics) attempt.transport = error.diagnostics
              if (requestSignal.aborted || ![404, 410].includes(error.status) || index + 1 === urls.length) throw error
            }
          }
          throw new Error('No voice URL candidate')
        }, { signal: controller.signal, timeoutMs: voiceTimeoutMs, label: 'voice-fetch' })
        if (!currentOwner()) return null
        attempt.timings.fetchedMs = Math.round(performance.now() - attempt.startedAt)
        tracePlayer('voice-fetched', { voice, bytes: bytes.byteLength, elapsedMs: attempt.timings.fetchedMs })
        const decodeStart = performance.now()
        try {
          audioBuffer = await withLoadDeadline(() => context.decodeAudioData(bytes), {
            signal: controller.signal, timeoutMs: decodeTimeoutMs, label: 'voice-decode',
          })
        } catch (error) {
          if (!currentOwner()) return null
          attempt.decodeError = { code: error.code || error.name, message: error.message }
          if (backend !== 'auto' || ['InvalidStateError', 'AbortError'].includes(error.name)) {
            fail(error, 'decode-audio', attempt); return null
          }
          // Only a failure INSIDE the decoder selects this path; network and
          // cancellation failures do not silently change playback backend.
          attempt.backend = 'media'
          transferred = true
          tracePlayer('voice-backend-fallback', { voice, code: error.code || error.name })
          return { voice, step, scenarioId, backend: 'media', url: attempt.url, diagnostics: attempt, lipRequest }
        }
        if (!currentOwner()) return null
        attempt.timings.decodeMs = Math.round(performance.now() - decodeStart)
        remember(key, audioBuffer)
      }
      attempt.decoded = { duration: audioBuffer.duration ?? null, sampleRate: audioBuffer.sampleRate ?? null, channels: audioBuffer.numberOfChannels ?? null }
      transferred = true
      return { voice, step, scenarioId, audioBuffer, backend: 'webaudio', url: attempt.url, diagnostics: attempt, lipRequest }
    } catch (error) {
      if (currentOwner()) fail(error, 'fetch-or-prepare', attempt)
      return null
    } finally {
      if (!transferred) lipRequest?.cancel()
      signal?.removeEventListener('abort', abort)
      lifetime.signal.removeEventListener('abort', abort)
      preparations.delete(controller)
    }
  }
  function getVoiceVolume() {
    const curve = current?.prepared.lipRequest?.curve || current?.prepared.lipCurve
    if (!curve || !current.started) return 0
    const elapsed = current.backend === 'media' ? media.currentTime() : Math.max(0, session.currentTime() - current.startedAt)
    const duration = current.backend === 'media' ? media.duration() : current.prepared.audioBuffer?.duration
    return sampleLipCurve({ ...curve, duration: duration || curve.scales.length / 60 }, elapsed)
  }
  function setTalking(on) {
    if (noVoice || (on && !canAnimateStage())) return
    const id = current?.prepared.step?.chara_id
    if (!id || (on && current.prepared.step?.lipSync === false)) return
    spineStageRef.value?.manager?.setSpineTalking(id, on, getVoiceVolume)
  }
  function stopCurrentVoice(reason = 'unspecified') {
    generation++
    foregroundPreparation?.abort(); foregroundPreparation = null
    const owner = current
    if (owner) {
      setTalking(false)
      current = null
      owner.controller.abort()
      owner.source && (owner.source.onended = null)
      try { owner.source?.stop(); owner.source?.disconnect() } catch {}
      owner.release?.()
      releasePreparedVoice(owner.prepared)
    }
    media.stop()
    isPlaying.value = false
    setVoiceState('idle')
    tracePlayer('voice-stop', { reason })
  }
  function resetVoiceDedup() { generation++; lastVoiceUrl = null; lastVoiceStepIndex = -1 }
  async function playPreparedVoice(prepared) {
    if (!prepared?.voice || (!prepared.audioBuffer && prepared.backend !== 'media') || noVoice || session.disabled || disposed()) {
      releasePreparedVoice(prepared); return false
    }
    stopCurrentVoice('playPreparedVoice-new')
    const owner = { prepared, controller: new AbortController(), backend: prepared.backend || 'webaudio', started: false }
    current = owner
    const isCurrent = () => current === owner && !owner.controller.signal.aborted && !disposed()
    lastAttempt = prepared.diagnostics || { voice: prepared.voice, backend: owner.backend }
    lastVoiceUrl = prepared.voice
    lastVoiceStepIndex = currentStepIndex.value
    setVoiceState('preparing')
    const ended = () => { if (isCurrent()) { stopCurrentVoice('ended'); setVoiceState('ended') } }
    const failed = error => {
      if (!isCurrent()) return
      stopCurrentVoice('source-failed'); resetVoiceDedup(); fail(error, 'source-start'); setVoiceState('unavailable')
    }
    try {
      ensureAudioCtx()
      if (audioCtx.state !== 'running' || session.paused) await session.waitUntilRunning({ signal: owner.controller.signal })
      if (!isCurrent()) return false
      if (owner.backend === 'media') {
        // In manual compatibility retry this executes before the first await,
        // preserving the user's play gesture when the context is already running.
        const started = await media.start(prepared.url, { signal: owner.controller.signal, cue: prepared.voice,
          onEnded: ended, onFailure: failed, onState: state => { if (isCurrent()) setVoiceState(state) } })
        if (!started || !isCurrent()) return false
      } else {
        const source = audioCtx.createBufferSource()
        owner.source = source
        source.buffer = prepared.audioBuffer
        source.connect(session.getBus('voice'))
        owner.release = session.registerSource(source, { bus: 'voice', kind: 'dialogue', cue: prepared.voice })
        owner.startedAt = session.currentTime()
        source.onended = ended
        source.start(0)
      }
      if (!isCurrent()) return false
      owner.started = true
      lastAttempt.sourceStarted = true
      lastAttempt.contextAtStart = audioCtx.state
      lastFailure = null
      setVoiceState('playing'); isPlaying.value = true; setTalking(true)
      tracePlayer('voice-started', { voice: prepared.voice, backend: owner.backend, context: audioCtx.state })
      return true
    } catch (error) { failed(error); return false }
  }
  async function playVoice() {
    const step = currentStep.value, scenarioId = compiledData.value?.scenario_id
    if (!requiresVoice(step, scenarioId)) { stopCurrentVoice('no-voice'); return false }
    const voice = step.dialogue.voice, index = currentStepIndex.value
    if (voice === lastVoiceUrl && index === lastVoiceStepIndex) return false
    stopCurrentVoice('step-change-new-voice')
    const request = generation
    lastVoiceUrl = voice; lastVoiceStepIndex = index
    const controller = foregroundPreparation = new AbortController()
    setVoiceState('preparing')
    const prepared = await prepareVoice({ step, scenarioId, includeLip: canAnimateStage(), signal: controller.signal })
    if (request !== generation || step !== currentStep.value || index !== currentStepIndex.value) {
      releasePreparedVoice(prepared); return false
    }
    foregroundPreparation = null
    if (!prepared) { resetVoiceDedup(); setVoiceState('unavailable'); return false }
    return playPreparedVoice(prepared)
  }
  async function replayVoiceDetached(step) {
    if (!requiresVoice(step)) return false
    stopCurrentVoice('backlog-replay')
    if (mode === 'media') return playPreparedVoice(makeMediaPrepared({ ...step, chara_id: null }, compiledData.value?.scenario_id, false))
    const request = generation
    const controller = foregroundPreparation = new AbortController()
    setVoiceState('preparing')
    const prepared = await prepareVoice({ step, scenarioId: compiledData.value?.scenario_id, includeLip: false, signal: controller.signal })
    if (request !== generation) { releasePreparedVoice(prepared); return false }
    foregroundPreparation = null
    if (!prepared) { resetVoiceDedup(); setVoiceState('unavailable'); return false }
    return playPreparedVoice({ ...prepared, step: { ...step, chara_id: null } })
  }
  function setBackendMode(value) {
    if (!['auto', 'webaudio', 'media'].includes(value)) throw new TypeError('Unknown voice backend')
    mode = value
  }
  function retryVoice(options = {}) {
    if (options?.backend) setBackendMode(options.backend)
    stopCurrentVoice('explicit-voice-retry'); resetVoiceDedup()
    if (mode === 'media' && requiresVoice()) {
      return playPreparedVoice(makeMediaPrepared(currentStep.value, compiledData.value?.scenario_id, canAnimateStage()))
    }
    return playVoice()
  }
  function dispose() {
    if (disposed()) return
    stopCurrentVoice('dispose')
    lifetime.abort()
    for (const controller of preparations) controller.abort()
    for (const request of lipRequests) request.cancel()
    preparations.clear(); lipRequests.clear()
    media.dispose(); lipStore.clear(); decodedCache.clear(); resolvedUrls.clear(); decodedBytes = 0
    audioCtx = null
    if (ownsAudioSession) session.dispose().catch(() => {})
    resetVoiceDedup()
  }
  return { playVoice, retryVoice, replayVoiceDetached, prepareVoice, playPreparedVoice, releasePreparedVoice,
    requiresVoice, hasDecodedVoice, stopCurrentVoice, resetVoiceDedup, setTalking, getVoiceVolume,
    ensureAudioCtx, unlockAudioContext, setBackendMode, getBackendMode: () => mode,
    getVoiceState: () => voiceState, getAudioSession: () => session, dispose,
    getDiagnostics: () => ({ state: voiceState, contextState: audioCtx?.state || 'uninitialized',
      voiceGain: session.inspect().buses.voice, activeSource: Boolean(current?.started), backendMode: mode,
      attempt: lastAttempt && structuredClone(lastAttempt), lastFailure: lastFailure && { ...lastFailure },
      decodedCache: { entries: decodedCache.size, bytes: decodedBytes }, compressedCache: voiceCache.inspect(),
      lipCache: lipStore.inspect(), media: media.inspect() }),
  }
}
