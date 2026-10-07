import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { DomainRepository } from '../readmodels/runtime/DomainRepository.mjs'
import { eventResources } from '../src/data/eventResourceGraph.js'
import { eventKindLabels, historicalDate } from '../src/presentation/DomainPresentation.mjs'
import * as CatalogIdolScope from '../src/presentation/CatalogIdolScope.js'
import { normalizeEventBrowseState } from '../src/core/EventCatalogRouteState.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { buildArchiveUrl, readArchiveRoute, buildArchiveSourceQuery, readArchiveSourceRoute } from '../src/core/archiveRoute.js'
import { buildArchiveViewContext, saveArchiveViewRestoration, restoreArchiveViewState } from '../src/core/archiveViewRestoration.js'

// Execute the actual SFC setup/template, model directives and App callbacks.
// Synthetic catalog rows and memory-renderer geometry are contract evidence;
// real layout, focus timing and network-delay acceptance remain Browser work.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const appSource = read('src/App.vue')
const production = name => {
  const source = appSource.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0]
  assert.ok(source, `${name}: production handler exists`)
  return source
}
const roundTrip = route => readArchiveRoute(buildArchiveUrl('http://localhost/', route))
const browse = { kind: 'theater', sort: 'oldest', page: 1 }
const route = roundTrip({ view: 'event_catalog', eventBrowse: browse, query: 'Fixture event' })
assert.deepEqual(route.eventBrowse, browse)
assert.deepEqual(readArchiveSourceRoute(buildArchiveSourceQuery(route)).eventBrowse, browse)
assert.deepEqual(readArchiveRoute('http://localhost/?view=event_catalog').eventBrowse, { kind: '', sort: 'newest', page: 0 })
for (const value of [-1, 1.5, 'NaN', Infinity]) assert.equal(normalizeEventBrowseState({ page: value }).page, 0)
assert.equal(normalizeEventBrowseState({ page: 10001 }).page, 10000)
assert.deepEqual(normalizeEventBrowseState({ kind: 'fixed_unit_event', sort: 'title' }), { kind: '', sort: 'newest', page: 0 })
assert.deepEqual(normalizeEventBrowseState(null), { kind: '', sort: 'newest', page: 0 })
const story = roundTrip({ view: 'story_catalog', storyType: 'event', eventScope: 'fixed_unit_event', sort: 'latest', eventBrowse: browse })
assert.equal(story.sort, 'latest'); assert.equal(story.eventScope, 'fixed_unit_event'); assert.equal(story.eventBrowse, undefined)
const unrelated = buildArchiveUrl('http://localhost/?view=event_catalog&event_kind=tour&event_sort=oldest&event_page=2&debug=1', { view: 'cards' })
for (const key of ['event_kind', 'event_sort', 'event_page']) assert.equal(unrelated.searchParams.has(key), false)
assert.equal(unrelated.searchParams.get('debug'), '1')

