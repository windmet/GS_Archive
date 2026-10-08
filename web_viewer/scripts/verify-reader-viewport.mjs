import assert from 'node:assert/strict'
import { readerScopeForViewport } from '../src/core/ReaderViewport.js'
const route = {view:'reader',reading:'ep4',readingRow:'ep4:step-24:text',readingRev:'rev',storyType:'main',storySection:'101',story:'chapter.json'}
for (const scope of ['', 'chapter']) {
  assert.equal(readerScopeForViewport({...route,readingScope:scope},true),'','mobile always uses one EP')
  assert.equal(readerScopeForViewport({...route,readingScope:scope},false),'chapter','desktop promotes formal collection entries to whole chapter')
}
for (const extra of [{storyType:'idol_story'},{storyType:'work'},{storyType:''},{storySection:''}]) assert.equal(readerScopeForViewport({...route,...extra},false),'','non-collection routes remain single documents')
assert.equal(readerScopeForViewport({...route,view:'player',readingScope:'chapter'},true),'chapter','Player restoration keeps its explicit proof')
// Event episodes read as one directory chapter on desktop; phones still read one EP at a time.
const eventRoute = {view:'reader',reading:'ev-ep1',event:'430005'}
assert.equal(readerScopeForViewport(eventRoute,false),'chapter','desktop reads an event as one continuous chapter')
assert.equal(readerScopeForViewport(eventRoute,true),'','mobile reads one event EP at a time')
assert.equal(readerScopeForViewport({...eventRoute,storyType:'work'},false),'','an event context does not promote other story types')
assert.equal(route.readingRow,'ep4:step-24:text'); assert.equal(route.readingRev,'rev')
console.log('Reader viewport defaults: single EP on mobile, formal chapter or event directory on desktop, Player and non-collection identity preserved')
