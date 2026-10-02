import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { claimMusicAudioSession, releaseMusicAudioSession } from '../utils/musicAudioSession.js'

const START_LEAD_SECONDS = 0.05

function clampGain(value) {
  return Math.max(0, Math.min(1, Number(value) || 0))
}

function createAudioContext() {
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AudioContextCtor) throw new Error('当前浏览器不支持 Web Audio API。')
  return new AudioContextCtor()
}

export function uniqueLineupIdolCodes(performerLineup = []) {
  return [...new Set(performerLineup.filter(Boolean))]
}

export function activeLineupIdolCodes(performerLineup = [], performerSlots = []) {
  return [...new Set(
    performerSlots
      .map(slot => performerLineup[Number(slot) - 1] || '')
      .filter(Boolean),
  )]
}

export function buildSingerGateSchedule(performerLineup = [], events = [], offsetSeconds = 0) {
  const offset = Math.max(0, Number(offsetSeconds) || 0)
  const ordered = [...events].sort((a, b) => Number(a.time) - Number(b.time))
  const prior = [...ordered].reverse().find(event => Number(event.time) / 1000 <= offset)
  const scheduled = [{
    timeSeconds: offset,
    idolCodes: activeLineupIdolCodes(
      performerLineup,
      prior?.performerSlots || prior?.singers || [],
    ),
  }]
  for (const event of ordered) {
    const timeSeconds = Number(event.time) / 1000
    if (!Number.isFinite(timeSeconds) || timeSeconds <= offset) continue
    scheduled.push({
      timeSeconds,
      idolCodes: activeLineupIdolCodes(
        performerLineup,
        event.performerSlots || event.singers || [],
      ),
    })
  }
  return scheduled
}

