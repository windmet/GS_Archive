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
const episodePlayer = readArchiveRoute('http://localhost/?view=player&scenario=episodes%2F1_4_001_00_b.json&start_step=1&end_step=33&return=story_collection')
assert.equal(episodePlayer.scenario, 'episodes/1_4_001_00_b.json')
assert.equal(episodePlayer.startStep, 1)
assert.equal(episodePlayer.endStep, 33)
assert.equal(invalidFilters.availability, 'all')
assert.equal(invalidFilters.sort, 'domain')
assert.equal(invalidFilters.eventScope, 'all')

assert.deepEqual(
  normalizeArchiveRoute({ view: 'idol_detail', idol: '001tom' }),
  {
    view: 'idol_detail', homeIdol: '', homeCue: '', homeCostume: '', category: 'idol', idol: '001tom', group: '', unit: '', unitFilter: '',
    storyType: '', storyMode: 'portal', storySection: '', story: '', mobileMode: 'personal', mobileScenario: '', eventScope: 'all', availability: 'all', sort: 'domain', episode: '', card: '',
    gasha: '', gashaType: 'all', rarity: 'all', assetState: 'all', relationState: 'all', query: '',
    event: '', scenario: '', startStep: 0, endStep: 0, voice: '', returnView: '', parentView: '',
  },
)

assert.equal(normalizeArchiveRoute({ view: 'idol_detail' }).view, 'idol_detail')
assert.equal(normalizeArchiveRoute({ view: 'idol_detail' }).idol, '001tom')
assert.equal(normalizeArchiveRoute({ view: 'cards' }).view, 'cards')
assert.equal(normalizeArchiveRoute({ view: 'cards' }).idol, '001tom')
assert.equal(normalizeArchiveRoute({ view: 'unit_detail' }).view, 'unit_catalog')
assert.equal(normalizeArchiveRoute({ view: 'gasha_detail' }).view, 'gashas')
assert.equal(normalizeArchiveRoute({ view: 'event_detail' }).view, 'story_catalog')
assert.equal(normalizeArchiveRoute({ view: 'story_detail' }).view, 'story_catalog')
assert.equal(normalizeArchiveRoute({ view: 'story_collection' }).view, 'story_catalog')
assert.equal(normalizeArchiveRoute({ view: 'external_story_resources' }).view, 'external_story_resources')
assert.equal(normalizeArchiveRoute({ view: 'seasonal_campaign' }).view, 'seasonal_campaign')
assert.equal(normalizeArchiveRoute({ view: 'work_archive' }).view, 'work_archive')
assert.equal(normalizeArchiveRoute({ view: 'idol_story_archive' }).view, 'idol_story_archive')
assert.equal(normalizeArchiveRoute({ view: 'mobile_archive' }).view, 'mobile_archive')
assert.equal(normalizeArchiveRoute({ view: 'episodes' }).view, 'episode_zero_units')
assert.equal(normalizeArchiveRoute({ view: 'player' }).view, 'home')
assert.equal(normalizeArchiveRoute({ view: 'player', card: '001tom_n01', voice: '2_1_001_01_01_01' }).view, 'player')

assert.equal(archiveSectionForRoute({ view: 'idol_detail', idol: '001tom' }), 'idols')
assert.equal(archiveSectionForRoute({ view: 'groups', category: 'idol_chat', group: 'chat-1' }), 'interactions')
assert.equal(archiveSectionForRoute({ view: 'card_detail', card: '001tom_n01' }), 'cards')
assert.equal(archiveSectionForRoute({ view: 'archive_status' }), 'resources')
assert.equal(archiveSectionForRoute({ view: 'event_detail', event: '410018' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'story_detail', story: '1_4_001_01.json' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'story_collection', storyType: 'main', storySection: '101' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'external_story_resources' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'seasonal_campaign', storyType: 'seasonal_campaign', storySection: 'valentine_2023' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'work_archive', storyType: 'work', idol: '001tom' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'idol_story_archive', idol: '001tom' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'mobile_archive', idol: '001tom', mobileMode: 'phone' }), 'interactions')

const legacyIdolRoot = readArchiveRoute('http://localhost/?view=idols&category=idol')
assert.equal(legacyIdolRoot.view, 'idol_detail')
assert.equal(legacyIdolRoot.idol, '001tom')
const legacyCardRoot = readArchiveRoute('http://localhost/?view=idols&category=cards')
assert.equal(legacyCardRoot.view, 'cards')
assert.equal(legacyCardRoot.idol, '001tom')
const legacyChatRoot = readArchiveRoute('http://localhost/?view=idols&category=idol_chat')
assert.equal(legacyChatRoot.view, 'mobile_archive')
assert.equal(legacyChatRoot.idol, '001tom')
assert.equal(legacyChatRoot.mobileMode, 'personal')
assert.equal(archiveSectionForRoute(legacyChatRoot), 'interactions')
const legacyPhoneRoot = readArchiveRoute('http://localhost/?view=idols&category=idol_phone&idol=040ren')
assert.equal(legacyPhoneRoot.view, 'mobile_archive')
assert.equal(legacyPhoneRoot.idol, '040ren')
assert.equal(legacyPhoneRoot.mobileMode, 'phone')

