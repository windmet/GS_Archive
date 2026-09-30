import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createReadingSession, knownReadingLocator } from '../src/core/ReadingSession.js'
import { chapterReadingPlan, createChapterReadingSession } from '../src/core/ChapterReadingPlan.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { buildArchiveUrl, readArchiveRoute, readPortalReturnRoute, buildPortalReturnQuery } from '../src/core/archiveRoute.js'
import { readingPresentationSpeaker } from '../shared/reading/ReadingDocument.js'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'
import { readerChapterNavigation } from '../src/core/ReaderChapterNavigation.js'
import { buildArchiveSourceQuery, readArchiveSourceRoute } from '../src/core/archiveRoute.js'

const route = readArchiveRoute('http://localhost/?view=reader&reading=1_4_001_01_d&reading_mode=bilingual&reading_row=1_4_001_01_d:step-9:text')
assert.equal(route.view, 'reader')
assert.deepEqual(readArchiveRoute(buildArchiveUrl('http://localhost/?scenario=old&reading_row=stale', route)), route)
assert.deepEqual(readPortalReturnRoute(buildPortalReturnQuery(route)), route)
assert.equal(buildArchiveUrl('http://localhost/?reading=x&reading_mode=translation', { view: 'home' }).search, '?view=home')
assert.equal(readArchiveRoute('http://localhost/?view=reader&reading=../../RAW').view, 'story_catalog')
assert.equal(readArchiveRoute('http://localhost/?view=reader&reading=x&reading_mode=bad').readingMode, 'original')
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
// Exercise the actual App route branch with no player/preloader globals present.
const context = { ...useArchiveNavigationState(), navigation, readingSession: session, isDirectScenarioEntry, knownReadingLocator,
  readerCollectionDetail: { value:null }, loadCollectionDetail: async () => { throw Error('optional directory unavailable') },
  chapterReadingState: { value:null }, chapterReadingSession: createChapterReadingSession({ repository, publish: () => {} }),
  readingPlaybackNotice: { value: '' }, currentScenario: { value: { old: true } }, loading: { value: true }, loadingPurpose: { value: 'archive-data' },
  captureActiveArchiveView: () => {}, primeArchiveRouteComponent: () => {} }
context.playbackController = { reset: () => { context.currentScenario.value = null } }
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const bootstrapContext = { EXTERNAL_STORY_RESOURCES_ENABLED: false }
vm.runInNewContext(app.match(/function isBootstrapRoute\([^]*?\n\}/)[0], bootstrapContext)
assert.equal(bootstrapContext.isBootstrapRoute({ view: 'reader', reading: '1_4_001_00_a' }), true)
assert.equal(bootstrapContext.isBootstrapRoute({ view: 'player', returnView: 'reader', reading: '1_4_001_00_a' }), true)
vm.runInNewContext(app.match(/async function applyArchiveRoute\([^]*?\n\}/)[0], context)
for (const source of [{ storyType: 'work', idol: '001tom', story: 'work.json' }, { event: '10001', parentView: 'story_catalog' }, { storyType: 'unit_story', storySection: '13', story: 'unit.json' },
  { storyType: 'birthday', storySection: '', story: 'birthday.json' }]) {
  await context.applyArchiveRoute({ ...route, ...source })
  const restored = readArchiveRoute(buildArchiveUrl('http://localhost/', context.currentArchiveRoute()))
  for (const key of Object.keys(source)) assert.equal(restored[key], source[key], `App retains ${key}`)
}
await context.applyArchiveRoute(route)
context.view.value = 'work_archive'
context.currentStoryDomain.value = 'work'
context.currentCharacterId.value = '001tom'
context.currentStoryFile.value = 'line.json'
assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/', context.currentArchiveRoute())).story, 'line.json', 'work page refresh retains source tab selector')
await context.applyArchiveRoute(route)
assert.equal(context.view.value, 'reader')
assert.equal(context.currentScenario.value, null)
assert.equal(context.readingMode.value, 'bilingual')
assert.equal(context.readingDocumentId.value, '1_4_001_01_d')
assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/', context.currentArchiveRoute())).readingRow, route.readingRow)
let syncDuringPending = false
context.syncArchiveRoute = () => { syncDuringPending = navigation.isPending() && !navigation.isRestoring() }
vm.runInNewContext(app.match(/async function openStoryReader\([^]*?\n\}/)[0], context)
await context.openStoryReader('fast')
assert.equal(syncDuringPending, true, 'explicit selection publishes its URL while loading')
await context.applyArchiveRoute({view:'reader',reading:'fast',storyType:'main',storySection:'101'})
assert.equal(state.status,'ready','optional directory failure keeps the actual document readable')
assert.equal(context.readerCollectionDetail.value,null)
let resolveDirectory
context.loadCollectionDetail = () => new Promise(resolve => { resolveDirectory=resolve })
const staleDirectory = context.applyArchiveRoute({view:'reader',reading:'fast',storyType:'main',storySection:'101'})
await Promise.resolve(); await Promise.resolve()
await context.applyArchiveRoute({view:'reader',reading:'fast'})
resolveDirectory({view:{collection:{chapters:[]},readingEntries:[]}})
await staleDirectory
assert.equal(context.readerCollectionDetail.value,null,'a stale directory cannot overwrite the next reader')

