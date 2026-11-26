import { buildSingerGateSchedule } from '../composables/useSongPerformanceSession.js'

const PEAK_CEILING = 0.98
const AAC_BITRATE = 192000
const ENCODE_CHUNK_FRAMES = 4096

function sanitizeFilePart(value, fallback = 'mix') {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  return cleaned || fallback
}

export function buildMixdownFilename({ songTitle = '', mode = 'lineup', singerNames = [], format = 'wav' } = {}) {
  const title = sanitizeFilePart(songTitle, 'GS_Song')
  const ext = format === 'aac' ? 'aac' : 'wav'
  const cleanSingers = [...new Set((singerNames || []).map(name => sanitizeFilePart(name, '')).filter(Boolean))]
  const role = mode === 'solo' ? 'Solo' : '自由编成'
  const cast = cleanSingers.slice(0, 5).join('·')
  const suffix = cast ? `${role}(${cast})` : role
  return `${title} - ${suffix}.${ext}`
}

export function computePeakScale(audioBuffer, ceiling = PEAK_CEILING) {
  let peak = 0
  const channels = audioBuffer.numberOfChannels || 1
  for (let ch = 0; ch < channels; ch += 1) {
    const data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < data.length; i += 1) {
      const abs = Math.abs(data[i])
      if (abs > peak) peak = abs
    }
  }
  return peak > ceiling ? ceiling / peak : 1
}

export async function renderSongMixdownBuffer(snapshot, { offlineContextFactory } = {}) {
  if (!snapshot?.backingBuffer) throw new Error('当前音轨尚未就绪，无法导出混音。')
  const { backingBuffer, vocalBuffers, lineup = [], singerEvents = [], continuous = false, backingGain = 1, vocalGain = 1 } = snapshot
  const channels = Math.max(1, Number(backingBuffer.numberOfChannels) || 2)
  const sampleRate = Math.max(8000, Number(backingBuffer.sampleRate) || 44100)
  const frameCount = Math.max(1, Number(backingBuffer.length) || Math.ceil((backingBuffer.duration || 0) * sampleRate))

  const createOffline = offlineContextFactory || ((ch, len, sr) => {
    const Ctor = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext
    if (!Ctor) throw new Error('当前浏览器不支持离线音频渲染（OfflineAudioContext）。')
    return new Ctor(ch, len, sr)
  })

  const offline = createOffline(channels, frameCount, sampleRate)
  const backingBus = offline.createGain()
  const vocalBus = offline.createGain()
  backingBus.gain.setValueAtTime(Math.max(0, Math.min(1, Number(backingGain) || 0)), 0)
  vocalBus.gain.setValueAtTime(Math.max(0, Math.min(1, Number(vocalGain) || 0)), 0)
  backingBus.connect(offline.destination)
  vocalBus.connect(offline.destination)

  const backingSource = offline.createBufferSource()
  backingSource.buffer = backingBuffer
  backingSource.connect(backingBus)
  backingSource.start(0)

  const gates = new Map()
  const entries = vocalBuffers instanceof Map ? [...vocalBuffers.entries()] : Object.entries(vocalBuffers || {})
  for (const [idolCode, buffer] of entries) {
    if (!buffer) continue
    const source = offline.createBufferSource()
    const gate = offline.createGain()
    source.buffer = buffer
    gate.gain.setValueAtTime(continuous ? 1 : 0, 0)
    source.connect(gate).connect(vocalBus)
    source.start(0)
    gates.set(idolCode, gate)
  }

  if (!continuous && gates.size > 0) {
    const schedule = buildSingerGateSchedule(lineup, singerEvents, 0)
    for (const entry of schedule) {
      const active = new Set(entry.idolCodes)
      const gain = active.size ? 1 / Math.sqrt(active.size) : 0
      const time = Math.max(0, Number(entry.timeSeconds) || 0)
      for (const [idolCode, gate] of gates) {
        gate.gain.setValueAtTime(active.has(idolCode) ? gain : 0, time)
      }
    }
  }

  return await offline.startRendering()
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
}

