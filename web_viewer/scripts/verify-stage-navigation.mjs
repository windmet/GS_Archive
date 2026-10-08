import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useStageNavigation } from '../src/composables/useStageNavigation.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parseJavascript(script, { sourceType: 'module' }).program.body
const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useStageNavigation')
assert.ok(binding, 'App binds the real stage navigation factory')
assert.equal(binding.id.type, 'ObjectPattern')
const entryNames = ['openSpineLab', 'openChibiStage', 'closeArchiveExperiment', 'updateStageTarget', 'openSongStage']
assert.deepEqual(binding.id.properties.map(property => property.key.name).sort(), [...entryNames].sort())
const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useStageNavigation'))
assert.equal(imported?.source.value, './composables/useStageNavigation.js')
const factoryCall = script.slice(binding.init.start, binding.init.end)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let count = 0; count < 16; count++) await Promise.resolve() }
const plain = value => JSON.parse(JSON.stringify(value))
let activeErrors
const previousError = console.error
console.error = (...args) => activeErrors?.push(args)

function fixture(initialView = 'song_detail') {
  const calls = [], errors = [], requests = []
  activeErrors = errors
  const controls = { spine: async () => {}, stage: async () => {}, detail: async id => ({ id }) }
  const state = {
    view: ref(initialView), currentSongId: ref('brndnf'), detailSourceRoute: ref(''), stageTargetId: ref(''), stageHandoff: ref(null),
    songReadModelDetail: ref(null), loading: ref(false), loadingPurpose: ref('archive-data'), preloadProgress: ref(0),
  }
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => {
    state.loading.value = false
    state.loadingPurpose.value = 'archive-data'
  } })
  const context = { ...state, navigation, useStageNavigation,
    captureDetailSource: () => { calls.push(['capture', state.view.value]); state.detailSourceRoute.value = `?view=${state.view.value}` },
    commitView: (next, options = {}) => {
      navigation.invalidate()
      state.loading.value = false
      state.loadingPurpose.value = 'archive-data'
      state.view.value = next
      calls.push(['commit', next, options])
    },
    restoreDetailSource: fallback => {
      calls.push(['restore', state.detailSourceRoute.value, fallback])
      return state.detailSourceRoute.value ? 'restored-source' : fallback()
    },
    goHome: () => { calls.push(['home']); return 'restored-home' },
    syncArchiveRoute: options => calls.push(['sync', options]),
    spineViewerLoader: () => { calls.push(['spine-module']); return controls.spine() },
    chibiStageViewerLoader: () => { calls.push(['stage-module']); return controls.stage() },
    loadSongDetail: id => { requests.push(id); return controls.detail(id) },
    ensureSongCatalog: () => { calls.push(['catalog']); return Promise.resolve(true) },
  }
  const handlers = vm.runInNewContext(factoryCall, context)
  for (const name of entryNames) assert.equal(typeof handlers[name], 'function', `App's ${name} binding is callable`)
  return { ...handlers, state, context, navigation, controls, calls, errors, requests }
}