const chapterEntries = [
  {document_id:'first',source_file:'ep-1',status:'ready'},
  {document_id:'second',source_file:'ep-2',status:'ready'},
]
const collection = {chapters:[
  {id:'one',label:'第1話',title:'One',file:'one.json',episodes:[{file:'ep-1'}]},
  {id:'two',label:'第2話',title:'Two',file:'two.json',episodes:[{file:'ep-2'}]},
  {id:'missing',label:'第3話',title:'Missing',file:'three.json',episodes:[{file:'unbuilt'}]},
  {id:'canonical',canonicalRelation:{},episodes:[{file:'ep-1'}]},
]}
const directory = readerChapterNavigation(collection, chapterEntries, 'first', 'one.json')
assert.equal(directory.chapterId,'one')
assert.deepEqual(directory.chapters.map(chapter=>chapter.documentId),['first','second',''])
assert.equal(readerChapterNavigation(collection, chapterEntries, 'first', 'two.json'),null)
assert.equal(readerChapterNavigation(collection, [...chapterEntries,chapterEntries[0]], 'first'),null)
assert.equal(readerChapterNavigation({chapters:[...collection.chapters,{id:'duplicate',episodes:[{file:'ep-1'}]}]}, chapterEntries, 'first'),null)
const ambiguous = readerChapterNavigation(collection,[...chapterEntries,{...chapterEntries[1],document_id:'duplicate'}],'first')
assert.equal(ambiguous.chapters[1].documentId,'','ambiguous target sources never unlock navigation')
context.readingChapterNavigation = {value:directory}
context.readArchiveSourceRoute = readArchiveSourceRoute
context.buildArchiveSourceQuery = buildArchiveSourceQuery
vm.runInNewContext(app.match(/async function selectReaderChapter\([^]*?\n\}/)[0],context)
for (const scope of ['', 'chapter']) {
  context.readingScope.value = scope
  context.currentStoryDomain.value = 'main'; context.currentStorySection.value = '101'
  context.currentStoryFile.value = 'one.json'; context.readingDocumentId.value = 'first'
  context.readingRowId.value = 'stale'; context.readingRevision.value = 'old'
  context.readingMode.value = 'bilingual'
  context.detailSourceRoute.value = buildArchiveSourceQuery({view:'story_collection',storyType:'main',storySection:'101',story:'one.json'})
  let targetRoute
  const applyRoute = context.applyArchiveRoute
  context.applyArchiveRoute = async route => { targetRoute=route }
  await context.selectReaderChapter('missing')
  assert.equal(targetRoute,undefined)
  await context.selectReaderChapter('two')
  assert.equal(targetRoute.reading,'second'); assert.equal(targetRoute.story,'two.json')
  assert.equal(targetRoute.readingScope || '',scope); assert.equal(targetRoute.readingMode,'bilingual')
  assert.equal(targetRoute.readingRow,''); assert.equal(targetRoute.readingRev,'')
  assert.equal(readArchiveSourceRoute(targetRoute.sourceRoute).story,'two.json')
  context.applyArchiveRoute = applyRoute
}
// The actual App cutover keeps the same chapter surface and formal directory.
const chapterTransitions = []
let mountedChapter = {chapterId:'one',segments:[]}
context.chapterReadingState = {get value(){return mountedChapter},set value(value){chapterTransitions.push(value);mountedChapter=value}}
context.readerCollectionDetail.value = {view:{collection,readingEntries:chapterEntries}}
context.currentStoryDomain.value = 'main'; context.currentStorySection.value = '101'; context.view.value = 'reader'
context.readingState = {value:{}}
context.chapterReadingPlan = chapterReadingPlan
context.loadCollectionDetail = () => { throw Error('mounted directory must not refetch during chapter switch') }
context.chapterReadingSession = createChapterReadingSession({repository:{peek:id=>({status:'ready',document:{document_id:id}})},publish:value=>{context.chapterReadingState.value=value}})
await context.applyArchiveRoute({view:'reader',reading:'second',readingScope:'chapter',storyType:'main',storySection:'101',story:'two.json'})
assert.equal(mountedChapter.chapterId,'two')
assert.ok(chapterTransitions.length && chapterTransitions.every(value=>value!==null),'chapter switch never remounts the generic single-reader loading page')
const unknown = { speaker: { kind: 'unknown', entityType: 'idol', entityId: '047shu', sourceName: '？？？' } }
const display = resolveStoryText({ source: 'text', speaker: readingPresentationSpeaker(unknown),
  entityNames: { 'zh-CN': { '047shu': 'must not reveal' } }, preferences: { story_content_mode: 'translation' } })
assert.equal(display.speaker.display, '？？？')
assert.equal(unknown.speaker.entityId, '047shu')
console.log('Reading navigation verified: route round trips, portal return, stale success/error, page states and identity privacy')
