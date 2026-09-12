import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { ref } from 'vue'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { Preloader } from '../src/utils/Preloader.js'
import { prepareScenario } from '../src/data/prepareScenario.js'

// Execute the production timeout wrapper with a controlled timer: a timeout
// must abort its adapter rather than merely stop awaiting an active request.
const preloaderSource = await readFile(new URL('../src/utils/Preloader.js', import.meta.url), 'utf8')
const timeoutFunction = preloaderSource.match(/async function withTimeout\([^]*?\n\}/)
assert.ok(timeoutFunction)
let fireTimeout, timerCleared = false, taskSignal
const timeoutScope = { AbortController,
  setTimeout(callback) { fireTimeout = callback; return 1 },
  clearTimeout(id) { assert.equal(id, 1); timerCleared = true },
}
runInNewContext(timeoutFunction[0], timeoutScope)
const timed = timeoutScope.withTimeout(signal => { taskSignal = signal; return new Promise(() => {}) }, 10, 'fixture')
await Promise.resolve()
fireTimeout()
await assert.rejects(timed, /timeout \(10ms\): fixture/)
assert.equal(taskSignal.aborted, true)
assert.equal(timerCleared, true)

const importAbort = new AbortController()
let importStarted = false
const uninterruptible = prepareScenario('fixture.json', {
  isCurrent: () => true, signal: importAbort.signal,
  fetchImpl: async () => new Response(JSON.stringify({ steps: [] })),
  loadPlayer: () => { importStarted = true; return new Promise(() => {}) }, preloadAssets: async () => {},
})
// Wait only for deterministic promise work, not the never-finishing import.
for (let i = 0; !importStarted && i < 100; i++) await new Promise(resolve => setImmediate(resolve))
assert.equal(importStarted, true, 'fixture must reach the non-cancellable import')
importAbort.abort()
await assert.rejects(uninterruptible, { name: 'AbortError' })

const savedFetch = globalThis.fetch
const savedImage = globalThis.Image
const images = []
class PendingImage {
  constructor() { images.push(this) }
  set src(value) { this.url = value }
  removeAttribute(name) { assert.equal(name, 'src'); this.removed = true }
}
const waitFor = async (predicate, label) => {
  const until = Date.now() + 3000
  while (!predicate()) {
    if (Date.now() > until) throw new Error(`Timed out: ${label}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
const started = [], closed = []
const scenario = { steps: Array.from({ length: 8 }, (_, i) => ({ step_id: i + 1,
  state: { bg: 'fixture-bg', spines: [{ model: `fixture_${i}` }] } })) }
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname === '/data/compiled/fixture.json') {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(scenario))
    return
  }
  started.push(url.pathname)
  // Hold both a scenario fetch and skeleton body reads in real HTTP requests.
  // Unlike a rejected test stub, this checks native fetch signal propagation.
  response.writeHead(200, { 'Content-Type': 'application/octet-stream' })
  response.write('pending')
  response.on('close', () => { if (!response.writableEnded) closed.push(url.pathname) })
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const observedSignals = []
const errors = [], progress = []
const statuses = []
globalThis.fetch = (url, options) => {
  assert.ok(options.signal instanceof AbortSignal, 'every scenario/binary fetch receives a signal')
  observedSignals.push(options.signal)
  return savedFetch(new URL(url, base), options)
}
globalThis.Image = PendingImage
const state = Object.fromEntries(['view', 'loading', 'preloadProgress', 'currentScenarioFile',
  'currentScenarioStartStep', 'currentScenarioEndStep', 'currentScenarioInitialStep', 'currentPreviewCue', 'returnViewAfterPlayer']
  .map(key => [key, ref(key === 'view' ? 'files' : null)]))
const navigation = createArchiveNavigationCoordinator({ onFinish: () => { state.loading.value = false } })
const player = useStoryPlaybackController({ state, navigation,
  loadPlayer: async () => {},
  preloadAssets: (steps, report, options) => Preloader.preloadScenario(steps, value => { progress.push(value); report(value) }, {
    ...options, onStatus: value => { statuses.push(value); options.onStatus?.(value) },
  }),
  syncRoute() {}, returnTo() {}, onError: error => errors.push(error),
})
try {
  const first = player.load('fixture.json')
  await waitFor(() => started.length === 5, 'five skeletons plus one image fill the first batch')
  player.close()
  assert.equal(await first, false, 'closed load resolves without publishing')
  await waitFor(() => closed.length === 5, 'native skeleton requests aborted during body consumption')
  await waitFor(() => statuses.at(-1)?.phase === 'cancelled', 'executor records cancelled pending tasks')
  assert.equal(statuses.at(-1).cancelled, 9)
  assert.equal(statuses.at(-1).succeeded, 0)
  assert.equal(statuses.at(-1).failed, 0)
  assert.equal(player.preloadStatus.value, null, 'closed controller rejects cancellation status publication')
  assert.ok(observedSignals.every(signal => signal.aborted), 'navigation and per-task fetch signals are aborted')
  assert.equal(images.length, 1)
  assert.equal(images[0].removed, true, 'pending image source removed')
  assert.equal(images[0].onload, null, 'image listeners released')
  assert.equal(images[0].onerror, null)
  assert.equal(images[0].onabort, null)
  assert.equal(started.length, 5, 'no next batch launched')
  assert.deepEqual(progress, [], 'aborted tasks do not report completion')
  assert.deepEqual(errors, [], 'obsolete abort is not a current playback error')
  assert.equal(player.currentScenario.value, null)

  const slow = player.load('slow.json')
  await waitFor(() => started.length === 6, 'scenario body read started')
  await navigation.run(() => { state.view.value = 'home' })
  assert.equal(await slow, false)
  await waitFor(() => closed.length === 6, 'superseded scenario fetch aborted')
  assert.equal(state.view.value, 'home')
  assert.equal(player.currentScenario.value, null)

  let oldIntent, currentWhenAborted
  const pending = navigation.run(async intent => {
    oldIntent = intent
    intent.signal.addEventListener('abort', () => { currentWhenAborted = intent.isCurrent() }, { once: true })
    await new Promise(resolve => intent.signal.addEventListener('abort', resolve, { once: true }))
  })
  navigation.dispose()
  await pending
  assert.equal(oldIntent.signal.aborted, true)
  assert.equal(currentWhenAborted, false, 'publication revoked before abort callbacks execute')
  const cancelled = new AbortController(); cancelled.abort()
  const previousImages = images.length
  await assert.rejects(Preloader.preloadScenario(scenario.steps, () => assert.fail('cancelled progress'), { signal: cancelled.signal }), { name: 'AbortError' })
  assert.equal(images.length, previousImages, 'pre-aborted work never starts')
} finally {
  player.dispose()
  navigation.dispose()
  globalThis.fetch = savedFetch
  globalThis.Image = savedImage
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
console.log('Preload cancellation verified: real HTTP source/body abort, revoked publication, image cleanup, no next batch or late progress')
