import assert from 'node:assert/strict'
import {
  archiveSectionForRoute,
  buildArchiveBreadcrumbs,
  buildArchiveSourceQuery,
  buildArchiveUrl,
  normalizeArchiveRoute,
  readArchiveRoute,
  readArchiveSourceRoute,
  writeArchiveRoute,
} from '../src/core/archiveRoute.js'

const legacyScenario = readArchiveRoute('http://localhost/?file=1_4_001_01')
assert.equal(legacyScenario.view, 'player')
assert.equal(legacyScenario.scenario, '1_4_001_01.json')

const filteredCards = readArchiveRoute('http://localhost/?view=cards&idol=001tom&rarity=SSR&asset_state=has_large&relation_state=event_card&q=冬馬')
const cardsSource = buildArchiveSourceQuery(filteredCards)
const sourcedCardUrl = buildArchiveUrl('http://localhost/', {
  view: 'card_detail',
  idol: '003hok',
  card: '003hok_sr01',
  sourceRoute: cardsSource,
})
const sourcedCard = readArchiveRoute(sourcedCardUrl)
assert.equal(sourcedCard.sourceRoute, cardsSource)
assert.deepEqual(readArchiveSourceRoute(sourcedCard.sourceRoute), filteredCards)
const eventSource = buildArchiveSourceQuery(readArchiveRoute(
  'http://localhost/?view=event_detail&event=430018&parent=card_detail&card=003hok_sr01&idol=003hok&from=' +
  encodeURIComponent(cardsSource),
))
assert.equal(new URL(eventSource, 'http://localhost/').searchParams.has('from'), false, 'detail source cannot recurse')
for (const badSource of ['https://example.com/', '?view=player&scenario=a.json', '?view=spine_lab', '?' + 'q'.repeat(8193)]) {
  assert.equal(readArchiveSourceRoute(badSource).view, 'home')
}
assert.equal(readArchiveSourceRoute('?view=portal').view, 'portal')
const labRoute = readArchiveRoute(buildArchiveUrl('http://localhost/', {
  view: 'spine_lab',
  sourceRoute: buildArchiveSourceQuery({ view: 'archive_status' }),
}))
assert.equal(labRoute.view, 'spine_lab')
assert.equal(readArchiveSourceRoute(labRoute.sourceRoute).view, 'archive_status')
const songSource = buildArchiveSourceQuery({ view: 'song_detail', song: 'brndnf' })
const stageRoute = readArchiveRoute(buildArchiveUrl('http://localhost/', {
  view: 'chibi_stage', song: 'brndnf', stageId: 'brndnf_live_effect', sourceRoute: songSource,
}))
assert.equal(stageRoute.view, 'chibi_stage')
assert.equal(stageRoute.song, 'brndnf')
assert.equal(stageRoute.stageId, 'brndnf_live_effect')
assert.equal(readArchiveSourceRoute(stageRoute.sourceRoute).song, 'brndnf')
assert.equal(readArchiveRoute('http://localhost/?view=chibi_stage&song=brndnf&stage=../invalid').stageId, '')
assert.equal(buildArchiveUrl('http://localhost/?stage=stale', { view: 'song_detail', song: 'brndnf' }).searchParams.has('stage'), false)

const invalidFilters = readArchiveRoute('http://localhost/?view=story_catalog&availability=nope&sort=nope&event_scope=mixed_unit_event')
assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/', {view:'story_catalog',storyMode:'search',sort:'latest'})).sort,'latest')
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
    view: 'idol_detail', pickTarget: '', homeIdol: '', homeCue: '', homeCostume: '', category: 'idol', idol: '001tom', unit: '', unitFilter: '',
    storyType: '', storyMode: 'portal', storySection: '', story: '', workMode: 'stories', mobileMode: 'personal', mobileScenario: '', eventScope: 'all', availability: 'all', sort: 'domain', episode: '', card: '',
    gasha: '', gashaType: 'all', rarity: 'all', assetState: 'all', relationState: 'all', query: '', song: '', songScope: 'all',
    event: '', scenario: '', startStep: 0, endStep: 0, voice: '', returnView: '', parentView: '',
  },
)

