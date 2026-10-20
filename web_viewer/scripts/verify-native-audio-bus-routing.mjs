// Phone / TV / reverb voices follow the client's CRI bus sends (docs/NATIVE_AUDIO_BUS_ROUTING.md).
// Everything here goes through the runtime modules; the table itself is only read
// to pick witnesses. --mounted adds corpus coverage, --rebuild regenerates the
// table from RAW ACBs + the IPA ACF and requires it to be byte-identical.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_SE_CUE_SHEET, NATIVE_AUDIO_ROUTING, describeNativeBus, nativeCueRoute, nativeSeRoute, nativeVoiceRoute,
} from '../src/core/story-runtime/nativeAudioBuses.js'
import { StoryAudioSession } from '../src/core/story-runtime/StoryAudioSession.js'
import { VoiceMediaOutput } from '../src/core/VoiceMediaOutput.js'
import { createSeCueHandle } from '../src/core/story-runtime/SeCueRuntime.js'
import { AudioManager } from '../src/core/AudioManager.js'
import { useVoicePlayer } from '../src/core/useVoicePlayer.js'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const ipaArg = process.argv.find(arg => arg.startsWith('--ipa='))?.slice(6)
const voiceDirArg = process.argv.find(arg => arg.startsWith('--voice-dir='))?.slice(12)

class Param { constructor(value = 0) { this.value = value } setValueAtTime(v) { this.value = v } linearRampToValueAtTime(v) { this.value = v } }
class Node {
  constructor(kind) { this.kind = kind; this.outputs = new Set() }
  connect(node) { this.outputs.add(node); return node }
  disconnect(node) { if (node) this.outputs.delete(node); else this.outputs.clear() }
}
class Context {
  constructor() { this.sampleRate = 48000; this.currentTime = 0; this.state = 'running'; this.destination = new Node('destination') }
  createGain() { const node = new Node('gain'); node.gain = new Param(1); return node }
  createBiquadFilter() {
    const node = new Node('biquad'); node.type = 'lowpass'
    node.frequency = new Param(350); node.Q = new Param(1); node.gain = new Param(0); return node
  }
  createConvolver() { const node = new Node('convolver'); node.buffer = null; return node }
  createBuffer(channels, length, rate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: c => data[c] }
  }
  createBufferSource() { const node = new Node('source'); node.playbackRate = new Param(1); node.start = () => {}; return node }
  createMediaElementSource() { return new Node('media') }
  addEventListener() {}
  async resume() {}
  async close() {}
}

/** Every path from `node` to the named channel bus, as the node kinds passed through. */
function paths(node, target, trail = []) {
  if (node === target) return [trail]
  return [...node.outputs].flatMap(next => paths(next, target, [...trail, next]))
}

function sessionWith() {
  const context = new Context()
  const session = new StoryAudioSession({ contextFactory: () => context })
  session.ensureContext()
  return { context, session }
}

const firstVoice = profileOf => {
  const index = NATIVE_AUDIO_ROUTING.profiles.findIndex(profileOf)
  assert.ok(index >= 0, 'witness profile must exist in the generated table')
  return NATIVE_AUDIO_ROUTING.voice[String(index)][0]
}
const phoneOnly = profile => profile.bus_phone === 1 && profile.MasterOut == null
const reverbSend = profile => profile.bus_reverb > 0 && profile.MasterOut > 0
let cases = 0

// 1. Resolver: the cue sheet, not the cue name, decides the route.
const phoneVoice = firstVoice(phoneOnly)
assert.deepEqual(nativeVoiceRoute(`/assets/voice/${phoneVoice}.m4a?v=1`), { bus_phone: 1 })
assert.equal(nativeVoiceRoute('/assets/voice/1_1_001_01_a1000.m4a'), null, 'an ordinary line stays on the default MasterOut send')
assert.deepEqual(nativeSeRoute('door_ent', 'se_telephone'), { MasterOut: 0, bus_phone: 1 })
assert.equal(nativeSeRoute('door_ent'), null, `door_ent in ${DEFAULT_SE_CUE_SHEET} plays dry`)
assert.equal(nativeSeRoute('door_ent', DEFAULT_SE_CUE_SHEET), null)
assert.deepEqual(nativeCueRoute('ambi_tvshow_setting_t'), { MasterOut: 0, bus_phone: 1 }, 'a one-cue ambience sheet answers for its cue')
assert.deepEqual(nativeCueRoute('ambi_tvshow_setting_t', 'ambi_tvshow_setting'), { MasterOut: 0, bus_phone: 1 })
assert.equal(nativeCueRoute('ambi_tvshow_setting'), null, 'the dry ambience sheet is a different sheet')
assert.deepEqual(nativeCueRoute('adv_ldyrdm_tv_inst'), { MasterOut: 0, bus_phone: 1 }, 'TV instrumental BGM goes through the phone bus')
cases += 9

