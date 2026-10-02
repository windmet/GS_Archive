import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { trapDialogKey } from '../src/components/player/dialogFocus.js'
import { chapterReadingPlan, createChapterReadingSession } from '../src/core/ChapterReadingPlan.js'
import { useEpisodeQueue } from '../src/core/useEpisodeQueue.js'
import { selectPlayerQueue } from '../src/core/PlayerEntryRequest.js'
import { buildArchiveUrl, readArchiveRoute, buildPortalReturnQuery, readPortalReturnRoute } from '../src/core/archiveRoute.js'
import { setStoryRuntimePaused, transferOverlayPause } from '../src/core/story-runtime/StoryPausePolicy.js'
const ownerDocument = { activeElement: null }
const items = Array.from({ length: 3 }, () => ({ getClientRects: () => [1], focus() { ownerDocument.activeElement = this } }))
const panel = { ownerDocument, querySelectorAll: () => items }
let closed = 0, prevented = 0
const event = (key, shiftKey = false) => ({ key, shiftKey, preventDefault: () => prevented++ })
ownerDocument.activeElement = items[2]
trapDialogKey(event('Tab'), panel, () => closed++)
assert.equal(ownerDocument.activeElement, items[0])
trapDialogKey(event('Tab', true), panel, () => closed++)
assert.equal(ownerDocument.activeElement, items[2])
for (const key of ['a', 's', 'ArrowRight', ' ']) trapDialogKey(event(key), panel, () => closed++)
assert.equal(prevented, 2, 'ordinary input/select keys keep their browser defaults')
trapDialogKey(event('Escape'), panel, () => closed++)
assert.equal(closed, 1)
assert.equal(prevented, 3)
console.log('Interaction: modal Tab boundaries, Escape close, input default behavior passed')
let resumed = 0
const pauseState = { reasons:new Set(['menu','visibility']), cues:{pause(){},resume(){resumed++}}, audioSession:{pause(){},resume(){}} }
transferOverlayPause((reason,paused)=>setStoryRuntimePaused(pauseState,reason,paused), [['menu',false],['backlog',true]])
assert.deepEqual([...pauseState.reasons].sort(), ['backlog','visibility'])
assert.equal(resumed,0)
transferOverlayPause((reason,paused)=>setStoryRuntimePaused(pauseState,reason,paused), [['backlog',false]])
assert.equal(resumed,0, 'closing an overlay retains visibility pause')

const entries = Array.from({length:10}, (_,i)=>({document_id:`doc-${i}`,source_file:`part-${i}.json`,sha256:`sha256:${String(i).padStart(64,'0')}`,status:i===4?'unsupported':'ready'}))
const collection = {chapters:[{id:'one',title:'One',label:'第1話',story:{file:'chapter.json'},episodes:entries.map((e,i)=>({id:String(i),file:e.source_file,label:`エピソード${i+1}`,exists:i!==5}))}]}
const plan = chapterReadingPlan(collection, entries, 'doc-7', 'chapter.json')
assert.equal(plan.segments[7].documentId, 'doc-7')
assert.throws(()=>chapterReadingPlan(collection,[...entries,{...entries[0],document_id:'ambiguous'}],'doc-7'),/多份正文/)
assert.throws(()=>chapterReadingPlan(collection,entries,'doc-7','other.json'),/不一致/)
const queue = useEpisodeQueue(); queue.start(collection.chapters[0].episodes,4)
assert.equal(queue.hasNext.value,false)
assert.equal(queue.peekNext().id,'5', 'missing slot stays adjacent rather than skipping to six')
assert.equal(queue.next(),null)
assert.equal(queue.snapshot.value.entries.length,10)
assert.throws(()=>{ queue.snapshot.value.entries[0].file='mutated' },TypeError)
const synopsisQueue=useEpisodeQueue()
const uniqueRange=[{id:'one',file:'whole.json',startStep:2,endStep:9}]
assert.equal(selectPlayerQueue([{episodes:uniqueRange}],'whole.json',{startStep:1,endStep:9}).length,0)
assert.equal(selectPlayerQueue([{episodes:uniqueRange}],'whole.json',{startStep:1,endStep:9,verifiedWholeFile:true}).length,1)
assert.equal(selectPlayerQueue([{episodes:uniqueRange},{episodes:uniqueRange}],'whole.json',{startStep:1,endStep:9,verifiedWholeFile:true}).length,0)
assert.equal(synopsisQueue.restore(uniqueRange,'whole.json',{startStep:1,endStep:9}),false)
assert.equal(synopsisQueue.restore(uniqueRange,'whole.json',{startStep:1,endStep:9,verifiedWholeFile:true}),true)
assert.equal(synopsisQueue.restore([...uniqueRange,{id:'two',file:'whole.json',startStep:3,endStep:9}],'whole.json',{startStep:1,endStep:9,verifiedWholeFile:true}),false,'shared-file ambiguity never becomes a guessed segment')

