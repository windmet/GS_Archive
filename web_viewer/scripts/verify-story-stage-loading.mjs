import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Execute the production methods with controlled asset loading. Keep Vue/Pixi
// initialization out of this ordering test; no copied scene implementation.
const stageSource = readFileSync(new URL('../src/components/SpineStage.vue', import.meta.url), 'utf8')
const managerSource = readFileSync(new URL('../src/core/PixiStageManager.js', import.meta.url), 'utf8')
const applySource = stageSource.slice(stageSource.indexOf('async function applyState('), stageSource.indexOf('\ndefineExpose('))
const spawnSource = managerSource.slice(managerSource.indexOf('  async spawnSpine('), managerSource.indexOf('  _emitSpineState('))
assert.ok(applySource.startsWith('async function applyState('))
assert.ok(spawnSource.includes('return spine'))
const noop = () => {}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fakeSpine() {
  return {
    stateData: {}, state: { update: noop, apply: noop, tracks: [] },
    scale: { x: 1 }, on: noop, destroyed: false,
    destroy() { this.destroyed = true },
  }
}
function setup() {
  const loads = [], removals = [], published = []
  const manager = {
    app: { stage: { on: noop } }, width: 1280, _spawnTokens: {}, spineInstances: {},
    removeSpine(id) { removals.push(id); delete this.spineInstances[id]; this._spawnTokens[id] = (this._spawnTokens[id] || 0) + 1 },
    _detectBlinkSlots: noop, _detectEffectSlots: noop, _detectOptionalPartsSlots: noop,
    _applyDefaultPosition: noop, setSpineColor: noop, setSpineZoom: noop,
    setSpineAlpha: noop, updateSpineFace: noop, bringToFront: noop,
    showSilhouette(id, model) { this.spineInstances[id] = { modelId: model, silhouette: true } },
  }
  const context = vm.createContext({
    window: {},
    console: {
      log: noop, debug: noop,
      warn: (...args) => assert.ok(args.join(' ').includes('missing asset'), args.join(' ')),
      error: (...args) => { throw new Error(args.join(' ')) },
    },
    manager, applyStateToken: 0, lastScreenEffectsKey: null,
    getStepSceneState: step => step?.entry_snapshot,
    _loadBodyTypes: async () => {}, applyStepSceneState: noop,
    NON_VISUAL_IDS: new Set(), _otherSettingCache: { idol: {} },
    getSelectedReferenceY: noop, resolveBaseYUtil: () => ({ finalBaseY: 0 }),
    USE_PREFAB_META: false, costumePrefabMeta: {}, MODEL_Y_OFFSET: {},
    BASE_ANCHOR: 0, SUB_BASE_ANCHOR: 0, ANCHOR_UNITY_Y: 0, SUB_ANCHOR_UNITY_Y: 0,
    PIXEL_SCALE: 1, SUB_PIXEL_SCALE: 1, SUB_MODEL_RE: /sub/, costumeDictionary: {},
    logYDiagnostics: noop, buildYDiagnosticRow: noop, LOG_Y_DIAGNOSTICS: false,
    debugMode: { value: false }, Y_DEBUG_STORE: {}, isSilhouetteOnlyModel: () => false,
    getBodyType: noop, BODY_SCALE_ENABLED: false, FIT_MODE: '',
    VISUAL_HEIGHT_REFERENCE: 0, VISUAL_HEIGHT_STRENGTH: 0,
    positionSpine: noop, applyCharaOverrides: noop, syncBoundsSnapshot: noop,
    scheduleStageDebugPublish: noop, computeVisualRootY: () => 0,
    computeVisualRootYUtil: () => 0,
    getSpineAtlasUrl: id => id, getSpineSkelUrl: id => id,
    Spine: {}, SkeletonBinary: {}, AtlasAttachmentLoader: {}, TextureAtlas: {},
    loadAndCreateSpine: () => {
      const load = deferred(); loads.push(load); return load.promise
    },
    finalizeSpawnedSpine: ({ spine, modelId, idolId }) => {
      published.push(modelId); manager.spineInstances[idolId] = { spine, modelId }
    },
  })
  manager.spawnSpine = vm.runInContext(`({${spawnSource}}).spawnSpine`, context)
  const apply = vm.runInContext(`${applySource}\napplyState`, context)
  function finish(index) {
    const spine = fakeSpine()
    loads[index].resolve({ spine, skeletonData: {}, animNames: [], hasMeshOrRegion: true })
    return spine
  }
  return { apply, context, manager, loads, removals, published, finish }
}
const step = model => ({ step_id: model, entry_snapshot: { spines: model ? [{ id: 'idol', model }] : [] } })

// The newer model completes first. An older completion must neither publish
// its model nor remove the newer instance by the shared idol ID.
{
  const t = setup()
  const old = t.apply(step('old')); await flush()
  const current = t.apply(step('current')); await flush()
  t.finish(1); await current
  assert.equal(t.manager.spineInstances.idol?.modelId, 'current')
  assert.equal(t.manager.spineInstances.idol?.silhouette, undefined)
  const removals = t.removals.length
  const stale = t.finish(0); await old
  assert.equal(t.manager.spineInstances.idol?.modelId, 'current', 'late old completion removed the current model')
  assert.equal(t.removals.length, removals)
  assert.equal(stale.destroyed, true)
  assert.deepEqual(t.published, ['current'])
}
// A superseded load finishes while its replacement is still pending.
{
  const t = setup()
  const old = t.apply(step('old')); await flush()
  const current = t.apply(step('current')); await flush()
  const stale = t.finish(0); await old
  assert.equal(stale.destroyed, true)
  assert.deepEqual(t.published, [])
  t.finish(1); await current
  assert.equal(t.manager.spineInstances.idol?.modelId, 'current')
}
// No replacement spawn exists to advance the per-id spawn token. The scene
// generation must still reject publication after navigation to an empty scene.
{
  const t = setup()
  const old = t.apply(step('old')); await flush()
  await t.apply(step(null))
  const stale = t.finish(0); await old
  assert.deepEqual(t.published, [], 'departed character was published after navigation')
  assert.equal(stale.destroyed, true)
}
// Navigating away from the story invalidates the scene without another apply.
{
  const t = setup()
  const old = t.apply(step('old')); await flush()
  t.context.applyStateToken++
  const stale = t.finish(0); await old
  assert.deepEqual(t.published, [])
  assert.equal(stale.destroyed, true)
}
// A late failed load must not remove a newer successful instance either.
{
  const t = setup()
  const old = t.apply(step('old')); await flush()
  const current = t.apply(step('current')); await flush()
  t.finish(1); await current
  t.loads[0].reject(new Error('missing asset')); await old
  assert.equal(t.manager.spineInstances.idol?.modelId, 'current')
}
// Unscoped renderer callers keep their existing successful spawn contract.
{
  const t = setup()
  const pending = t.manager.spawnSpine('idol', 'direct')
  const spine = t.finish(0)
  assert.equal(await pending, spine)
  assert.deepEqual(t.published, ['direct'])
}
// Already invalid work must not remove a live instance or start asset I/O.
{
  const t = setup()
  t.manager.spineInstances.idol = { modelId: 'live' }
  assert.equal(await t.manager.spawnSpine('idol', 'stale', { isCurrent: () => false }), null)
  assert.equal(t.manager.spineInstances.idol.modelId, 'live')
  assert.equal(t.loads.length, 0)
}
console.log('Story stage loading: scene replacement, departure, late failure and direct spawn passed')