assert.equal(normalizeArchiveRoute({ view: 'idol_detail' }).view, 'idol_picker')
assert.equal(normalizeArchiveRoute({ view: 'idol_detail' }).pickTarget, 'profile')
assert.equal(normalizeArchiveRoute({ view: 'cards' }).view, 'cards')
assert.equal(normalizeArchiveRoute({ view: 'cards' }).idol, '')
assert.equal(normalizeArchiveRoute({ view: 'unit_detail' }).view, 'unit_catalog')
assert.equal(normalizeArchiveRoute({ view: 'gasha_detail' }).view, 'gashas')
assert.equal(normalizeArchiveRoute({ view: 'event_detail' }).view, 'event_catalog')
assert.equal(normalizeArchiveRoute({ view: 'story_detail' }).view, 'story_catalog')
assert.equal(normalizeArchiveRoute({ view: 'story_collection' }).view, 'story_catalog')
assert.equal(normalizeArchiveRoute({ view: 'external_story_resources' }).view, 'external_story_resources')
assert.equal(normalizeArchiveRoute({ view: 'seasonal_campaign' }).view, 'seasonal_campaign')
assert.equal(normalizeArchiveRoute({ view: 'work_archive' }).pickTarget, 'work')
assert.equal(normalizeArchiveRoute({ view: 'idol_story_archive' }).pickTarget, 'story')
assert.equal(normalizeArchiveRoute({ view: 'mobile_archive' }).pickTarget, 'mobile')
assert.equal(normalizeArchiveRoute({ view: 'player' }).view, 'home')
assert.equal(normalizeArchiveRoute({ view: 'player', card: '001tom_n01', voice: '2_1_001_01_01_01' }).view, 'player')
// Yamamura's office lines preview without a card; other card-less voices still fall back.
assert.equal(normalizeArchiveRoute({ view: 'player', voice: '4_1_101_01_a1002', returnView: 'unused_archive' }).view, 'player')
assert.equal(normalizeArchiveRoute({ view: 'player', voice: '2_1_001_01_01_01' }).view, 'home')

assert.equal(archiveSectionForRoute({ view: 'idol_detail', idol: '001tom' }), 'idols')
assert.equal(archiveSectionForRoute({ view: 'card_detail', card: '001tom_n01' }), 'cards')
assert.equal(archiveSectionForRoute({ view: 'archive_status' }), 'resources')
assert.equal(archiveSectionForRoute({ view: 'event_detail', event: '410018' }), 'events')
assert.equal(archiveSectionForRoute({ view: 'story_detail', story: '1_4_001_01.json' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'story_collection', storyType: 'main', storySection: '101' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'external_story_resources' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'seasonal_campaign', storyType: 'seasonal_campaign', storySection: 'valentine_2023' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'work_archive', storyType: 'work', idol: '001tom' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'idol_story_archive', idol: '001tom' }), 'stories')
assert.equal(archiveSectionForRoute({ view: 'mobile_archive', idol: '001tom', mobileMode: 'phone' }), 'interactions')

// Hierarchy links go to the archive portal; original-source Back remains a
// separate context, even when the current detail was opened from another domain.
for (const route of [
  filteredCards,
  sourcedCard,
  { view: 'event_catalog', query: 'Cafe', eventScope: 'fixed_unit_event' },
  { view: 'event_detail', event: '410018', parentView: 'card_detail', sourceRoute: cardsSource },
  { view: 'song_catalog', query: 'Jupiter' },
  // A song's address is its identity; the unit page it was opened from rides the source (see verify-route-schema).
  { view: 'song_detail', song: 'brndnf', sourceRoute: cardsSource },
]) {
  const before = structuredClone(route)
  const currentUrl = buildArchiveUrl('http://localhost/', route)
  const root = buildArchiveBreadcrumbs(route)[0]
  assert.equal(root.label, '资料馆')
  const rootUrl = buildArchiveUrl(currentUrl, root.route)
  assert.equal(rootUrl.search, '?view=portal', `${route.view}: archive root must not open game home or carry detail state`)
  assert.deepEqual(route, before, `${route.view}: building the hierarchy must not change original-source Back`)
  assert.deepEqual(readArchiveRoute(currentUrl), normalizeArchiveRoute(before), `${route.view}: original URL retains its source and filters`)
}