const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null, listeners: {} })
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const hasClass = (item, name) => String(item.props.class || '').split(/\s+/).includes(name)
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const renderer = Vue.createRenderer({
  createElement(type) {
    const item = node(type)
    item.scrollTop = 0; item.clientHeight = 100
    Object.defineProperty(item, 'scrollHeight', { get: () => 100 + all(item).filter(entry => hasClass(entry, 'event-item')).length * 50 })
    item.addEventListener = (name, handler) => { item.listeners[name] = handler }
    Object.defineProperty(item, 'options', { get: () => all(item).filter(entry => entry.type === 'option') })
    Object.defineProperty(item, 'selectedIndex', {
      get: () => item.options.findIndex(option => option.selected),
      set: value => item.options.forEach((option, index) => { option.selected = index === value }),
    })
    item.focus = options => {
      let root = item; while (root.parent) root = root.parent
      root.activeElement = item; root.focuses.push({ item, options })
    }
    return item
  },
  createText: value => node('#text', value), createComment: value => node('#comment', value),
  setText: (item, value) => { item.text = value },
  setElementText: (item, value) => { item.text = value; item.children = [] },
  patchProp: (item, key, _previous, value) => { item.props[key] = value; if (key === 'value') item.value = value },
  insert(item, parent, anchor = null) {
    remove(item)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, item); item.parent = parent
  },
  remove, parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
})
const errors = []
const componentContext = vm.createContext({ AbortController, console: { ...console, error: (...args) => errors.push(args) } })
const empty = { render: () => null }
const passthrough = { inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() }
const modules = {
  vue: Vue, '@lucide/vue': { ChevronRight: empty }, './EventResourceImage.vue': { default: empty },
  './DomainPresentation.mjs': { eventKindLabels, historicalDate },
  '../../../readmodels/runtime/DomainRepository.mjs': { DomainRepository },
  '../../data/eventResourceGraph.js': { eventResources },
  // Real scope filter; child shells render their slot so the filter controls stay under test.
  '../../presentation/CatalogIdolScope.js': { ...CatalogIdolScope },
  './ArchiveFilterSheet.vue': { default: passthrough }, './ArchiveCatalogScope.vue': { default: empty },
}
const { descriptor } = parse(read('src/components/archive/ArchiveEventCatalog.vue'))
const module = new vm.SourceTextModule(compileScript(descriptor, { id: 'event-catalog-navigation', inlineTemplate: true }).content, { context: componentContext })
await module.link(specifier => {
  assert.ok(Object.hasOwn(modules, specifier), `Unexpected production dependency: ${specifier}`)
  const exports = modules[specifier]
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
  }, { context: componentContext })
})
await module.evaluate()
const Component = module.namespace.default
const flush = async () => { for (let i = 0; i < 24; i++) { await Promise.resolve(); await Vue.nextTick() } }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const rows = Array.from({ length: 80 }, (_, index) => ({
  id: String(index + 1), event_code: `fixture-${index + 1}`, title: `Fixture event ${index + 1}`,
  eventKind: index < 60 ? 'theater' : 'tour', release_at: index + 1, detail: { url: `detail-${index + 1}` },
}))
function fixture(initial = {}, { delayed = false, fail = false, saved = null, leaveOnReady = false } = {}) {
  const state = useArchiveNavigationState()
  state.view.value = 'event_catalog'; state.currentEventBrowseState.value = normalizeEventBrowseState(initial.eventBrowse || browse)
  state.filterQuery.value = initial.query ?? 'Fixture event'
  const root = node('root'); root.focuses = []; root.activeElement = null
  const storageValues = new Map(), storage = { getItem: key => storageValues.get(key) || null, setItem: (key, value) => storageValues.set(key, value) }
  const document = {
    querySelector: () => all(root).find(item => hasClass(item, 'event-catalog')),
    querySelectorAll: () => all(root).filter(item => item.props['data-archive-focus-id']).map(item => {
      item.dataset = { archiveFocusId: item.props['data-archive-focus-id'] }; return item
    }),
  }
  let revision = 0, disposed = false, failure = fail, gate = delayed ? deferred() : null
  const loads = [], writes = [], restores = [], browseEvents = [], readyEvents = [], openEvents = []
  const window = { location: { href: buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).href }, history: { state: { sidemArchiveEntryId: 'entry-fixture' } } }
  const context = vm.createContext({
    ...state, window, nextTick: Vue.nextTick, normalizeEventBrowseState, buildArchiveViewContext,
    archiveRouteReady: true, archiveViewRestoreRevision: 0, activeArchiveViewContext: null, pendingEventCatalogRestore: null, pendingPhotoCatalogRestore: null,
    loading: { value: false }, console, pendingEventNavigation: 0,
    eventReadModelStatus: { value: '' }, eventReadModelDetail: { value: null },
    navigation: { getRevision: () => revision, invalidate: () => revision++, isDisposed: () => disposed, isRestoring: () => false },
    writeArchiveRoute(value, options) {
      window.location.href = buildArchiveUrl(window.location.href, value).href
      writes.push({ route: readArchiveRoute(window.location.href), options })
    },
    restoreArchiveViewState: value => { restores.push(value); return restoreArchiveViewState(value, { root: document, storage }) },
    buildArchiveSourceQuery, readArchiveSourceRoute, prepareArchivePage: (_view, value) => value,
    loadEventDetail: async id => ({ id }), commitView: view => { state.view.value = view },
    openStoryCatalog: () => { state.view.value = 'story_catalog' },
    applyArchiveRoute: async value => {
      // This boundary delegates to the exact production assignments; full
      // applyArchiveRoute execution is covered by verify-archive-async-navigation.
      vm.runInContext(appSource.match(/    filterQuery.value = route.query \|\| ''/)[0], vm.createContext({ ...state, route: value }))
      vm.runInContext(appSource.match(/    currentEventBrowseState.value = normalizeEventBrowseState\(route.eventBrowse\)/)[0], vm.createContext({ ...state, route: value, normalizeEventBrowseState }))
      state.view.value = value.view
    },
  })
  for (const name of ['adoptArchiveViewContext', 'syncArchiveRoute', 'updateArchiveFilter', 'updateEventBrowse', 'updateEventCatalogQuery', 'onEventCatalogReady', 'captureDetailSource', 'openEventDetail', 'goBackFromEvent', 'restoreDetailSource']) vm.runInContext(production(name), context)
  if (saved) saveArchiveViewRestoration(buildArchiveViewContext(window.location.href, window.history.state), saved, storage)
  const client = { async load({ url }, { signal } = {}) {
    loads.push({ url, signal })
    if (url === 'index') {
      if (gate) await gate.promise // Ignore abort deliberately; request identity must protect publication.
      if (failure) throw Error('Expected catalog failure')
      return { count: rows.length, pages: [{ url: 'page' }] }
    }
    return { rows }
  } }
  const app = renderer.createApp({ render: () => state.view.value === 'event_catalog' ? Vue.h(Component, {
    // Passed explicitly: a cross-realm Function default would be invoked as a factory.
    idolName: () => '',
    client, bootstrap: { domains: { events: { url: 'index' } } }, query: state.filterQuery.value, browseState: state.currentEventBrowseState.value,
    onQuery: context.updateEventCatalogQuery,
    onBrowse: value => { browseEvents.push(value); context.updateEventBrowse(value) },
    onReady: () => {
      readyEvents.push('ready')
      const pending=context.onEventCatalogReady()
      if(leaveOnReady){revision++;state.view.value='home';context.adoptArchiveViewContext()}
      return pending
    },
    onOpenEvent: value => { openEvents.push(value); return context.openEventDetail(value, 'event_catalog') },
  }) : null })
  app.mount(root); context.adoptArchiveViewContext()
  return { root, state, context, app, loads, writes, restores, browseEvents, readyEvents, openEvents, window,
    finish() { gate?.resolve(); gate = null }, retry() { failure = false; gate = null },
    leave() { revision++; state.view.value = 'home'; context.adoptArchiveViewContext() },
    dispose() { disposed = true; app.unmount() },
  }
}
const items = t => all(t.root).filter(item => hasClass(item, 'event-item'))
const firstId = t => items(t)[0]?.props['data-archive-focus-id']
const input = t => all(t.root).find(item => item.type === 'input')
function select(t, index, value) {
  const item = all(t.root).filter(entry => entry.type === 'select')[index]
  item.options.forEach(option => { option.selected = option.value === value })
  item.listeners.change({ target: item })
}

