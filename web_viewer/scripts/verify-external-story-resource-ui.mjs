import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  buildExternalStoryNavigationEntries,
  externalResourcesForCollection,
  externalResourcesForEvent,
  externalResourcesForIdolStory,
  externalResourcesForStory,
} from '../src/data/externalStoryResources.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const viewerRoot = path.resolve(scriptDirectory, '..')
const readViewerFile = relativePath =>
  readFile(path.join(viewerRoot, relativePath), 'utf8')

const [
  registry,
  eventComponent,
  storyComponent,
  collectionComponent,
  idolStoryComponent,
  navigationComponent,
  storyCatalogComponent,
  appComponent,
  idolEpisodeIndex,
] = await Promise.all([
  readViewerFile('public/data/external_story_resources.json').then(JSON.parse),
  readViewerFile('src/components/archive/ArchiveEventDetail.vue'),
  readViewerFile('src/components/archive/ArchiveStoryDetail.vue'),
  readViewerFile('src/components/archive/ArchiveStoryCollection.vue'),
  readViewerFile('src/components/archive/ArchiveIdolStory.vue'),
  readViewerFile('src/components/archive/ArchiveExternalStoryResources.vue'),
  readViewerFile('src/components/archive/ArchiveStoryCatalog.vue'),
  readViewerFile('src/App.vue'),
  readViewerFile('public/data/masterdata/idol_episode_index.json').then(JSON.parse),
])

assert.deepEqual(
  externalResourcesForEvent(registry, '10008').map(entry => entry.platform.bvid),
  ['BV1ac411S7KB'],
)
assert.deepEqual(
  externalResourcesForEvent(registry, '30014').map(entry => entry.platform.bvid),
  ['BV1od4y1x7X6'],
)
assert.deepEqual(
  externalResourcesForStory(registry, {
    resourceId: '1_3_10008_01',
    resourceIds: ['1_3_10008_01'],
    file: '1_3_10008_01.json',
  }).map(entry => entry.platform.bvid),
  ['BV1ac411S7KB'],
)
assert.deepEqual(
  externalResourcesForStory(registry, {
    resourceId: '1_1_013_01_a',
    resourceIds: ['1_1_013_01_a'],
    file: '1_1_013the_01_1_1_013_01.json',
  }).map(entry => entry.platform.bvid),
  ['BV1LL411G7LD'],
)
assert.deepEqual(
  externalResourcesForStory(registry, {
    resourceId: '1_1_013_02_a',
    resourceIds: ['1_1_013_02_a'],
    file: '1_1_013the_02_1_1_013_02.json',
  }).map(entry => entry.platform.bvid),
  ['BV1xA4y1S7Cb'],
)
assert.deepEqual(
  externalResourcesForStory(registry, {
    resourceId: '1_1_013_03_a',
    resourceIds: ['1_1_013_03_a'],
    file: '1_1_013the_03_1_1_013_03.json',
  }).map(entry => entry.platform.bvid),
  ['BV16u4y187tH'],
)
assert.deepEqual(
  externalResourcesForCollection(registry, {
    chapters: [
      {
        id: 'chapter-1',
        story: {
          file: '1_1_013the_01_1_1_013_01.json',
        },
      },
      {
        id: 'chapter-2',
        story: {
          file: '1_1_013the_02_1_1_013_02.json',
        },
      },
      {
        id: 'chapter-3',
        story: {
          file: '1_1_013the_03_1_1_013_03.json',
        },
      },
    ],
  }).map(entry => [entry.chapterId, entry.resource.platform.bvid]),
  [
    ['chapter-1', 'BV1LL411G7LD'],
    ['chapter-2', 'BV1xA4y1S7Cb'],
    ['chapter-3', 'BV16u4y187tH'],
  ],
)
assert.deepEqual(
  externalResourcesForIdolStory(registry, {
    sections: [{
      id: 23901,
      episodes: ['a', 'b', 'c', 'd', 'e'].map(part => ({
        resource_id: `1_2_039_01_${part}`,
      })),
    }],
  }).map(entry => [entry.sectionId, entry.resource.platform.bvid]),
  [[23901, 'BV1HPKDz5E2u']],
)
assert.deepEqual(
  externalResourcesForIdolStory(registry, {
    sections: [{
      id: 24001,
      episodes: ['a', 'b', 'c', 'd', 'e'].map(part => ({
        resource_id: `1_2_040_01_${part}`,
      })),
    }],
  }).map(entry => [entry.sectionId, entry.resource.platform.bvid]),
  [[24001, 'BV113KfzrEHj']],
)

const navigationEntries = buildExternalStoryNavigationEntries(registry, {
  events: [
    { event_id: 410008, event_code: '10008', title: 'GROWING SIGN@L -K.now O.nly-' },
    { event_id: 430014, event_code: '30014', title: 'GROWING SELECTION -PROOF OF ONESELF-' },
  ],
  collections: [{
    title: 'THE 虎牙道',
    domain: 'unit_story',
    sectionId: '13',
    visualUrl: '/assets/stories/units/image_unit_story_button_13the.png',
    chapters: [
      { id: 'chapter-1', label: '第1話', title: '漢たちの闘う理由', story: { file: '1_1_013the_01_1_1_013_01.json' } },
      { id: 'chapter-2', label: '第2話', title: '新しい闘いのステージへ', story: { file: '1_1_013the_02_1_1_013_02.json' } },
      { id: 'chapter-3', label: '第3話', title: '忘却の過去', story: { file: '1_1_013the_03_1_1_013_03.json' } },
    ],
  }],
})