const idolBreadcrumbs = buildArchiveBreadcrumbs(
  { view: 'idol_detail', idol: '001tom', parentView: 'home' },
  { title: '天道 輝', id: '001tom' },
)
assert.deepEqual(idolBreadcrumbs.map(item => item.label), ['资料馆', '偶像', '天道 輝'])
assert.equal(idolBreadcrumbs.at(-1).route, undefined)
assert.equal(idolBreadcrumbs[1].route.view, 'idols')
assert.equal(idolBreadcrumbs[1].route.parentView, '')

const cardBreadcrumbs = buildArchiveBreadcrumbs(
  {
    view: 'card_detail',
    idol: '001tom',
    card: '001tom_ssr01',
    query: 'Jupiter',
    unitFilter: '1',
    rarity: 'SSR',
    parentView: 'event_detail',
  },
  { title: '', id: '001tom_ssr01' },
)
assert.deepEqual(cardBreadcrumbs.map(item => item.label), ['资料馆', '卡片', '001tom_ssr01'])
assert.equal(cardBreadcrumbs[1].route.query, 'Jupiter')
assert.equal(cardBreadcrumbs[1].route.unitFilter, '1')
assert.equal(cardBreadcrumbs[1].route.rarity, 'SSR')
assert.equal(cardBreadcrumbs[1].route.parentView, '')

const eventBreadcrumbs = buildArchiveBreadcrumbs(
  {
    view: 'event_detail',
    event: '410018',
    storyType: 'event',
    eventScope: 'fixed_unit_event',
    query: 'Cafe',
  },
  { title: '活动标题' },
)
assert.deepEqual(eventBreadcrumbs.map(item => item.label), ['资料馆', '活动', '活动标题'])
assert.equal(eventBreadcrumbs[1].route.view, 'event_catalog')
assert.equal(eventBreadcrumbs[1].route.storyType, '')
assert.equal(eventBreadcrumbs[1].route.eventScope, 'fixed_unit_event')

const collectionBreadcrumbs = buildArchiveBreadcrumbs(
  {
    view: 'story_collection',
    storyType: 'unit_story',
    storySection: '13',
    story: '1_1_013the_01_1_1_013_01.json',
    parentView: 'external_story_resources',
  },
  { title: 'THE 虎牙道', domainLabel: '组合前传' },
)
assert.deepEqual(
  collectionBreadcrumbs.map(item => item.label),
  ['资料馆', '剧情', '组合前传', 'THE 虎牙道'],
)
assert.equal(collectionBreadcrumbs.length, 4)
assert.equal(collectionBreadcrumbs.at(-1).route, undefined)
assert.equal(collectionBreadcrumbs[2].route.parentView, '')
assert.equal(collectionBreadcrumbs[2].route.view, 'story_catalog')
// The unit prequel crumb opens its own landing, not the root catalogue.
assert.equal(collectionBreadcrumbs[2].route.storyType, 'unit_story')
assert.equal(collectionBreadcrumbs[2].route.storyMode, 'portal')

for (const [storyType, label, section] of [
  ['main', '主线剧情', '101'],
  ['extra', '额外剧情', '60201'],
  ['birthday', '生日剧情', '001tom'],
]) {
  const landingBreadcrumbs = buildArchiveBreadcrumbs({
    view: 'story_catalog',
    storyType,
    query: 'stable',
    unitFilter: '01jup',
    rarity: 'SSR',
  })
  assert.deepEqual(landingBreadcrumbs.map(item => item.label), ['资料馆', '剧情', label])
  assert.equal(landingBreadcrumbs[1].route.storyType, '')
  assert.equal(landingBreadcrumbs[1].route.query, 'stable')

  const formalCollectionBreadcrumbs = buildArchiveBreadcrumbs(
    {
      view: 'story_collection',
      storyType,
      storySection: section,
      query: 'stable',
      unitFilter: '01jup',
      rarity: 'SSR',
    },
    { title: `${label} collection`, domainLabel: label },
  )
  assert.equal(formalCollectionBreadcrumbs[2].route.storyType, storyType)
  assert.equal(formalCollectionBreadcrumbs[2].route.storyMode, 'portal')
  assert.equal(formalCollectionBreadcrumbs[2].route.query, 'stable')
  assert.equal(formalCollectionBreadcrumbs[2].route.unitFilter, '01jup')
  assert.equal(formalCollectionBreadcrumbs[2].route.rarity, 'SSR')
}

