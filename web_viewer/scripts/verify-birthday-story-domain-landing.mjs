import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { buildStoryCollections } from '../src/data/storyCollections.js'
import { buildBirthdayStoryDomainIdentity } from '../src/data/storyDomainIdentityIndex.js'
import { readArchiveRoute } from '../src/core/archiveRoute.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readText = relative => readFile(path.join(root, relative), 'utf8')
const readJson = relative => readText(relative).then(JSON.parse)
const [master, presentation, idolUnit, speakerDictionary, repositorySource, appSource, catalogSource] = await Promise.all([
  readJson('public/data/masterdata/story_master_index.json'),
  readJson('public/data/masterdata/story_presentation_index.json'),
  readJson('public/data/masterdata/idol_unit_dictionary.json'),
  readJson('public/data/masterdata/speaker_dictionary.json'),
  readText('src/data/ArchiveDataRepository.js'),
  readText('src/App.vue'),
  readText('src/components/archive/ArchiveStoryCatalog.vue'),
])

const route = readArchiveRoute('http://localhost/?view=story_catalog&story_type=birthday&q=冬馬&unit_filter=01jup&rarity=SSR')
assert.equal(route.view, 'story_catalog')
assert.equal(route.storyType, 'birthday')
assert.equal(route.storyMode, 'portal')
assert.equal(route.query, '冬馬')
assert.equal(route.unitFilter, '01jup')
assert.equal(route.rarity, 'SSR')

const collectionRoute = readArchiveRoute('http://localhost/?view=story_collection&story_type=birthday&story_section=001tom&q=冬馬')
assert.equal(collectionRoute.view, 'story_collection')
assert.equal(collectionRoute.storyType, 'birthday')
assert.equal(collectionRoute.storySection, '001tom')
assert.equal(collectionRoute.query, '冬馬')

const birthday = buildBirthdayStoryDomainIdentity(master, idolUnit, speakerDictionary)
assert.equal(birthday.meta.collectionCount, 50)
assert.equal(birthday.meta.logicalEntryCount, 181)
assert.equal(birthday.meta.resolvedIdolEntryCount, 176)
assert.equal(birthday.meta.resolvedNpcEntryCount, 5)
assert.equal(birthday.meta.unresolvedEntryCount, 0)
assert.equal(birthday.meta.crossDomainSharedFileCount, 29)

const catalog = buildStoryCatalog(master, presentation)
const collections = buildStoryCollections(master, catalog, { birthdayDomain: birthday })
  .filter(collection => collection.domain === 'birthday')
assert.equal(collections.length, 50)
assert.equal(collections.reduce((sum, collection) => sum + collection.chapterCount, 0), 181)
assert.equal(collections.reduce((sum, collection) => sum + collection.playableChapterCount, 0), 181)

const toma = collections.find(collection => collection.sectionId === '001tom')
assert.equal(toma.title, '天ヶ瀬 冬馬 生日剧情')
assert.equal(toma.chapterCount, 4)
assert.deepEqual(
  [...new Set(toma.chapters.map(chapter => chapter.label))].sort(),
  ['偶像生日祝福', '制作人生日问候', '生日短篇'].sort(),
)
const ken = collections.find(collection => collection.sectionId === '101ken')
assert.equal(ken.subject.kind, 'npc')
assert.equal(ken.title, '山村 賢 生日剧情')
assert.equal(ken.chapterCount, 5)

const sharedChapters = collections.flatMap(collection => collection.chapters)
  .filter(chapter => chapter.domainMemberships.length > 1)
assert.equal(sharedChapters.length, 29)
assert.ok(sharedChapters.every(chapter => chapter.domainMemberships.includes('idol_story')))
assert.ok(sharedChapters.every(chapter => chapter.file && chapter.episodes[0].file === chapter.file))

assert.match(repositorySource, /speakerDictionary: '\/data\/masterdata\/speaker_dictionary\.json'/)
assert.match(appSource, /:birthday-domain="birthdayStoryDomain"/)
assert.match(appSource, /\['main', 'unit_story', 'birthday'\]\.includes\(domain\)/)
assert.match(appSource, /returnsToBirthdayLanding/)
assert.match(catalogSource, /mode === 'portal' && domain === 'birthday'/)
assert.match(catalogSource, /@media \(max-width: 620px\).*birthday-card-grid \{ grid-template-columns: 1fr;/s)

console.log('Birthday story domain landing: 50 subjects, 181 logical records, 29 cross-domain playback files verified')