assert.deepEqual(
  navigationEntries.map(entry => [
    entry.resource.platform.bvid,
    entry.target.kind,
    entry.target.event?.event_id || entry.target.storyFile,
  ]),
  [
    ['BV1ac411S7KB', 'event', 410008],
    ['BV1od4y1x7X6', 'event', 430014],
    ['BV1LL411G7LD', 'collection', '1_1_013the_01_1_1_013_01.json'],
    ['BV1xA4y1S7Cb', 'collection', '1_1_013the_02_1_1_013_02.json'],
    ['BV16u4y187tH', 'collection', '1_1_013the_03_1_1_013_03.json'],
  ],
)
assert.deepEqual(
  buildExternalStoryNavigationEntries(registry, {
    idolEpisodes: idolEpisodeIndex,
  }).map(entry => [
    entry.resource.platform.bvid,
    entry.target.kind,
    entry.target.idolCode,
    entry.target.sectionId,
  ]),
  [
    ['BV1ZM411S7bV', 'idol-story', '038tak', 23801],
    ['BV1HPKDz5E2u', 'idol-story', '039mcr', 23901],
    ['BV113KfzrEHj', 'idol-story', '040ren', 24001],
  ],
)
assert.deepEqual(
  buildExternalStoryNavigationEntries({
    entries: [{
      external_id: 'future-exact-story',
      internal_mapping: {
        state: 'exact-story',
        event_id: null,
        collection_ids: [],
        story_resource_ids: ['1_4_001_01'],
      },
    }],
  }, {
    stories: [{
      resourceId: '1_4_001_01',
      file: '1_4_001_01.json',
      title: 'Chapter story',
      domainLabel: '主线剧情',
    }],
  }).map(entry => [entry.kind, entry.target.kind, entry.target.story.resourceId]),
  [['story', 'story', '1_4_001_01']],
  'future exact-story records must resolve through the story catalog',
)
assert.equal(
  buildExternalStoryNavigationEntries({
    entries: [
      ...registry.entries,
      {
        external_id: 'candidate',
        internal_mapping: {
          state: 'candidate',
          event_id: '10008',
          collection_ids: [],
        },
      },
    ],
  }, {
    events: [
      { event_id: 410008, event_code: '10008', title: 'event 1' },
      { event_id: 430014, event_code: '30014', title: 'event 2' },
    ],
    collections: [],
  }).length,
  2,
  'dedicated navigation must exclude candidate mappings',
)
assert.equal(externalResourcesForEvent(registry, '10001').length, 0)
assert.equal(
  externalResourcesForStory(registry, { resourceId: '1_4_001_01' }).length,
  0,
)

for (const [name, source] of [
  ['ArchiveEventDetail', eventComponent],
  ['ArchiveStoryDetail', storyComponent],
  ['ArchiveStoryCollection', collectionComponent],
  ['ArchiveIdolStory', idolStoryComponent],
  ['ArchiveExternalStoryResources', navigationComponent],
]) {
  assert.match(source, /:href="(?:entry\.)?resource\.platform\.canonical_url"/, `${name} must use registry URL`)
  assert.match(source, /target="_blank"/, `${name} must open an external tab`)
  assert.match(
    source,
    /rel="noopener noreferrer external"/,
    `${name} must isolate external navigation`,
  )
  assert.match(source, /社区中文(?:资源|剧情)/, `${name} must label the link as a community resource`)
  assert.match(source, /(?:entry\.)?resource\.uploader\.name/, `${name} must show uploader attribution`)
}

assert.match(navigationComponent, /emit\('open-internal', entry\)/, 'navigation must retain an internal archive action')
assert.match(navigationComponent, /不镜像视频、字幕、封面或头像/, 'navigation must state the mirror boundary')
assert.match(storyCatalogComponent, /社区中文剧情/, 'story portal must expose the dedicated navigation')
assert.match(storyCatalogComponent, /open-external-resources/, 'story portal gateway must emit a navigation action')
assert.match(
  appComponent,
  /:external-resources="currentStoryCollectionExternalResources"/,
  'App must pass exact collection resources to ArchiveStoryCollection',
)
assert.match(
  appComponent,
  /v-if="view === 'external_story_resources'"/,
  'App must render the dedicated external resource view',
)
assert.match(
  appComponent,
  /:initial-chapter-id="currentStoryCollectionChapter\?\.id \|\| ''"/,
  'App must preserve exact unit-story chapter targeting',
)
assert.match(
  appComponent,
  /:external-resources="currentIdolStoryExternalResources"/,
  'App must pass exact personal-story resources to ArchiveIdolStory',
)
assert.match(
  appComponent,
  /idolEpisodes: idolEpisodeData\.value/,
  'dedicated navigation must resolve exact personal stories through idol_episode_index',
)
assert.match(
  appComponent,
  /'external_story_resources',[\s\S]*await ensureIdolCommunicationData\(\)/,
  'direct external-resource routes must load idol_episode_index before rendering',
)
assert.match(
  appComponent,
  /target\?\.kind === 'idol-story'/,
  'dedicated navigation must retain an internal personal-story action',
)

console.log('External Story resource UI verified: exact mappings and safe links')
