import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { useEpisodeQueue } from '../src/core/useEpisodeQueue.js'
import { buildStoryCatalog } from '../src/data/storyCatalog.js'
import { buildStoryCollections } from '../src/data/storyCollections.js'

const read = name => JSON.parse(readFileSync(new URL(`../public/data/masterdata/${name}.json`, import.meta.url), 'utf8'))
const collections = buildStoryCollections(read('story_master_index'), buildStoryCatalog(read('story_catalog'), read('story_presentation_index')))
let checked = 0, sharedFileRanges = 0
for (const collection of collections.filter(item => ['main', 'unit_story'].includes(item.domain))) {
  const episodes = collection.chapters.flatMap(chapter => chapter.episodes || [])
  const playable = episodes.filter(episode => episode.exists !== false && episode.file)
  for (let i = 0; i < playable.length; i++) {
    const expected = playable[i], queue = useEpisodeQueue()
    assert.ok(queue.restore(episodes, expected.file, expected))
    assert.equal(queue.current.value.id, expected.id)
    assert.equal(queue.current.value.startStep, expected.startStep)
    assert.equal(queue.current.value.endStep, expected.endStep)
    assert.equal(queue.hasNext.value, i < playable.length - 1)
    assert.equal(queue.next()?.id, playable[i + 1]?.id ?? undefined)
    checked++
    if (playable.findIndex(item => item.file === expected.file) !== i) sharedFileRanges++
  }
}
assert.ok(checked > 0, 'corpus must exercise playable ranges')
const episodes = [
  { id: 'a', file: 'same.json', startStep: 2, endStep: 10 },
  { id: 'b', file: 'same.json', startStep: 12, endStep: 20 },
  { id: 'missing', file: 'missing.json', exists: false },
]
const queue = useEpisodeQueue(), other = useEpisodeQueue()
assert.ok(queue.restore(episodes, 'same.json')) // legacy file-only URL
assert.equal(queue.current.value.id, 'a')
assert.ok(queue.restore(episodes, 'same.json', { startStep: '12', endStep: '20' }))
assert.equal(queue.current.value.id, 'b')
assert.equal(queue.hasNext.value, false)
assert.equal(queue.next(), null)
assert.equal(other.current.value, null)
assert.equal(queue.restore(episodes, 'same.json', { startStep: 99 }), false)
assert.equal(queue.current.value, null)
assert.equal(queue.restore(episodes, 'missing.json'), false)
queue.start(episodes, 0)
episodes[0].file = 'changed.json'
assert.equal(queue.current.value.file, 'same.json', 'queue snapshots membership fields')
queue.clear()
assert.equal(queue.hasNext.value, false)
assert.equal(queue.start(episodes, -1), null)
console.log(`Episode queue: ${checked} corpus ranges (${sharedFileRanges} shared-file later segments), next, restore, isolation and clearing passed`)
