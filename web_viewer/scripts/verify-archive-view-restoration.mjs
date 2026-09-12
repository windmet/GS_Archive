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
  'ArchiveStoryCatalog.vue': ['data-archive-scroll-container', 'event:${entry.id}', 'story:${entry.id}'],
})) {
  const source = readFileSync(new URL(`../src/components/archive/${file}`, import.meta.url), 'utf8')
  for (const marker of markers) assert.ok(source.includes(marker), `${file} exposes ${marker}`)
}

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
assert.ok(app.includes('captureActiveArchiveView()\n  navigation.invalidate()'), 'view commits capture the outgoing page')
assert.ok(app.includes('adoptArchiveViewContext()'), 'history restoration adopts the active entry before DOM restore')
console.log('Archive view restoration: history-entry exact state, route fallback, scroll clamp, focus and list markers passed')
