import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { bindMobileNavigation } from './lib/mobile-navigation-harness.mjs'
import { bindSongNavigation } from './lib/song-navigation-harness.mjs'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'
import { bindStoryArchiveNavigation } from './lib/story-archive-navigation-harness.mjs'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const binding = body.flatMap(n => n.declarations || []).find(n => n.init?.callee?.name === 'useMobileNavigation')
const names = n => n.type === 'Identifier' ? [n.name] : n.type === 'ObjectPattern' ? n.properties.flatMap(p => names(p.value)) : []
const defined = new Map()
for (const node of body) {
  if (node.type === 'ImportDeclaration') for (const s of node.specifiers) defined.set(s.local.name, -1)
  if (node.type === 'FunctionDeclaration') defined.set(node.id.name, -1)
  for (const d of node.declarations || []) for (const name of names(d.id)) defined.set(name, d.start)
}
for (const p of binding.init.arguments[0].properties) assert.ok(defined.get(p.value.name) < binding.start, `${p.key.name} initialized before mobile factory`)
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function fixture() {
  const data = new Map(), jobs = new Map(), calls = [], loads = []
  const ids = ['001tom', '002sht'], units = ['01jup', '02dra']
  for (const [domain, keys] of [['mobile-idols', ids], ['mobile-units', units]]) {
    const rows = keys.map(id => ({ id, idolCode: id, unitCode: id, name: id, detail: { key: domain + ':' + id } }))
    data.set(domain, { count: 2, pages: [{ key: domain + ':page' }] })
    data.set(domain + ':page', { rows })
    for (const row of rows) data.set(row.detail.key, { id: row.id, view: {
      personalBundles: [], phoneBundles: [{ scenarios: [{ id: 'call', compiled_file: 'phone.json' }] }], randomBundles: [], unitBundles: [],
      cardRefs: [{ card_id: 42, resource_id: row.id + '_sr01', character_id: row.id }],
    } })
  }
  const context = {
    archiveBootstrap: { idols: ids.map(id => ({ id })), domains: Object.fromEntries(['mobile-idols', 'mobile-units'].map(key => [key, { key }])) },
    bootstrapMembership: { unit_membership_by_idol: Object.fromEntries(ids.map((id, i) => [id, { unit_code: units[i] }])) },
    readModelClient: { load: async (descriptor, options = {}) => {
      loads.push({ descriptor, options })
      const value = jobs.has(descriptor.key) ? await jobs.get(descriptor.key).promise : data.get(descriptor.key)
      assert.ok(value, `unexpected descriptor ${descriptor.key}`)
      if (options.expectedId) { assert.equal(descriptor.expectedId, options.expectedId); assert.equal(value.id, options.expectedId) }
      options.validate?.(value); return value
    } },
    captureDetailSource: () => calls.push(['capture']),
    commitView: view => { context.navigation.invalidate(); context.view.value = view; calls.push(['view', view]) },
    commitArchiveSelection: () => calls.push(['selection']),
    openIdolPicker: target => calls.push(['picker', target]), goHome: () => calls.push(['home']),
    loadScenario: (...args) => calls.push(['play', ...args]), loadCardDetail: async id => ({ id }),
  }
  const api = bindMobileNavigation(app, context)
  context.currentCharacterId.value = ids[0]; context.currentMobileMode.value = 'phone'
  context.currentArchiveUnitCode.value = units[0]; context.currentMobileScenarioId.value = 'old'
  return { ...api, context, data, jobs, calls, loads }
}
function restoreFixture() {
  const t = fixture(), c = t.context
  Object.assign(c, { loading: ref(false), loadingPurpose: ref(''), playbackError: ref(''), isDirectScenarioEntry,
    primeArchiveRouteComponent() {}, tracePlayer() {}, adoptArchiveViewContext() {}, writeArchiveRoute() {},
    applyArchiveRoute: async route => { t.calls.push(['apply', route]); c.view.value = route.view },
  })
  bindSongNavigation(app, c).stop(); bindStoryArchiveNavigation(app, c).stop(); bindStoryNavigation(app, c).stop()
  const node = body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'restoreRoute')
  const source = script.slice(node.start, node.end)
  for (const match of source.matchAll(/\+\+(pending\w+)/g)) c[match[1]] = 0
  vm.runInNewContext('let startupRouteNormalized = false; let restoreRequest = 0;\n' + source, c)
  return t
}
const error = console.error
console.error = () => {}
try {
  // Owner identity, selected mode, file-to-record focus and explicit focus precedence.
  const t = fixture(), c = t.context
  await t.openMobileArchive({ idolCode: '001tom', mode: 'phone', scenarioFile: 'phone.json' })
  assert.equal(c.currentMobileScenarioId.value, 'call'); assert.equal(c.currentArchiveUnitCode.value, '01jup')
  assert.deepEqual(t.calls, [['capture'], ['view', 'mobile_archive']])
  await t.openMobileArchive({ idolCode: '002sht', mode: 'invalid', scenarioFile: 'phone.json', scenarioId: 'explicit', fromSection: true })
  assert.equal(c.currentMobileMode.value, 'personal'); assert.equal(c.currentMobileScenarioId.value, 'explicit')
  assert.equal(t.calls.filter(x => x[0] === 'capture').length, 1)
  await t.openMobileArchive({ idolCode: 'missing' }); assert.deepEqual(t.calls.at(-1), ['picker', 'mobile'])
  assert.equal((await t.loadMobileRoute('001tom', 'phone', '02dra')).unitCode, '01jup')
  assert.equal((await t.loadMobileRoute('001tom', 'unit', '02dra')).unitCode, '02dra')
  const count = t.loads.length; await t.loadMobileCatalog('mobile-idols'); assert.equal(t.loads.length, count)
  t.playMobileScenario('phone.json'); t.playRandomTalkTopic({ file: 'random.json', startStep: 4, endStep: 12 })
  assert.deepEqual(t.calls.at(-1), ['play', 'random.json', 'mobile_archive', { startStep: 4, endStep: 12 }])
  const countCalls = t.calls.length; t.playMobileScenario(''); t.playRandomTalkTopic({ file: 'x', startStep: 0 }); assert.equal(t.calls.length, countCalls)
  await t.openMobileCard('42'); assert.equal(c.currentCardId.value, '002sht_sr01')
  c.currentMobileMode.value = 'unit'; await t.openMobileCard(42); assert.equal(c.currentCardId.value, '02dra_sr01')
  const back = body.find(n => n.id?.name === 'goArchiveBack').body.body.find(n => n.declarations?.[0]?.id.name === 'backByView').declarations[0].init.properties.find(p => p.key.name === 'mobile_archive')
  vm.runInNewContext('(' + script.slice(back.value.start, back.value.end) + ')()', c)
  assert.equal(c.currentCharacterId.value, ''); assert.equal(c.currentArchiveUnitCode.value, ''); assert.equal(c.currentMobileScenarioId.value, '')
  assert.deepEqual(t.calls.at(-1), ['home']); t.stop()

  const phone = fixture()
  await phone.openStoryPhone({ file: '001tom_302_2_3_001_01_a.json', characters: ['002sht'] })
  assert.equal(phone.context.currentCharacterId.value, '001tom', 'file owner takes precedence over first speaker')
  assert.equal(phone.context.currentMobileMode.value, 'phone')
  phone.openStoryCommunication({ idol_code: '002sht', kind: 'idol_phone', id: 'followup' }); await flush()
  assert.equal(phone.context.currentCharacterId.value, '002sht'); assert.equal(phone.context.currentMobileScenarioId.value, 'followup')
  phone.stop()

  // All three selectors share one request sequence, including stale failures.
  const selectors = [['selectMobileIdol', '002sht', 'mobile-idols:002sht'], ['setMobileMode', 'personal', 'mobile-idols:001tom'], ['selectMobileUnit', '02dra', 'mobile-units:02dra']]
  for (const [name, arg, key] of selectors) for (const outcome of ['supersede', 'invalidate', 'dispose']) for (const fail of [false, true]) {
    const t = fixture(), c = t.context
    await t.loadMobileCatalog('mobile-idols'); await t.loadMobileCatalog('mobile-units')
    const job = deferred(); t.jobs.set(key, job)
    const old = t[name](arg); await flush()
    if (outcome === 'supersede') {
      const next = name === 'selectMobileUnit' ? ['selectMobileIdol', '001tom'] : selectors[(selectors.findIndex(s => s[0] === name) + 1) % selectors.length]
      await t[next[0]](next[1])
    } else if (outcome === 'invalidate') t.invalidateMobileNavigation()
    else c.navigation.dispose()
    const before = [c.currentCharacterId.value, c.currentMobileMode.value, c.currentArchiveUnitCode.value, c.mobileReadModelStatus.value, t.calls.length]
    if (fail) job.reject(Error('obsolete')); else job.resolve(t.data.get(key))
    await old
    assert.deepEqual([c.currentCharacterId.value, c.currentMobileMode.value, c.currentArchiveUnitCode.value, c.mobileReadModelStatus.value, t.calls.length], before, `${name}/${outcome}/${fail}`)
    t.stop()
  }
  for (const invalid of ['count', 'identity', 'shape', 'abort']) {
    const t = fixture()
    if (invalid === 'count') t.data.get('mobile-idols').count++
    if (invalid === 'identity') t.data.get('mobile-idols:page').rows[0].id = 'unknown'
    if (invalid === 'shape') delete t.data.get('mobile-idols:page').rows[0].name
    const controller = new AbortController(); if (invalid === 'abort') controller.abort()
    await assert.rejects(t.loadMobileCatalog('mobile-idols', { signal: controller.signal }))
    assert.equal(t.context.mobileIdolReadModelCatalog.value, null); t.stop()
  }
  for (const domain of ['mobile-idols', 'mobile-units']) {
    const t = fixture(), id = domain === 'mobile-idols' ? '001tom' : '01jup'
    t.data.get(domain + ':' + id).view = {}
    await assert.rejects(t.loadMobileDetail(domain, id), /shape mismatch/); t.stop()
  }
  // Actual App restore must adopt the prepared route, including fallback and stale cancellation.
  for (const idol of ['001tom', 'unknown']) {
    const t = restoreFixture(); await t.context.restoreRoute({ view: 'mobile_archive', idol, mobileMode: 'phone' })
    const route = t.calls.find(c => c[0] === 'apply')?.[1]
    assert.equal(route?.view, idol === 'unknown' ? 'idol_picker' : 'mobile_archive')
    if (idol === 'unknown') assert.equal(route.pickTarget, 'mobile')
    else assert.equal(t.context.mobileIdolReadModelDetail.value.id, idol)
    t.stop()
  }
  for (const fail of [false, true]) {
    const t = restoreFixture(), job = deferred(); t.jobs.set('mobile-idols:001tom', job)
    const task = t.context.restoreRoute({ view: 'mobile_archive', idol: '001tom' }); await flush()
    t.context.navigation.invalidate()
    if (fail) job.reject(Error('obsolete')); else job.resolve(t.data.get('mobile-idols:001tom'))
    await task; assert.equal(t.context.mobileIdolReadModelDetail.value, null); assert.deepEqual(t.calls, []); t.stop()
  }
} finally { console.error = error }
console.log('Mobile navigation: actual App binding/restore, catalog validation, shared selector races, cancellation, membership, focus, playback and card relations passed')
