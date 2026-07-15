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
    view: 'idol_detail', homeIdol: '', homeCue: '', homeCostume: '', category: 'idol', idol: '001tom', group: '', unit: '', unitFilter: '',
    storyType: '', storyMode: 'portal', storySection: '', story: '', eventScope: 'all', availability: 'all', sort: 'domain', episode: '', card: '',
    gasha: '', gashaType: 'all', rarity: 'all', assetState: 'all', relationState: 'all', query: '',
    event: '', scenario: '', voice: '', returnView: '', parentView: '',
  },
)

assert.equal(normalizeArchiveRoute({ view: 'idol_detail' }).view, 'idols')
assert.equal(normalizeArchiveRoute({ view: 'unit_detail' }).view, 'unit_catalog')
assert.equal(normalizeArchiveRoute({ view: 'gasha_detail' }).view, 'gashas')
assert.equal(normalizeArchiveRoute({ view: 'event_detail' }).view, 'story_catalog')
assert.equal(normalizeArchiveRoute({ view: 'story_detail' }).view, 'story_catalog')
assert.equal(normalizeArchiveRoute({ view: 'episodes' }).view, 'episode_zero_units')
assert.equal(normalizeArchiveRoute({ view: 'player' }).view, 'home')
assert.equal(normalizeArchiveRoute({ view: 'player', card: '001tom_n01', voice: '2_1_001_01_01_01' }).view, 'player')

assert.equal(archiveSectionForRoute({ view: 'idol_detail', idol: '001tom' }), 'idols')
assert.equal(archiveSectionForRoute({ view: 'groups', category: 'idol_chat', group: 'chat-1' }), 'interactions')
assert.equal(archiveSectionForRoute({ view: 'card_detail', card: '001tom_n01' }), 'cards')
assert.equal(archiveSectionForRoute({ view: 'archive_status' }), 'resources')
assert.equal(archiveSectionForRoute({ view: 'event_detail', event: '410018' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'story_detail', story: '1_4_001_01.json' }), 'stories')

const storyDetailContext = readArchiveRoute('http://localhost/?view=story_detail&story=1_4_001_01&story_type=main&story_mode=search&story_section=101')
assert.equal(storyDetailContext.view, 'story_detail')
assert.equal(storyDetailContext.story, '1_4_001_01.json')
assert.equal(storyDetailContext.storyMode, 'search')
assert.equal(storyDetailContext.storySection, '101')

const homeContext = readArchiveRoute('http://localhost/?home_idol=040ren&home_cue=2_1_040_01_00_09&home_costume=040ren_101_00')
assert.equal(homeContext.view, 'home')
assert.equal(homeContext.homeIdol, '040ren')
assert.equal(homeContext.homeCue, '2_1_040_01_00_09')
assert.equal(homeContext.homeCostume, '040ren_101_00')
const homeUrl = buildArchiveUrl('http://localhost/?view=cards&idol=001tom', homeContext)
assert.equal(homeUrl.searchParams.get('home_idol'), '040ren')
assert.equal(homeUrl.searchParams.get('home_cue'), '2_1_040_01_00_09')
assert.equal(homeUrl.searchParams.get('home_costume'), '040ren_101_00')
const cardsUrl = buildArchiveUrl(homeUrl, { ...homeContext, view: 'cards', idol: '040ren' })
assert.equal(cardsUrl.searchParams.has('home_idol'), false)
assert.equal(cardsUrl.searchParams.has('home_cue'), false)
assert.equal(cardsUrl.searchParams.has('home_costume'), false)
const homeEventContext = readArchiveRoute('http://localhost/?view=event_detail&event=430018&parent=home')
assert.equal(homeEventContext.view, 'event_detail')
assert.equal(homeEventContext.parentView, 'home')

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

const cardDetailContext = readArchiveRoute('http://localhost/?view=card_detail&idol=001tom&card=001tom_ssr01&rarity=SSR&q=Jupiter')
assert.equal(cardDetailContext.query, 'Jupiter')
assert.equal(cardDetailContext.rarity, 'SSR')
assert.equal(cardDetailContext.category, 'cards')

const gashaDetailContext = readArchiveRoute('http://localhost/?view=gasha_detail&gasha=10028&gasha_type=standard_pickup&q=summer')
assert.equal(gashaDetailContext.query, 'summer')
assert.equal(gashaDetailContext.gashaType, 'standard_pickup')

const eventDetailContext = readArchiveRoute('http://localhost/?view=event_detail&event=410018&parent=card_detail&card=040ren_sr13&idol=040ren')
assert.equal(eventDetailContext.view, 'event_detail')
assert.equal(eventDetailContext.event, '410018')
assert.equal(eventDetailContext.parentView, 'card_detail')

const idolEventContext = readArchiveRoute('http://localhost/?view=event_detail&event=410018&parent=idol_detail&idol=040ren')
assert.equal(idolEventContext.view, 'event_detail')
assert.equal(idolEventContext.idol, '040ren')
assert.equal(idolEventContext.parentView, 'idol_detail')

const groupChatContext = readArchiveRoute('http://localhost/?view=files&category=idol_chat&idol=001jup&group=8_2_x_001jup_8_2_1_001')
assert.equal(groupChatContext.view, 'files')
assert.equal(groupChatContext.category, 'idol_chat')
assert.equal(groupChatContext.idol, '001jup')
assert.equal(groupChatContext.group, '8_2_x_001jup_8_2_1_001')

const eventPlayerContext = readArchiveRoute('http://localhost/?view=player&scenario=1_3_10001_01.json&return=event_detail&parent=unit_detail&event=410001&unit=16cfi')
assert.equal(eventPlayerContext.view, 'player')
assert.equal(eventPlayerContext.event, '410001')
assert.equal(eventPlayerContext.returnView, 'event_detail')
assert.equal(eventPlayerContext.parentView, 'unit_detail')
assert.equal(eventPlayerContext.unit, '16cfi')

console.log('Archive route contract: story portal and detail routes verified')
