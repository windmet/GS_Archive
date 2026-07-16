import { getLipSyncUrl, getVoiceUrlCandidates } from '../utils/AssetResolver.js'
import { deriveMainLipPathFromVoice, sampleLipCurve } from '../utils/LipSyncHelpers.js'

export function useVoicePlayer({
  spineStageRef,
  currentStep,
  currentStepIndex,
  compiledData,
  isPlaying,
  noVoice = false,
}) {
  let audioCtx = null
  let currentSource = null
  let lastVoiceUrl = null
  let lastVoiceStepIndex = -1
  let voiceStartedAt = 0
  let currentLipCurve = null
  let voiceCharaId = null
  const ORIGINAL_LIP_GAIN = 1.0

  const getVoiceVolume = () => {
    if (!currentLipCurve || !voiceStartedAt) return 0
    const elapsed = (performance.now() - voiceStartedAt) / 1000
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
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
  }

  function unlockAudioContext() {
    ensureAudioCtx()
    try {
      const silentBuffer = audioCtx.createBuffer(1, 1, 22050)
      const silentSource = audioCtx.createBufferSource()
      silentSource.buffer = silentBuffer
      silentSource.connect(audioCtx.destination)
      silentSource.start(0)
      silentSource.onended = () => {
        try { silentSource.disconnect() } catch (_) {}
      }
    } catch (_) {}
  }

  async function waitForRunningAudioContext(timeoutMs = 1800) {
    ensureAudioCtx()
    if (audioCtx.state === 'running') return
    await Promise.race([
      audioCtx.resume(),
      new Promise(resolve => setTimeout(resolve, timeoutMs)),
    ])
    if (audioCtx.state !== 'running') throw new Error('AudioContext is waiting for a user gesture')
  }

  function resetVoiceDedup() {
    lastVoiceUrl = null
    lastVoiceStepIndex = -1
  }

  function stopCurrentVoice(reason = 'unspecified') {
    if (!currentSource) return
    console.warn('[Audio] stopCurrentVoice:', reason)
    try { currentSource.stop() } catch (_) {}
    try { currentSource.disconnect() } catch (_) {}
    currentSource = null
    currentLipCurve = null
    voiceStartedAt = 0
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

  async function prepareVoice({ step = currentStep.value, scenarioId = compiledData.value?.scenario_id } = {}) {
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

      const lipCurve = await loadLipCurve(step, audioBuffer.duration)
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
    source.connect(audioCtx.destination)
    voiceStartedAt = performance.now()
    source.start(0)
    setTalking(true)

    currentSource = source
    isPlaying.value = true
    source.onended = () => {
      setTalking(false)
      currentLipCurve = null
      voiceStartedAt = 0
      isPlaying.value = false
      if (currentSource === source) currentSource = null
    }
    return true
  }

  async function playVoice() {
    if (noVoice) {
      stopCurrentVoice('noVoice-flag')
      isPlaying.value = false
      return false
    }

    const step = currentStep.value
    const voice = step?.dialogue?.voice
    const scenarioId = compiledData.value?.scenario_id
    if (!voice) return false

    if (voice === lastVoiceUrl && currentStepIndex.value === lastVoiceStepIndex) return false
    lastVoiceUrl = voice
    lastVoiceStepIndex = currentStepIndex.value

    isPlaying.value = false
    const prepared = await prepareVoice({ step, scenarioId })
    if (!prepared || voice !== lastVoiceUrl) return false
    return playPreparedVoice(prepared)
  }

  function dispose() {
    stopCurrentVoice('dispose')
    try { audioCtx?.close?.() } catch (_) {}
    audioCtx = null
    resetVoiceDedup()
  }

  return {
    playVoice,
    prepareVoice,
    playPreparedVoice,
    setTalking,
    stopCurrentVoice,
    resetVoiceDedup,
    ensureAudioCtx,
    unlockAudioContext,
    getVoiceVolume,
    dispose,
  }
}