const mobileContext = readArchiveRoute('http://localhost/?view=mobile_archive&idol=001tom&unit=01jup&mobile_mode=phone&mobile_scenario=2010209')
assert.equal(mobileContext.view, 'mobile_archive')
assert.equal(mobileContext.idol, '001tom')
assert.equal(mobileContext.unit, '01jup')
assert.equal(mobileContext.mobileMode, 'phone')
assert.equal(mobileContext.mobileScenario, '2010209')
assert.equal(buildArchiveUrl('http://localhost/', mobileContext).searchParams.get('mobile_mode'), 'phone')
assert.equal(readArchiveRoute('http://localhost/?view=mobile_archive&mobile_mode=invalid').mobileMode, 'personal')

const workContext = readArchiveRoute('http://localhost/?view=work_archive&story_type=work&idol=001tom')
assert.equal(workContext.view, 'work_archive')
assert.equal(workContext.storyType, 'work')
assert.equal(workContext.idol, '001tom')

const seasonalContext = readArchiveRoute('http://localhost/?view=seasonal_campaign&story_type=seasonal_campaign&story_section=white_day_2022')
assert.equal(seasonalContext.view, 'seasonal_campaign')
assert.equal(seasonalContext.storySection, 'white_day_2022')

const storyDetailContext = readArchiveRoute('http://localhost/?view=story_detail&story=1_4_001_01&story_type=main&story_mode=search&story_section=101')
assert.equal(storyDetailContext.view, 'story_detail')
assert.equal(storyDetailContext.story, '1_4_001_01.json')
assert.equal(storyDetailContext.storyMode, 'search')
assert.equal(storyDetailContext.storySection, '101')

const storyCollectionContext = readArchiveRoute('http://localhost/?view=story_collection&story_type=unit_story&story_section=1')
assert.equal(storyCollectionContext.view, 'story_collection')
assert.equal(storyCollectionContext.storyType, 'unit_story')
assert.equal(storyCollectionContext.storySection, '1')

const externalStoryResourceContext = readArchiveRoute('http://localhost/?view=external_story_resources')
assert.equal(externalStoryResourceContext.view, 'external_story_resources')

const externalStoryDetailContext = readArchiveRoute(
  'http://localhost/?view=story_detail&story=1_4_001_01.json&parent=external_story_resources',
)
assert.equal(externalStoryDetailContext.view, 'story_detail')
assert.equal(externalStoryDetailContext.parentView, 'external_story_resources')

const externalStoryCollectionContext = readArchiveRoute(
  'http://localhost/?view=story_collection&story_type=unit_story&story_section=13&story=1_1_013the_02_1_1_013_02.json&parent=external_story_resources',
)
assert.equal(externalStoryCollectionContext.view, 'story_collection')
assert.equal(externalStoryCollectionContext.story, '1_1_013the_02_1_1_013_02.json')
assert.equal(externalStoryCollectionContext.parentView, 'external_story_resources')
assert.equal(
  buildArchiveUrl('http://localhost/', externalStoryCollectionContext).searchParams.get('story'),
  '1_1_013the_02_1_1_013_02.json',
)

const storyCollectionPlayer = readArchiveRoute('http://localhost/?view=player&story_type=main&story_section=101&scenario=1_4_001_01.json&start_step=30&end_step=60&return=story_collection')
assert.equal(storyCollectionPlayer.returnView, 'story_collection')
assert.equal(storyCollectionPlayer.storySection, '101')
assert.equal(buildArchiveUrl('http://localhost/', storyCollectionPlayer).searchParams.get('start_step'), '30')
assert.equal(buildArchiveUrl('http://localhost/', storyCollectionPlayer).searchParams.get('end_step'), '60')

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

const eventEpisodeContext = readArchiveRoute('http://localhost/?view=player&scenario=1_3_10001_01.json&start_step=31&return=event_detail&event=410001')
assert.equal(eventEpisodeContext.startStep, 31)
assert.equal(eventEpisodeContext.endStep, 0)
assert.equal(buildArchiveUrl('http://localhost/', eventEpisodeContext).searchParams.get('start_step'), '31')
assert.equal(readArchiveRoute('http://localhost/?view=player&scenario=1_3_10001_01.json&start_step=nope').startStep, 0)
assert.equal(readArchiveRoute('http://localhost/?view=player&scenario=1_3_10001_01.json&end_step=nope').endStep, 0)

console.log('Archive route contract: story portal and detail routes verified')