// 2. Bus DSP comes from the ACF parameters.
const phone = describeNativeBus('bus_phone')
assert.equal(phone.volume, 0.8)
assert.deepEqual(phone.stages.slice(0, 2).map(stage => [stage.type, Math.round(stage.frequency)]), [['highpass', 300], ['lowpass', 6000]])
assert.equal(phone.stages.filter(stage => stage.type === 'peaking').length, 8, '32BandsEQ authors eight peaking bands')
assert.ok(phone.stages.some(stage => stage.type === 'peaking' && Math.round(stage.gain) === -24), 'the outer bands cut by 24 dB')
const reverb = describeNativeBus('bus_reverb')
assert.equal(reverb.volume, 0.5)
assert.deepEqual(reverb.stages.map(stage => stage.type), ['reverb'])
assert.equal(reverb.stages[0].seconds, 2)
cases += 7

// 3. Graph: a phone line never reaches its channel bus dry; reverb keeps both paths.
{
  const { context, session } = sessionWith()
  const voiceBus = session.getBus('voice')
  const source = context.createBufferSource()
  const unroute = session.routeSource(source, { bus: 'voice', route: nativeVoiceRoute(`${phoneVoice}.m4a`) })
  const routes = paths(source, voiceBus)
  assert.equal(routes.length, 1, 'a bus_phone-only cue has exactly one path')
  assert.ok(routes[0].some(node => node.kind === 'biquad' && node.type === 'highpass'), 'the path runs through the phone bandpass')
  assert.equal(routes[0].filter(node => node.kind === 'biquad' && node.type === 'peaking').length, 8)
  unroute()
  assert.equal(paths(source, voiceBus).length, 0, 'unroute leaves nothing connected')

  const reverbCue = firstVoice(reverbSend)
  const wet = context.createBufferSource()
  session.routeSource(wet, { bus: 'voice', route: nativeVoiceRoute(`${reverbCue}.m4a`) })
  const kinds = paths(wet, voiceBus).map(path => path.some(node => node.kind === 'convolver'))
  assert.deepEqual(kinds.sort(), [false, true], 'dry MasterOut send plus a reverb send')

  const dry = context.createBufferSource()
  session.routeSource(dry, { bus: 'voice', route: null })
  assert.deepEqual(paths(dry, voiceBus), [[voiceBus]], 'default route connects straight to the channel bus')
  assert.deepEqual(session.inspect().native_buses, ['voice:bus_phone', 'voice:bus_reverb'], 'one chain per channel and bus')
  cases += 7
}

// 4. The reused media element re-routes per line through start().
{
  const { context, session } = sessionWith()
  const element = {
    handlers: new Map(), playbackRate: 1, currentTime: 0,
    addEventListener(event, handler) { this.handlers.set(event, handler) },
    removeEventListener(event) { this.handlers.delete(event) },
    play() { queueMicrotask(() => this.handlers.get('playing')?.()); return Promise.resolve() },
    pause() {}, removeAttribute() {}, load() {},
  }
  const output = new VoiceMediaOutput(session, { createAudio: () => element })
  const voiceBus = session.getBus('voice')
  assert.equal(await output.start(`/assets/voice/${phoneVoice}.m4a`, { route: nativeVoiceRoute(phoneVoice) }), true)
  assert.ok(paths(output.node, voiceBus).length && paths(output.node, voiceBus).every(path => path.length > 1),
    'a phone line on the media backend has no dry path')
  assert.equal(await output.start('/assets/voice/1_1_001_01_a1000.m4a', { route: null }), true)
  assert.deepEqual(paths(output.node, voiceBus), [[voiceBus]], 'the next ordinary line drops the phone route')
  output.dispose()
  assert.equal(context.state, 'running')
  cases += 2
}

