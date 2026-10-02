import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { DomainRepository } from '../readmodels/runtime/DomainRepository.mjs'
import { studioPresetPresentation } from '../src/presentation/studio-preset-labels.mjs'
import { buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'

// Run the real SFC setup AND client template in Vue's memory renderer. This
// catches positioning before v-if mounts, without claiming Browser acceptance.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const json = path => JSON.parse(read(path))
const dictionary = json('public/data/masterdata/idol_unit_dictionary.json')
const translations = json('public/translations/zh-CN/entities/idols.json')
const material = json('public/data/masterdata/domains/photo_materials.json')
const actors = new Map(['1', '2', '29'].map(id => [id,
  json(`public/data/masterdata/domains/photo_idols/${id}.json`)]))
const rows = [{ id: 'materials', detail: { url: 'materials' } }, ...[...actors.keys()].map(id => ({
  id, idolCode: dictionary.by_numeric_id[id].idol_code,
  nameJa: dictionary.by_numeric_id[id].display_name, detail: { url: id },
}))]
const deferred = () => {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}
const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const hasClass = (item, name) => String(item.props.class || '').split(/\s+/).includes(name)
const renderer = Vue.createRenderer({
  createElement(type) {
    const item = node(type)
    item.scrollIntoView = options => {
      let root = item
      while (root.parent) root = root.parent
      assert.ok(root.scrolls, 'positioning targets a mounted element')
      assert.ok(all(root).some(entry => hasClass(entry, 'domain-layout')), 'busy v-if has mounted the detail tree')
      root.scrolls.push({ item, options })
    }
    return item
  },
  createText: value => node('#text', value), createComment: value => node('#comment', value),
  setText: (item, value) => { item.text = value },
  setElementText: (item, value) => { item.text = value; item.children = [] },
  patchProp: (item, key, previous, value) => { item.props[key] = value },
  insert(item, parent, anchor = null) {
    remove(item)
    const position = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(position < 0 ? parent.children.length : position, 0, item)
    item.parent = parent
  },
  remove, parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
})
let mobile = true
const expectedErrors = []
const context = vm.createContext({ AbortController,
  window: { matchMedia: () => ({ matches: mobile }) },
  console: { ...console, error: (...args) => expectedErrors.push(args) },
})
const emptyComponent = { render: () => null }
const modules = {
  vue: Vue,
  '@lucide/vue': { Camera: emptyComponent, ChevronRight: emptyComponent },
  './DomainMediaPreview.vue': { default: emptyComponent },
  './useArchivePhotoText.js': { archiveText: (kind, value) => value || '', archiveSearchText: (kind, value) => value || '' },
  '../../presentation/studio-preset-labels.mjs': { studioPresetPresentation },
  '../../presentation/ArchiveGeneralTextCore.mjs': { isArchiveResourceDescription: () => false },
  '../../../readmodels/runtime/DomainRepository.mjs': { DomainRepository },
  '../../styles/archive-domains.css': {},
}
const { descriptor } = parse(read('src/components/archive/ArchivePhotoCatalog.vue'))
const source = compileScript(descriptor, { id: 'photo-navigation-test', inlineTemplate: true }).content
const module = new vm.SourceTextModule(source, { context })
await module.link(specifier => {
  assert.ok(Object.hasOwn(modules, specifier), `Unexpected production dependency: ${specifier}`)
  const exports = modules[specifier]
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
  }, { context })
})
await module.evaluate()
const Component = module.namespace.default
const flush = async () => { for (let i = 0; i < 20; i++) { await Promise.resolve(); await Vue.nextTick() } }
function fixture(initial) {
  const root = node('root'); root.scrolls = []
  const state = Vue.reactive({ photoIdol: '1', photoEntity: '', query: '',
    displayIdolName: code => translations.entries[code]?.name || '', ...initial })
  const events = [], loads = [], paused = new Map(), failures = new Set()
  const payload = id => id === 'materials'
    ? { id, view: { materials: material, media: {} } }
    : { id, view: { actor: actors.get(id), media: { idolId: id, entries: {} } } }
  const client = { async load({ url }, { signal } = {}) {
    loads.push({ url, signal })
    if (url === 'index') return { count: rows.length, pages: [{ url: 'page' }] }
    if (url === 'page') return { rows }
    if (failures.has(url)) throw Error('Expected detail failure')
    if (paused.has(url)) await paused.get(url).promise // Deliberately ignores abort: request identity must still protect the view.
    return payload(url)
  } }
  const app = renderer.createApp({ render: () => Vue.h(Component, {
    ...state, client, bootstrap: { domains: { photos: { url: 'index' } } },
    onPhotoEntity: key => { events.push(key); state.photoEntity = key },
  }) })
  app.mount(root)
  return { root, state, events, loads, failures, app,
    pause(id) { const job = deferred(); paused.set(id, job); return job },
  }
}
const selectedKeys = t => all(t.root).filter(item => item.type === 'button' && item.props['aria-pressed'] === true)
const detailTitle = t => text(all(t.root).find(item => item.type === 'h3'))

