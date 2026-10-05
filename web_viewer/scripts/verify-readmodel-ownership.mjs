import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VALID_VIEWS } from '../src/core/archiveRoute.js'

// App.vue releases a read-model catalogue whenever the current view is not one of its
// owners. A misspelt owner silently frees data the page is showing (the gasha catalogue
// was released the moment it opened because its owner was written 'gasha_catalog').
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const block = app.match(/watch\(view,next=> \{[\s\S]*?\n\},\{flush:'post'\}\)/)?.[0]
assert.ok(block, 'catalogue ownership watcher exists')
const entries = [...block.matchAll(/\[(\w+ReadModel(?:Catalog|Detail)|legacy\w+)(?:,(\w+))?,\[([^\]]*)\]\]/g)]
  .map(([, first, second, owners]) => ({ refs: [first, second].filter(Boolean), owners: [...owners.matchAll(/'([^']+)'/g)].map(m => m[1]) }))
assert.ok(entries.length >= 10, `ownership table parsed (${entries.length} entries)`)

for (const { refs, owners } of entries) {
  assert.ok(owners.length, `${refs.join('/')} has owners`)
  for (const owner of owners) assert.ok(VALID_VIEWS.has(owner), `${refs.join('/')} owner '${owner}' is not a real view`)
}
// The listing view of each domain must own its own catalogue.
const ownersOf = ref => entries.find(entry => entry.refs.includes(ref))?.owners || []
for (const [ref, view] of [['gashaReadModelCatalog', 'gashas'], ['cardReadModelCatalog', 'cards'], ['songReadModelCatalog', 'song_catalog'],
  ['eventReadModelCatalog', 'event_catalog'], ['unitReadModelCatalog', 'unit_catalog'], ['storyReadModelCatalog', 'story_catalog']]) {
  assert.ok(ownersOf(ref).includes(view), `${ref} must survive on its own listing view '${view}'`)
}
console.log(`Read-model ownership: ${entries.length} entries name only real views; each listing view keeps its catalogue`)