assert.deepEqual(
  buildArchiveBreadcrumbs({ view: 'external_story_resources' }).map(item => item.label),
  ['资料馆', '剧情', '社区剧情'],
)
assert.deepEqual(buildArchiveBreadcrumbs({ view: 'player', scenario: '1_4_001_01.json' }), [])
assert.deepEqual(buildArchiveBreadcrumbs({ view: 'spine_lab' }), [])
assert.deepEqual(buildArchiveBreadcrumbs({ view: 'chibi_stage' }), [])

const legacyIdolRoot = readArchiveRoute('http://localhost/?view=idols&category=idol')
assert.equal(legacyIdolRoot.view, 'idols')
assert.equal(legacyIdolRoot.idol, '')
const legacyCardRoot = readArchiveRoute('http://localhost/?view=idols&category=cards')
assert.equal(legacyCardRoot.view, 'idols')
assert.equal(legacyCardRoot.idol, '')
assert.equal(readArchiveRoute('http://localhost/?view=idols&category=cards&idol=002sht').view, 'cards')
const legacyChatRoot = readArchiveRoute('http://localhost/?view=idols&category=idol_chat')
assert.equal(legacyChatRoot.view, 'idol_picker')
assert.equal(legacyChatRoot.pickTarget, 'mobile')
assert.equal(legacyChatRoot.mobileMode, 'personal')
assert.equal(archiveSectionForRoute(legacyChatRoot), 'home')
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
assert.equal(workContext.workMode, 'stories')
const workLinesContext = readArchiveRoute('http://localhost/?view=work_archive&story_type=work&idol=002sht&work_mode=lines')
assert.equal(workLinesContext.workMode, 'lines')
assert.equal(buildArchiveUrl('http://localhost/', workLinesContext).searchParams.get('work_mode'), 'lines')
assert.equal(readArchiveRoute('http://localhost/?view=work_archive&work_mode=invalid').workMode, 'stories')

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

const mainStoryLandingContext = readArchiveRoute('http://localhost/?view=story_catalog&story_type=main')
assert.equal(mainStoryLandingContext.view, 'story_catalog')
assert.equal(mainStoryLandingContext.storyType, 'main')
assert.equal(mainStoryLandingContext.storyMode, 'portal')

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
// A card's address is its identity (/cards/<resource_id>/); the list filters it was opened from ride the
// history source, so the written URL drops them and reads back as the bare card.
assert.equal(builtUrl.search, '?unknown=kept&view=card_detail&card=001tom_n01')
assert.deepEqual(readArchiveRoute(builtUrl.href), normalizeArchiveRoute({ view: 'card_detail', card: '001tom_n01' }))

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

