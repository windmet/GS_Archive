import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { bindReaderNavigation, createReaderFixtureTransport } from './lib/reader-navigation-harness.mjs'
import { createHash } from 'node:crypto'
import { ref } from 'vue'
import { readingPlaybackTarget } from '../src/core/ReadingPlayback.js'
import { prepareScenario } from '../src/data/prepareScenario.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'
import { buildArchiveSourceQuery, buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'
import { storyContentMode } from '../src/utils/LanguageStore.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url))
const manifest = JSON.parse(read('public/data/reading/manifest.json'))
const document = JSON.parse(read('public/data/reading/1_4_001_01_d.json'))
let entry = manifest.entries.find(e => e.document_id === document.document_id)
const row = document.rows[1]
const localSources = process.argv.includes('--local-sources')
if (localSources) {
  const whole = JSON.parse(read('public/data/reading/1_x_001tom_1_8_001_01.json'))
  const wholeEntry = manifest.entries.find(e => e.document_id === whole.document_id)
  const wholeTarget = readingPlaybackTarget(whole, '', wholeEntry.sha256, wholeEntry, { fullDocument: true })
  assert.equal(wholeTarget.file, '1_x_001tom_1_8_001_01.json')
  assert.equal(wholeTarget.initialStep, 1)
  assert.equal(wholeTarget.endStep, whole.source.step_count)
  await wholeTarget.readScenario(new Response(read(`public/data/compiled/${wholeTarget.file}`)))
}
// CI has no published media tree. Its synthetic source deliberately uses a non-sequential ID.
let bytes
if (localSources) bytes = read(`public/data/compiled/${document.source.file}`)
else {
  const steps = Array.from({ length: document.source.step_count }, (_, index) => ({ step_id: index + 1, type: 'dialogue' }))
  steps[row.anchor.step_index].step_id = 1007
  row.anchor.step_id = 1007
  row.visual.stepId = 1007
  bytes = Buffer.from(JSON.stringify({ steps }))
  document.source.sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  entry.source_sha256 = document.source.sha256
}
const transport = createReaderFixtureTransport()
entry = transport.register(document, entry)
const restoreFetch = transport.install()
const target = readingPlaybackTarget(document, row.anchor.row_id, entry.sha256, entry)
assert.equal(target.initialStep, row.anchor.step_index + 1)
assert.equal(target.startStep, 1)
assert.equal(target.endStep, document.source.step_count)
const full = readingPlaybackTarget(document, '', entry.sha256, entry, { fullDocument: true })
assert.equal(full.initialStep, 1, 'full playback includes opening steps before the first dialogue')
assert.equal(full.endStep, document.source.step_count)
await full.readScenario(new Response(bytes))
// A historical CRLF digest must load the exact LF publication without accepting
// changed source values or unrelated whitespace. Receipts remain untouched.
const lfSource=Buffer.from(JSON.stringify(JSON.parse(bytes),null,2)+'\n')
const crlfSource=Buffer.from(lfSource.toString('utf8').replace(/\n/g,'\r\n'))
for(const bound of [lfSource,crlfSource]) {
  const doc=structuredClone(document)
  doc.source.sha256=`sha256:${createHash('sha256').update(bound).digest('hex')}`
  const alternate=readingPlaybackTarget(doc,'',entry.sha256,entry,{fullDocument:true})
  await alternate.readScenario(new Response(lfSource))
  await alternate.readScenario(new Response(crlfSource))
  await assert.rejects(alternate.readScenario(new Response(lfSource.toString('utf8').replace('steps','wrong'))), /来源已更新/)
  await assert.rejects(alternate.readScenario(new Response(' '+lfSource.toString('utf8'))), /来源已更新/)
}
await assert.rejects(full.readScenario(new Response('{}')), /来源已更新/)
assert.throws(() => readingPlaybackTarget(document, row.anchor.row_id, 'old', entry), /版本已变化/)
assert.throws(() => readingPlaybackTarget(document, 'missing-row', entry.sha256, entry), /不能定位/)
let media = 0
const prepare = body => prepareScenario(target.file, { isCurrent: () => true,
  fetchImpl: async () => new Response(body), readScenario: target.readScenario,
  loadPlayer: async () => { media++ }, preloadAssets: async () => { media++ } })
await assert.rejects(prepare('{}'), /来源已更新/)
assert.equal(media, 0, 'mismatched bytes must fail before player import or media preload')
await prepare(bytes)
assert.equal(media, 2)

// Execute App's actual dispatcher and factory with real repository/coordinator/controller.
const state = { ...useArchiveNavigationState(), loading: ref(false), loadingPurpose: ref('archive-data'), preloadProgress: ref(0) }
const navigation = createArchiveNavigationCoordinator()
let url = new URL('http://localhost/'), eventCloseRoute = null
let loadDirectory = async () => { throw Error('optional directory unavailable') }
let loadQueue = async () => { throw Error('unexpected queue request') }
const context = { ...state, navigation, isDirectScenarioEntry, readModelClient:transport.readModelClient,
  loadCollectionDetail:(...args)=>loadDirectory(...args), loadPlayerQueue:(...args)=>loadQueue(...args),
  captureActiveArchiveView() {}, primeArchiveRouteComponent() {},
  syncArchiveRoute: () => { url = buildArchiveUrl(url, state.currentArchiveRoute()) },
}
let pendingFetch = null
context.playbackController = useStoryPlaybackController({ state, navigation,
  prepare: (file, options) => prepareScenario(file, { ...options, fetchImpl: () => pendingFetch || Promise.resolve(new Response(bytes)) }),
  loadPlayer: async () => {}, preloadAssets: async () => {}, syncRoute: context.syncArchiveRoute,
  returnTo: () => context.returnToReader(), onError: () => {} })
context.playbackError = context.playbackController.error
const app = read('src/App.vue').toString()
vm.runInNewContext(app.match(/async function applyArchiveRoute\([^]*?\n\}/)[0], context)
const applyArchiveRoute = context.applyArchiveRoute
context.applyArchiveRoute = (route,...args) => {
  if(route.view==='event_detail') { eventCloseRoute=route;state.view.value=route.view;return Promise.resolve() }
  return applyArchiveRoute(route,...args)
}
const bound = bindReaderNavigation(app, context)
// The controller and assertions observe the factory's actual refs, never a replacement session.
Object.assign(state,{readingState:context.readingState,readingPlaybackNotice:context.readingPlaybackNotice})
await context.applyArchiveRoute({ view: 'reader', reading: document.document_id, readingMode: 'bilingual', storyType: 'main', storySection: '101', story: '1_4_001_01.json' })
// Reader's complete event origin survives player return and a Reader refresh.
const eventSourceRoute = buildArchiveSourceQuery({ view: 'unit_detail', category: 'idol', unit: '01jup' })
await context.applyArchiveRoute({ view: 'reader', reading: document.document_id, event: '10001',
  parentView: 'unit_detail', category: 'idol', unit: '01jup', sourceRoute: eventSourceRoute })
await context.openReaderPlayback(row.anchor.row_id)
const eventPlayback = readArchiveRoute(url)
assert.equal(eventPlayback.event, '10001')
assert.equal(eventPlayback.parentView, 'unit_detail')
assert.equal(eventPlayback.category, 'idol')
assert.equal(eventPlayback.unit, '01jup')
assert.equal(eventPlayback.sourceRoute, eventSourceRoute)
assert.equal(eventPlayback.returnView, 'reader')
await context.playbackController.close()
const returnedEventReader = readArchiveRoute(url)
assert.equal(returnedEventReader.view, 'reader')
assert.equal(returnedEventReader.parentView, 'unit_detail')
assert.equal(returnedEventReader.category, 'idol')
assert.equal(returnedEventReader.unit, '01jup')
assert.equal(returnedEventReader.sourceRoute, eventSourceRoute)
await context.applyArchiveRoute(eventPlayback)
await context.playbackController.close()
await context.closeStoryReader()
const returnedEvent = readArchiveRoute(buildArchiveUrl(url, eventCloseRoute))
assert.equal(returnedEvent.view, 'event_detail')
assert.equal(returnedEvent.event, '10001')
assert.equal(returnedEvent.parentView, 'unit_detail')
assert.equal(returnedEvent.category, 'idol')
assert.equal(returnedEvent.unit, '01jup')
assert.equal(returnedEvent.sourceRoute, eventSourceRoute)
await context.applyArchiveRoute({ view: 'reader', reading: document.document_id, readingMode: 'bilingual', storyType: 'main', storySection: '101', story: '1_4_001_01.json' })
assert.equal(state.currentEventId.value, '', 'ordinary Reader navigation clears unrelated event origin')
await context.applyArchiveRoute({ view: 'reader', reading: document.document_id, storyType: 'work', idol: '001tom', story: 'work.json' })
await context.openReaderPlayback(row.anchor.row_id)
const workPlayback = readArchiveRoute(url)
assert.equal(workPlayback.idol, '001tom')
assert.equal(workPlayback.story, 'work.json')
await context.playbackController.close()
await context.applyArchiveRoute(workPlayback)
await context.playbackController.close()
assert.equal(readArchiveRoute(url).idol, '001tom')
await context.applyArchiveRoute({ view: 'reader', reading: document.document_id, readingMode: 'bilingual', storyType: 'main', storySection: '101', story: '1_4_001_01.json' })
assert.equal(state.currentCharacterId.value, '', 'ordinary Reader clears unrelated work idol')
state.currentCardId.value = 'unrelated-card'
state.filterQuery.value = 'unrelated-filter'
await context.openReaderPlayback(row.anchor.row_id)
assert.equal(state.view.value, 'player')
assert.equal(state.currentScenarioInitialStep.value, target.initialStep)
assert.equal(state.currentScenarioStartStep.value, 1)
const shared = readArchiveRoute(url)
assert.equal(shared.card, '')
assert.equal(shared.query, '')
assert.equal(shared.story, '1_4_001_01.json')
assert.equal(shared.storySection, '101')
assert.equal(shared.readingRev, entry.sha256)
assert.equal(shared.readingRow, row.anchor.row_id)
assert.equal(shared.readingMode || storyContentMode.value, 'bilingual', 'Reader playback retains the effective text mode; the saved choice is omitted from the URL')
assert.equal(shared.initialStep, target.initialStep)
await context.playbackController.close()
assert.equal(state.view.value, 'reader')
assert.equal(readArchiveRoute(url).story, '1_4_001_01.json')
assert.equal(state.readingRowId.value, row.anchor.row_id)
assert.equal(context.playbackController.currentScenario.value, null)
await context.openReaderPlayback(row.anchor.row_id, { fullDocument: true })
assert.equal(state.currentScenarioInitialStep.value, 1)
const fullShared = readArchiveRoute(url)
assert.equal(fullShared.readingRow, row.anchor.row_id, 'full playback preserves the reading return location')
await context.playbackController.close()
await context.applyArchiveRoute(fullShared)
assert.equal(state.view.value, 'player', 'full playback URL restores without treating the return row as the playback target')
assert.equal(state.currentScenarioInitialStep.value, 1)
await context.playbackController.close()
assert.equal(state.readingRowId.value, row.anchor.row_id)
const selectedDocument=JSON.parse(JSON.stringify(document).replaceAll(document.document_id,'picker-refresh-proof'))
selectedDocument.source.file='picker-refresh-proof.json'
selectedDocument.playback.file=selectedDocument.source.file
const selectedEntry=transport.register(selectedDocument,entry)
transport.locators.set(document.document_id,[entry,selectedEntry])
// Production normalization omits at_step when starting at the queue boundary.
const selectedShare=readArchiveRoute(buildArchiveUrl(url,{...fullShared,scenario:selectedDocument.source.file,initialStep:0}))
await context.applyArchiveRoute(selectedShare)
assert.equal(state.view.value,'player',`refresh restores picked segment: ${state.readingPlaybackNotice.value}`)
assert.equal(state.currentScenarioFile.value,selectedDocument.source.file)
assert.equal(state.readingDocumentId.value,document.document_id)
assert.equal(state.readingRowId.value,row.anchor.row_id)
await context.playbackController.close()
loadQueue=async()=>({episodes:[{file:selectedDocument.source.file,startStep:2,endStep:document.source.step_count}]})
await context.applyArchiveRoute({...selectedShare,startStep:2})
assert.equal(state.view.value,'player','a source-verified picked segment can restore its exact canonical synopsis-excluding range')
assert.equal(state.currentScenarioStartStep.value,2)
await context.playbackController.close()
await context.applyArchiveRoute({...selectedShare,startStep:3})
assert.equal(state.view.value,'reader','a guessed subrange is rejected even inside the verified file')
assert.match(state.readingPlaybackNotice.value,/正式目录/)
assert.equal(state.view.value,'reader')
await context.applyArchiveRoute({...fullShared,scenario:selectedDocument.source.file,initialStep:2})
assert.equal(state.view.value,'reader','picked segment cannot invent an initial position')
await context.applyArchiveRoute({...fullShared,scenario:'unrelated.json',initialStep:0})
assert.equal(state.view.value,'reader','picked refresh source must belong to the original bounded locator')
transport.locators.set(document.document_id,[entry])
await context.applyArchiveRoute(shared)
assert.equal(state.view.value, 'player', 'refresh restores validated media entry')
await context.applyArchiveRoute({ ...shared, initialStep: shared.initialStep + 1 })
assert.equal(state.view.value, 'reader')
assert.match(state.readingPlaybackNotice.value, /范围与正文定位不一致/)
assert.equal(context.playbackController.currentScenario.value, null)
await context.applyArchiveRoute({ ...shared, readingRev: `sha256:${'0'.repeat(64)}` })
assert.equal(state.view.value, 'reader')
assert.match(state.readingPlaybackNotice.value, /版本已变化/)
await context.applyArchiveRoute({ ...shared, view: 'reader' })
let settleFetch
pendingFetch = new Promise(resolve => { settleFetch = resolve })
const obsolete = context.openReaderPlayback(row.anchor.row_id)
navigation.invalidate()
context.playbackController.reset()
state.view.value = 'portal'
settleFetch(new Response(bytes))
await obsolete
assert.equal(state.view.value, 'portal', 'late source verification must not reopen media after leaving')
assert.equal(context.playbackController.currentScenario.value, null)
// Execute the production resolver for explicit adjacent-chapter continuation.
const adjacentDocuments=['next-a','next-b'].map(id=>{
  const next=JSON.parse(JSON.stringify(document).replaceAll(document.document_id,id))
  next.source.file=`${id}.json`;next.playback.file=next.source.file
  return next
})
const adjacentEntries=adjacentDocuments.map(doc=>transport.register(doc,entry))
for(const item of adjacentEntries)transport.locators.set(item.document_id,[item])
const adjacentChapters=[{exists:true,episodes:[{file:document.source.file,exists:true}]},
  {exists:true,episodes:adjacentEntries.map(item=>({file:item.source_file,exists:true}))}]
const sourceRoute={view:'reader',reading:document.document_id,storyType:'main',storySection:'101'}
const loadAdjacentCollection=async(type,section)=>{assert.equal(type,'main');assert.equal(section,'101');return {view:{collection:{chapters:adjacentChapters},readingEntries:adjacentEntries}}}
const sourceContext={readingDocumentId:ref(document.document_id),currentScenarioFile:ref(document.source.file),currentArchiveRoute:()=>sourceRoute,
  loadCollectionDetail:loadAdjacentCollection,readModelClient:transport.readModelClient}
const sourceBound=bindReaderNavigation(app,sourceContext)
const adjacentGuard=await sourceContext.resolveReaderContinuationSource('next-a.json')
await adjacentGuard(new Response(bytes))
await assert.rejects(adjacentGuard(new Response('{}')),/来源已更新/)
await assert.rejects(sourceContext.resolveReaderContinuationSource('next-b.json'),/明确入口/)
sourceContext.currentScenarioFile.value='next-a.json'
await sourceContext.resolveReaderContinuationSource('next-b.json')
sourceContext.currentScenarioFile.value=document.source.file
adjacentChapters.splice(1,0,{exists:true,canonicalRelation:{},episodes:[]})
await assert.rejects(sourceContext.resolveReaderContinuationSource('next-a.json'),/明确入口/)
adjacentChapters.splice(1,1)
loadDirectory=loadAdjacentCollection
pendingFetch=null
await context.applyArchiveRoute({...fullShared,scenario:'next-a.json',initialStep:0})
assert.equal(state.view.value,'player','a refreshed adjacent chapter uses its independently verified document while retaining the original Reader')
assert.equal(state.currentScenarioFile.value,'next-a.json')
assert.equal(state.readingDocumentId.value,document.document_id)
await context.playbackController.close()
bound.stop();sourceBound.stop();context.playbackController.dispose();restoreFetch()
console.log('Reader adjacent chapter: exact source mapping, guarded bytes, current chapter membership and unskippable canonical relation passed')
console.log(localSources ? 'LOCAL published source verified' : 'CI synthetic non-sequential source verified')
console.log('Reading playback verified: source integrity before media, versioned URL, App round trip, refresh, invalid links and separate target/range')
