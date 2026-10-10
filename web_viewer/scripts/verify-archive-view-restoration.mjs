import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildArchiveViewContext,
  captureArchiveViewState,
  readArchiveViewRestoration,
  restoreArchiveViewState,
  saveArchiveViewRestoration,
} from '../src/core/archiveViewRestoration.js'

class MemoryStorage {
  #values = new Map()
  getItem(key) { return this.#values.get(key) ?? null }
  setItem(key, value) { this.#values.set(key, String(value)) }
}

const storage = new MemoryStorage()
const route = 'http://localhost/?view=cards&category=cards&idol=001tom&rarity=SSR&q=Jupiter'
const entryA = buildArchiveViewContext(route, { sidemArchiveEntryId: 'entry-a' })
const entryB = buildArchiveViewContext(route, { sidemArchiveEntryId: 'entry-b' })
const routeOnly = buildArchiveViewContext(route)

saveArchiveViewRestoration(entryA, { scrollTop: 240, focusId: 'card:001tom_ssr01' }, storage)
saveArchiveViewRestoration(entryB, { scrollTop: 620, focusId: 'card:001tom_ssr03' }, storage)
assert.deepEqual(
  readArchiveViewRestoration(entryA, storage),
  { key: entryA.entryKey, scrollTop: 240, focusId: 'card:001tom_ssr01' },
  'browser history entries on the same route retain independent positions',
)
assert.equal(readArchiveViewRestoration(routeOnly, storage).scrollTop, 620,
  'a custom Back entry falls back to the latest position for the same canonical route')

const scrollContainer = { scrollTop: 0, scrollHeight: 900, clientHeight: 400 }
let focused = false
const focusTarget = {
  dataset: { archiveFocusId: 'card:001tom_ssr03' },
  focus(options) { focused = options?.preventScroll === true },
}
const restoreRoot = {
  querySelector: selector => selector === '[data-archive-scroll-container]' ? scrollContainer : null,
  querySelectorAll: () => [focusTarget],
}
assert.equal(await restoreArchiveViewState(entryB, { root: restoreRoot, storage }), true)
assert.equal(scrollContainer.scrollTop, 500, 'restored scroll is clamped to the rendered list extent')
assert.equal(focused, true, 'selected entity regains focus without moving the restored scroll')

// A page returning from history that renders its data a few frames later still reaches the saved
// depth, and a reader who scrolls during that time keeps their own position.
{
  const frames = []
  globalThis.requestAnimationFrame = callback => frames.push(callback)
  const flush = async count => { for (let i = 0; i < count; i++) { frames.splice(0).forEach(run => run()); await new Promise(resolve => setTimeout(resolve, 0)) } }
  const growing = { scrollTop: 0, scrollHeight: 900, clientHeight: 400 }
  const root = { querySelector: () => growing, querySelectorAll: () => [] }
  const restored = restoreArchiveViewState(entryB, { root, storage })
  await flush(2)
  assert.equal(await restored, true)
  assert.equal(growing.scrollTop, 500, 'the first frame applies what exists')
  growing.scrollHeight = 1400
  await flush(3)
  assert.equal(growing.scrollTop, 620, 'the restore follows the page as its data renders')

  const interrupted = { scrollTop: 0, scrollHeight: 700, clientHeight: 400 }
  const pending = restoreArchiveViewState(entryB, { root: { querySelector: () => interrupted, querySelectorAll: () => [] }, storage })
  await flush(2); await pending
  assert.equal(interrupted.scrollTop, 300)
  interrupted.scrollTop = 120
  interrupted.scrollHeight = 1400
  await flush(3)
  assert.equal(interrupted.scrollTop, 120, 'a reader who scrolls stops the restore')
  delete globalThis.requestAnimationFrame
}

scrollContainer.scrollTop = 315
const captureRoot = {
  activeElement: {
    closest: () => ({ dataset: { archiveFocusId: 'card:001tom_ssr02' } }),
  },
  querySelector: () => scrollContainer,
}
assert.equal(captureArchiveViewState(entryA, { root: captureRoot, storage }), true)
assert.deepEqual(readArchiveViewRestoration(entryA, storage).scrollTop, 315)
assert.equal(readArchiveViewRestoration(entryA, storage).focusId, 'card:001tom_ssr02')

for (const [file, markers] of Object.entries({
  'ArchiveCardList.vue': ['data-archive-scroll-container', 'card:${card.resource_id}'],
  'ArchiveSongCatalog.vue': ['data-archive-scroll-container', 'song:${song.song_code}'],
  'ArchiveGashaCatalog.vue': ['data-archive-scroll-container', 'gasha:${gasha.id}'],
  'ArchiveStoryCatalog.vue': ['data-archive-scroll-container', 'StoryDiscovery', 'EventStoryCard'],
  'StoryDiscovery.vue': ['story:${entry.id}'],
  'EventStoryCard.vue': ['event:${entry.id}'],
  'ArchiveIdolGrid.vue': ['data-archive-scroll-container', 'idol:${entry.id}'],
  'ArchiveSongDetail.vue': ['data-archive-scroll-container', 'song-unit:${song.unit.id}', 'song-audio:${props.song.id}', 'song-performer:${props.song.id}'],
  'ArchiveCardDetail.vue': ['data-archive-scroll-container'],
  'ArchiveUnitDetail.vue': ['data-archive-scroll-container'],
  'ArchiveGashaDetail.vue': ['data-archive-scroll-container'],
  'ArchiveMobileArchive.vue': ['data-archive-scroll-container'],
  'ArchiveIdolReference.vue': ['idol-reference:${reference.idolCode}'],
  'ArchiveRelationList.vue': ['relation:${item.id}'],
})) {
  const source = readFileSync(new URL(`../src/components/archive/${file}`, import.meta.url), 'utf8')
  for (const marker of markers) assert.ok(source.includes(marker), `${file} exposes ${marker}`)
}

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
assert.ok(app.includes('captureActiveArchiveView()\n  navigation.invalidate()'), 'view commits capture the outgoing page')
assert.ok(app.includes('adoptArchiveViewContext()'), 'history restoration adopts the active entry before DOM restore')
assert.ok(app.includes('adoptArchiveViewContext({ restore: restoreView, fresh: !replace })'), 'a pushed entry is marked fresh; replaced entries and history restores are not')
assert.ok(/if \(fresh && stayedOnView && view\.value !== 'reader' && !readArchiveViewRestoration\(context\)\) \{\n\s+document\.querySelector\('\[data-archive-scroll-container\]'\)\?\.scrollTo\(\{ top: 0 \}\)/.test(app),
  'a new entry on the same page (next card) starts at the top instead of the previous depth')
console.log('Archive view restoration: history-entry exact state, route fallback, scroll clamp, focus and list markers passed')