{
  const t = fixture({ photoEntity: 'spots:2' }); await flush()
  assert.equal(detailTitle(t), material.spots.find(row => row.id === 2).name)
  assert.equal(t.root.scrolls.length, 1, 'spots:2 refresh positions the mounted detail')
  assert.equal(t.events.length, 0, 'an explicit material entity is not replaced')
  const option = all(t.root).find(item => item.type === 'option' && item.props.value === '2')
  assert.equal(option, undefined, 'material tabs do not expose an unrelated actor selector')
  t.app.unmount()
}
for (const kind of ['faces', 'poses']) {
  const t = fixture({ photoEntity: `${kind}:${actors.get('1')[kind][0].id}` }); await flush()
  const option = all(t.root).find(item => item.type === 'option' && item.props.value === '2')
  assert.equal(text(option), translations.entries[dictionary.by_numeric_id['2'].idol_code].name, 'callback changes the label, not the numeric actor value')
  const before = JSON.stringify(actors.get('2'))
  t.state.photoEntity = ''; t.state.photoIdol = '2'; await flush()
  const key = `${kind}:${actors.get('2')[kind][0].id}`
  assert.equal(t.events.at(-1), key); assert.equal(t.state.photoEntity, key)
  assert.ok(selectedKeys(t).some(item => hasClass(item, 'domain-tabs') === false && text(item).includes('01')))
  assert.equal(t.root.scrolls.length, 1, 'canonical actor selection does not move the directory')
  assert.equal(t.loads.filter(job => job.url === '2').length, 1, 'canonical entity feedback does not load the actor again')
  assert.equal(JSON.stringify(actors.get('2')), before, 'source preset data stays immutable')
  const saved = readArchiveRoute(buildArchiveUrl('http://localhost/', {
    view: 'photo_catalog', photoIdol: t.state.photoIdol, photoEntity: t.state.photoEntity,
  }))
  assert.equal(saved.photoEntity, key); assert.equal(saved.photoIdol, '2')
  t.app.unmount()
  const refreshed = fixture({ photoIdol: saved.photoIdol, photoEntity: saved.photoEntity }); await flush()
  assert.equal(refreshed.state.photoEntity, key); assert.equal(refreshed.events.length, 0)
  assert.equal(refreshed.root.scrolls.length, 1, 'refresh with the explicit canonical key positions the detail')
  assert.ok(selectedKeys(refreshed).some(item => text(item) === (kind === 'faces' ? '表情' : '动作')))
  refreshed.app.unmount()
}
{
  const t = fixture({ photoEntity: 'faces:10101001' }); await flush()
  t.state.query = '__no_matching_photo__'; await flush()
  const resultCount = () => text(all(t.root).find(item => hasClass(item, 'domain-count')))
  assert.equal(resultCount(), '0 条资料')
  const scrolls = t.root.scrolls.length
  t.state.photoEntity = ''; t.state.photoIdol = '2'; await flush()
  assert.equal(t.state.query, '__no_matching_photo__'); assert.equal(resultCount(), '0 条资料')
  assert.equal(t.state.photoEntity, 'faces:10201002', 'actor selection still saves a canonical key with an empty filtered directory')
  assert.equal(t.root.scrolls.length, scrolls, 'an empty filtered directory stays in place when its canonical key is saved')
  assert.ok(all(t.root).some(item => text(item) === '没有匹配的资料。'))
  t.app.unmount()
}
{
  const t = fixture({ photoIdol: '2', photoEntity: 'faces:10201002', displayIdolName: () => '' }); await flush()
  const option = all(t.root).find(item => item.type === 'option' && item.props.value === '2')
  assert.equal(text(option), dictionary.by_numeric_id['2'].display_name, 'missing translation retains the original name and value')
  assert.equal(t.events.length, 0); t.app.unmount()
}
{
  const t = fixture({ photoEntity: 'faces:10101001' }); await flush()
  const old = t.pause('2')
  t.state.photoEntity = ''; t.state.photoIdol = '2'; await flush()
  const signal = t.loads.find(job => job.url === '2').signal
  t.state.photoEntity = ''; t.state.photoIdol = '29'; await flush()
  assert.equal(signal.aborted, true); assert.equal(t.state.photoEntity, 'faces:12901029')
  const events = t.events.length, scrolls = t.root.scrolls.length
  old.resolve(); await flush()
  assert.equal(t.events.length, events); assert.equal(t.root.scrolls.length, scrolls)
  assert.equal(t.state.photoEntity, 'faces:12901029', 'late actor 2 cannot replace actor 29')
  t.app.unmount()
}
{
  const t = fixture({ photoEntity: 'poses:10101' }); await flush()
  t.failures.add('2'); t.state.photoEntity = ''; t.state.photoIdol = '2'; await flush()
  assert.equal(t.events.length, 0); assert.equal(t.root.scrolls.length, 1)
  assert.ok(all(t.root).some(item => item.props.role === 'alert'))
  t.failures.clear()
  const retry = all(t.root).find(item => item.type === 'button' && text(item) === '重试')
  await retry.props.onClick(); await flush()
  assert.equal(t.state.photoEntity, 'poses:10201'); assert.equal(t.root.scrolls.length, 1, 'retry canonical selection does not move the directory')
  assert.equal(expectedErrors.length, 1)
  const leaving = t.pause('29'); t.state.photoEntity = ''; t.state.photoIdol = '29'; await flush()
  const events = t.events.length, scrolls = t.root.scrolls.length
  t.app.unmount(); leaving.resolve(); await flush()
  assert.equal(t.events.length, events); assert.equal(t.root.scrolls.length, scrolls, 'unmounted requests cannot position or publish selection')
}
mobile = false
{
  const t = fixture({ photoEntity: 'spots:2' }); await flush()
  assert.equal(t.root.scrolls.length, 0, 'desktop keeps its two-column position')
  t.app.unmount()
}
console.log('Photo catalog: actual SFC mount-before-position, explicit-key refresh, faces:10201002/poses:10201 actor selection without added scrolling or reload, empty-search preservation, translated labels with original values, late request/abort, failure/retry and unmount protections passed. Memory-renderer evidence; Browser acceptance is separate.')
