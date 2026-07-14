import assert from 'node:assert/strict'
import {
  archiveSectionForRoute,
  buildArchiveUrl,
  normalizeArchiveRoute,
  readArchiveRoute,
} from '../src/core/archiveRoute.js'

const legacyScenario = readArchiveRoute('http://localhost/?file=1_4_001_01')
assert.equal(legacyScenario.view, 'player')
assert.equal(legacyScenario.scenario, '1_4_001_01.json')

const invalidFilters = readArchiveRoute('http://localhost/?view=story_catalog&availability=nope&sort=nope&event_scope=mixed_unit_event')
assert.equal(invalidFilters.availability, 'all')
assert.equal(invalidFilters.sort, 'domain')
assert.equal(invalidFilters.eventScope, 'all')

assert.deepEqual(
  normalizeArchiveRoute({ view: 'idol_detail', idol: '001tom' }),
  {
    view: 'idol_detail', category: 'idol', idol: '001tom', group: '', unit: '', unitFilter: '',
    storyType: '', eventScope: 'all', availability: 'all', sort: 'domain', episode: '', card: '',
    gasha: '', gashaType: 'all', rarity: 'all', assetState: 'all', relationState: 'all', query: '',
    scenario: '', voice: '', returnView: '',
  },
)

assert.equal(normalizeArchiveRoute({ view: 'idol_detail' }).view, 'idols')
assert.equal(normalizeArchiveRoute({ view: 'unit_detail' }).view, 'unit_catalog')
assert.equal(normalizeArchiveRoute({ view: 'gasha_detail' }).view, 'gashas')
assert.equal(normalizeArchiveRoute({ view: 'episodes' }).view, 'episode_zero_units')
assert.equal(normalizeArchiveRoute({ view: 'player' }).view, 'home')
assert.equal(normalizeArchiveRoute({ view: 'player', card: '001tom_n01', voice: '2_1_001_01_01_01' }).view, 'player')

assert.equal(archiveSectionForRoute({ view: 'idol_detail', idol: '001tom' }), 'idols')
assert.equal(archiveSectionForRoute({ view: 'groups', category: 'idol_chat', group: 'chat-1' }), 'interactions')
assert.equal(archiveSectionForRoute({ view: 'card_detail', card: '001tom_n01' }), 'cards')
assert.equal(archiveSectionForRoute({ view: 'archive_status' }), 'resources')

const sourceRoute = {
  view: 'card_detail',
  idol: '001tom',
  card: '001tom_n01',
  rarity: 'N',
  assetState: 'complete_icons',
  relationState: 'card_story',
  query: '冬馬',
}
const builtUrl = buildArchiveUrl('http://localhost/?unknown=kept&file=old', sourceRoute)
assert.equal(builtUrl.searchParams.get('unknown'), 'kept')
assert.equal(builtUrl.searchParams.has('file'), false)
assert.deepEqual(readArchiveRoute(builtUrl.href), normalizeArchiveRoute(sourceRoute))

console.log('Archive route contract: 18 assertions passed')
