import { bindCardNavigation } from './lib/card-navigation-harness.mjs'
import { bindUnitNavigation } from './lib/unit-navigation-harness.mjs'
import { bindIdolFixtureNavigation } from './lib/idol-navigation-harness.mjs'
import { bindHomeNavigation } from './lib/home-navigation-harness.mjs'
import { bindEventNavigation } from './lib/event-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { bindLegacyAliasNavigation } from './lib/legacy-alias-navigation-harness.mjs'
import { bindMobileNavigation } from './lib/mobile-navigation-harness.mjs'
import { bindSongNavigation } from './lib/song-navigation-harness.mjs'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'
import { bindStoryArchiveNavigation } from './lib/story-archive-navigation-harness.mjs'
import { isDirectScenarioEntry, playerReturnRoute } from '../src/core/PlayerEntryRequest.js'
import { ownsArchiveSource } from '../src/core/archiveRoute.js'
import { normalizeEventBrowseState } from '../src/core/EventCatalogRouteState.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const binding = body.flatMap(n => n.declarations || []).find(n => n.init?.callee?.name === 'useLegacyAliasNavigation')
const boundNames = n => n.type === 'Identifier' ? [n.name] : n.type === 'ObjectPattern' ? n.properties.flatMap(p => boundNames(p.value)) : []
const defined = new Map()
for (const n of body) {
  if (n.type === 'ImportDeclaration') for (const s of n.specifiers) defined.set(s.local.name, -1)
  if (n.type === 'FunctionDeclaration') defined.set(n.id.name, -1)
  for (const d of n.declarations || []) for (const name of boundNames(d.id)) defined.set(name, d.start)
}
for (const p of binding.init.arguments[0].properties) assert.ok(defined.get(p.value.name) < binding.start, `${p.key.name} initialized before legacy factory`)
const functionSource = name => { const n = body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); assert.ok(n, name); return script.slice(n.start, n.end) }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const until = async predicate => {
  const deadline = Date.now() + 3000
  while (!predicate()) { assert.ok(Date.now() < deadline, 'fixture boundary not reached'); await new Promise(resolve => setImmediate(resolve)) }
}
function fixture() {
  const calls = [], loads = [], jobs = new Map(), data = new Map()
  const group = { id: 'g1', title: 'First Story' }, episode = { id: 'ep1', title: 'Episode One' }
  const entries = [{ file: 'one.json', searchText: 'First Story' }, { file: 'missing.json', missing: true, searchText: 'Missing' }]
  data.set('legacy-groups:idol:001tom', { id: 'idol:001tom', view: { title: 'Toma', groups: [group] } })
  data.set('legacy-files:g1', { id: 'g1', view: { group, entries, sourceRoute: { categoryId: 'idol', ownerId: '001tom' } } })
  data.set('legacy-files:ep1', { id: 'ep1', view: { group: episode, entries, sourceRoute: { categoryId: 'episode_zero', ownerId: '01jup' } } })
  data.set('legacy-episodes:01jup', { id: '01jup', view: { unit: { unit_code: '01jup', episodes: [episode] } } })
  data.set('legacy-zero:episode_zero', { id: 'episode_zero', view: { units: [{ unit_code: '01jup' }] } })
  const c = {
    archiveBootstrap: { release: 'fixture', idols: [], domains: {} },
    readModelClient: { load: async (descriptor, options) => {
      const domain = descriptor.kind.split('.')[0], id = options.expectedId, key = domain + ':' + id
      assert.equal(descriptor.expectedId, id)
      assert.equal(descriptor.url, `/_catalog/v/fixture/${domain}/detail/${createHash('sha256').update(String(id)).digest('hex').slice(0, 32)}.json`)
      loads.push({ key, options, descriptor })
      const value = jobs.has(key) ? await jobs.get(key).promise : data.get(key)
      assert.ok(value, `unexpected legacy descriptor ${key}`); assert.equal(value.id, id)
      options.validate(value); return value
    } },
    captureDetailSource: () => calls.push(['capture']),
    commitView: view => { c.view.value = view; calls.push(['view', view]) },
    goHome: () => calls.push(['home']), openIdolReadModel: id => calls.push(['idol', id]),
    loadScenario: (...args) => calls.push(['play', ...args]),
  }
  const api = bindLegacyAliasNavigation(app, c)
  c.currentCategoryId.value = 'idol'; c.currentCharacterId.value = '001tom'; c.filterQuery.value = 'old'
  return { ...api, c, calls, loads, jobs, data }
}
function restoreFixture() {
  const t = fixture(), c = t.c
  Object.assign(c, { loading: ref(false), loadingPurpose: ref(''), playbackError: ref(''), isDirectScenarioEntry, playerReturnRoute,
    primeArchiveRouteComponent() {}, tracePlayer() {}, adoptArchiveViewContext() {}, captureActiveArchiveView() {}, writeArchiveRoute() {},
    bootstrapIdolDictionary: { by_idol_code: {} }, normalizeEventBrowseState, ownsArchiveSource,
    stageHandoff: ref(null), archiveHomeIdols: ref([]),
    playbackController: { reset: () => t.calls.push(['reset']), restore: (...args) => t.calls.push(['restore-player', ...args]) },
  })
  bindMobileNavigation(app, c).stop(); bindSongNavigation(app, c).stop()
  bindStoryArchiveNavigation(app, c).stop(); bindStoryNavigation(app, c).stop(); bindEventNavigation(app, c).stop(); bindHomeNavigation(app, c).stop(); bindUnitNavigation(app, c); bindCardNavigation(app, c); bindIdolFixtureNavigation(app, c)
  const source = functionSource('restoreRoute')
  for (const m of source.matchAll(/\+\+(pending\w+)/g)) c[m[1]] = 0
  vm.runInNewContext('let startupRouteNormalized = false; let restoreRequest = 0;\n' + functionSource('applyArchiveRoute') + '\n' + source, c)
  return t
}
const error = console.error
console.error = () => {}
try {
  const t = fixture(), c = t.c
  t.publishLegacyAliasRoute(await t.loadLegacyAliasRoute({ view: 'groups', category: 'idol', idol: '001tom' }))
  assert.equal(c.legacyGroupReadModelDetail.value?.id, 'idol:001tom', 'App publishes groups into the group payload ref')
  assert.equal(c.legacyFileReadModelDetail.value, null, 'publishing groups must not overwrite the file payload')
  c.filterQuery.value = 'FIRST'; assert.equal(t.filteredGroups.value[0]?.id, 'g1'); assert.equal(t.groupTitle.value, 'Toma')
  c.currentCharacterId.value = 'other'; assert.deepEqual(t.filteredGroups.value, []); assert.equal(t.groupTitle.value, '')
  c.currentCharacterId.value = '001tom'
  await t.openGroup({ id: 'g1' }); assert.equal(c.currentGroup.value.id, 'g1'); assert.equal(c.currentEpisodeId.value, ''); assert.equal(c.filterQuery.value, '')
  assert.deepEqual(t.calls, [['capture'], ['view', 'files']])
  c.filterQuery.value = 'first'; assert.equal(t.filteredFileEntries.value.length, 1)
  c.currentGroup.value = { id: 'wrong' }; assert.deepEqual(t.filteredFileEntries.value, [])
  t.openScenarioEntry({ file: 'one.json' }); assert.deepEqual(t.calls.at(-1), ['play', 'one.json'])
  const count = t.calls.length; t.openScenarioEntry({ file: 'missing.json', missing: true }); t.openScenarioEntry(null); assert.equal(t.calls.length, count)
  await t.openUnit({ unit_code: '01jup' }); assert.equal(c.currentUnit.value.unit_code, '01jup'); assert.equal(c.view.value, 'episodes')
  await t.openEpisodeFiles({ id: 'ep1' }); assert.equal(c.currentEpisodeId.value, 'ep1'); assert.equal(c.view.value, 'files')
  t.goBackToFiles(); assert.equal(c.view.value, 'episodes'); assert.equal(c.currentGroup.value, null); assert.equal(c.currentEpisodeId.value, '')
  c.currentGroup.value = { id: 'old' }; c.currentEpisodeId.value = 'old'
  t.goBackToUnits(); assert.equal(c.view.value, 'episode_zero_units'); assert.equal(c.currentUnit.value, null)
  assert.equal(c.currentGroup.value, null); assert.equal(c.currentEpisodeId.value, '')
  t.publishLegacyAliasRoute(await t.loadLegacyAliasRoute({ view: 'episode_zero_units' })); assert.equal(t.episodeZeroUnits.value.length, 1)
  for (const [category, character, target] of [['idol', '001tom', 'idol'], ['idol_chat', '001tom', 'idol_picker'], ['idol_phone', '001tom', 'idol_picker'], ['other', '001tom', 'idols'], ['other', '', 'home']]) {
    c.currentCategoryId.value = category; c.currentCharacterId.value = character; c.detailSourceRoute.value = 'old'
    t.goBackFromGroups(); assert.ok(t.calls.at(-1).includes(target))
    if (target === 'idol_picker') { assert.equal(c.detailSourceRoute.value, ''); assert.equal(c.currentPickTarget.value, 'mobile'); assert.equal(c.currentCharacterId.value, '') }
  }
  for (const [category, card, character, view] of [['cards', 'card', '', 'card_detail'], ['cards', '', '', 'cards'], ['idol', '', '001tom', 'groups'], ['other', '', '', 'groups']]) {
    c.currentCategoryId.value = category; c.currentCardId.value = card; c.currentCharacterId.value = character
    t.goBackToFiles(); assert.equal(c.view.value, view)
  }
  const options = { signal: new AbortController().signal, priority: 'foreground' }
  await t.loadLegacyAliasDetail('legacy-zero', 'episode_zero', options)
  assert.equal(t.loads.at(-1).options.signal, options.signal); assert.equal(t.loads.at(-1).options.priority, 'foreground')
  t.stop()

  // Legacy files require an exact parent category and owner, including player return context.
  for (const view of ['files', 'player']) for (const zero of [false, true]) {
    const t = fixture(), route = { view, returnView: 'files', category: zero ? 'episode_zero' : 'idol', idol: zero ? '' : '001tom', unit: '01jup', group: zero ? 'ep1' : 'g1' }
    const result = await t.loadLegacyAliasRoute(route)
    assert.equal(result.files.id, route.group); assert.ok(zero ? result.episode : result.groups)
    for (const field of ['categoryId', 'ownerId']) {
      const source = t.data.get('legacy-files:' + route.group).view.sourceRoute, old = source[field]
      source[field] = 'wrong'; await assert.rejects(t.loadLegacyAliasRoute(route), /context mismatch/); source[field] = old
    }
    t.stop()
  }
  for (const domain of ['legacy-groups', 'legacy-files', 'legacy-episodes', 'legacy-zero']) {
    const t = fixture(), key = [...t.data.keys()].find(k => k.startsWith(domain + ':')), id = t.data.get(key).id
    t.data.get(key).view = {}; await assert.rejects(t.loadLegacyAliasDetail(domain, id), /shape mismatch/); t.stop()
  }

  const entries = [['openGroup', { id: 'g1' }, 'legacy-files:g1'], ['openUnit', { unit_code: '01jup' }, 'legacy-episodes:01jup'], ['openEpisodeFiles', { id: 'ep1' }, 'legacy-files:ep1']]
  for (let i = 0; i < entries.length; i++) for (const mode of ['next', 'invalidate', 'revision', 'dispose']) for (const fail of [false, true]) {
    const t = fixture(), [name, arg, key] = entries[i], job = deferred(); t.jobs.set(key, job)
    const task = t[name](arg); await until(() => t.loads.length > 0)
    if (mode === 'next') { const [other, input] = entries[(i + 1) % entries.length]; await t[other](input) }
    if (mode === 'invalidate') t.invalidateLegacyAliasNavigation()
    if (mode === 'revision') t.c.navigation.invalidate()
    if (mode === 'dispose') t.c.navigation.dispose()
    const snapshot = () => JSON.stringify([t.c.currentGroup.value, t.c.currentUnit.value, t.c.currentEpisodeId.value, t.c.filterQuery.value, t.c.legacyAliasStatus.value, t.calls])
    const before = snapshot(); if (fail) job.reject(Error('stale')); else job.resolve(t.data.get(key))
    await task; assert.equal(snapshot(), before, `${name}/${mode}/${fail}`); t.stop()
  }

  // App's real restore coordinator and apply phase both retain their alias boundaries.
  for (const route of [{ view: 'groups', category: 'idol', idol: '001tom' }, { view: 'files', category: 'idol', idol: '001tom', group: 'g1' },
    { view: 'episode_zero_units', category: 'episode_zero' }, { view: 'episodes', category: 'episode_zero', unit: '01jup' },
    { view: 'files', category: 'episode_zero', unit: '01jup', group: 'ep1', episode: 'ep1', query: 'First' }]) {
    const t = restoreFixture(); await t.c.restoreRoute(route)
    assert.equal(t.c.view.value, route.view); assert.equal(t.c.currentCategoryId.value, route.category)
    if (route.group) assert.equal(t.c.currentGroup.value.id, route.group)
    if (route.unit) assert.equal(t.c.currentUnit.value.unit_code, route.unit)
    assert.equal(t.c.filterQuery.value, route.query || ''); t.stop()
  }
  for (const category of ['idol', 'episode_zero']) {
    const t = restoreFixture(); await t.c.restoreRoute({ view: 'groups', category, idol: 'missing' })
    assert.equal(t.c.view.value, category === 'episode_zero' ? 'episode_zero_units' : 'home'); assert.match(t.c.legacyAliasStatus.value, /暂时/); t.stop()
  }
  for (const fail of [false, true]) {
    const t = restoreFixture(), key = 'legacy-groups:idol:001tom', job = deferred(); t.jobs.set(key, job)
    const task = t.c.restoreRoute({ view: 'groups', category: 'idol', idol: '001tom' }); await until(() => t.loads.length > 0)
    t.c.navigation.invalidate(); if (fail) job.reject(Error('obsolete')); else job.resolve(t.data.get(key))
    await task; assert.equal(t.c.legacyGroupReadModelDetail.value, null); assert.deepEqual(t.calls, []); t.stop()
  }
  const direct = restoreFixture()
  await direct.c.restoreRoute({ view: 'player', scenario: 'one.json', returnView: 'files', category: 'idol', idol: '001tom', group: 'g1' })
  assert.equal(direct.loads.length, 0, 'raw player does not hydrate the legacy parent')
  assert.equal(direct.calls.at(-1)[0], 'restore-player'); direct.stop()
} finally { console.error = error }
console.log('Legacy alias navigation: App setup/restore/apply, shared races, cancellation, exact parent identity, filters, return branches and direct-player boundary passed')
