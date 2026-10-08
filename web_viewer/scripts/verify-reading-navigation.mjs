import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ref, watch } from 'vue'
import { bindReaderNavigation, createReaderFixtureTransport } from './lib/reader-navigation-harness.mjs'
import { createReadingSession } from '../src/core/ReadingSession.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { buildArchiveUrl, readArchiveRoute, readPortalReturnRoute, buildPortalReturnQuery } from '../src/core/archiveRoute.js'
import { readingPresentationSpeaker } from '../shared/reading/ReadingDocument.js'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'
import { readerChapterNavigation } from '../src/core/ReaderChapterNavigation.js'
import { buildArchiveSourceQuery, readArchiveSourceRoute } from '../src/core/archiveRoute.js'
import { storyContentMode } from '../src/utils/LanguageStore.js'

const route = readArchiveRoute('http://localhost/?view=reader&reading=1_4_001_01_d&reading_mode=bilingual&reading_row=1_4_001_01_d:step-9:text')
assert.equal(route.view, 'reader')
assert.deepEqual(readArchiveRoute(buildArchiveUrl('http://localhost/?scenario=old&reading_row=stale', route)), route)
assert.deepEqual(readPortalReturnRoute(buildPortalReturnQuery(route)), route)
assert.equal(buildArchiveUrl('http://localhost/?reading=x&reading_mode=translation', { view: 'home' }).search, '?view=home')
assert.equal(readArchiveRoute('http://localhost/?view=reader&reading=../../RAW').view, 'story_catalog')
// No or an invalid reading_mode means "the visitor's saved story-text choice" (empty); explicit modes round-trip.
assert.equal(readArchiveRoute('http://localhost/?view=reader&reading=x&reading_mode=bad').readingMode, '')
assert.equal(readArchiveRoute('http://localhost/?view=reader&reading=x').readingMode, '')
assert.equal(buildArchiveUrl('http://localhost/', { view: 'reader', reading: 'x', readingMode: '' }).search, '?view=reader&reading=x')
for (const mode of ['original', 'translation', 'bilingual']) {
  assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/', { view: 'reader', reading: 'x', readingMode: mode })).readingMode, mode)
}
for (const query of [
  'story_type=unit_story&story_section=13&story=1_1_013the_03.json',
  'story_type=birthday&story=1_x_001tom_1_8_001_01.json',
  'event=10001&parent=unit_detail&category=idol&unit=01jup&from=%3Fview%3Dunit_detail%26category%3Didol%26unit%3D01jup',
  'story_type=work&idol=001tom&story=work.json',
]) {
  const nonMain = readArchiveRoute(`http://localhost/?view=reader&reading=sample&${query}`)
  assert.deepEqual(readArchiveRoute(buildArchiveUrl('http://localhost/', nonMain)), nonMain)
  assert.deepEqual(readPortalReturnRoute(buildPortalReturnQuery(nonMain)), nonMain)
}

