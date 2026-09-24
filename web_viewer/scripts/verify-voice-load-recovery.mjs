/** Exercises the real supplied useVoicePlayer source with injected network/decoder fixtures.
 * This does NOT test AAC compatibility or a real browser's AudioContext.
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { waitForSignal, createLoadTimeout, attachOptionalResource } from '../src/core/AsyncLoadBoundary.js'
const args = process.argv.slice(2)
const get = key => args[args.indexOf(key) + 1]
if (!args.includes('--source') || !args.includes('--expect') || !['original', 'candidate'].includes(get('--expect'))) {
  throw Error('Usage: node tools/repro_voice.mjs --source path/to/useVoicePlayer.js --expect original|candidate')
}
const mode = get('--expect')
const raw = (await fs.readFile(get('--source'), 'utf8')).replaceAll('\r\n', '\n')
const blob = createHash('sha1').update(`blob ${Buffer.byteLength(raw)}\0`).update(raw).digest('hex')
if (mode === 'original') assert.equal(blob, '6f15ac41b6fa80ac2eacc6a5a3b29c4b6e39ee6e', 'The reproduction must use the audited source bytes')
const code = raw.replace(/^import .*\n/gm, '').replace('export function useVoicePlayer', 'function useVoicePlayer')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const silent = { info() {}, warn() {}, error() {}, debug() {} }
function fixture({ network, decode, lipFetch, start } = {}) {
  const stats = { fetched: 0, decoded: 0, started: 0, talking: [], time: 0 }
  const step = { value: { chara_id: '047shu', dialogue: { voice: 'one.m4a', lip: { path: 'one.json' } } } }
  const index = { value: 0 }, playing = { value: false }
  const buffer = { duration: 2, length: 88200, numberOfChannels: 1 }
  const ctx = { state: 'running',
    async decodeAudioData(data) { stats.decoded++; return decode ? decode(data) : buffer },
    createBufferSource() { return { connect() {}, disconnect() {}, start() { if (start) start(); stats.started++ }, stop() {} } },
  }
  const session = { disabled: false, ensureContext: () => ctx, unlockFromUserGesture: () => ctx, getBus: () => ({}), currentTime: () => stats.time, registerSource: () => () => {}, resume: async () => {}, dispose: async () => {} }
  const cache = { async get(url, options) { stats.fetched++; return network ? network(url, options) : new ArrayBuffer(2048) } }
  const fetch = lipFetch || (async () => new Response(JSON.stringify({ scales: [0.5] }), { headers: { 'content-type': 'application/json' } }))
  const factory = new Function('getLipSyncUrl','getVoiceUrlCandidates','deriveMainLipPathFromVoice','sampleLipCurve','isKnownDanglingStoryVoice','StoryAudioSession','compressedVoiceCache','window','fetch','console','waitForSignal','createLoadTimeout','attachOptionalResource', `${code};return useVoicePlayer`)
  const use = factory(x => `/assets/lipsync/${x}`, v => [`/assets/voice/${v}`], () => null, curve => curve.scales[0], () => false, class {}, cache, { setTimeout, clearTimeout }, fetch, silent, waitForSignal, createLoadTimeout, attachOptionalResource)
  const player = use({ spineStageRef: { value: { manager: { setSpineTalking(...x) { stats.talking.push(x) } } } }, currentStep: step, currentStepIndex: index, compiledData: { value: { scenario_id: 'fixture' } }, isPlaying: playing, audioSession: session, voiceTimeoutMs: 25, lipTimeoutMs: 25 })
  return { player, stats, step, index, buffer, playing }
}
const results = []
{
  const f = fixture({ lipFetch: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) })
  const ok = await f.player.playVoice()
  assert.equal(f.stats.decoded, 1)
  assert.equal(ok, mode === 'candidate')
  assert.equal(f.stats.started, mode === 'candidate' ? 1 : 0)
  results.push({ test: 'decoded voice + stalled optional lip', observed: ok ? 'voice started independently' : 'voice incorrectly unavailable', expected_behavior_for_mode: 'PASS' })
  f.player.dispose()
}
{
  let fail = true
  const f = fixture({ network: async () => { if (fail) throw Error('temporary-network'); return new ArrayBuffer(2048) } })
  assert.equal(await f.player.playVoice(), false)
  fail = false
  const retried = await f.player.playVoice()
  assert.equal(retried, mode === 'candidate')
  assert.equal(f.stats.fetched, mode === 'candidate' ? 2 : 1)
  results.push({ test: 'same-step retry after network failure', observed: retried ? 'second attempt started' : 'dedup prevents second fetch', expected_behavior_for_mode: 'PASS' })
  f.player.dispose()
}
{
  let release
  const f = fixture({ decode: () => new Promise(r => { release = r }) })
  const pending = f.player.playVoice()
  const result = await Promise.race([pending.then(value => ({ value })), sleep(60).then(() => ({ hanging: true }))])
  assert.equal(Boolean(result.hanging), mode === 'original')
  release(f.buffer); await pending
  assert.equal(f.stats.started, 0)
  results.push({ test: 'decoder that ignores AbortSignal', observed: result.hanging ? 'caller still pending beyond its deadline' : 'caller terminates at deadline', expected_behavior_for_mode: 'PASS' })
  f.player.dispose()
}
if (mode === 'candidate') {
  let releaseFirst
  const f = fixture({ lipFetch: url => url.includes('one.json') ? new Promise(r => { releaseFirst = r }) : Promise.resolve(new Response('{"scales":[0.5]}', { headers: { 'content-type': 'application/json' } })) })
  assert.equal(await f.player.playVoice(), true)
  await sleep(0)
  f.step.value = { chara_id: '047shu', dialogue: { voice: 'two.m4a', lip: { path: 'two.json' } } }; f.index.value++
  assert.equal(await f.player.playVoice(), true)
  await sleep(0)
  releaseFirst(new Response('{"scales":[0.9]}', { headers: { 'content-type': 'application/json' } }))
  await sleep(0)
  assert.equal(f.player.getVoiceVolume(), 0.5, 'late prior-step lip must not overwrite current curve')
  assert.equal(f.stats.started, 2)
  results.push({ test: 'late old curve after step switch', observed: 'discarded; new curve unchanged; no extra start', expected_behavior_for_mode: 'PASS' })
  f.player.dispose()
}
if (mode === 'candidate') {
  let fail = true
  const f = fixture({ start: () => { if (fail) throw new Error('source start failure') } })
  assert.equal(await f.player.playVoice(), false)
  assert.equal(f.playing.value, false)
  assert.equal(f.player.getDiagnostics().lastFailure.phase, 'source-start')
  fail = false
  assert.equal(await f.player.retryVoice(), true)
  f.player.dispose()
  results.push({ test: 'source start failure releases state and permits retry', observed: 'recovered' })
}
console.log(JSON.stringify({ mode, source_blob: blob, evidence_type: 'actual-source with injected IO and fake decoded buffer', results }, null, 2))