// The retired story file browser (groups › files, 第零话 › episodes › files): old links open the page that now owns
// what they showed. Story files become a story link (App opens the story's owner page); card stories and chats,
// which were never stories, open the idol's page or chats; a list opens its stories landing.
for (const [query, expected] of [
  ['view=episode_zero_units', '?view=story_catalog&story_type=unit_story'],
  ['view=episodes', '?view=story_catalog&story_type=unit_story'],
  ['view=episodes&unit=010caf', '?view=story_collection&story_type=unit_story&story_section=10'],
  ['view=files&category=episode_zero&unit=010caf&group=1_1_010caf_02_1_1_010_02', '?view=story_detail&story=1_1_010caf_02_1_1_010_02.json'],
  ['view=files&category=main_story&group=1_4_001', '?view=story_detail&story=1_4_001_00.json'],
  ['view=files&category=event&group=1_3_10001_01', '?view=story_detail&story=1_3_10001_01.json'],
  ['view=files&category=idol&idol=001tom&group=1_2_001tom_01_1_2_001_01', '?view=story_detail&story=1_2_001tom_01_1_2_001_01.json'],
  ['view=files&category=idol&idol=001tom&group=1_5_001tom_1_5_001_00_0', '?view=story_detail&story=1_5_001tom_1_5_001_00_0.json'],
  ['view=files&category=idol_phone&idol=029ass&group=1_x_029ass_2_1_2_029_22_t01', '?view=story_detail&story=1_x_029ass_2_1_2_029_22_t01.json'],
  ['view=files&category=idol&idol=001tom&group=001tom_301_x', '?view=idol_detail&category=idol&idol=001tom'],
  ['view=files&category=idol_chat&idol=001jup&group=8_2_x_001jup_8_2_1_001', '?view=unit_detail&unit=01jup'],
  ['view=files&category=idol_chat&group=8_2_x_016cfi_8_2_1_001', '?view=unit_detail&unit=16cfi'],
  ['view=groups&category=idol_chat&idol=010caf', '?view=unit_detail&unit=10caf'],
  ['view=files&category=idol_chat&idol=001tom&group=8_1_x_001tom_8_1_1_001', '?view=mobile_archive&idol=001tom'],
  ['view=files&category=extra&group=5_00_000_22', '?view=story_catalog&story_type=extra'],
  ['view=groups&category=idol&idol=001tom', '?view=idol_detail&category=idol&idol=001tom'],
  ['view=groups&category=idol_chat&idol=001tom', '?view=mobile_archive&idol=001tom'],
  ['view=groups&category=idol_phone&idol=001tom', '?view=mobile_archive&idol=001tom&mobile_mode=phone'],
  ['view=groups&category=main_story', '?view=story_catalog&story_type=main'],
  ['view=groups&category=event', '?view=story_catalog&story_type=event'],
  ['view=groups&category=episode_zero', '?view=story_catalog&story_type=unit_story'],
  ['view=groups', '?view=home'],
]) {
  const retired = readArchiveRoute(`http://localhost/?${query}`, { history: false })
  assert.equal(buildArchiveUrl('http://localhost/', retired).search, expected, `old link ${query}`)
}
// A player opened from a retired page has no page to return to.
assert.equal(readArchiveRoute('http://localhost/?view=player&scenario=a.json&return=files', { history: false }).returnView, '')

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

const songCatalogContext = readArchiveRoute('http://localhost/?view=song_catalog')
assert.equal(songCatalogContext.view, 'song_catalog')
assert.equal(songCatalogContext.songScope, 'all')

const filteredSongCatalogContext = readArchiveRoute('http://localhost/?view=song_catalog&song_scope=layered&q=drive')
assert.equal(filteredSongCatalogContext.songScope, 'layered')
assert.equal(filteredSongCatalogContext.query, 'drive')
assert.equal(buildArchiveUrl('http://localhost/', filteredSongCatalogContext).searchParams.get('song_scope'), 'layered')
assert.equal(songCatalogContext.song, '')
const songDetailContext = readArchiveRoute('http://localhost/?view=song_detail&song=drvalv')
assert.equal(songDetailContext.view, 'song_detail')
assert.equal(songDetailContext.song, 'drvalv')
assert.equal(archiveSectionForRoute(songDetailContext), 'songs')
assert.equal(normalizeArchiveRoute({ view: 'song_detail' }).view, 'song_catalog')
assert.equal(buildArchiveUrl('http://localhost/', songDetailContext).searchParams.get('song'), 'drvalv')
const songBreadcrumbs = buildArchiveBreadcrumbs({ view: 'song_detail', song: 'byndtd' }, { title: 'Beyond The Dream' })
assert.deepEqual(songBreadcrumbs.map(item => item.label), ['资料馆', '歌曲', 'Beyond The Dream'])
assert.equal(songBreadcrumbs[1].route.view, 'song_catalog')
assert.equal(songBreadcrumbs[1].route.song, '')
const songCatalogBreadcrumbs = buildArchiveBreadcrumbs({ view: 'song_catalog', song: '' })
assert.deepEqual(songCatalogBreadcrumbs.map(item => item.label), ['资料馆', '歌曲'])
assert.equal(songCatalogBreadcrumbs.length, 2)

