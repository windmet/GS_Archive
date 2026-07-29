import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  externalResourcesForCollection,
  externalResourcesForEvent,
  externalResourcesForStory,
} from '../src/data/externalStoryResources.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const viewerRoot = path.resolve(scriptDirectory, '..')
const readViewerFile = relativePath =>
  readFile(path.join(viewerRoot, relativePath), 'utf8')

const [registry, eventComponent, storyComponent, collectionComponent, appComponent] = await Promise.all([
  readViewerFile('public/data/external_story_resources.json').then(JSON.parse),
  readViewerFile('src/components/archive/ArchiveEventDetail.vue'),
  readViewerFile('src/components/archive/ArchiveStoryDetail.vue'),
  readViewerFile('src/components/archive/ArchiveStoryCollection.vue'),
  readViewerFile('src/App.vue'),
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
assert.equal(externalResourcesForEvent(registry, '10001').length, 0)
assert.equal(
  externalResourcesForStory(registry, { resourceId: '1_4_001_01' }).length,
  0,
)

for (const [name, source] of [
  ['ArchiveEventDetail', eventComponent],
  ['ArchiveStoryDetail', storyComponent],
  ['ArchiveStoryCollection', collectionComponent],
]) {
  assert.match(source, /:href="resource\.platform\.canonical_url"/, `${name} must use registry URL`)
  assert.match(source, /target="_blank"/, `${name} must open an external tab`)
  assert.match(
    source,
    /rel="noopener noreferrer external"/,
    `${name} must isolate external navigation`,
  )
  assert.match(source, /社区中文资源/, `${name} must label the link as a community resource`)
  assert.match(source, /resource\.uploader\.name/, `${name} must show uploader attribution`)
}

assert.match(
  appComponent,
  /:external-resources="currentStoryCollectionExternalResources"/,
  'App must pass exact collection resources to ArchiveStoryCollection',
)

console.log('External Story resource UI verified: exact mappings and safe links')