{
  const t = fixture({}, { delayed: true, saved: { scrollTop: 315, focusId: 'event:25' } }); await flush()
  assert.equal(t.state.currentEventBrowseState.value.page, 1); assert.equal(t.browseEvents.length, 0)
  assert.ok(text(t.root).includes('—历史活动')); assert.ok(text(t.root).includes('正在读取…'))
  assert.equal(t.root.focuses.length, 0)
  t.finish(); await flush()
  assert.equal(firstId(t), 'event:25'); assert.equal(t.state.currentEventBrowseState.value.page, 1)
  assert.equal(t.root.focuses.at(-1)?.item.props['data-archive-focus-id'], 'event:25')
  assert.equal(all(t.root).find(item => hasClass(item, 'event-catalog')).scrollTop, 315)
  const restored = t.restores.length; await t.context.onEventCatalogReady(); await flush()
  assert.equal(t.restores.length, restored, 'entry readiness is consumed once')
  await items(t)[0].props.onClick(); await flush()
  const detail = readArchiveRoute(buildArchiveUrl('http://localhost/', t.state.currentArchiveRoute()))
  assert.equal(detail.event, '25'); assert.deepEqual(readArchiveSourceRoute(detail.sourceRoute).eventBrowse, browse)
  // A parsed detail URL, rather than leftover local filter memory, owns return.
  t.state.currentEventBrowseState.value=normalizeEventBrowseState();t.state.filterQuery.value=''
  t.state.detailSourceRoute.value=detail.sourceRoute
  await t.context.goBackFromEvent(); await flush()
  assert.deepEqual(t.state.currentEventBrowseState.value, browse); assert.equal(t.state.filterQuery.value, 'Fixture event')
  assert.equal(firstId(t), 'event:25')
  const controlWrites=t.writes.length
  let pagination=all(t.root).find(item=>hasClass(item,'pagination'))
  await pagination.children.find(item=>item.type==='button'&&text(item)==='下一页').props.onClick();await flush()
  assert.equal(t.state.currentEventBrowseState.value.page,2);assert.equal(firstId(t),'event:49')
  pagination=all(t.root).find(item=>hasClass(item,'pagination'))
  await pagination.children.find(item=>item.type==='button'&&text(item)==='上一页').props.onClick();await flush()
  assert.equal(t.state.currentEventBrowseState.value.page,1);assert.equal(firstId(t),'event:25')
  select(t, 1, 'newest'); await flush()
  assert.equal(t.state.currentEventBrowseState.value.page, 0); assert.equal(firstId(t), 'event:60')
  select(t, 0, 'tour'); await flush()
  assert.equal(t.state.currentEventBrowseState.value.page, 0); assert.equal(firstId(t), 'event:80')
  t.context.updateEventBrowse({ ...browse, page: 2 }); await flush()
  input(t).props.onInput({ target: { value: '__no_match__' } }); await flush()
  assert.equal(t.state.currentEventBrowseState.value.page, 0); assert.equal(items(t).length, 0)
  assert.ok(text(t.root).includes('0 条结果')); assert.ok(t.writes.slice(controlWrites).every(write => write.options.replace))
  t.dispose()
}
for (const action of ['query', 'kind', 'sort']) {
  const t = fixture({}, { delayed: true, saved: { scrollTop: 315, focusId: 'event:25' } }); await flush()
  const active = action === 'query' ? input(t) : all(t.root).filter(item => item.type === 'select')[action === 'kind' ? 0 : 1]
  t.root.activeElement = active
  if (action === 'query') active.props.onInput({ target: { value: 'Fixture' } })
  else select(t, action === 'kind' ? 0 : 1, action === 'kind' ? 'tour' : 'newest')
  await flush(); const restores = t.restores.length
  t.finish(); await flush()
  assert.equal(t.restores.length, restores, `${action} while loading cancels the pending entry restoration`)
  assert.equal(t.root.activeElement, active); assert.equal(t.root.focuses.length, 0, 'late ready cannot steal current control focus')
  t.dispose()
}
{
  const t = fixture({ eventBrowse: { ...browse, page: 999 } }, { delayed: true }); await flush()
  assert.equal(t.state.currentEventBrowseState.value.page, 999, 'busy does not clamp a restore request')
  t.finish(); await flush()
  assert.equal(t.state.currentEventBrowseState.value.page, 2); assert.equal(firstId(t), 'event:49')
  // External hydration on an already-mounted component preserves a valid page
  // and clamps only an invalid one after the catalog has successfully loaded.
  t.state.currentEventBrowseState.value = { ...browse, page: 1 }; await flush(); assert.equal(firstId(t), 'event:25')
  t.state.currentEventBrowseState.value = { ...browse, page: 999 }; await flush(); assert.equal(t.state.currentEventBrowseState.value.page, 2)
  t.dispose()
}
{
  const t = fixture({ eventBrowse: { ...browse, page: 1 } }, { fail: true }); await flush()
  assert.equal(t.state.currentEventBrowseState.value.page, 1); assert.equal(t.browseEvents.length, 0); assert.equal(t.readyEvents.length, 0)
  assert.ok(text(t.root).includes('结果暂不可用')); assert.ok(text(t.root).includes('—历史活动'))
  t.retry(); await all(t.root).find(item => item.type === 'button' && text(item) === '重试').props.onClick(); await flush()
  assert.equal(firstId(t), 'event:25'); assert.equal(t.readyEvents.length, 1); assert.equal(errors.length, 1)
  t.dispose()
}
{
  const t=fixture({}, {delayed:true,saved:{scrollTop:315,focusId:'event:25'},leaveOnReady:true});await flush()
  t.finish();await flush()
  assert.equal(t.readyEvents.length,1,'the actual component emitted ready before navigation')
  assert.equal(t.state.view.value,'home');assert.equal(t.root.focuses.length,0,'queued ready fails the view/context/revision checks after exit')
  assert.equal(t.restores.length,2,'only original entry and normal home adoption restored; queued event ready did not')
  t.dispose()
}
{
  const t = fixture({}, { delayed: true, saved: { scrollTop: 315, focusId: 'event:25' } }); await flush()
  t.leave(); await flush(); assert.equal(t.loads[0].signal.aborted, true)
  const restores = t.restores.length
  t.finish(); await flush()
  assert.equal(t.readyEvents.length, 0); assert.equal(t.restores.length, restores); assert.equal(t.root.focuses.length, 0)
  t.dispose()
}
console.log('Event catalog: independent URL/source browse state, actual SFC controlled filters/page and deferred hydration, success-only clamp, failure/retry/abort, actual App one-shot ready restoration and no late focus after control input/exit passed. Memory-renderer evidence; Browser acceptance is separate.')
