import { readFileSync, readdirSync } from 'node:fs'
import { PUBLIC_ROUTES, publicRoutePath } from '../src/core/publicRoutes.js'
// Route ownership, public-address enforcement and the stale player-return guard.
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { ref } from 'vue'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseScript } from '@babel/parser'
import { ENFORCED_ROUTE_VIEWS, ROUTE_SCHEMA, ownedRouteParams } from '../src/core/routeSchema.js'
import { ARCHIVE_ROUTE_CONTRACTS, ROUTE_QUERY_KEYS, VALID_VIEWS, buildArchiveSourceQuery, buildPublicArchiveUrl, buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'
import { playerReturnRoute } from '../src/core/PlayerEntryRequest.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'

for (const view of ['reader','player']) assert.ok(ENFORCED_ROUTE_VIEWS.has(view), view+' R4 requires enforced ownership')

// No public view may bypass the audited parameter ownership table.
for (const route of PUBLIC_ROUTES) assert.ok(ENFORCED_ROUTE_VIEWS.has(route.view), `${route.view}: public address requires enforced schema`)
// Components must use navigation helpers rather than hard-coded query addresses.
function checkComponents(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = new URL(entry.name, directory)
    if (entry.isDirectory()) checkComponents(new URL(entry.name + '/', directory))
    else if (/\.(vue|[cm]?js|tsx?)$/.test(entry.name)) assert.ok(!readFileSync(file, 'utf8').includes('?view='), `${file.pathname}: use public route/navigation helpers`)
  }
}
checkComponents(new URL('../src/components/', import.meta.url))

// Every view is covered; player is covered per audited return view.
for (const view of VALID_VIEWS) assert.ok(ownedRouteParams(view, ''), `schema covers ${view}`)
for (const key of Object.keys(ROUTE_SCHEMA)) {
  const view = key.startsWith('player:') ? 'player' : key
  assert.ok(VALID_VIEWS.has(view), `schema entry ${key} names a real view`)
}
// Schema parameters are real route keys, listed once per view.
const known = new Set(ROUTE_QUERY_KEYS)
for (const [key, params] of Object.entries(ROUTE_SCHEMA)) {
  assert.equal(new Set(params).size, params.length, `${key} lists a parameter once`)
  for (const param of params) assert.ok(known.has(param), `${key}: ${param} is a route query key`)
  for (const context of ['from', 'portal_from', 'home_from']) assert.ok(!params.includes(context), `${key}: ${context} lives in history state`)
}
// Required route fields are owned by their view.
const QUERY_OF = { pickTarget: 'pick', storyType: 'story_type', storySection: 'story_section', story: 'story', category: 'category',
  unit: 'unit', card: 'card', event: 'event', gasha: 'gasha', song: 'song' }
