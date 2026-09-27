import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Preloader } from '../../src/utils/Preloader.js'
import { StoryWarmupQueue } from '../../src/core/StoryWarmupQueue.js'
import { createStoryAssetPlan } from '../../shared/story/StoryAssetPlan.js'
import { createStoryAssetPriority } from '../../shared/story/StoryAssetPriority.js'
import { resolveSpineTextureUrl } from '../../src/utils/SpineTextureUrl.js'
import { withLoadDeadline } from '../../src/core/AsyncLoadBoundary.js'
import { deferred, tick, until } from './helpers.mjs'
const source = { steps: Array.from({ length: 15 }, (_, i) => ({ step_id: 100 + i * 7, type: 'adv', state: { bg: `bg${i}` } })) }
const planFor = value => createStoryAssetPlan(value, { file: 'fixture.json', sha256: `sha256:${'a'.repeat(64)}` })

test('interactive preparation starts no resource I/O; rolling window remains live after idle', async () => {
  const calls = [], reports = []
  class Controlled extends Preloader {
    static async _preloadImage() { assert.fail('speculation must not decode an Image') }
    static async _preloadBinary(url) { calls.push(url); return 'fetched' }
  }
  const owner = new AbortController()
  const session = await Controlled.preloadScenario(planFor(source), null, { runtimeOwned: true, entryOnly: true, signal: owner.signal,
    priority: createStoryAssetPriority(source), onStatus: status => reports.push(status) })
  assert.equal(calls.length, 0, 'entry readiness is renderer-owned')
  assert.equal(session.status.phase, 'renderer-owned')
  await session.startBackground()
  assert.deepEqual(calls, [1, 2, 3].map(i => `/assets/bg/bg${i}.png`))
  assert.equal(reports.at(-1).failed, 0)
  session.updatePriority(createStoryAssetPriority(source, { initialStep: 11 }))
  await session.startBackground()
  assert.deepEqual(calls.slice(3), [11, 12, 13].map(i => `/assets/bg/bg${i}.png`))
  assert.equal(calls.includes('/assets/bg/bg10.png'), false, 'current image belongs to renderer')
  assert.equal(calls.includes('/assets/bg/bg14.png'), false, 'outside window is not speculative work')
  owner.abort()
  assert.equal(session.updatePriority(createStoryAssetPriority(source)), false)
})

test('actual uploaded 1_4_001_00_a: step 3 never warms step 19 cast', async () => {
  const real = JSON.parse(await readFile(new URL('../../public/data/compiled/episodes/1_4_001_00_a.json', import.meta.url)))
  const calls = []
  class Controlled extends Preloader {
    static async _preloadBinary(url) { calls.push(url); return 'fetched' }
    static async _preloadImage() { assert.fail('no speculative image decode') }
    static async _preloadConfig(task) { calls.push(task.urls[0]) }
    static async _preloadAtlas(url) { calls.push(url); return { text: 'comu.png\nsize: 2, 2\nformat: RGBA8888\nfilter: Linear, Linear\nrepeat: none\n', sha256: `sha256:${'b'.repeat(64)}` } }
    static async _resolvePage(task) { return `/assets/spines/${task.atlasSource.modelId}/${task.atlasSource.page}` }
  }
  const session = await Controlled.preloadScenario(planFor(real), null, { runtimeOwned: true,
    priority: createStoryAssetPriority(real, { startStep: 2, endStep: 27, initialStep: 3 }) })
  await session.startBackground()
  assert.equal(calls.some(url => /spines\//.test(url)), false)
  session.updatePriority(createStoryAssetPriority(real, { startStep: 2, endStep: 27, initialStep: 8 }))
  await session.startBackground()
  assert.equal(calls.some(url => /047shu/.test(url)), true, 'step 10 cast enters near window')
  assert.equal(calls.some(url => /001tom|004ter/.test(url)), false, 'step 19 cast remains deferred')
  assert.equal(calls.some(url => /costume_dictionary/.test(url)), false, 'diagnostic costume names are not playback speculation')
  session.dispose()
})

test('bounded queue: max two jobs / one image, supersession aborts stale speculation', async () => {
  const tasks = Array.from({ length: 6 }, (_, i) => ({ key: String(i), operation: i < 3 ? 'image' : 'binary', priority: 'near', state: 'discovered' }))
  const held = new Map(), launched = [], active = new Set()
  let maximum = 0, images = 0, maxImages = 0
  const queue = new StoryWarmupQueue({ tasks, priority: t => t.priority, eligible: t => t.priority === 'near',
    run: async (task, signal) => {
      launched.push(task.key); active.add(task); maximum = Math.max(maximum, active.size)
      if (task.operation === 'image') { images++; maxImages = Math.max(maxImages, images) }
      const gate = deferred(); held.set(task, gate)
      signal.addEventListener('abort', () => gate.reject(signal.reason), { once: true })
      try { await gate.promise; task.state = 'fetched' } finally { active.delete(task); if (task.operation === 'image') images-- }
    } })
  const first = queue.start()
  assert.equal(queue.start(), first)
  await until(() => launched.length === 2)
  assert.deepEqual(launched, ['0', '3'])
  queue.setPaused(true)
  await first
  assert.equal(active.size, 0)
  assert.equal(tasks[0].state, 'discovered')
  tasks.forEach(task => { task.priority = 'deferred' })
  tasks[2].priority = 'near'
  queue.setPaused(false)
  await until(() => held.has(tasks[2]))
  held.get(tasks[2]).resolve()
  await queue.start()
  assert.equal(maximum, 2); assert.equal(maxImages, 1)
  assert.equal(tasks[1].state, 'discovered')
  queue.dispose()
})

test('late ignored adapter cannot downgrade a new priority or leak settled bytes into successor attempt', async () => {
  const gate = deferred(), calls = []
  class Controlled extends Preloader {
    static async _preloadBinary(url) { calls.push(url); if (url.endsWith('bg1.png') && calls.filter(x => x === url).length === 1) await gate.promise; return 'fetched' }
  }
  let status
  const session = await Controlled.preloadScenario(planFor(source), null, { runtimeOwned: true,
    priority: createStoryAssetPriority(source), onStatus: value => { status = value } })
  const running = session.startBackground()
  await until(() => calls.length > 0)
  session.setPaused(true)
  await running
  session.updatePriority(createStoryAssetPriority(source, { initialStep: 11 }))
  session.setPaused(false)
  await session.startBackground()
  gate.resolve(); await tick()
  const old = status.tasks.find(task => task.id === 'bg1')
  assert.equal(old.priority, 'deferred')
  assert.notEqual(old.state, 'fetched')
  session.dispose()
})

test('default comu and multi-page textures use direct URL; fallback probe observes abort/deadline', async () => {
  let probes = 0
  assert.equal(await resolveSpineTextureUrl('001tom_005_00', 'comu.png', { probe: () => { probes++; return true } }), '/assets/spines/001tom_005_00/comu.png')
  await resolveSpineTextureUrl('001tom_005_00', 'page2.png', { allowFallback: false, probe: () => { probes++; return true } })
  assert.equal(probes, 0)
  const owner = new AbortController(); owner.abort()
  await assert.rejects(resolveSpineTextureUrl('001tom', 'alt.png', { signal: owner.signal, probe: async () => true }), { name: 'AbortError' })
  await assert.rejects(withLoadDeadline(() => new Promise(() => {}), { timeoutMs: 10, label: 'probe-test' }), { code: 'LOAD_TIMEOUT' })
})
