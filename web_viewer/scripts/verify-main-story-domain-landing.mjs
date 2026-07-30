import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMainStoryDomainIdentity } from '../src/data/storyDomainIdentityIndex.js'
import { readArchiveRoute } from '../src/core/archiveRoute.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readText = relative => readFile(path.join(root, relative), 'utf8')
const storyMaster = JSON.parse(await readText('public/data/masterdata/story_master_index.json'))
const [appSource, catalogSource] = await Promise.all([
  readText('src/App.vue'),
  readText('src/components/archive/ArchiveStoryCatalog.vue'),
])

const route = readArchiveRoute('http://localhost/?view=story_catalog&story_type=main')
assert.equal(route.view, 'story_catalog')
assert.equal(route.storyType, 'main')
assert.equal(route.storyMode, 'portal')

const main = buildMainStoryDomainIdentity(storyMaster)
assert.equal(main.collections.length, 3)
assert.deepEqual(main.collections.map(collection => collection.masterId), ['101', '102', '103'])
assert.deepEqual(main.collections.map(collection => collection.chapterCount), [11, 11, 0])
assert.deepEqual(main.collections.map(collection => collection.logicalEntryCount), [102, 102, 0])
assert.equal(main.collections[2].isPlaceholder, true)

assert.match(appSource, /:main-domain="mainStoryDomain"/)
assert.match(appSource, /buildMainStoryDomainIdentity\(storyMasterData\.value\)/)
assert.match(
  appSource,
  /currentStoryMode\.value === 'portal' && currentStoryDomain\.value === 'main'/,
)
assert.match(appSource, /mode === 'portal' && domain === 'main'/)
assert.match(appSource, /commitView\('story_catalog'\)/)
assert.match(
  appSource,
  /currentStoryMode\.value === 'portal' && currentStoryDomain\.value === 'main'[\s\S]+currentStoryDomain\.value = ''[\s\S]+commitView\('story_catalog'\)/,
)
assert.match(appSource, /returnsToDomainLanding = \['main', 'extra'\]\.includes\(domain\)/)

assert.match(catalogSource, /class="main-domain-landing"/)
assert.match(catalogSource, /openDomain\('main'\)/)
assert.match(catalogSource, /:disabled="collection\.isPlaceholder"/)
assert.match(catalogSource, /尚无已发布话目/)
assert.match(catalogSource, /未公开/)
assert.match(catalogSource, /@click="browse\('main', collection\.masterId\)"/)
assert.match(
  catalogSource,
  /@media \(max-width: 620px\)[\s\S]+\.main-domain-grid \{ grid-template-columns: 1fr; \}/,
)

console.log('Main story domain landing: route, 3 collections, placeholder and UI wiring verified')
