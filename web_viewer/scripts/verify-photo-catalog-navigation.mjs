import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { DomainRepository } from '../readmodels/runtime/DomainRepository.mjs'
import { studioPresetPresentation } from '../src/presentation/studio-preset-labels.mjs'
import { buildArchiveUrl, readArchiveRoute, buildArchiveSourceQuery, readArchiveSourceRoute, ownsArchiveSource } from '../src/core/archiveRoute.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { buildArchiveViewContext, captureArchiveViewState, saveArchiveViewRestoration, restoreArchiveViewState } from '../src/core/archiveViewRestoration.js'

// Run the real SFC setup AND client template in Vue's memory renderer. This
// covers retained controls, identity and positioning without Browser claims.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const json = path => JSON.parse(read(path))
const appSource = read('src/App.vue')
const production = name => {
  const source=appSource.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0]
  assert.ok(source, `${name}: production handler exists`)
  return source
}
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
    item.scrollTop=0;item.clientHeight=100;item.dataset={}
    // Deterministic extent models an empty versus populated detail tree only.
    Object.defineProperty(item,'scrollHeight',{get:()=>all(item).some(entry=>entry.type==='h3')?1200:100})
    item.closest=()=>{let current=item;while(current&&!current.dataset?.archiveFocusId)current=current.parent;return current}
    item.focus=options=>{let root=item;while(root.parent)root=root.parent;root.activeElement=item;root.focuses.push({item,options})}
    item.scrollIntoView = options => {
      let root = item
      while (root.parent) root = root.parent
      assert.ok(root.scrolls, 'positioning targets a mounted element')
      assert.ok(all(root).some(entry => entry.type==='h3'), 'positioning waits for a valid mounted detail')
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
function fixture(initial, {saved=null,leaveOnReady=false,disposeOnReady=false,queryOnReady=false}={}) {
  const root = node('root'); root.scrolls = [];root.focuses=[];root.activeElement=null
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
    ...navigationState,window,nextTick:Vue.nextTick,archiveRouteReady:true,archiveViewRestoreRevision:0,
    activeArchiveViewContext:null,pendingEventCatalogRestore:null,pendingPhotoCatalogRestore:null,
    buildArchiveViewContext,buildArchiveSourceQuery,readArchiveSourceRoute,ownsArchiveSource,
    loading:{value:false},loadingPurpose:{value:''},playbackController:{reset:()=>{}},primeArchiveRouteComponent:()=>{},
    navigation:{getRevision:()=>revision,invalidate:()=>revision++,isDisposed:()=>disposed,isRestoring:()=>false},console,
    writeArchiveRoute(route,options){window.location.href=buildArchiveUrl(window.location.href,route).href;writes.push({route:readArchiveRoute(window.location.href),options})},
    captureArchiveViewState:value=>captureArchiveViewState(value,{root:document,storage}),
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
  for(const name of ['captureActiveArchiveView','adoptArchiveViewContext','syncArchiveRoute','commitView','selectPhotoIdol','selectPhotoEntity','updatePhotoCatalogQuery','onPhotoCatalogReady','captureDetailSource','openPictureStudio','restoreDetailSource','closeFullScreenExperiment'])vm.runInContext(production(name),parent)
  if(saved)saveArchiveViewRestoration(buildArchiveViewContext(window.location.href,window.history.state),saved,storage)
  const payload = id => id === 'materials'
    ? { id, view: { materials: material, media: {} } }
    : { id, view: { actor: actors.get(id), media: { idolId: id, entries: {} } } }
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
    leave(){parent.commitView('home')},dispose(){disposed=true;app.unmount()},
    pause(id) { const job = deferred(); paused.set(id, job); return job },
  }
}
const selectedKeys = t => all(t.root).filter(item => item.type === 'button' && item.props['aria-pressed'] === true)
const detailTitle = t => {const heading=all(t.root).find(item=>item.type==='h3');return heading?text(heading):''}

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
mobile=true
const tools=t=>({input:all(t.root).find(item=>item.type==='input'),select:all(t.root).find(item=>item.type==='select')})
const studioButton=t=>all(t.root).find(item=>hasClass(item,'domain-action'))
const count=t=>text(all(t.root).find(item=>hasClass(item,'domain-count')))
const tabButton=(t,label)=>all(t.root).find(item=>item.type==='button'&&text(item)===label)

