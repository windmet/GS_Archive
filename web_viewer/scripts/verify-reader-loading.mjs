import assert from 'node:assert/strict'
import { createReadingSession, knownReadingLocator } from '../src/core/ReadingSession.js'
import { createChapterReadingSession } from '../src/core/ChapterReadingPlan.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

const first = {document_id:'first',logical_id:'one',sha256:'rev1'}
const second = {document_id:'second',logical_id:'two',sha256:'rev2'}
const detail = {view:{readingEntries:[first,second]}}
assert.deepEqual(knownReadingLocator(detail,'second'), {entry:second,entries:[second]})
assert.equal(knownReadingLocator(detail,'missing'), null)
assert.equal(knownReadingLocator({view:{readingEntries:[first,first]}},'first'), null)
const ready = {status:'ready',document:{document_id:'first'}}
const navigation = createArchiveNavigationCoordinator()
const published = []
let loadCalls = 0
const cachedRepository = {peek:(id,entry) => id === 'first' && entry.sha256 === 'rev1' ? ready : null,
  load:async () => { loadCalls++; throw Error('cached route must not load again') }}
const reading = createReadingSession({repository:cachedRepository,publish:value=>published.push(value)})
await navigation.run(intent=>reading.open('first',intent,knownReadingLocator(detail,'first')))
assert.deepEqual(published.map(value=>value.status),['ready'], 'warm single-document switch publishes no loading frame')
assert.equal(loadCalls,0)
const chapters = []
const session = createChapterReadingSession({repository:cachedRepository,publish:value=>chapters.push(value)})
await navigation.run(intent=>session.open({documentId:'first',segments:[{documentId:'first',entry:first,status:'idle'}]},intent))
assert.ok(chapters.every(value=>value.segments[0].status==='ready'), 'warm chapter never repaints the target as loading')
let resolveCold
const cold = createReadingSession({repository:{load:()=>new Promise(resolve=>{resolveCold=resolve})},publish:value=>published.push(value)})
const pending = navigation.run(intent=>cold.open('second',intent,knownReadingLocator(detail,'second')))
await Promise.resolve()
assert.equal(published.at(-1).status,'loading')
assert.deepEqual(published.at(-1).entries,[second], 'cold switch retains target metadata, never stale text')
navigation.invalidate()
resolveCold({status:'ready',document:{document_id:'second'}})
await pending
assert.equal(published.at(-1).status,'loading','cancelled cold result cannot replace the next route')
console.log('Reader loading: exact membership, synchronous verified cache, stable target metadata and stale-result cancellation passed')
