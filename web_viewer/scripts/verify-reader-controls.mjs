import assert from 'node:assert/strict'
import { readerChapterNeighbour, readerSegmentNeighbour, visibleReaderDocument } from '../src/presentation/ReaderControls.js'

const chapters = [{id:'a',documentId:'first',storyFile:'a.json'}, {id:'gap',documentId:'',storyFile:'gap.json'}, {id:'c',documentId:'third',storyFile:'c.json'}]
assert.equal(readerChapterNeighbour({chapters,chapterId:'a'}, -1), null)
assert.equal(readerChapterNeighbour({chapters,chapterId:'a'}, 1), null, 'missing neighbour is not silently skipped')
assert.equal(readerChapterNeighbour({chapters,chapterId:'unknown'}, 1), null)
assert.equal(readerChapterNeighbour({chapters,chapterId:'gap'}, 1), chapters[2])
assert.equal(readerChapterNeighbour(null, 1), null)
const segments = [{documentId:'first'}, {episodeKey:'missing'}, {documentId:'third'}]
assert.equal(readerSegmentNeighbour(segments, 'first', -1), null)
assert.equal(readerSegmentNeighbour(segments, 'first', 1), null)
assert.equal(readerSegmentNeighbour(segments, 'first', 1, true), segments[1], 'whole-chapter placeholder remains locatable')
assert.equal(readerSegmentNeighbour(segments, 'unknown', 1), null)
assert.equal(readerSegmentNeighbour(segments, 'missing', 1, true), segments[2], 'scrolling to an ungenerated EP still has a correct next EP')
assert.equal(visibleReaderDocument([{documentId:'a',top:-500,bottom:60},{documentId:'b',top:60,bottom:500}],100,'route'), 'b')
assert.equal(visibleReaderDocument([{documentId:'a',top:150,bottom:500}],100,'route'), 'a')
assert.equal(visibleReaderDocument([],100,'route'), 'route')
assert.deepEqual(segments, [{documentId:'first'}, {episodeKey:'missing'}, {documentId:'third'}], 'navigation never mutates membership')
console.log('Reader controls: formal adjacent chapters, EP boundaries, placeholders and scroll-only location passed')
