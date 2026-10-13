// Story voice preload: lookahead fetches the next lines, the step gate waits a bounded time,
// and a lip curve that outlives a slow voice is still attached when the voice plays.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createVoiceLookahead, upcomingVoiceSteps } from '../src/core/story-runtime/VoiceLookahead.js'
import { createVoiceLipStore } from '../src/core/VoiceLipStore.js'
import { createCompressedVoiceCache } from '../src/core/CompressedVoiceCache.js'
import { StoryAudioSession } from '../src/core/story-runtime/StoryAudioSession.js'
import { useVoicePlayer } from '../src/core/useVoicePlayer.js'
import { useStepSceneEffects } from '../src/core/useStepSceneEffects.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
async function until(test, label, limit = 400) {
  for (let i = 0; i < limit; i++) { if (test()) return; await tick() }
  assert.fail(`timed out waiting for ${label}`)
}
function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
const voiced = (id, voice = `v_${id}`) => ({ step_id: id, chara_id: 'a', dialogue: { voice } })
const silent = id => ({ step_id: id, type: 'bg' })

// Selection: voiced steps after the current one; short scripts are taken whole.
{
  const long = [voiced(0), silent(1), voiced(2), voiced(3), silent(4), voiced(5), voiced(6), voiced(7), voiced(8), voiced(9), voiced(10), voiced(11)]
  assert.deepEqual(upcomingVoiceSteps(long, 0).map(step => step.step_id), [2, 3, 5])
  assert.deepEqual(upcomingVoiceSteps(long, 9).map(step => step.step_id), [10, 11])
  assert.deepEqual(upcomingVoiceSteps(long, 0, { limit: 2 }).map(step => step.step_id), [2, 3])
  const short = [silent(0), voiced(1), voiced(2), voiced(3), silent(4), voiced(5)]
  assert.deepEqual(upcomingVoiceSteps(short, -1).map(step => step.step_id), [1, 2, 3, 5], 'a self-introduction is fetched whole')
  assert.deepEqual(upcomingVoiceSteps(long, 0, { scan: 3 }).map(step => step.step_id), [2, 3], 'lookahead stays near the reader')
  assert.deepEqual(upcomingVoiceSteps(null, 0), [])
}

// Scheduler: bounded concurrency, a new position keeps running loads, a new script aborts them.
{
  const calls = [], gates = new Map()
  const lookahead = createVoiceLookahead({ concurrency: 2, limit: 3, wholeScriptAt: 0, prefetch: ({ step, signal }) => {
    calls.push(step.step_id)
    const gate = deferred()
    gates.set(step.step_id, { ...gate, signal })
    return gate.promise
  } })
  const steps = Array.from({ length: 12 }, (_, id) => voiced(id))
  const scenario = { scenario_id: 's1', steps }
  assert.deepEqual(lookahead.update(scenario, 0).map(step => step.step_id), [1, 2, 3])
  await tick()
  assert.deepEqual(calls, [1, 2], 'two loads at a time')
  lookahead.update(scenario, 1)
  await tick()
  assert.deepEqual(calls, [1, 2], 'running loads are kept; 3 and 4 wait')
  gates.get(1).resolve(true); await tick(); await tick()
  assert.deepEqual(calls, [1, 2, 3])
  gates.get(2).resolve(true); await tick(); await tick()
  assert.deepEqual(calls, [1, 2, 3, 4])
  lookahead.update(scenario, 1)
  await tick()
  assert.deepEqual(calls, [1, 2, 3, 4], 'nothing is fetched twice')
  // A position change drops queued work; it comes back if still wanted.
  lookahead.update(scenario, 6); await tick()
  gates.get(3).resolve(true); gates.get(4).resolve(true); await tick(); await tick()
  assert.deepEqual(calls, [1, 2, 3, 4, 7, 8])
  const signal = gates.get(7).signal
  lookahead.update({ scenario_id: 's2', steps: [voiced(0), voiced(1)] }, 0)
  assert.equal(signal.aborted, true, 'a new script aborts the previous lookahead')
  lookahead.dispose()
}

