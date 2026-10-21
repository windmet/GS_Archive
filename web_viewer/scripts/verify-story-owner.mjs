// Every story in the release read model has exactly one page, and that page really lists the story.
// Runs the runtime resolver (src/core/StoryOwner.js) over the local read-model candidate whose release is
// the checked-in one (or SIDEM_READMODEL_CANDIDATE); the navigation harness (verify-story-navigation.mjs)
// covers the wiring in CI.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchingCandidate } from './lib/archive-bootstrap-plugin.mjs'
import { loadArchiveSources } from './lib/archive-sources.mjs'
import { landingCollectionSections, storyOwner, storyOwnerNeedsLanding } from '../src/core/StoryOwner.js'

const webViewer = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const release = JSON.parse(readFileSync(path.join(webViewer, 'readmodels/bootstrap.inline.json'), 'utf8')).release
const candidate = process.env.SIDEM_READMODEL_CANDIDATE
  ? path.resolve(process.env.SIDEM_READMODEL_CANDIDATE)
  : matchingCandidate(loadArchiveSources().readmodelCandidatesRoot, release)
assert.ok(candidate, `no read-model candidate for release ${release.slice(0, 8)}`)
const bootstrap = JSON.parse(readFileSync(path.join(candidate, 'bootstrap.inline.json'), 'utf8'))
assert.equal(bootstrap.release, release)

const text = url => readFileSync(path.join(candidate, 'pages', url), 'utf8')
const load = url => { const value = JSON.parse(text(url)); return value.data ?? value }
const rowsOf = descriptor => { const index = load(descriptor.url); return index.pages.flatMap(page => load(page.url).rows) }
const lists = (url, file) => text(url).includes(`"${file}"`)

const storyIndex = load(bootstrap.domains.stories.url)
const stories = rowsOf(bootstrap.domains.stories)
assert.equal(stories.length, bootstrap.counts.catalog_story_entries)
const landing = Object.fromEntries(['main', 'extra', 'birthday'].map(key => [key, load(storyIndex.landing[key].url).value]))
const facts = { idolIds: new Set(bootstrap.idols.map(idol => idol.id)), sections: landingCollectionSections(landing) }
const collections = rowsOf(bootstrap.domains.collections)
const ownerRows = {
  event_detail: new Map(rowsOf(bootstrap.domains.events).map(row => [String(row.id), row])),
  idol_story_archive: new Map(rowsOf(bootstrap.domains['idol-stories']).map(row => [String(row.id), row])),
  work_archive: new Map(rowsOf(bootstrap.domains.work).map(row => [String(row.id), row])),
}

const tally = new Map(), failures = []
for (const story of stories) {
  const owner = storyOwner(story, facts)
  const key = `${story.domain} → ${owner?.view || 'none'}`
  tally.set(key, (tally.get(key) || 0) + 1)
  if (!owner) { failures.push(`${story.file}: no owner`); continue }
  if (owner.view === 'story_collection') {
    const row = collections.find(entry => entry.domain === owner.domain &&
      (entry.sectionId === owner.section || entry.legacySectionIds?.includes(owner.section)))
    if (!row || !lists(row.detail.url, story.file)) failures.push(`${story.file}: ${owner.domain}:${owner.section} does not list it`)
    if (storyOwnerNeedsLanding(story) && !facts.sections.has(`${story.domain}:${story.file}`)) failures.push(`${story.file}: landing misses it`)
  } else if (owner.view !== 'mobile_archive') {
    const row = ownerRows[owner.view].get(owner.view === 'event_detail' ? owner.event : owner.idol)
    if (!row || !lists(row.detail.url, story.file)) failures.push(`${story.file}: ${owner.view} ${owner.event || owner.idol} does not list it`)
  }
}

console.table(Object.fromEntries([...tally].sort()))
assert.deepEqual(failures.slice(0, 20), [], `${failures.length} stories have no page that lists them`)
// Guard against a hollow pass: every kind of story must have been resolved to its own page.
for (const [domain, view] of [['main', 'story_collection'], ['unit_story', 'story_collection'], ['extra', 'story_collection'],
  ['birthday', 'story_collection'], ['event', 'event_detail'], ['idol_story', 'idol_story_archive'], ['work', 'work_archive'],
  ['card_scenarios', 'mobile_archive']]) assert.ok(tally.get(`${domain} → ${view}`) > 0, `no ${domain} story resolved to ${view}`)
console.log(`Story owner: all ${stories.length} stories open a page that lists them; none falls back to the story detail page`)
