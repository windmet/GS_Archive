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
const [master, presentation, gashaIndex, appSource, catalogSource, collectionSource] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
  readJson('public/data/masterdata/gasha_index.json'),
  readText('src/App.vue'),
  readText('src/components/archive/ArchiveStoryCatalog.vue'),
  readText('src/components/archive/ArchiveStoryCollection.vue'),
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

const extra = buildExtraStoryDomainIdentity(master, gashaIndex)
assert.equal(extra.meta.collectionCount, 10)
assert.equal(extra.meta.officialCollectionCount, 6)
assert.equal(extra.meta.supplementaryCollectionCount, 4)
assert.equal(extra.meta.masterGroupCount, 47)
assert.equal(extra.meta.logicalEntryCount, 47)
assert.equal(extra.meta.resourceIdCount, 45)
assert.equal(extra.meta.compiledFileCount, 44)

const catalog = buildStoryCatalog(master, presentation)
const collections = buildStoryCollections(master, catalog, { extraDomain: extra })
  .filter(collection => collection.domain === 'extra')
assert.equal(collections.length, 10)
assert.equal(collections.reduce((sum, collection) => sum + collection.chapterCount, 0), 47)
assert.equal(collections.reduce((sum, collection) => sum + collection.playableEpisodeCount, 0), 47)

const sharedChapters = collections.flatMap(collection => collection.chapters)
  .filter(chapter => chapter.file === '5_03_000_22.json')
assert.equal(sharedChapters.length, 4)
assert.deepEqual(
  [...new Set(sharedChapters.map(chapter => chapter.episodes[0].file))].sort(),
  ['episodes/5_03_000_22_a.json', 'episodes/5_03_000_22_b.json'],
)

const newYear2023 = collections.find(collection => collection.sectionId === '608')
assert.equal(newYear2023.title, '謹賀新年2023')
assert.equal(newYear2023.chapterCount, 17)
assert.ok(newYear2023.legacySectionIds.includes('60801'))

const astrology = collections.find(collection => collection.sectionId === '606')
assert.equal(astrology.title, 'GROWING FES -終夜のアストロロジー-')
assert.equal(astrology.gasha.code, '300031')
assert.equal(astrology.gasha.id, '1300033')
assert.deepEqual(
  astrology.gasha.derived_pickup_cards.map(card => card.card_resource_id),
  ['023har_ssr02', '040ren_ssr03', '044ame_ssr02'],
)

assert.match(appSource, /:extra-domain="extraStoryDomain"/)
assert.match(appSource, /extraDomain: extraStoryDomain\.value/)
assert.match(appSource, /collection\.legacySectionIds\?\.includes\(currentStorySection\.value\)/)
assert.match(appSource, /\['main', 'unit_story', 'extra', 'birthday'\]\.includes\(domain\)/)
assert.match(appSource, /returnsToDomainLanding = \['main', 'extra', 'birthday'\]\.includes\(domain\)/)
assert.match(catalogSource, /mode === 'portal' && domain === 'extra'/)
assert.match(catalogSource, /官方 Extra Story/)
assert.match(catalogSource, /其他特别剧情记录/)
assert.match(catalogSource, /@media \(max-width: 620px\).*\.extra-card-grid, \.birthday-card-grid \{ grid-template-columns: 1fr;/s)
assert.match(collectionSource, /RELATED GASHA/)
assert.match(collectionSource, /分类核对来源/)

console.log('Extra story domain landing: 6 official works + 4 supplements, 47 chapters, New Year 2023 and FES gasha relation verified')
