import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildMixdownFilename,
  computePeakScale,
  encodeAudioBufferToWav,
  renderSongMixdownBuffer,
} from '../src/utils/songMixdownExport.js'

// 1. Filename builder: strips forbidden filesystem characters, dedupes singers, supports solo & lineup.
assert.equal(
  buildMixdownFilename({
    songTitle: 'Growing Smiles! / Live:2026',
    mode: 'lineup',
    singerNames: ['天濑冬马', '樱庭薰', '天濑冬马', '冬美旬'],
    format: 'aac',
  }),
  'Growing Smiles! Live 2026 - 自由编成(天濑冬马·樱庭薰·冬美旬).aac',
)
assert.equal(
  buildMixdownFilename({
    songTitle: 'BRAND NEW FIELD',
    mode: 'solo',
    singerNames: ['天濑冬马'],
    format: 'wav',
  }),
  'BRAND NEW FIELD - Solo(天濑冬马).wav',
)

// 2. Peak anti-clipping scale and 16-bit PCM WAV header/sample encoding.
function makeBuffer(channels, sampleRate = 44100) {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0].length,
    duration: channels[0].length / sampleRate,
    getChannelData: index => channels[index],
  }
}

const hotBuffer = makeBuffer([new Float32Array([0, 1.96, -1.96, 0.5]), new Float32Array([0, -1.96, 1.96, -0.5])], 44100)
assert.ok(Math.abs(computePeakScale(hotBuffer) - 0.5) < 1e-6, 'hot peaks normalize cleanly to 0.98 ceiling')

const wav = encodeAudioBufferToWav(hotBuffer)
const view = new DataView(wav)
const ascii = (offset, len) => String.fromCharCode(...new Uint8Array(wav, offset, len))
assert.equal(ascii(0, 4), 'RIFF')
assert.equal(ascii(8, 4), 'WAVE')
assert.equal(ascii(12, 4), 'fmt ')
assert.equal(ascii(36, 4), 'data')
assert.equal(view.getUint16(20, true), 1, 'PCM format')
assert.equal(view.getUint16(22, true), 2, 'stereo channels')
assert.equal(view.getUint32(24, true), 44100, 'sample rate')
assert.equal(view.getUint16(34, true), 16, '16-bit PCM')
assert.equal(view.getUint32(40, true), 4 * 2 * 2, 'exact payload byte size')
// Normalized peak 0.98 * 0x7fff ≈ 32112
assert.ok(Math.abs(view.getInt16(44 + 4, true) - Math.round(0.98 * 0x7fff)) <= 1, 'left channel normalized without clipping')
assert.ok(Math.abs(view.getInt16(44 + 6, true) + Math.round(0.98 * 0x8000)) <= 2, 'right channel normalized without clipping')

// 3. Offline mixdown graph schedules exact backingGain, vocalGain, and 1/sqrt(active) singer gates.
const recordedGains = []
let startedSources = 0
const mockFactory = (channels, length, sampleRate) => {
  const destination = { id: 'dest' }
  return {
    destination,
    createGain() {
      const events = []
      const node = {
        events,
        gain: { setValueAtTime: (value, time) => events.push([value, time]) },
        connect: target => target,
      }
      recordedGains.push(node)
      return node
    },
    createBufferSource() {
      return {
        buffer: null,
        connect: target => target,
        start: () => { startedSources += 1 },
      }
    },
    async startRendering() {
      return makeBuffer([new Float32Array(length), new Float32Array(length)], sampleRate)
    },
  }
}

const rendered = await renderSongMixdownBuffer({
  backingBuffer: makeBuffer([new Float32Array(100), new Float32Array(100)], 44100),
  vocalBuffers: new Map([
    ['001tom', makeBuffer([new Float32Array(100), new Float32Array(100)], 44100)],
    ['002sht', makeBuffer([new Float32Array(100), new Float32Array(100)], 44100)],
  ]),
  lineup: ['001tom', '002sht', '', '', ''],
  singerEvents: [
    { time: 0, performerSlots: [1] },
    { time: 1500, performerSlots: [1, 2] },
  ],
  continuous: false,
  backingGain: 0.8,
  vocalGain: 0.9,
}, { offlineContextFactory: mockFactory })

assert.equal(rendered.length, 100)
assert.equal(startedSources, 3, 'backing + 2 vocal sources started')
assert.deepEqual(recordedGains[0].events, [[0.8, 0]], 'backing bus gain scheduled')
assert.deepEqual(recordedGains[1].events, [[0.9, 0]], 'vocal bus gain scheduled')
// Vocal 1 (001tom): active solo at t=0 (gain 1), duet at t=1.5 (gain 1/sqrt(2))
assert.equal(recordedGains[2].events[1][0], 1)
assert.ok(Math.abs(recordedGains[2].events[2][0] - (1 / Math.SQRT2)) < 1e-6)
// Vocal 2 (002sht): silent at t=0 (gain 0), duet at t=1.5 (gain 1/sqrt(2))
assert.equal(recordedGains[3].events[1][0], 0)
assert.ok(Math.abs(recordedGains[3].events[2][0] - (1 / Math.SQRT2)) < 1e-6)

// 4. Console lazy-loads songMixdownExport so startup JS bundle pays zero bytes.
const consoleSource = readFileSync(new URL('../src/components/archive/ArchiveSongAuditionConsole.vue', import.meta.url), 'utf8')
assert.doesNotMatch(consoleSource, /^import .*songMixdownExport/m, 'mixdown exporter is not statically imported')
assert.match(consoleSource, /await import\('\.\.\/\.\.\/utils\/songMixdownExport\.js'\)/, 'mixdown exporter loads lazily on click')

console.log('Song mixdown export: filename sanitization, WAV PCM encoding + anti-clipping, OfflineAudioContext 1/sqrt(n) gate scheduling, and lazy loading passed')