try {
  // Default entry waits for its module and default song before publishing the stage.
  {
    const t = fixture('experiments'), module = deferred(), data = deferred()
    t.controls.stage = () => module.promise
    t.controls.detail = () => data.promise
    const pending = t.openChibiStage()
    assert.equal(t.state.loading.value, true)
    assert.equal(t.state.loadingPurpose.value, 'stage')
    assert.equal(t.state.preloadProgress.value, 100)
    assert.equal(t.state.view.value, 'experiments')
    assert.deepEqual(t.requests, [])
    module.resolve(); await flush()
    assert.deepEqual(t.requests, ['drvalv'])
    assert.equal(t.state.view.value, 'experiments')
    data.resolve({ id: 'drvalv' }); await pending
    assert.equal(t.state.view.value, 'chibi_stage')
    assert.equal(t.state.songReadModelDetail.value?.id, 'drvalv')
    assert.equal(t.state.currentSongId.value, '')
    assert.equal(t.state.stageTargetId.value, '')
    assert.equal(t.state.stageHandoff.value, null)
    assert.equal(t.state.detailSourceRoute.value, '?view=experiments')
    assert.equal(t.state.loading.value, false)
    assert.equal(t.calls.filter(call => call[0] === 'catalog').length, 1)
  }
  // Matching cached detail is retained; a handoff reaches the selected arrangement intact.
  {
    const t = fixture(), handoff = { songCode: 'brndnf', choreographyId: 'sample', positions: [{ stagePosition: 3 }] }
    t.state.songReadModelDetail.value = { id: 'brndnf', witness: 'cached' }
    await t.openSongStage({ songCode: 'brndnf', choreographyId: 'sample', stageHandoff: handoff })
    assert.equal(t.state.view.value, 'chibi_stage')
    assert.equal(t.state.stageTargetId.value, 'sample')
    assert.equal(t.state.currentSongId.value, 'brndnf')
    assert.deepEqual(plain(t.state.stageHandoff.value), handoff)
    assert.equal(t.state.songReadModelDetail.value.witness, 'cached')
    assert.deepEqual(t.requests, [])
  }
  // Song-stage entry ignores incomplete, foreign, or no-longer-current detail events.
  for (const target of [null, {}, { songCode: 'wrong', choreographyId: 'sample' }, { songCode: 'brndnf' }]) {
    const t = fixture()
    await t.openSongStage(target)
    assert.equal(t.state.view.value, 'song_detail')
    assert.deepEqual(t.calls, [])
    assert.deepEqual(t.requests, [])
  }
  {
    const t = fixture('song_catalog')
    await t.openSongStage({ songCode: 'brndnf', choreographyId: 'sample' })
    assert.deepEqual(t.calls, [])
  }
  // Moving between the two immersive tools keeps the original archive source.
  for (const initialView of ['spine_lab', 'chibi_stage']) {
    const t = fixture(initialView)
    t.state.detailSourceRoute.value = '?view=song_detail&song=brndnf'
    await t.openSpineLab()
    assert.equal(t.state.view.value, 'spine_lab')
    await t.openChibiStage()
    assert.equal(t.state.view.value, 'chibi_stage')
    assert.equal(t.state.detailSourceRoute.value, '?view=song_detail&song=brndnf')
    assert.equal(t.calls.some(call => call[0] === 'capture'), false)
  }
  // A later navigation cancels publication at both asynchronous boundaries.
  for (const boundary of ['module', 'detail']) {
    const t = fixture(), pendingLoad = deferred()
    t.controls[boundary === 'module' ? 'stage' : 'detail'] = () => pendingLoad.promise
    const pending = t.openChibiStage({ songCode: 'brndnf', choreographyId: 'old' })
    await flush()
    t.context.commitView('home')
    pendingLoad.resolve({ id: 'brndnf' }); await pending
    assert.equal(t.state.view.value, 'home')
    assert.equal(t.state.stageTargetId.value, '')
    assert.equal(t.state.songReadModelDetail.value, null)
    assert.equal(t.calls.some(call => call[0] === 'catalog'), false)
    assert.equal(t.state.loading.value, false)
  }
  {
    const t = fixture(), old = deferred()
    t.controls.detail = id => id === 'old' ? old.promise : Promise.resolve({ id })
    const first = t.openChibiStage({ songCode: 'old', choreographyId: 'old-stage' }); await flush()
    await t.openChibiStage({ songCode: 'new', choreographyId: 'new-stage' })
    old.resolve({ id: 'old' }); await first
    assert.equal(t.state.songReadModelDetail.value?.id, 'new')
    assert.equal(t.state.stageTargetId.value, 'new-stage')
    assert.equal(t.state.currentSongId.value, 'new')
  }
  // Current audio-detail failure remains nonfatal; stale failures stay silent.
  {
    const t = fixture()
    t.controls.detail = async () => { throw new Error('controlled audio-detail failure') }
    await t.openChibiStage({ songCode: 'brndnf', choreographyId: 'sample' })
    assert.equal(t.state.view.value, 'chibi_stage')
    assert.equal(t.state.stageTargetId.value, 'sample')
    assert.equal(t.state.songReadModelDetail.value, null)
    assert.equal(t.errors.length, 1)
  }
  for (const opener of ['openSpineLab', 'openChibiStage']) {
    const t = fixture()
    t.controls[opener === 'openSpineLab' ? 'spine' : 'stage'] = async () => { throw new Error('current module failure') }
    await assert.rejects(t[opener](), /current module failure/)
    assert.equal(t.state.view.value, 'song_detail')
    assert.equal(t.state.loading.value, false)
  }
  {
    const t = fixture(), module = deferred()
    t.controls.spine = () => module.promise
    const pending = t.openSpineLab()
    t.context.commitView('home')
    module.resolve(); await pending
    assert.equal(t.state.view.value, 'home')
    assert.equal(t.state.loading.value, false)
  }
  for (const opener of ['openSpineLab', 'openChibiStage']) {
    const t = fixture(), module = deferred()
    t.controls[opener === 'openSpineLab' ? 'spine' : 'stage'] = () => module.promise
    const pending = t[opener]()
    t.context.commitView('home')
    module.reject(new Error('late module failure')); await pending
    assert.equal(t.state.view.value, 'home')
    assert.equal(t.state.loading.value, false)
    assert.equal(t.errors.length, 0)
  }
  {
    const t = fixture(), data = deferred()
    t.controls.detail = () => data.promise
    const pending = t.openChibiStage(); await flush()
    t.navigation.dispose(); data.reject(new Error('late disposed detail')); await pending
    assert.equal(t.state.view.value, 'song_detail')
    assert.equal(t.state.songReadModelDetail.value, null)
    assert.equal(t.errors.length, 0)
    await t.openSpineLab()
    assert.equal(t.calls.some(call => call[0] === 'spine-module'), false)
  }
  // Switching arrangements replaces URL state and clears the one-shot handoff.
  {
    const t = fixture('chibi_stage'), old = deferred(), newest = deferred()
    t.state.stageHandoff.value = { old: true }
    t.controls.detail = id => id === 'first' ? old.promise : newest.promise
    t.updateStageTarget({ songCode: 'first', choreographyId: 'first-stage' })
    t.updateStageTarget({ songCode: 'second', choreographyId: 'second-stage' })
    assert.equal(t.state.stageHandoff.value, null)
    assert.equal(t.state.stageTargetId.value, 'second-stage')
    assert.equal(t.state.currentSongId.value, 'second')
    assert.deepEqual(t.calls.filter(call => call[0] === 'sync'), [
      ['sync', { replace: true, restoreView: false }], ['sync', { replace: true, restoreView: false }],
    ])
    newest.resolve({ id: 'second' }); await flush()
    old.resolve({ id: 'first' }); await flush()
    assert.equal(t.state.songReadModelDetail.value?.id, 'second')
    const previousRequests = t.requests.length
    t.updateStageTarget({ songCode: 'second', choreographyId: 'another-arrangement' })
    assert.equal(t.requests.length, previousRequests)
    assert.equal(t.state.stageTargetId.value, 'another-arrangement')
  }
  for (const invalidation of ['navigation', 'view', 'identity', 'dispose']) {
    const t = fixture('chibi_stage'), data = deferred()
    t.controls.detail = () => data.promise
    t.updateStageTarget({ songCode: 'new', choreographyId: 'new-stage' })
    if (invalidation === 'navigation') t.navigation.invalidate()
    if (invalidation === 'view') t.state.view.value = 'home'
    if (invalidation === 'identity') t.state.currentSongId.value = 'other'
    if (invalidation === 'dispose') t.navigation.dispose()
    data.resolve({ id: 'new' }); await flush()
    assert.equal(t.state.songReadModelDetail.value, null, `${invalidation} revokes target publication`)
  }
  for (const leave of [false, true]) {
    const t = fixture('chibi_stage'), data = deferred()
    t.controls.detail = () => data.promise
    t.updateStageTarget({ songCode: 'new', choreographyId: 'new-stage' })
    if (leave) t.context.commitView('home')
    data.reject(new Error('controlled target failure')); await flush()
    assert.equal(t.state.songReadModelDetail.value, null)
    assert.equal(t.errors.length, leave ? 0 : 1)
  }
  for (const target of [null, {}, { songCode: 'new' }, { choreographyId: 'new-stage' }]) {
    const t = fixture('chibi_stage')
    t.updateStageTarget(target)
    assert.deepEqual(t.calls, [])
    assert.deepEqual(t.requests, [])
  }
  {
    const t = fixture('song_detail')
    t.updateStageTarget({ songCode: 'new', choreographyId: 'new-stage' })
    assert.deepEqual(t.calls, [])
  }
  // Exiting clears handoff and restores the exact source or existing no-source fallbacks.
  {
    const t = fixture('chibi_stage')
    t.state.stageHandoff.value = { old: true }
    t.state.stageTargetId.value = 'sample'
    t.state.detailSourceRoute.value = '?view=song_detail&song=brndnf'
    assert.equal(t.closeArchiveExperiment(), 'restored-source')
    assert.equal(t.state.stageHandoff.value, null)
    assert.equal(t.calls[0][0], 'restore')
    assert.equal(t.calls[0][1], '?view=song_detail&song=brndnf')
    assert.equal(t.calls[0][2], t.context.goHome)
  }
  {
    const t = fixture('chibi_stage')
    t.state.stageTargetId.value = 'sample'
    t.state.stageHandoff.value = { old: true }
    t.closeArchiveExperiment()
    assert.equal(t.state.view.value, 'song_detail')
    assert.equal(t.state.stageTargetId.value, '')
    assert.equal(t.state.currentSongId.value, 'brndnf')
    assert.equal(t.state.stageHandoff.value, null)
    assert.equal(t.calls.some(call => call[0] === 'restore'), false)
  }
  for (const view of ['spine_lab', 'chibi_stage']) {
    const t = fixture(view)
    assert.equal(t.closeArchiveExperiment(), 'restored-home')
    assert.equal(t.calls[0][0], 'restore')
    assert.equal(t.calls[0][2], t.context.goHome)
    assert.equal(t.calls[1][0], 'home')
  }
  console.log('Stage navigation: real App wiring, module/detail ownership, song guards, handoff, target races and exact exit boundaries passed')
} finally {
  console.error = previousError
}
