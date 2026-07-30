import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { buildStoryCollections } from '../src/data/storyCollections.js'
import { buildExtraStoryDomainIdentity } from '../src/data/storyDomainIdentityIndex.js'
import { readArchiveRoute } from '../src/core/archiveRoute.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readText = relative => readFile(path.join(root, relative), 'utf8')
const readJson = relative => readText(relative).then(JSON.parse)
const [master, presentation, appSource, catalogSource] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
  readText('src/App.vue'),
  readText('src/components/archive/ArchiveStoryCatalog.vue'),
])

const route = readArchiveRoute('http://localhost/?view=story_catalog&story_type=extra&q=315&unit_filter=01jup&rarity=SSR')
assert.equal(route.view, 'story_catalog')
assert.equal(route.storyType, 'extra')
assert.equal(route.storyMode, 'portal')
assert.equal(route.query, '315')
assert.equal(route.unitFilter, '01jup')
assert.equal(route.rarity, 'SSR')

const collectionRoute = readArchiveRoute('http://localhost/?view=story_collection&story_type=extra&story_section=60201&q=315')
assert.equal(collectionRoute.view, 'story_collection')
assert.equal(collectionRoute.storyType, 'extra')
assert.equal(collectionRoute.storySection, '60201')
assert.equal(collectionRoute.query, '315')

const extra = buildExtraStoryDomainIdentity(master)
assert.equal(extra.meta.collectionCount, 47)
assert.equal(extra.meta.logicalEntryCount, 47)
assert.equal(extra.meta.resourceIdCount, 45)
assert.equal(extra.meta.compiledFileCount, 44)

const catalog = buildStoryCatalog(master, presentation)
const collections = buildStoryCollections(master, catalog).filter(collection => collection.domain === 'extra')
assert.equal(collections.length, 47)
assert.ok(collections.every(collection => collection.chapterCount === 1))
assert.ok(collections.every(collection => collection.playableEpisodeCount === 1))

const sharedCollections = collections.filter(collection =>
  collection.chapters[0].file === '5_03_000_22.json')
assert.equal(sharedCollections.length, 4)
assert.equal(new Set(sharedCollections.map(collection => collection.sectionId)).size, 4)
assert.deepEqual(
  [...new Set(sharedCollections.map(collection => collection.chapters[0].episodes[0].file))].sort(),
  ['episodes/5_03_000_22_a.json', 'episodes/5_03_000_22_b.json'],
)

assert.match(appSource, /:extra-domain="extraStoryDomain"/)
assert.match(appSource, /\['main', 'unit_story', 'extra', 'birthday'\]\.includes\(domain\)/)
assert.match(appSource, /returnsToDomainLanding = \['main', 'extra', 'birthday'\]\.includes\(domain\)/)
assert.match(catalogSource, /mode === 'portal' && domain === 'extra'/)
assert.match(catalogSource, /共享编译文件不会合并目录身份/)
assert.match(catalogSource, /@media \(max-width: 620px\).*\.extra-card-grid, \.birthday-card-grid \{ grid-template-columns: 1fr;/s)

console.log('Extra story domain landing: 47 logical collections, 45 resource identities, 44 playback files verified')