// Lip: a caller's deadline releases the caller, not the download; a cancelled caller aborts it.
{
  const responses = new Map(), aborted = []
  const fetchImpl = (url, { signal }) => {
    const gate = deferred()
    responses.set(url, gate)
    signal.addEventListener('abort', () => { aborted.push(url); gate.reject(signal.reason) }, { once: true })
    return gate.promise
  }
  const store = createVoiceLipStore({ fetchImpl })
  const step = { dialogue: { voice: 'slow.m4a', lip: { path: 'adxlip/slow.json' } } }
  await assert.rejects(store.load(step, { timeoutMs: 20 }), /timeout/i)
  assert.deepEqual(aborted, [], 'the download continues after the deadline')
  const url = [...responses.keys()][0]
  responses.get(url).resolve({ ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), json: async () => ({ scales: [0.1, 0.5] }) })
  await until(() => store.inspect().entries === 1, 'late lip cached')
  assert.deepEqual((await store.load(step, { timeoutMs: 20 })).scales, [0.1, 0.5], 'the late curve serves the next request')

  const other = { dialogue: { voice: 'gone.m4a', lip: { path: 'adxlip/gone.json' } } }
  const controller = new AbortController(), peer = new AbortController()
  const first = store.load(other, { signal: controller.signal, timeoutMs: 1000 })
  const second = store.load(other, { signal: peer.signal, timeoutMs: 1000 })
  await tick()
  assert.equal(responses.size, 2, 'one download per path')
  controller.abort(new Error('next line'))
  await assert.rejects(first)
  assert.equal(aborted.length, 0, 'a remaining caller keeps the download')
  peer.abort(new Error('next line'))
  await assert.rejects(second)
  assert.equal(aborted.length, 1, 'the last cancelled caller aborts it')
  store.clear()
}

