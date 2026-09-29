import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createStoryConfigStore } from '../../src/utils/StoryConfigStore.js'

test('failed or malformed configuration never poisons a successful parsed cache', async () => {
  let calls = 0
  const store = createStoryConfigStore({ kind: 'idol-motion', url: '/motion.json', project: data => data.entries,
    transport: { async getJson() { calls++; if (calls === 1) throw new Error('transient'); if (calls === 2) return {}; return { entries: { model: {} } } } } })
  await assert.rejects(store.load(), /transient/)
  await assert.rejects(store.load(), /Unusable/)
  assert.equal(store.peek(), null)
  assert.deepEqual(await store.load(), { model: {} })
  await store.load(); assert.equal(calls, 3)
})

test('configuration deadline is finite and an ignored late load cannot install stale cache', async () => {
  let finish, calls = 0
  const store = createStoryConfigStore({ kind: 'idol-motion', url: '/motion.json', timeoutMs: 10,
    project: data => data.entries, transport: { getJson() { calls++; return calls === 1 ? new Promise(resolve => { finish = resolve }) : Promise.resolve({ entries: { fresh: {} } }) } } })
  await assert.rejects(store.load(), { code: 'LOAD_TIMEOUT' })
  assert.equal(store.peek(), null)
  const fresh = await store.load()
  finish({ entries: { stale: {} } }); await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(store.peek(), fresh); assert.deepEqual(fresh, { fresh: {} })
})

const source = readFileSync(new URL('../../src/components/SpineStage.vue', import.meta.url), 'utf8')
const applySource = source.slice(source.indexOf('async function applyState('), source.indexOf('\nfunction isSpineReady('))
const readinessSource = source.slice(source.indexOf('function getSceneReadiness('), source.indexOf('\ndefineExpose('))
function stageFixture(spines, loaders = {}) {
  const step = { step_id: 2, state: { spines } }
  const context = vm.createContext({ AbortController, DOMException, console, Promise, step, props: { step }, emit: () => {},
    manager: { spineInstances: {}, _silhouetteSprites: {}, _silhouettePending: {} }, applyStateToken: 0,
    applyStateLoad: new AbortController(), projectedStep: null, projectionFailure: null, lastScreenEffectsKey: '',
    NON_VISUAL_IDS: new Set(), isSilhouetteOnlyModel: () => false, getStepSceneState: item => item.state,
    applied: 0, applyStepSceneState: () => { context.applied++; return '' },
    _loadBodyTypes: () => { throw new Error('unnecessary body type fetch') },
    _loadPrefabMeta: () => { throw new Error('unnecessary prefab fetch') },
    _loadMotionSettings: () => { throw new Error('unnecessary motion fetch') },
    applyCharaOverrides: () => {}, syncBoundsSnapshot: () => {}, debugMode: { value: false },
    syncStates: () => {}, scheduleStageDebugPublish: () => {}, tracePlayer: () => {},
    isSceneProjected: expected => context.projectedStep === expected, ...loaders })
  vm.runInContext(applySource + '\n' + readinessSource, context)
  return context
}
test('actual SpineStage empty-background entry performs no actor metadata fetch', async () => {
  const c = stageFixture([])
  await c.applyState(c.step)
  assert.equal(c.applied, 1)
  assert.equal(c.projectedStep, c.step)
  assert.equal(c.getSceneReadiness(c.step).status, 'ready')
  const mount = source.slice(source.indexOf('onMounted(() => {'), source.indexOf('\nfunction syncManagedBackground'))
  assert.doesNotMatch(mount, /void _loadPrefabMeta|void _loadMotionSettings/)
  assert.match(mount, /if \(props.debugControls\) void _loadCostumeDictionary\(\)/)
})
test('actual SpineStage actor metadata failure is blocked, never permanent waiting or fake ready', async () => {
  const c = stageFixture([{ id: '047shu', model: '047shu_005_00' }], {
    _loadBodyTypes: async () => {}, _loadPrefabMeta: async () => { throw Object.assign(new Error('bad prefab'), { code: 'CONFIG_TEST' }) },
    _loadMotionSettings: async () => {} })
  await c.applyState(c.step)
  assert.equal(c.applied, 0)
  assert.equal(c.projectedStep, null)
  const status = c.getSceneReadiness(c.step)
  assert.equal(status.status, 'blocked'); assert.equal(status.reason, 'actor-configuration')
  assert.equal(status.code, 'CONFIG_TEST')
})