// Return source is navigation context: the address bar stays canonical, history state carries the source.
{
  const entries = [{ state: null, href: 'http://localhost/?view=home' }]; let index = 0
  globalThis.window = { get location() { return new URL(entries[index].href) },
    get history() { return { get state() { return entries[index].state },
      pushState(state, _t, url) { entries.splice(index + 1); entries.push({ state, href: new URL(url, entries[index].href).href }); index++ },
      replaceState(state, _t, url) { entries[index] = { state, href: new URL(url, entries[index].href).href } } } } }
  try {
    const source = buildArchiveSourceQuery({ view: 'event_detail', event: '10001', parentView: 'unit_detail', category: 'idol', unit: '01jup' })
    assert.ok(source)
    writeArchiveRoute({ view: 'reader', reading: 'doc1', event: '10001', parentView: 'unit_detail', category: 'idol', unit: '01jup', sourceRoute: source })
    assert.ok(!new URL(window.location).searchParams.has('from'), 'source is not written into the address bar')
    assert.equal(readArchiveRoute().sourceRoute, source, 'same history entry restores the source (refresh, back)')
    assert.equal(readArchiveRoute(window.location.href).sourceRoute, undefined, 'a copied URL carries no source')
    assert.equal(readArchiveRoute(window.location.href, { history: true }).sourceRoute, source, 'startup of the current page merges its history source')
    writeArchiveRoute({ view: 'reader', reading: 'doc1', event: '10001', parentView: 'unit_detail', category: 'idol', unit: '01jup', sourceRoute: source }, { replace: true })
    assert.equal(readArchiveRoute().sourceRoute, source)
    writeArchiveRoute({ view: 'event_detail', event: '10001' })
    assert.ok(!readArchiveRoute().sourceRoute, 'a later entry without a source does not inherit the earlier one')
    index--; assert.equal(readArchiveRoute().sourceRoute, source, 'back restores the earlier entry source')
    entries[index] = { state: null, href: 'http://localhost/' + buildArchiveUrl('http://localhost/', { view: 'reader', reading: 'doc1', event: '10001', parentView: 'unit_detail', category: 'idol', unit: '01jup', sourceRoute: source }).search }
    assert.equal(readArchiveRoute().sourceRoute, source, 'legacy from= URL is still read')
    writeArchiveRoute(readArchiveRoute(), { replace: true })
    assert.ok(!new URL(window.location).searchParams.has('from'), 'legacy URL is shortened on the next write')
    assert.equal(readArchiveRoute().sourceRoute, source, 'and its source moved into history state')
    // An event Reader's placement (parent view, category, unit) rides history state; the URL keeps only the event identity.
    writeArchiveRoute({ view: 'reader', reading: 'doc1', event: '10001', parentView: 'unit_detail', category: 'idol', unit: '01jup' })
    const readerQuery = new URL(window.location).searchParams
    assert.ok(!readerQuery.has('parent') && !readerQuery.has('category') && !readerQuery.has('unit'), 'event Reader URL carries no placement')
    assert.equal(readerQuery.get('event'), '10001', 'event is Reader identity, not opener placement')
    assert.equal(readArchiveRoute().event, '10001')
    assert.deepEqual([readArchiveRoute().parentView, readArchiveRoute().category, readArchiveRoute().unit], ['unit_detail', 'idol', '01jup'], 'refresh restores the placement')
    assert.deepEqual([readArchiveRoute(window.location.href).parentView, readArchiveRoute(window.location.href).unit], ['', ''], 'a copied link carries no placement')
    entries[index] = { state: null, href: 'http://localhost/?view=reader&reading=doc1&event=10001&parent=unit_detail&category=idol&unit=01jup' }
    assert.equal(readArchiveRoute().unit, '01jup', 'legacy placement parameters are still read')
    writeArchiveRoute(readArchiveRoute(), { replace: true })
    assert.ok(!new URL(window.location).searchParams.has('unit') && readArchiveRoute().unit === '01jup', 'and move into state on the next write')
    writeArchiveRoute({ view: 'reader', reading: 'doc2', story_type: 'main', storyType: 'main', storySection: '101', category: 'cards' })
    assert.equal(new URL(window.location).searchParams.get('category'), null, 'non-event Reader placement also moves to history')
    assert.equal(readArchiveRoute().category, 'cards')
    assert.equal(readArchiveRoute().storyType, 'main')
    assert.equal(readArchiveRoute().storySection, '101')
    assert.equal(readArchiveRoute(window.location.href).storyType, 'main', 'independent shares retain their story directory')
    // Every Reader owner field survives refresh and replace, without entering a copied URL.
    for (const owner of [
      { storyType:'work', idol:'001tom', story:'work.json', workMode:'lines' },
      { storyType:'idol_story', idol:'001tom', storySection:'idol_story', episode:'1' },
      { storyType:'seasonal_campaign', storySection:'valentine_2022', idol:'001tom' },
      { storyType:'unit_story', storySection:'1', story:'part.json', unit:'01jup', parentView:'unit_detail' },
    ]) {
      const fixture = { ...owner, view:'reader', reading:'doc2', readingScope:'chapter', readingRow:'row1', readingMode:'bilingual', readingRev:'sha256:'+'a'.repeat(64) }
      writeArchiveRoute(fixture)
      for (const field of ['parent','category','unit']) assert.ok(!new URL(window.location).searchParams.has(field), field+' moves to history')
      const restored = readArchiveRoute()
      for (const [key,value] of Object.entries(fixture)) assert.equal(restored[key],value, 'refresh '+key)
      const entryId = window.history.state.sidemArchiveEntryId
      writeArchiveRoute(restored, { replace:true })
      assert.equal(window.history.state.sidemArchiveEntryId,entryId)
      for (const [key,value] of Object.entries(fixture)) assert.equal(readArchiveRoute()[key],value, 'replace '+key)
      assert.equal(readArchiveRoute(window.location.href).reading,'doc2')
      assert.equal(readArchiveRoute(window.location.href).storyType,owner.storyType)
    }
    // Portal / Home launcher returns ride the same versioned context.
    const portalReturn = '?view=idols&category=idol', homeReturn = '?view=portal'
    writeArchiveRoute({ view: 'portal', portalFrom: portalReturn })
    assert.ok(!new URL(window.location).searchParams.has('portal_from'), 'portal_from is not in the address bar')
    assert.equal(window.history.state.sidemArchiveNav.v, 1, 'context is versioned')
    assert.equal(readArchiveRoute().portalFrom, portalReturn, 'portal return restores from history state')
    assert.ok(!readArchiveRoute(window.location.href).portalFrom, 'a copied portal URL carries no return')
    writeArchiveRoute({ view: 'home', homeFrom: homeReturn })
    assert.ok(!new URL(window.location).searchParams.has('home_from'))
    assert.equal(readArchiveRoute().homeFrom, homeReturn, 'home return restores from history state')
    writeArchiveRoute({ view: 'portal' }, { replace: true })
    assert.ok(!readArchiveRoute().portalFrom && !window.history.state.sidemArchiveNav, 'empty context leaves no state')
    entries[index] = { state: { sidemArchiveSource: source }, href: 'http://localhost/?view=reader&reading=doc1' }
    assert.equal(readArchiveRoute().sourceRoute, source, 'pre-versioned history entries still restore their source')
    entries[index] = { state: null, href: 'http://localhost/?view=portal&portal_from=' + encodeURIComponent(portalReturn) }
    assert.equal(readArchiveRoute().portalFrom, portalReturn, 'legacy portal_from URL is still read')
    writeArchiveRoute(readArchiveRoute(), { replace: true })
    assert.ok(!new URL(window.location).searchParams.has('portal_from') && readArchiveRoute().portalFrom === portalReturn, 'legacy portal_from moves into state')
  } finally { delete globalThis.window }
}

console.log('Archive route contract: story portal and detail routes verified')