{
  const t=fixture({photoEntity:'faces:10101001'},{saved:{scrollTop:315,focusId:'photo-studio:faces:10101001'}})
  const delayed=t.pause('1');await flush()
  assert.ok(tools(t).input&&tools(t).select,'search and actor controls mount before detail load')
  assert.equal(count(t),'正在读取…');assert.equal(detailTitle(t),'');assert.equal(t.ready.length,0)
  assert.ok(text(t.root).includes(`${translations.entries[dictionary.by_numeric_id['1'].idol_code].name}的摄影资料`),'loading states the real requested actor')
  assert.equal(all(t.root).some(item=>item.type==='h2'),false,'Shell owns the page identity')
  delayed.resolve();await flush()
  assert.equal(t.ready.length,1);assert.equal(t.root.focuses.at(-1)?.item,studioButton(t))
  assert.equal(studioButton(t).dataset.archiveFocusId,'photo-studio:faces:10101001')
  assert.equal(t.root.focuses.at(-1).options.preventScroll,true)
  assert.equal(all(t.root).find(item=>hasClass(item,'photo-page')).scrollTop,315)
  const restores=t.restores.length;await t.parent.onPhotoCatalogReady();await flush()
  assert.equal(t.restores.length,restores,'ready consumes entry restoration once')
  t.dispose()
}
{
  const t=fixture({photoEntity:'faces:10101001'},{saved:{scrollTop:315,focusId:'photo-studio:faces:10101001'}})
  const delayed=t.pause('1');await flush()
  const search=tools(t).input;t.root.activeElement=search
  search.props.onInput({target:{value:'__no_matching_photo__'}});await flush()
  const restores=t.restores.length;delayed.resolve();await flush()
  assert.equal(tools(t).input,search,'load completion retains the actual input element')
  assert.equal(t.root.activeElement,search);assert.equal(t.restores.length,restores);assert.equal(t.root.focuses.length,0)
  assert.equal(t.root.scrolls.length,0,'query input cancels late explicit-key positioning')
  assert.equal(count(t),'0 条资料');assert.ok(studioButton(t),'zero-result search preserves a valid selected detail')
  assert.equal(studioButton(t).dataset.archiveFocusId,'photo-studio:faces:10101001')
  t.dispose()
}
{
  const t=fixture({photoEntity:'faces:10101001'});await flush()
  const original=tools(t),old=t.pause('2');t.root.activeElement=original.select
  original.select.props.onChange({target:{value:'2'}});await flush()
  assert.equal(tools(t).input,original.input);assert.equal(tools(t).select,original.select)
  assert.equal(t.root.activeElement,original.select);assert.equal(count(t),'正在读取…')
  assert.equal(studioButton(t),undefined);assert.equal(detailTitle(t),'','new actor cannot expose the retained old actor preset')
  assert.ok(text(t.root).includes(`${translations.entries[dictionary.by_numeric_id['2'].idol_code].name}的摄影资料`))
  const signal=t.loads.find(job=>job.url==='2').signal
  original.input.props.onInput({target:{value:'__no_matching_photo__'}})
  original.select.props.onChange({target:{value:'29'}});await flush()
  assert.equal(signal.aborted,true);assert.equal(t.state.photoEntity,'faces:12901029')
  assert.equal(count(t),'0 条资料');assert.equal(studioButton(t).dataset.archiveFocusId,'photo-studio:faces:12901029')
  assert.equal(t.ready.length,2);const ready=t.ready.length,scrolls=t.root.scrolls.length
  old.resolve();await flush();assert.equal(t.ready.length,ready);assert.equal(t.root.scrolls.length,scrolls)
  assert.equal(t.state.photoEntity,'faces:12901029');t.dispose()
}
{
  const t=fixture({photoEntity:'spots:2'});await flush()
  const title=detailTitle(t),cta=studioButton(t),delayed=t.pause('2')
  t.parent.selectPhotoIdol('2');await flush()
  assert.equal(detailTitle(t),title);assert.equal(studioButton(t),cta,'shared material detail remains actionable through actor reload')
  assert.equal(cta.dataset.archiveFocusId,'photo-studio:spots:2')
  delayed.resolve();await flush();assert.equal(detailTitle(t),title);t.dispose()
}
for(const mismatch of ['actor','media']){
  const t=fixture({photoEntity:'faces:10101001'});await flush()
  const errors=expectedErrors.length
  t.payloadOverrides.set('2',{id:'2',view:{actor:actors.get(mismatch==='actor'?'1':'2'),media:{idolId:mismatch==='media'?'1':'2',entries:{}}}})
  tools(t).select.props.onChange({target:{value:'2'}});await flush()
  assert.equal(expectedErrors.length,errors+1);assert.equal(t.ready.length,1);assert.equal(count(t),'结果暂不可用')
  assert.equal(studioButton(t),undefined);assert.equal(detailTitle(t),'');assert.ok(tools(t).input&&tools(t).select)
  t.payloadOverrides.clear()
  await all(t.root).find(item=>item.type==='button'&&text(item)==='重试').props.onClick();await flush()
  assert.equal(t.ready.length,2);assert.equal(t.state.photoEntity,'faces:10201002')
  assert.equal(studioButton(t).dataset.archiveFocusId,'photo-studio:faces:10201002');t.dispose()
}
{
  const t=fixture({photoEntity:'faces:10201002',photoIdol:'1'});await flush()
  assert.equal(detailTitle(t),'');assert.equal(studioButton(t),undefined)
  assert.ok(text(t.root).includes('当前资料不在此目录中'))
  assert.equal(t.events.length,0);assert.equal(t.root.scrolls.length,0,'invalid explicit selection cannot impersonate the first preset')
  assert.equal(t.state.photoEntity,'faces:10201002');t.dispose()
}
{
  const t=fixture({photoEntity:'spots:2'}),delayed=t.pause('1');await flush()
  tabButton(t,'动作').props.onClick();await flush()
  assert.equal(studioButton(t),undefined);assert.equal(t.state.photoEntity,'spots:2')
  delayed.resolve();await flush()
  assert.equal(t.state.photoEntity,'poses:10101','a tab chosen before actor data arrives gets its valid canonical key')
  assert.equal(studioButton(t).dataset.archiveFocusId,'photo-studio:poses:10101')
  assert.equal(t.root.scrolls.length,0);t.dispose()
}
{
  const groups=[['spots','地点'],['scenes','场景'],['stickers','贴纸'],['frames','相框'],['filters','滤镜']]
  let collision
  for(const target of groups)for(const source of groups)if(target[0]!==source[0]&&material[source[0]].some(row=>row.id===material[target[0]][0].id))collision||={source,target,id:material[target[0]][0].id}
  assert.ok(collision,'real material groups expose a shared numeric ID to exercise typed guards')
  const t=fixture({photoEntity:`${collision.source[0]}:${collision.id}`});await flush()
  const row=all(t.root).find(item=>item.dataset?.archiveFocusId===`photo:${collision.source[0]}:${collision.id}`),scrolls=t.root.scrolls.length
  const selecting=row.props.onClick();tabButton(t,collision.target[1]).props.onClick()
  await selecting;await flush()
  assert.equal(t.state.photoEntity,`${collision.target[0]}:${collision.id}`)
  assert.equal(t.root.scrolls.length,scrolls,'numeric-ID coincidence cannot position a different tab after nextTick')
  t.dispose()
}
{
  const selected=material.spots.find(row=>row.id===2),t=fixture({photoEntity:'spots:2',query:selected.name});await flush()
  const cta=studioButton(t);t.root.activeElement=cta
  all(t.root).find(item=>hasClass(item,'photo-page')).scrollTop=315
  cta.props.onClick();await flush()
  const studio=readArchiveRoute(t.window.location.href),source=readArchiveSourceRoute(studio.sourceRoute)
  assert.equal(studio.view,'picture_studio');assert.equal(studio.photoEntity,'spots:2')
  assert.equal(source.query,selected.name);assert.equal(source.photoEntity,'spots:2')
  const delayed=t.pause('1');await t.parent.closeFullScreenExperiment();await flush()
  assert.equal(t.state.query,selected.name);assert.equal(t.state.photoEntity,'spots:2');assert.equal(t.ready.length,1)
  delayed.resolve();await flush()
  assert.equal(t.ready.length,2);assert.equal(t.root.focuses.at(-1)?.item,studioButton(t))
  assert.equal(t.root.focuses.at(-1).options.preventScroll,true)
  assert.equal(all(t.root).find(item=>hasClass(item,'photo-page')).scrollTop,315,'actual Studio return restores captured source position after hydration')
  t.dispose()
}
for(const mode of ['leaveOnReady','disposeOnReady','queryOnReady']){
  const t=fixture({photoEntity:'spots:2'},{saved:{scrollTop:315,focusId:'photo-studio:spots:2'},[mode]:true})
  const delayed=t.pause('1');await flush();delayed.resolve();await flush()
  assert.equal(t.ready.length,1);assert.equal(t.root.focuses.length,0,`${mode}: queued actual App ready cannot restore obsolete focus`)
  if(mode==='queryOnReady'){assert.equal(t.state.query,'__no_matching_photo__');assert.equal(t.root.activeElement,tools(t).input);assert.equal(t.restores.length,1)}
  t.dispose()
}
console.log('Photo catalog: actual SFC retained controls/valid detail, unknown and zero counts, requested actor labels, dual identity guards, typed focus IDs, explicit refresh versus interaction positioning, 2→29 abort/error/retry and pending-tab races; actual App one-shot ready, control/exit/dispose cancellation and delayed Studio source/focus return passed. Memory-renderer evidence; Browser/media acceptance is separate.')
