import strictAssert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { DomainRepository } from '../readmodels/runtime/DomainRepository.mjs'
import { studioPresetPresentation } from '../src/presentation/studio-preset-labels.mjs'
import * as photoStickerGroups from '../src/presentation/photoStickerGroups.js'
import * as photoSpotScenes from '../src/presentation/photoSpotScenes.js'
import { buildArchiveUrl, readArchiveRoute, buildArchiveSourceQuery, readArchiveSourceRoute, ownsArchiveSource } from '../src/core/archiveRoute.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { usePhotoCatalogNavigation } from '../src/composables/usePhotoCatalogNavigation.js'
import { parse as parseScript } from '@babel/parser'
import { buildArchiveViewContext, captureArchiveViewState, saveArchiveViewRestoration, readArchiveViewRestoration, restoreArchiveViewState } from '../src/core/archiveViewRestoration.js'
const assert = { ...strictAssert, equal(actual, expected, message) {
  if ((actual?.type || expected?.type) && actual !== expected) strictAssert.fail((message || 'Host-node identity differs') + ': ' + (actual?.type || actual) + ' #' + actual?.id + ' vs ' + (expected?.type || expected) + ' #' + expected?.id)
  strictAssert.equal(actual, expected, message)
} }

// Run the real SFC setup AND client template in Vue's memory renderer. This
// covers grid identity, retained controls, native-dialog calls and navigation.
// The memory host models native showModal/close/focus; Browser/GPU is separate.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const json = path => JSON.parse(read(path))
const appSource = read('src/App.vue')
const appScript = parse(appSource).descriptor.scriptSetup.content
const photoBinding = parseScript(appScript, {sourceType:'module'}).program.body
  .filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  .find(node => node.id.type === 'ObjectPattern' && node.id.properties.some(property => property.key.name === 'selectPhotoIdol'))
assert.ok(photoBinding, 'App binds the photo navigation composable')
const production = name => {
  const source=appSource.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0]
  assert.ok(source, `${name}: production handler exists`)
  return source
}
const dictionary = json('public/data/masterdata/idol_unit_dictionary.json')
const translations = json('public/translations/zh-CN/entities/idols.json')
const material = json('public/data/masterdata/domains/photo_materials.json')
const materialMedia = json('public/data/masterdata/domains/photo_media.json').entries
const actors = new Map(['1', '2', '29'].map(id => [id,
  json(`public/data/masterdata/domains/photo_idols/${id}.json`)]))
const actorMedia = new Map([...actors.keys()].map(id => [id,
  json(`public/data/masterdata/domains/photo_media_idols/${id}.json`)]))