for (const [view, contract] of Object.entries(ARCHIVE_ROUTE_CONTRACTS)) {
  const owned = ownedRouteParams(view, '')
  for (const field of contract.required) {
    assert.ok(QUERY_OF[field], `${view}: required field ${field} has a query mapping`)
    assert.ok(owned.includes(QUERY_OF[field]), `${view}: required ${field} is owned by its schema entry`)
  }
}
// A stale player return must not leak into another page's address (it only means something for the player).
{
  const state = useArchiveNavigationState()
  state.returnViewAfterPlayer.value = 'event_detail'
  // Satisfy every view's required fields so no route falls back to another view.
  for (const [key, value] of Object.entries({ currentPickTarget: 'profile', currentCategoryId: 'idol', currentEventId: '10001', currentCardId: 'card1', currentGashaId: 'g1',
    currentSongId: 'song1', currentStoryFile: 'a.json', currentStoryDomain: 'main', currentStorySection: '101', currentArchiveUnitCode: '01jup' })) state[key].value = value
  for (const view of VALID_VIEWS) {
    if (view === 'player') continue
    state.view.value = view
    assert.ok(!buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).searchParams.has('return'), `${view} URL carries no player return`)
  }
  state.view.value = 'player'; state.currentScenarioFile.value = 'a.json'
  assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).searchParams.get('return'), 'event_detail', 'the player still records its return view')
}
// Enforced views serialize only their own parameters (plus context); older URLs with extras still read and are shortened on write.
{
  assert.ok([...ENFORCED_ROUTE_VIEWS].every(view => VALID_VIEWS.has(view)))
  const stale = (view, extra = {}) => {
    const url = new URL('http://localhost/'); for (const key of ROUTE_QUERY_KEYS.filter(key => key !== 'scenario')) url.searchParams.set(key, extra[key] ?? `${key}-x`)
    url.searchParams.set('view', view); return url
  }
  for (const view of [...ENFORCED_ROUTE_VIEWS].filter(view => view !== 'player')) {
    const owned = new Set(ownedRouteParams(view))
    for (const route of PUBLIC_ROUTES.filter(route => route.kind === 'section' && route.view === view)) for (const key of Object.keys(route.implied)) owned.add(key)
    const read = readArchiveRoute(stale(view, { category: 'idol', story_type: 'main', pick: 'profile', collection_kind: 'items', from: '?view=story_catalog' }))
    assert.equal(read.view, view === 'idols' ? 'idol_detail' : view, `${view}: an old URL with extras still opens the page`)
    const written = buildArchiveUrl('http://localhost/', read)
    const writtenOwned = read.view === 'idol_detail' ? new Set(ownedRouteParams(read.view)) : owned
    const keys = [...new Set([...written.searchParams.keys()])].filter(key => key !== 'view' && key !== 'from')
    assert.deepEqual(keys.filter(key => !writtenOwned.has(key)), [], `${view}: no non-owned parameter is written`)
    const state = useArchiveNavigationState(); state.readingDocumentId.value = 'doc1'; state.view.value = view; state.currentCardId.value = 'card1'; state.currentEventId.value = '10001'; state.currentGashaId.value = '210003'
    state.currentStoryDomain.value = 'main'; state.currentStorySection.value = '101'; state.filterQuery.value = 'q'; state.currentCharacterId.value = '001tom'; state.currentSongId.value = 'song1'
    const emitted = buildArchiveUrl('http://localhost/', state.currentArchiveRoute())
    const emittedOwned = emitted.searchParams.get('view') === 'idol_detail' ? new Set(ownedRouteParams('idol_detail')) : owned
    assert.deepEqual([...emitted.searchParams.keys()].filter(key => key !== 'view' && !emittedOwned.has(key)), [], `${view}: dirty state writes only the view and its own parameters`)
  }
  // The source context a page returns through is not pruned (it moves to history state on write).
  assert.equal(buildArchiveUrl('http://localhost/', { view: 'about', sourceRoute: '?view=cards' }).searchParams.get('from')?.startsWith('?view=cards'), true)
  // Detail pages keep exactly their identity, whatever list filters were left in state.
  {
    const state = useArchiveNavigationState(); state.currentCharacterId.value = '001tom'; state.currentCategoryId.value = 'idol'
    state.currentIdolUnitFilter.value = '1'; state.filterQuery.value = 'q'; state.currentCardId.value = 'card1'; state.currentStoryDomain.value = 'main'
    state.view.value = 'idol_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=idol_detail&category=idol&idol=001tom')
    state.currentArchiveUnitCode.value = '01jup'; state.view.value = 'unit_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=unit_detail&unit=01jup')
    state.currentCardId.value = '001tom_ssr01'; state.currentEventId.value = '10011'; state.view.value = 'card_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=card_detail&card=001tom_ssr01')
    const oldCard = readArchiveRoute('http://localhost/?view=card_detail&category=cards&idol=001tom&card=001tom_ssr01&event=10011&q=q', { history: false })
    assert.equal(oldCard.view, 'card_detail'); assert.equal(oldCard.card, '001tom_ssr01')
    assert.equal(buildArchiveUrl('http://localhost/', oldCard).search, '?view=card_detail&card=001tom_ssr01', 'an old card link is shortened on write')
    state.currentSongId.value = 'brndnf'; state.currentSongScope.value = 'unit'; state.songParentView.value = 'unit_detail'; state.view.value = 'song_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=song_detail&song=brndnf')
    const oldSong = readArchiveRoute('http://localhost/?view=song_detail&song=brndnf&song_scope=unit&parent=unit_detail&unit=01jup&idol=001tom', { history: false })
    assert.equal(oldSong.view, 'song_detail'); assert.equal(oldSong.song, 'brndnf')
    assert.equal(buildArchiveUrl('http://localhost/', oldSong).search, '?view=song_detail&song=brndnf', 'an old song link is shortened on write')
    // An event keeps only its opened-from fields (moved to history state on write), never list filters.
    state.currentEventId.value = '410018'; state.eventParentView.value = 'card_detail'; state.currentCardId.value = '001tom_ssr01'; state.view.value = 'event_detail'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=event_detail&category=idol&idol=001tom&card=001tom_ssr01&event=410018&parent=card_detail')
    const oldEvent = readArchiveRoute('http://localhost/?view=event_detail&event=410018&q=x&story_type=event&rarity=SSR&parent=card_detail&card=001tom_ssr01', { history: false })
    assert.equal(buildArchiveUrl('http://localhost/', oldEvent).search, '?view=event_detail&card=001tom_ssr01&event=410018&parent=card_detail', 'an old event link drops its list filters on write')
    const old = readArchiveRoute('http://localhost/?view=idol_detail&idol=001tom&unit_filter=1&q=x&card=c&story_type=main', { history: false })
    assert.equal(old.view, 'idol_detail'); assert.equal(old.idol, '001tom')
    assert.equal(buildArchiveUrl('http://localhost/', old).search, '?view=idol_detail&category=idol&idol=001tom', 'an old idol link is shortened on write')
    // 其他语音 keeps its shelf (?voices=) and nothing else; another view never carries it.
    state.currentVoiceShelf.value = 'live-result'; state.view.value = 'unused_archive'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=unused_archive&voices=live-result')
    assert.equal(readArchiveRoute('http://localhost/unused/?voices=live-result&q=x', { history: false }).voiceShelf, 'live-result')
    state.view.value = 'cards'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).searchParams.has('voices'), false)
    // 配乐 likewise keeps only its shelf (?sound=).
    state.currentSoundShelf.value = 'se'; state.view.value = 'score_archive'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).search, '?view=score_archive&sound=se')
    assert.equal(readArchiveRoute('http://localhost/scores/?sound=se&q=x', { history: false }).soundShelf, 'se')
    state.view.value = 'cards'
    assert.equal(buildArchiveUrl('http://localhost/', state.currentArchiveRoute()).searchParams.has('sound'), false)
  }
  // A story directory keeps its audited story filter.
  assert.ok(buildArchiveUrl('http://localhost/', { view: 'story_catalog', storyType: 'main', query: 'x' }).searchParams.has('story_type'))
  // An event_detail without an event falls back to the catalog without throwing.
  assert.doesNotThrow(() => buildArchiveUrl('http://localhost/', { view: 'event_detail' }))
}

