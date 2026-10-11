import assert from 'node:assert/strict'
import { readerScopeForViewport } from '../src/core/ReaderViewport.js'
const route = {view:'reader',reading:'ep4',readingRow:'ep4:step-24:text',readingRev:'rev',storyType:'main',storySection:'101',story:'chapter.json'}
for (const scope of ['', 'chapter']) {
  assert.equal(readerScopeForViewport({...route,readingScope:scope},true),'','mobile always uses one EP')
  assert.equal(readerScopeForViewport({...route,readingScope:scope},false),'chapter','desktop promotes formal collection entries to whole chapter')
}
// Every story page reads the same way on desktop; the Reader falls back to one document by itself.
for (const extra of [{storyType:'idol_story'},{storyType:'work'},{storyType:''},{storySection:''},{storyType:'event',event:'430017'}]) {
  assert.equal(readerScopeForViewport({...route,...extra},false),'chapter','desktop reads every story kind as a chapter')
  assert.equal(readerScopeForViewport({...route,...extra},true),'','phones read every story kind one EP at a time')
}
assert.equal(readerScopeForViewport({...route,view:'player',readingScope:'chapter'},true),'chapter','Player restoration keeps its explicit proof')
// Event episodes read as one directory chapter on desktop; phones still read one EP at a time.
const eventRoute = {view:'reader',reading:'ev-ep1',event:'430005'}
assert.equal(readerScopeForViewport(eventRoute,false),'chapter','desktop reads an event as one continuous chapter')
assert.equal(readerScopeForViewport(eventRoute,true),'','mobile reads one event EP at a time')
assert.equal(route.readingRow,'ep4:step-24:text'); assert.equal(route.readingRev,'rev')
console.log('Reader viewport defaults: single EP on mobile, one continuous chapter for every story kind on desktop, Player identity preserved')