export function useSongPerformanceSession({ contextFactory = createAudioContext } = {}) {
  const ready = ref(false)
  const playing = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const error = ref('')
  const vocalGain = ref(1)
  const backingGain = ref(1)
  const playbackRate = ref(1)
  const lineup = ref([])
  const singerEvents = ref([])
  const loadedIdolCodes = ref([])
  const outputPeak = ref(0)

  let context = null
  let backingBuffer = null
  let vocalBuffers = new Map()
  let backingBus = null
  let vocalBus = null
  let activeSources = []
  let animationFrame = 0
  let loadSequence = 0
  let playbackGeneration = 0
  let loadAbortController = null
  let logicalOffset = 0
  let logicalEpoch = 0
  let continuousVocals = false
  let analyser = null, samples = null, lastMeterTime = 0
  const audioSessionOwner = {}

  const currentSingerEvent = computed(() => [...singerEvents.value]
    .reverse()
    .find(event => Number(event.time) <= currentTime.value * 1000) || null)
  const activePerformerSlots = computed(() => (
    currentSingerEvent.value?.performerSlots
    || currentSingerEvent.value?.singers
    || []
  ))
  const activeIdolCodes = computed(() => activeLineupIdolCodes(
    lineup.value,
    activePerformerSlots.value,
  ))

  function ensureContext() {
    if (context) return context
    context = contextFactory()
    backingBus = context.createGain()
    vocalBus = context.createGain()
    backingBus.gain.value = clampGain(backingGain.value)
    vocalBus.gain.value = clampGain(vocalGain.value)
    if (context.createAnalyser) {
      analyser = context.createAnalyser()
      analyser.fftSize = 512
      samples = new Float32Array(analyser.fftSize)
      analyser.connect(context.destination)
    }
    backingBus.connect(analyser || context.destination)
    vocalBus.connect(analyser || context.destination)
    context.onstatechange = () => {
      if (playing.value && context.state !== 'running') {
        pause()
        error.value = '播放已中断，请点击播放继续。'
      }
    }
    return context
  }

  function stopAnimation() {
    if (animationFrame) cancelAnimationFrame(animationFrame)
    animationFrame = 0
  }

  function logicalTime() {
    if (!playing.value || !context) return logicalOffset
    return Math.min(
      duration.value,
      logicalOffset + Math.max(0, context.currentTime - logicalEpoch) * playbackRate.value,
    )
  }

  function stopSources() {
    playbackGeneration += 1
    for (const { source, gate } of activeSources) {
      try { source.stop() } catch (_) {}
      try { source.disconnect() } catch (_) {}
      try { gate?.disconnect() } catch (_) {}
    }
    activeSources = []
  }

  function pause() {
    if (playing.value) logicalOffset = logicalTime()
    currentTime.value = logicalOffset
    playing.value = false
    outputPeak.value = 0
    stopAnimation()
    stopSources()
    releaseMusicAudioSession(audioSessionOwner)
  }

  function release({ resetTime = true } = {}) {
    loadSequence += 1
    loadAbortController?.abort()
    loadAbortController = null
    pause()
    backingBuffer = null
    vocalBuffers = new Map()
    loadedIdolCodes.value = []
    ready.value = false
    duration.value = 0
    if (resetTime) {
      logicalOffset = 0
      currentTime.value = 0
    }
  }

  async function fetchAndDecode(url, signal) {
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`${url} 返回 HTTP ${response.status}`)
    const bytes = await response.arrayBuffer()
    if (signal.aborted) throw new DOMException('已取消音频加载', 'AbortError')
    return ensureContext().decodeAudioData(bytes)
  }

  async function configure({ experiment, events, performerLineup, continuous = false }) {
    const resumeAt = logicalOffset
    release({ resetTime: false })
    lineup.value = [...performerLineup]
    singerEvents.value = [...(events || [])].sort((a, b) => Number(a.time) - Number(b.time))
    continuousVocals = Boolean(continuous)
    error.value = ''
    if (!experiment?.backing?.url) {
      error.value = '当前歌曲没有实验伴奏资源。'
      return
    }

    const sequence = ++loadSequence
    const abortController = new AbortController()
    loadAbortController = abortController
    const uniqueIdols = uniqueLineupIdolCodes(lineup.value)
    try {
      ensureContext()
      const vocalUrls = uniqueIdols.map(idolCode => {
        const url = experiment.solo_tracks?.[idolCode]?.vocal?.url
        if (!url) throw new Error(`${idolCode} 缺少当前歌曲声部`)
        return [idolCode, url]
      })
      const [decodedBacking, ...decodedVocals] = await Promise.all([
        fetchAndDecode(experiment.backing.url, abortController.signal),
        ...vocalUrls.map(([, url]) => fetchAndDecode(url, abortController.signal)),
      ])
      if (sequence !== loadSequence) return
      backingBuffer = decodedBacking
      vocalBuffers = new Map(vocalUrls.map(([idolCode], index) => [idolCode, decodedVocals[index]]))
      loadedIdolCodes.value = [...vocalBuffers.keys()]
      duration.value = Number(backingBuffer.duration) || 0
      logicalOffset = Math.min(resumeAt, duration.value)
      currentTime.value = logicalOffset
      ready.value = true
      loadAbortController = null
    } catch (loadError) {
      if (sequence !== loadSequence || loadError?.name === 'AbortError') return
      release({ resetTime: false })
      error.value = `音频预解码失败：${loadError.message || loadError}`
    }
  }

  function scheduleSingerGates(gates, startAt, offset) {
    if (continuousVocals) {
      for (const gate of gates.values()) gate.gain.setValueAtTime(1, startAt)
      return
    }
    const schedule = buildSingerGateSchedule(lineup.value, singerEvents.value, offset)
    for (const entry of schedule) {
      const active = new Set(entry.idolCodes)
      const normalizedGain = active.size ? 1 / Math.sqrt(active.size) : 0
      const audioTime = startAt + Math.max(0, entry.timeSeconds - offset) / playbackRate.value
      for (const [idolCode, gate] of gates) {
        gate.gain.setValueAtTime(active.has(idolCode) ? normalizedGain : 0, audioTime)
      }
    }
  }

  function createScheduledSources(offset) {
    const ctx = ensureContext()
    const startAt = ctx.currentTime + START_LEAD_SECONDS
    const generation = ++playbackGeneration
    const gates = new Map()
    const sources = []

    const backingSource = ctx.createBufferSource()
    backingSource.buffer = backingBuffer
    backingSource.playbackRate.value = playbackRate.value
    const backingGate = ctx.createGain()
    backingGate.gain.value = 1
    backingSource.connect(backingGate).connect(backingBus)
    sources.push({ source: backingSource, gate: backingGate })

    for (const [idolCode, buffer] of vocalBuffers) {
      if (offset >= buffer.duration) continue
      const source = ctx.createBufferSource()
      const gate = ctx.createGain()
      source.buffer = buffer
      source.playbackRate.value = playbackRate.value
      gate.gain.value = 0
      source.connect(gate).connect(vocalBus)
      gates.set(idolCode, gate)
      sources.push({ source, gate })
    }
    scheduleSingerGates(gates, startAt, offset)
    for (const { source } of sources) source.start(startAt, offset)
    backingSource.onended = () => {
      if (generation !== playbackGeneration || !playing.value) return
      logicalOffset = duration.value
      currentTime.value = duration.value
      playing.value = false
      stopAnimation()
      stopSources()
      releaseMusicAudioSession(audioSessionOwner)
    }
    activeSources = sources
    logicalEpoch = startAt
  }

  function update(now = 0) {
    if (!playing.value) return
    if (analyser && now - lastMeterTime > 100) {
      analyser.getFloatTimeDomainData(samples)
      outputPeak.value = samples.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0)
      lastMeterTime = now
    }
    currentTime.value = logicalTime()
    if (currentTime.value >= duration.value) {
      pause()
      return
    }
    animationFrame = requestAnimationFrame(update)
  }

  async function unlock() {
    try {
      claimMusicAudioSession(audioSessionOwner)
      const ctx = ensureContext()
      // WebKit also exposes interrupted; resuming only suspended misses it.
      if (ctx.state !== 'running') await ctx.resume()
      if (ctx.state !== 'running') throw new Error('音频播放未恢复，请再点一次播放')
      return true
    } catch (playError) {
      releaseMusicAudioSession(audioSessionOwner)
      error.value = `无法恢复播放：${playError.message || playError}`
      return false
    }
  }

  async function play() {
    error.value = ''
    if (!ready.value || !backingBuffer) {
      error.value = '实验叠轨音频尚未准备。'
      return false
    }
    if (logicalOffset >= duration.value) logicalOffset = 0
    const sequence = loadSequence
    try {
      if (!await unlock()) return false
      if (sequence !== loadSequence || !ready.value || !backingBuffer) {
        releaseMusicAudioSession(audioSessionOwner)
        return false
      }
      createScheduledSources(logicalOffset)
      playing.value = true
      currentTime.value = logicalOffset
      animationFrame = requestAnimationFrame(update)
      return true
    } catch (playError) {
      stopSources()
      releaseMusicAudioSession(audioSessionOwner)
      error.value = `浏览器拒绝播放：${playError.message || playError}`
      playing.value = false
      return false
    }
  }

  function seek(seconds) {
    const wasPlaying = playing.value
    pause()
    logicalOffset = Math.max(0, Math.min(Number(seconds) || 0, duration.value))
    currentTime.value = logicalOffset
    if (wasPlaying && logicalOffset < duration.value) void play()
  }

  function reset() {
    pause()
    logicalOffset = 0
    currentTime.value = 0
  }

  function setPlaybackRate(value) {
    const nextRate = Math.max(0.25, Math.min(4, Number(value) || 1))
    if (nextRate === playbackRate.value) return
    const wasPlaying = playing.value
    pause()
    playbackRate.value = nextRate
    if (wasPlaying && logicalOffset < duration.value) void play()
  }

  function syncBusVolumes() {
    if (!context) return
    backingBus.gain.setValueAtTime(clampGain(backingGain.value), context.currentTime)
    vocalBus.gain.setValueAtTime(clampGain(vocalGain.value), context.currentTime)
  }

  watch([vocalGain, backingGain], syncBusVolumes)
  onBeforeUnmount(() => {
    release()
    try { backingBus?.disconnect() } catch (_) {}
    try { vocalBus?.disconnect() } catch (_) {}
    try { analyser?.disconnect() } catch (_) {}
    if (context?.state !== 'closed') void context?.close()
    context = null
  })

  return {
    activeIdolCodes,
    activePerformerSlots,
    backingGain,
    configure,
    currentTime,
    duration,
    error,
    lineup,
    loadedIdolCodes,
    outputPeak,
    pause,
    play,
    unlock,
    playbackRate,
    playing,
    ready,
    release,
    reset,
    seek,
    setPlaybackRate,
    vocalGain,
  }
}
