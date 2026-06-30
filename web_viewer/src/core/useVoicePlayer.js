import { getLipSyncUrl, getVoiceUrl } from '../utils/AssetResolver.js'
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

  async function playVoice() {
    if (noVoice) {
      stopCurrentVoice('noVoice-flag')
      isPlaying.value = false
      return
    }

    const step = currentStep.value
    const voice = step?.dialogue?.voice
    const scenarioId = compiledData.value?.scenario_id
    if (!voice) return

    if (voice === lastVoiceUrl && currentStepIndex.value === lastVoiceStepIndex) return
    lastVoiceUrl = voice
    lastVoiceStepIndex = currentStepIndex.value

    stopCurrentVoice('playVoice-new')
    voiceCharaId = step.chara_id || null
    isPlaying.value = false
    ensureAudioCtx()

    try {
      const voiceUrl = getVoiceUrl(voice, scenarioId)
      const res = await fetch(`${voiceUrl}?_=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const contentType = res.headers.get('content-type') || ''
      const arrayBuffer = await res.arrayBuffer()
      if (arrayBuffer.byteLength < 1000 || contentType.includes('text/html')) {
        throw new Error(`Not an audio file: ${contentType} (${arrayBuffer.byteLength} bytes)`)
      }

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }

      let audioBuffer
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      } catch (decodeErr) {
        console.error('[Audio] decodeAudioData FAILED:', decodeErr.message, 'voice:', voice)
        isPlaying.value = false
        return
      }

      if (currentSource || voice !== lastVoiceUrl) return

      currentLipCurve = await loadLipCurve(step, audioBuffer.duration)
      if (currentSource || voice !== lastVoiceUrl) {
        currentLipCurve = null
        return
      }

      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
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
    } catch (err) {
      console.warn('[Audio] playback failed:', err.message, 'voice:', voice)
      isPlaying.value = false
    }
  }

  function dispose() {
    stopCurrentVoice('dispose')
    try { audioCtx?.close?.() } catch (_) {}
    audioCtx = null
    resetVoiceDedup()
  }

  return {
    playVoice,
    setTalking,
    stopCurrentVoice,
    resetVoiceDedup,
    ensureAudioCtx,
    getVoiceVolume,
    dispose,
  }
}