let state
let resolveSlow
let rejectSlow
const navigation = createArchiveNavigationCoordinator()
const repository = { manifest: async () => ({ entries: [{ document_id: 'fast' }] }), load: async id => {
  if (id === 'slow') return new Promise((resolve, reject) => { resolveSlow = resolve; rejectSlow = reject })
  if (id === 'error') throw Error('controlled failure')
  return { status: id === 'fast' ? 'ready' : id, document: id === 'fast' ? { document_id: id } : null }
} }
const session = createReadingSession({ repository, publish: next => { state = next } })
const open = id => navigation.run(intent => session.open(id, intent))
const slow = open('slow')
await Promise.resolve(); await Promise.resolve()
assert.equal(state.status, 'loading')
await open('fast')
const fastState = state
resolveSlow({ status: 'ready', document: { document_id: 'slow' } })
await slow
assert.equal(state, fastState)
const staleError = open('slow')
await Promise.resolve(); await Promise.resolve()
navigation.invalidate()
state = { status: 'outside-reader' }
rejectSlow(Error('obsolete'))
await staleError
assert.equal(state.status, 'outside-reader')
for (const status of ['empty', 'unsupported', 'not-generated', 'error']) {
  await open(status)
  assert.equal(state.status, status)
  assert.equal(state.document, null)
}
// Exercise App's actual route dispatcher and Reader factory with real repository bytes.
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const transport = createReaderFixtureTransport()
const templateDocument = JSON.parse(readFileSync(new URL('../public/data/reading/1_4_001_01_d.json', import.meta.url), 'utf8'))
const originalId = templateDocument.document_id
const fixtureDocument = (id, file = `${id}.json`) => {
  const document = JSON.parse(JSON.stringify(templateDocument).replaceAll(originalId, id))
  document.source.file = file; document.playback.file = file
  return document
}
transport.register(templateDocument)
transport.register(fixtureDocument('fast'))
const chapterEntries = [transport.register(fixtureDocument('first', 'ep-1.json')), transport.register(fixtureDocument('second', 'ep-2.json'))]
const collection = {chapters:[
  {id:'one',label:'第1話',title:'One',file:'one.json',episodes:[{file:'ep-1.json'}]},
  {id:'two',label:'第2話',title:'Two',file:'two.json',episodes:[{file:'ep-2.json'}]},
  {id:'missing',label:'第3話',title:'Missing',file:'three.json',episodes:[{file:'unbuilt.json'}]},
  {id:'canonical',canonicalRelation:{},episodes:[{file:'ep-1.json'}]},
]}
const detail = {view:{collection,readingEntries:chapterEntries}}
const directory = readerChapterNavigation(collection, chapterEntries, 'first', 'one.json')
assert.equal(directory.chapterId,'one')
assert.deepEqual(directory.chapters.map(chapter=>chapter.documentId),['first','second',''])
assert.equal(readerChapterNavigation(collection, chapterEntries, 'first', 'two.json'),null)
assert.equal(readerChapterNavigation(collection, [...chapterEntries,chapterEntries[0]], 'first'),null)
assert.equal(readerChapterNavigation({chapters:[...collection.chapters,{id:'duplicate',episodes:[{file:'ep-1.json'}]}]}, chapterEntries, 'first'),null)
const ambiguous = readerChapterNavigation(collection,[...chapterEntries,{...chapterEntries[1],document_id:'duplicate'}],'first')
assert.equal(ambiguous.chapters[1].documentId,'','ambiguous target sources never unlock navigation')
const scopes = []
function setupReader({ loadDirectory = async () => { throw Error('optional directory unavailable') } } = {}) {
  const nav = createArchiveNavigationCoordinator(), routes = [], syncs = []
  const context = { ...useArchiveNavigationState(), navigation:nav, isDirectScenarioEntry,
    currentScenario:ref({old:true}), loading:ref(true), loadingPurpose:ref('archive-data'),
    captureActiveArchiveView() {}, primeArchiveRouteComponent() {}, readModelClient:transport.readModelClient,
    loadCollectionDetail:(...args)=>loadDirectory(...args),
    syncArchiveRoute: options => syncs.push({options,pending:nav.isPending(),restoring:nav.isRestoring()}),
  }
  context.playbackController = {reset:()=>{context.currentScenario.value=null}}
  vm.runInNewContext(app.match(/async function applyArchiveRoute\([^]*?\n\}/)[0], context)
  const apply = context.applyArchiveRoute
  context.applyArchiveRoute = (...args) => { routes.push(args[0]); return apply(...args) }
  scopes.push(bindReaderNavigation(app, context))
  return { context, routes, syncs }
}
const restoreFetch = transport.install()
const savedMatchMedia = globalThis.matchMedia
try {
  const bootstrapContext = { EXTERNAL_STORY_RESOURCES_ENABLED:false }
  vm.runInNewContext(app.match(/function isBootstrapRoute\([^]*?\n\}/)[0], bootstrapContext)
  assert.equal(bootstrapContext.isBootstrapRoute({view:'reader',reading:originalId}),true)
  assert.equal(bootstrapContext.isBootstrapRoute({view:'player',returnView:'reader',reading:originalId}),true)
  let loadDirectory = async () => { throw Error('optional directory unavailable') }
  const {context,routes,syncs} = setupReader({loadDirectory:(...args)=>loadDirectory(...args)})
  for (const source of [{storyType:'work',idol:'001tom',story:'work.json'}, {event:'10001',parentView:'story_catalog'},
    {storyType:'unit_story',storySection:'13',story:'unit.json'}, {storyType:'birthday',storySection:'',story:'birthday.json'}]) {
    await context.applyArchiveRoute({...route,...source})
    const restored=readArchiveRoute(buildArchiveUrl('http://localhost/',context.currentArchiveRoute()))
    for(const key of Object.keys(source)) assert.equal(restored[key],source[key],`App retains ${key}`)
  }
  await context.applyArchiveRoute(route)
  context.view.value='work_archive';context.currentStoryDomain.value='work';context.currentCharacterId.value='001tom';context.currentStoryFile.value='line.json'
  assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/',context.currentArchiveRoute())).story,'line.json','work refresh retains source tab')
  await context.applyArchiveRoute(route)
  assert.equal(context.view.value,'reader'); assert.equal(context.currentScenario.value,null)
  assert.equal(context.readingMode.value,'bilingual'); assert.equal(context.readingDocumentId.value,originalId)
  assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/',context.currentArchiveRoute())).readingRow,route.readingRow)
  await context.openStoryReader('fast')
  assert.equal(syncs.at(-1).pending && !syncs.at(-1).restoring,true,'explicit selection publishes URL while loading')
  await context.applyArchiveRoute({view:'reader',reading:'fast',storyType:'main',storySection:'101'})
  assert.equal(context.readingState.value.status,'ready','optional directory failure keeps actual document readable')
  assert.equal(context.readingChapterNavigation.value,null)
  let resolveDirectory
  loadDirectory = () => new Promise(resolve=>{resolveDirectory=resolve})
  const stale = context.applyArchiveRoute({view:'reader',reading:'first',storyType:'main',storySection:'101'})
  await Promise.resolve();await Promise.resolve()
  await context.applyArchiveRoute({view:'reader',reading:'first'})
  resolveDirectory(detail);await stale
  assert.equal(context.readingChapterNavigation.value,null,'stale directory cannot overwrite next Reader')
  loadDirectory = async () => detail
  for(const scope of ['', 'chapter']) {
    await context.applyArchiveRoute({view:'reader',reading:'first',storyType:'main',storySection:'101',story:'one.json',readingScope:scope,
      readingRow:'stale',readingRev:'old',readingMode:'bilingual',sourceRoute:buildArchiveSourceQuery({view:'story_collection',storyType:'main',storySection:'101',story:'one.json'})})
    assert.equal(context.readingChapterNavigation.value.chapterId,'one')
    const before=routes.length
    await context.selectReaderChapter('missing'); assert.equal(routes.length,before)
    await context.selectReaderChapter('two')
    const targetRoute=routes.at(-1)
    assert.equal(targetRoute.reading,'second');assert.equal(targetRoute.story,'two.json')
    assert.equal(targetRoute.readingScope||'',scope);assert.equal(targetRoute.readingMode,'bilingual')
    assert.equal(targetRoute.readingRow,'');assert.equal(targetRoute.readingRev,'')
    assert.equal(readArchiveSourceRoute(targetRoute.sourceRoute).story,'two.json')
  }
  await context.applyArchiveRoute({view:'reader',reading:'first',readingScope:'chapter',storyType:'main',storySection:'101',story:'one.json'})
  const transitions=[]
  const stopWatch=watch(context.chapterReadingState,value=>transitions.push(value),{flush:'sync'})
  loadDirectory=()=>{throw Error('mounted directory must not refetch during chapter switch')}
  await context.applyArchiveRoute({view:'reader',reading:'second',readingScope:'chapter',storyType:'main',storySection:'101',story:'two.json'})
  stopWatch()
  assert.equal(context.chapterReadingState.value.chapterId,'two')
  assert.ok(transitions.length && transitions.every(value=>value!==null),'chapter switch never remounts generic single-reader loading page')
  globalThis.matchMedia=()=>({matches:true})
  const mobile=setupReader({loadDirectory:async()=>detail}).context
  transport.requests.length=0
  await mobile.applyArchiveRoute({view:'reader',reading:'second',readingScope:'chapter',readingRow:'second:step-1:text',storyType:'main',storySection:'101',story:'two.json'})
  assert.deepEqual(transport.requests.filter(item=>item.kind==='body').map(item=>item.path),['/data/reading/second.json'],'mobile loads only requested EP')
  assert.equal(mobile.chapterReadingState.value,null);assert.equal(mobile.readingScope.value,'');assert.equal(mobile.readingRowId.value,'second:step-1:text')
  const fromCollection=setupReader({loadDirectory:()=>{throw Error('verified collection metadata must be reused')}}).context
  fromCollection.view.value='story_collection';fromCollection.currentStoryDomain.value='main';fromCollection.currentStorySection.value='101'
  fromCollection.collectionReadModelDetail.value=detail
  await fromCollection.applyArchiveRoute({view:'reader',reading:'second',readingScope:'chapter',storyType:'main',storySection:'101',story:'two.json'})
  assert.equal(fromCollection.readingChapterNavigation.value.chapterId,'two','verified directory is reused on collection entry')
  const before=syncs.length
  context.updateReadingMode('original')
  assert.equal(storyContentMode.value,'original');assert.equal(context.readingMode.value,'original');assert.equal(syncs.length,before+1)
  context.updateReadingMode('translation');assert.equal(storyContentMode.value,'translation')
} finally { restoreFetch(); if(savedMatchMedia===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=savedMatchMedia; for(const scope of scopes)scope.stop() }
const unknown = { speaker: { kind: 'unknown', entityType: 'idol', entityId: '047shu', sourceName: '？？？' } }
const display = resolveStoryText({ source: 'text', speaker: readingPresentationSpeaker(unknown),
  entityNames: { 'zh-CN': { '047shu': 'must not reveal' } }, preferences: { story_content_mode: 'translation' } })
assert.equal(display.speaker.display, '？？？')
assert.equal(unknown.speaker.entityId, '047shu')
console.log('Reading navigation verified: route round trips, portal return, stale success/error, page states and identity privacy')