// Player: prefetch decodes ahead without touching diagnostics; the gate hands over its preparation;
// a lip curve that missed its deadline is fetched again when the late voice starts.
class FakeNode { connect(node) { return node } disconnect() {} }
class FakeGain extends FakeNode {
  constructor() { super(); this.gain = { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} } }
}
class FakeSource extends FakeNode {
  constructor() { super(); this.playbackRate = { value: 1, setValueAtTime() {} } }
  start() { this.started = true }
  stop() { this.onended?.() }
}
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = new FakeNode() }
  createGain() { return new FakeGain() }
  createBufferSource() { return new FakeSource() }
  async decodeAudioData() { return { duration: 1, length: 48000, numberOfChannels: 1 } }
  async resume() { this.state = 'running' }
  async suspend() { this.state = 'suspended' }
  async close() { this.state = 'closed' }
}
{
  const originalWindow = globalThis.window
  globalThis.window = { setTimeout, clearTimeout }
  const voiceRequests = [], lipGates = new Map()
  const audioResponse = () => ({ ok: true, status: 200, url: '', headers: new Map([['content-type', 'audio/mp4']]),
    arrayBuffer: async () => new ArrayBuffer(4000) })
  const voiceCache = createCompressedVoiceCache({ fetchImpl: async url => { voiceRequests.push(url); return audioResponse() } })
  const lipStore = createVoiceLipStore({ fetchImpl: (url, { signal }) => {
    const gate = deferred()
    lipGates.set(url, gate)
    signal.addEventListener('abort', () => gate.reject(signal.reason), { once: true })
    return gate.promise
  } })
  const session = new StoryAudioSession({ contextFactory: () => new FakeAudioContext() })
  session.unlockFromUserGesture()
  const withLip = (id, name) => ({ ...voiced(id, `${name}.m4a`), dialogue: { voice: `${name}.m4a`, lip: { path: `adxlip/${name}.json` } } })
  const steps = [withLip(0, 'line_00'), withLip(1, 'line_01')]
  const currentStep = { value: steps[0] }, currentStepIndex = { value: 0 }
  const talking = []
  const player = useVoicePlayer({ spineStageRef: { value: { manager: { setSpineTalking: (...args) => talking.push(args) } } },
    currentStep, currentStepIndex, compiledData: { value: { scenario_id: 'qa', steps } }, isPlaying: { value: false },
    audioSession: session, voiceCache, lipStore, lipTimeoutMs: 20 })
  try {
    assert.equal(await player.prefetchVoice({ step: steps[1] }), true)
    assert.equal(player.hasDecodedVoice(steps[1], 'qa'), true, 'the next line is decoded ahead')
    assert.equal(player.getDiagnostics().attempt, null, 'lookahead never becomes the current attempt')
    const requestsAfterPrefetch = voiceRequests.length

    // Step 0: the gate started the preparation; its lip misses the 20 ms deadline, then arrives.
    const controller = new AbortController()
    const pending = { controller, promise: player.prepareVoice({ step: steps[0], signal: controller.signal }) }
    const lipUrl = () => [...lipGates.keys()].find(url => url.includes('line_00'))
    await until(() => lipUrl(), 'lip request started')
    await new Promise(resolve => setTimeout(resolve, 40))
    lipGates.get(lipUrl()).resolve({ ok: true, status: 200, headers: new Map(), json: async () => ({ scales: [{ y: 0.6 }, { y: 0.8 }] }) })
    await until(() => lipStore.inspect().entries >= 1, 'late lip cached')
    assert.equal(await player.playVoice({ pending }), true)
    assert.equal(voiceRequests.filter(url => url.includes('line_00')).length, 1, 'the gate preparation is played, not fetched again')
    assert.ok(talking.some(([id, on]) => id === 'a' && on), 'the speaker talks')
    await until(() => player.getVoiceVolume() > 0, 'lip reattached to the late voice')

    // Step 1 was prefetched: no second request.
    currentStep.value = steps[1]; currentStepIndex.value = 1
    assert.equal(await player.playVoice(), true)
    assert.equal(voiceRequests.length, requestsAfterPrefetch + 1, 'a prefetched line plays from the decoded cache')
  } finally {
    player.dispose()
    await session.dispose()
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
}

// Step effects: an in-flight gate preparation goes to playVoice({ pending }).
{
  const played = []
  const entry = { promise: Promise.resolve(null), controller: new AbortController() }
  const effects = useStepSceneEffects({
    currentStepIndex: { value: 0 }, isLastStep: { value: false }, historyStack: { value: [] },
    spineStageRef: { value: null }, audioManager: { inspect: () => ({}) },
    voicePlayer: { playPreparedVoice: value => played.push(['prepared', value]), playVoice: options => played.push(['voice', options]) },
    resetVoiceDedup: () => {}, takePreparedVoice: () => entry,
  })
  try {
    effects.handleStepChange({ step_id: 1, type: 'adv', entry_snapshot: {} }, null)
    assert.deepEqual(played, [['voice', { pending: entry }]])
  } finally { effects.cleanup() }
}

// Viewer wiring: lookahead after each playable step, late-voice controls in the bubble.
{
  const viewer = await readFile(new URL('../src/core/StoryViewer.vue', import.meta.url), 'utf8')
  const adv = await readFile(new URL('../src/components/AdvUI.vue', import.meta.url), 'utf8')
  assert.match(viewer, /takePreparedVoice: takeStepVoice/)
  assert.match(viewer, /scheduleVoiceLookahead\(\)/)
  assert.match(viewer, /voiceLate\.value = !entry\.settled/)
  assert.match(viewer, /:voice-late="voiceLate"/)
  assert.match(adv, /player\.voice\.reload/)
  assert.match(adv, /player\.voice\.replay/)
}
console.log('Story voice preload verified: lookahead selection and concurrency, shared lip flights, gate handoff, lip reattachment.')
