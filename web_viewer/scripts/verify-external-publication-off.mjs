import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EXTERNAL_STORY_RESOURCES_ENABLED } from '../shared/deploy/ExternalStoryResourcePolicy.js'
import { createArchiveDataRepository } from '../src/data/ArchiveDataRepository.js'
import { serveR2Resource } from '../functions/_shared/r2-resource.js'
assert.equal(EXTERNAL_STORY_RESOURCES_ENABLED, false)
const requested = []
const repo = createArchiveDataRepository({ fetchImpl: async url => {
  requested.push(url)
  return new Response(null, { status: 503 })
} })
const archive = await repo.loadArchiveData()
assert.ok(!requested.includes('/data/external_story_resources.json'))
assert.ok(!archive.errors.some(error => error.key === 'externalStoryResources'))
let reads = 0
const env = { ARCHIVE_ASSETS: { head() { reads++; throw Error('withdrawn registry must not read R2') } } }
for (const method of ['GET', 'HEAD']) {
  const response = await serveR2Resource({ request: new Request('https://example.test/data/external_story_resources.json', { method }), env, prefix: 'data' })
  assert.equal(response.status, 410)
  assert.equal(response.headers.get('cache-control'), 'no-store')
}
assert.equal(reads, 0)
const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
assert.equal([...app.matchAll(/:external-resources="EXTERNAL_STORY_RESOURCES_ENABLED \? [^"\n]+ : \[\]"/g)].length, 4)
const view = await readFile(new URL('../src/components/archive/ArchiveExternalStoryResources.vue', import.meta.url), 'utf8')
assert.match(view, /<template v-if="EXTERNAL_STORY_RESOURCES_ENABLED">/)
assert.match(view, /站外视频导航已暂时关闭/)
console.log('External publication OFF: no registry request, four detail gates, neutral old route, GET/HEAD 410 without R2 read')