// 4b. The Web Audio voice backend routes by the file it resolved.
{
  const { context, session } = sessionWith()
  const sources = []
  const make = context.createBufferSource.bind(context)
  context.createBufferSource = () => { const node = make(); node.stop = () => {}; sources.push(node); return node }
  const player = useVoicePlayer({ spineStageRef: { value: null }, currentStep: { value: {} }, currentStepIndex: { value: 0 },
    compiledData: { value: {} }, isPlaying: { value: false }, audioSession: session })
  const voiceBus = session.getBus('voice')
  await player.playPreparedVoice({ voice: phoneVoice, url: `/assets/voice/${phoneVoice}.m4a`, audioBuffer: {}, step: { chara_id: null } })
  assert.ok(paths(sources.at(-1), voiceBus).every(path => path.length > 1) && paths(sources.at(-1), voiceBus).length,
    'a phone line decoded for Web Audio has no dry path')
  await player.playPreparedVoice({ voice: 'x', url: '/assets/voice/1_1_001_01_a1000.m4a', audioBuffer: {}, step: { chara_id: null } })
  assert.deepEqual(paths(sources.at(-1), voiceBus), [[voiceBus]])
  player.dispose()
  cases += 2
}

// 5. Runtime SE cues hand their sheet to the audio manager.
{
  const calls = []
  const handle = createSeCueHandle({ cue_id: 'x', channel: 'se', action: 'se.play', lifecycle: {},
    payload: { cue: 'door_ent', volume: null, sheet: 'se_telephone' } }, { playSE: (...call) => calls.push(call) })
  await handle.start()
  assert.deepEqual(calls, [['door_ent', { sheet: 'se_telephone' }]])
  cases += 1
}

// 5b. AudioManager routes SE by sheet, ambience and BGM by their sheet.
{
  const { context, session } = sessionWith()
  context.decodeAudioData = async () => ({})
  const sources = []
  const make = context.createBufferSource.bind(context)
  context.createBufferSource = () => { const node = make(); node.stop = () => {}; sources.push(node); return node }
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  const manager = new AudioManager({ audioSession: session, setTimer: () => 0, clearTimer: () => {} })
  const filtered = (source, bus) => {
    const routes = paths(source, session.getBus(bus))
    return routes.length > 0 && routes.every(path => path.some(node => node.kind === 'biquad' && node.type === 'highpass'))
  }
  await manager.playSE('door_ent', { sheet: 'se_telephone' })
  await manager.playSE('door_ent')
  assert.deepEqual(sources.map(source => filtered(source, 'se')), [true, false], 'se_telephone is filtered, se_commu is dry')
  await manager.playAmbient('ambi_tvshow_setting_t', 0, null, { cue: 'ambi_tvshow_setting' })
  assert.equal(filtered(sources.at(-1), 'ambient'), true, 'TV ambience goes through the phone bus')
  await manager.playBgm('adv_ldyrdm_tv_inst', 0)
  assert.equal(filtered(sources.at(-1), 'bgm'), true, 'TV instrumental goes through the phone bus')
  cases += 3
}

// 6. Corpus: routed voice cues are the published m4a stems; RAW SE sheets reach the cues.
if (args.has('--mounted')) {
  const voiceDir = voiceDirArg || join(WEB, 'public', 'assets', 'voice')
  assert.ok(existsSync(voiceDir), '--mounted needs public/assets/voice (or --voice-dir=)')
  const files = new Set(readdirSync(voiceDir).filter(name => name.endsWith('.m4a')).map(name => name.slice(0, -4)))
  const routed = Object.values(NATIVE_AUDIO_ROUTING.voice).flat()
  const present = routed.filter(cue => files.has(cue))
  assert.ok(present.length > routed.length * 0.9, `routed voice cues must be published files (${present.length}/${routed.length})`)
  assert.ok(present.every(cue => nativeVoiceRoute(`/assets/voice/${cue}.m4a`)), 'every published routed file resolves')
  console.log(`  mounted: ${present.length}/${routed.length} routed voice cues are published m4a files`)
  cases += 2
}

if (args.has('--rebuild')) {
  assert.ok(ipaArg, '--rebuild needs --ipa=<path to the 2.6.10 IPA>')
  const out = join(mkdtempSync(join(tmpdir(), 'native-bus-')), 'routing.json')
  execFileSync('python', [join(WEB, 'scripts', 'build-native-audio-bus-routing.py'), '--ipa', ipaArg, '--output', out], { stdio: 'inherit' })
  assert.equal(readFileSync(out, 'utf8'), readFileSync(join(WEB, 'src', 'data', 'nativeAudioBusRouting.json'), 'utf8'),
    'committed routing must equal a fresh RAW/ACF build')
  cases += 1
}

console.log(`Native audio bus routing verification passed: ${cases} cases (phone/TV/reverb sends, ACF DSP, graph, media re-route, SE sheet).`)