// Pure 16-bit little-endian PCM RIFF/WAVE encoder with transparent peak anti-clipping guard.
export function encodeAudioBufferToWav(audioBuffer) {
  const numChannels = Math.max(1, Number(audioBuffer.numberOfChannels) || 2)
  const sampleRate = Math.max(8000, Math.round(Number(audioBuffer.sampleRate) || 44100))
  const length = Number(audioBuffer.length) || 0
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const scale = computePeakScale(audioBuffer)
  const channelData = Array.from({ length: numChannels }, (_, ch) => audioBuffer.getChannelData(ch))
  let offset = 44
  for (let i = 0; i < length; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i] * scale))
      view.setInt16(offset, sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff), true)
      offset += 2
    }
  }
  return buffer
}

export async function supportsAacAdtsExport({ sampleRate = 44100, numberOfChannels = 2 } = {}) {
  if (typeof globalThis.AudioEncoder !== 'function' || typeof globalThis.AudioData !== 'function') return false
  try {
    const support = await globalThis.AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels,
      bitrate: AAC_BITRATE,
      aac: { format: 'adts' },
    })
    return Boolean(support?.supported)
  } catch {
    return false
  }
}

export async function encodeAudioBufferToAacAdts(audioBuffer) {
  const sampleRate = Math.round(Number(audioBuffer.sampleRate) || 44100)
  const numberOfChannels = Math.max(1, Number(audioBuffer.numberOfChannels) || 2)
  const supported = await supportsAacAdtsExport({ sampleRate, numberOfChannels })
  if (!supported) throw new Error('当前浏览器不支持 AAC ADTS 编码')

  const chunks = []
  let encodeError = null
  const encoder = new globalThis.AudioEncoder({
    output(chunk) {
      const bytes = new Uint8Array(chunk.byteLength)
      chunk.copyTo(bytes)
      chunks.push(bytes)
    },
    error(err) {
      encodeError = err
    },
  })
  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels,
    bitrate: AAC_BITRATE,
    aac: { format: 'adts' },
  })

  const scale = computePeakScale(audioBuffer)
  const totalFrames = audioBuffer.length
  const channels = Array.from({ length: numberOfChannels }, (_, ch) => audioBuffer.getChannelData(ch))

  for (let start = 0; start < totalFrames; start += ENCODE_CHUNK_FRAMES) {
    if (encodeError) throw encodeError
    const frameCount = Math.min(ENCODE_CHUNK_FRAMES, totalFrames - start)
    const planar = new Float32Array(frameCount * numberOfChannels)
    for (let ch = 0; ch < numberOfChannels; ch += 1) {
      const src = channels[ch]
      const base = ch * frameCount
      for (let i = 0; i < frameCount; i += 1) {
        planar[base + i] = Math.max(-1, Math.min(1, src[start + i] * scale))
      }
    }
    const audioData = new globalThis.AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: frameCount,
      numberOfChannels,
      timestamp: Math.round((start / sampleRate) * 1e6),
      data: planar,
    })
    encoder.encode(audioData)
    audioData.close()
  }

  await encoder.flush()
  encoder.close()
  if (encodeError) throw encodeError
  if (!chunks.length) throw new Error('AAC 编码输出为空')
  return new Blob(chunks, { type: 'audio/aac' })
}

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function exportSongMixdown({
  snapshot,
  songTitle = '',
  mode = 'lineup',
  singerNames = [],
  preferredFormat = 'auto',
  onStage = () => {},
} = {}) {
  onStage('rendering')
  const rendered = await renderSongMixdownBuffer(snapshot)

  let format = preferredFormat === 'wav' ? 'wav' : 'aac'
  let blob = null
  if (format === 'aac') {
    onStage('encoding-aac')
    try {
      blob = await encodeAudioBufferToAacAdts(rendered)
    } catch {
      // Transparently fall back to universal 16-bit PCM WAV when WebCodecs AAC-ADTS is unavailable.
      format = 'wav'
    }
  }
  if (!blob) {
    onStage('encoding-wav')
    blob = new Blob([encodeAudioBufferToWav(rendered)], { type: 'audio/wav' })
  }

  const filename = buildMixdownFilename({ songTitle, mode, singerNames, format })
  triggerBrowserDownload(blob, filename)
  onStage('done')
  return { filename, format, bytes: blob.size, duration: rendered.duration }
}