const rows = [{ id: 'materials', detail: { url: 'materials' } }, ...[...actors.keys()].map(id => ({
  id, idolCode: dictionary.by_numeric_id[id].idol_code,
  nameJa: dictionary.by_numeric_id[id].display_name, detail: { url: id },
}))]
const deferred = () => {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}
let nodeId = 0
const node = (type, text = '') => Vue.markRaw({ type, text, props: {}, style: {}, children: [], parent: null,
  id: ++nodeId, [Symbol.for('nodejs.util.inspect.custom')]() { return '<' + this.type + ' #' + this.id + ' ' + (this.dataset?.archiveFocusId || '') + '>' } })
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const hasClass = (item, name) => String(item.props.class || '').split(/\s+/).includes(name)
const rootOf = item => { while (item.parent) item = item.parent; return item }
let activeRoot = null
const renderer = Vue.createRenderer({
  createElement(type) {
    const item = node(type)
    item.scrollTop=0;item.clientHeight=100;item.dataset={}
    // Deterministic populated-grid extent permits restoration tests without pixels.
    Object.defineProperty(item,'scrollHeight',{get:()=>all(item).some(entry=>entry.dataset?.archiveFocusId?.startsWith('photo:'))?1200:100})
    Object.defineProperty(item,'isConnected',{get:()=>rootOf(item).type==='root' && rootOf(item).connected})
    item.closest=()=>{let current=item;while(current&&!current.dataset?.archiveFocusId)current=current.parent;return current}
    item.focus=options=>{let root=item;while(root.parent)root=root.parent;root.activeElement=item;root.focuses.push({item,options})}
    item.open=false
    item.showModal=()=>{item.open=true;const root=rootOf(item);root.dialogOpens.push(item);all(item).find(entry=>entry.type==='button')?.focus()}
    item.close=()=>{if(!item.open)return;item.open=false;rootOf(item).dialogCloses.push(item);item.props.onClose?.()}
    item.getBoundingClientRect=()=>({left:0,right:400,top:0,bottom:600})
    item.querySelectorAll=selector=>{
      assert.equal(selector,'[data-archive-focus-id]','close focus uses declared typed focus markers')
      return all(item).filter(entry=>entry.dataset?.archiveFocusId)
    }
    item.scrollIntoView = options => {
      let root = item
      while (root.parent) root = root.parent
      assert.ok(root.scrolls, 'positioning targets a mounted element')
      root.scrolls.push({ item, options })
    }
    return item
  },
  createText: value => node('#text', value), createComment: value => node('#comment', value),
  setText: (item, value) => { item.text = value },
  setElementText: (item, value) => { item.text = value; item.children = [] },
  patchProp: (item, key, previous, value) => { item.props[key] = value;if(key==='data-archive-focus-id')item.dataset.archiveFocusId=value },
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
const context = vm.createContext({ AbortController, setTimeout, clearTimeout,
  window: { matchMedia: () => ({ matches: mobile }) },
  document: { get activeElement(){return activeRoot?.activeElement || null} },
  console: { ...console, error: (...args) => expectedErrors.push(args) },
})
const emptyComponent = { render: () => null }
const modules = {
  vue: Vue,
  '@lucide/vue': { Camera: emptyComponent, SlidersHorizontal: emptyComponent, ImageOff: emptyComponent, X: emptyComponent },
  './useArchivePhotoText.js': { archiveText: (kind, value) => value || '', archiveSearchText: (kind, value) => value || '', loadArchivePhotoNames: () => {} },
  '../../presentation/studio-preset-labels.mjs': { studioPresetPresentation },
  '../../presentation/photoStickerGroups.js': { ...photoStickerGroups },
  '../../presentation/photoSpotScenes.js': { ...photoSpotScenes },
  '../../presentation/ArchiveGeneralTextCore.mjs': { isArchiveResourceDescription: () => false },
  '../../../readmodels/runtime/DomainRepository.mjs': { DomainRepository },
  '../../styles/archive-domains.css': {},
}
async function component(file) {
  const { descriptor } = parse(read(file))
  const source = compileScript(descriptor, { id: file, inlineTemplate: true }).content
  const module = new vm.SourceTextModule(source, { context })
  await module.link(specifier => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected production dependency: ${specifier}`)
    const exports = modules[specifier]
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace.default
}
modules['./DomainMediaPreview.vue']={default:await component('src/components/archive/DomainMediaPreview.vue')}
modules['./terminal/ArchiveTerminalDialog.vue']={default:await component('src/components/archive/terminal/ArchiveTerminalDialog.vue')}
modules['./ArchivePhotoDetailDialog.vue']={default:await component('src/components/archive/ArchivePhotoDetailDialog.vue')}
const Component=await component('src/components/archive/ArchivePhotoCatalog.vue')
const flush = async () => { for (let i = 0; i < 20; i++) { await Promise.resolve(); await Vue.nextTick() } }
function fixture(initial, {saved=null,leaveOnReady=false,disposeOnReady=false,queryOnReady=false}={}) {
  const root = node('root'); root.scrolls=[];root.focuses=[];root.dialogOpens=[];root.dialogCloses=[];root.activeElement=null;root.connected=true;activeRoot=root
  const navigationState=useArchiveNavigationState()
  navigationState.view.value='photo_catalog';navigationState.currentPhotoIdol.value='1'
  const state = Vue.reactive({ photoIdol: navigationState.currentPhotoIdol, photoEntity: navigationState.currentPhotoEntity, query: navigationState.filterQuery,
    displayIdolName: code => translations.entries[code]?.name || '' })
  Object.assign(state,initial)
  const events = [], loads = [], ready=[], restores=[],writes=[],paused = new Map(), failures = new Set(), payloadOverrides=new Map()
  let revision=0,disposed=false
  const window={location:{href:buildArchiveUrl('http://localhost/',navigationState.currentArchiveRoute()).href},history:{state:{sidemArchiveEntryId:'photo-entry'}}}
  const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}
  const document={get activeElement(){return root.activeElement},querySelector:()=>all(root).find(item=>Object.hasOwn(item.props,'data-archive-scroll-container')),querySelectorAll:()=>all(root).filter(item=>item.dataset?.archiveFocusId)}
  const parent=vm.createContext({
    ...navigationState,window,nextTick:Vue.nextTick,archiveRouteReady:true,archiveViewRestoreRevision:0,adoptedArchiveView:"",
    activeArchiveViewContext:null,pendingEventCatalogRestore:null,pendingPhotoCatalogRestore:null,
    buildArchiveViewContext,buildArchiveSourceQuery,readArchiveSourceRoute,ownsArchiveSource,
    loading:{value:false},loadingPurpose:{value:''},playbackController:{reset:()=>{}},primeArchiveRouteComponent:()=>{},
    navigation:{getRevision:()=>revision,invalidate:()=>revision++,isDisposed:()=>disposed,isRestoring:()=>false},console,
    writeArchiveRoute(route,options){window.location.href=buildArchiveUrl(window.location.href,route).href;writes.push({route:readArchiveRoute(window.location.href),options})},
    captureArchiveViewState:value=>captureArchiveViewState(value,{root:document,storage}),
    readArchiveViewRestoration:value=>readArchiveViewRestoration(value,storage),
    restoreArchiveViewState:value=>{restores.push(value);return restoreArchiveViewState(value,{root:document,storage})},
    goHome:()=>{navigationState.view.value='home'},
    applyArchiveRoute:async route=>{
      // Delegate this boundary to production assignments. Full App route
      // preparation is exercised separately by archive async navigation tests.
      revision++
      const context=vm.createContext({...navigationState,route,ownsArchiveSource})
      for(const assignment of [
        /    filterQuery.value = route.query \|\| ''/,
        /    currentPhotoIdol.value = route.photoIdol \|\| ''/,
        /    currentPhotoEntity.value = route.photoEntity \|\| ''/,
        /    detailSourceRoute.value = ownsArchiveSource\(route.view, route.returnView\) \? \(route.sourceRoute \|\| ''\) : ''/,
      ])vm.runInContext(appSource.match(assignment)[0],context)
      navigationState.view.value=route.view
    },
  })
  for(const name of ['captureActiveArchiveView','adoptArchiveViewContext','syncArchiveRoute','commitView','onPhotoCatalogReady','captureDetailSource','restoreDetailSource','closeFullScreenExperiment'])vm.runInContext(production(name),parent)
  parent.usePhotoCatalogNavigation = usePhotoCatalogNavigation
  Object.assign(parent, vm.runInContext(appScript.slice(photoBinding.init.start, photoBinding.init.end),parent))
  if(saved)saveArchiveViewRestoration(buildArchiveViewContext(window.location.href,window.history.state),saved,storage)
  const payload = id => id === 'materials'
    ? { id, view: { materials: material, media: materialMedia } }
    : { id, view: { actor: actors.get(id), media: actorMedia.get(id) } }
  const client = { async load({ url }, { signal } = {}) {
    loads.push({ url, signal })
    if (url === 'index') return { count: rows.length, pages: [{ url: 'page' }] }
    if (url === 'page') return { rows }
    if (failures.has(url)) throw Error('Expected detail failure')
    if (paused.has(url)) await paused.get(url).promise // Deliberately ignores abort: request identity must still protect the view.
    return payloadOverrides.get(url)||payload(url)
  } }
  const app = renderer.createApp({ render: () => navigationState.view.value==='photo_catalog'?Vue.h(Component, {
    ...state, client, bootstrap: { domains: { photos: { url: 'index' } } },
    onPhotoEntity: key => { events.push(key); parent.selectPhotoEntity(key) },
    onPhotoIdol:parent.selectPhotoIdol,onQuery:parent.updatePhotoCatalogQuery,
    onOpenStudio:parent.openPictureStudio,
    onReady:()=>{
      ready.push('ready');const pending=parent.onPhotoCatalogReady()
      if(leaveOnReady){revision++;navigationState.view.value='home';parent.adoptArchiveViewContext()}
      if(disposeOnReady){disposed=true;app.unmount()}
      if(queryOnReady){root.activeElement=all(root).find(item=>item.type==='input');parent.updatePhotoCatalogQuery('__no_matching_photo__')}
      return pending
    },
  }):null })
  app.mount(root)
  parent.adoptArchiveViewContext()
  return { root, state, events, loads, failures, app,ready,restores,writes,parent,payloadOverrides,navigationState,window,
    leave(){parent.commitView('home')},dispose(){disposed=true;root.connected=false;app.unmount()},
    pause(id) { const job = deferred(); paused.set(id, job); return job },
  }
}
const dialog = t => all(t.root).find(item => item.type === 'dialog' && item.open)
const gridButtons = t => all(t.root).filter(item => item.type === 'button' && item.dataset?.archiveFocusId?.startsWith('photo:'))
const detailTitle = t => { const heading = dialog(t) && all(dialog(t)).find(item => item.type === 'h2'); return heading ? text(heading) : '' }
const tools = t => ({ input: all(t.root).find(item => item.type === 'input'), select: all(t.root).find(item => item.type === 'select') })
const studioButton = t => dialog(t) && all(dialog(t)).find(item => hasClass(item, 'domain-action'))
const count = t => text(all(t.root).find(item => hasClass(item, 'domain-count')))
const tabButton = (t, label) => all(t.root).find(item => item.type === 'button' && text(item).trim() === label)
const activeTab = t => all(all(t.root).find(item => item.type === 'nav' && item.props['aria-label'] === '摄影分类')).find(item => item.type === 'button' && item.props['aria-pressed'] === true)
const closeButton = t => dialog(t) && all(dialog(t)).find(item => item.type === 'button' && item.props['aria-label'] === '关闭')
const clickGrid = async (t, key) => {
  const row = gridButtons(t).find(item => item.dataset.archiveFocusId === 'photo:' + key)
  assert.ok(row, 'exact typed grid entry is visible: ' + key)
  row.focus(); row.props.onClick(); await flush()
  return row
}
// Scenes are a spot's time-of-day variants and open inside their spot, so they have no tab of their own.
const kinds = [['spots', '地点'], ['faces', '表情'], ['poses', '动作'], ['stickers', '贴纸'], ['frames', '相框'], ['filters', '滤镜']]
const sourceSnapshot = JSON.stringify([material, materialMedia, [...actors], [...actorMedia]])

{
  const t = fixture({ photoEntity: '' }); await flush()
  assert.equal(dialog(t), undefined, 'default directory does not open the first entry')
  assert.equal(gridButtons(t).length, 25)
  assert.equal(count(t), material.spots.length + ' 条资料')
  assert.deepEqual(all(all(t.root).find(item => item.props['aria-label'] === '摄影分类')).filter(item => item.type === 'button').map(text), kinds.map(row => row[1]))
  tabButton(t, '下一页').props.onClick(); await flush()
  assert.equal(gridButtons(t)[0].dataset.archiveFocusId, 'photo:spots:' + material.spots[25].id)
  assert.equal(dialog(t), undefined, 'pagination is not a selection')
  t.dispose()
}
for (const [kind, label] of kinds) {
  const t = fixture({ photoEntity: '' }); await flush()
  tabButton(t, label).props.onClick(); await flush()
  assert.equal(text(activeTab(t)), label)
  assert.equal(dialog(t), undefined, 'automatic tab identity stays quiet: ' + kind)
  const data = ['faces', 'poses'].includes(kind) ? actors.get('1')[kind] : material[kind]
  assert.equal(count(t), data.length + ' 条资料')
  assert.equal(gridButtons(t).length, Math.min(25, data.length))
  const row = data[0], key = kind + ':' + row.id
  const opener = await clickGrid(t, key)
  assert.ok(dialog(t), 'user selection opens a native dialog: ' + kind)
  assert.equal(opener.props['aria-pressed'], true)
  // A spot reaches the studio through one of its own scenes (the one showing the spot's picture).
  if (kind === 'spots' && material.sceneIdsBySpotId[row.id]?.length) assert.ok(material.sceneIdsBySpotId[row.id].map(id => 'photo-studio:scenes:' + id).includes(studioButton(t).dataset.archiveFocusId), 'spot opens the studio on one of its scenes')
  else assert.equal(studioButton(t).dataset.archiveFocusId, 'photo-studio:' + key)
  const binding = ['faces', 'poses'].includes(kind) ? actorMedia.get('1').entries[key] : materialMedia[key]
  const thumb = all(opener).find(item => item.type === 'img')
  // Background tiles show the game's own small thumbnail of the bound picture (photoBackgroundThumbnailUrl).
  if (binding?.image?.url) assert.equal(thumb.props.src, kind === 'spots' ? photoSpotScenes.photoBackgroundThumbnailUrl(binding.image.url) : binding.image.url, 'grid uses exact thumbnail binding')
  else assert.equal(thumb, undefined, 'unbound filters do not invent an image')
  const preview = all(dialog(t)).find(item => hasClass(item, 'photo-detail-preview'))
  const previewImg = preview && all(preview).find(item => item.type === 'img')
  const expected = kind === 'stickers' && binding?.full?.url ? binding.full : binding?.image
  if (expected?.url) assert.equal(previewImg.props.src, expected.url, 'detail uses actual full sticker or source preview')
  else assert.equal(previewImg, undefined)
  if (kind === 'frames') {
    const section = all(dialog(t)).find(item => hasClass(item, 'photo-frame-layers'))
    assert.deepEqual(all(section).filter(item => item.type === 'img').map(item => item.props.src), binding.layers.map(layer => layer.url), 'both frame layers retain actual URLs')
  }
  closeButton(t).props.onClick(); await flush()
  assert.equal(dialog(t), undefined); assert.equal(t.events.at(-1), '')
  assert.equal(text(activeTab(t)), label, 'closing retains the selected category')
  assert.equal(t.root.activeElement, opener, 'native close returns focus to the actual grid opener')
  assert.equal(t.root.focuses.at(-1).options.preventScroll, true)
  assert.equal(t.root.scrolls.length, 0, 'modal navigation does not scroll the page into a removed inline panel')
  t.dispose()
}
{
  const row = material.spots.at(-1), t = fixture({ photoEntity: 'spots:' + row.id }); await flush()
  assert.equal(detailTitle(t), row.name)
  assert.ok(gridButtons(t).some(item => item.dataset.archiveFocusId === 'photo:spots:' + row.id), 'explicit deep key selects the real directory page')
  assert.equal(t.events.length, 0); assert.equal(t.root.scrolls.length, 0)
  assert.equal(tools(t).select, undefined, 'material categories do not expose an unrelated actor selector')
  t.dispose()
}
{
  const row = material.scenes.find(item => item.id === 29)
  const owner = material.spots.find(item => material.sceneIdsBySpotId[item.id]?.includes(row.id))
  const t = fixture({ photoEntity: 'scenes:29' }); await flush()
  assert.ok(owner); assert.equal(text(activeTab(t)), '地点', 'a scene deep link opens inside its spot')
  assert.ok(text(dialog(t)).includes(owner.name), 'scene context is the actual group FK, not a guessed category')
  assert.ok(text(dialog(t)).includes('场景效果'), 'known weather-effect limitation remains visible')
  assert.equal(studioButton(t).dataset.archiveFocusId, 'photo-studio:scenes:29', 'the studio opens the chosen scene, not the spot default')
  t.state.query = row.name; await flush()
  assert.ok(gridButtons(t).some(item => item.dataset.archiveFocusId === 'photo:spots:' + owner.id), 'spot search includes the names of its scenes')
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'spots:2' }); await flush()
  const id = material.sceneIdsBySpotId[2][0]
  const section = all(dialog(t)).find(item => hasClass(item, 'photo-related-scenes'))
  const related = all(section).find(item => item.type === 'button')
  assert.equal(all(related).find(item => item.type === 'img').props.src, materialMedia['scenes:' + id].image.url)
  related.props.onClick(); await flush()
  assert.equal(t.state.photoEntity, 'scenes:' + id)
  assert.equal(text(activeTab(t)), '地点', 'a related scene stays inside its spot')
  assert.equal(studioButton(t).dataset.archiveFocusId, 'photo-studio:scenes:' + id)
  t.dispose()
}
for (const kind of ['faces', 'poses']) {
  const t = fixture({ photoEntity: kind + ':' + actors.get('1')[kind][0].id }); await flush()
  const original = tools(t)
  const option = all(t.root).find(item => item.type === 'option' && item.props.value === '2')
  assert.equal(text(option), translations.entries[dictionary.by_numeric_id['2'].idol_code].name, 'localized name does not change the numeric actor identity')
  original.select.focus(); original.select.props.onChange({ target: { value: '2' } }); await flush()
  const key = kind + ':' + actors.get('2')[kind][0].id
  assert.equal(t.events.at(-1), key); assert.equal(t.state.photoEntity, key)
  assert.equal(dialog(t), undefined, 'new actor canonical first entry does not auto-open')
  assert.equal(tools(t).input, original.input); assert.equal(tools(t).select, original.select)
  assert.equal(t.root.activeElement, original.select)
  assert.equal(t.loads.filter(job => job.url === '2').length, 1, 'canonical feedback does not reload the actor')
  const saved = readArchiveRoute(buildArchiveUrl('http://localhost/', { view: 'photo_catalog', photoIdol: t.state.photoIdol, photoEntity: key }))
  t.dispose()
  const refreshed = fixture({ photoIdol: saved.photoIdol, photoEntity: saved.photoEntity }); await flush()
  assert.equal(refreshed.events.length, 0); assert.ok(dialog(refreshed), 'explicit refresh key opens its real actor detail')
  assert.equal(studioButton(refreshed).dataset.archiveFocusId, 'photo-studio:' + key)
  refreshed.dispose()
}
{
  const t = fixture({ photoIdol: '2', photoEntity: 'faces:10201002', displayIdolName: () => '' }); await flush()
  assert.equal(text(all(t.root).find(item => item.type === 'option' && item.props.value === '2')), dictionary.by_numeric_id['2'].display_name, 'missing translation retains source name')
  assert.equal(t.events.length, 0); t.dispose()
}
{
  const t = fixture({ photoEntity: 'faces:10101001' }, { saved: { scrollTop: 315, focusId: 'photo-studio:faces:10101001' } })
  const delayed = t.pause('1'); await flush()
  const input = tools(t).input; input.focus()
  input.props.onInput({ target: { value: '__no_matching_photo__' } }); await flush()
  const restores = t.restores.length; delayed.resolve(); await flush()
  assert.equal(tools(t).input, input); assert.equal(t.root.activeElement, input)
  assert.equal(t.restores.length, restores); assert.equal(dialog(t), undefined, 'typing before hydration cancels late modal opening')
  assert.equal(count(t), '0 条资料'); assert.equal(t.state.photoEntity, 'faces:10101001')
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'faces:10101001' }); await flush()
  const original = tools(t), old = t.pause('2'); original.select.focus()
  original.select.props.onChange({ target: { value: '2' } }); await flush()
  assert.equal(count(t), '正在读取…'); assert.equal(dialog(t), undefined)
  assert.ok(text(t.root).includes(translations.entries[dictionary.by_numeric_id['2'].idol_code].name + '的摄影资料'))
  const signal = t.loads.find(job => job.url === '2').signal
  original.input.props.onInput({ target: { value: '__no_matching_photo__' } })
  original.select.props.onChange({ target: { value: '29' } }); await flush()
  assert.equal(signal.aborted, true); assert.equal(t.state.photoEntity, 'faces:12901029')
  assert.equal(count(t), '0 条资料'); assert.equal(dialog(t), undefined)
  assert.equal(tools(t).input, original.input); assert.equal(tools(t).select, original.select)
  const events = t.events.length, ready = t.ready.length
  old.resolve(); await flush()
  assert.equal(t.events.length, events); assert.equal(t.ready.length, ready)
  assert.equal(t.state.photoEntity, 'faces:12901029', 'late actor response cannot impersonate the selected actor')
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'poses:10101' }); await flush()
  const errors = expectedErrors.length
  t.failures.add('2'); tools(t).select.props.onChange({ target: { value: '2' } }); await flush()
  assert.equal(expectedErrors.length, errors + 1); assert.equal(dialog(t), undefined)
  assert.ok(all(t.root).some(item => item.props.role === 'alert')); assert.equal(count(t), '结果暂不可用')
  t.failures.clear()
  await tabButton(t, '重试').props.onClick(); await flush()
  assert.equal(t.state.photoEntity, 'poses:10201'); assert.equal(dialog(t), undefined)
  const leaving = t.pause('29'); tools(t).select.props.onChange({ target: { value: '29' } }); await flush()
  const events = t.events.length, ready = t.ready.length
  t.dispose(); leaving.resolve(); await flush()
  assert.equal(t.events.length, events); assert.equal(t.ready.length, ready, 'unmounted actor request cannot emit selection or ready')
}
for (const mismatch of ['actor', 'media']) {
  const t = fixture({ photoEntity: 'faces:10101001' }); await flush()
  const errors = expectedErrors.length
  t.payloadOverrides.set('2', { id: '2', view: { actor: actors.get(mismatch === 'actor' ? '1' : '2'), media: { idolId: mismatch === 'media' ? '1' : '2', entries: {} } } })
  tools(t).select.props.onChange({ target: { value: '2' } }); await flush()
  assert.equal(expectedErrors.length, errors + 1); assert.equal(t.ready.length, 1); assert.equal(count(t), '结果暂不可用')
  assert.equal(dialog(t), undefined); assert.ok(tools(t).input && tools(t).select)
  t.payloadOverrides.clear(); await tabButton(t, '重试').props.onClick(); await flush()
  assert.equal(t.ready.length, 2); assert.equal(t.state.photoEntity, 'faces:10201002'); assert.equal(dialog(t), undefined)
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'faces:10201002', photoIdol: '1' }); await flush()
  assert.equal(dialog(t), undefined); assert.equal(studioButton(t), undefined)
  assert.ok(text(t.root).includes('当前资料不在此目录中'))
  assert.equal(t.events.length, 0); assert.equal(t.state.photoEntity, 'faces:10201002', 'invalid deep key cannot impersonate the first preset')
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'spots:2' }), delayed = t.pause('1'); await flush()
  tabButton(t, '动作').props.onClick(); await flush()
  assert.equal(dialog(t), undefined); assert.equal(t.state.photoEntity, 'spots:2')
  delayed.resolve(); await flush()
  assert.equal(t.state.photoEntity, 'poses:10101'); assert.equal(text(activeTab(t)), '动作'); assert.equal(dialog(t), undefined, 'a pending tab gets a quiet valid canonical identity')
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'spots:1' }); await flush()
  gridButtons(t).find(item => item.dataset.archiveFocusId === 'photo:spots:1').props.onClick()
  tabButton(t, '贴纸').props.onClick(); await flush()
  assert.equal(t.state.photoEntity, 'stickers:1'); assert.equal(text(activeTab(t)), '贴纸')
  assert.equal(dialog(t), undefined, 'same numeric ID in another typed category cannot reopen old selection')
  assert.equal(t.root.scrolls.length, 0); t.dispose()
}
for (const mode of ['button', 'escape', 'cancel', 'backdrop']) {
  const t = fixture({ photoEntity: '' }); await flush()
  const opener = await clickGrid(t, 'spots:2'), native = dialog(t)
  if (mode === 'button') closeButton(t).props.onClick()
  if (mode === 'escape') native.props.onKeydown({ key: 'Escape', stopPropagation() {}, preventDefault() {} })
  if (mode === 'cancel') native.props.onCancel({})
  if (mode === 'backdrop') native.props.onClick({ target: native, clientX: -1, clientY: -1 })
  await flush()
  assert.equal(dialog(t), undefined, mode + ' closes via the actual native wrapper')
  assert.equal(t.root.activeElement, opener); assert.equal(t.root.focuses.at(-1).options.preventScroll, true)
  assert.equal(t.events.at(-1), ''); t.dispose()
}
{
  const t = fixture({ photoEntity: '' }); await flush()
  tabButton(t, '下一页').props.onClick(); await flush()
  const spot = await clickGrid(t, 'spots:38')
  const sceneId = material.sceneIdsBySpotId[38].at(-1)
  const scene = material.scenes.find(row => row.id === sceneId)
  const related = all(dialog(t)).find(item => item.type === 'button' && item.props['aria-label'] === '切换到场景 ' + scene.name)
  assert.ok(related, 'actual outdoor-stage scene relation exists')
  related.props.onClick(); await flush()
  assert.equal(t.state.photoEntity, 'scenes:' + sceneId); assert.equal(text(activeTab(t)), '地点')
  assert.ok(dialog(t), 'switching scene keeps the spot open')
  assert.equal(spot.isConnected, true, 'the spot tile stays the opener while its scene changes')
  closeButton(t).props.onClick(); await flush()
  assert.equal(t.root.activeElement, spot, 'closing a scene focuses its spot, never a numeric twin from another category')
  assert.equal(t.root.focuses.at(-1).options.preventScroll, true); assert.equal(t.state.photoEntity, '')
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'scenes:29' }); await flush()
  assert.ok(dialog(t), 'cold deep link opens without a grid opener')
  studioButton(t).focus(); studioButton(t).props.onClick(); await flush()
  await t.parent.closeFullScreenExperiment(); await flush()
  assert.equal(t.state.photoEntity, 'scenes:29'); assert.ok(dialog(t))
  closeButton(t).props.onClick(); await flush()
  const owner = material.spots.find(item => material.sceneIdsBySpotId[item.id]?.includes(29))
  const selected = gridButtons(t).find(item => item.dataset.archiveFocusId === 'photo:spots:' + owner.id)
  assert.ok(selected); assert.equal(t.root.activeElement, selected, 'cold deep link → Studio → return → close has a connected typed grid focus target')
  assert.equal(t.root.focuses.at(-1).options.preventScroll, true)
  assert.equal(readArchiveRoute(t.window.location.href).photoEntity, '')
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'scenes:29', query: '__no_matching_photo__' }); await flush()
  assert.equal(gridButtons(t).length, 0); closeButton(t).props.onClick(); await flush()
  assert.equal(t.root.activeElement, activeTab(t), 'a filtered-out detail closes to its own category control')
  assert.equal(t.root.focuses.at(-1).options.preventScroll, true); t.dispose()
}
for (const mode of ['tab', 'query', 'unmount']) {
  const t = fixture({ photoEntity: 'scenes:29' }); await flush()
  closeButton(t).props.onClick()
  let expected, focuses
  if (mode === 'tab') { expected = tabButton(t, '贴纸'); expected.focus(); expected.props.onClick() }
  if (mode === 'query') { expected = tools(t).input; expected.focus(); expected.props.onInput({ target: { value: '__new_query__' } }) }
  if (mode === 'unmount') { t.dispose(); focuses = t.root.focuses.length }
  await flush()
  if (mode === 'unmount') assert.equal(t.root.focuses.length, focuses, 'unmount revokes queued close focus')
  else { assert.equal(t.root.activeElement, expected, mode + ': newer interaction revokes queued close focus'); t.dispose() }
}
// Spot 2 reaches the studio through one of its scenes; the later focus checks use that real CTA id.
let spot2StudioFocus = ''
{
  const selected = material.spots.find(row => row.id === 2), t = fixture({ photoEntity: 'spots:2', query: selected.name }); await flush()
  const cta = studioButton(t); cta.focus(); spot2StudioFocus = cta.dataset.archiveFocusId
  assert.ok(material.sceneIdsBySpotId[2].map(id => 'photo-studio:scenes:' + id).includes(spot2StudioFocus))
  all(t.root).find(item => hasClass(item, 'photo-page')).scrollTop = 315
  cta.props.onClick(); await flush()
  const studio = readArchiveRoute(t.window.location.href), source = readArchiveSourceRoute(studio.sourceRoute)
  assert.equal(studio.view, 'picture_studio'); assert.equal('photo-studio:' + studio.photoEntity, spot2StudioFocus)
  assert.equal(source.query, selected.name); assert.equal('photo-studio:' + source.photoEntity, spot2StudioFocus, 'return lands on the scene the studio used')
  const delayed = t.pause('1'); await t.parent.closeFullScreenExperiment(); await flush()
  assert.equal(t.state.query, selected.name); assert.equal('photo-studio:' + t.state.photoEntity, spot2StudioFocus); assert.equal(t.ready.length, 1)
  delayed.resolve(); await flush()
  assert.equal(t.ready.length, 2); assert.ok(dialog(t))
  assert.equal(t.root.focuses.at(-1)?.item, studioButton(t)); assert.equal(t.root.focuses.at(-1).options.preventScroll, true)
  assert.equal(all(t.root).find(item => hasClass(item, 'photo-page')).scrollTop, 315, 'actual App Studio return restores captured source position after hydration')
  const restores = t.restores.length; await t.parent.onPhotoCatalogReady(); await flush()
  assert.equal(t.restores.length, restores, 'ready consumes entry restoration once')
  t.dispose()
}
for (const mode of ['leaveOnReady', 'disposeOnReady', 'queryOnReady']) {
  const t = fixture({ photoEntity: 'spots:2' }, { saved: { scrollTop: 315, focusId: spot2StudioFocus }, [mode]: true })
  const delayed = t.pause('1'); await flush(); delayed.resolve(); await flush()
  assert.equal(t.ready.length, 1)
  assert.equal(t.root.focuses.some(entry => entry.item.dataset?.archiveFocusId === spot2StudioFocus), false, mode + ': actual App ready cannot restore obsolete focus')
  if (mode === 'queryOnReady') assert.equal(t.state.query, '__no_matching_photo__')
  t.dispose()
}
{
  const t = fixture({ photoEntity: 'stickers:1' })
  const media = structuredClone(materialMedia); delete media['stickers:1'].full
  t.payloadOverrides.set('materials', { id: 'materials', view: { materials: material, media } }); await flush()
  const preview = all(dialog(t)).find(item => hasClass(item, 'photo-detail-preview'))
  const image = all(preview).find(item => item.type === 'img')
  assert.equal(image.props.src, media['stickers:1'].image.url, 'missing full sticker resource falls back only to its actual thumbnail')
  image.props.onError(); await flush()
  assert.ok(text(preview).includes('图片暂时无法读取'))
  all(preview).find(item => item.type === 'button').props.onClick(); await flush()
  assert.equal(all(preview).find(item => item.type === 'img').props.src, media['stickers:1'].image.url, 'retry preserves source identity')
  t.dispose()
}
assert.equal(JSON.stringify([material, materialMedia, [...actors], [...actorMedia]]), sourceSnapshot, 'gallery navigation leaves canonical source and media metadata immutable')
{
  const t = fixture({ photoIdol: '2', photoEntity: 'faces:10201002', query: '01' }); await flush()
  closeButton(t).props.onClick(); await flush()
  assert.equal(t.state.photoEntity, '', 'actual App handler accepts an explicit modal-close key')
  const route = readArchiveRoute(t.window.location.href)
  assert.equal(route.photoEntity, ''); assert.equal(route.photoIdol, '2'); assert.equal(route.query, '01')
  assert.equal(text(activeTab(t)), '表情', 'closing does not replace the current tab')
  t.dispose()
}
console.log('Photo catalog: six actual-source grids (scenes inside their spot), explicit typed dialog selection and quiet tab/actor keys, exact full/layer media bindings, parent-spot search, pagination, typed close focus across numeric-ID categories and cold Studio returns, filtered fallback/new-interaction cancellation, retained controls, identity/error/abort/retry guards and actual App Studio route/one-shot return passed. Memory-renderer/source evidence; Browser/resource/GPU acceptance is separate.')