// R4: fixtures are the return descriptors captured by the real playback controller's callers.
const playerReturns = [
  { view:'reader', reading:'doc1', readingRow:'row1', readingMode:'bilingual', readingScope:'chapter', readingRev:'sha256:'+'a'.repeat(64), storyType:'main', storySection:'101', story:'1_1_001_01.json' },
  { view:'event_detail', event:'410018', parentView:'card_detail', card:'001tom_ssr01', idol:'001tom', category:'idol', unit:'01jup' },
  { view:'mobile_archive', idol:'001tom', unit:'01jup', mobileMode:'phone', mobileScenario:'call1' },
  { view:'story_catalog', storyType:'event', storyMode:'search', storySection:'101', eventScope:'fixed_unit_event', availability:'playable', sort:'title', idol:'001tom', query:'query' },
  { view:'story_collection', storyType:'main', storySection:'101', story:'1_1_001_01.json', parentView:'song_detail', song:'brndnf', idol:'001tom', unit:'01jup', category:'idol' },
  { view:'seasonal_campaign', storyType:'seasonal_campaign', storySection:'valentine_2022', idol:'001tom' },
  { view:'work_archive', storyType:'work', idol:'001tom', story:'work.json', workMode:'lines' },
  { view:'idol_story_archive', storyType:'idol_story', storySection:'20101', idol:'001tom', episode:'1' },
  { view:'unit_detail', unit:'01jup' }, { view:'card_detail', card:'001tom_ssr01' },
  { view:'idol_detail', category:'idol', idol:'001tom' },
  { view:'unused_archive', voiceShelf:'live-result' }, { view:'score_archive', soundShelf:'se' },
]
const destinationQuery = {
  reader:{ reading:'doc1', reading_row:'row1', reading_mode:'bilingual', reading_scope:'chapter', reading_rev:'sha256:'+'a'.repeat(64), story_type:'main', story_section:'101', story:'1_1_001_01.json' },
  event_detail:{ event:'410018', parent:'card_detail', card:'001tom_ssr01', idol:'001tom', category:'idol', unit:'01jup' },
  mobile_archive:{ idol:'001tom', unit:'01jup', mobile_mode:'phone', mobile_scenario:'call1' },
  story_catalog:{ story_type:'event', story_mode:'search', story_section:'101', event_scope:'fixed_unit_event', availability:'playable', sort:'title', idol:'001tom', q:'query' },
  story_collection:{ story_type:'main', story_section:'101', story:'1_1_001_01.json', parent:'song_detail', song:'brndnf', idol:'001tom', unit:'01jup', category:'idol' },
  seasonal_campaign:{ story_type:'seasonal_campaign', story_section:'valentine_2022', idol:'001tom' },
  work_archive:{ story_type:'work', idol:'001tom', story:'work.json', work_mode:'lines' },
  idol_story_archive:{ story_type:'idol_story', story_section:'20101', idol:'001tom', episode:'1' },
  unit_detail:{unit:'01jup'}, card_detail:{card:'001tom_ssr01'}, idol_detail:{category:'idol',idol:'001tom'},
  unused_archive:{voices:'live-result'}, score_archive:{sound:'se'},
}
for (const destination of playerReturns) {
  assert.ok(ROUTE_SCHEMA['player:'+destination.view], `explicit contract for ${destination.view}`)
  const saturated = new URL('http://x/')
  for (const key of ROUTE_QUERY_KEYS) saturated.searchParams.set(key,key+'-fixture')
  for (const [key,value] of Object.entries({ view:'player', return:destination.view, scenario:'sample.json', reading:'doc1', category:'idol', story_type:'main', idol:'001tom', unit:'01jup', rarity:'SSR' })) saturated.searchParams.set(key,value)
  const shortened = buildArchiveUrl('http://x/',readArchiveRoute(saturated))
  assert.equal(shortened.searchParams.get('view'),'player')
  const allowed = new Set([...ROUTE_SCHEMA['player:'+destination.view],'view','from','portal_from','home_from'])
  assert.deepEqual([...shortened.searchParams.keys()].filter(key=>!allowed.has(key)),[],destination.view+' saturated URL prunes all non-owned fields')

  const state = useArchiveNavigationState()
  state.view.value = 'player'; state.returnViewAfterPlayer.value = destination.view
  state.playerEntryRoute.value = { ...destination, sourceRoute:'?view=cards&rarity=SSR' }
  state.currentScenarioFile.value = 'sample.json'; state.currentScenarioStartStep.value = 2; state.currentScenarioEndStep.value = 9
  state.currentScenarioInitialStep.value = 3; state.currentPreviewCue.value = 'cue1'; state.playMode.value = 'segment'
  const written = buildArchiveUrl('http://x/cards/?runtimeDebug=1', { ...state.currentArchiveRoute(), rarity:'SSR', assetState:'ready', relationState:'linked' })
  assert.equal(written.searchParams.get('view'), 'player')
  assert.equal(written.searchParams.get('return'), destination.view)
  for (const [key,value] of Object.entries(destinationQuery[destination.view])) assert.equal(written.searchParams.get(key),value,destination.view+' owns '+key)
  for (const [key,value] of Object.entries({ scenario:'sample.json', start_step:'2', end_step:'9', at_step:'3', voice:'cue1', play_mode:'segment' })) assert.equal(written.searchParams.get(key),value, destination.view+'/'+key)
  assert.equal(written.searchParams.get('runtimeDebug'),'1', 'unknown visit-only parameter survives')
  for (const key of ['rarity','asset_state','relation_state']) assert.ok(!written.searchParams.has(key), destination.view+' prunes '+key)
  assert.ok(!buildPublicArchiveUrl('http://x/', state.currentArchiveRoute()).searchParams.has('from'), 'Player shares carry no local source')
  const restored = playerReturnRoute(readArchiveRoute(written), destination.view)
  // Compare the returned page's explicit serialized fields, including reader owner context.
  assert.equal(buildArchiveUrl('http://x/', { ...restored, sourceRoute:'' }).search, buildArchiveUrl('http://x/', destination).search, destination.view+' cold return retains destination state')
  assert.ok(!buildArchiveUrl('http://x/', restored).searchParams.has('return'))
  const live = { ...useArchiveNavigationState(), loading:ref(false), preloadProgress:ref(0) }
  let returned = null, emitted = null
  const controller = useStoryPlaybackController({ state:live, navigation:createArchiveNavigationCoordinator(),
    prepare:async () => ({ scenario_id:'sample', steps:[{step_id:1}] }), loadPlayer:async () => {}, preloadAssets:async () => {},
    syncRoute:() => { emitted = buildArchiveUrl('http://x/', live.currentArchiveRoute()) },
    returnTo:(view,route) => { returned = { view,route } }, onError:error => { throw error },
  })
  assert.equal(await controller.load('sample.json', destination.view, { returnRoute:destination, startStep:2, endStep:9, initialStep:3, entryIntent:'segment' }),true)
  const cold = readArchiveRoute(emitted)
  assert.equal(cold.returnView,destination.view)
  const coldDestination = playerReturnRoute(cold)
  assert.equal(buildArchiveUrl('http://x/', coldDestination).search, buildArchiveUrl('http://x/', destination).search)
  await controller.close()
  assert.equal(returned.view,destination.view)
  assert.equal(buildArchiveUrl('http://x/', returned.route).search, buildArchiveUrl('http://x/', destination).search)
  controller.dispose()

}
// Execute the component's actual href function: modified clicks open a clean standalone query.
{
  const script = parseSfc(readFileSync(new URL('../src/components/archive/ArchiveStoryCollection.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
  const node = parseScript(script, { sourceType:'module' }).program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'readingHref')
  const href = vm.runInNewContext('('+script.slice(node.start,node.end)+')', {
    props:{ readerSource:{ view:'story_collection', storyType:'main', storySection:'101', parentView:'unit_detail', category:'idol', unit:'01jup' } }, buildArchiveUrl, buildPublicArchiveUrl, buildArchiveSourceQuery,
  })({ file:'chapter.json' }, { document_id:'doc1' })
  const url = new URL(href,'http://x/stories/main/101/')
  assert.equal(url.pathname,'/'); assert.equal(url.searchParams.get('view'),'reader')
  for (const key of ['from','parent','category','unit']) assert.ok(!url.searchParams.has(key), 'Reader href '+key)
  for (const [key,value] of Object.entries({ reading:'doc1', reading_scope:'chapter', story_type:'main', story_section:'101', story:'chapter.json' })) assert.equal(url.searchParams.get(key),value)
}
// Every registered path must accept the legacy scenario query as a Player entry, never as the path's page.
for (const locator of PUBLIC_ROUTES) {
  const identity = { idol:'001tom', home_idol:'001tom', unit:'01jup', card:'001tom_ssr01', song:'brndnf', event:'410018', gasha:'210003', story_type:locator.storyKind || locator.implied.story_type || 'main', story_section:({ main:'101', extra:'601', birthday:'001tom', unit_story:'1' })[locator.implied.story_type] || 'valentine_2022' }
  const path = publicRoutePath(locator, new URLSearchParams({ ...identity, ...locator.implied }))
  assert.ok(path, locator.view+' has a valid path fixture')
  const route = readArchiveRoute('http://x'+path+'?scenario=sample.json&start_step=2&end_step=9&at_step=3')
  assert.equal(route.view,'player',path); assert.equal(route.scenario,'sample.json',path)
  assert.equal(route.startStep,2,path); assert.equal(route.endStep,9,path); assert.equal(route.initialStep,3,path)
}
console.log(`Route schema: ${Object.keys(ROUTE_SCHEMA).length} view entries cover all ${VALID_VIEWS.size} views; parameters are route keys; contract requirements are owned; stale player return stays out of other URLs ; enforced views are pruned`)
