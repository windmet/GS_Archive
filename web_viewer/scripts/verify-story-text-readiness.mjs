import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { storyTextNeeds, withStoryText, STORY_TEXT_WAIT_MS } from '../src/localization/story/StoryTextReadiness.js'
import { uiLocale } from '../src/localization/ui/UiLocaleStore.js'

// Every story page's read-model loader passes through withStoryText with a declared page kind.
const sources = ['useStoryNavigation', 'useStoryArchiveNavigation', 'useEventNavigation', 'useMobileNavigation']
  .map(name => readFileSync(new URL(`../src/composables/${name}.js`, import.meta.url), 'utf8')).join('\n')
const wired = new Set([...sources.matchAll(/withStoryText\('([a-z_]+)'/g)].map(match => match[1]))
assert.deepEqual([...wired].sort(), ['collection', 'event', 'idol_story', 'mobile', 'seasonal', 'story', 'work'])
for (const kind of wired) assert.doesNotThrow(() => storyTextNeeds(kind, null), `${kind} is declared`)
assert.throws(() => storyTextNeeds('unknown', null), /Unknown story page kind/)

// The page's reading documents are the titles it waits for.
const detail = { view: { readingEntries: [{ document_id: 'a' }, { document_id: 'b' }, {}] } }
assert.deepEqual(storyTextNeeds('collection', detail), { documents: ['a', 'b'], names: [] })
assert.deepEqual(storyTextNeeds('work', detail).names, ['profiles', 'photos'])
assert.deepEqual(storyTextNeeds('event', detail).names, ['cards'])

// A translation download that never answers holds the page for at most the wait, then lets it show.
globalThis.fetch = () => new Promise(() => {})
let waited = 0
const result = await withStoryText('event', detail, { timer: (resolve, ms) => { waited = ms; resolve() } })
assert.equal(result, detail)
assert.equal(waited, STORY_TEXT_WAIT_MS)
assert.ok(STORY_TEXT_WAIT_MS <= 1500, 'a page never waits long for optional translations')

// Japanese readers see the source text; nothing is awaited.
uiLocale.value = 'ja-JP'
waited = 0
await withStoryText('event', detail, { timer: (resolve, ms) => { waited = ms; resolve() } })
assert.equal(waited, 0)
console.log(`Story text readiness: ${wired.size} story page kinds wait for their titles and names, at most ${STORY_TEXT_WAIT_MS} ms, Chinese only`)