let inflight=0, peak=0, chapterState, active=true
const requests=[]
const repository = { load(id, entry) { inflight++;peak=Math.max(peak,inflight); return new Promise((resolve,reject)=>requests.push({id,resolve:value=>{inflight--;resolve(value)},reject:error=>{inflight--;reject(error)}})) }, locator:async id=>({entry:entries.find(e=>e.document_id===id)}) }
const chapterSession=createChapterReadingSession({repository,publish:value=>{chapterState=value}})
const open=chapterSession.open(plan,{isCurrent:()=>active})
assert.deepEqual(requests.map(r=>r.id),['doc-7','doc-0','doc-1'],'focused text is first, with only two adjacent jobs')
requests[0].resolve({status:'ready',document:{document_id:'doc-7',text_catalog_id:'catalog-7'}})
await open
assert.equal(chapterState.segments[7].document.text_catalog_id,'catalog-7')
requests[1].reject(Error('HTTP 503')); requests[2].resolve({status:'ready',document:{document_id:'doc-1',text_catalog_id:'catalog-1'}})
await new Promise(resolve=>setImmediate(resolve))
assert.equal(chapterState.segments[0].status,'error')
assert.equal(chapterState.segments[7].status,'ready','one error does not clear the chapter')
assert.equal(peak,3)
active=false;chapterSession.close()
const outside=chapterState
for (const request of requests.slice(3)) request.resolve({status:'ready',document:{document_id:request.id}})
await new Promise(resolve=>setImmediate(resolve))
assert.equal(chapterState,outside,'late old documents cannot publish after leaving')

for (const view of ['reader','player']) {
  const route={view,reading:'doc-7',readingScope:'chapter',readingRow:'doc-7:row',readingRev:entries[7].sha256,readingMode:'bilingual',storyType:'main',storySection:'101',story:'chapter.json',...(view==='player'?{returnView:'reader',scenario:'part-7.json',playMode:'segment'}:{})}
  const normalized=readArchiveRoute(buildArchiveUrl('http://localhost/',route))
  assert.equal(normalized.readingScope,'chapter'); assert.equal(normalized.readingRow,route.readingRow)
  // Reader return uses the bounded launcher-return format; archive provenance
  // deliberately excludes Reader/Player to prevent recursive session sources.
  const readerReturn={...route,view:'reader',scenario:'',returnView:'',playMode:''}
  assert.deepEqual(readPortalReturnRoute(buildPortalReturnQuery(readerReturn)),readArchiveRoute(buildArchiveUrl('http://localhost/',readerReturn)))
}
assert.equal(readArchiveRoute('http://localhost/?view=reader&reading=doc-7').readingScope,'','old Reader URLs remain single-document')
const acknowledgements=[], pendingSelections=[]
const pickerContext={pickerRequest:0,pickerPreparing:{value:false},playbackController:{selectEpisode:()=>new Promise(resolve=>pendingSelections.push(resolve))}}
const appSource=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8')
vm.runInNewContext(appSource.match(/async function selectPlayerEpisode\([^]*?\n\}/)[0],pickerContext)
const oldSelection=pickerContext.selectPlayerEpisode({onComplete:()=>acknowledgements.push('old')})
const latestSelection=pickerContext.selectPlayerEpisode({onComplete:()=>acknowledgements.push('latest')})
pendingSelections[0](true);await oldSelection
assert.equal(pickerContext.pickerPreparing.value,true)
assert.equal(acknowledgements.length,0,'obsolete cancellation cannot close a newer picker')
pendingSelections[1](true);await latestSelection
assert.deepEqual(acknowledgements,['latest']);assert.equal(pickerContext.pickerPreparing.value,false)
console.log('Interaction: atomic overlay transfer, canonical chapter plan, ambiguity/missing guards, bounded target-first loading, per-section errors, late cancellation and scope round trips passed')
